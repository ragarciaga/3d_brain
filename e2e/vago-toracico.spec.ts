// Tramos torácicos trazados del vago (ADR 0010, spec 02 R4): se prueban contra el rutas-vago.json y el GLB
// publicados, sin mock. Lo que se dibuja se lee de la escena con `__rutasDibujadas`.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const TORACICAS = ['vago_toracico_derecho', 'vago_toracico_izquierdo'];

interface RutaDibujada {
  id: string;
  punteado: boolean;
  cortadaPorRecorrido: boolean;
  enPantalla: { x: number; y: number } | null;
}

interface RutaEstado {
  id: string;
  puntos: [number, number, number][];
  reemplaza?: unknown;
}

interface VentanaToracico {
  __atlas: { getState(): { rutas: RutaEstado[]; soloEscaneada: boolean; pedirCamara(p: { camara: number[] }): void } };
  __recorte: () => number | null;
  __rutasDibujadas: () => RutaDibujada[];
  __camara: { desfase: (() => number) | null; pedidosAplicados: number };
}

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const desfaseCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaToracico).__camara.desfase?.() ?? Infinity);
const pedidosAplicados = (page: Page) => page.evaluate(() => (window as unknown as VentanaToracico).__camara.pedidosAplicados);
const dibujadas = (page: Page) => page.evaluate(() => (window as unknown as VentanaToracico).__rutasDibujadas());
const rutasEnEstado = (page: Page) => page.evaluate(() => (window as unknown as VentanaToracico).__atlas.getState().rutas);

/** Las rutas torácicas dibujadas, por id. */
const toracicasDibujadas = async (page: Page) => (await dibujadas(page)).filter((r) => TORACICAS.includes(r.id));

/** Abre la página con el modelo cargado y las cinco rutas publicadas leídas; comprueba cuáles son las torácicas. */
async function abrirConRutas(page: Page, ruta: string) {
  await abrir(page, ruta);
  await modeloCargado(page);
  await expect.poll(async () => (await rutasEnEstado(page)).length, { timeout: 30_000 }).toBe(5);
  const conReemplaza = (await rutasEnEstado(page)).filter((r) => r.reemplaza !== undefined).map((r) => r.id);
  expect(conReemplaza.sort()).toEqual([...TORACICAS].sort());
}

test('tramos torácicos: punteados y cortados por el recorrido, y el filtro de solo escaneada los esconde (R4.1, R4.2)', async ({ page }) => {
  await abrirConRutas(page, '/es');
  await expect.poll(async () => (await toracicasDibujadas(page)).length, { timeout: 30_000 }).toBe(2);
  for (const r of await toracicasDibujadas(page)) {
    expect(r.punteado, r.id).toBe(true);
    expect(r.cortadaPorRecorrido, r.id).toBe(true);
  }
  const leyenda = page.getByTestId('leyenda-origen');
  await expect(page.getByTestId('leyenda-toracico')).toHaveText('El tramo torácico del vago es trazado; con el filtro de solo escaneada no se muestra.');

  await leyenda.getByRole('checkbox').check();
  await expect.poll(async () => (await toracicasDibujadas(page)).length).toBe(0);
  expect(await page.evaluate(() => (window as unknown as VentanaToracico).__atlas.getState().soloEscaneada)).toBe(true);
  await expect(page.getByTestId('leyenda-toracico')).toHaveText('El tramo torácico del vago es trazado; con el filtro de solo escaneada no se muestra.');

  await leyenda.getByRole('checkbox').uncheck();
  await expect.poll(async () => (await toracicasDibujadas(page)).length).toBe(2);
  for (const r of await toracicasDibujadas(page)) expect(r.punteado, r.id).toBe(true);
});

