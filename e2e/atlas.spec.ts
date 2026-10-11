import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string, conAviso = false) {
  if (!conAviso) await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/284 (piezas|pieces)/, { timeout: 150_000 });
}

test('carga el modelo, muestra piezas, cuadros por segundo, aviso educativo y licencia', async ({ page }) => {
  await abrir(page, '/es', true);
  await expect(page.getByRole('dialog', { name: 'Antes de empezar' })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido' }).click();
  await modeloCargado(page);
  await expect(page.getByTestId('fps')).toHaveText(/\d+ cuadros\/s/);
  await expect(page.locator('footer')).toContainText('Uso educativo. No es una herramienta clínica ni de diagnóstico.');
  await page.getByRole('link', { name: 'Fuentes y licencia' }).click();
  await expect(page.getByTestId('licencia')).toContainText('Z-Anatomy');
  await expect(page.getByTestId('licencia')).toContainText('BodyParts3D');
  await expect(page.getByTestId('licencia')).toContainText('CC BY-SA 4.0');
});

test('la interfaz en inglés no muestra textos en español', async ({ page }) => {
  await abrir(page, '/en', true);
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await modeloCargado(page);
  await expect(page.locator('footer')).toContainText('Educational use.');
  await expect(page.getByRole('button', { name: 'Reassemble' })).toBeVisible();
});

test('búsqueda bilingüe: con la interfaz en español, "amygdala" abre la amígdala', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await page.getByRole('combobox', { name: /Buscar/ }).fill('amygdala');
  await expect(page.getByRole('option').first()).toContainText('Cuerpo amigdaloide');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/cuerpo-amigdaloide$/);
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'amygdaloid-body');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('neumogastrico');
  await expect(page.getByRole('option').first()).toContainText('Nervio vago');
});

test('URL por estructura e idioma: cambiar de idioma conserva la estructura', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await modeloCargado(page);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await page.getByTestId('cambiar-idioma').click();
  await expect(page).toHaveURL(/\/en\/hippocampus$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hippocampus');
});

test('árbol y grupos: ocultar un grupo y filtrar el sistema límbico', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const encefalo = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') });
  await expect(encefalo.locator('.arbol-contador')).toHaveText('250/250');
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).not.toHaveText('250/250');
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('250/250');
  await encefalo.getByRole('checkbox').uncheck();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('0/250');
});

test('fragmentar y reensamblar: todas las piezas vuelven exactamente a su sitio', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await page.getByTestId('explosion').fill('70');
  const desplazadas = () =>
    page.evaluate(() => {
      const atlas = (window as unknown as { __atlas: { getState(): { base: Record<string, number[]> } } }).__atlas;
      return Object.values(atlas.getState().base).filter((v) => v.some((x) => x !== 0)).length;
    });
  await expect.poll(desplazadas).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Armar pieza por pieza' }).click();
  await expect(page.getByTestId('contador-armado')).toContainText(/0 de \d+ en su sitio/);
  await page.getByTestId('reensamblar').click();
  await expect.poll(desplazadas).toBe(0);
});

test('modo revisión: el docente marca campos y el contador sube', async ({ page }) => {
  await abrir(page, '/es/revision?r=PRUEBA01');
  await modeloCargado(page);
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Correcto' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Corregir' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).fill('Propuesta de prueba');
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).blur();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  // El texto propuesto no pasa a otra estructura.
  await page.getByRole('combobox', { name: /Buscar/ }).fill('tálamo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/talamo$/);
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Corregir' }).click();
  await expect(page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' })).toHaveValue('');
  await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');
  await page.getByRole('button', { name: 'Enviar revisión' }).click();
  await expect(page.getByRole('dialog', { name: 'Enviar revisión' })).toContainText('Hipocampo');
});

test('tras salir del modo fantasma las piezas se pueden volver a tocar', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await modeloCargado(page);
  await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await page.locator('[data-vista="lateral-izq"]').click();
  await page.waitForTimeout(1500);
  const lienzo = page.getByTestId('visor').locator('canvas');
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page).toHaveURL(/\/es\/[a-z0-9-]+$/);
  await expect(page.getByTestId('ficha')).toBeVisible();
});

test('elegir de nuevo la misma estructura después de deseleccionar vuelve a abrir la ficha', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const buscar = page.getByRole('combobox', { name: /Buscar/ });
  await buscar.fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
  await buscar.fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
});
