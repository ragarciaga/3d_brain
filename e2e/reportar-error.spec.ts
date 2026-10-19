// "Reportar un error" (F12, spec 05, T5): el botón del pie de la ficha, su ausencia en modo revisión y el
// cascarón del diálogo (foco, Escape, aislamiento y desplazamiento en celular). El formulario llega en T6.
// Nombres y slugs se leen de los datos (oráculo de solo lectura); los códigos de revisión son de prueba.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const estructuras = (JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { nombre: { es: string; en: string }; slug: { es: string; en: string } }>;
}).estructuras;
const HIPOCAMPO = estructuras['hippocampus']!;

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const aislarActual = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState(): { aislar: { modo: string } | null } } }).__atlas.getState().aislar?.modo ?? null);

const pie = (page: Page) => page.getByTestId('ficha-pie');
const boton = (page: Page, nombre: string) => pie(page).getByRole('button', { name: nombre });
const dialogo = (page: Page) => page.getByTestId('dialogo-reporte');

/** Espera a que la ficha de la entrada esté en pantalla, no solo la URL. */
async function fichaLista(page: Page, entrada: string, nombre: string) {
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', entrada);
  await expect(page.locator('#ficha-titulo')).toHaveText(nombre);
}

test('el botón está en el pie, fuera de las fuentes; el diálogo toma el foco y Escape no sale del aislamiento', async ({ page }) => {
  await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  const reportar = boton(page, 'Reportar un error');
  await expect(reportar).toBeVisible();
  // `details.ficha-fuentes` está cerrado: no se busca por rol dentro de él, se pregunta por el ancestro.
  expect(await reportar.evaluate((el) => el.closest('details.ficha-fuentes'))).toBeNull();
  await expect.poll(() => aislarActual(page)).toBe('contexto');

  // Escape: cierra el diálogo, devuelve el foco al botón y deja el aislamiento como estaba.
  await reportar.click();
  await expect(page.getByRole('heading', { name: `Reportar un error en ${HIPOCAMPO.nombre.es}` })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();
  await page.waitForTimeout(300);
  expect(await aislarActual(page)).toBe('contexto');

  // "Cerrar" hace lo mismo.
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await dialogo(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();

  // Control: sin diálogo, el siguiente Escape sí sale del aislamiento.
  await page.keyboard.press('Escape');
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('en inglés dice "Report an error"; en una entrada sin ficha el pie también está', async ({ page }) => {
  await abrir(page, `/en/${HIPOCAMPO.slug.en}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.en);
  const reportar = boton(page, 'Report an error');
  await expect(reportar).toBeVisible();
  expect(await reportar.evaluate((el) => el.closest('details.ficha-fuentes'))).toBeNull();
  await reportar.click();
  await expect(page.getByRole('heading', { name: `Report an error in ${HIPOCAMPO.nombre.en}` })).toBeFocused();

  // Hoy todas las entradas del atlas tienen ficha: la entrada sin ficha es el hipocampo con `ficha: null`, que se
  // fija en el módulo de datos que sirve Vite (solo el servidor de desarrollo, como la costura del canal).
  await page.route('**/src/data/estructuras.json?*', async (route) => {
    const respuesta = await route.fetch();
    const texto = await respuesta.text();
    expect(texto, 'el módulo de datos que sirve Vite ya no exporta `estructuras`').toContain('export const estructuras');
    await route.fulfill({ response: respuesta, body: `${texto}\nestructuras.hippocampus.ficha = null;\n` });
  });
  await page.goto(`/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  await expect(page.locator('details.ficha-fuentes')).toHaveCount(0);
  await expect(boton(page, 'Reportar un error')).toBeVisible();
});

test('en modo revisión, por código en la URL o recordado, no hay botón ni pie', async ({ page }) => {
  await abrir(page, '/es/revision?r=PRUEBA01');
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/es/${HIPOCAMPO.slug.es}$`));
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  // Los controles de revisión ya están: el pie, de haberlo, también estaría montado. Se lee una vez.
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  expect(await page.getByTestId('ficha-pie').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Reportar un error' }).count()).toBe(0);

  // Segunda carga: el código ya quedó recordado, sin `?r=`.
  await page.goto(`/es/${HIPOCAMPO.slug.es}`);
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  expect(await page.getByTestId('ficha-pie').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Reportar un error' }).count()).toBe(0);
});

// 844 es el alto del criterio; 568 es un teléfono corto, donde el diálogo no cabe sin desplazarse.
for (const alto of [844, 568]) {
  test(`celular (390 x ${alto}): la caja del diálogo se desplaza y "Cerrar" se ve completo y sin tapar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: alto });
    await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
    await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
    const reportar = boton(page, 'Reportar un error');
    await reportar.scrollIntoViewIfNeeded();
    await reportar.click();
    const caja = dialogo(page);
    await expect(caja).toBeVisible();

    const estilo = await caja.evaluate((el) => {
      const s = getComputedStyle(el);
      return { maxHeight: parseFloat(s.maxHeight), overflowY: s.overflowY, alto: window.innerHeight };
    });
    // `parseFloat('none')` es NaN y no pasa la comparación.
    expect(estilo.maxHeight <= estilo.alto).toBe(true);
    expect(['auto', 'scroll']).toContain(estilo.overflowY);

    // Se llega al final con el desplazamiento de la propia caja, no con el de la página.
    await caja.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const cerrar = caja.getByRole('button', { name: 'Cerrar' });
    await expect(cerrar).toBeInViewport({ ratio: 1 });
    const rect = (await cerrar.boundingBox())!;
    const encima = await page.evaluate(
      ({ x, y }) => {
        const b = document.elementFromPoint(x, y)?.closest('button');
        return { texto: b?.textContent?.trim() ?? null, enDialogo: !!b?.closest('[role=dialog]') };
      },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    );
    expect(encima).toEqual({ texto: 'Cerrar', enDialogo: true });
    await cerrar.click();
    await expect(caja).toHaveCount(0);
    await expect(reportar).toBeFocused();
  });
}
