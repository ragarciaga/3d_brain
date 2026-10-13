// Botones que se alternan de la ficha y del árbol: cuándo están activos, parciales o apagados.
import { describe, expect, it } from 'vitest';
import { accionAlPulsar, estadoAislar, estadoOcultar, estadoSeparar, propsPulsado } from '../src/lib/alternar';

const P = ['a', 'b'];
const aislado = (modo: 'solo' | 'contexto', piezas: string[]) => ({ modo, piezas: new Set(piezas) });

describe('estadoAislar', () => {
  it('sin aislamiento da false', () => expect(estadoAislar(null, 'solo', P)).toBe(false));
  it('otro modo da false', () => expect(estadoAislar(aislado('contexto', P), 'solo', P)).toBe(false));
  it('mismo modo y mismo conjunto da true', () => expect(estadoAislar(aislado('solo', ['b', 'a']), 'solo', P)).toBe(true));
  it('piezas duplicadas cuentan una sola vez', () => expect(estadoAislar(aislado('solo', P), 'solo', ['a', 'b', 'a'])).toBe(true));
  it('un superconjunto aislado da mixed', () => expect(estadoAislar(aislado('solo', ['a', 'b', 'c']), 'solo', P)).toBe('mixed'));
  it('un subconjunto aislado da mixed', () => expect(estadoAislar(aislado('solo', ['a']), 'solo', P)).toBe('mixed'));
  it('un cruce da mixed', () => expect(estadoAislar(aislado('solo', ['b', 'c']), 'solo', P)).toBe('mixed'));
  it('conjuntos disjuntos dan false', () => expect(estadoAislar(aislado('solo', ['c', 'd']), 'solo', P)).toBe(false));
  it('sin piezas da false, aunque haya aislamiento', () => expect(estadoAislar(aislado('solo', P), 'solo', [])).toBe(false));
});

describe('estadoSeparar', () => {
  const v = [0.1, 0, 0] as [number, number, number];
  it('ninguna separada da false', () => expect(estadoSeparar({}, new Set(), P)).toBe(false));
  it('una separada da mixed', () => expect(estadoSeparar({ a: v }, new Set(), P)).toBe('mixed'));
  it('las dos separadas dan true', () => expect(estadoSeparar({ a: v, b: v }, new Set(), P)).toBe(true));
  it('una pieza en devueltas no cuenta como separada', () => {
    expect(estadoSeparar({ a: v, b: v }, new Set(['b']), P)).toBe('mixed');
    expect(estadoSeparar({ a: v }, new Set(['a']), P)).toBe(false);
  });
  it('sin piezas da false', () => expect(estadoSeparar({ a: v }, new Set(), [])).toBe(false));
});

describe('estadoOcultar', () => {
  it('ninguna oculta da false', () => expect(estadoOcultar(new Set(['z']), P)).toBe(false));
  it('una oculta da mixed', () => expect(estadoOcultar(new Set(['a']), P)).toBe('mixed'));
  it('las dos ocultas dan true y el segundo toque las muestra', () => {
    expect(estadoOcultar(new Set(['a', 'b', 'z']), P)).toBe(true);
    expect(accionAlPulsar(estadoOcultar(new Set(['a', 'b']), P))).toBe('desactivar');
  });
  it('sin piezas da false', () => expect(estadoOcultar(new Set(['a']), [])).toBe(false));
});

describe('accionAlPulsar', () => {
  it('activo se desactiva', () => expect(accionAlPulsar(true)).toBe('desactivar'));
  it('apagado se activa', () => expect(accionAlPulsar(false)).toBe('activar'));
  it('parcial se completa (activa)', () => expect(accionAlPulsar('mixed')).toBe('activar'));
});

describe('propsPulsado', () => {
  it('true: aria-pressed true y clase activo', () => expect(propsPulsado(true)).toEqual({ 'aria-pressed': true, className: 'activo' }));
  it('mixed: aria-pressed mixed y clase parcial', () => expect(propsPulsado('mixed')).toEqual({ 'aria-pressed': 'mixed', className: 'parcial' }));
  it('false: sin clase', () => expect(propsPulsado(false)).toEqual({ 'aria-pressed': false, className: undefined }));
  it('conserva la clase base', () => expect(propsPulsado(true, 'arbol-aislar').className).toBe('arbol-aislar activo'));
});
