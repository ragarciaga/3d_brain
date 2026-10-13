import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function abrir(page: Page, ruta: string, conAviso = false) {
  if (!conAviso) await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

interface Punto {
  x: number;
  y: number;
}

interface VentanaAtlas {
  __atlas: {
    getState(): {
      aislar: { modo: string } | null;
      seleccion: { entrada: string | null; pieza: string | null };
      pedirCamara(p: { encuadrar: string[] }): void;
      base: Record<string, number[]>;
      separadas: Record<string, number[]>;
      devueltas: Set<string>;
      ocultas: Set<string>;
      recorrido: number | null;
      rutas: unknown[];
      soloEscaneada: boolean;
      setExplosion(f: number): void;
      armando: { modo: string; total: string[] } | null;
      devolver(piezas: string[]): void;
    };
  };
  __recorte: () => number | null;
  __camara: {
    objetivoEnPantalla: (() => Punto) | null;
    leer: (() => number[]) | null;
    piezaEnPantalla: ((pieza: string) => { casa: Punto; actual: Punto } | null) | null;
  };
}

const aislarActual = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().aislar?.modo ?? null);

/** Altura (px del lienzo) a la que la cámara tiene puesto el objetivo; -1 si el visor aún no la da. */
const objetivoY = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaAtlas).__camara.objetivoEnPantalla?.()?.y ?? -1);

/** Posición y objetivo de la cámara: [px, py, pz, tx, ty, tz]; vacío si el visor aún no la da. */
const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__camara.leer?.() ?? []);

/** Distancia de la cámara a su objetivo y la dirección (unitaria) desde la que mira. */
async function vistaDeCamara(page: Page) {
  const c = await leerCamara(page);
  if (c.length !== 6) return { distancia: -1, direccion: [0, 0, 0] };
  const v = [c[0]! - c[3]!, c[1]! - c[4]!, c[2]! - c[5]!];
  const distancia = Math.hypot(v[0]!, v[1]!, v[2]!);
  return { distancia, direccion: v.map((x) => x / distancia) };
}

/** Abre la paleta de búsqueda (Ctrl+K) y devuelve el campo. */
async function campoBusqueda(page: Page) {
  const campo = page.getByRole('combobox', { name: /Buscar|Search/ });
  if (!(await campo.isVisible())) await page.keyboard.press('Control+k');
  await expect(campo).toBeVisible();
  return campo;
}

/** Abre el cajón de estructuras (riel en pantallas anchas, botón del encabezado en celular). */
async function abrirCajon(page: Page) {
  // Por el estado, no por si se ve: al cerrarse, el cajón sigue visible 0,2 s mientras se desliza.
  if (await page.locator('.app.menu-abierto').count()) return;
  const riel = page.locator('.riel').getByRole('button', { name: 'Estructuras' });
  if (await riel.isVisible()) await riel.click();
  else await page.locator('.boton-menu').click();
  await expect(page.locator('#panel-izq')).toBeVisible();
}

/** Entra en modo revisión y cierra la guía, que se abre sola la primera vez con cada código. */
async function entrarRevision(page: Page, codigo = 'PRUEBA01') {
  await abrir(page, `/es/revision?r=${codigo}`);
  await modeloCargado(page);
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

/** Espera a que la cámara deje de moverse: dos lecturas separadas 400 ms que no difieren. */
async function camaraQuieta(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await leerCamara(page);
        await page.waitForTimeout(400);
        const b = await leerCamara(page);
        if (a.length !== 6 || b.length !== 6) return Infinity;
        return Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(1e-4);
}

/**
 * Dónde está una pieza (`actual`) y dónde va (`casa`), en coordenadas de la página. Se espera a que dos
 * lecturas separadas 300 ms coincidan: si la barra o la ficha cambian de alto, el lienzo cambia de tamaño un instante
 * después, y una posición leída antes de eso cae en otro punto.
 */
async function enPantalla(page: Page, pieza: string): Promise<{ casa: Punto; actual: Punto }> {
  const leer = async () => {
    const r = await page.evaluate((p) => (window as unknown as VentanaAtlas).__camara.piezaEnPantalla?.(p) ?? null, pieza);
    const caja = await page.getByTestId('visor').locator('canvas').boundingBox();
    if (!r || !caja) return null;
    const aPagina = (p: Punto) => ({ x: caja.x + p.x, y: caja.y + p.y });
    return { casa: aPagina(r.casa), actual: aPagina(r.actual) };
  };
  let ultima: Awaited<ReturnType<typeof leer>> = null;
  await expect
    .poll(
      async () => {
        const antes = await leer();
        await page.waitForTimeout(300);
        const despues = await leer();
        ultima = despues;
        if (!antes || !despues) return Infinity;
        return Math.max(Math.abs(antes.actual.x - despues.actual.x), Math.abs(antes.actual.y - despues.actual.y));
      },
      { message: `la posición en pantalla de ${pieza} se estabiliza`, timeout: 30_000 },
    )
    .toBeLessThan(0.5);
  return ultima!;
}

const piezaSeleccionada = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().seleccion.pieza);
const clavesSeparadas = (page: Page) =>
  page.evaluate(() => Object.keys((window as unknown as VentanaAtlas).__atlas.getState().separadas).sort());

