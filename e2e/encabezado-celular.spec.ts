// Issue 268: on phones the header hid the whole brand. Up to 900 px the header has two groups that wrap by
// themselves: group 1 (brand with icon and wordmark, language selector, theme button) and group 2
// ("Estructuras" with its label, search, cortes, share). If both fit they share one line; otherwise group 2
// drops whole to a second line. Group 1 never splits: its wordmark shrinks first. These tests measure the
// real boxes at 100 % and 125 % text over a sweep of widths.
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
  palabra: { w: number; h: number; escalaX: number; escalaY: number } | null;
}

/** Visible header items (the two groups are looked through; not the spacer nor the screen-reader-only spans). */
const medir = (page: Page): Promise<Medida> =>
  page.evaluate(() => {
    const caja = (b: DOMRect) => ({ x: b.x, y: b.y, w: b.width, h: b.height, derecha: b.right, abajo: b.bottom, centroY: b.y + b.height / 2 });
    const enc = document.querySelector<HTMLElement>('.encabezado')!;
    const elementos = [...enc.children].flatMap((c) => (c.classList.contains('encabezado-fila') ? [...c.children] : [c]));
    const hijos = elementos
      .filter((c) => !c.classList.contains('espacio') && !c.classList.contains('solo-lector') && getComputedStyle(c).display !== 'none')
      .map((c) => ({ clase: c.className, caja: caja(c.getBoundingClientRect()) }));
    const tam = (sel: string) => {
      const e = document.querySelector(sel);
      if (!e || getComputedStyle(e).display === 'none') return null;
      const b = e.getBoundingClientRect();
      return { w: b.width, h: b.height };
    };
    const palabra = tam('.encabezado .marca-palabra');
    const trazo = document.querySelector<SVGGraphicsElement>('.encabezado .marca-palabra path');
    const ctm = trazo?.getScreenCTM();
    return {
      hijos,
      encabezado: caja(enc.getBoundingClientRect()),
      anchoVentana: document.documentElement.clientWidth,
      scrollVentana: document.documentElement.scrollWidth,
      scrollEncabezado: enc.scrollWidth,
      clientEncabezado: enc.clientWidth,
      icono: tam('.encabezado .marca-icono'),
      palabra: palabra && ctm ? { ...palabra, escalaX: ctm.a, escalaY: ctm.d } : null,
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

/** Two rows: row 1 is brand, language, theme; row 2 is menu, search, cortes, share; row 2 is below row 1. */
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
  expect.soft(techo2 - fondo1, `${etiqueta}: row 2 starts at least 4 px below row 1`).toBeGreaterThanOrEqual(4);
  // Row 1: brand at the left, language and theme at the right edge; row 2: share at the right edge.
  expect.soft(hijo(m, 'marca', etiqueta).x, `${etiqueta}: the brand is the leftmost item`).toBeLessThanOrEqual(Math.min(...fila2.map((c) => c.x)) + 0.5);
  expect.soft(hijo(m, 'boton-tema', etiqueta).derecha, `${etiqueta}: the theme button is at the right`).toBeGreaterThan(m.anchoVentana - 16);
  expect.soft(hijo(m, 'compartir-encabezado', etiqueta).derecha, `${etiqueta}: share is at the right`).toBeGreaterThan(m.anchoVentana - 16);
  // The header is two rows, not three: it ends right under row 2.
  expect.soft(m.encabezado.abajo - Math.max(...fila2.map((c) => c.abajo)), `${etiqueta}: nothing sits under row 2`).toBeLessThan(16);
  comprobarSinDesborde(m, etiqueta);
}

/** One line: every visible item shares a vertical center, the brand is first and the rest is at the right. */
function comprobarUnaFila(m: Medida, etiqueta: string) {
  expect(m.hijos.length, `${etiqueta}: the header has exactly those seven visible children`).toBe(FILA_1.length + FILA_2.length);
  const centros = m.hijos.map((h) => h.caja.centroY);
  expect.soft(Math.max(...centros) - Math.min(...centros), `${etiqueta}: one line, shared vertical center`).toBeLessThanOrEqual(2);
  expect.soft(m.hijos[0]!.clase.split(' ')[0], `${etiqueta}: the brand comes first`).toBe('marca');
  expect.soft(hijo(m, 'compartir-encabezado', etiqueta).derecha, `${etiqueta}: share is at the right edge`).toBeGreaterThan(m.anchoVentana - 24);
  expect.soft(hijo(m, 'selector-idioma', etiqueta).x, `${etiqueta}: the language selector is right of the brand`).toBeGreaterThan(hijo(m, 'marca', etiqueta).derecha);
  expect.soft(hijo(m, 'boton-tema', etiqueta).derecha, `${etiqueta}: the theme button is left of Estructuras`).toBeLessThan(hijo(m, 'boton-menu', etiqueta).x);
  // Group 2 sits together at the right: the spare room goes to group 1, not between cortes and share.
  expect.soft(hijo(m, 'compartir-encabezado', etiqueta).x - hijo(m, 'boton-cortes', etiqueta).derecha, `${etiqueta}: share is next to cortes`).toBeLessThanOrEqual(10);
  expect.soft(m.encabezado.abajo - Math.max(...m.hijos.map((h) => h.caja.abajo)), `${etiqueta}: nothing sits under the line`).toBeLessThan(16);
  comprobarSinDesborde(m, etiqueta);
}

/** The header is either one line with all items or exactly two lines with the approved split; nothing else. */
function comprobarEncabezado(m: Medida, etiqueta: string): 'una' | 'dos' {
  const centros = m.hijos.map((h) => h.caja.centroY);
  const unaLinea = Math.max(...centros) - Math.min(...centros) <= 2;
  if (unaLinea) comprobarUnaFila(m, etiqueta);
  else comprobarDosFilas(m, etiqueta);
  return unaLinea ? 'una' : 'dos';
}

async function preparar(page: Page, ruta: string, ancho: number, alto: number, esquema: 'light' | 'dark' = 'light', texto125 = false) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: esquema });
  // No model: the viewer shows its error and the header is all that is measured.
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
  // Large text: the root at 125 % (1 rem = 20 px).
  if (texto125) await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

