import { expect, test, type Page } from '@playwright/test';

interface CorteEstado {
  activo: boolean;
  mm: number;
  invertido: boolean;
}
type Estado = Record<string, (...a: unknown[]) => void> & {
  cortes: Record<'sagital' | 'coronal' | 'axial', CorteEstado>;
  fantasmaCorte: boolean;
  rellenoApagado: boolean;
  aislar: { modo: string } | null;
};
interface VentanaPanel {
  __atlas: { getState(): Estado };
  __cortes: { planosDe(p: string): number };
}

// Copias de los ayudantes de cortes-visor.spec.ts: cada archivo de pruebas es independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const planosDe = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaPanel).__cortes.planosDe(p), pieza);
/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaPanel).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);
const estado = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as VentanaPanel).__atlas.getState();
    return {
      cortes: JSON.parse(JSON.stringify(s.cortes)) as Estado['cortes'],
      fantasmaCorte: s.fantasmaCorte,
      rellenoApagado: s.rellenoApagado,
      aislar: s.aislar ? s.aislar.modo : null,
    };
  });

const botonRiel = (page: Page) => page.locator('.riel').getByRole('button', { name: 'Cortes', exact: true });
const panelCortes = (page: Page) => page.locator('#panel-cortes');
const fila = (page: Page, plano: string) => page.locator(`[data-plano="${plano}"]`);
const interruptor = (page: Page, plano: string, nombre: string) => fila(page, plano).getByRole('checkbox', { name: nombre, exact: true });
const deslizador = (page: Page, plano: string) => fila(page, plano).getByRole('slider');

