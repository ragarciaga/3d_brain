import { expect, test, type Page } from '@playwright/test';

interface CorteVivo {
  activo: boolean;
  mm: number;
  invertido: boolean;
}
type Estado = Record<string, (...a: unknown[]) => void> & {
  cortes: Record<string, CorteVivo>;
  explosion: number;
  separadas: Record<string, number[]>;
  inventario: boolean;
};
interface VentanaEnlace {
  __atlas: { getState(): Estado };
}

// Copias de los ayudantes de cortes-visor.spec.ts: este archivo no los comparte para que cada prueba sea independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaEnlace).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);
const cortes = (page: Page) => page.evaluate(() => (window as unknown as VentanaEnlace).__atlas.getState().cortes);

const apagado: CorteVivo = { activo: false, mm: 0, invertido: false };

test('abrir con corte= y explosion= aplica los planos con el cerebro armado, y Compartir copia los planos vivos del store (R7.1, R7.2, R7.4)', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page, '/es?corte=coronal:12,axial:-8:inv&explosion=40');

  // "287 piezas" se pinta justo antes de setCentros y el efecto corre un render después: se espera con poll.
  await expect
    .poll(() => cortes(page))
    .toEqual({
      sagital: apagado,
      coronal: { activo: true, mm: 12, invertido: false },
      axial: { activo: true, mm: -8, invertido: true },
    });
  const s = await page.evaluate(() => {
    const e = (window as unknown as VentanaEnlace).__atlas.getState();
    return { explosion: e.explosion, separadas: e.separadas, inventario: e.inventario };
  });
  expect(s).toEqual({ explosion: 0, separadas: {}, inventario: false });

  // Se cambia el sagital para probar que "Compartir" lee el store vivo y no repite la URL inicial.
  await accion(page, 'setCorte', 'sagital', { activo: true, mm: -5 });
  await page.locator('.compartir-encabezado').click();
  await expect(page.getByRole('status').filter({ hasText: 'Enlace copiado.' })).toBeVisible();
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toContain('corte=sagital:-5,coronal:12,axial:-8:inv');
  const url = new URL(texto);
  expect(url.searchParams.get('explosion')).toBeNull();
  expect(url.pathname.endsWith('/es')).toBe(true);
});

test('un enlace con una entrada mal escrita y otra válida aplica solo la válida, sin error (R7.3)', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es?corte=sagital:abc,coronal:5');
  await expect.poll(() => cortes(page)).toEqual({
    sagital: apagado,
    coronal: { activo: true, mm: 5, invertido: false },
    axial: apagado,
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
