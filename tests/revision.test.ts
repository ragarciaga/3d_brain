import { describe, expect, it } from 'vitest';
import {
  cambiosDeTexto,
  cargaRevision,
  claveRespuesta,
  desactualizadas,
  desdeClave,
  ESPERA_GUARDADO_MS,
  MAX_URL,
  pendientesComoCorrectas,
  propuestaDePosicion,
  respuestaCompleta,
  separarIncompletas,
  urlFormulario,
  type Respuesta,
} from '../src/lib/revision';

const config = {
  urlFormulario: 'https://docs.google.com/forms/d/e/abc/viewform',
  campos: { codigo: 'entry.1', estructura: 'entry.2', revision: 'entry.3' },
};
const r = (campo: string, version = '0.1.0'): Respuesta => ({
  estructura: 'hippocampus',
  campo,
  idioma: 'es',
  veredicto: 'correcto',
  version,
  fecha: '2026-10-11T00:00:00Z',
});

describe('revisión docente (F24)', () => {
  it('la clave separa estructura, campo e idioma', () => {
    expect(claveRespuesta({ estructura: 'a', campo: 'ubicacion', idioma: 'es' })).not.toBe(
      claveRespuesta({ estructura: 'a', campo: 'ubicacion', idioma: 'en' }),
    );
  });

  it('arma la URL prellenada del formulario con código, estructura y revisión', () => {
    const url = urlFormulario(config, 'PROF01', 'hippocampus', [r('ubicacion')])!;
    const p = new URL(url).searchParams;
    expect(p.get('entry.1')).toBe('PROF01');
    expect(p.get('entry.2')).toBe('hippocampus');
    expect(JSON.parse(p.get('entry.3')!).respuestas[0].campo).toBe('ubicacion');
  });

  it('sin configuración no hay URL (la app ofrece copiar o descargar)', () => {
    expect(urlFormulario({ ...config, urlFormulario: '' }, 'P', 'h', [r('x')])).toBeNull();
  });

  it('si la revisión es demasiado larga para una URL, devuelve null', () => {
    const muchas = Array.from({ length: 200 }, (_, i) => ({ ...r(`campo.${i}`), propuesta: 'x'.repeat(50) }));
    expect(urlFormulario(config, 'P', 'h', muchas)).toBeNull();
    expect(MAX_URL).toBeLessThan(8000);
  });

  it('marca respuestas sobre una versión vieja del contenido', () => {
    expect(desactualizadas([r('a', '0.1.0'), r('b', '0.2.0')], () => '0.2.0').map((x) => x.campo)).toEqual(['a']);
  });
});

