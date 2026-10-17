import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Flujos de usuario de F8 (planos de corte), de punta a punta, uno por caso de docs/specs/01-cutting-planes/test-plan.md.
// Cada acción del usuario se hace desde la interfaz; el store y los ganchos DEV (`__atlas`, `__cortes`, `__puntoCorte`,
// `__camara`) solo se leen, o dan el punto de pantalla de una cara del corte y mueven la cámara.

type Plano = 'sagital' | 'coronal' | 'axial';
interface CorteEstado {
  activo: boolean;
  mm: number;
  invertido: boolean;
}
type Estado = Record<string, (...a: unknown[]) => void> & {
  cajas: Record<string, [number[], number[]]>;
  cortes: Record<Plano, CorteEstado>;
  fantasmaCorte: boolean;
  explosion: number;
  base: Record<string, number[]>;
  separadas: Record<string, number[]>;
  inventario: boolean;
  seleccion: { entrada: string | null; pieza: string | null };
};
interface VentanaFlujos {
  __atlas: { getState(): Estado };
  __cortes: { planosDe(p: string): number; fantasmas(): string[]; cajasMundo(): Record<string, number[]>; rellenos(p?: string): number };
  __puntoCorte(p: string, lado?: 'corte' | 'oculto'): { x: number; y: number } | null;
  __recorte: () => number | null;
  __camara: { leer: (() => number[]) | null; desfase: (() => number) | null; pedidosAplicados: number };
}

// Copias de los ayudantes de los demás cortes-*.spec.ts: cada archivo de pruebas es independiente.
async function abrir(page: Page, ruta: string, opciones: { sinTransiciones?: boolean } = {}) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // El navegador de la prueba no tiene GPU y da pocos cuadros por segundo: sin esto el vigilante (R8.2) apagaría el relleno que se mira.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  // Sin transiciones: las cajas no se miden a mitad de la animación del cajón.
  if (opciones.sinTransiciones) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

/** Sin modelo: la petición del GLB se aborta y el visor muestra su error. */
async function abrirSinModelo(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
}

const cortes = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as VentanaFlujos).__atlas.getState().cortes)) as Record<Plano, CorteEstado>);
/** Lo que mueve la explosión: el nivel y los desplazamientos por pieza (en el estado, no en la pantalla). */
const explosionEstado = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as VentanaFlujos).__atlas.getState();
    return { explosion: s.explosion, base: Object.keys(s.base).length, separadas: Object.keys(s.separadas).length, inventario: s.inventario };
  });
const seleccion = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__atlas.getState().seleccion);
const fantasmaCorte = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__atlas.getState().fantasmaCorte);
const planosDe = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaFlujos).__cortes.planosDe(p), pieza);
const fantasmas = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__cortes.fantasmas());
const cajasMundo = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as VentanaFlujos).__cortes.cajasMundo()));
const puntoCorte = (page: Page, pieza: string, lado?: 'corte' | 'oculto') =>
  page.evaluate(([p, l]) => (window as unknown as VentanaFlujos).__puntoCorte(p as string, l as 'corte' | 'oculto' | undefined), [pieza, lado] as const);
/** Llama una acción del store (solo para mover la cámara: el resto lo hace el usuario desde la interfaz). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaFlujos).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__camara.leer?.() ?? []);
const desfaseCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__camara.desfase?.() ?? Infinity);
const pedidosAplicados = (page: Page) => page.evaluate(() => (window as unknown as VentanaFlujos).__camara.pedidosAplicados);
async function camaraQuieta(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await leerCamara(page);
        await page.waitForTimeout(400);
        const b = await leerCamara(page);
        return a.length !== 6 || b.length !== 6 ? Infinity : Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(1e-4);
  // Con pocos cuadros por segundo el destino ya es el final pero la cámara que dibuja y que usan los rayos sigue en camino.
  await expect.poll(() => desfaseCamara(page)).toBeLessThan(1e-4);
}

/** Mira la pieza de frente (o desde el lado, para el lado oculto) y devuelve el punto de pantalla pedido. */
async function apuntar(page: Page, pieza: string, lado?: 'corte' | 'oculto') {
  const antes = await pedidosAplicados(page);
  await accion(page, 'pedirCamara', { vista: lado === 'oculto' ? 'lateral-izq' : 'anterior', encuadrar: [pieza] });
  // El visor aplica el pedido en el siguiente render: antes de eso el destino que se lee es el del pedido anterior.
  await expect.poll(() => pedidosAplicados(page)).toBeGreaterThan(antes);
  await camaraQuieta(page);
  let p: { x: number; y: number } | null = null;
  await expect.poll(async () => (p = await puntoCorte(page, pieza, lado)) !== null).toBe(true);
  // El punto cae sobre el lienzo (no sobre un panel ni sobre la ficha): si no, el clic no probaría nada.
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [p!.x, p!.y])).toBe('CANVAS');
  return p!;
}

