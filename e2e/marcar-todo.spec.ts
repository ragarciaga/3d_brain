// Revisión docente: botones de veredicto de 44 px en celular y "Marcar todo como correcto" (#66).
// Helpers propios para no depender de atlas.spec.ts.
import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const guia = (page: Page) => page.getByTestId('como-revisar');
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

test.describe('celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('modo revisión en celular: botones de veredicto de 44 px y "Marcar todo como correcto" respeta lo ya respondido (#66)', async ({
    page,
  }) => {
    await entrar(page, 'MARCAR01');
    await cerrarGuia(page);
    await irAlHipocampo(page);
    await expect(page.locator('#ficha-titulo')).toContainText('Hipocampo');

    // D1: todos los botones de veredicto de la ficha miden 44 px o más.
    const ficha = page.getByTestId('ficha');
    const controles = ficha.locator('.revision-control');
    const n = await controles.count();
    expect(n).toBeGreaterThan(5);
    const botones = ficha.locator('.revision-botones button');
    await expect(botones).toHaveCount(3 * n);
    for (const b of await botones.all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const control = (campo: string) => ficha.locator(`[data-campo="${campo}"]`);
    for (const nombre of ['Correcto', 'Corregir', 'No es mi área']) {
      await expect(control('que_es.es').getByRole('button', { name: nombre, exact: true })).toBeVisible();
    }

    // Respuestas previas: Corregir con texto, No es mi área y Corregir sin texto.
    await control('que_es.es').getByRole('button', { name: 'Corregir', exact: true }).click();
    const propuesta = control('que_es.es').getByLabel('Cambio propuesto');
    await propuesta.fill('Propuesta de prueba');
    await propuesta.blur();
    await control('ubicacion.es').getByRole('button', { name: 'No es mi área', exact: true }).click();
    await control('para_que_sirve.es').getByRole('button', { name: 'Corregir', exact: true }).click();
    await expect(control('para_que_sirve.es').getByTestId('revision-incompleta')).toBeVisible();
    await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');

    // D3 y D9: el primer toque solo pide confirmar; Cancelar no cambia nada.
    const marcar = page.getByTestId('marcar-todo');
    const boton = marcar.getByRole('button', { name: 'Marcar todo como correcto', exact: true });
    await boton.click();
    await expect(marcar.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    await expect(marcar).toContainText(`${n - 3} campos sin respuesta`);
    await expect(marcar).toContainText('1 "Corregir" sin texto no cambia');
    await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');
    await marcar.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');
    await expect(boton).toBeFocused();

    // D4: confirmar responde solo lo que no tenía respuesta.
    await boton.click();
    await marcar.getByRole('button', { name: `Marcar ${n - 3} campos`, exact: true }).click();
    await expect(page.getByTestId('total-respuestas')).toHaveText(`${n} respuestas`);
    await expect(control('que_es.es').getByRole('button', { name: 'Corregir', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(control('que_es.es').getByLabel('Cambio propuesto')).toHaveValue('Propuesta de prueba');
    await expect(control('ubicacion.es').getByRole('button', { name: 'No es mi área', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(control('para_que_sirve.es').getByRole('button', { name: 'Corregir', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(control('para_que_sirve.es').getByTestId('revision-incompleta')).toBeVisible();
    const previos = ['que_es.es', 'ubicacion.es', 'para_que_sirve.es'];
    for (const c of await controles.all()) {
      if (previos.includes((await c.getAttribute('data-campo'))!)) continue;
      await expect(c.getByRole('button', { name: 'Correcto', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }

    // D6 y D9: sin pendientes el botón se deshabilita y un mensaje de estado dice cuántos se marcaron.
    await expect(boton).toBeDisabled();
    await expect(marcar.getByRole('status')).toHaveText(`Marcaste ${n - 3} campos como correctos.`);
    await expect(marcar.getByRole('status')).toBeFocused();
  });
});

test('fuera del modo revisión no hay "Marcar todo como correcto" (#66)', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toContainText('Hipocampo');
  await expect(page.getByTestId('marcar-todo')).toHaveCount(0);
});
