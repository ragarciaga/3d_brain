import { describe, expect, it } from 'vitest';
import { acercar, desplazamientosExplosion, type Vec3 } from '../src/lib/explosion';

const centros: Record<string, Vec3> = { a: [1, 0, 0], b: [-1, 0, 0], c: [1, 1, 0] };

describe('fragmentar (F6)', () => {
  it('sin explosión no hay desplazamientos', () => {
    expect(desplazamientosExplosion(centros, ['a', 'b'], (p) => p, 0)).toEqual({});
  });

  it('cada pieza se aleja del centro del conjunto', () => {
    const d = desplazamientosExplosion(centros, ['a', 'b'], (p) => p, 1);
    expect(d.a![0]).toBeGreaterThan(0);
    expect(d.b![0]).toBeLessThan(0);
  });

  it('las piezas de un mismo bloque se mueven juntas', () => {
    const d = desplazamientosExplosion(centros, ['a', 'b', 'c'], (p) => (p === 'b' ? 'izq' : 'der'), 0.5);
    expect(d.a).toEqual(d.c);
  });

  it('reensamblar llega exactamente a cero, sin error acumulado (F7)', () => {
    let v: Vec3 = [0.12345, -0.5, 0.33];
    for (let i = 0; i < 200; i++) v = acercar(v, [0, 0, 0], 0.1);
    expect(v).toEqual([0, 0, 0]);
  });
});
