// Pausa del reloj simulado de Playwright un segundo después de la hora de la página. Leer `Date.now()` y pedir
// `pauseAt` son dos idas al navegador: si el runner tarda más de ese segundo entre las dos, `pauseAt` cae en el
// pasado y Playwright lanza "Cannot fast-forward to the past" (pasó en CI en el PR #182). Se vuelve a leer la
// hora y se reintenta. No importa Playwright: recibe lo mínimo de `page` para probarla con Vitest
// (tests/reloj.test.ts).

/** Lo que usa de `page`: leer la hora de la página y pausar su reloj. */
export interface PaginaConReloj {
  evaluate(fn: () => number): Promise<number>;
  clock: { pauseAt(hora: number): Promise<void> };
}

/** Margen entre la hora leída y la pausa. */
export const MARGEN_PAUSA_MS = 1000;
/** Intentos antes de rendirse. */
export const INTENTOS_PAUSA = 5;

const EN_EL_PASADO = 'Cannot fast-forward to the past';

/** Pausa el reloj de la página `MARGEN_PAUSA_MS` después de su hora actual; reintenta si la pausa cae en el pasado. */
export async function pausarReloj(page: PaginaConReloj): Promise<void> {
  for (let intento = 1; ; intento++) {
    const ahora = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(ahora + MARGEN_PAUSA_MS);
      return;
    } catch (e) {
      if (intento >= INTENTOS_PAUSA || !String(e).includes(EN_EL_PASADO)) throw e;
    }
  }
}
