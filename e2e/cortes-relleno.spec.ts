import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type Estado = Record<string, (...a: unknown[]) => void> & {
  cajas: Record<string, [number[], number[]]>;
  seleccion: { entrada: string | null; pieza: string | null };
};
interface VentanaRelleno {
  __atlas: { getState(): Estado };
  __cortes: { planosDe(p: string): number; rellenos(p?: string): number };
  __puntoCorte(p: string, lado?: 'corte' | 'oculto'): { x: number; y: number } | null;
  __camara: { leer: (() => number[]) | null };
}

// Copias de los ayudantes de cortes-visor.spec.ts: este archivo no los comparte para que cada prueba sea independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaRelleno).__camara.leer?.() ?? []);
async function camaraQuieta(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await leerCamara(page);
        await page.waitForTimeout(400);
        const b = await leerCamara(page);
        return a.length !== 6 || b.length !== 6 ? Infinity : Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(1e-4);
}

const planosDe = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaRelleno).__cortes.planosDe(p), pieza);
const rellenos = (page: Page, pieza?: string) => page.evaluate((p) => (window as unknown as VentanaRelleno).__cortes.rellenos(p), pieza);
const puntoCorte = (page: Page, pieza: string, lado?: 'corte' | 'oculto') =>
  page.evaluate(([p, l]) => (window as unknown as VentanaRelleno).__puntoCorte(p as string, l as 'corte' | 'oculto' | undefined), [pieza, lado] as const);
const seleccion = (page: Page) => page.evaluate(() => (window as unknown as VentanaRelleno).__atlas.getState().seleccion);
/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaRelleno).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);

/** Mira la pieza de frente y devuelve el punto de pantalla de su cara del corte. */
async function apuntar(page: Page, pieza: string, lado?: 'corte' | 'oculto') {
  await accion(page, 'pedirCamara', { vista: lado === 'oculto' ? 'lateral-izq' : 'anterior', encuadrar: [pieza] });
  await camaraQuieta(page);
  let p: { x: number; y: number } | null = null;
  await expect.poll(async () => (p = await puntoCorte(page, pieza, lado)) !== null).toBe(true);
  return p!;
}

// Oráculos de solo lectura, independientes del código bajo prueba.
const leer = <T>(ruta: string) => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const nodos = leer<{ nodos: Record<string, { tipo: string; hijos?: string[]; malla?: string; estructura?: string }> }>('src/data/arbol.json').nodos;
const estructuras = leer<{ estructuras: Record<string, { nombre: { es: string } }> }>('src/data/estructuras.json').estructuras;
const ladoIzquierdo = leer<{ lado: { izquierdo: string } }>('src/i18n/es.json').lado.izquierdo;
const cerradas = new Set(leer<string[]>('src/config/mallas-cerradas.json'));
const piezasBajo = (id: string): string[] => (nodos[id]?.tipo === 'pieza' ? [id] : (nodos[id]?.hijos ?? []).flatMap(piezasBajo));
const nombreEs = (pieza: string) => `${estructuras[nodos[pieza]!.estructura!]!.nombre.es} (${ladoIzquierdo})`;

test('relleno del corte: cara sólida de las mallas cerradas, con nombre y ficha al tocarla, y nada sin cortes (R3.5, R4.1, R4.2, R8.3)', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');
  const cajas = await page.evaluate(() => (window as unknown as VentanaRelleno).__atlas.getState().cajas);
  const piezas = ['thalamus-l', 'caudate-nucleus-l', 'lateral-ventricle-l'];

  await test.step('(1) sin cortes no hay mallas de relleno (R8.3)', async () => {
    // Sin esta espera el 0 siguiente sería vacío: el vago siempre lleva su plano cuando el visor ya responde.
    await expect.poll(() => planosDe(page, 'vagus-nerve-x-r')).toBe(1);
    expect(await rellenos(page)).toBe(0);
  });

  const encefalo = piezasBajo('g-brain');
  const zs = encefalo.flatMap((p) => (cajas[p] ? [cajas[p]![0][2]!, cajas[p]![1][2]!] : []));
  const centroZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const zTalamo = (cajas['thalamus-l']![0][2]! + cajas['thalamus-l']![1][2]!) / 2;
  const mm = Math.round((zTalamo - centroZ) * 1000);
  const plano = centroZ + mm / 1000;
  const cruza = (p: string) => cajas[p]![0][2]! < plano && plano < cajas[p]![1][2]!;
  for (const p of piezas) expect(cruza(p), p).toBe(true);
  // Control: una pieza del encéfalo que el plano cruza pero cuya malla es abierta no se rellena.
  const abierta = encefalo.find((p) => cajas[p] && cruza(p) && nodos[p]!.malla && !cerradas.has(nodos[p]!.malla!))!;
  expect(abierta).toBeDefined();

  await test.step('(2) con un corte coronal en el tálamo hay relleno de las tres piezas y de ninguna malla abierta (R3.5)', async () => {
    await accion(page, 'setCorte', 'coronal', { activo: true, mm });
    await expect.poll(() => rellenos(page)).toBeGreaterThan(0);
    for (const p of piezas) await expect.poll(() => rellenos(page, p), p).toBeGreaterThan(0);
    expect(await rellenos(page, abierta)).toBe(0);
  });

  await test.step('(3) el cursor sobre la cara del corte muestra el nombre del caudado y del ventrículo lateral (R3.5, R4.1)', async () => {
    for (const p of ['caudate-nucleus-l', 'lateral-ventricle-l']) {
      const { x, y } = await apuntar(page, p);
      await page.mouse.move(x, y, { steps: 5 });
      await expect(page.locator('.etiqueta-3d'), p).toHaveText(nombreEs(p));
    }
  });

  await test.step('(4) tocar el lado oculto no selecciona nada (D4)', async () => {
    const { x, y } = await apuntar(page, 'thalamus-l', 'oculto');
    await page.mouse.click(x, y);
    await page.waitForTimeout(1000);
    const s = await seleccion(page);
    expect(s.entrada).toBeNull();
    expect(s.pieza).toBeNull();
    await expect(page.getByTestId('ficha')).toHaveCount(0);
  });

  await test.step('(5) la cara del corte del tálamo muestra su nombre y al tocarla abre su ficha (R4.1, R4.2)', async () => {
    const { x, y } = await apuntar(page, 'thalamus-l');
    await page.mouse.move(x, y, { steps: 5 });
    await expect(page.locator('.etiqueta-3d')).toHaveText('Tálamo (izquierdo)');
    await page.mouse.click(x, y);
    await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'thalamus');
    expect((await seleccion(page)).pieza).toBe('thalamus-l');
  });

  await test.step('(6) al quitar los cortes no queda ninguna malla de relleno (R8.3)', async () => {
    await accion(page, 'quitarCortes');
    await expect.poll(() => rellenos(page)).toBe(0);
  });
});
