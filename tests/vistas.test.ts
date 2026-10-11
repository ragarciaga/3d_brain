// F1 y F5: orientación de las vistas contra el modelo real y reglas de toque por modo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, type Caja } from '../scripts/lib/modelo.ts';
import { DIRECCIONES, esSeleccionable } from '../src/lib/vistas';

const cajas = (JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, Caja> }).cajas;
const centro = (nombre: string) => {
  const c = cajaBlenderAGltf(cajas[nombre]!);
  return [(c[0] + c[3]) / 2, (c[1] + c[4]) / 2, (c[2] + c[5]) / 2] as const;
};
const punto = (a: readonly number[], d: readonly number[]) => a[0]! * d[0]! + a[1]! * d[1]! + a[2]! * d[2]!;

describe('vistas anatómicas (F1)', () => {
  it('lateral izquierda mira desde el lado de las piezas izquierdas; derecha, al revés', () => {
    const izq = centro('Hippocampus.l');
    const der = centro('Hippocampus.r');
    expect(punto(izq, DIRECCIONES['lateral-izq'])).toBeGreaterThan(punto(der, DIRECCIONES['lateral-izq']));
    expect(punto(der, DIRECCIONES['lateral-der'])).toBeGreaterThan(punto(izq, DIRECCIONES['lateral-der']));
  });

  it('anterior mira desde el lado del lóbulo frontal; posterior, desde el occipital', () => {
    const frontal = centro('Superior frontal gyrus.l');
    const occipital = centro('Lingual gyrus.l');
    expect(punto(frontal, DIRECCIONES.anterior)).toBeGreaterThan(punto(occipital, DIRECCIONES.anterior));
    expect(punto(occipital, DIRECCIONES.posterior)).toBeGreaterThan(punto(frontal, DIRECCIONES.posterior));
  });

  it('superior mira desde el lado del cerebro; inferior, desde el bulbo', () => {
    const arriba = centro('Superior frontal gyrus.l');
    const abajo = centro('Medulla oblongata.l');
    expect(punto(arriba, DIRECCIONES.superior)).toBeGreaterThan(punto(abajo, DIRECCIONES.superior));
    expect(punto(abajo, DIRECCIONES.inferior)).toBeGreaterThan(punto(arriba, DIRECCIONES.inferior));
  });
});

describe('qué piezas responden a toques (F5)', () => {
  const base = { visible: true, referencia: false, fantasma: false, shift: false };
  it('una pieza visible normal sí', () => expect(esSeleccionable(base)).toBe(true));
  it('una pieza oculta nunca, ni con Shift', () => expect(esSeleccionable({ ...base, visible: false, shift: true })).toBe(false));
  it('un órgano de referencia nunca', () => expect(esSeleccionable({ ...base, referencia: true, shift: true })).toBe(false));
  it('un fantasma de "aislar con contexto" no', () => expect(esSeleccionable({ ...base, fantasma: true })).toBe(false));
  it('un fantasma sí con Shift, para sumarlo al aislamiento', () => expect(esSeleccionable({ ...base, fantasma: true, shift: true })).toBe(true));
});
