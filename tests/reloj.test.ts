// Pausa del reloj simulado para los E2E (e2e/reloj.ts): reintenta solo cuando la pausa cayó en el pasado.
import { describe, expect, it } from 'vitest';
import { INTENTOS_PAUSA, MARGEN_PAUSA_MS, pausarReloj, type PaginaConReloj } from '../e2e/reloj';

function pagina(horas: number[], fallas: (Error | null)[]) {
  const pausas: number[] = [];
  let lecturas = 0;
  const page: PaginaConReloj = {
    evaluate: () => Promise.resolve(horas[Math.min(lecturas++, horas.length - 1)]!),
    clock: {
      pauseAt: (hora: number) => {
        pausas.push(hora);
        const falla = fallas[pausas.length - 1] ?? null;
        return falla ? Promise.reject(falla) : Promise.resolve();
      },
    },
  };
  return { page, pausas, lecturas: () => lecturas };
}

const PASADO = () => new Error('clock.pauseAt: Error: Cannot fast-forward to the past');

describe('pausarReloj', () => {
  it('pausa una vez, un margen después de la hora de la página', async () => {
    const p = pagina([5_000], []);
    await pausarReloj(p.page);
    expect(p.pausas).toEqual([5_000 + MARGEN_PAUSA_MS]);
  });

  it('si la pausa cae en el pasado, vuelve a leer la hora y pausa sobre la nueva', async () => {
    const p = pagina([5_000, 7_500], [PASADO()]);
    await pausarReloj(p.page);
    expect(p.pausas).toEqual([5_000 + MARGEN_PAUSA_MS, 7_500 + MARGEN_PAUSA_MS]);
    expect(p.lecturas()).toBe(2);
  });

  it('otro error no se reintenta', async () => {
    const p = pagina([5_000], [new Error('page closed')]);
    await expect(pausarReloj(p.page)).rejects.toThrow('page closed');
    expect(p.pausas).toHaveLength(1);
  });

  it('se rinde después de los intentos máximos con el último error', async () => {
    const p = pagina([1, 2, 3, 4, 5, 6, 7], Array.from({ length: 10 }, PASADO));
    await expect(pausarReloj(p.page)).rejects.toThrow('Cannot fast-forward to the past');
    expect(p.pausas).toHaveLength(INTENTOS_PAUSA);
  });
});