describe('posición propuesta (F24)', () => {
  const MARCADOR = 'm-periaqueductal-grey';
  const pos = (comentario?: string): Respuesta => ({
    estructura: MARCADOR,
    campo: 'posicion',
    veredicto: 'corregir',
    posicion: [0.1, 0.2, 0.3],
    comentario,
    version: 'sin-ficha',
    fecha: '2026-10-11T00:00:00Z',
  });
  const mapa = (...rs: Respuesta[]) => Object.fromEntries(rs.map((x) => [claveRespuesta(x), x]));

  it('sin respuesta para la estructura no hay propuesta', () => {
    expect(propuestaDePosicion({}, {}, MARCADOR)).toBeNull();
  });

  it('con respuesta y pieza registrada devuelve ambas', () => {
    const x = pos();
    expect(propuestaDePosicion(mapa(x), { [MARCADOR]: 'stomach' }, MARCADOR)).toEqual({ respuesta: x, pieza: 'stomach' });
  });

  it('sin pieza registrada (tras recargar) la pieza es null', () => {
    const x = pos();
    expect(propuestaDePosicion(mapa(x), {}, MARCADOR)).toEqual({ respuesta: x, pieza: null });
  });

  it('una respuesta de otro campo de la misma estructura no cuenta', () => {
    const otra: Respuesta = { ...r('nombre'), estructura: MARCADOR };
    expect(propuestaDePosicion(mapa(otra), {}, MARCADOR)).toBeNull();
  });

  it('una respuesta de posición sin coordenadas no cuenta', () => {
    const sinCoordenadas: Respuesta = { ...pos(), posicion: undefined };
    expect(propuestaDePosicion(mapa(sinCoordenadas), { [MARCADOR]: 'stomach' }, MARCADOR)).toBeNull();
  });

  it('una respuesta de posición de otra estructura no cuenta', () => {
    expect(propuestaDePosicion(mapa({ ...pos(), estructura: 'otro-marcador' }), {}, MARCADOR)).toBeNull();
  });

  it('el comentario y la posición viajan en la carga que se envía', () => {
    const carga = JSON.parse(cargaRevision('PROF01', MARCADOR, [pos('comentario de prueba')]));
    expect(carga.respuestas[0].comentario).toBe('comentario de prueba');
    expect(carga.respuestas[0].posicion).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('respuestas incompletas', () => {
  const corregir = (extra: Partial<Respuesta> = {}): Respuesta => ({ ...r('que_es'), veredicto: 'corregir', ...extra });

  it('correcto y "no es mi área" siempre están completos', () => {
    expect(respuestaCompleta(r('a'))).toBe(true);
    expect(respuestaCompleta({ ...r('a'), veredicto: 'no_es_mi_area' })).toBe(true);
  });

  it('"Corregir" con texto propuesto está completo', () => expect(respuestaCompleta(corregir({ propuesta: 'x' }))).toBe(true));

  it('"Corregir" sin propuesta o con solo espacios está incompleto', () => {
    expect(respuestaCompleta(corregir())).toBe(false);
    expect(respuestaCompleta(corregir({ propuesta: '   ' }))).toBe(false);
  });

  it('un comentario solo no completa un "Corregir"', () => expect(respuestaCompleta(corregir({ comentario: 'nota' }))).toBe(false));

  it('la posición de un marcador y el ramo de un trazo son la propuesta de esas respuestas', () => {
    expect(respuestaCompleta(corregir({ posicion: [0, 0, 0] }))).toBe(true);
    expect(respuestaCompleta(corregir({ ramo: 'no_se' }))).toBe(true);
  });

  it('separarIncompletas conserva el orden de las completas y cuenta las otras', () => {
    expect(separarIncompletas([])).toEqual({ completas: [], incompletas: 0 });
    expect(separarIncompletas([corregir()])).toEqual({ completas: [], incompletas: 1 });
    const a = r('a');
    const b = corregir({ campo: 'b', propuesta: 'x' });
    const { completas, incompletas } = separarIncompletas([a, corregir({ campo: 'c' }), b, corregir({ campo: 'd', propuesta: ' ' })]);
    expect(completas).toEqual([a, b]);
    expect(incompletas).toBe(2);
  });
});

describe('guardado mientras se escribe', () => {
  const corregir: Respuesta = { ...r('que_es'), veredicto: 'corregir', propuesta: 'viejo', comentario: 'nota' };

  it('espera 500 ms desde la última tecla', () => expect(ESPERA_GUARDADO_MS).toBe(500));

  it('si los campos coinciden con lo guardado no hay nada que guardar', () => {
    expect(cambiosDeTexto(corregir, 'viejo', 'nota')).toBeNull();
  });

  it('un campo vacío es lo mismo que ninguno', () => {
    expect(cambiosDeTexto(r('a'), '', '')).toBeNull();
    expect(cambiosDeTexto({ ...corregir, propuesta: undefined, comentario: undefined }, '', '')).toBeNull();
  });

  it('una propuesta nueva con "Corregir" se guarda con el comentario actual', () => {
    expect(cambiosDeTexto(corregir, 'nuevo', 'nota')).toEqual({ propuesta: 'nuevo', comentario: 'nota' });
  });

  it('con otro veredicto la propuesta se ignora', () => {
    expect(cambiosDeTexto(r('a'), 'texto suelto', '')).toBeNull();
    expect(cambiosDeTexto(r('a'), 'texto suelto', 'c')).toEqual({ propuesta: undefined, comentario: 'c' });
  });
});

describe('envío en partes', () => {
  it('una revisión larga se parte en varias URL que caben en el límite y no pierden respuestas', async () => {
    const { urlsFormulario } = await import('../src/lib/revision');
    const muchas = Array.from({ length: 120 }, (_, i) => ({ ...r(`campo.${i}`), propuesta: 'ñ'.repeat(40) }));
    const urls = urlsFormulario(config, 'P', 'h', muchas);
    expect(urls.length).toBeGreaterThan(1);
    expect(urls.every((u) => u.length <= MAX_URL)).toBe(true);
    const total = urls.reduce((n, u) => n + JSON.parse(new URL(u).searchParams.get('entry.3')!).respuestas.length, 0);
    expect(total).toBe(120);
  });
});

describe('marcar todo como correcto (#66)', () => {
  const resp = (campo: string, extra: Partial<Respuesta> = {}): Respuesta => ({
    estructura: 'a',
    campo,
    idioma: 'es',
    veredicto: 'correcto',
    version: 'v0',
    fecha: 'antes',
    ...extra,
  });
  const clave = (campo: string) => claveRespuesta({ estructura: 'a', campo, idioma: 'es' });
  const mapa = (...l: Respuesta[]) => Object.fromEntries(l.map((x) => [claveRespuesta(x), x]));

  it('desdeClave separa estructura, campo e idioma, y un idioma vacío queda sin definir', () => {
    expect(desdeClave('a|ubicacion|es')).toEqual({ estructura: 'a', campo: 'ubicacion', idioma: 'es' });
    expect(desdeClave('a|nombre|en').idioma).toBe('en');
    expect(desdeClave('a|latin|').idioma).toBeUndefined();
  });

  it('desdeClave lanza con una clave sin tres partes o con otro idioma', () => {
    expect(() => desdeClave('a|latin')).toThrow();
    expect(() => desdeClave('a|latin|es|x')).toThrow();
    expect(() => desdeClave('a|x|fr')).toThrow();
  });

  it('desdeClave es la inversa de claveRespuesta para todos los campos de todas las fichas, en es y en', async () => {
    const { camposDeFicha } = await import('../src/lib/prioridad');
    const { estructuras } = await import('../src/data/atlas');
    let vistas = 0;
    for (const id of Object.keys(estructuras).filter((k) => estructuras[k]!.ficha)) {
      for (const idioma of ['es', 'en'] as const) {
        for (const k of camposDeFicha(id, idioma)) {
          expect(claveRespuesta(desdeClave(k))).toBe(k);
          vistas++;
        }
      }
    }
    expect(vistas).toBeGreaterThan(0);
  });

  it('sin claves pendientes no devuelve nada', () => {
    const claves = ['x', 'y'].map(clave);
    expect(pendientesComoCorrectas(claves, mapa(resp('x'), resp('y', { veredicto: 'no_es_mi_area' })), 'v1', 'ahora')).toEqual([]);
    expect(pendientesComoCorrectas([], {}, 'v1', 'ahora')).toEqual([]);
  });

  it('con una pendiente solo responde esa y respeta Corregir (con y sin texto) y No es mi área', () => {
    const respuestas = mapa(
      resp('a1', { veredicto: 'corregir', propuesta: 'cambio' }),
      resp('a2', { veredicto: 'corregir' }),
      resp('a3', { veredicto: 'no_es_mi_area' }),
    );
    const salida = pendientesComoCorrectas(['a1', 'a2', 'a3', 'libre'].map(clave), respuestas, 'v1', 'ahora');
    expect(salida).toEqual([{ estructura: 'a', campo: 'libre', idioma: 'es', veredicto: 'correcto', version: 'v1', fecha: 'ahora' }]);
    expect(salida[0]).not.toHaveProperty('propuesta');
    expect(salida[0]).not.toHaveProperty('comentario');
  });

  it('con varias pendientes conserva el orden de entrada y no repite claves', () => {
    const claves = ['c', 'a', 'c', 'b', 'a'].map(clave);
    const salida = pendientesComoCorrectas(claves, mapa(resp('b')), 'v1', 'ahora');
    expect(salida.map((x) => x.campo)).toEqual(['c', 'a']);
    expect(salida.every((x) => x.veredicto === 'correcto' && x.version === 'v1' && x.fecha === 'ahora')).toBe(true);
  });

  it('un correcto previo con comentario no se toca y las respuestas no se mutan', () => {
    const respuestas = mapa(resp('a', { comentario: 'ojo' }));
    const antes = structuredClone(respuestas);
    const salida = pendientesComoCorrectas([clave('a'), clave('b')], respuestas, 'v1', 'ahora');
    expect(salida.map((x) => x.campo)).toEqual(['b']);
    expect(respuestas).toEqual(antes);
  });
});
