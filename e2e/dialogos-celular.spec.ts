// B274: on small phones every control of the review dialogs and of the report dialog must be reachable by touch.
// "Reachable" means: after the browser's own scroll-into-view (which only moves scrollable ancestors, so a dialog that
// is taller than the screen and does not scroll fails), the control lies fully inside the viewport and is the topmost
// element at its centre. The authorization dialog is also driven with real touch taps. Only invented review codes are
// used; the real channel is blocked (`protegerCanalReal`) and the channel under test is a `.invalid` host.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { claveGuiaVista } from '../src/lib/huella';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const URL_CANAL = 'https://canal-prueba.invalid/macros/s/e2e/exec';
const CONTROLES = 'button, a[href], input, select, textarea, summary';

/** Phone viewports named by the issue. The 125% text variants are not covered here. */
const TAMANOS = [
  { w: 320, h: 568 },
  { w: 844, h: 390 },
] as const;

/** A minimal channel: reads answer with no authorization on file, `autorizar` succeeds. */
async function canalMinimo(page: Page) {
  await page.route(
    (u) => u.hostname === 'canal-prueba.invalid',
    async (route) => {
      const cuerpo = JSON.parse(route.request().postData() ?? '{}') as { accion?: string; r?: string };
      const cabeceras = { 'access-control-allow-origin': '*' };
      const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: cabeceras, body: JSON.stringify(b) });
      if (cuerpo.accion === 'leer') return json({ ok: true, respuestas: { v: 2, r: cuerpo.r, e: {} }, autorizacion: null });
      if (cuerpo.accion === 'autorizar') return json({ ok: true });
      return route.abort('failed');
    },
  );
}

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // None of these checks needs the 3D model.
  await context.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  await canalMinimo(page);
});

const barra = (page: Page) => page.getByTestId('panel-revision');

/** Fully inside the viewport and topmost at its centre. Returns a description of the failure, or null. */
async function problemaDeAlcance(page: Page, control: Locator): Promise<string | null> {
  await control.scrollIntoViewIfNeeded();
  const caja = await control.boundingBox();
  if (!caja) return 'no box';
  const vp = page.viewportSize()!;
  const dentro = caja.x >= 0 && caja.y >= 0 && caja.x + caja.width <= vp.width && caja.y + caja.height <= vp.height;
  if (!dentro) return `outside the viewport (${Math.round(caja.y)} to ${Math.round(caja.y + caja.height)} of ${vp.height})`;
  // An inline link can wrap over several lines: its bounding box centre may fall between them, so probe a real line box.
  const tapa = await control.evaluate((el) => {
    const r = el.getClientRects()[0]!;
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return encima !== null && (encima === el || el.contains(encima) || !!encima.closest('label')?.contains(el));
  });
  return tapa ? null : 'covered by another element';
}

/** Every visible control of a dialog must be reachable. Collects all failures so the report names them. */
async function todosAlcanzables(page: Page, dialogo: Locator) {
  await expect(dialogo).toBeVisible();
  const controles = dialogo.locator(CONTROLES).locator('visible=true');
  const n = await controles.count();
  expect(n).toBeGreaterThan(0);
  const fallos: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = controles.nth(i);
    const nombre = ((await c.textContent()) ?? (await c.getAttribute('aria-label')) ?? '').trim().slice(0, 40) || (await c.getAttribute('type')) || 'control';
    const problema = await problemaDeAlcance(page, c);
    if (problema) fallos.push(`${nombre}: ${problema}`);
  }
  expect(fallos, 'unreachable controls').toEqual([]);
}

/** A real touch tap at the centre of a control that has been scrolled into view and found reachable. */
async function tocar(page: Page, control: Locator) {
  expect(await problemaDeAlcance(page, control)).toBeNull();
  const caja = (await control.boundingBox())!;
  await page.touchscreen.tap(caja.x + caja.width / 2, caja.y + caja.height / 2);
}

