import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_PANELES, guardarPaneles, leerPaneles } from '../src/lib/paneles';

function almacen(inicial: string | null, bloqueado = false) {
  const datos = new Map<string, string>(inicial === null ? [] : [[CLAVE_PANELES, inicial]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (bloqueado) throw new Error('bloqueado');
      return datos.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (bloqueado) throw new Error('bloqueado');
      datos.set(k, v);
    },
  });
  return datos;
}

describe('paneles plegables', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('por defecto los dos paneles están visibles', () => {
    almacen(null);
    expect(leerPaneles()).toEqual({ izq: true, der: true });
  });

  it('guarda y lee la preferencia', () => {
    almacen(null);
    guardarPaneles({ izq: false, der: true });
    expect(leerPaneles()).toEqual({ izq: false, der: true });
  });

  it('un valor dañado o el almacenamiento bloqueado dejan los dos visibles', () => {
    almacen('{no es json');
    expect(leerPaneles()).toEqual({ izq: true, der: true });
    almacen(null, true);
    expect(leerPaneles()).toEqual({ izq: true, der: true });
    expect(() => guardarPaneles({ izq: false, der: false })).not.toThrow();
  });
});
