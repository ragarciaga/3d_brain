import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

// La brújula marca la vista en la que está la cámara y la desmarca cuando la persona la mueve a mano (#213).

interface VentanaBrujula {
  __atlas: { getState(): { pedirCamara(p: { encuadrar: string[] }): void } };
  __camara: {
    leer: (() => number[]) | null;
    desfase: (() => number) | null;
    pedidosAplicados: number;
  };
}

const VISTAS = ['superior', 'lateral-der', 'anterior', 'lateral-izq', 'inferior', 'posterior'] as const;
type NombreVista = (typeof VISTAS)[number];

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaBrujula).__camara.leer?.() ?? []);
const desfaseCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaBrujula).__camara.desfase?.() ?? Infinity);
const pedidosAplicados = (page: Page) => page.evaluate(() => (window as unknown as VentanaBrujula).__camara.pedidosAplicados);
/** El visor aplica el pedido de cámara en el siguiente render: antes de eso la cámara aún no recibió el destino. */
const hastaPedidoAplicado = (page: Page, antes: number) => expect.poll(() => pedidosAplicados(page)).toBeGreaterThan(antes);

/** Espera a que la cámara real llegue a su destino y deje de moverse. */
async function camaraQuieta(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await leerCamara(page);
        await page.waitForTimeout(400);
        const b = await leerCamara(page);
        if (a.length !== 6 || b.length !== 6) return Infinity;
        return Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(1e-4);
  await expect.poll(() => desfaseCamara(page)).toBeLessThan(1e-4);
}

const boton = (page: Page, v: NombreVista) => page.locator(`[data-vista="${v}"]`);
const marcados = (page: Page) => page.locator('.brujula').locator('[aria-pressed="true"]');
const fondo = (page: Page, v: NombreVista) => boton(page, v).evaluate((e) => getComputedStyle(e).backgroundColor);

/** Pulsa una vista y espera a que la cámara llegue: desde ahí cualquier cambio de marca es obra de la persona. */
async function irA(page: Page, v: NombreVista) {
  const antes = await pedidosAplicados(page);
  await boton(page, v).click();
  await hastaPedidoAplicado(page, antes);
  await camaraQuieta(page);
}

async function centroDelLienzo(page: Page) {
  const caja = await page.getByTestId('visor').locator('canvas').boundingBox();
  if (!caja) throw new Error('sin lienzo');
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

/** Arrastra 120 px con el botón dado, en 10 pasos, desde el centro del lienzo. */
async function arrastrar(page: Page, boton: 'left' | 'right') {
  const c = await centroDelLienzo(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down({ button: boton });
  await page.mouse.move(c.x + 120, c.y, { steps: 10 });
  await page.mouse.up({ button: boton });
}

async function ningunaMarcada(page: Page, desmarcada: NombreVista) {
  await expect(boton(page, desmarcada)).toHaveAttribute('aria-pressed', 'false');
  await expect(marcados(page)).toHaveCount(0);
  const otra = VISTAS.find((v) => v !== desmarcada)!;
  await expect.poll(async () => (await fondo(page, desmarcada)) === (await fondo(page, otra))).toBe(true);
}

test.describe('Vista activa de la brújula (#213)', () => {
  test('B1: la vista pulsada queda marcada y girar a mano la desmarca', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await irA(page, 'superior');
    for (const v of VISTAS) await expect(boton(page, v)).toHaveAttribute('aria-pressed', v === 'superior' ? 'true' : 'false');
    await expect.poll(async () => (await fondo(page, 'superior')) !== (await fondo(page, 'posterior'))).toBe(true);

    await arrastrar(page, 'left');
    await ningunaMarcada(page, 'superior');
  });

  test('B2: desplazar con el botón derecho desmarca la vista', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await irA(page, 'anterior');
    await expect(boton(page, 'anterior')).toHaveAttribute('aria-pressed', 'true');

    await arrastrar(page, 'right');
    await ningunaMarcada(page, 'anterior');
  });

  test('B3: acercar con la rueda desmarca la vista', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await irA(page, 'lateral-izq');
    await expect(boton(page, 'lateral-izq')).toHaveAttribute('aria-pressed', 'true');

    const c = await centroDelLienzo(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, -300);
    await ningunaMarcada(page, 'lateral-izq');
  });

  test('B4: volver a pulsar una vista la marca otra vez, y solo a ella', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await irA(page, 'superior');
    await arrastrar(page, 'left');
    await ningunaMarcada(page, 'superior');

    for (const v of VISTAS) {
      await boton(page, v).click();
      for (const w of VISTAS) await expect(boton(page, w)).toHaveAttribute('aria-pressed', w === v ? 'true' : 'false');
      await expect(marcados(page)).toHaveCount(1);
    }
  });

  test('B5: encuadrar y tocar sin arrastrar no desmarcan la vista', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await irA(page, 'anterior');
    await expect(boton(page, 'anterior')).toHaveAttribute('aria-pressed', 'true');

    const antes = await pedidosAplicados(page);
    await page.evaluate(() => (window as unknown as VentanaBrujula).__atlas.getState().pedirCamara({ encuadrar: ['stomach'] }));
    await hastaPedidoAplicado(page, antes);
    await camaraQuieta(page);
    await expect(boton(page, 'anterior')).toHaveAttribute('aria-pressed', 'true');

    const c = await centroDelLienzo(page);
    await page.mouse.click(c.x, c.y);
    await camaraQuieta(page);
    await expect(boton(page, 'anterior')).toHaveAttribute('aria-pressed', 'true');
  });

  test('B6: abrir con ?vista= marca esa vista', async ({ page }) => {
    await abrir(page, '/es?vista=superior');
    await modeloCargado(page);
    for (const v of VISTAS) await expect(boton(page, v)).toHaveAttribute('aria-pressed', v === 'superior' ? 'true' : 'false');
  });

  test('B7: al abrir sin vista ninguna queda marcada', async ({ page }) => {
    await abrir(page, '/es');
    await modeloCargado(page);
    await expect(marcados(page)).toHaveCount(0);
  });
});