/**
 * Tálamo aislado, explosión al 70 % (el máximo de la radial; después empieza el inventario, que pone
 * las dos mitades juntas en el centro) y vista anterior con la cámara quieta: quedan separadas y a la vista.
 */
async function prepararTalamos(page: Page) {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  await page.getByTestId('ficha').getByRole('button', { name: 'Aislar', exact: true }).click();
  await page.getByTestId('explosion').fill('70');
  await page.waitForTimeout(2500);
  await page.locator('[data-vista="anterior"]').click();
  await camaraQuieta(page);
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

test('con red lenta se ve el aviso de carga, el modelo carga y la página no lanza errores', async ({ page, context }) => {
  // Antes, el aviso era un <Html> de drei dentro del lienzo y al desmontarse lanzaba removeChild.
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: 1e6 });
  await abrir(page, '/es');
  await expect(page.getByTestId('cargando')).toBeVisible();
  await modeloCargado(page);
  await expect(page.getByTestId('cargando')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('modo estudio: el cerebro ocupa todo, el riel abre el cajón y la paleta, y la ficha sale al elegir', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const ancho = async () => (await page.getByTestId('visor').locator('canvas').boundingBox())!.width;
  const pantalla = page.viewportSize()!.width;
  // Sin estructura elegida no hay ficha ni cajón: el visor ocupa casi todo el ancho.
  await expect(page.locator('#panel-izq')).toBeHidden();
  await expect(page.getByTestId('ficha')).toHaveCount(0);
  expect(await ancho()).toBeGreaterThan(pantalla * 0.85);
  // El riel abre el cajón; el mismo botón lo cierra; tocar el modelo también.
  const estructuras = page.locator('.riel').getByRole('button', { name: 'Estructuras' });
  await estructuras.click();
  await expect(page.locator('#panel-izq')).toBeVisible();
  await expect(estructuras).toHaveAttribute('aria-expanded', 'true');
  await estructuras.click();
  await expect(page.locator('#panel-izq')).toBeHidden();
  await estructuras.click();
  const visor = (await page.getByTestId('visor').boundingBox())!;
  await page.getByTestId('visor').click({ position: { x: visor.width - 260, y: 150 } }); // lejos del cajón y del dock
  await expect(page.locator('#panel-izq')).toBeHidden();
  // "Buscar" del riel abre la paleta; elegir un resultado la cierra y abre la ficha a la izquierda.
  await page.locator('.riel').getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Buscar una estructura' })).toHaveCount(0);
  await expect(page.getByTestId('ficha')).toBeVisible();
  const ficha = (await page.getByTestId('ficha').boundingBox())!;
  const lienzo = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
  expect(ficha.x).toBeLessThan(lienzo.x);
  // La explosión es vertical, al lado derecho del visor.
  const dock = (await page.getByRole('toolbar', { name: 'Fragmentar y reensamblar' }).boundingBox())!;
  expect(dock.height).toBeGreaterThan(dock.width);
  expect(dock.x).toBeGreaterThan(lienzo.x + lienzo.width / 2);
  // ...y no se cruza con la brújula de vistas, que va abajo a la derecha.
  const brujula = (await page.getByRole('toolbar', { name: 'Vistas anatómicas' }).boundingBox())!;
  expect(dock.y + dock.height).toBeLessThan(brujula.y);
});

test('con ?medir=1 sale el panel de medición con tiempos reales, se copia el informe y se cierra (issue 6)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Sin el parámetro no aparece.
  await abrir(page, '/es');
  await expect(page.getByTestId('panel-medicion')).toHaveCount(0);
  await abrir(page, '/es?medir=1');
  const panel = page.getByTestId('panel-medicion');
  await expect(panel).toBeVisible();
  await modeloCargado(page);
  await expect(page.getByTestId('medicion-modelo')).toHaveText(/\d+ ms/);
  await expect(page.getByTestId('medicion-codigo')).toHaveText(/\d+ ms/);
  await expect(page.getByTestId('medicion-primer-cuadro')).toHaveText(/\d+ ms/);
  await expect(page.getByTestId('medicion-cuello')).toHaveText(/Lo más lento fue/);
  // Sigue al navegar dentro de la app.
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo/);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Copiar resultados' }).click();
  await expect(panel.getByRole('button', { name: 'Copiado' })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toContain('Maysa Brain, medición de carga');
  expect(copiado).toMatch(/Modelo 3D: empezó a los \d+ ms/);
  // Cerrar lo quita también al recargar.
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('panel-medicion')).toHaveCount(0);
});

test('el botón de tema pasa de claro a oscuro y la elección se conserva al recargar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await abrir(page, '/es');
  const tema = () => page.evaluate(() => document.documentElement.dataset.tema);
  await expect.poll(tema).toBe('claro');
  const boton = page.getByTestId('boton-tema');
  await expect(boton).toHaveAccessibleName('Cambiar a tema oscuro');
  await boton.click();
  await expect.poll(tema).toBe('oscuro');
  await expect(boton).toHaveAccessibleName('Cambiar a tema claro');
  await page.reload();
  await expect.poll(tema).toBe('oscuro');
});

