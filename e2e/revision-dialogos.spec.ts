// Revisión docente: foco y Escape en los diálogos, cierre visible en celular, guardado mientras se escribe
// y respuestas "Corregir" sin texto. Helpers propios para no depender de atlas.spec.ts.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { configRevision } from '../src/config/revision';

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const aislarActual = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState(): { aislar: { modo: string } | null } } }).__atlas.getState().aislar?.modo ?? null);

const guia = (page: Page) => page.getByTestId('como-revisar');
const queRevisar = (page: Page) => page.getByTestId('que-revisar');
const enviarDialogo = (page: Page) => page.getByRole('dialog', { name: 'Enviar revisión' });
const barra = (page: Page) => page.getByTestId('panel-revision');

/** Entra en modo revisión con un código propio (la guía se abre sola) y espera la barra. */
async function entrar(page: Page, codigo: string) {
  await abrir(page, `/es/revision?r=${codigo}`);
  await expect(barra(page)).toContainText(codigo);
}

/** Abre la ficha del hipocampo con la búsqueda (solo la ruta /revision activa el modo revisión). */
async function irAlHipocampo(page: Page) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
}

async function cerrarGuia(page: Page) {
  await guia(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(guia(page)).toHaveCount(0);
}

test('foco al abrir y al cerrar: la guía que se abre sola, "Qué revisar" y "Enviar revisión"', async ({ page }) => {
  await entrar(page, 'FOCO01');

  // Guía: se abre sola, el foco va al título y Escape lo devuelve a su botón.
  await expect(guia(page).getByRole('heading', { name: 'Cómo revisar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(guia(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: 'Cómo revisar' })).toBeFocused();

  // Qué revisar.
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(queRevisar(page).getByRole('heading')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(queRevisar(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: /Qué revisar/ })).toBeFocused();

  // Enviar revisión: el botón Cerrar del diálogo hace lo mismo que Escape.
  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(enviarDialogo(page).getByRole('heading', { name: 'Enviar revisión' })).toBeFocused();
  await enviarDialogo(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(enviarDialogo(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: 'Enviar revisión' })).toBeFocused();

  // Y Escape también cierra "Enviar revisión".
  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(enviarDialogo(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(enviarDialogo(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: 'Enviar revisión' })).toBeFocused();
});

test('el botón Cerrar de la guía y de "Qué revisar" devuelve el foco a su botón de la barra', async ({ page }) => {
  await entrar(page, 'FOCO04');
  await expect(guia(page)).toBeVisible();
  await guia(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(guia(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: 'Cómo revisar' })).toBeFocused();

  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(queRevisar(page)).toBeVisible();
  await queRevisar(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(queRevisar(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: /Qué revisar/ })).toBeFocused();
});

test('Escape cierra el diálogo antes que el aislamiento', async ({ page }) => {
  await entrar(page, 'FOCO02');
  await cerrarGuia(page);
  await irAlHipocampo(page);
  await expect.poll(() => aislarActual(page)).toBe('contexto');

  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(guia(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guia(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await aislarActual(page)).toBe('contexto');

  // Sin diálogo, el siguiente Escape sale del aislamiento.
  await page.keyboard.press('Escape');
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('Escape cierra el diálogo aunque el foco esté en un campo de la ficha', async ({ page }) => {
  await entrar(page, 'FOCO03');
  await cerrarGuia(page);
  await irAlHipocampo(page);
  const control = page.locator('[data-campo="que_es.es"]');
  await control.getByRole('button', { name: 'Corregir' }).click();
  const propuesta = control.getByLabel('Cambio propuesto');
  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(enviarDialogo(page)).toBeVisible();
  await propuesta.focus();
  await page.keyboard.press('Escape');
  await expect(enviarDialogo(page)).toHaveCount(0);
  await expect.poll(() => aislarActual(page)).toBe('contexto');
});

// 844 es el alto del criterio; 568 es un teléfono corto, donde el diálogo no cabe debajo de la barra.
for (const alto of [844, 568]) {
  test.describe(`celular (390 x ${alto})`, () => {
    test.use({ viewport: { width: 390, height: alto } });

    /** El botón Cerrar del diálogo se ve completo y nada lo tapa. */
    async function cierreVisible(page: Page, dialogo: Locator) {
      const cerrar = dialogo.getByRole('button', { name: 'Cerrar' });
      // Se llega al final con el desplazamiento del propio diálogo, no con el de la página.
      await dialogo.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(cerrar).toBeInViewport({ ratio: 1 });
      const caja = (await cerrar.boundingBox())!;
      const encima = await page.evaluate(
        ({ x, y }) => {
          const b = document.elementFromPoint(x, y)?.closest('button');
          return { texto: b?.textContent?.trim() ?? null, enDialogo: !!b?.closest('[role=dialog]') };
        },
        { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 },
      );
      expect(encima).toEqual({ texto: 'Cerrar', enDialogo: true });
      await cerrar.click();
      await expect(dialogo).toHaveCount(0);
    }

    test('el final de cada diálogo se ve y no lo tapa nada', async ({ page }) => {
      await entrar(page, 'MOVIL01');
      await cierreVisible(page, guia(page));

      await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
      await cierreVisible(page, queRevisar(page));

      await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
      await cierreVisible(page, enviarDialogo(page));
    });
  });
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

test('la propuesta se guarda mientras se escribe y sobrevive a recargar', async ({ page }) => {
  await entrar(page, 'GUARDA01');
  await cerrarGuia(page);
  await irAlHipocampo(page);
  const control = page.locator('[data-campo="que_es.es"]');
  await control.getByRole('button', { name: 'Corregir' }).click();

  const propuesta = control.getByLabel('Cambio propuesto');
  await expect(propuesta).toBeVisible();
  await expect(propuesta).not.toHaveAttribute('placeholder');
  await expect(control.getByText('Cambio propuesto', { exact: true })).toBeVisible();

  await propuesta.pressSequentially('Propuesta a medio');
  await expect(propuesta).toBeFocused();
  await expect
    .poll(async () => (await guardadas(page, 'GUARDA01'))?.['hippocampus|que_es|es']?.propuesta, { timeout: 5000 })
    .toBe('Propuesta a medio');

  const comentario = control.getByLabel('Comentario (opcional)');
  await expect(comentario).toBeVisible();
  await expect(comentario).not.toHaveAttribute('placeholder');
  await expect(control.getByText('Comentario (opcional)', { exact: true })).toBeVisible();

  await page.reload();
  await expect(barra(page)).toContainText('GUARDA01');
  await expect(page.locator('[data-campo="que_es.es"]').getByLabel('Cambio propuesto')).toHaveValue('Propuesta a medio');
});

test('"Corregir" sin texto queda incompleto y no se envía', async ({ page }) => {
  await entrar(page, 'INCOMPLETA01');
  await cerrarGuia(page);
  await irAlHipocampo(page);
  const control = page.locator('[data-campo="que_es.es"]');
  await control.getByRole('button', { name: 'Corregir' }).click();
  await expect(control.getByTestId('revision-incompleta')).toContainText('Incompleto');
  await expect(control.getByLabel('Cambio propuesto')).toHaveAttribute('aria-invalid', 'true');

  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  const fila = enviarDialogo(page).getByRole('listitem').filter({ hasText: 'Hipocampo' });
  await expect(fila.getByTestId('incompletas')).toHaveText('1 "Corregir" sin texto no se envía');
  await expect(fila.getByRole('button', { name: 'Abrir formulario' })).toBeDisabled();
  await enviarDialogo(page).getByRole('button', { name: 'Cerrar' }).click();

  await control.getByLabel('Cambio propuesto').fill('x');
  await expect(control.getByTestId('revision-incompleta')).toHaveCount(0);
  await expect(control.getByLabel('Cambio propuesto')).not.toHaveAttribute('aria-invalid');
  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(enviarDialogo(page).getByTestId('incompletas')).toHaveCount(0);
  await expect(enviarDialogo(page).getByRole('listitem').filter({ hasText: 'Hipocampo' }).getByRole('button', { name: 'Abrir formulario' })).toBeEnabled();
});

test('lo que se envía lleva solo las respuestas completas de la ficha', async ({ page }) => {
  // El envío abre el formulario con window.open: se anota la URL en vez de salir de la página.
  await page.addInitScript(() => {
    const abiertas: string[] = [];
    (window as unknown as { __abiertas: string[] }).__abiertas = abiertas;
    window.open = (url) => {
      abiertas.push(String(url));
      return null;
    };
  });
  await entrar(page, 'ENVIO01');
  await cerrarGuia(page);
  await irAlHipocampo(page);
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Correcto' }).click();
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Corregir' }).click();

  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  const fila = enviarDialogo(page).getByRole('listitem').filter({ hasText: 'Hipocampo' });
  await expect(fila).toContainText(/· 1 respuesta(?!s)/);
  await expect(fila.getByTestId('incompletas')).toHaveText('1 "Corregir" sin texto no se envía');
  await fila.getByRole('button', { name: 'Abrir formulario' }).click();

  const abiertas = await page.evaluate(() => (window as unknown as { __abiertas: string[] }).__abiertas);
  expect(abiertas).toHaveLength(1);
  const p = new URL(abiertas[0]!).searchParams;
  expect(p.get(configRevision.campos.codigo)).toBe('ENVIO01');
  expect(p.get(configRevision.campos.estructura)).toBe('hippocampus');
  const carga = JSON.parse(p.get(configRevision.campos.revision)!) as { respuestas: { campo: string; veredicto: string }[] };
  expect(carga.respuestas.map((r) => `${r.campo}:${r.veredicto}`)).toEqual(['que_es:correcto']);
});
