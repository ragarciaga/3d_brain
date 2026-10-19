// Reportar un error (F12): las partes que se pueden señalar salen de la ficha y la descripción se valida.
import { describe, expect, it } from 'vitest';
import { MAX_DESCRIPCION, MAX_URL } from '../src/config/reporte';
import { estructuras } from '../src/data/atlas';
import { camposDeFicha } from '../src/lib/prioridad';
import { descripcionValida, partesDeFicha } from '../src/lib/reporte';

const COPIA = 'copia-de-prueba-reporte';
const conFicha = Object.keys(estructuras).filter((id) => estructuras[id]!.ficha);
// Campo de una clave de respuesta `${id}|${campo}|${idioma}`.
const campoDe = (id: string, clave: string) => clave.slice(id.length + 1, clave.lastIndexOf('|'));
const camposSinIdioma = (id: string, idioma: 'es' | 'en') =>
  new Set(camposDeFicha(id, idioma).map((clave) => campoDe(id, clave)));

describe('partesDeFicha', () => {
  it('gracile-lobule: general, los campos de la ficha sin idioma y sin dudas', () => {
    const f = estructuras['gracile-lobule']?.ficha;
    expect(f).toBeTruthy();
    const esperado = [
      'general',
      'nombre',
      'latin',
      'pieza',
      'que_es',
      'para_que_sirve',
      'ubicacion',
      'relaciones',
      ...f!.relevancia.map((_, i) => `relevancia.${i}`),
      ...f!.fuentes.map((_, i) => `fuente.${i}`),
      ...(f!.recursos.length > 0 ? ['recursos'] : []),
    ];
    const partes = partesDeFicha('gracile-lobule');
    expect(partes).toEqual(esperado);
    // Esta ficha tiene una duda abierta (duda.0) en la revisión, y no sale como parte.
    expect(camposDeFicha('gracile-lobule', 'es').some((k) => k.includes('|duda.0|'))).toBe(true);
    expect(partes.some((p) => p.startsWith('duda.'))).toBe(false);
  });

  it('recursos va al final solo si la ficha tiene recursos propios', () => {
    const con = conFicha.find((id) => estructuras[id]!.ficha!.recursos.length > 0);
    expect(con).toBeTruthy();
    expect(partesDeFicha(con!).at(-1)).toBe('recursos');
    // Hoy todas las fichas tienen recursos: la variante sin recursos es una copia en memoria, que se quita al terminar.
    const base = estructuras[con!]!;
    estructuras[COPIA] = { ...base, ficha: { ...base.ficha!, recursos: [] } };
    try {
      const partes = partesDeFicha(COPIA);
      expect(partes).not.toContain('recursos');
      expect(partes).toContain('que_es');
    } finally {
      delete estructuras[COPIA];
    }
  });

  it('sinonimos sale una sola vez aunque haya sinónimos en es y en, y nombre una sola vez', () => {
    const ambos = conFicha.find((id) => estructuras[id]!.sinonimos.es.length > 0 && estructuras[id]!.sinonimos.en.length > 0);
    expect(ambos).toBeTruthy();
    // La ficha de prueba produce las dos claves de sinónimos; las partes las juntan en una.
    expect(camposDeFicha(ambos!, 'es').filter((k) => k.includes('|sinonimos|'))).toHaveLength(2);
    expect(partesDeFicha(ambos!).filter((p) => p === 'sinonimos')).toHaveLength(1);
    for (const id of conFicha) expect(partesDeFicha(id).filter((p) => p === 'nombre')).toHaveLength(1);
  });

  it('sin ficha o con un id que no existe: general y nombre', () => {
    expect(partesDeFicha('no-existe')).toEqual(['general', 'nombre']);
    // Hoy todas las entradas tienen ficha: la entrada sin ficha es una copia en memoria, que se quita al terminar.
    estructuras[COPIA] = { ...estructuras[conFicha[0]!]!, ficha: null };
    try {
      expect(partesDeFicha(COPIA)).toEqual(['general', 'nombre']);
    } finally {
      delete estructuras[COPIA];
    }
  });

  it('en todas las fichas: general primero, sin repetidas, sin dudas ni posición ni trazos', () => {
    expect(conFicha.length).toBeGreaterThan(20);
    for (const id of conFicha) {
      const partes = partesDeFicha(id);
      expect(partes[0], id).toBe('general');
      expect(new Set(partes).size, id).toBe(partes.length);
      expect(partes.filter((p) => /^duda\.|^posicion$|^trazo:|^trazado_/.test(p)), id).toEqual([]);
    }
  });

  it('cada parte (salvo general y recursos) es un campo de camposDeFicha, en los dos idiomas (R7.1)', () => {
    for (const id of conFicha) {
      const es = camposSinIdioma(id, 'es');
      const en = camposSinIdioma(id, 'en');
      for (const p of partesDeFicha(id).filter((x) => x !== 'general' && x !== 'recursos')) {
        expect(es.has(p), `${id} ${p} es`).toBe(true);
        expect(en.has(p), `${id} ${p} en`).toBe(true);
      }
    }
  });
});

describe('descripcionValida', () => {
  it('rechaza lo vacío y lo que solo tiene espacios', () => {
    expect(descripcionValida('')).toBe(false);
    expect(descripcionValida(' ')).toBe(false);
    expect(descripcionValida(' \n\t ')).toBe(false);
  });

  it('acepta de 1 a 1500 caracteres y rechaza 1501', () => {
    expect(descripcionValida('a')).toBe(true);
    expect(descripcionValida('a'.repeat(1500))).toBe(true);
    expect(descripcionValida('a'.repeat(1501))).toBe(false);
  });

  it('mide el texto crudo, no el recortado', () => {
    expect(descripcionValida(' ' + 'a'.repeat(1500))).toBe(false);
  });
});

describe('constantes del reporte', () => {
  it('los límites son los del diseño', () => {
    expect(MAX_DESCRIPCION).toBe(1500);
    expect(MAX_URL).toBe(8000);
  });
});
