// Canal de retorno de la revisión docente (spec 03): enlace con código, modo revisión y avisos.
// Las tareas T6 a T10 de ese spec amplían este archivo. Helpers propios para no depender de otros specs.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const barra = (page: Page) => page.getByTestId('panel-revision');

async function prepararContexto(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
}

/** Código de revisor en el store (window.__atlas solo existe en desarrollo, que es como corre el e2e). */
const revisorDelStore = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState: () => { revisor: string | null } } }).__atlas.getState().revisor);

const guardado = (page: Page) => page.evaluate(() => localStorage.getItem('atlas:revisor'));

/** Deja pasar un frame y una macrotarea, para que los efectos de React ya hayan corrido antes de una aserción negativa. */
const asentar = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(() => r(), 0))));

const SCRIPT = encodeURIComponent('<script>');

test.beforeEach(async ({ context }) => {
  await prepararContexto(context);
});

for (const lang of ['es', 'en'] as const) {
  test(`enlace válido activa el modo revisión sin pedir código (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/revision?r=D03-ok`);
    await expect(barra(page)).toBeVisible();
    await expect(barra(page)).toContainText('D03-ok');
    await expect(page.getByRole('textbox', { name: /código|code/i })).toHaveCount(0);
    expect(await guardado(page)).toBe('D03-ok');
  });

  test(`enlace inválido muestra el aviso y no activa el modo (${lang})`, async ({ page }) => {
    const texto = lang === 'es' ? 'Este enlace no es válido; pide uno nuevo al editor' : 'This link is not valid; ask the editor for a new one';
    await page.goto(`/${lang}/revision?r=${SCRIPT}`);
    await expect(page.getByTestId('enlace-invalido')).toContainText(texto);
    await asentar(page);
    await expect(barra(page)).toHaveCount(0);
    expect(await revisorDelStore(page)).toBeNull();
    expect(await guardado(page)).toBeNull();
  });
}

test('enlace inválido con un código ya recordado no lo activa ni lo cambia', async ({ page }) => {
  await page.goto('/es/revision?r=D03-ok');
  await expect(barra(page)).toContainText('D03-ok');
  expect(await guardado(page)).toBe('D03-ok');

  await page.goto(`/es/revision?r=${SCRIPT}`);
  await expect(page.getByTestId('enlace-invalido')).toBeVisible();
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
  expect(await guardado(page)).toBe('D03-ok');
});

test('enlace con ?r= vacío muestra el aviso y no cae en el código recordado', async ({ page }) => {
  await page.goto('/es/revision?r=D03-ok');
  await expect(barra(page)).toContainText('D03-ok');
  expect(await guardado(page)).toBe('D03-ok');

  await page.goto('/es/revision?r=');
  await expect(page.getByTestId('enlace-invalido')).toContainText('Este enlace no es válido; pide uno nuevo al editor');
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
  expect(await guardado(page)).toBe('D03-ok');
});

test('enlace: un código inválido ya guardado no activa el modo', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('atlas:revisor', '<script>'));
  await page.goto('/es');
  await expect(page.locator('.encabezado')).toBeVisible();
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
});
