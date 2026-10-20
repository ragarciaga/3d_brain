// Direct navigation to a structure URL (#265). The build writes a file per public route so GitHub Pages
// answers 200; this spec checks that the app resolves those URLs when opened cold. It runs against the
// dev server: `vite preview` falls back to index.html for every path, so it would not prove the Pages
// behavior. The files themselves are covered by tests/entradas.test.ts.
import { expect, test } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
});

for (const [idioma, slug, titulo] of [
  ['es', 'hipocampo', 'Hipocampo'],
  ['en', 'hippocampus', 'Hippocampus'],
] as const) {
  test(`opening /${idioma}/${slug} directly shows the card`, async ({ page }) => {
    await page.goto(`/${idioma}/${slug}`);
    await expect(page.locator('#ficha-titulo')).toHaveText(titulo);
    await expect(page.getByTestId('no-encontrada')).toHaveCount(0);
  });
}

test('opening an unknown path directly shows the not-found notice', async ({ page }) => {
  await page.goto('/en/does-not-exist');
  await expect(page.getByTestId('no-encontrada')).toContainText('We could not find that structure');
  await expect(page.locator('#ficha-titulo')).toHaveCount(0);
});
