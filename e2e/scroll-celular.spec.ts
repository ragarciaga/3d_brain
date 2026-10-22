// Issue 269: on phones the whole document scrolled, and dragging from the footer showed an empty dark area.
// Cause: the cortes drawer (.panel-cortes) is always mounted on phones, absolutely positioned inside .cuerpo and
// hidden with `transform: translateY(110%); visibility: hidden`. A transformed box still counts toward
// scrollable overflow even when hidden, so the root became scrollable. The fix clips .cuerpo on phones and turns
// off vertical overscroll on the atlas view. WebKit is not installed here, so these tests pin Chromium
// invariants: the document is never taller than the viewport, and wheel and touch gestures on the footer do not
// move it. Every assertion message lists the elements whose bottom edge is below the viewport.
import { expect, test, type Page } from '@playwright/test';

// The suite never reaches an external host: only localhost is allowed through.
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort('blockedbyclient'),
  );
});

interface Medida {
  scrollHeight: number;
  alto: number;
  scrollTop: number;
  culpables: string[];
}

/** Document size and scroll position, plus the elements whose bottom edge is below the viewport (fixed boxes are skipped). */
const medirDocumento = (page: Page): Promise<Medida> =>
  page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const raiz = document.scrollingElement!;
    const alto = window.innerHeight;
    const esFijo = (e: Element | null): boolean => {
      for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
      return false;
    };
    // Clipped: an ancestor cuts its overflow and ends inside the viewport, so the box cannot add scrollable area.
    const recortado = (e: Element): boolean => {
      for (let n = e.parentElement; n; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if (o !== 'visible' && n.getBoundingClientRect().bottom <= alto + 0.5) return true;
      }
      return false;
    };
    const nombre = (e: Element) => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/).join('.')}` : '');
    const fuera = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().bottom > alto + 0.5 && !esFijo(e) && !recortado(e));
    // Only the outermost boxes: their descendants are noise.
    const culpables = fuera.filter((e) => !fuera.includes(e.parentElement!)).map(nombre);
    return { scrollHeight: raiz.scrollHeight, alto, scrollTop: raiz.scrollTop, culpables };
  });

/** The document fits the viewport; the message names what sticks out below it. */
async function comprobarSinScroll(page: Page, etiqueta: string) {
  const m = await medirDocumento(page);
  expect(m.scrollHeight, `${etiqueta}: scrollHeight ${m.scrollHeight} vs innerHeight ${m.alto}; below the viewport: ${m.culpables.join(' | ') || 'none'}`).toBeLessThanOrEqual(m.alto);
}

/** Model loaded, as in encabezado-celular.spec.ts. */
async function conModelo(page: Page, ruta: string, ancho: number, alto: number) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // Without a GPU the frame watchdog would add its own notice to the drawers being measured.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

/** No model: the viewer shows its error. The cortes drawer is mounted on phones regardless. */
async function sinModelo(page: Page, ruta: string, ancho: number, alto: number) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
}

const encabezado = (page: Page) => page.locator('.encabezado');
const botonEstructuras = (page: Page) => encabezado(page).getByRole('button', { name: 'Estructuras', exact: true });
const botonCortes = (page: Page) => encabezado(page).getByRole('button', { name: 'Cortes', exact: true });

async function alternarCortes(page: Page, abrir: boolean) {
  await botonCortes(page).click();
  if (abrir) await expect(page.locator('#panel-cortes')).not.toHaveAttribute('inert', '');
  else await expect(page.locator('#panel-cortes')).toHaveAttribute('inert', '');
}

test('phone atlas view never grows taller than the viewport', async ({ page }) => {
  test.setTimeout(300_000);
  await conModelo(page, '/es/talamo', 390, 844);
  await expect(page.getByTestId('ficha')).toBeVisible();
  await comprobarSinScroll(page, '390x844 initial, card open');

  await botonEstructuras(page).click();
  await expect(page.locator('#panel-izq')).not.toHaveAttribute('inert', '');
  await comprobarSinScroll(page, '390x844 Estructuras drawer open');
  await botonEstructuras(page).click();
  await expect(page.locator('#panel-izq')).toHaveAttribute('inert', '');
  await comprobarSinScroll(page, '390x844 Estructuras drawer closed');

  await alternarCortes(page, true);
  await comprobarSinScroll(page, '390x844 cortes drawer open');
  await alternarCortes(page, false);
  await comprobarSinScroll(page, '390x844 cortes drawer closed');

  await page.locator('.ficha button.cerrar').click();
  await expect(page.getByTestId('ficha')).toHaveCount(0);
  await comprobarSinScroll(page, '390x844 card closed');

  // The card sheet covers the legend, so the legend is toggled once the card is closed.
  const leyenda = page.getByTestId('leyenda-boton');
  await leyenda.click();
  await comprobarSinScroll(page, '390x844 legend toggled once');
  await leyenda.click();
  await comprobarSinScroll(page, '390x844 legend toggled twice');

  await page.setViewportSize({ width: 360, height: 740 });
  await comprobarSinScroll(page, '360x740 card closed');
  await alternarCortes(page, true);
  await comprobarSinScroll(page, '360x740 cortes drawer open');
  await alternarCortes(page, false);
  await comprobarSinScroll(page, '360x740 cortes drawer closed');
});

test('wheel over the footer does not scroll the page', async ({ page }) => {
  test.setTimeout(300_000);
  await conModelo(page, '/es/talamo', 390, 844);
  // Measured before scrolling, while the boxes still sit where they started.
  const antes = await medirDocumento(page);
  await page.locator('.pie').hover();
  await page.mouse.wheel(0, 600);
  const despues = await medirDocumento(page);
  expect(despues.scrollTop, `scrollTop after the wheel over .pie; below the viewport at rest: ${antes.culpables.join(' | ') || 'none'}`).toBe(0);
  // Pure scroll extent: asking for the far end of the document must stay at the top.
  await page.evaluate(() => window.scrollTo(0, 9999));
  const extremo = await medirDocumento(page);
  expect(extremo.scrollTop, `scrollTop after scrollTo(0, 9999); below the viewport at rest: ${antes.culpables.join(' | ') || 'none'}`).toBe(0);
});

test.describe('touch device', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('touch drag on the footer does not scroll the page', async ({ page, context }) => {
    await sinModelo(page, '/es', 390, 844);
    const antes = await medirDocumento(page);
    const pie = (await page.locator('.pie').boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const x = pie.x + pie.width / 2;
    const y = pie.y + pie.height / 2;
    // A finger swipe up built from raw touch events (Input.synthesizeScrollGesture does not scroll in this Chromium).
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 30 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    const m = await medirDocumento(page);
    expect(m.scrollTop, `scrollTop after a touch drag on .pie; below the viewport at rest: ${antes.culpables.join(' | ') || 'none'}`).toBe(0);
  });
});

test('phone atlas view disables vertical overscroll, text pages keep it', async ({ page }) => {
  await sinModelo(page, '/es', 390, 844);
  const overscroll = () => page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY);
  expect(await overscroll(), 'atlas view').toBe('none');
  await page.goto('/es/licencia');
  await expect(page.locator('main.pagina-texto')).toBeVisible();
  expect(await overscroll(), 'license page').toBe('auto');
});

for (const ruta of ['/es/licencia', '/es/privacidad']) {
  test(`${ruta} scrolls to its last line on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ruta);
    await expect(page.locator('main.pagina-texto')).toBeVisible();
    const inicio = await medirDocumento(page);
    expect(inicio.scrollHeight, `${ruta}: the page is taller than the viewport`).toBeGreaterThan(inicio.alto);
    // Wheel down until the scroll position stops changing.
    await page.mouse.move(195, 400);
    let anterior = -1;
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 600);
      const { scrollTop } = await medirDocumento(page);
      if (scrollTop === anterior) break;
      anterior = scrollTop;
    }
    const ultimo = await page.evaluate(() => {
      const hijos = document.querySelector('main.pagina-texto')!.children;
      return hijos[hijos.length - 1]!.getBoundingClientRect().bottom;
    });
    const fin = await medirDocumento(page);
    expect(fin.scrollTop, `${ruta}: it scrolled`).toBeGreaterThan(0);
    expect(ultimo, `${ruta}: the last line ends inside the viewport`).toBeLessThanOrEqual(fin.alto + 0.5);
  });
}

test('desktop shell is unchanged', async ({ page }) => {
  await sinModelo(page, '/es', 1280, 800);
  const estilo = await page.evaluate(() => ({
    cuerpo: getComputedStyle(document.querySelector('.cuerpo')!).overflowY,
    overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
  }));
  expect(estilo.cuerpo, '.cuerpo overflow-y').toBe('visible');
  expect(estilo.overscroll, 'html overscroll-behavior-y').toBe('auto');
  await comprobarSinScroll(page, '1280x800');
});

test('touch still drives the model: the viewer keeps touch-action none', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto('/es');
  // The viewer wrapper exists while the model loads; the model itself is not needed.
  await expect(page.locator('.visor')).toBeAttached();
  const accion = await page.locator('.visor').evaluate((e) => getComputedStyle(e).touchAction);
  expect(accion).toBe('none');
});
