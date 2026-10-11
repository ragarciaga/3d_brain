import { describe, expect, it } from 'vitest';
import { leer, serializar } from '../src/lib/enlaces';

describe('enlaces compartibles (F11)', () => {
  it('ida y vuelta del estado de la vista', () => {
    const e = { vista: 'lateral-izq' as const, aislar: 'contexto' as const, explosion: 40, nivel: 'lobulos' as const, ambos: true };
    expect(leer(serializar(e))).toEqual(e);
  });

  it('ignora valores inválidos', () => {
    expect(leer('?vista=arriba&aislar=x&explosion=abc&cam=1,2')).toEqual({});
  });

  it('conserva la cámara con precisión de 0,1 mm', () => {
    const cam = [0.1, 1.6, 0.4, 0, 1.55, 0];
    expect(leer(serializar({ camara: cam })).camara).toEqual(cam);
  });
});

describe('alias de URL por sinónimo (F11)', () => {
  it('/es/amigdala y /es/insula resuelven, como en el ejemplo del SPEC', async () => {
    const { entradaPorSlug } = await import('../src/data/atlas');
    expect(entradaPorSlug('amigdala', 'es')).toBe('amygdaloid-body');
    expect(entradaPorSlug('insula', 'es')).toBe('g-insula');
    expect(entradaPorSlug('amygdala', 'en')).toBe('amygdaloid-body');
  });
});