/** Deja pasar unos cuadros de la página para que un clic ya haya sido atendido antes de leer que no pasó nada. */
const cuadros = (page: Page, n = 5) =>
  page.evaluate((veces) => new Promise<void>((ok) => { let i = 0; const paso = () => (++i >= veces ? ok() : requestAnimationFrame(paso)); requestAnimationFrame(paso); }), n);

// Oráculos de solo lectura, independientes del código bajo prueba.
const leer = <T>(ruta: string) => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const nodos = leer<{ nodos: Record<string, { tipo: string; hijos?: string[]; estructura?: string }> }>('src/data/arbol.json').nodos;
const estructuras = leer<{ estructuras: Record<string, { nombre: { es: string } }> }>('src/data/estructuras.json').estructuras;
const ladoIzquierdo = leer<{ lado: { izquierdo: string } }>('src/i18n/es.json').lado.izquierdo;
const piezasBajo = (id: string): string[] => (nodos[id]?.tipo === 'pieza' ? [id] : (nodos[id]?.hijos ?? []).flatMap(piezasBajo));
const nombreEs = (pieza: string) => `${estructuras[nodos[pieza]!.estructura!]!.nombre.es} (${ladoIzquierdo})`;
const EJE: Record<Plano, number> = { sagital: 0, axial: 1, coronal: 2 };

/** Centro del encéfalo y qué piezas cruza un plano a `mm` del centro, con las cajas del store. */
async function geometria(page: Page) {
  const cajas = await page.evaluate(() => (window as unknown as VentanaFlujos).__atlas.getState().cajas);
  const encefalo = piezasBajo('g-brain').filter((p) => cajas[p]);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of encefalo) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, cajas[p]![0][i]!);
      hi[i] = Math.max(hi[i]!, cajas[p]![1][i]!);
    }
  }
  const centro = [0, 1, 2].map((i) => (lo[i]! + hi[i]!) / 2);
  const cruza = (p: string, plano: Plano, mm: number) => {
    const e = EJE[plano];
    const nivel = centro[e]! + mm / 1000;
    return cajas[p]![0][e]! < nivel && nivel < cajas[p]![1][e]!;
  };
  const centroDe = (p: string, plano: Plano) => (cajas[p]![0][EJE[plano]]! + cajas[p]![1][EJE[plano]]!) / 2;
  return { encefalo, centro, cruza, centroDe };
}

const botonRiel = (page: Page, nombre = 'Cortes') => page.locator('.riel').getByRole('button', { name: nombre, exact: true });
const botonMovil = (page: Page) => page.locator('.encabezado').getByRole('button', { name: 'Cortes', exact: true });
const panelCortes = (page: Page) => page.locator('#panel-cortes');
const fila = (page: Page, plano: Plano) => page.locator(`[data-plano="${plano}"]`);
const NOMBRE_PLANO: Record<Plano, string> = { sagital: 'Sagital', coronal: 'Coronal', axial: 'Axial' };
const interruptor = (page: Page, plano: Plano) => fila(page, plano).getByRole('checkbox', { name: NOMBRE_PLANO[plano], exact: true });
const deslizador = (page: Page, plano: Plano) => fila(page, plano).getByRole('slider');
const invertir = (page: Page, plano: Plano) => fila(page, plano).getByRole('button', { name: /Invertir/ });
const fantasmaInterruptor = (page: Page) => panelCortes(page).getByRole('checkbox', { name: 'Fantasma', exact: true });
const quitarCortes = (page: Page) => panelCortes(page).getByRole('button', { name: 'Quitar cortes' });
const ficha = (page: Page) => page.getByTestId('ficha');
const separar = (page: Page) => ficha(page).getByRole('button', { name: 'Separar', exact: true });
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