test('la interfaz en inglés no muestra textos en español', async ({ page }) => {
  await abrir(page, '/en', true);
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await modeloCargado(page);
  await expect(page.locator('footer')).toContainText('Educational use.');
  await expect(page.getByRole('button', { name: 'Reassemble' })).toBeVisible();
});

test('la pantalla de licencia abierta directo respeta el idioma de la URL', async ({ page }) => {
  await abrir(page, '/en/licencia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sources and license');
  await expect(page.getByRole('link', { name: 'Back to the atlas' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await abrir(page, '/es/licencia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fuentes y licencia');
  await expect(page.getByRole('link', { name: 'Volver al atlas' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('búsqueda bilingüe: con la interfaz en español, "amygdala" abre la amígdala', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await (await campoBusqueda(page)).fill('amygdala');
  await expect(page.getByRole('option').first()).toContainText('Cuerpo amigdaloide');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/cuerpo-amigdaloide$/);
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'amygdaloid-body');
  await (await campoBusqueda(page)).fill('neumogastrico');
  await expect(page.getByRole('option').first()).toContainText('Nervio vago');
});

test('la ficha trae búsquedas de artículos científicos', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  const articulos = page.getByTestId('articulos');
  await expect(articulos.getByRole('heading', { name: 'Artículos científicos' })).toBeVisible();
  const pubmed = articulos.locator('a[data-base="pubmed"]');
  await expect(pubmed).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/?term=%22hippocampus%22&filter=pubt.review');
  await expect(pubmed).toHaveAttribute('target', '_blank');
  await expect(articulos.locator('a[data-base="scielo"]')).toHaveAttribute('href', /search\.scielo\.org\/\?q=%22hipocampo%22/);
  await expect(articulos.getByRole('link')).toHaveCount(4);
  // El lóbulo grácil, la última ficha escrita, también trae las búsquedas.
  await abrir(page, '/es/lobulo-gracil');
  await expect(page.getByTestId('ficha')).not.toContainText('Ficha en preparación.');
  await expect(page.getByTestId('articulos').locator('a[data-base="pubmed"]')).toHaveAttribute('href', /gracile%20lobule/);
  // Una parcela sin término oficial lo dice en lugar de "pendiente".
  await abrir(page, '/es/paracentral-gyrus-and-sulcus');
  await expect(page.getByTestId('ficha')).toContainText('Sin término oficial en latín');
});

test('URL por estructura e idioma: cambiar de idioma conserva la estructura', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await modeloCargado(page);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  // El idioma activo se ve relleno, siempre en el mismo orden (ES, EN); ya no hay "Ambos idiomas".
  const segmentos = page.locator('.selector-idioma > *');
  await expect(page.getByRole('navigation', { name: 'Idioma' })).toBeVisible();
  await expect(segmentos).toHaveText(['ES', 'EN']);
  await expect(page.getByTestId('idioma-actual')).toHaveText('ES');
  await expect(page.getByTestId('idioma-actual')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Ambos idiomas')).toHaveCount(0);
  const fondo = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await fondo(page.getByTestId('idioma-actual'))).not.toBe(await fondo(page.getByTestId('cambiar-idioma')));
  await page.getByTestId('cambiar-idioma').click();
  await expect(page).toHaveURL(/\/en\/hippocampus$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hippocampus');
  await expect(page.getByTestId('idioma-actual')).toHaveText('EN');
  await expect(segmentos).toHaveText(['ES', 'EN']);
});

test('árbol y grupos: ocultar un grupo y filtrar el sistema límbico', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const encefalo = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') });
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await abrirCajon(page);
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).not.toHaveText('253/253');
  await abrirCajon(page);
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await abrirCajon(page);
  await encefalo.getByRole('checkbox').uncheck();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('0/253');
});

test('"Mostrar todo" deshace piezas ocultas, aislamiento y grupo activo, y solo aparece si hay algo que deshacer', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  const encefalo = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') });
  const mostrarTodo = page.getByTestId('mostrar-todo');
  await expect(mostrarTodo).toHaveCount(0);
  // Grupo de estudio activo.
  await abrirCajon(page);
  await page.locator('[data-grupo="sistema-limbico"]').click();
  await expect(encefalo.locator('.arbol-contador')).not.toHaveText('253/253');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  await expect(page.locator('[data-grupo="sistema-limbico"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(mostrarTodo).toHaveCount(0);
  // Piezas ocultas a mano.
  await abrirCajon(page);
  await encefalo.getByRole('checkbox').uncheck();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('0/253');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect(encefalo.locator('.arbol-contador')).toHaveText('253/253');
  // Aislamiento.
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await expect(mostrarTodo).toBeVisible();
  await mostrarTodo.click();
  await expect.poll(() => aislarActual(page)).toBeNull();
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
  // "Armar pieza por pieza" salió del alcance (docs/v2.md): la barra ya no lo ofrece.
  await expect(page.getByRole('button', { name: 'Armar pieza por pieza' })).toHaveCount(0);
  await page.getByTestId('reensamblar').click();
  await expect.poll(desplazadas).toBe(0);
});

test('a 70 % la cámara se aleja sin girar, a 100 % mira el inventario de frente y al reensamblar vuelve', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await expect.poll(async () => (await vistaDeCamara(page)).distancia).toBeGreaterThan(0);
  const inicial = await vistaDeCamara(page);
  await page.getByTestId('explosion').fill('70');
  await expect
    .poll(
      async () => {
        const v = await vistaDeCamara(page);
        const punto = v.direccion.reduce((a, x, i) => a + x * inicial.direccion[i]!, 0);
        return v.distancia > 2 * inicial.distancia && punto > 0.99;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  // Las piezas profundas también salen del núcleo.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const b = (window as unknown as VentanaAtlas).__atlas.getState().base['thalamus-l'] ?? [0, 0, 0];
        return Math.hypot(b[0]!, b[1]!, b[2]!);
      }),
    )
    .toBeGreaterThanOrEqual(0.05);
  // Inventario: la cámara pasa a la vista anterior (+Z) y se aleja para que entren todas las piezas.
  await page.getByTestId('explosion').fill('100');
  await expect
    .poll(
      async () => {
        const v = await vistaDeCamara(page);
        return v.direccion[2]! > 0.99 && v.distancia > 2 * inicial.distancia;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.getByTestId('reensamblar').click();
  await expect
    .poll(async () => Math.abs((await vistaDeCamara(page)).distancia - inicial.distancia) / inicial.distancia, { timeout: 20_000 })
    .toBeLessThan(0.05);
});

test('modo revisión: el docente marca campos y el contador sube', async ({ page }) => {
  await entrarRevision(page);
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await page.locator('[data-campo="ubicacion.es"]').getByRole('button', { name: 'Correcto' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('button', { name: 'Corregir' }).click();
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).fill('Propuesta de prueba');
  await page.locator('[data-campo="que_es.es"]').getByRole('textbox', { name: 'Cambio propuesto' }).blur();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  // El texto propuesto no pasa a otra estructura.
  await (await campoBusqueda(page)).fill('tálamo');
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
  // Un toque en el visor no mueve el foco a la ficha (solo la búsqueda, el árbol y las relaciones).
  await expect(page.locator('#ficha-titulo')).not.toBeFocused();
});

test('elegir de nuevo la misma estructura después de deseleccionar vuelve a abrir la ficha', async ({ page }) => {
  await abrir(page, '/es');
  await modeloCargado(page);
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
});

test('volver al inicio desde una estructura (marca o atrás) deja el modo fantasma', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await page.getByRole('link', { name: 'Maysa Brain' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('ficha')).toHaveCount(0);
  await expect.poll(() => aislarActual(page)).toBeNull();
  // Con el botón atrás del navegador pasa lo mismo.
  await (await campoBusqueda(page)).fill('tálamo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/talamo$/);
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  await page.goBack();
  await expect(page).toHaveURL(/\/es$/);
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('Escape en la paleta de búsqueda solo la cierra; fuera de ella sale del aislamiento', async ({ page }) => {
  await abrir(page, '/es/hipocampo');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect.poll(() => aislarActual(page)).toBe('contexto');
  const campo = await campoBusqueda(page);
  await expect(campo).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(campo).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await aislarActual(page)).toBe('contexto');
  await page.keyboard.press('Escape');
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('elegir desde la búsqueda o una relación lleva el foco al título de la ficha', async ({ page }) => {
  await abrir(page, '/es');
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  const titulo = page.locator('#ficha-titulo');
  await expect(titulo).toHaveText('Hipocampo');
  await expect(titulo).toBeFocused();
  // Por una relación de la ficha.
  const relacion = page.locator('.relaciones a').first();
  const destino = (await relacion.textContent())!.trim();
  await relacion.click();
  await expect(titulo).toHaveText(new RegExp(destino.split(' (')[0]!));
  await expect(titulo).toBeFocused();
});

test('elegir un nodo del árbol lleva el foco al título de la ficha', async ({ page }) => {
  await abrir(page, '/es');
  const titulo = page.locator('#ficha-titulo');
  await expect(titulo).toHaveCount(0);
  await abrirCajon(page);
  await page.locator('[data-nodo="g-brain"]').click();
  await expect(titulo).toBeVisible();
  await expect(titulo).toBeFocused();
});

test('ruta desconocida: aviso traducido con enlace al inicio; mayúsculas en el slug se aceptan', async ({ page }) => {
  await abrir(page, '/es/no-existe');
  const aviso = page.getByTestId('no-encontrada');
  await expect(aviso).toContainText('No encontramos esa estructura');
  await aviso.getByRole('link', { name: 'Volver al atlas' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByTestId('no-encontrada')).toHaveCount(0);
  await abrir(page, '/en/no-existe');
  await expect(page.getByTestId('no-encontrada')).toContainText('We could not find that structure');
  await abrir(page, '/es/HIPOCAMPO');
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(page.getByTestId('no-encontrada')).toHaveCount(0);
});

test('marcadores: la fuente de ubicación sale en el idioma de la interfaz y cada marcador tiene su slug', async ({ page }) => {
  await abrir(page, '/en/periaqueductal-grey');
  await expect(page.locator('#ficha-titulo')).toHaveText('Periaqueductal grey');
  await expect(page.getByTestId('ficha')).toContainText('surrounds the cerebral aqueduct of the midbrain');
  await expect(page.getByTestId('ficha')).not.toContainText('rodea');
  await expect(page.getByTestId('ficha')).toContainText('Name source: TA2');
  await abrir(page, '/es/sustancia-gris-periacueductal');
  await expect(page.getByTestId('ficha')).toContainText('rodea el acueducto del mesencéfalo');
  await abrir(page, '/es/area-de-wernicke');
  await expect(page.locator('#ficha-titulo')).toHaveText('Área de Wernicke');
  await abrir(page, '/en/wernickes-area');
  await expect(page.getByTestId('ficha')).toContainText('Gyrus temporalis superior, pars posterior');
  await expect(page.getByTestId('ficha')).toContainText('Name source: Latín: Terminologia Neuroanatomica');
});

test('el grupo del vago y la estructura del vago se distinguen en la búsqueda y en la URL', async ({ page }) => {
  await abrir(page, '/es');
  await (await campoBusqueda(page)).fill('nervio vago');
  const nombres = await page.locator('[role="option"] .res-nombre').allTextContents();
  expect(nombres.length).toBeGreaterThan(1);
  expect(new Set(nombres).size).toBe(nombres.length);
  expect(nombres).toContain('Nervio vago (ambos lados)');
  await abrir(page, '/es/nervio-vago-ambos-lados');
  await expect(page.locator('#ficha-titulo')).toHaveText('Nervio vago (ambos lados)');
  await expect(page.getByTestId('ficha')).toContainText('Fuente del nombre: interfaz');
});

test('si el modelo no carga, el árbol, la búsqueda y las fichas siguen y se puede reintentar', async ({ page }) => {
  await page.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  await abrir(page, '/es');
  const error = page.getByTestId('visor-error');
  await expect(error).toContainText('No se pudo mostrar el modelo 3D');
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
  await abrirCajon(page);
  await expect(page.getByRole('navigation', { name: 'Árbol de estructuras' })).toBeVisible();
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(error).toBeVisible();
  // Reintentar vuelve a pedir el modelo (ya sin bloqueo) y monta el visor sin errores de React (#16).
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.unroute('**/modelos/atlas.glb');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await modeloCargado(page);
  await expect(page.getByTestId('visor-error')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('si WebGL falla, solo el visor muestra el error: el árbol y la búsqueda siguen y no sale la página global', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
      if (tipo === 'webgl2' || tipo === 'webgl' || tipo === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await abrir(page, '/es');
  const error = page.getByTestId('visor-error');
  await expect(error).toContainText('No se pudo mostrar el modelo 3D');
  await expect(error.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
  await abrirCajon(page);
  await expect(page.getByRole('navigation', { name: 'Árbol de estructuras' })).toBeVisible();
  await (await campoBusqueda(page)).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
  await expect(error).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
});

test('en escritorio el objetivo del encuadre queda en el centro del visor', async ({ page }) => {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  const alto = (await page.getByTestId('visor').locator('canvas').boundingBox())!.height;
  await expect.poll(async () => Math.abs((await objetivoY(page)) - alto / 2), { timeout: 20_000 }).toBeLessThan(3);
});

test.describe('celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la estructura elegida queda sobre la hoja de la ficha y al cerrarla vuelve al centro', async ({ page }) => {
    await abrir(page, '/es/talamo');
    await modeloCargado(page);
    const lienzo = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
    const hoja = (await page.getByTestId('ficha').boundingBox())!;
    const visible = hoja.y - lienzo.y; // parte del lienzo que la hoja no tapa
    expect(visible).toBeGreaterThan(100);
    expect(visible).toBeLessThan(lienzo.height - 100);
    await expect.poll(async () => Math.abs((await objetivoY(page)) - visible / 2), { timeout: 20_000 }).toBeLessThan(3);
    await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(page.getByTestId('ficha')).toHaveCount(0);
    await expect.poll(async () => Math.abs((await objetivoY(page)) - lienzo.height / 2), { timeout: 20_000 }).toBeLessThan(3);
  });

  test('"Compartir" está en el encabezado del celular', async ({ page }) => {
    await abrir(page, '/es');
    const compartir = page.locator('.compartir-encabezado');
    await expect(compartir).toBeVisible();
    await expect(compartir).toHaveAccessibleName('Compartir');
    // El encabezado cabe en una sola línea: el último botón queda a la altura del primero.
    const arriba = async (l: Locator) => (await l.boundingBox())!.y;
    expect(Math.abs((await arriba(compartir)) - (await arriba(page.locator('.boton-menu'))))).toBeLessThan(8);
    await compartir.click();
    await expect(page.locator('.mensaje')).toBeVisible();
  });

  test('en celular no hay riel: el cajón se abre desde "Estructuras" y la búsqueda desde la lupa', async ({ page }) => {
    await abrir(page, '/es');
    await expect(page.locator('.riel')).toBeHidden();
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('combobox', { name: /Buscar/ })).toBeFocused();
  });

  test('el cajón de estructuras cerrado no se enfoca; abre con foco dentro, se cierra con Escape o al elegir', async ({ page }) => {
    await abrir(page, '/es');
    const panel = page.locator('#panel-izq');
    const menu = page.getByRole('button', { name: 'Estructuras', exact: true });
    const focoEnPanel = () => page.evaluate(() => !!document.activeElement?.closest('#panel-izq'));
    // Cerrado: inerte, no se puede enfocar nada de adentro.
    await expect(panel).toHaveAttribute('inert', '');
    const enfocable = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#panel-izq button');
      el?.focus();
      return document.activeElement === el;
    });
    expect(enfocable).toBe(false);
    // Abrir: el foco entra.
    await menu.click();
    await expect(panel).not.toHaveAttribute('inert', '');
    await expect.poll(focoEnPanel).toBe(true);
    // Escape cierra y devuelve el foco al botón.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(menu).toBeFocused();
    // Elegir un grupo de estudio cierra.
    await menu.click();
    await abrirCajon(page);
    await page.locator('[data-grupo="sistema-limbico"]').click();
    await expect(panel).toHaveAttribute('inert', '');
    // ...y el foco vuelve al botón "Estructuras", no a BODY.
    await expect(menu).toBeFocused();
    // Elegir un elemento del árbol cierra.
    await menu.click();
    await page.locator('[data-nodo="g-brain"]').click();
    await expect(panel).toHaveAttribute('inert', '');
    await expect(page.getByTestId('ficha')).toBeVisible();
    // Elegir un resultado de la búsqueda cierra el cajón abierto.
    await menu.click();
    await expect(panel).not.toHaveAttribute('inert', '');
    await (await campoBusqueda(page)).fill('hipocampo');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(page).toHaveURL(/\/es\/hipocampo$/);
  });
});

test('modo revisión: "Proponer posición" acepta un toque sobre un órgano de referencia', async ({ page }) => {
  await entrarRevision(page);
  await (await campoBusqueda(page)).fill('sustancia gris periacueductal');
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText('Sustancia gris periacueductal');
  await page.getByRole('button', { name: 'Proponer posición' }).click();
  await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toBeVisible();
  // El estómago es un órgano de referencia: se encuadra y se toca en el centro del visor.
  await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().pedirCamara({ encuadrar: ['stomach'] }));
  await page.waitForTimeout(2500);
  const caja = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toHaveCount(0);
});

/** El botón se alterna: `aria-pressed` y la clase dicen si está activo (true), parcial (mixed) o apagado (false). */
async function esperarPulsado(boton: Locator, estado: 'true' | 'false' | 'mixed') {
  await expect(boton).toHaveAttribute('aria-pressed', estado);
  if (estado === 'true') await expect(boton).toHaveClass(/\bactivo\b/);
  else if (estado === 'mixed') await expect(boton).toHaveClass(/\bparcial\b/);
  if (estado !== 'true') await expect(boton).not.toHaveClass(/\bactivo\b/);
  if (estado !== 'mixed') await expect(boton).not.toHaveClass(/\bparcial\b/);
}

test('los botones Aislar, Aislar con contexto y Separar se activan con un toque y se desactivan con otro', async ({ page }) => {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  const ficha = page.getByTestId('ficha');
  const aislar = ficha.getByRole('button', { name: 'Aislar', exact: true });
  const contexto = ficha.getByRole('button', { name: 'Aislar con contexto', exact: true });
  const separar = ficha.getByRole('button', { name: 'Separar', exact: true });
  // 1. Abrir una estructura la deja en "aislar con contexto".
  await esperarPulsado(contexto, 'true');
  await esperarPulsado(aislar, 'false');
  // 2. Aislar solo cambia de modo: contexto se apaga.
  await aislar.click();
  await esperarPulsado(aislar, 'true');
  await esperarPulsado(contexto, 'false');
  expect(await aislarActual(page)).toBe('solo');
  // 3. Un segundo toque sale del aislamiento.
  await aislar.click();
  await esperarPulsado(aislar, 'false');
  expect(await aislarActual(page)).toBeNull();
  // Lo mismo con contexto.
  await contexto.click();
  await esperarPulsado(contexto, 'true');
  await contexto.click();
  await esperarPulsado(contexto, 'false');
  expect(await aislarActual(page)).toBeNull();
  // 4. Escape (con el foco en un botón) apaga Aislar.
  await aislar.click();
  await esperarPulsado(aislar, 'true');
  await page.keyboard.press('Escape');
  await esperarPulsado(aislar, 'false');
  expect(await aislarActual(page)).toBeNull();
  // 5. "Mostrar todo" también.
  await aislar.click();
  await esperarPulsado(aislar, 'true');
  await page.getByTestId('mostrar-todo').click();
  await esperarPulsado(aislar, 'false');
  expect(await aislarActual(page)).toBeNull();
  // 6 y 7. Separar se activa y se desactiva; apagarlo devuelve las piezas.
  await esperarPulsado(separar, 'false');
  await separar.click();
  await esperarPulsado(separar, 'true');
  expect(await clavesSeparadas(page)).toEqual(['thalamus-l', 'thalamus-r']);
  await separar.click();
  await esperarPulsado(separar, 'false');
  expect(await clavesSeparadas(page)).toEqual([]);
  // 8 y 9. Si solo una de las dos está separada, el botón es parcial y un toque completa.
  await separar.click();
  await esperarPulsado(separar, 'true');
  await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().devolver(['thalamus-l']));
  await esperarPulsado(separar, 'mixed');
  await separar.click();
  await esperarPulsado(separar, 'true');
  expect(await clavesSeparadas(page)).toEqual(['thalamus-l', 'thalamus-r']);
  // 10. La ficha ya no tiene "Devolver".
  await expect(page.getByRole('button', { name: 'Devolver', exact: true })).toHaveCount(0);
  // 11. El ◎ del árbol se alterna con "solo" sobre las piezas del nodo.
  const arbolAislar = page.locator('.arbol-fila', { has: page.locator('[data-nodo="g-brain"]') }).locator('.arbol-aislar');
  await esperarPulsado(arbolAislar, 'false');
  await abrirCajon(page);
  await arbolAislar.click();
  await esperarPulsado(arbolAislar, 'true');
  expect(await aislarActual(page)).toBe('solo');
  await abrirCajon(page);
  await arbolAislar.click();
  await esperarPulsado(arbolAislar, 'false');
  expect(await aislarActual(page)).toBeNull();
});

test('Ocultar desde la ficha esconde la estructura y un segundo toque la vuelve a mostrar', async ({ page }) => {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  const ocultar = page.getByTestId('ficha').getByRole('button', { name: 'Ocultar', exact: true });
  const ocultas = () =>
    page.evaluate(() => [...(window as unknown as VentanaAtlas).__atlas.getState().ocultas].filter((p) => p.startsWith('thalamus')).sort());
  await esperarPulsado(ocultar, 'false');
  await ocultar.click();
  await esperarPulsado(ocultar, 'true');
  expect(await ocultas()).toEqual(['thalamus-l', 'thalamus-r']);
  await ocultar.click();
  await esperarPulsado(ocultar, 'false');
  expect(await ocultas()).toEqual([]);
});

test('el vago no se separa: su ficha ofrece el recorrido, que baja parada por parada y se termina (ADR 0009)', async ({ page }) => {
  await abrir(page, '/es/nervio-vago-x');
  await modeloCargado(page);
  const ficha = page.getByTestId('ficha');
  await expect(ficha.getByRole('button', { name: 'Separar', exact: true })).toHaveCount(0);
  // La explosión no mueve el vago.
  await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().setExplosion(0.5));
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().base['vagus-nerve-x-r'] ?? null)).toBeNull();
  await page.getByTestId('iniciar-recorrido').click();
  const panel = page.getByTestId('recorrido');
  await expect(page.getByTestId('ficha')).toHaveCount(0); // la ficha se cierra para ver el nervio
  await expect(panel).toContainText('Parada 1 de 4');
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Nace en el bulbo raquídeo');
  const altura = () => page.evaluate(() => (window as unknown as VentanaAtlas).__recorte());
  // El plano llega al nivel de la parada (animado) y en cada parada siguiente queda más abajo.
  const esperarEstable = async () => {
    let anterior = Number.NaN;
    await expect
      .poll(async () => {
        const a = await altura();
        const quieto = a !== null && Math.abs(a - anterior) < 1e-4;
        anterior = a ?? Number.NaN;
        return quieto;
      }, { timeout: 30_000 })
      .toBe(true);
    return anterior;
  };
  const niveles = [await esperarEstable()];
  for (const n of [2, 3, 4]) {
    await page.getByTestId('recorrido-siguiente').click();
    await expect(panel).toContainText(`Parada ${n} de 4`);
    // A 2 cuadros/s dos lecturas seguidas pueden coincidir antes de que el plano empiece a bajar.
    const previo = niveles.at(-1)!;
    await expect.poll(async () => (await altura()) ?? Infinity, { timeout: 30_000 }).toBeLessThan(previo - 0.005);
    niveles.push(await esperarEstable());
  }
  for (let i = 1; i < niveles.length; i++) expect(niveles[i]!).toBeLessThan(niveles[i - 1]!);
  // Un ramo de la parada abre su ficha sin cortar el recorrido.
  await panel.getByText(/Ramos y estructuras de esta parada/).click();
  await panel.getByRole('button', { name: 'Tronco vagal anterior', exact: true }).click();
  await expect(page.locator('#ficha-titulo')).toHaveText('Tronco vagal anterior');
  await expect(panel).toContainText('Parada 4 de 4');
  await page.getByTestId('recorrido-siguiente').click(); // Terminar
  await expect(panel).toHaveCount(0);
  await expect.poll(altura).toBeNull();
});

test('rutas trazadas del vago: todos las ven con aviso, leyenda y estado; el revisor además las juzga (ADR 0009)', async ({ page }) => {
  const rutas = readFileSync('tests/fixtures/vago-sintetico/puntos.json', 'utf8');
  await page.route('**/modelos/rutas-vago.json', (r) => r.fulfill({ contentType: 'application/json', body: rutas }));
  // Sin modo revisión: se ven como en el lanzamiento, con su estado, pero sin botones para responder.
  await abrir(page, '/es/nervio-laringeo-recurrente');
  await modeloCargado(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().rutas.length)).toBe(3);
  await expect(page.getByTestId('leyenda-origen')).toBeVisible();
  await expect(page.getByTestId('aviso-aproximada')).toBeVisible();
  for (const lado of ['derecho', 'izquierdo']) {
    await expect(page.getByTestId(`ruta-trazado_${lado}`)).toContainText('Pendiente de revisión docente');
    await expect(page.locator(`[data-campo="trazado_${lado}"]`)).toHaveCount(0);
  }
  // En modo revisión: un campo por lado para responder.
  await entrarRevision(page);
  await abrir(page, '/es/nervio-laringeo-recurrente');
  for (const lado of ['derecho', 'izquierdo']) {
    await expect(page.locator(`[data-campo="trazado_${lado}"]`).getByRole('button', { name: 'Correcto' })).toBeVisible();
  }
  await page.locator('[data-campo="trazado_izquierdo"]').getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  // El filtro "Solo geometría escaneada" las esconde.
  await page.getByTestId('leyenda-origen').getByRole('checkbox').check();
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().soloEscaneada)).toBe(true);
});

