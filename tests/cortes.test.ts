import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { GRUPO_VAGO, piezasBajo } from '../src/data/atlas';
import {
  ajustarAlRango,
  cortesApagados,
  esEncefalo,
  etiquetaCorte,
  hayCortes,
  ocultoPorCortes,
  piezasCruzadas,
  piezasEncefalo,
  planoDe,
  rangoCerebro,
  vigilarCuadros,
  type Cortes,
  type Plano,
} from '../src/lib/cortes';
import type { Vec3 } from '../src/lib/explosion';
import type { Caja } from '../src/lib/inventario';

// Piezas reales del árbol; las cajas son sintéticas, en metros.
const encefalo = piezasBajo('g-brain');
const [A, B] = [encefalo[0]!, encefalo[1]!];
const vago = piezasBajo(GRUPO_VAGO)[0]!;
const organo = piezasBajo('g-organos-referencia')[0]!;

const cajas: Record<string, Caja> = {
  [A]: [[-0.07, 1.5, -0.09], [0.0, 1.56, 0.0]],
  [B]: [[0.0, 1.56, 0.0], [0.07, 1.62, 0.08]],
  [vago]: [[-0.2, 0.5, -0.3], [0.2, 1.6, 0.3]],
  [organo]: [[-0.1, 1.0, -0.1], [0.1, 1.2, 0.1]],
};
const rango = rangoCerebro(cajas, [A, B]);

const con = (parcial: Partial<Record<Plano, { mm: number; invertido?: boolean }>>): Cortes => {
  const c = cortesApagados();
  for (const [p, v] of Object.entries(parcial) as [Plano, { mm: number; invertido?: boolean }][]) {
    c[p] = { activo: true, mm: v.mm, invertido: v.invertido ?? false };
  }
  return c;
};
const centro = rango.centro;
const en = (dx: number, dy: number, dz: number): Vec3 => [centro[0] + dx, centro[1] + dy, centro[2] + dz];

describe('cortes: rango (R1.2)', () => {
  it('une las cajas del encéfalo y da mm enteros desde el centro', () => {
    expect(rango.centro[0]).toBeCloseTo(0, 9);
    expect(rango.centro[1]).toBeCloseTo(1.56, 9);
    expect(rango.centro[2]).toBeCloseTo(-0.005, 9);
    expect(rango.max).toEqual({ sagital: 70, axial: 60, coronal: 85 });
    expect(rango.min).toEqual({ sagital: -70, axial: -60, coronal: -85 });
  });
  it('ignora las cajas de piezas fuera de la lista (vago y órganos)', () => {
    expect(rangoCerebro({ [A]: cajas[A]!, [B]: cajas[B]! }, [A, B])).toEqual(rango);
    expect(rangoCerebro(cajas, [A, B, vago]).max.sagital).toBeGreaterThan(70);
  });
  it('sin piezas todo es 0', () => {
    const r = rangoCerebro(cajas, []);
    expect(r.centro).toEqual([0, 0, 0]);
    expect(r.max).toEqual({ sagital: 0, axial: 0, coronal: 0 });
    expect(r.min).toEqual({ sagital: 0, axial: 0, coronal: 0 });
  });
  it('0,1406 m de ancho da ±70 (piso)', () => {
    const r = rangoCerebro({ [A]: [[0, 0, 0], [0.1406, 0.1, 0.1]] }, [A]);
    expect(r.max.sagital).toBe(70);
    expect(r.min.sagital).toBe(-70);
  });
  it('ajustarAlRango redondea a 1 mm y ajusta al borde', () => {
    expect(ajustarAlRango('sagital', 12.4, rango)).toBe(12);
    expect(ajustarAlRango('sagital', 999, rango)).toBe(70);
    expect(ajustarAlRango('sagital', -999, rango)).toBe(-70);
    expect(Object.is(ajustarAlRango('sagital', -0.2, rango), 0)).toBe(true);
  });
});