/** Enters review mode on the hippocampus card with the guide already seen (channel optional). */
async function entrarEnFicha(page: Page, codigo: string, conCanal = true) {
  await page.context().addInitScript(
    ([claveGuia, cod, url]) => {
      localStorage.setItem(claveGuia!, '1');
      localStorage.setItem('atlas:revisor', cod!);
      (window as unknown as { __urlCanalInicial?: string }).__urlCanalInicial = url!;
    },
    [claveGuiaVista(codigo), codigo, conCanal ? URL_CANAL : ''],
  );
  await page.goto('/es/hipocampo');
  await expect(barra(page)).toContainText(codigo);
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'hippocampus');
}

/** Marks the first answer, which opens the authorization dialog. */
async function abrirAutorizacion(page: Page) {
  const correcto = page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Correcto' });
  await correcto.scrollIntoViewIfNeeded();
  await correcto.click();
  await expect(page.getByTestId('dialogo-autorizacion')).toBeVisible();
}

for (const { w, h } of TAMANOS) {
  test.describe(`authorization dialog (${w} x ${h})`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });

    test('checkboxes and "Continuar" can be scrolled into view and tapped', async ({ page }) => {
      await entrarEnFicha(page, `CEL${w}A`);
      await abrirAutorizacion(page);
      const dialogo = page.getByTestId('dialogo-autorizacion');
      const acepto = dialogo.getByRole('checkbox', { name: 'Autorizo el tratamiento de estos datos (Ley 1581 de 2012)' });
      const vago = dialogo.getByRole('checkbox', { name: 'También puedo revisar el recorrido del nervio vago en cuello y tórax' });
      const continuar = dialogo.getByRole('button', { name: 'Continuar' });

      await tocar(page, acepto);
      await expect(acepto).toBeChecked();
      await tocar(page, vago);
      await expect(vago).toBeChecked();
      await expect(continuar).toBeEnabled();
      await tocar(page, continuar);
      await expect(dialogo).toHaveCount(0);
    });

    test('"Cerrar" is reachable and closes it by touch', async ({ page }) => {
      await entrarEnFicha(page, `CEL${w}B`);
      await abrirAutorizacion(page);
      const dialogo = page.getByTestId('dialogo-autorizacion');
      await todosAlcanzables(page, dialogo);
      await tocar(page, dialogo.getByRole('button', { name: 'Cerrar' }));
      await expect(dialogo).toHaveCount(0);
    });
  });
}

test.describe('other dialogs (320 x 568)', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

  /** On a phone the bar actions live in the "Acciones" menu. */
  async function accion(page: Page, nombre: string | RegExp) {
    await barra(page).getByRole('button', { name: 'Acciones', exact: true }).click();
    await page.getByTestId('acciones-revision').getByRole('button', { name: nombre }).click();
  }

  test('guide "Cómo revisar"', async ({ page }) => {
    await page.goto('/es/revision?r=CELGUIA01');
    await expect(barra(page)).toContainText('CELGUIA01');
    await todosAlcanzables(page, page.getByTestId('como-revisar'));
  });

  test('"Qué revisar"', async ({ page }) => {
    await entrarEnFicha(page, 'CELQUE01');
    await accion(page, /Qué revisar/);
    await todosAlcanzables(page, page.getByTestId('que-revisar'));
  });

  test('send dialog', async ({ page }) => {
    // Without a channel the send dialog is the plain "Enviar revisión" one.
    await entrarEnFicha(page, 'CELENV01', false);
    await accion(page, 'Enviar revisión');
    await todosAlcanzables(page, page.getByRole('dialog', { name: 'Enviar revisión' }));
  });

  test('exit confirmation', async ({ page }) => {
    await entrarEnFicha(page, 'CELSAL01');
    await accion(page, 'Salir del modo revisión');
    await todosAlcanzables(page, page.getByRole('alertdialog', { name: '¿Salir del modo revisión?' }));
  });

  test('report dialog', async ({ page }) => {
    await page.goto('/es/hipocampo');
    await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'hippocampus');
    const reportar = page.getByTestId('ficha-pie').getByRole('button', { name: 'Reportar un error', exact: true });
    await reportar.scrollIntoViewIfNeeded();
    await reportar.click();
    await todosAlcanzables(page, page.getByTestId('dialogo-reporte'));
  });
});
