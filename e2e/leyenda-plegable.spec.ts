// Issue 261: la leyenda de origen (F25) es plegable. En celular (390 x 844) arranca plegada como un botón pequeño
// que no tapa el modelo ni los controles y que anuncia el hueco del tórax; en escritorio arranca desplegada. La
// elección de la persona dura la sesión. La primera prueba usa el modelo y el rutas-vago.json publicados (dos
// huecos); las otras no cargan el modelo (se aborta el GLB) y ponen el hueco con `setState`.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

interface VentanaLeyenda {
  __atlas: { getState(): { huecos: unknown[] }; setState(p: object): void };
}

const TEXTO_TORACICO = 'Hueco en el tórax: un tramo de cada vago está pendiente de trazado.';

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

/** Con el modelo cargado y el archivo publicado leído (dos huecos), como en vago-hueco.spec.ts. */
async function abrirConHuecos(page: Page, ruta: string) {
  await abrir(page, ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as VentanaLeyenda).__atlas.getState().huecos.length), { timeout: 30_000 })
    .toBe(2);
}

/** Sin modelo (el GLB se aborta) y con un hueco puesto a mano: la leyenda y los controles quedan montados. */
async function prepararSinModelo(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as VentanaLeyenda).__atlas.setState({ huecos: [{ lado: 'derecho', y_max: 1, y_min: 0 }] }),
  );
  await expect(page.getByTestId('leyenda-origen')).toBeVisible();
}

/**
 * Cambia el tamaño y espera a que el corte de celular ya haya cambiado y React haya pintado: sin esto, una
 * aserción que reintenta podría leer el estado de antes del cambio y dejar pasar un fallo.
 */
async function cambiarTamano(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction((movil) => window.matchMedia('(max-width: 900px)').matches === movil, width <= 900);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const boton = (page: Page) => page.getByTestId('leyenda-boton');
const desplegada = async (boton: Locator) => expect(boton).toHaveAttribute('aria-expanded', 'true');
const plegada = async (boton: Locator) => expect(boton).toHaveAttribute('aria-expanded', 'false');

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}
async function caja(l: Locator): Promise<Caja> {
  const b = await l.boundingBox();
  if (!b) throw new Error('el elemento no tiene caja');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}
const seCruzan = (a: Caja, b: Caja) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test.describe('celular (390 x 844) con el modelo publicado', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('arranca plegada, pequeña y sin tapar los controles; al tocar muestra el texto completo (D1, D2)', async ({ page }) => {
    await abrirConHuecos(page, '/es');
    const leyenda = page.getByTestId('leyenda-origen');
    await expect(leyenda).toBeVisible();
    await plegada(boton(page));
    await expect(page.getByTestId('leyenda-hueco-breve')).toHaveText('Hueco en el tórax');
    await expect(page.getByTestId('leyenda-toracico')).toBeHidden();

    const l = await caja(leyenda);
    const centro = await caja(page.locator('.centro'));
    expect(l.x).toBeGreaterThanOrEqual(centro.x);
    expect(l.y).toBeGreaterThanOrEqual(centro.y);
    expect(l.x + l.w).toBeLessThanOrEqual(centro.x + centro.w);
    expect(l.y + l.h).toBeLessThanOrEqual(centro.y + centro.h);
    expect(l.h).toBeLessThanOrEqual(48);
    expect((l.w * l.h) / (centro.w * centro.h)).toBeLessThanOrEqual(0.04);
    expect(seCruzan(l, await caja(page.locator('.dock')))).toBe(false);
    expect(seCruzan(l, await caja(page.locator('.brujula')))).toBe(false);

    await boton(page).click();
    await desplegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toHaveText(TEXTO_TORACICO);
    await expect(leyenda.locator('.muestra-escaneada')).toBeVisible();
    await expect(leyenda.locator('.muestra-marcador')).toBeVisible();

    await boton(page).click();
    await plegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeHidden();
  });
});

test.describe('escritorio (1280 x 800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('arranca desplegada; se pliega con el clic y se despliega con el teclado (D3)', async ({ page }) => {
    await prepararSinModelo(page, '/es');
    await desplegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeVisible();
    await expect(page.getByTestId('leyenda-hueco-breve')).toHaveCount(0);

    await boton(page).click();
    await plegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeHidden();
    await expect(page.getByTestId('leyenda-hueco-breve')).toBeVisible();

    await boton(page).focus();
    await page.keyboard.press('Enter');
    await desplegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeVisible();
  });
});

test.describe('la elección dura la sesión (D4)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sin tocar, al pasar a escritorio se despliega', async ({ page }) => {
    await prepararSinModelo(page, '/es');
    await plegada(boton(page));
    await cambiarTamano(page, 1280, 800);
    await desplegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeVisible();
  });

  test('si la persona la despliega en celular, cambiar de tamaño y volver la deja desplegada', async ({ page }) => {
    await prepararSinModelo(page, '/es');
    await plegada(boton(page));
    await boton(page).click();
    await desplegada(boton(page));

    await cambiarTamano(page, 1280, 800);
    await desplegada(boton(page));
    await cambiarTamano(page, 390, 844);
    await desplegada(boton(page));
    await expect(page.getByTestId('leyenda-toracico')).toBeVisible();
  });
});
