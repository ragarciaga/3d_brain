// Densidad de píxeles del visor (#84). Prueba barata: no espera el modelo, porque el lienzo y el panel de
// medición existen antes de que cargue. Helpers propios para no depender de otras pruebas.
import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

test('?dpr fija la densidad del lienzo y el panel la muestra; sin él, queda la automática (#84)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Sin ?dpr: ajuste automático. En CI la pantalla es 1x, así que la densidad efectiva es 1.
  await abrir(page, '/es?medir=1');
  await expect(page.getByTestId('medicion-densidad')).toHaveText('1 (automática)');

  // Con ?dpr=1.5: el lienzo dibuja a 1,5 aunque la pantalla sea 1x.
  await abrir(page, '/es?medir=1&dpr=1.5');
  const panel = page.getByTestId('panel-medicion');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('medicion-densidad')).toHaveText('1,5 (fija con ?dpr)');
  await expect
    .poll(async () =>
      page.locator('[data-testid="visor"] canvas').evaluate((c: HTMLCanvasElement) => Math.abs(c.width / c.clientWidth - 1.5)),
    )
    .toBeLessThan(0.01);

  // El informe copiado dice a qué densidad se midió. El botón se habilita sin esperar el modelo.
  await panel.getByRole('button', { name: 'Copiar resultados' }).click();
  await expect(panel.getByRole('button', { name: 'Copiado' })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toContain('Densidad de píxeles del visor: 1,5 (fija con ?dpr)');
});