describe('cortes: geometría (R1.6, R1.7)', () => {
  const casos: [Plano, 0 | 1 | 2, string][] = [
    ['sagital', 0, 'izquierdo'],
    ['coronal', 2, 'anterior'],
    ['axial', 1, 'superior'],
  ];
  it.each(casos)('%s: sin invertir se esconde el lado positivo (%s)', (plano, eje) => {
    const c = con({ [plano]: { mm: 0 } });
    const mas: Vec3 = en(0, 0, 0);
    mas[eje] += 0.01;
    const menos: Vec3 = en(0, 0, 0);
    menos[eje] -= 0.01;
    expect(ocultoPorCortes(mas, c, rango)).toBe(true);
    expect(ocultoPorCortes(menos, c, rango)).toBe(false);
  });
  it.each(casos)('%s invertido: niega la normal sin mover el plano', (plano, eje) => {
    const normal = planoDe(plano, { activo: true, mm: 10, invertido: false }, rango);
    const inv = planoDe(plano, { activo: true, mm: 10, invertido: true }, rango);
    expect(inv.normal[eje]).toBe(-normal.normal[eje]!);
    expect(inv.constante).toBeCloseTo(-normal.constante, 12);
    const mas: Vec3 = en(0, 0, 0);
    mas[eje] += 0.02;
    const menos: Vec3 = en(0, 0, 0);
    menos[eje] -= 0.02;
    const c = con({ [plano]: { mm: 10, invertido: true } });
    expect(ocultoPorCortes(mas, c, rango)).toBe(false);
    expect(ocultoPorCortes(menos, c, rango)).toBe(true);
  });
  it('coronal 12 mm y axial -8 mm', () => {
    const co = planoDe('coronal', { activo: true, mm: 12, invertido: false }, rango);
    expect(co.normal).toEqual([0, 0, -1]);
    expect(co.constante).toBeCloseTo(0.007, 9);
    const ax = planoDe('axial', { activo: true, mm: -8, invertido: false }, rango);
    expect(ax.normal).toEqual([0, -1, 0]);
    expect(ax.constante).toBeCloseTo(1.552, 9);
  });
});

describe('cortes: lado oculto (R1.4, R4.3)', () => {
  it('sin planos nada se oculta; un plano inactivo no cuenta', () => {
    expect(ocultoPorCortes(en(1, 1, 1), cortesApagados(), rango)).toBe(false);
    const c = cortesApagados();
    c.sagital = { activo: false, mm: -50, invertido: false };
    expect(ocultoPorCortes(en(0, 0, 0), c, rango)).toBe(false);
  });
  it('dos planos: oculto si cualquiera lo oculta', () => {
    const c = con({ sagital: { mm: 0 }, axial: { mm: 10 } });
    expect(ocultoPorCortes(en(-0.01, 0.005, 0), c, rango)).toBe(false);
    expect(ocultoPorCortes(en(0.01, 0.005, 0), c, rango)).toBe(true);
    expect(ocultoPorCortes(en(-0.01, 0.02, 0), c, rango)).toBe(true);
  });
  it('tres planos con uno invertido', () => {
    const c = con({ sagital: { mm: 0 }, axial: { mm: 0 }, coronal: { mm: 0, invertido: true } });
    expect(ocultoPorCortes(en(-0.01, -0.01, 0.01), c, rango)).toBe(false);
    expect(ocultoPorCortes(en(-0.01, -0.01, -0.01), c, rango)).toBe(true);
    expect(ocultoPorCortes(en(0.01, -0.01, 0.01), c, rango)).toBe(true);
    expect(ocultoPorCortes(en(-0.01, 0.01, 0.01), c, rango)).toBe(true);
  });
  it('el punto exacto sobre el plano es visible', () => {
    expect(ocultoPorCortes(en(0, 0, 0), con({ sagital: { mm: 0 } }), rango)).toBe(false);
  });
});

describe('cortes: etiqueta (R1.5)', () => {
  const crear = async (lng: 'es' | 'en') => {
    const i = i18next.createInstance();
    const recurso = JSON.parse(readFileSync(new URL(`../src/i18n/${lng}.json`, import.meta.url), 'utf8'));
    await i.init({ lng, resources: { [lng]: { translation: recurso } }, interpolation: { escapeValue: false } });
    return i.getFixedT(lng);
  };
  it('español', async () => {
    const t = await crear('es');
    expect(etiquetaCorte('coronal', 12, t)).toBe('12 mm anterior');
    expect(etiquetaCorte('coronal', -12, t)).toBe('12 mm posterior');
    expect(etiquetaCorte('axial', 8, t)).toBe('8 mm superior');
    expect(etiquetaCorte('axial', -8, t)).toBe('8 mm inferior');
    expect(etiquetaCorte('sagital', 12, t)).toBe('12 mm a la izquierda');
    expect(etiquetaCorte('sagital', -12, t)).toBe('12 mm a la derecha');
    expect(etiquetaCorte('sagital', 0, t)).toBe('en el centro');
    expect(etiquetaCorte('axial', -0.3, t)).toBe('en el centro');
  });
  it('inglés', async () => {
    const t = await crear('en');
    expect(etiquetaCorte('coronal', 12, t)).toBe('12 mm anterior');
    expect(etiquetaCorte('coronal', -12, t)).toBe('12 mm posterior');
    expect(etiquetaCorte('axial', 8, t)).toBe('8 mm superior');
    expect(etiquetaCorte('axial', -8, t)).toBe('8 mm inferior');
    expect(etiquetaCorte('sagital', 12, t)).toBe('12 mm to the left');
    expect(etiquetaCorte('sagital', -12, t)).toBe('12 mm to the right');
    expect(etiquetaCorte('sagital', 0, t)).toBe('at the center');
    expect(etiquetaCorte('coronal', -0.3, t)).toBe('at the center');
  });
});

