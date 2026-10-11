// F1 y F5: orientación de las vistas contra el modelo real y reglas de toque por modo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, type Caja } from '../scripts/lib/modelo.ts';
import { DIRECCIONES, desfaseVerticalPx, esSeleccionable } from '../src/lib/vistas';

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
  it('al proponer una posición, un órgano de referencia sí recibe el toque', () =>
    expect(esSeleccionable({ ...base, referencia: true, ubicando: true })).toBe(true));
  it('al proponer una posición, una pieza oculta sigue sin recibirlo', () =>
    expect(esSeleccionable({ ...base, visible: false, referencia: true, ubicando: true })).toBe(false));
  it('sin proponer posición, el órgano de referencia sigue sin seleccionarse', () =>
    expect(esSeleccionable({ ...base, referencia: true, ubicando: false })).toBe(false));
});

describe('encuadre con la hoja de la ficha en celular', () => {
  it('sin hoja no hay desfase', () => expect(desfaseVerticalPx(0, 600)).toBe(0));
  it('el objetivo sube la mitad del alto de la hoja, para quedar centrado en lo que se ve', () => {
    expect(desfaseVerticalPx(404, 600)).toBe(202);
  });
  it('nunca pasa de la mitad del visor', () => expect(desfaseVerticalPx(900, 600)).toBe(300));
  it('un alto inválido no desplaza', () => {
    expect(desfaseVerticalPx(Number.NaN, 600)).toBe(0);
    expect(desfaseVerticalPx(100, 0)).toBe(0);
  });
});
