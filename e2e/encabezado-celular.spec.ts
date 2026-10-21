// Issue 268: on phones the header hid the whole brand. Layout B: two rows. Row 1 has the brand (icon and
// wordmark, same size as on desktop), the language selector and the theme button. Row 2 has "Estructuras"
// (with its label), search, cortes and share. These tests measure the real boxes at 390x844 and 360x740.
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

// The review-mode case must not reach the editor's Apps Script.
protegerCanalReal();

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
  derecha: number;
  abajo: number;
  centroY: number;
}
interface Hijo {
  clase: string;
  caja: Caja;
}
interface Medida {
  hijos: Hijo[];
  encabezado: Caja;
  anchoVentana: number;
  scrollVentana: number;
  scrollEncabezado: number;
  clientEncabezado: number;
  icono: { w: number; h: number } | null;
  palabra: { w: number; h: number } | null;
}

/** Visible header children (not the spacer nor the screen-reader-only spans) and the overflow numbers. */
const medir = (page: Page): Promise<Medida> =>
  page.evaluate(() => {
    const caja = (b: DOMRect) => ({ x: b.x, y: b.y, w: b.width, h: b.height, derecha: b.right, abajo: b.bottom, centroY: b.y + b.height / 2 });
    const enc = document.querySelector<HTMLElement>('.encabezado')!;
    const hijos = [...enc.children]
      .filter((c) => !c.classList.contains('espacio') && !c.classList.contains('solo-lector') && getComputedStyle(c).display !== 'none')
      .map((c) => ({ clase: c.className, caja: caja(c.getBoundingClientRect()) }));
    const tam = (sel: string) => {
      const e = document.querySelector(sel);
      if (!e || getComputedStyle(e).display === 'none') return null;
      const b = e.getBoundingClientRect();
      return { w: b.width, h: b.height };
    };
    return {
      hijos,
      encabezado: caja(enc.getBoundingClientRect()),
      anchoVentana: document.documentElement.clientWidth,
      scrollVentana: document.documentElement.scrollWidth,
      scrollEncabezado: enc.scrollWidth,
      clientEncabezado: enc.clientWidth,
      icono: tam('.encabezado .marca-icono'),
      palabra: tam('.encabezado .marca-palabra'),
    };
  });

const FILA_1 = ['marca', 'selector-idioma', 'boton-tema'];
const FILA_2 = ['boton-menu', 'boton-buscar', 'boton-cortes', 'compartir-encabezado'];

function hijo(m: Medida, clase: string, etiqueta: string): Caja {
  const h = m.hijos.find((x) => x.clase.split(' ').includes(clase));
  expect(h, `${etiqueta}: ${clase} is visible in the header`).toBeDefined();
  return h!.caja;
}

/** Nothing leaves the viewport and the header does not scroll sideways. */
function comprobarSinDesborde(m: Medida, etiqueta: string) {
  for (const h of m.hijos) {
    expect.soft(h.caja.derecha, `${etiqueta}: ${h.clase} stays inside the viewport`).toBeLessThanOrEqual(m.anchoVentana + 0.5);
    expect.soft(h.caja.x, `${etiqueta}: ${h.clase} does not start left of the viewport`).toBeGreaterThanOrEqual(-0.5);
  }
  expect.soft(m.scrollVentana, `${etiqueta}: the page does not scroll sideways`).toBeLessThanOrEqual(m.anchoVentana);
  expect.soft(m.scrollEncabezado, `${etiqueta}: the header does not scroll sideways`).toBeLessThanOrEqual(m.clientEncabezado);
}

/** E1: row 1 is brand, language, theme; row 2 is menu, search, cortes, share; row 2 is below row 1. */
function comprobarDosFilas(m: Medida, etiqueta: string) {
  const fila1 = FILA_1.map((c) => hijo(m, c, etiqueta));
  const fila2 = FILA_2.map((c) => hijo(m, c, etiqueta));
  expect(m.hijos.length, `${etiqueta}: the header has exactly those seven visible children`).toBe(FILA_1.length + FILA_2.length);
  const centros1 = fila1.map((c) => c.centroY);
  const centros2 = fila2.map((c) => c.centroY);
  expect.soft(Math.max(...centros1) - Math.min(...centros1), `${etiqueta}: row 1 shares a vertical center`).toBeLessThanOrEqual(2);
  expect.soft(Math.max(...centros2) - Math.min(...centros2), `${etiqueta}: row 2 shares a vertical center`).toBeLessThanOrEqual(2);
  const fondo1 = Math.max(...fila1.map((c) => c.abajo));
  const techo2 = Math.min(...fila2.map((c) => c.y));
  expect.soft(techo2, `${etiqueta}: row 2 starts below the bottom of row 1`).toBeGreaterThanOrEqual(fondo1 - 0.5);
  // Row 1: brand at the left, language and theme at the right edge; row 2: share at the right edge.
  expect.soft(hijo(m, 'marca', etiqueta).x, `${etiqueta}: the brand is the leftmost item`).toBeLessThanOrEqual(Math.min(...fila2.map((c) => c.x)) + 0.5);
  expect.soft(hijo(m, 'boton-tema', etiqueta).derecha, `${etiqueta}: the theme button is at the right`).toBeGreaterThan(m.anchoVentana - 16);
  expect.soft(hijo(m, 'compartir-encabezado', etiqueta).derecha, `${etiqueta}: share is at the right`).toBeGreaterThan(m.anchoVentana - 16);
  // The header is two rows, not three: it ends right under row 2.
  expect.soft(m.encabezado.abajo - Math.max(...fila2.map((c) => c.abajo)), `${etiqueta}: nothing sits under row 2`).toBeLessThan(16);
  comprobarSinDesborde(m, etiqueta);
}