const encabezado = (page: Page) => page.locator('.encabezado');
const marca = (page: Page) => encabezado(page).getByRole('link', { name: 'Maysa Brain', exact: true });

/** The brand link: icon and wordmark visible, and it points to the language home. */
async function comprobarMarca(page: Page, idioma: 'es' | 'en', etiqueta: string) {
  const enlace = marca(page);
  await expect(enlace, `${etiqueta}: brand link`).toBeVisible();
  expect(await enlace.getAttribute('href'), `${etiqueta}: brand href`).toMatch(new RegExp(`/${idioma}$`));
  await expect(enlace.locator('.marca-icono'), `${etiqueta}: icon`).toBeVisible();
  await expect(enlace.locator('.marca-palabra'), `${etiqueta}: wordmark`).toBeVisible();
}

// Width sweep at 100 % and 125 % text, es and en: one line with everything on it, or exactly two lines with
// the approved split (row 1: brand, language, theme; row 2: Estructuras, search, cortes, share).
const BARRIDO = [
  [320, 568],
  [360, 740],
  [390, 844],
  [480, 800],
  [600, 800],
  [700, 800],
  [760, 800],
  [844, 390],
  [900, 700],
] as const;

for (const [idioma, ruta, estructuras] of [
  ['es', '/es/hipocampo', 'Estructuras'],
  ['en', '/en', 'Structures'],
] as const) {
  for (const texto125 of [false, true]) {
    test(`${idioma}, text at ${texto125 ? 125 : 100} %: the header is one line or two lines, row 1 never splits and only the wordmark shrinks`, async ({ page }) => {
      await preparar(page, ruta, 390, 844, 'light', texto125);
      const medidas: Record<number, Medida> = {};
      const modos: Record<number, 'una' | 'dos'> = {};
      for (const [ancho, alto] of BARRIDO) {
        await page.setViewportSize({ width: ancho, height: alto });
        const etiqueta = `${idioma} ${ancho}x${alto} ${texto125 ? '125 %' : '100 %'}`;
        await comprobarMarca(page, idioma, etiqueta);
        await expect(encabezado(page).getByRole('button', { name: estructuras, exact: true }), `${etiqueta}: menu name`).toBeVisible();
        const m = await medir(page);
        modos[ancho] = comprobarEncabezado(m, etiqueta);
        // Group 1 never splits, whatever the mode.
        const fila1 = FILA_1.map((c) => hijo(m, c, etiqueta).centroY);
        expect.soft(Math.max(...fila1) - Math.min(...fila1), `${etiqueta}: row 1 never splits`).toBeLessThanOrEqual(2);
        // The menu keeps its text label (it is not collapsed to an icon).
        expect(await encabezado(page).locator('.boton-menu').innerText(), `${etiqueta}: menu label`).toBe(estructuras);
        expect(m.icono, `${etiqueta}: icon box`).not.toBeNull();
        expect(m.palabra, `${etiqueta}: wordmark box`).not.toBeNull();
        // The wordmark keeps its aspect ratio however far it shrinks.
        expect.soft(m.palabra!.escalaX, `${etiqueta}: wordmark scales evenly`).toBeCloseTo(m.palabra!.escalaY, 3);
        medidas[ancho] = m;
      }
      // Anchors, so the sweep cannot pass by always being in the same mode: phones are two lines at 320 to 480
      // px, and the widest viewport holds one line at 100 % text.
      for (const ancho of [320, 360, 390, 480]) expect(modos[ancho], `${ancho} px is two lines`).toBe('dos');
      if (!texto125) {
        for (const ancho of [900, 844]) expect(modos[ancho], `${ancho} px is one line`).toBe('una');
      }
      const ancho = medidas[390]!;
      const angosto = medidas[320]!;
      // Icon, language selector and theme button keep their size; only the wordmark gives way.
      expect(angosto.icono!.w, 'icon width does not change at 320').toBeCloseTo(ancho.icono!.w, 1);
      expect(angosto.icono!.h, 'icon height does not change at 320').toBeCloseTo(ancho.icono!.h, 1);
      expect(hijo(angosto, 'selector-idioma', '320').w, 'language selector width does not change').toBeCloseTo(hijo(ancho, 'selector-idioma', '390').w, 1);
      expect(hijo(angosto, 'boton-tema', '320').w, 'theme button width does not change').toBeCloseTo(hijo(ancho, 'boton-tema', '390').w, 1);
      expect(angosto.palabra!.w, 'the wordmark shrinks at 320').toBeLessThan(ancho.palabra!.w - 10);
      expect(angosto.palabra!.escalaY, 'the wordmark is still drawn, not collapsed').toBeGreaterThan(0.2);
      // The wordmark only shrinks when group 1 alone does not fit its line: it never gets narrower as the
      // viewport widens, and with text at 100 % it has its natural width from 360 px on.
      const anchosPalabra = [320, 360, 390, 480].map((w) => medidas[w]!.palabra!.w);
      for (let i = 1; i < anchosPalabra.length; i++) expect(anchosPalabra[i]!, `wordmark width at step ${i}`).toBeGreaterThanOrEqual(anchosPalabra[i - 1]! - 0.5);
      if (!texto125) expect(medidas[360]!.palabra!.w, 'the wordmark has its natural width at 360').toBeCloseTo(medidas[480]!.palabra!.w, 1);
    });
  }
}