test('panel de cortes: abre y cierra, planos con flechas y etiqueta, aviso, relleno apagado, Escape que solo cierra el panel y Quitar cortes', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');

  await test.step('(1) el botón del riel abre y cierra el panel con tres planos, Invertir, Fantasma y Quitar cortes (R1.1, R6.1, R6.4)', async () => {
    await expect(botonRiel(page)).toBeEnabled();
    await expect(botonRiel(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panelCortes(page)).toHaveCount(0);
    await botonRiel(page).click();
    await expect(panelCortes(page)).toBeVisible();
    await expect(botonRiel(page)).toHaveAttribute('aria-expanded', 'true');
    const filas = page.locator('#panel-cortes [data-plano]');
    await expect(filas).toHaveCount(3);
    expect(await filas.evaluateAll((els) => els.map((e) => e.getAttribute('data-plano')))).toEqual(['sagital', 'coronal', 'axial']);
    for (const [plano, nombre, posicion] of [
      ['sagital', 'Sagital', 'Posición del plano sagital'],
      ['coronal', 'Coronal', 'Posición del plano coronal'],
      ['axial', 'Axial', 'Posición del plano axial'],
    ] as const) {
      await expect(interruptor(page, plano, nombre)).not.toBeChecked();
      await expect(fila(page, plano).getByRole('slider', { name: posicion })).toBeDisabled();
      await expect(fila(page, plano).getByRole('button', { name: /Invertir/ })).toBeDisabled();
    }
    await expect(panelCortes(page).getByRole('checkbox', { name: 'Fantasma', exact: true })).toBeVisible();
    await expect(panelCortes(page).getByRole('button', { name: 'Quitar cortes' })).toBeVisible();
    const aviso = page.getByTestId('cortes-aviso');
    await expect(aviso).toContainText('un solo cuerpo');
    await expect(aviso).toContainText('no reemplazan un atlas de neuroimagen');
    // Sin cortes no hay relleno apagado: una sola lectura, sin reintentos (LESSONS 2026-10-14).
    expect((await estado(page)).rellenoApagado).toBe(false);
    expect(await page.getByTestId('cortes-relleno-apagado').count()).toBe(0);
    await botonRiel(page).click();
    await expect(panelCortes(page)).toHaveCount(0);
    await expect(botonRiel(page)).toHaveAttribute('aria-expanded', 'false');
    await botonRiel(page).click();
    await expect(panelCortes(page)).toBeVisible();
  });

  await test.step('(2) la etiqueta da los mm con su dirección anatómica (R1.5)', async () => {
    await interruptor(page, 'coronal', 'Coronal').check();
    expect((await estado(page)).cortes.coronal).toEqual({ activo: true, mm: 0, invertido: false });
    await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('en el centro');
    await deslizador(page, 'coronal').fill('12');
    await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('12 mm anterior');
    expect((await estado(page)).cortes.coronal.mm).toBe(12);
    await deslizador(page, 'coronal').fill('-8');
    await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('8 mm posterior');
  });

  await test.step('(3) las flechas mueven 1 mm y aria-valuetext anuncia el valor; Invertir y Fantasma (R1.9)', async () => {
    await interruptor(page, 'axial', 'Axial').check();
    const axial = deslizador(page, 'axial');
    await axial.focus();
    await page.keyboard.press('ArrowUp');
    await expect(axial).toHaveAttribute('aria-valuetext', '1 mm superior');
    await expect(page.getByTestId('etiqueta-corte-axial')).toHaveText('1 mm superior');
    expect((await estado(page)).cortes.axial.mm).toBe(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(axial).toHaveAttribute('aria-valuetext', '1 mm inferior');
    expect((await estado(page)).cortes.axial.mm).toBe(-1);
    const invertir = fila(page, 'axial').getByRole('button', { name: /Invertir/ });
    await invertir.click();
    await expect(invertir).toHaveAttribute('aria-pressed', 'true');
    const tras = (await estado(page)).cortes.axial;
    expect(tras.invertido).toBe(true);
    expect(tras.mm).toBe(-1);
    const fantasma = panelCortes(page).getByRole('checkbox', { name: 'Fantasma', exact: true });
    await fantasma.check();
    await expect(fantasma).toBeChecked();
    expect((await estado(page)).fantasmaCorte).toBe(true);
  });

  await test.step('(4) el panel y el cajón del riel se excluyen (D1)', async () => {
    await page.locator('.riel').getByRole('button', { name: 'Estructuras', exact: true }).click();
    await expect(panelCortes(page)).toHaveCount(0);
    await expect(page.locator('.app.menu-abierto')).toHaveCount(1);
    await botonRiel(page).click();
    await expect(page.locator('.app.menu-abierto')).toHaveCount(0);
    await expect(panelCortes(page)).toBeVisible();
  });

  await test.step('(5) con el relleno apagado el panel lo avisa una sola vez (R8.2)', async () => {
    await accion(page, 'apagarRelleno');
    await accion(page, 'apagarRelleno');
    const aviso = page.getByTestId('cortes-relleno-apagado');
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveCount(1);
    await expect(aviso).toContainText('30 cuadros por segundo');
  });

  await test.step('(6) Escape cierra solo el panel: los cortes siguen y lo aislado sigue aislado (R6.5)', async () => {
    // Estado donde un fallo se vería (LESSONS 2026-10-13): planos movidos, uno invertido y una pieza aislada.
    await accion(page, 'setCorte', 'coronal', { activo: true, mm: -8 });
    await accion(page, 'setCorte', 'axial', { activo: true, mm: -1, invertido: true });
    await accion(page, 'aislarPiezas', ['thalamus-l'], 'solo');
    const guardado = (await estado(page)).cortes;
    expect(guardado.coronal).toEqual({ activo: true, mm: -8, invertido: false });
    expect(guardado.axial).toEqual({ activo: true, mm: -1, invertido: true });
    expect((await estado(page)).aislar).toBe('solo');
    await deslizador(page, 'coronal').focus();
    await page.keyboard.press('Escape');
    await expect(panelCortes(page)).toHaveCount(0);
    await page.waitForTimeout(300);
    const despues = await estado(page);
    expect(despues.cortes).toEqual(guardado);
    expect(despues.aislar).toBe('solo');
    await expect(botonRiel(page)).toBeFocused();
    // Con el foco ya fuera de un campo, el segundo Escape sí sale del aislamiento.
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await estado(page)).aislar).toBeNull();
  });

  await test.step('(7) Quitar cortes apaga los tres interruptores y deja el cerebro entero (R1.8)', async () => {
    await botonRiel(page).click();
    await expect(panelCortes(page)).toBeVisible();
    await interruptor(page, 'sagital', 'Sagital').check();
    await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(3);
    await panelCortes(page).getByRole('button', { name: 'Quitar cortes' }).click();
    for (const [plano, nombre] of [
      ['sagital', 'Sagital'],
      ['coronal', 'Coronal'],
      ['axial', 'Axial'],
    ] as const) {
      await expect(interruptor(page, plano, nombre)).not.toBeChecked();
    }
    const c = (await estado(page)).cortes;
    expect([c.sagital.activo, c.coronal.activo, c.axial.activo]).toEqual([false, false, false]);
    await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(0);
  });
});

test('sin modelo o sin WebGL el botón Cortes del riel queda deshabilitado (R6.6)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  await page.goto('/es');
  await expect(page.getByTestId('visor-error')).toBeVisible();
  await expect(botonRiel(page)).toBeDisabled();
  await expect(panelCortes(page)).toHaveCount(0);

  await page.unroute('**/modelos/atlas.glb');
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
      if (tipo === 'webgl2' || tipo === 'webgl' || tipo === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/es');
  await expect(page.getByTestId('visor-error')).toBeVisible();
  await expect(botonRiel(page)).toBeDisabled();
  await expect(panelCortes(page)).toHaveCount(0);
});