async function preparar(page: Page, ruta: string, ancho: number, alto: number, esquema: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: esquema });
  // No model: the viewer shows its error and the header is all that is measured.
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const encabezado = (page: Page) => page.locator('.encabezado');
const marca = (page: Page) => encabezado(page).getByRole('link', { name: 'Maysa Brain', exact: true });

/** The brand link: icon and wordmark visible, points to the language home, and is the width of its contents. */
async function comprobarMarca(page: Page, idioma: 'es' | 'en', etiqueta: string) {
  const enlace = marca(page);
  await expect(enlace, `${etiqueta}: brand link`).toBeVisible();
  expect(await enlace.getAttribute('href'), `${etiqueta}: brand href`).toMatch(new RegExp(`/${idioma}$`));
  await expect(enlace.locator('.marca-icono'), `${etiqueta}: icon`).toBeVisible();
  await expect(enlace.locator('.marca-palabra'), `${etiqueta}: wordmark`).toBeVisible();
}

for (const [idioma, ruta, estructuras] of [
  ['es', '/es/hipocampo', 'Estructuras'],
  ['en', '/en', 'Structures'],
] as const) {
  test(`${idioma}: phone header has two rows from 360 to 900, with the brand at desktop size`, async ({ page }) => {
    await preparar(page, ruta, 390, 844);
    let tamanos: { icono: { w: number; h: number }; palabra: { w: number; h: number } } | null = null;
    for (const [ancho, alto] of [
      [390, 844],
      [360, 740],
      // Wide phones and small tablets: the line break, not a lack of room, keeps the two rows.
      [600, 800],
      [900, 700],
    ] as const) {
      await page.setViewportSize({ width: ancho, height: alto });
      const etiqueta = `${idioma} ${ancho}x${alto}`;
      await comprobarMarca(page, idioma, etiqueta);
      await expect(encabezado(page).getByRole('button', { name: estructuras, exact: true }), `${etiqueta}: menu name`).toBeVisible();
      const m = await medir(page);
      comprobarDosFilas(m, etiqueta);
      // The menu keeps its text label (it is not collapsed to an icon).
      expect(await encabezado(page).locator('.boton-menu').innerText(), `${etiqueta}: menu label`).toBe(estructuras);
      expect(m.icono, `${etiqueta}: icon box`).not.toBeNull();
      expect(m.palabra, `${etiqueta}: wordmark box`).not.toBeNull();
      tamanos = { icono: m.icono!, palabra: m.palabra! };
    }
    // The wordmark and icon have the same size as on desktop.
    await page.setViewportSize({ width: 1280, height: 800 });
    const escritorio = await medir(page);
    expect(tamanos!.icono.h, 'icon height equals the desktop one').toBeCloseTo(escritorio.icono!.h, 1);
    expect(tamanos!.palabra.h, 'wordmark height equals the desktop one').toBeCloseTo(escritorio.palabra!.h, 1);
  });
}

test('es: the brand link goes home and closes the card, and the theme colors the icon', async ({ page }) => {
  await preparar(page, '/es/hipocampo', 390, 844, 'light');
  await expect(page.getByTestId('ficha')).toBeVisible();
  const trazo = () => page.locator('.encabezado .marca-icono path').first().evaluate((e) => getComputedStyle(e).stroke);
  // E5: the stroke is the resolved --logo-a of each theme.
  expect(await trazo(), 'light stroke').toBe('rgb(19, 114, 54)');
  await page.getByTestId('boton-tema').click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  expect(await trazo(), 'dark stroke').toBe('rgb(33, 196, 93)');
  await marca(page).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('ficha')).toHaveCount(0);
});

test('escritorio 1280x800: the header keeps one row with icon and wordmark', async ({ page }) => {
  await preparar(page, '/es', 1280, 800);
  await comprobarMarca(page, 'es', '1280x800');
  const m = await medir(page);
  await expect(encabezado(page).locator('.boton-menu')).toBeHidden();
  await expect(encabezado(page).locator('.boton-buscar')).toBeHidden();
  expect(m.hijos.map((h) => h.clase.split(' ')[0]), 'desktop children, in order').toEqual(['marca', 'selector-idioma', 'boton-tema', 'compartir-encabezado']);
  const centros = m.hijos.map((h) => h.caja.centroY);
  expect(Math.max(...centros) - Math.min(...centros), 'one row: shared vertical center').toBeLessThanOrEqual(2);
  expect(hijo(m, 'marca', '1280x800').w, 'icon and wordmark both take width').toBeGreaterThan(100);
  expect(m.icono!.w).toBeGreaterThan(0);
  expect(m.palabra!.w).toBeGreaterThan(0);
  expect(m.encabezado.h, 'one-row header height').toBeLessThan(64);
  comprobarSinDesborde(m, '1280x800');
});

