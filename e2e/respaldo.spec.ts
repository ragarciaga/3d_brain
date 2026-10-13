// Modo revisión: respaldo del avance, código recordado y almacenamiento persistente (#60). Helpers propios
// para no depender de atlas.spec.ts.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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
          const pedido = db.transaction('keyval').objectStore('keyval').get(`revision:${c}`);
          pedido.onsuccess = () => resolver(pedido.result?.respuestas ?? null);
          pedido.onerror = () => resolver(null);
        };
      }),
    codigo,
  );

/** Vacía el almacén de idb-keyval. No se borra la base: la conexión abierta bloquearía deleteDatabase. */
const vaciarIdb = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolver, rechazar) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => rechazar(abrirDb.error);
        abrirDb.onsuccess = () => {
          const tx = abrirDb.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').clear();
          tx.oncomplete = () => resolver();
          tx.onerror = () => rechazar(tx.error);
        };
      }),
  );

/** Elige un archivo en el selector que abre "Cargar respaldo". */
async function cargarRespaldo(page: Page, archivo: string | { name: string; mimeType: string; buffer: Buffer }) {
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), barra(page).getByRole('button', { name: 'Cargar respaldo', exact: true }).click()]);
  await selector.setFiles(archivo);
}

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

test('modo revisión: descargar y cargar el respaldo recupera el avance (#60)', async ({ page, context }) => {
  await prepararContexto(context);

  await page.goto('/es/revision?r=RESPALDO1');
  await expect(barra(page)).toContainText('RESPALDO1');
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect.poll(() => persistencias(page), { timeout: 30_000 }).toBeGreaterThan(0); // D6

  await expect(page.getByTestId('aviso-local')).toContainText('solo en este navegador'); // D1
  await expect(barra(page).getByRole('button', { name: 'Descargar respaldo', exact: true })).toBeDisabled(); // D2

  await irAlHipocampo(page);
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Correcto' }).click();
  const queEs = page.locator('[data-campo="que_es.es"]');
  await queEs.getByRole('button', { name: 'Corregir' }).click();
  await queEs.getByLabel('Cambio propuesto').pressSequentially('Texto del respaldo');
  await expect.poll(async () => (await guardadas(page, 'RESPALDO1'))?.['hippocampus|que_es|es']?.propuesta, { timeout: 30_000 }).toBe('Texto del respaldo');
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');

  // D2: la descarga tiene el nombre y el contenido del formato.
  const [descarga] = await Promise.all([page.waitForEvent('download'), barra(page).getByRole('button', { name: 'Descargar respaldo', exact: true }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^respaldo-revision-RESPALDO1-\d{4}-\d{2}-\d{2}\.json$/);
  const ruta = (await descarga.path())!;
  const contenido = JSON.parse(readFileSync(ruta, 'utf8')) as { formato: string; v: number; revisor: string; respuestas: Array<{ propuesta?: string }> };
  expect([contenido.formato, contenido.v, contenido.revisor, contenido.respuestas.length]).toEqual(['atlas-revision-respaldo', 1, 'RESPALDO1', 2]);
  expect(contenido.respuestas.some((r) => r.propuesta === 'Texto del respaldo')).toBe(true);

  // D5: un archivo que no es un respaldo, y uno de otro revisor, no cargan nada.
  const aviso = page.getByTestId('aviso-respaldo');
  await cargarRespaldo(page, { name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('esto no es json') });
  await expect(aviso).toContainText('no es un respaldo de revisión válido');
  const deOtro = Buffer.from(JSON.stringify({ ...contenido, revisor: 'OTRO01' }));
  await cargarRespaldo(page, { name: 'otro.json', mimeType: 'application/json', buffer: deOtro });
  await expect(aviso).toContainText('otro código de revisor');
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');

  // D7, D9: sin IndexedDB, una pestaña recargada sigue en modo revisión (sin ?r) con el contador en 0.
  await vaciarIdb(page);
  await page.reload();
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(barra(page)).toContainText('RESPALDO1');
  await expect(barra(page).getByRole('button', { name: 'Cargar respaldo', exact: true })).toBeEnabled(); // espera la lectura de IndexedDB (D13)
  await expect(page.getByTestId('total-respuestas')).toHaveText('0 respuestas');

  // D3: cargar el respaldo recupera el avance y lo muestra en la ficha abierta.
  await cargarRespaldo(page, ruta);
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  await expect(aviso).toContainText('Nuevas: 2');
  await expect(page.locator('[data-campo="que_es.es"]').getByLabel('Cambio propuesto')).toHaveValue('Texto del respaldo');

  // Cargar otra vez el mismo archivo no duplica.
  await cargarRespaldo(page, ruta);
  await expect(aviso).toContainText('Ya estaban: 2');
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');

  // D9: lo recuperado vuelve a IndexedDB y sobrevive a otra recarga.
  await expect.poll(async () => Object.keys((await guardadas(page, 'RESPALDO1')) ?? {}).length, { timeout: 30_000 }).toBe(2);
  await page.reload();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
});

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
