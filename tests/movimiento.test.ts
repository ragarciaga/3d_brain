// "Reducir movimiento" se consulta una vez y se actualiza con el evento change, no por pieza y cuadro.
import { describe, expect, it } from 'vitest';
import { crearLectorMovimiento } from '../src/lib/movimiento';

function consultaFalsa(matches: boolean) {
  let oyente: ((e: { matches: boolean }) => void) | null = null;
  const mq = {
    matches,
    addEventListener: (_: 'change', f: (e: { matches: boolean }) => void) => {
      oyente = f;
    },
  };
  let llamadas = 0;
  return {
    mq,
    matchMedia: (consulta: string) => {
      llamadas += 1;
      expect(consulta).toBe('(prefers-reduced-motion: reduce)');
      return mq;
    },
    llamadas: () => llamadas,
    cambiar: (v: boolean) => oyente?.({ matches: v }),
  };
}

describe('crearLectorMovimiento', () => {
  it('llama a matchMedia una sola vez aunque se lea miles de veces', () => {
    const f = consultaFalsa(true);
    const leer = crearLectorMovimiento(f.matchMedia);
    for (let i = 0; i < 5000; i++) leer();
    expect(f.llamadas()).toBe(1);
    expect(leer()).toBe(true);
  });

  it('usa el valor guardado hasta que llega el evento change', () => {
    const f = consultaFalsa(false);
    const leer = crearLectorMovimiento(f.matchMedia);
    f.mq.matches = true; // sin evento, la lectura no debe consultar de nuevo
    expect(leer()).toBe(false);
    f.cambiar(true);
    expect(leer()).toBe(true);
    f.cambiar(false);
    expect(leer()).toBe(false);
  });

  it('sin matchMedia (fuera del navegador) no reduce el movimiento', () => {
    expect(crearLectorMovimiento(undefined)()).toBe(false);
  });
});
