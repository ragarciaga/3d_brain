// Carga temprana del modelo 3D (#83): index.html lo precarga para que se pida en paralelo con el
// código. Helpers propios para no depender de atlas.spec.ts.
import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

interface EntradaRecurso {
  name: string;
  initiatorType: string;
  startTime: number;
  responseEnd: number;
  decodedBodySize: number;
}

/** Entradas de recurso cuyo nombre cumple el patrón, en el orden en que las reporta el navegador. */
const entradas = (page: Page, patron: string) =>
  page.evaluate(
    (p): EntradaRecurso[] =>
      performance
        .getEntriesByType('resource')
        .filter((e) => new RegExp(p).test(e.name))
        .map((e) => {
          const r = e as PerformanceResourceTiming;
          return {
            name: r.name,
            initiatorType: r.initiatorType,
            startTime: r.startTime,
            responseEnd: r.responseEnd,
            decodedBodySize: r.decodedBodySize,
          };
        }),
    patron,
  );

const MODELO = '/modelos/atlas\\.glb';
// En desarrollo el código es /src/main.tsx; publicado, /assets/index-*.js.
const SCRIPT_PRINCIPAL = '/src/main\\.tsx(\\?|$)|/assets/index-[^/]+\\.js(\\?|$)';

test('el modelo se pide con el HTML, antes de que termine de bajar el código (#83)', async ({ page }) => {
  const avisosPrecarga: string[] = [];
  page.on('console', (m) => {
    if (/preload/i.test(m.text())) avisosPrecarga.push(m.text());
  });
  await abrir(page, '/es');
  await modeloCargado(page);

  const modelo = await entradas(page, MODELO);
  const principal = await entradas(page, SCRIPT_PRINCIPAL);
  expect(modelo.length).toBeGreaterThan(0);
  expect(principal.length).toBeGreaterThan(0);
  // La pidió la precarga del HTML, no el código, y salió antes de que el script principal llegara.
  expect(modelo[0]!.initiatorType).toBe('link');
  expect(modelo[0]!.startTime).toBeLessThan(principal[0]!.responseEnd);
  // La precarga se aprovechó: Chromium no avisa de precargas sin usar.
  expect(avisosPrecarga).toEqual([]);
});

test('con ?medir=1, el informe cuenta la descarga de la precarga y una preparación coherente (#83)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page, '/es?medir=1');
  const panel = page.getByTestId('panel-medicion');
  await expect(panel).toBeVisible();
  await modeloCargado(page);
  await expect(page.getByTestId('medicion-primer-cuadro')).toHaveText(/\d+ ms/);
  await panel.getByRole('button', { name: 'Copiar resultados' }).click();
  await expect(panel.getByRole('button', { name: 'Copiado' })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());

  const numero = (re: RegExp) => {
    const m = copiado.match(re);
    expect(m, `${re} en el informe:\n${copiado}`).not.toBeNull();
    return Number(m![1]);
  };
  const inicio = numero(/Modelo 3D: empezó a los (\d+) ms/);
  const codigo = numero(/Código listo: (\d+) ms/);
  const preparar = numero(/Preparar el modelo: (\d+) ms/);
  const primerCuadro = numero(/Primer cuadro: (\d+) ms/);

  // El informe cuenta la primera entrada con cuerpo (la descarga real).
  const conCuerpo = (await entradas(page, MODELO)).find((e) => e.decodedBodySize > 0);
  expect(conCuerpo).toBeDefined();
  expect(Math.abs(inicio - Math.round(conCuerpo!.startTime))).toBeLessThanOrEqual(1);
  // La preparación no incluye la espera por el código (+1 ms por el redondeo de cada cifra).
  expect(preparar).toBeLessThanOrEqual(primerCuadro - codigo + 1);
});
