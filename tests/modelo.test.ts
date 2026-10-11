import { describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, compararCajas, type Caja } from '../scripts/lib/modelo.ts';

const blender: Caja = [0.01, -0.02, 1.5, 0.03, 0.04, 1.6];

describe('invariante de posición (check:modelo)', () => {
  it('convierte Blender (Z arriba) a glTF (Y arriba)', () => {
    expect(cajaBlenderAGltf(blender)).toEqual([0.01, 1.5, -0.04, 0.03, 1.6, 0.02]);
  });

  it('acepta una pieza en su sitio', () => {
    const r = compararCajas({ a: blender }, { a: cajaBlenderAGltf(blender) });
    expect(r.errores).toEqual([]);
  });

  it('falla si una pieza se corre más de 0,1 mm', () => {
    const corrida = cajaBlenderAGltf(blender).map((v, i) => (i === 0 ? v + 0.0002 : v)) as Caja;
    const r = compararCajas({ a: blender }, { a: corrida });
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain('se corrió 0.200 mm');
  });

  it('tolera el error de cuantización por debajo de 0,1 mm', () => {
    const cuantizada = cajaBlenderAGltf(blender).map((v) => v + 0.00003) as Caja;
    expect(compararCajas({ a: blender }, { a: cuantizada }).errores).toEqual([]);
  });

  it('falla si falta o sobra una pieza', () => {
    const r = compararCajas({ a: blender }, { b: blender });
    expect(r.errores.some((e) => e.includes('Falta en el GLB: a'))).toBe(true);
    expect(r.errores.some((e) => e.includes('Sobra en el GLB'))).toBe(true);
  });
});
