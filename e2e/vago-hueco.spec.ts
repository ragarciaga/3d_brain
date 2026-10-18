// El vago del tórax como hueco (Plan B del ADR 0010): para el lanzamiento docente no se publica ninguna ruta
// trazada. Se prueba contra el rutas-vago.json y el GLB publicados, sin mock: la leyenda, la ficha del vago y el
// recorrido avisan del hueco, y la escena no dibuja ninguna ruta.
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

interface VentanaHueco {
  __atlas: { getState(): { rutas: unknown[]; huecos: { lado: string; y_max: number; y_min: number | null }[] } };
  __rutasDibujadas: () => unknown[];
}

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const estado = (page: Page) => page.evaluate(() => (window as unknown as VentanaHueco).__atlas.getState());

/** Abre la página con el modelo cargado y el archivo publicado leído (dos huecos). */
async function abrirConHuecos(page: Page, ruta: string) {
  await abrir(page, ruta);
  await modeloCargado(page);
  await expect.poll(async () => (await estado(page)).huecos.length, { timeout: 30_000 }).toBe(2);
}

const TEXTO_LEYENDA = {
  es: 'Hueco en el tórax: un tramo de cada vago está pendiente de trazado.',
  en: 'Gap in the thorax: one segment of each vagus nerve is pending tracing.',
};

test('la leyenda dice que hay un hueco en el tórax, sin fila "Trazada" ni filtro, en español y en inglés (D5)', async ({ page }) => {
  for (const idioma of ['es', 'en'] as const) {
    await abrirConHuecos(page, `/${idioma}`);
    const leyenda = page.getByTestId('leyenda-origen');
    await expect(leyenda).toBeVisible();
    await expect(page.getByTestId('leyenda-toracico')).toHaveText(TEXTO_LEYENDA[idioma]);
    await expect(leyenda.locator('.muestra-aproximada')).toHaveCount(0);
    await expect(leyenda.getByRole('checkbox')).toHaveCount(0);
    await expect(leyenda.locator('.muestra-escaneada')).toHaveCount(1);
    await expect(leyenda.locator('.muestra-marcador')).toHaveCount(1);
  }
});

test('no se dibuja ninguna ruta trazada: el estado no tiene rutas y la escena tampoco (D6)', async ({ page }) => {
  await abrirConHuecos(page, '/es');
  const s = await estado(page);
  expect(s.rutas).toEqual([]);
  expect(s.huecos.map((h) => h.lado).sort()).toEqual(['derecho', 'izquierdo']);
  // Con las mallas ya dibujadas y el archivo ya leído, la escena sigue sin ninguna ruta.
  expect(await page.evaluate(() => (window as unknown as VentanaHueco).__rutasDibujadas())).toEqual([]);
});

test('la ficha del vago avisa del hueco y no dice que haya trazado; otra ficha no lo muestra (D7)', async ({ page }) => {
  await abrirConHuecos(page, '/es/nervio-vago-x');
  await expect(page.getByTestId('aviso-hueco')).toHaveText(
    'En el atlas, un tramo torácico de este nervio está pendiente de trazado: en el vago derecho, entre la arteria subclavia y el bronquio principal; el vago izquierdo se interrumpe al entrar al tórax. El modelo de origen trae ese tramo en espejo de un lado al otro, con relaciones que no corresponden, y por eso queda un hueco.',
  );
  await expect(page.getByTestId('aviso-aproximada')).toHaveCount(0);

  await abrirConHuecos(page, '/en/vagus-nerve-x');
  await expect(page.getByTestId('aviso-hueco')).toHaveText(
    'In the atlas, a thoracic segment of this nerve is pending tracing: in the right vagus, between the subclavian artery and the main bronchus; the left vagus stops as it enters the thorax. The source model mirrors that segment from one side to the other, with relations that do not match, so a gap is left.',
  );

  await abrirConHuecos(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toBeVisible();
  await expect(page.getByTestId('aviso-hueco')).toHaveCount(0);
});

test('el recorrido avisa del hueco en la parada del tórax y cambia la nota del izquierdo en el abdomen (D8)', async ({ page }) => {
  await abrirConHuecos(page, '/es/nervio-vago-x');
  await page.getByTestId('iniciar-recorrido').click();
  const panel = page.getByTestId('recorrido');
  const NOTA_TORAX = 'En el tórax el atlas deja un hueco en los dos vagos: ese tramo está pendiente de trazado.';
  const NOTA_IZQUIERDO =
    'Aquí se sigue el vago derecho: en el atlas, el izquierdo se interrumpe al entrar al tórax y su recorrido hasta el abdomen está pendiente de trazado.';

  for (const n of [1, 2, 3, 4]) {
    if (n > 1) await page.getByTestId('recorrido-siguiente').click();
    await expect(panel).toContainText(`Parada ${n} de 4`);
    if (n === 3) {
      await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Atraviesa el tórax');
      await expect(panel).toContainText(NOTA_TORAX);
      await expect(panel).not.toContainText(NOTA_IZQUIERDO);
    } else {
      await expect(panel).not.toContainText(NOTA_TORAX);
    }
    if (n === 4) {
      await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Llega al abdomen');
      await expect(panel).toContainText(NOTA_IZQUIERDO);
      await expect(panel).not.toContainText('el izquierdo termina en el tórax');
    }
  }
});