test('el docente ve la guía al entrar, "Qué revisar" pone las dudas primero y la duda está en la ficha (F24)', async ({ page }) => {
  await abrir(page, '/es/revision?r=GUIA01');
  await modeloCargado(page);
  // La primera vez, la guía se abre sola, con el enlace al registro.
  const guia = page.getByTestId('como-revisar');
  await expect(guia).toBeVisible();
  await expect(guia.getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveAttribute('href', /docs\.google\.com\/forms/);
  await guia.getByRole('button', { name: 'Cerrar' }).click();
  await expect(guia).toHaveCount(0);
  // "Qué revisar": primero las dudas abiertas.
  await page.getByRole('button', { name: /Qué revisar/ }).click();
  const lista = page.getByTestId('que-revisar');
  await expect(lista.locator('details').first()).toHaveAttribute('data-seccion', 'dudas');
  await lista.getByRole('button', { name: 'Lóbulo grácil' }).click();
  await expect(page.locator('#ficha-titulo')).toHaveText('Lóbulo grácil');
  // La duda está en la ficha, con su propio campo para responder.
  const duda = page.getByTestId('dudas');
  await expect(duda).toContainText('VIIB');
  await duda.locator('[data-campo="duda.0"]').getByRole('button', { name: 'Correcto' }).click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  // Ya respondida, sale de "Qué revisar".
  await page.getByRole('button', { name: /Qué revisar/ }).click();
  await expect(page.getByTestId('que-revisar').getByRole('button', { name: 'Lóbulo grácil' })).toHaveCount(0);
  // Al volver, la guía no se abre otra vez.
  await abrir(page, '/es/revision?r=GUIA01');
  await modeloCargado(page);
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
});

test('Separar desde la ficha reencuadra: las dos mitades del tálamo quedan dentro del lienzo (#19)', async ({ page }) => {
  await abrir(page, '/es/talamo');
  await modeloCargado(page);
  // Primero el encuadre de la estructura elegida (llega un instante después de cargar).
  await expect.poll(async () => (await vistaDeCamara(page)).distancia, { timeout: 20_000 }).toBeLessThan(0.2);
  await camaraQuieta(page);
  await page.getByTestId('ficha').getByRole('button', { name: 'Separar', exact: true }).click();
  // Con WebGL por software el visor dibuja pocos cuadros por segundo: dos lecturas seguidas pueden caer
  // en el mismo cuadro a mitad del reencuadre. Se espera el resultado final, no que la cámara "parezca" quieta.
  const dentro = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __camara: { piezaEnPantalla?: (p: string) => { actual: { x: number; y: number } } | null };
      };
      const lienzo = document.querySelector('[data-testid="visor"] canvas')!.getBoundingClientRect();
      return ['thalamus-l', 'thalamus-r'].every((p) => {
        const r = w.__camara.piezaEnPantalla?.(p);
        return !!r && r.actual.x > 0 && r.actual.x < lienzo.width && r.actual.y > 0 && r.actual.y < lienzo.height;
      });
    });
  await expect.poll(dentro, { timeout: 20_000 }).toBe(true);
  // Y se queda así cuando la cámara termina de moverse.
  await page.waitForTimeout(2000);
  expect(await dentro()).toBe(true);
});

test('el doble clic sobre una pieza separada la devuelve y el toque la selecciona', async ({ page }) => {
  await prepararTalamos(page);
  await page.getByTestId('reensamblar').click();
  await page.waitForTimeout(600);
  await page.getByTestId('ficha').getByRole('button', { name: 'Separar', exact: true }).click();
  await page.locator('[data-vista="anterior"]').click();
  await camaraQuieta(page);
  const sep = await enPantalla(page, 'thalamus-l');
  await page.mouse.dblclick(sep.actual.x, sep.actual.y);
  await esperarPulsado(page.getByTestId('ficha').getByRole('button', { name: 'Separar', exact: true }), 'mixed');
  expect(await piezaSeleccionada(page)).toBe('thalamus-l');
});
