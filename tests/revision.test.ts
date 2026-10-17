import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cambiosDeTexto,
  cargaRevision,
  cargaRevisionV2,
  CLAVES_V2,
  claveRespuesta,
  confirmarParte,
  desactualizadas,
  desdeClave,
  ESPERA_GUARDADO_MS,
  fechaValida,
  MAX_URL,
  nombreArchivoParte,
  partesEnvio,
  pendientesComoCorrectas,
  pendientesDeEnvio,
  propuestaDePosicion,
  respuestaCompleta,
  separarIncompletas,
  urlFormulario,
  urlFormularioV2,
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

describe('envío en un solo formulario (#58)', () => {
  const de = (estructura: string, campo: string, extra: Partial<Respuesta> = {}): Respuesta => ({
    ...r(campo),
    estructura,
    ...extra,
  });
  const cargaDe = (url: string | null) => JSON.parse(new URL(url!).searchParams.get('entry.3')!);

  it('v 2, revisor en r, agrupada por estructura en orden de aparición y con claves cortas', () => {
    const entrada = [
      de('hippocampus', 'ubicacion'),
      de('thalamus', 'que_es'),
      de('hippocampus', 'que_es'),
      de('amygdala', 'nombre'),
    ];
    const cruda = cargaRevisionV2('P', entrada);
    const carga = JSON.parse(cruda);
    expect(carga.v).toBe(2);
    expect(carga.r).toBe('P');
    expect(Object.keys(carga.e)).toEqual(['hippocampus', 'thalamus', 'amygdala']);
    expect(carga.e.hippocampus).toHaveLength(2);
    const permitidas: string[] = Object.values(CLAVES_V2);
    for (const el of Object.values<Record<string, unknown>[]>(carga.e).flat()) {
      expect(Object.keys(el).every((k) => permitidas.includes(k))).toBe(true);
    }
    for (const largo of ['"fecha"', '"estructura"', '"campo"', '"veredicto"']) expect(cruda).not.toContain(largo);
  });

  it('las claves cortas llevan cada campo opcional y omiten los que no están', () => {
    const completa = de('x', 'trazo:Vagus_nerve.R 01', {
      veredicto: 'corregir',
      propuesta: 'p',
      comentario: 'k',
      posicion: [1, 2, 3],
      malla: 'm1',
      ramo: 'a1',
      version: 'sin-ficha',
    });
    const sinIdioma: Respuesta = { estructura: 'x', campo: 'nombre', veredicto: 'correcto', version: '0.1.0', fecha: '' };
    const { e } = JSON.parse(cargaRevisionV2('P', [completa, sinIdioma]));
    expect(e.x[0]).toEqual({ c: 'trazo:Vagus_nerve.R 01', i: 'es', d: 'corregir', p: 'p', k: 'k', x: [1, 2, 3], m: 'm1', a: 'a1', s: 'sin-ficha', f: '2026-10-11T00:00:00Z' });
    expect(e.x[1]).toEqual({ c: 'nombre', d: 'correcto', s: '0.1.0' });
    expect(Object.hasOwn(e.x[1], 'f')).toBe(false);
  });

  it('una fecha no vacía viaja tal cual en f', () => {
    const { e } = JSON.parse(cargaRevisionV2('P', [{ ...r('nombre'), fecha: 'abc' }]));
    expect(e.hippocampus[0].f).toBe('abc');
  });

  it('tres fichas cortas salen en una sola parte con los tres ids en el campo Estructura (D2)', () => {
    const ids = ['hippocampus', 'thalamus', 'amygdala'];
    const respuestas = ids.flatMap((id) => ['a', 'b', 'c', 'd'].map((c) => de(id, c)));
    const partes = partesEnvio(config, 'P', respuestas);
    expect(partes).toHaveLength(1);
    expect(partes[0]!.url).not.toBeNull();
    expect(partes[0]!.url!.length).toBeLessThanOrEqual(MAX_URL);
    const p = new URL(partes[0]!.url!).searchParams;
    expect(p.get('entry.1')).toBe('P');
    expect(p.get('entry.2')).toBe('hippocampus,thalamus,amygdala');
    const carga = cargaDe(partes[0]!.url);
    expect(Object.keys(carga.e)).toHaveLength(3);
    expect(Object.values<unknown[]>(carga.e).flat()).toHaveLength(12);
    expect(partes[0]!.carga).toBe(p.get('entry.3'));
  });

  it('solo se parte si la URL pasaría de MAX_URL, y cada parte no podía recibir la siguiente respuesta (D1)', () => {
    const muchas = Array.from({ length: 120 }, (_, i) => de(i % 2 ? 'thalamus' : 'hippocampus', `campo.${i}`, { propuesta: 'ñ'.repeat(40) }));
    const partes = partesEnvio(config, 'P', muchas);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((x) => x.url !== null && x.url.length <= MAX_URL)).toBe(true);
    const enPartes = partes.flatMap((x) => x.respuestas);
    expect(enPartes).toHaveLength(120);
    expect(new Set(enPartes.map(claveRespuesta))).toEqual(new Set(muchas.map(claveRespuesta)));
    const total = partes.reduce((n, x) => n + Object.values<unknown[]>(cargaDe(x.url).e).flat().length, 0);
    expect(total).toBe(120);
    for (let i = 0; i < partes.length - 1; i++) {
      const conLaSiguiente = [...partes[i]!.respuestas, partes[i + 1]!.respuestas[0]!];
      expect(urlFormularioV2(config, 'P', conLaSiguiente).length).toBeGreaterThan(MAX_URL);
    }
  });

  it('una respuesta que no cabe sola va en su propia parte sin URL y no se pierde (D3)', () => {
    const grande = de('hippocampus', 'grande', { propuesta: 'ñ'.repeat(3000) });
    const partes = partesEnvio(config, 'P', [de('hippocampus', 'a'), grande, de('hippocampus', 'b')]);
    const sinUrl = partes.filter((x) => x.url === null);
    expect(sinUrl).toHaveLength(1);
    expect(sinUrl[0]!.respuestas).toEqual([grande]);
    expect(JSON.parse(sinUrl[0]!.carga).e.hippocampus[0].c).toBe('grande');
    expect(partes.flatMap((x) => x.respuestas)).toHaveLength(3);
    expect(partes.filter((x) => x.url !== null).every((x) => x.url!.length <= MAX_URL)).toBe(true);
  });

  it('sin formulario configurado sale una sola parte sin URL con todo (D3)', () => {
    const respuestas = [de('hippocampus', 'a'), de('thalamus', 'b')];
    const partes = partesEnvio({ ...config, urlFormulario: '' }, 'P', respuestas);
    expect(partes).toHaveLength(1);
    expect(partes[0]!.url).toBeNull();
    const carga = JSON.parse(partes[0]!.carga);
    expect(carga.v).toBe(2);
    expect(Object.keys(carga.e)).toEqual(['hippocampus', 'thalamus']);
    expect(partes[0]!.respuestas).toHaveLength(2);
  });

  it('sin respuestas no hay partes (D3)', () => {
    expect(partesEnvio(config, 'P', [])).toEqual([]);
    expect(partesEnvio({ ...config, urlFormulario: '' }, 'P', [])).toEqual([]);
  });

  it('las respuestas se agrupan por estructura sin cambiar el orden dentro de cada una', () => {
    const partes = partesEnvio(config, 'P', [de('a', '1'), de('b', '2'), de('a', '3')]);
    expect(partes[0]!.respuestas.map((x) => `${x.estructura}:${x.campo}`)).toEqual(['a:1', 'a:3', 'b:2']);
  });

  describe('pendientesDeEnvio (D4)', () => {
    const corregir = (extra: Partial<Respuesta> = {}): Respuesta => ({ ...r('que_es'), veredicto: 'corregir', ...extra });

    it('sin confirmadas, todas las completas son pendientes', () => {
      const lista = [r('a'), r('b'), corregir({ propuesta: 'x' })];
      expect(pendientesDeEnvio(lista, {})).toEqual(lista);
    });

    it('una confirmada con la misma fecha no es pendiente', () => {
      const a = r('a');
      expect(pendientesDeEnvio([a, r('b')], { [claveRespuesta(a)]: a.fecha }).map((x) => x.campo)).toEqual(['b']);
    });

    it('una confirmada y luego editada (otra fecha) vuelve a ser pendiente', () => {
      const a = r('a');
      const editada = { ...a, veredicto: 'no_es_mi_area' as const, fecha: '2026-10-12T00:00:00Z' };
      expect(pendientesDeEnvio([editada], { [claveRespuesta(a)]: a.fecha })).toEqual([editada]);
    });

    it('un "Corregir" sin propuesta, posición ni ramo nunca es pendiente, esté o no confirmado', () => {
      const vacio = corregir();
      expect(pendientesDeEnvio([vacio], {})).toEqual([]);
      expect(pendientesDeEnvio([corregir({ propuesta: '  ' })], {})).toEqual([]);
      expect(pendientesDeEnvio([vacio], { [claveRespuesta(vacio)]: 'otra' })).toEqual([]);
    });

    it('un "Corregir" con posición es pendiente', () => {
      const conPosicion = corregir({ campo: 'posicion', posicion: [0, 0, 0] });
      expect(pendientesDeEnvio([conPosicion], {})).toEqual([conPosicion]);
    });

    it('una confirmada de una respuesta borrada no afecta', () => {
      const a = r('a');
      expect(pendientesDeEnvio([a], { 'hippocampus|borrada|es': 'x' })).toEqual([a]);
    });
  });

  describe('confirmarParte (D4)', () => {
    it('agrega la clave y la fecha de cada respuesta de la parte, conserva las previas y no muta', () => {
      const previas = { 'otra|campo|': 'antes' };
      const antes = structuredClone(previas);
      const a = r('a');
      const b = { ...r('b'), estructura: 'thalamus', fecha: 'f2' };
      const nuevas = confirmarParte(previas, { url: null, carga: '', respuestas: [a, b] });
      expect(nuevas).toEqual({ 'otra|campo|': 'antes', [claveRespuesta(a)]: a.fecha, [claveRespuesta(b)]: 'f2' });
      expect(previas).toEqual(antes);
      expect(nuevas).not.toBe(previas);
    });

    it('lo confirmado deja de ser pendiente', () => {
      const lista = [r('a'), r('b')];
      const parte = partesEnvio(config, 'P', lista)[0]!;
      expect(pendientesDeEnvio(lista, confirmarParte({}, parte))).toEqual([]);
    });
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

describe('fechaValida (entrada externa)', () => {
  const de40 = `2026-10-10T10:00:00.${'0'.repeat(19)}Z`;
  const de41 = `2026-10-10T10:00:00.${'0'.repeat(20)}Z`;

  it('acepta una fecha ISO', () => {
    expect(fechaValida('2026-10-14T10:00:00.000Z')).toBe(true);
  });

  it('acepta una cadena parseable de exactamente 40 caracteres', () => {
    expect(de40.length).toBe(40);
    expect(Number.isFinite(Date.parse(de40))).toBe(true);
    expect(fechaValida(de40)).toBe(true);
  });

  it('rechaza una cadena parseable de 41 caracteres', () => {
    expect(de41.length).toBe(41);
    expect(Number.isFinite(Date.parse(de41))).toBe(true);
    expect(fechaValida(de41)).toBe(false);
  });

  it.each<[string, unknown]>([
    ['un número', 1760000000000],
    ['null', null],
    ['undefined', undefined],
    ['un objeto', { a: 1 }],
    ['un texto vacío', ''],
    ['un texto ilegible', 'ayer'],
  ])('rechaza %s', (_n, valor) => {
    expect(fechaValida(valor)).toBe(false);
  });
});

describe('nombre del archivo de una parte (#149)', () => {
  it('no lleva el código: revision-parte-<n>.json', () => {
    expect(nombreArchivoParte(2)).toBe('revision-parte-2.json');
    expect(nombreArchivoParte(1)).toBe('revision-parte-1.json');
  });

  it('PanelRevision.tsx lo usa y no arma el nombre con el código', () => {
    const fuente = readFileSync('src/components/PanelRevision.tsx', 'utf8');
    expect(fuente).toContain('nombreArchivoParte(i + 1)');
    expect(fuente).not.toContain('revision-${revisor}');
    expect(fuente).not.toMatch(/`revision-\$\{[^}]*\}-parte/);
  });

  it('el contenido sigue llevando el código (r), que el importador exige', () => {
    const carga = JSON.parse(cargaRevisionV2('ABC', [r('que_es.es')])) as { v: number; r: string };
    expect(carga.v).toBe(2);
    expect(carga.r).toBe('ABC');
  });
});