test.describe('escritorio (1280 x 800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // ───────────────────────── F1: cortar el cerebro desde el panel ─────────────────────────
  test.describe('F1: cortar el cerebro desde el panel', () => {
    test('F1-H: panel con tres planos, aviso, flechas en mm con dirección y Quitar cortes deja el cerebro entero (R1.1, R1.5, R1.8, R1.9, R6.1, R6.4)', async ({ page }) => {
      test.setTimeout(240_000);
      await abrir(page, '/es');
      const g = await geometria(page);
      const enElCorte = g.encefalo.find((p) => g.cruza(p, 'coronal', 2))!;
      expect(enElCorte).toBeDefined();
      expect(await planosDe(page, enElCorte)).toBe(0);

      await botonRiel(page).click();
      await expect(panelCortes(page)).toBeVisible();

      // Exactamente tres filas, cada una con interruptor y deslizador, más Invertir, Fantasma y Quitar cortes.
      const filas = page.locator('#panel-cortes [data-plano]');
      await expect(filas).toHaveCount(3);
      expect(await filas.evaluateAll((els) => els.map((e) => e.getAttribute('data-plano')))).toEqual(['sagital', 'coronal', 'axial']);
      for (const plano of ['sagital', 'coronal', 'axial'] as const) {
        await expect(fila(page, plano).getByRole('checkbox')).toHaveCount(1);
        await expect(fila(page, plano).getByRole('slider')).toHaveCount(1);
        await expect(interruptor(page, plano)).not.toBeChecked();
        await expect(invertir(page, plano)).toHaveCount(1);
      }
      await expect(fantasmaInterruptor(page)).toBeVisible();
      await expect(quitarCortes(page)).toBeVisible();
      const aviso = page.getByTestId('cortes-aviso');
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText('un solo cuerpo');
      await expect(aviso).toContainText('no reemplazan un atlas de neuroimagen');

      // Activa coronal y axial y mueve el coronal con dos flechas a la derecha: sube 2 mm.
      await interruptor(page, 'coronal').check();
      await interruptor(page, 'axial').check();
      await expect(deslizador(page, 'coronal')).toHaveValue('0');
      await expect(deslizador(page, 'coronal')).toHaveAttribute('aria-valuetext', 'en el centro');
      await deslizador(page, 'coronal').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(deslizador(page, 'coronal')).toHaveValue('2');
      await expect(deslizador(page, 'coronal')).toHaveAttribute('aria-valuetext', '2 mm anterior');
      await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('2 mm anterior');
      // El otro plano activo no se movió y el sagital sigue apagado.
      await expect(deslizador(page, 'axial')).toHaveValue('0');
      expect(await cortes(page)).toEqual({
        sagital: { activo: false, mm: 0, invertido: false },
        coronal: { activo: true, mm: 2, invertido: false },
        axial: { activo: true, mm: 0, invertido: false },
      });
      // El corte llegó a la pieza que el plano cruza.
      await expect.poll(() => planosDe(page, enElCorte)).toBe(3);

      await quitarCortes(page).click();
      for (const plano of ['sagital', 'coronal', 'axial'] as const) await expect(interruptor(page, plano)).not.toBeChecked();
      expect(Object.values(await cortes(page)).map((c) => c.activo)).toEqual([false, false, false]);
      // El cerebro se ve entero: la pieza ya no lleva planos ni hay fantasmas.
      await expect.poll(() => planosDe(page, enElCorte)).toBe(0);
      await expect.poll(() => fantasmas(page)).toEqual([]);
    });

    test('F1-E1: Escape cierra el panel y no quita los cortes (R6.5)', async ({ page }) => {
      test.setTimeout(240_000);
      await abrir(page, '/es');
      const g = await geometria(page);
      const enElCorte = g.encefalo.find((p) => g.cruza(p, 'coronal', 0))!;
      expect(enElCorte).toBeDefined();

      await botonRiel(page).click();
      await expect(panelCortes(page)).toBeVisible();
      await interruptor(page, 'coronal').check();
      await expect.poll(() => planosDe(page, enElCorte)).toBe(3);

      await page.keyboard.press('Escape');
      await expect(panelCortes(page)).toHaveCount(0);
      await expect(botonRiel(page)).toHaveAttribute('aria-expanded', 'false');
      // El plano sigue activo: el corte se sigue viendo...
      expect((await cortes(page)).coronal.activo).toBe(true);
      expect(await planosDe(page, enElCorte)).toBe(3);
      // ...y al reabrir el panel su interruptor está encendido.
      await botonRiel(page).click();
      await expect(panelCortes(page)).toBeVisible();
      await expect(interruptor(page, 'coronal')).toBeChecked();
      await expect(interruptor(page, 'sagital')).not.toBeChecked();
    });

    test('F1-E2: sin modelo el botón Cortes está deshabilitado y el árbol, la búsqueda y las fichas siguen (R6.6)', async ({ page }) => {
      await abrirSinModelo(page, '/es');
      await expect(botonRiel(page)).toBeDisabled();
      await expect(panelCortes(page)).toHaveCount(0);

      // El árbol responde: abrir un grupo muestra sus hijos.
      await botonRiel(page, 'Estructuras').click();
      const arbol = page.getByRole('navigation', { name: 'Árbol de estructuras' });
      await expect(arbol).toBeVisible();
      const antes = await arbol.getByRole('checkbox').count();
      await arbol.getByRole('button', { name: 'Abrir Cerebro', exact: true }).click();
      await expect(arbol.getByRole('button', { name: 'Cerrar Cerebro', exact: true })).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => arbol.getByRole('checkbox').count()).toBeGreaterThan(antes);

      // La búsqueda lleva a la ficha.
      await botonRiel(page, 'Buscar').click();
      await page.getByRole('combobox', { name: /Buscar/ }).fill('hipocampo');
      await page.getByRole('combobox', { name: /Buscar/ }).press('Enter');
      await expect(page.locator('#ficha-titulo')).toHaveText('Hipocampo');
      await expect(ficha(page)).toBeVisible();
      await expect(page).toHaveURL(/\/es\/hipocampo$/);

      // Y los cortes siguen sin poder abrirse.
      await expect(botonRiel(page)).toBeDisabled();
      await expect(panelCortes(page)).toHaveCount(0);
    });
  });

  // ───────────────────────── F2: el corte se hace sobre el cerebro armado ─────────────────────────
  test.describe('F2: el corte se hace sobre el cerebro armado', () => {
    test('F2-H: al activar un plano el cerebro se rearma y los controles de explosión quedan bloqueados con su motivo (R2.2, R2.3)', async ({ page }) => {
      test.setTimeout(240_000);
      await abrir(page, '/es/talamo');
      await expect(ficha(page)).toBeVisible();
      const armado = await cajasMundo(page);
      expect(await explosionEstado(page)).toEqual({ explosion: 0, base: 0, separadas: 0, inventario: false });

      // Se separan las piezas con la explosión (estado donde un fallo se vería).
      await page.getByTestId('explosion').fill('40');
      await expect.poll(() => explosionEstado(page).then((e) => e.explosion)).toBe(0.4);
      expect((await explosionEstado(page)).base).toBeGreaterThan(0);
      await expect.poll(async () => (await cajasMundo(page)) !== armado).toBe(true);
      await expect(page.getByTestId('explosion')).toBeEnabled();
      await expect(page.getByTestId('reensamblar')).toBeEnabled();
      await expect(separar(page)).toBeEnabled();
      expect(await page.getByTestId('explosion-bloqueada').count()).toBe(0);

      await botonRiel(page).click();
      await interruptor(page, 'coronal').check();

      // El cerebro vuelve a quedar armado: explosión en 0 %, sin desplazamientos y cada pieza en su sitio.
      await expect(page.getByTestId('explosion')).toHaveValue('0');
      await expect.poll(() => explosionEstado(page)).toEqual({ explosion: 0, base: 0, separadas: 0, inventario: false });
      await expect.poll(async () => (await cajasMundo(page)) === armado).toBe(true);
      // Los tres controles se deshabilitan y se dice por qué.
      await expect(page.getByTestId('explosion')).toBeDisabled();
      await expect(page.getByTestId('reensamblar')).toBeDisabled();
      await expect(separar(page)).toBeDisabled();
      await expect(page.getByTestId('explosion-bloqueada')).toHaveText(TEXTO_BLOQUEADO);
      await expect(page.getByTestId('separar-bloqueado')).toHaveText(TEXTO_BLOQUEADO);
    });

    test('F2-E1: al quitar el último plano todo vuelve a habilitarse y el texto desaparece (R2.4, R1.8)', async ({ page }) => {
      test.setTimeout(240_000);
      await abrir(page, '/es/talamo');
      await botonRiel(page).click();
      await interruptor(page, 'coronal').check();
      // Con el plano activo hay bloqueo (control positivo: sin esto la vuelta a habilitado sería vacía).
      await expect(page.getByTestId('explosion')).toBeDisabled();
      await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
      await expect(page.getByTestId('separar-bloqueado')).toBeVisible();

      await interruptor(page, 'coronal').uncheck();
      expect(Object.values(await cortes(page)).some((c) => c.activo)).toBe(false);
      await expect(page.getByTestId('explosion')).toBeEnabled();
      await expect(page.getByTestId('reensamblar')).toBeEnabled();
      await expect(separar(page)).toBeEnabled();
      await expect(page.getByTestId('explosion-bloqueada')).toHaveCount(0);
      await expect(page.getByTestId('separar-bloqueado')).toHaveCount(0);
      // Y la explosión vuelve a responder.
      await page.getByTestId('explosion').fill('30');
      await expect.poll(() => explosionEstado(page).then((e) => e.explosion)).toBe(0.3);
    });

    test('F2-E2: el vago no se corta y su recorrido sigue con el corte axial activo (R9.1)', async ({ page }) => {
      test.setTimeout(240_000);
      await abrir(page, '/es/nervio-vago-x');
      const g = await geometria(page);
      const enElCorte = g.encefalo.find((p) => g.cruza(p, 'axial', 0))!;
      expect(enElCorte).toBeDefined();

      await botonRiel(page).click();
      await interruptor(page, 'axial').check();
      await expect.poll(() => planosDe(page, enElCorte)).toBe(3);
      // El vago lleva solo su propio plano del recorrido (1), nunca los del corte (3).
      expect(await planosDe(page, 'vagus-nerve-x-r')).toBe(1);

      await page.getByTestId('iniciar-recorrido').click();
      const panel = page.getByTestId('recorrido');
      const altura = () => page.evaluate(() => (window as unknown as VentanaFlujos).__recorte());
      // El plano del recorrido llega al nivel de la parada y queda quieto.
      const esperarEstable = async () => {
        let anterior = Number.NaN;
        await expect
          .poll(
            async () => {
              const a = await altura();
              const quieto = a !== null && Math.abs(a - anterior) < 1e-4;
              anterior = a ?? Number.NaN;
              return quieto;
            },
            { timeout: 30_000 },
          )
          .toBe(true);
        return anterior;
      };
      const niveles: number[] = [];
      for (const n of [1, 2, 3]) {
        if (n > 1) await page.getByTestId('recorrido-siguiente').click();
        await expect(panel).toContainText(`Parada ${n} de 4`);
        if (n > 1) await expect.poll(async () => (await altura()) ?? Infinity, { timeout: 30_000 }).toBeLessThan(niveles.at(-1)! - 0.005);
        niveles.push(await esperarEstable());
        // El nervio se revela con su plano del recorrido, sin los del corte, y el corte del cerebro sigue activo.
        expect(await planosDe(page, 'vagus-nerve-x-r'), `parada ${n}: vago`).toBe(1);
        expect((await cortes(page)).axial.activo, `parada ${n}: corte`).toBe(true);
        expect(await planosDe(page, enElCorte), `parada ${n}: cerebro`).toBe(3);
      }
      expect(niveles[1]!).toBeLessThan(niveles[0]!);
      expect(niveles[2]!).toBeLessThan(niveles[1]!);
    });
  });

  // ───────────────────────── F3: reconocer las estructuras en la cara del corte ─────────────────────────
  test.describe('F3: reconocer las estructuras en la cara del corte', () => {
    /** Abre `/es`, activa el coronal desde el panel a la altura del tálamo izquierdo y cierra el panel con Escape. */
    async function cortarEnElTalamo(page: Page) {
      await abrir(page, '/es');
      const g = await geometria(page);
      const mm = Math.round((g.centroDe('thalamus-l', 'coronal') - g.centro[EJE.coronal]!) * 1000);
      for (const p of ['thalamus-l', 'caudate-nucleus-l', 'lateral-ventricle-l']) expect(g.cruza(p, 'coronal', mm), p).toBe(true);
      await botonRiel(page).click();
      await interruptor(page, 'coronal').check();
      await deslizador(page, 'coronal').fill(String(mm));
      await expect(page.getByTestId('etiqueta-corte-coronal')).toContainText(`${Math.abs(mm)} mm`);
      expect((await cortes(page)).coronal).toEqual({ activo: true, mm, invertido: false });
      await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(3);
      await page.keyboard.press('Escape');
      await expect(panelCortes(page)).toHaveCount(0);
      return mm;
    }

    test('F3-H: el cursor sobre la cara del corte da el nombre de la estructura y tocar el tálamo abre su ficha (R3.5, R4.1, R4.2)', async ({ page }) => {
      test.setTimeout(240_000);
      await cortarEnElTalamo(page);
      expect((await seleccion(page)).pieza).toBeNull();
      await expect(ficha(page)).toHaveCount(0);

      for (const pieza of ['thalamus-l', 'lateral-ventricle-l', 'caudate-nucleus-l']) {
        const { x, y } = await apuntar(page, pieza);
        await page.mouse.move(x, y, { steps: 5 });
        await expect(page.locator('.etiqueta-3d'), pieza).toHaveText(nombreEs(pieza));
      }
      expect(nombreEs('thalamus-l')).toBe('Tálamo (izquierdo)');

      const { x, y } = await apuntar(page, 'thalamus-l');
      await page.mouse.move(x, y, { steps: 5 });
      await expect(page.locator('.etiqueta-3d')).toHaveText('Tálamo (izquierdo)');
      await page.mouse.click(x, y);
      await expect.poll(async () => (await seleccion(page)).pieza).toBe('thalamus-l');
      await expect(ficha(page)).toHaveAttribute('data-entrada', 'thalamus');
      await expect(page.locator('#ficha-titulo')).toHaveText(nombreEs('thalamus-l'));
    });

    test('F3-E1: tocar del lado oculto del plano no selecciona nada y no abre ficha (R4.3)', async ({ page }) => {
      test.setTimeout(240_000);
      await cortarEnElTalamo(page);
      expect(await fantasmaCorte(page)).toBe(false);
      expect(await fantasmas(page)).toEqual([]);

      const oculto = await apuntar(page, 'thalamus-l', 'oculto');
      await page.mouse.click(oculto.x, oculto.y);
      await cuadros(page);
      const s = await seleccion(page);
      expect(s.entrada).toBeNull();
      expect(s.pieza).toBeNull();
      expect(await ficha(page).count()).toBe(0);
      expect(new URL(page.url()).pathname).toBe('/es');

      // Control positivo: con la misma cámara de frente, tocar la cara del corte sí selecciona (el clic llega al visor).
      const corte = await apuntar(page, 'thalamus-l');
      await page.mouse.click(corte.x, corte.y);
      await expect.poll(async () => (await seleccion(page)).pieza).toBe('thalamus-l');
      await expect(ficha(page)).toBeVisible();
    });

    test('F3-E2: el fantasma dibuja el lado cortado translúcido pero no se toca (R5.2, R5.3)', async ({ page }) => {
      test.setTimeout(240_000);
      await cortarEnElTalamo(page);
      expect(await fantasmas(page)).toEqual([]);

      await botonRiel(page).click();
      await fantasmaInterruptor(page).check();
      await expect(fantasmaInterruptor(page)).toBeChecked();
      expect(await fantasmaCorte(page)).toBe(true);
      // El lado cortado se dibuja (translúcido) como fantasma de las piezas que quedan del lado oculto.
      await expect.poll(() => fantasmas(page)).toContain('thalamus-l');
      await page.keyboard.press('Escape');
      await expect(panelCortes(page)).toHaveCount(0);

      const oculto = await apuntar(page, 'thalamus-l', 'oculto');
      await page.mouse.click(oculto.x, oculto.y);
      await cuadros(page);
      const s = await seleccion(page);
      expect(s.entrada).toBeNull();
      expect(s.pieza).toBeNull();
      expect(await ficha(page).count()).toBe(0);

      // Control positivo: la cara del corte, con el fantasma activo, sí se toca.
      const corte = await apuntar(page, 'thalamus-l');
      await page.mouse.click(corte.x, corte.y);
      await expect.poll(async () => (await seleccion(page)).pieza).toBe('thalamus-l');
    });
  });

  // ───────────────────────── F4: compartir un corte por enlace ─────────────────────────
  test.describe('F4: compartir un corte por enlace', () => {
    test('F4-H: el enlace con corte= activa los planos y Compartir da un enlace con los mismos (R7.1, R7.2)', async ({ page, context }) => {
      test.setTimeout(240_000);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await abrir(page, '/es?corte=coronal:12,axial:-8:inv');

      // Lo dice el panel: coronal en 12 mm, axial en -8 mm invertido, sagital apagado.
      await botonRiel(page).click();
      await expect(panelCortes(page)).toBeVisible();
      await expect(interruptor(page, 'coronal')).toBeChecked();
      await expect(deslizador(page, 'coronal')).toHaveValue('12');
      await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('12 mm anterior');
      await expect(invertir(page, 'coronal')).toHaveAttribute('aria-pressed', 'false');
      await expect(interruptor(page, 'axial')).toBeChecked();
      await expect(deslizador(page, 'axial')).toHaveValue('-8');
      await expect(page.getByTestId('etiqueta-corte-axial')).toHaveText('8 mm inferior');
      await expect(invertir(page, 'axial')).toHaveAttribute('aria-pressed', 'true');
      await expect(interruptor(page, 'sagital')).not.toBeChecked();
      expect(await cortes(page)).toEqual({
        sagital: { activo: false, mm: 0, invertido: false },
        coronal: { activo: true, mm: 12, invertido: false },
        axial: { activo: true, mm: -8, invertido: true },
      });

      await page.locator('.encabezado').getByRole('button', { name: /^Compartir/ }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Enlace copiado.' })).toBeVisible();
      const texto = await page.evaluate(() => navigator.clipboard.readText());
      const url = new URL(texto);
      expect(url.pathname.endsWith('/es')).toBe(true);
      expect(url.searchParams.get('corte')).toBe('coronal:12,axial:-8:inv');
    });

    test('F4-E1: una entrada mal escrita o fuera de rango se ignora sola y las válidas se aplican (R7.3)', async ({ page }) => {
      test.setTimeout(240_000);
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`));
      await abrir(page, '/es?corte=coronal:12,oblicuo:3,axial:9999');

      // "287 piezas" se pinta justo antes de que se apliquen los planos: se espera con poll.
      await expect
        .poll(() => cortes(page))
        .toEqual({
          sagital: { activo: false, mm: 0, invertido: false },
          coronal: { activo: true, mm: 12, invertido: false },
          axial: { activo: false, mm: 0, invertido: false },
        });
      await botonRiel(page).click();
      await expect(interruptor(page, 'coronal')).toBeChecked();
      await expect(deslizador(page, 'coronal')).toHaveValue('12');
      await expect(page.getByTestId('etiqueta-corte-coronal')).toHaveText('12 mm anterior');
      await expect(interruptor(page, 'axial')).not.toBeChecked();
      await expect(interruptor(page, 'sagital')).not.toBeChecked();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(errores).toEqual([]);
    });

    test('F4-E2: con explosión en el enlace, el cerebro queda armado con los cortes (R7.4)', async ({ page }) => {
      test.setTimeout(240_000);
      // Control: sin corte, el mismo nivel de explosión sí se aplica (si no, el 0 de abajo no probaría nada).
      await abrir(page, '/es?explosion=40');
      await expect.poll(() => explosionEstado(page).then((e) => e.explosion)).toBe(0.4);
      expect((await explosionEstado(page)).base).toBeGreaterThan(0);

      await page.goto('/es?corte=coronal:0&explosion=40');
      await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
      await expect.poll(async () => (await cortes(page)).coronal).toEqual({ activo: true, mm: 0, invertido: false });
      await expect(page.getByTestId('explosion')).toHaveValue('0');
      await expect(page.getByTestId('explosion')).toBeDisabled();
      expect(await explosionEstado(page)).toEqual({ explosion: 0, base: 0, separadas: 0, inventario: false });
      await expect(page.getByTestId('explosion-bloqueada')).toHaveText(TEXTO_BLOQUEADO);
    });
  });
});

// ───────────────────────── F5: cortes en el celular ─────────────────────────
test.describe('F5: cortes en el celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('F5-H: los cortes abren como cajón inferior que cabe en la pantalla y no tapa dock, brújula ni ficha (R6.2, R6.3)', async ({ page }) => {
    test.setTimeout(240_000);
    await abrir(page, '/es', { sinTransiciones: true });
    await expect(page.locator('.riel')).toBeHidden();
    await expect(panelCortes(page)).toHaveAttribute('inert', '');
    await botonMovil(page).click();
    await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
    await expect(botonMovil(page)).toHaveAttribute('aria-expanded', 'true');
    await interruptor(page, 'coronal').check();
    expect((await cortes(page)).coronal.activo).toBe(true);

    // Abre la ficha de una pieza con la búsqueda, con el plano activo y el cajón abierto.
    await page.locator('.boton-buscar').click();
    await page.getByRole('combobox', { name: /Buscar/ }).fill('talamo');
    await page.getByRole('combobox', { name: /Buscar/ }).press('Enter');
    await expect(page.locator('#ficha-titulo')).toHaveText('Tálamo');
    await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
    await expect(panelCortes(page)).not.toHaveAttribute('inert', '');

    const cajas = {
      cajon: await caja(panelCortes(page)),
      dock: await caja(page.getByRole('toolbar', { name: 'Fragmentar y reensamblar' })),
      brujula: await caja(page.getByRole('toolbar', { name: 'Vistas anatómicas' })),
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
    // Cajón inferior: ocupa el ancho, queda en la mitad de abajo y cabe en la pantalla.
    const c = cajas.cajon;
    expect(c.width).toBe(390);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
    expect(c.y).toBeGreaterThan(844 / 2);
    expect(c.y + c.height).toBeLessThanOrEqual(844);
    expect(cajas.ficha.height).toBeGreaterThan(0);
  });

  test('F5-E1: Escape cierra el cajón y el plano sigue activo (R6.5)', async ({ page }) => {
    test.setTimeout(240_000);
    await abrir(page, '/es', { sinTransiciones: true });
    const g = await geometria(page);
    const enElCorte = g.encefalo.find((p) => g.cruza(p, 'coronal', 0))!;
    expect(enElCorte).toBeDefined();

    await botonMovil(page).click();
    await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
    await interruptor(page, 'coronal').check();
    await expect.poll(() => planosDe(page, enElCorte)).toBe(3);

    await page.keyboard.press('Escape');
    await expect(panelCortes(page)).toHaveAttribute('inert', '');
    await expect(botonMovil(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(botonMovil(page)).toBeFocused();
    expect((await cortes(page)).coronal.activo).toBe(true);
    expect(await planosDe(page, enElCorte)).toBe(3);
    // Al reabrir, el interruptor sigue encendido.
    await botonMovil(page).click();
    await expect(panelCortes(page)).not.toHaveAttribute('inert', '');
    await expect(interruptor(page, 'coronal')).toBeChecked();
  });

  test('F5-E2: sin modelo el botón de cortes del encabezado está deshabilitado (R6.6)', async ({ page }) => {
    await abrirSinModelo(page, '/es');
    await expect(page.locator('.riel')).toBeHidden();
    await expect(botonMovil(page)).toBeVisible();
    await expect(botonMovil(page)).toBeDisabled();
    await expect(panelCortes(page)).toHaveAttribute('inert', '');
    await expect(botonMovil(page)).toHaveAttribute('aria-expanded', 'false');
  });
});