describe('cortes: piezas del encéfalo (R2.1)', () => {
  it('esEncefalo distingue encéfalo, vago y órganos', () => {
    expect(esEncefalo(A)).toBe(true);
    expect(esEncefalo(vago)).toBe(false);
    expect(esEncefalo(organo)).toBe(false);
  });
  it('piezasEncefalo es disjunta del vago y de los órganos', () => {
    const fuera = new Set([...piezasBajo(GRUPO_VAGO), ...piezasBajo('g-organos-referencia')]);
    expect(piezasEncefalo.length).toBeGreaterThan(0);
    expect(piezasEncefalo.some((p) => fuera.has(p))).toBe(false);
  });
  it('piezasCruzadas nunca devuelve el vago ni los órganos', () => {
    const todas = [A, B, vago, organo];
    // el plano axial en -10 mm (y = 1,55) cruza la caja del vago (0,5 a 1,6) pero no se devuelve
    const c = con({ axial: { mm: -10 } });
    expect(c.axial.mm).toBe(-10);
    expect(piezasCruzadas(cajas, todas, c, rango)).toEqual([A]);
  });
  it('el cruce es estricto: un plano en la cara no cruza', () => {
    expect(piezasCruzadas(cajas, [A, B], con({ sagital: { mm: 0 } }), rango)).toEqual([]);
  });
  it('sagital -10 cruza la primera y no la segunda', () => {
    expect(piezasCruzadas(cajas, [A, B], con({ sagital: { mm: -10 } }), rango)).toEqual([A]);
  });
  it('sin planos, ninguna', () => {
    expect(piezasCruzadas(cajas, [A, B], cortesApagados(), rango)).toEqual([]);
  });
  it('una pieza sin caja no aparece', () => {
    const sin = { [B]: cajas[B]! };
    expect(piezasCruzadas(sin, [A, B], con({ sagital: { mm: 10 } }), rango)).toEqual([B]);
  });
});

describe('cortes: estado inicial', () => {
  it('cortesApagados y hayCortes', () => {
    const c = cortesApagados();
    expect(hayCortes(c)).toBe(false);
    expect(c.sagital).toEqual({ activo: false, mm: 0, invertido: false });
    expect(cortesApagados()).not.toBe(c);
    c.axial.activo = true;
    expect(hayCortes(c)).toBe(true);
    expect(hayCortes(cortesApagados())).toBe(false);
  });
});

describe('cortes: vigilante de cuadros (R8.2)', () => {
  it('true en la décima muestra baja seguida y luego siempre false', () => {
    const e = { bajas: 0, apagado: false };
    for (let i = 0; i < 9; i++) expect(vigilarCuadros(e, 20, true)).toBe(false);
    expect(vigilarCuadros(e, 20, true)).toBe(true);
    expect(vigilarCuadros(e, 20, true)).toBe(false);
    expect(vigilarCuadros(e, 20, true)).toBe(false);
  });
  it('30 fps no es baja y reinicia', () => {
    const e = { bajas: 0, apagado: false };
    for (let i = 0; i < 9; i++) vigilarCuadros(e, 20, true);
    expect(vigilarCuadros(e, 30, true)).toBe(false);
    expect(e.bajas).toBe(0);
    for (let i = 0; i < 9; i++) expect(vigilarCuadros(e, 20, true)).toBe(false);
    expect(vigilarCuadros(e, 20, true)).toBe(true);
  });
  it('sin cortes nunca true y reinicia', () => {
    const e = { bajas: 0, apagado: false };
    for (let i = 0; i < 20; i++) expect(vigilarCuadros(e, 5, false)).toBe(false);
    expect(e.bajas).toBe(0);
    for (let i = 0; i < 5; i++) vigilarCuadros(e, 5, true);
    vigilarCuadros(e, 5, false);
    expect(e.bajas).toBe(0);
  });
  it('NaN no cambia las bajas', () => {
    const e = { bajas: 3, apagado: false };
    expect(vigilarCuadros(e, Number.NaN, true)).toBe(false);
    expect(e.bajas).toBe(3);
  });
});