test('recorrido parada por parada: el plano descubre los tramos torácicos y la nota del izquierdo es la nueva (R4.3, D2)', async ({ page }) => {
  await abrirConRutas(page, '/es/nervio-vago-x');
  await page.getByTestId('iniciar-recorrido').click();
  const panel = page.getByTestId('recorrido');
  const altura = () => page.evaluate(() => (window as unknown as VentanaToracico).__recorte());
  const esperarEstable = async () => {
    let anterior = Number.NaN;
    await expect
      .poll(
        async () => {
          const a = await altura();
          const quieto = a !== null && Math.abs(a - anterior) < 1e-4;
          anterior = a ?? Number.NaN;
          return quieto;
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    return anterior;
  };
  const rutas = (await rutasEnEstado(page)).filter((r) => TORACICAS.includes(r.id));
  expect(rutas).toHaveLength(2);
  const conteos: Record<string, number[]> = Object.fromEntries(TORACICAS.map((id) => [id, []]));
  let nivelPrevio = Number.POSITIVE_INFINITY;
  for (const n of [1, 2, 3, 4]) {
    if (n > 1) await page.getByTestId('recorrido-siguiente').click();
    await expect(panel).toContainText(`Parada ${n} de 4`);
    if (n > 1) {
      // A 2 cuadros/s dos lecturas seguidas pueden coincidir antes de que el plano empiece a bajar.
      await expect.poll(async () => (await altura()) ?? Infinity, { timeout: 30_000 }).toBeLessThan(nivelPrevio - 0.005);
    }
    nivelPrevio = await esperarEstable();
    for (const r of rutas) conteos[r.id]!.push(r.puntos.filter((p) => p[1] >= nivelPrevio).length);
    const vistas = await toracicasDibujadas(page);
    expect(vistas.map((v) => v.id).sort(), `parada ${n}`).toEqual([...TORACICAS].sort());
    for (const v of vistas) expect(v.cortadaPorRecorrido, `${v.id} parada ${n}`).toBe(true);
    if (n === 4) {
      await expect(panel).toContainText('el izquierdo sigue por un tramo trazado (aproximado) hasta el tronco vagal anterior');
      await expect(panel).not.toContainText('termina en el tórax');
    }
  }
  for (const r of rutas) {
    const c = conteos[r.id]!;
    expect(c[0], `${r.id} parada 1`).toBe(0);
    expect(c[3], `${r.id} parada 4`).toBe(r.puntos.length);
    for (let i = 1; i < c.length; i++) expect(c[i]!, `${r.id} parada ${i + 1}`).toBeGreaterThanOrEqual(c[i - 1]!);
  }
});

test('tocar un tramo torácico abre la ficha del vago con su estado de revisión (R4.4)', async ({ page }) => {
  const archivo = JSON.parse(readFileSync('public/modelos/rutas-vago.json', 'utf8')) as { anterior_z: number };
  expect(Math.abs(archivo.anterior_z)).toBe(1);
  await abrirConRutas(page, '/es');
  const rutas = (await rutasEnEstado(page)).filter((r) => TORACICAS.includes(r.id));
  expect(rutas).toHaveLength(2);
  const ficha = page.getByTestId('ficha');
  for (const id of TORACICAS) {
    await expect(ficha).toHaveCount(0);
    const puntos = rutas.find((r) => r.id === id)!.puntos;
    const centro = [0, 1, 2].map((i) => puntos.reduce((s, p) => s + p[i]!, 0) / puntos.length);
    const pedidosAntes = await pedidosAplicados(page);
    await page.evaluate(
      (c) => (window as unknown as VentanaToracico).__atlas.getState().pedirCamara({ camara: c }),
      [centro[0]!, centro[1]!, centro[2]! + 0.3 * archivo.anterior_z, ...centro],
    );
    await expect.poll(() => pedidosAplicados(page)).toBeGreaterThan(pedidosAntes);
    await expect.poll(() => desfaseCamara(page)).toBeLessThan(1e-4);
    // Dos lecturas separadas 300 ms que coincidan: si el lienzo cambia de tamaño, la primera cae en otro punto.
    let punto: { x: number; y: number } | null = null;
    await expect
      .poll(async () => {
        const leer = async () => (await dibujadas(page)).find((r) => r.id === id)?.enPantalla ?? null;
        const a = await leer();
        await page.waitForTimeout(300);
        const b = await leer();
        punto = b;
        return a !== null && b !== null && Math.hypot(a.x - b.x, a.y - b.y) < 0.5;
      })
      .toBe(true);
    const { x, y } = punto!;
    // Nada tapa el punto (la leyenda, un panel): lo que recibe el clic es el lienzo del visor.
    const objetivo = await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName ?? null, [x, y]);
    expect(objetivo, id).toBe('CANVAS');
    await page.mouse.click(x, y);
    await expect(ficha).toHaveAttribute('data-entrada', 'vagus-nerve-x');
    await expect(page).toHaveURL(/\/es\/nervio-vago-x$/);
    await expect(page.locator('#ficha-titulo')).toHaveText('Nervio vago (X)');
    await expect(page.getByTestId('aviso-aproximada')).toBeVisible();
    await expect(page.getByTestId(`ruta-trazado_${id}`)).toContainText('Pendiente de revisión docente');
    await ficha.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(ficha).toHaveCount(0);
  }
});