test('review mode 390x844: two rows, no exit button in the header, review bar below the header', async ({ page }) => {
  await preparar(page, '/es/revision?r=LOGO01', 390, 844);
  const guia = page.getByTestId('como-revisar');
  if (await guia.isVisible()) await guia.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('panel-revision')).toBeVisible();
  await expect(guia).toHaveCount(0);
  await comprobarMarca(page, 'es', 'review 390x844');
  const m = await medir(page);
  comprobarDosFilas(m, 'review 390x844');
  await expect(encabezado(page).getByRole('button', { name: 'Salir del modo revisión' })).toHaveCount(0);
  const barra = (await page.getByTestId('panel-revision').boundingBox())!;
  expect(barra.y, 'the review bar starts at or below the header bottom').toBeGreaterThanOrEqual(m.encabezado.abajo - 0.5);
});

/** E4 needs the model (the cortes button is disabled without it). */
async function conModelo(page: Page, ruta: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // Without a GPU the frame watchdog would add its own notice to the drawers being measured.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

test('390x844 with the model: drawers, card sheet, tour, dock and compass sit below the two-row header', async ({ page }) => {
  test.setTimeout(300_000);
  await conModelo(page, '/es/talamo');
  const bajoElEncabezado = async (selector: string, etiqueta: string) => {
    const abajoEncabezado = (await encabezado(page).boundingBox())!;
    const b = (await page.locator(selector).first().boundingBox())!;
    expect(b, `${etiqueta}: has a box`).not.toBeNull();
    const fondoEncabezado = abajoEncabezado.y + abajoEncabezado.height;
    expect(b.y, `${etiqueta}: top edge is at or below the header bottom`).toBeGreaterThanOrEqual(fondoEncabezado - 0.5);
    expect(b.y + b.height, `${etiqueta}: bottom edge is inside the viewport`).toBeLessThanOrEqual(844 + 0.5);
    expect(b.x, `${etiqueta}: left edge is inside the viewport`).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width, `${etiqueta}: right edge is inside the viewport`).toBeLessThanOrEqual(390 + 0.5);
  };
  comprobarDosFilas(await medir(page), 'with model');

  // Card bottom sheet (the structure from the URL).
  await expect(page.getByTestId('ficha')).toBeVisible();
  await bajoElEncabezado('[data-testid="ficha"]', 'card sheet');
  await bajoElEncabezado('.dock', 'dock');
  await bajoElEncabezado('.brujula', 'compass');

  // Structures drawer.
  await encabezado(page).getByRole('button', { name: 'Estructuras', exact: true }).click();
  await expect(page.locator('#panel-izq')).toBeVisible();
  await bajoElEncabezado('#panel-izq', 'structures drawer');

  // Cortes drawer (it excludes the structures one).
  await encabezado(page).getByRole('button', { name: 'Cortes', exact: true }).click();
  await expect(page.locator('#panel-cortes')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#panel-cortes')).toBeVisible();
  await bajoElEncabezado('#panel-cortes', 'cortes drawer');
  await encabezado(page).getByRole('button', { name: 'Cortes', exact: true }).click();
  await expect(page.locator('#panel-cortes')).toHaveAttribute('inert', '');
});

test('390x844 with the model: the vagus tour panel with a card open stays below the header', async ({ page }) => {
  test.setTimeout(300_000);
  await conModelo(page, '/es/nervio-vago-x');
  await page.getByTestId('iniciar-recorrido').click();
  const panel = page.getByTestId('recorrido');
  await expect(panel).toContainText('Parada 1 de 4');
  for (const n of [2, 3, 4]) {
    await page.getByTestId('recorrido-siguiente').click();
    await expect(panel).toContainText(`Parada ${n} de 4`);
  }
  await panel.getByText(/Ramos y estructuras de esta parada/).click();
  await panel.getByRole('button', { name: 'Tronco vagal anterior', exact: true }).click();
  await expect(page.locator('#ficha-titulo')).toHaveText('Tronco vagal anterior');
  // A fixed panel: its top is counted from the window, so it must clear both header rows.
  const cabecera = (await encabezado(page).boundingBox())!;
  const caja = (await panel.boundingBox())!;
  expect(caja.y, 'the tour panel clears the header').toBeGreaterThanOrEqual(cabecera.y + cabecera.height + 0.5);
  expect(caja.y + caja.height, 'the tour panel ends inside the viewport').toBeLessThanOrEqual(844);
});
