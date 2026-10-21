import { expect, test, type Locator, type Page } from '@playwright/test';

interface CorteEstado {
  activo: boolean;
  mm: number;
  invertido: boolean;
}
type Estado = Record<string, (...a: unknown[]) => void> & {
  cortes: Record<'sagital' | 'coronal' | 'axial', CorteEstado>;
};
interface VentanaMovil {
  __atlas: { getState(): Estado };
}

// Copias de los ayudantes de cortes-panel.spec.ts: cada archivo de pruebas es independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // Sin GPU el vigilante de cuadros (R8.2) apagaría el relleno y agregaría su aviso al cajón que se mide.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  // Sin transiciones: las cajas no se miden a mitad de la animación del cajón.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaMovil).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);
const estado = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as VentanaMovil).__atlas.getState();
    return { cortes: JSON.parse(JSON.stringify(s.cortes)) as Estado['cortes'] };
  });

const panelCortes = (page: Page) => page.locator('#panel-cortes');
const botonMovil = (page: Page) => page.locator('.encabezado').getByRole('button', { name: 'Cortes', exact: true });
const botonRiel = (page: Page) => page.locator('.riel').getByRole('button', { name: 'Cortes', exact: true });
const dock = (page: Page) => page.getByRole('toolbar', { name: 'Fragmentar y reensamblar' });
const brujula = (page: Page) => page.getByRole('toolbar', { name: 'Vistas anatómicas' });
const ficha = (page: Page) => page.getByTestId('ficha');
const separar = (page: Page) => ficha(page).getByRole('button', { name: 'Separar', exact: true });
const interruptor = (page: Page, plano: string, nombre: string) =>
  page.locator(`[data-plano="${plano}"]`).getByRole('checkbox', { name: nombre, exact: true });
const TEXTO_BLOQUEADO = 'Se desactivan mientras haya cortes';

interface Caja {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Dos cajas se intersecan solo si comparten área: los bordes que se tocan no cuentan. */
const seIntersecan = (a: Caja, b: Caja) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const caja = async (loc: Locator): Promise<Caja> => {
  const c = await loc.boundingBox();
  expect(c, 'la caja existe').not.toBeNull();
  return c!;
};

/** Antes de activar un plano: los tres controles habilitados y sin nota (una sola lectura, LESSONS 2026-10-14). */
async function comprobarHabilitados(page: Page) {
  await expect(page.getByTestId('explosion')).toBeEnabled();
  await expect(page.getByTestId('reensamblar')).toBeEnabled();
  await expect(separar(page)).toBeEnabled();
}
async function comprobarSinNotas(page: Page) {
  expect(await page.getByTestId('explosion-bloqueada').count()).toBe(0);
  expect(await page.getByTestId('separar-bloqueado').count()).toBe(0);
}

test.describe('celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('cajón de cortes en celular: inert, foco, Escape, colisiones, exclusión con Estructuras y controles bloqueados', async ({ page }) => {
    test.setTimeout(240_000);
    await abrir(page, '/es/talamo');
    const boton = botonMovil(page);
    const focoEnCajon = () => page.evaluate(() => !!document.activeElement?.closest('#panel-cortes'));

    await test.step('(1) no rail: the header Cortes button comes right after search, and row 2 of the header fits in one line (R6.2)', async () => {
      await expect(page.locator('.riel')).toBeHidden();
      await expect(boton).toBeVisible();
      await expect(boton).toBeEnabled();
      expect(await boton.evaluate((el) => el.previousElementSibling?.classList.contains('boton-buscar'))).toBe(true);
      const yMenu = (await caja(page.locator('.boton-menu'))).y;
      expect(Math.abs((await caja(boton)).y - yMenu)).toBeLessThan(8);
      expect(Math.abs((await caja(page.locator('.compartir-encabezado'))).y - yMenu)).toBeLessThan(8);
    });

    await test.step('(2) cerrado está inert y no se le puede dar foco a nada de adentro (R6.2)', async () => {
      await expect(panelCortes(page)).toHaveAttribute('inert', '');
      await expect(boton).toHaveAttribute('aria-expanded', 'false');
      const enfocable = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('#panel-cortes input');
        el?.focus();
        return document.activeElement === el;
      });
      expect(enfocable).toBe(false);
    });

    await test.step('(3) sin cortes los controles están habilitados y no hay texto (R2.3)', async () => {
      await comprobarHabilitados(page);
      await comprobarSinNotas(page);
    });

    await test.step('(4) abrir quita el inert y el foco entra en el cajón (R6.2)', async () => {
      await boton.click();
      await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
      await expect(boton).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(focoEnCajon).toBe(true);
    });

    // Estado donde un fallo de Escape se vería (LESSONS 2026-10-13): planos movidos y uno invertido.
    let guardado!: Estado['cortes'];
    await test.step('(5) un plano activo, con otro movido e invertido', async () => {
      await interruptor(page, 'coronal', 'Coronal').check();
      await accion(page, 'setCorte', 'coronal', { activo: true, mm: -8 });
      await accion(page, 'setCorte', 'axial', { activo: true, mm: -1, invertido: true });
      guardado = (await estado(page)).cortes;
      expect(guardado.coronal).toEqual({ activo: true, mm: -8, invertido: false });
      expect(guardado.axial).toEqual({ activo: true, mm: -1, invertido: true });
    });

    await test.step('(6) cajón, dock, brújula y ficha no se intersecan y el cajón cabe en la pantalla (R6.3)', async () => {
      await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
      const cajas = {
        cajon: await caja(panelCortes(page)),
        dock: await caja(dock(page)),
        brujula: await caja(brujula(page)),
        ficha: await caja(ficha(page)),
      };
      const nombres = Object.keys(cajas) as (keyof typeof cajas)[];
      let pares = 0;
      for (let i = 0; i < nombres.length; i++) {
        for (let j = i + 1; j < nombres.length; j++) {
          pares++;
          expect(seIntersecan(cajas[nombres[i]!], cajas[nombres[j]!]), `${nombres[i]} y ${nombres[j]} no se intersecan`).toBe(false);
        }
      }
      expect(pares).toBe(6);
      const c = cajas.cajon;
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(390);
      expect(c.y + c.height).toBeLessThanOrEqual(844);
      expect(cajas.ficha.height).toBeGreaterThan(0);
    });

    await test.step('(7) con un plano activo los tres controles están deshabilitados y se dice por qué (R2.3)', async () => {
      await expect(page.getByTestId('explosion')).toBeDisabled();
      await expect(page.getByTestId('reensamblar')).toBeDisabled();
      await expect(separar(page)).toBeDisabled();
      await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
      await expect(page.getByTestId('explosion-bloqueada')).toHaveText(TEXTO_BLOQUEADO);
      await expect(page.getByTestId('separar-bloqueado')).toBeVisible();
      await expect(page.getByTestId('separar-bloqueado')).toHaveText(TEXTO_BLOQUEADO);
    });

    await test.step('(8) Escape cierra el cajón, conserva los cortes y devuelve el foco al botón (R6.2)', async () => {
      await page.locator('[data-plano="coronal"]').getByRole('slider').focus();
      await page.keyboard.press('Escape');
      await expect(panelCortes(page)).toHaveAttribute('inert', '');
      await page.waitForTimeout(300);
      expect((await estado(page)).cortes).toEqual(guardado);
      await expect(boton).toBeFocused();
    });

    await test.step('(9) el cajón de cortes y el de Estructuras se excluyen (D1)', async () => {
      await boton.click();
      await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
      await page.locator('.boton-menu').click();
      await expect(panelCortes(page)).toHaveAttribute('inert', '');
      await expect(page.locator('.app.menu-abierto')).toHaveCount(1);
      await boton.click();
      await expect(page.locator('.app.menu-abierto')).toHaveCount(0);
      await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
    });

    await test.step('(10) Quitar cortes habilita de nuevo los controles y la nota desaparece (R2.3)', async () => {
      await panelCortes(page).getByRole('button', { name: 'Quitar cortes' }).click();
      await comprobarHabilitados(page);
      await expect(page.getByTestId('explosion-bloqueada')).toHaveCount(0);
      await expect(page.getByTestId('separar-bloqueado')).toHaveCount(0);
    });
  });

  test('sin modelo el botón Cortes del encabezado está deshabilitado, también cuando la carga falla (R6.6)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
    let soltar!: () => void;
    const retenido = new Promise<void>((resolver) => (soltar = resolver));
    await page.route('**/modelos/atlas.glb', async (ruta) => {
      await retenido;
      await ruta.abort();
    });
    await page.goto('/es', { waitUntil: 'domcontentloaded' });
    // Mientras carga: deshabilitado y el cajón sigue inerte.
    await expect(botonMovil(page)).toBeDisabled();
    await expect(panelCortes(page)).toHaveAttribute('inert', '');
    soltar();
    await expect(page.getByTestId('visor-error')).toBeVisible();
    await expect(botonMovil(page)).toBeDisabled();
  });
});