test('the phone brand has the same size as on desktop', async ({ page }) => {
  await preparar(page, '/es/hipocampo', 390, 844);
  const telefono = await medir(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const escritorio = await medir(page);
  expect(telefono.icono!.h, 'icon height equals the desktop one').toBeCloseTo(escritorio.icono!.h, 1);
  expect(telefono.palabra!.h, 'wordmark height equals the desktop one').toBeCloseTo(escritorio.palabra!.h, 1);
  expect(telefono.palabra!.w, 'wordmark width equals the desktop one at 390').toBeCloseTo(escritorio.palabra!.w, 1);
});

test('phone tab order follows the visual order: brand, language, theme, Estructuras, search, cortes, share', async ({ page }) => {
  await preparar(page, '/es', 390, 844);
  // Cortes is disabled until the model loads; enable it so it takes part in the tab order.
  await page.evaluate(() => (window as unknown as { __atlas: { setState(p: object): void } }).__atlas.setState({ cargado: true }));
  await expect(encabezado(page).locator('.boton-cortes')).toBeEnabled();
  const orden = await page.evaluate(() => [...document.querySelectorAll('.encabezado a, .encabezado button')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.className || e.getAttribute('data-testid') || e.tagName));
  expect(orden, 'DOM order of the focusable header items').toEqual(['marca', 'cambiar-idioma', 'boton-tema', 'boton-menu', 'boton-buscar', 'boton-cortes', 'compartir-encabezado']);
  // The real Tab key, from a fresh page, visits them in that order.
  const visitados: string[] = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    visitados.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || (document.activeElement as HTMLElement | null)?.className.split(' ')[0] || ''));
  }
  expect(visitados, 'Tab order').toEqual(['marca', 'cambiar-idioma', 'boton-tema', 'boton-menu', 'boton-buscar', 'boton-cortes', 'compartir-encabezado']);
});

