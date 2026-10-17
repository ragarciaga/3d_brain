// Modo revisión: código recordado y almacenamiento persistente (#60). Helpers propios para no depender de
// atlas.spec.ts.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { claveRevisionIdb } from '../src/lib/huella';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const barra = (page: Page) => page.getByTestId('panel-revision');

/** Abre la ficha del hipocampo con la búsqueda (solo la ruta /revision activa el modo revisión). */
async function irAlHipocampo(page: Page) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
}

/** Respuestas guardadas en IndexedDB para un código de revisor. */
const guardadas = (page: Page, codigo: string) =>
  page.evaluate(
    (c) =>
      new Promise<Record<string, { propuesta?: string }> | null>((resolver) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => resolver(null);
        abrirDb.onsuccess = () => {
          const db = abrirDb.result;
          if (!db.objectStoreNames.contains('keyval')) return resolver(null);
          const pedido = db.transaction('keyval').objectStore('keyval').get(c);
          pedido.onsuccess = () => resolver(pedido.result?.respuestas ?? null);
          pedido.onerror = () => resolver(null);
        };
      }),
    claveRevisionIdb(codigo),
  );

const persistencias = (page: Page) => page.evaluate(() => (window as unknown as { __persistencia: number }).__persistencia);

/** Dobles con la forma de StorageManager (Promise<boolean>), para que el resultado no dependa de Chromium. */
async function prepararContexto(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('atlas:aviso-visto', '1');
    (window as unknown as { __persistencia: number }).__persistencia = 0;
    Object.defineProperty(navigator.storage, 'persisted', { configurable: true, value: () => Promise.resolve(false) });
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: () => {
        (window as unknown as { __persistencia: number }).__persistencia++;
        return Promise.resolve(false);
      },
    });
  });
}

test('modo revisión: el código se recuerda en el navegador, pide almacenamiento persistente y se olvida al salir (#60)', async ({ page, context }) => {
  await prepararContexto(context);
  await page.goto('/es/revision?r=RECUERDA1');
  await expect(barra(page)).toContainText('RECUERDA1');
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect.poll(() => persistencias(page), { timeout: 30_000 }).toBeGreaterThan(0); // D6
  await irAlHipocampo(page);
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Correcto' }).click();
  await expect.poll(async () => Object.keys((await guardadas(page, 'RECUERDA1')) ?? {}).length, { timeout: 30_000 }).toBe(1);

  // D7, D6: una pestaña nueva del mismo navegador, sin ?r, sigue en modo revisión con su contador.
  await page.close(); // cada pestaña dibuja el modelo con WebGL por software: se cierra la que ya no se usa
  const nueva = await context.newPage();
  await nueva.goto('/es');
  await expect(barra(nueva)).toContainText('RECUERDA1');
  await expect(nueva.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect.poll(() => persistencias(nueva), { timeout: 30_000 }).toBeGreaterThan(0);

  // D8: salir olvida el código en los dos almacenes; ni recargar ni otra pestaña vuelven al modo revisión.
  await nueva.getByRole('button', { name: 'Salir del modo revisión' }).click();
  await nueva.getByRole('alertdialog').getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(barra(nueva)).toHaveCount(0);
  expect(await nueva.evaluate(() => [localStorage.getItem('atlas:revisor'), sessionStorage.getItem('atlas:revisor')])).toEqual([null, null]);
  await nueva.reload();
  await expect(nueva.locator('.encabezado')).toBeVisible();
  await expect(barra(nueva)).toHaveCount(0);
  await nueva.close();
  const otra = await context.newPage();
  await otra.goto('/es');
  await expect(otra.locator('.encabezado')).toBeVisible();
  await expect(barra(otra)).toHaveCount(0);
});