test('en escritorio el panel de cortes no tapa dock, brújula ni ficha, y los controles se bloquean con cortes', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es/talamo');

  await test.step('(1) sin cortes los controles están habilitados y no hay texto (R2.3)', async () => {
    await comprobarHabilitados(page);
    await comprobarSinNotas(page);
  });

  await test.step('(2) con un plano activo el panel no se interseca con dock, brújula ni ficha (R6.3)', async () => {
    await botonRiel(page).click();
    await expect(panelCortes(page)).toBeVisible();
    await interruptor(page, 'coronal', 'Coronal').check();
    await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
    const panel = await caja(panelCortes(page));
    for (const [nombre, otro] of [
      ['dock', dock(page)],
      ['brújula', brujula(page)],
      ['ficha', ficha(page)],
    ] as const) {
      expect(seIntersecan(panel, await caja(otro)), `el panel y ${nombre} no se intersecan`).toBe(false);
    }
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(1280);
    expect(panel.y + panel.height).toBeLessThanOrEqual(720);
  });

  await test.step('(3) con un plano activo los controles están deshabilitados y se dice por qué (R2.3)', async () => {
    await expect(page.getByTestId('explosion')).toBeDisabled();
    await expect(page.getByTestId('reensamblar')).toBeDisabled();
    await expect(separar(page)).toBeDisabled();
    await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
    await expect(page.getByTestId('explosion-bloqueada')).toHaveText(TEXTO_BLOQUEADO);
    await expect(page.getByTestId('separar-bloqueado')).toBeVisible();
    await expect(page.getByTestId('separar-bloqueado')).toHaveText(TEXTO_BLOQUEADO);
    await expect(page.getByTestId('explosion')).toHaveAccessibleDescription(TEXTO_BLOQUEADO);
    await expect(separar(page)).toHaveAccessibleDescription(TEXTO_BLOQUEADO);
  });

  await test.step('(4) Quitar cortes habilita de nuevo los controles y la nota desaparece (R2.3)', async () => {
    await panelCortes(page).getByRole('button', { name: 'Quitar cortes' }).click();
    await comprobarHabilitados(page);
    await expect(page.getByTestId('explosion-bloqueada')).toHaveCount(0);
    await expect(page.getByTestId('separar-bloqueado')).toHaveCount(0);
  });
});