test('es: the brand link goes home and closes the card, and the theme colors the icon', async ({ page }) => {
  await preparar(page, '/es/hipocampo', 390, 844, 'light');
  await expect(page.getByTestId('ficha')).toBeVisible();
  const trazo = () => page.locator('.encabezado .marca-icono path').first().evaluate((e) => getComputedStyle(e).stroke);
  // The stroke is the resolved --logo-a of each theme.
  expect(await trazo(), 'light stroke').toBe('rgb(19, 114, 54)');
  await page.getByTestId('boton-tema').click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
  expect(await trazo(), 'dark stroke').toBe('rgb(33, 196, 93)');
  await marca(page).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('ficha')).toHaveCount(0);
});

test('desktop 1280x800: the header keeps one row with icon and wordmark', async ({ page }) => {
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
  // The two groups are `display: contents` here: language, theme and share sit at the right edge, not packed
  // against the brand.
  expect(hijo(m, 'compartir-encabezado', '1280x800').derecha, 'share is at the right edge').toBeGreaterThan(m.anchoVentana - 24);
  expect(hijo(m, 'selector-idioma', '1280x800').x, 'the language selector is in the right half').toBeGreaterThan(m.anchoVentana / 2);
  expect(hijo(m, 'boton-tema', '1280x800').x, 'the theme button is in the right half').toBeGreaterThan(m.anchoVentana / 2);
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

/** These cases need the model (the cortes button is disabled without it). */
async function conModelo(page: Page, ruta: string, ancho = 390, alto = 844) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // Without a GPU the frame watchdog would add its own notice to the drawers being measured.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

test('390x844 with the model: drawers, card sheet, dock and compass sit below the two-row header', async ({ page }) => {
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

test('320x568 with the model: the cortes sheet does not touch the dock and the dock stays inside the viewer', async ({ page }) => {
  test.setTimeout(300_000);
  await conModelo(page, '/es/talamo', 320, 568);
  await encabezado(page).getByRole('button', { name: 'Cortes', exact: true }).click();
  await expect(page.locator('#panel-cortes')).toBeVisible();
  const dock = (await page.locator('.dock').boundingBox())!;
  const cajon = (await page.locator('#panel-cortes').boundingBox())!;
  const centro = (await page.locator('.centro').boundingBox())!;
  expect(dock.y + dock.height, 'the dock ends above the cortes sheet').toBeLessThanOrEqual(cajon.y + 0.5);
  expect(dock.y + dock.height, 'the dock ends inside .centro').toBeLessThanOrEqual(centro.y + centro.height + 0.5);
});

test('with the model: the vagus tour panel with a card open stays right under the header, on one line or two', async ({ page }) => {
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
  // A fixed panel: its top is counted from the window, so it follows the real header height (the header
  // height is published by a ResizeObserver, hence the polling after each resize).
  for (const [ancho, alto, lineas] of [
    [390, 844, 'two lines'],
    [760, 800, 'one line'],
  ] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    await expect
      .poll(
        async () => {
          const cabecera = (await encabezado(page).boundingBox())!;
          const caja = (await panel.boundingBox())!;
          const distancia = caja.y - (cabecera.y + cabecera.height);
          return distancia >= 0.5 && distancia <= 8;
        },
        { message: `${ancho}x${alto} (${lineas}): the tour panel starts 0.5 to 8 px under the header`, timeout: 10_000 },
      )
      .toBe(true);
    const caja = (await panel.boundingBox())!;
    expect(caja.y + caja.height, `${ancho}x${alto}: the tour panel ends inside the viewport`).toBeLessThanOrEqual(alto);
  }
});
