// Modo reto: cuándo una pieza arrastrada encaja, medido en pantalla.
import { describe, expect, it } from 'vitest';
import { encaja, radioEnPantalla, toleranciaPx } from '../src/lib/armado';

describe('toleranciaPx', () => {
  it('un radio pequeño da el mínimo (24 px)', () => expect(toleranciaPx(10)).toBe(24));
  it('en el rango es la mitad del radio', () => expect(toleranciaPx(100)).toBe(50));
  it('un radio enorme da el tope (80 px)', () => expect(toleranciaPx(1000)).toBe(80));
  it('una entrada no finita da el mínimo', () => {
    expect(toleranciaPx(NaN)).toBe(24);
    expect(toleranciaPx(Infinity)).toBe(24);
  });
});

describe('encaja', () => {
  const casa = { x: 100, y: 100 };
  const a = (d: number) => ({ x: 100 + d, y: 100 });
  it('radio 100 (tolerancia 50): 0 y 50 encajan, 50,01 no', () => {
    expect(encaja(a(0), casa, 100)).toBe(true);
    expect(encaja(a(50), casa, 100)).toBe(true);
    expect(encaja(a(50.01), casa, 100)).toBe(false);
  });
  it('radio 10 (tolerancia 24): 20 encaja, 30 no', () => {
    expect(encaja(a(20), casa, 10)).toBe(true);
    expect(encaja(a(30), casa, 10)).toBe(false);
  });
  it('radio 1000 (tolerancia 80): 79 encaja, 81 no', () => {
    expect(encaja(a(79), casa, 1000)).toBe(true);
    expect(encaja(a(81), casa, 1000)).toBe(false);
  });
  it('la distancia es euclidiana en los dos ejes', () => {
    expect(encaja({ x: 130, y: 140 }, casa, 100)).toBe(true); // 50 exactos
    expect(encaja({ x: 131, y: 140 }, casa, 100)).toBe(false);
  });
  it('coordenadas no finitas nunca encajan', () => {
    expect(encaja({ x: NaN, y: 100 }, casa, 100)).toBe(false);
    expect(encaja(casa, { x: 100, y: Infinity }, 100)).toBe(false);
  });
});

describe('radioEnPantalla', () => {
  it('es el radio sobre la altura visible a esa distancia, por la mitad del alto en px', () => {
    const esperado = (0.01 / (0.5 * Math.tan((20 * Math.PI) / 180))) * 300;
    expect(Math.abs(radioEnPantalla(0.01, 0.5, 40, 600) - esperado)).toBeLessThan(1e-9);
  });
  it('con distancia cero o negativa da 0', () => {
    expect(radioEnPantalla(0.01, 0, 40, 600)).toBe(0);
    expect(radioEnPantalla(0.01, -1, 40, 600)).toBe(0);
  });
});
