// Propuestas para la sesión docente (spec 04): los marcadores siguen a su pieza al separar y armar (F1),
// el docente revisa un trazo del vago con la propuesta de la auditoría (F2) y la posición de un marcador (F3).
// Plan: docs/specs/04-teacher-review-proposals/test-plan.md. El canal de retorno se simula siempre con una ruta
// (`conCanal` + `simularCanal`); el canal real nunca se llama (`protegerCanalReal`). Lo que se prueba sale de los
// archivos de datos, no de coordenadas ni nombres escritos aquí.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { VERSION_AUTORIZACION } from '../src/config/revision';
import { claveGuiaVista } from '../src/lib/huella';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

type Vec = [number, number, number];

// ---------------------------------------------------------------------------------------------------- datos

interface DatoMarcador {
  id: string;
  ancla: string | null;
  posicion: Vec | { l: Vec; r: Vec } | null;
  estado: string;
  fuente_ubicacion: { es: string; en: string };
}
const marcadoresJson = JSON.parse(readFileSync('src/data/marcadores.json', 'utf8')) as DatoMarcador[];
const estructurasJson = (
  JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as { estructuras: Record<string, { nombre: { es: string; en: string } }> }
).estructuras;
interface DatoTrazo {
  malla: string;
  propuesta: string | null;
  fuente: string;
  confianza?: string | null;
  evidencia?: { es: string; en: string };
}
const datosTrazos = (JSON.parse(readFileSync('src/data/trazos-vago.json', 'utf8')) as { trazos: DatoTrazo[] }).trazos;

const esPar = (p: DatoMarcador['posicion']): p is { l: Vec; r: Vec } => p !== null && !Array.isArray(p);
const conAncla = marcadoresJson.filter((m) => m.ancla !== null);
const PARES = conAncla.filter((m) => esPar(m.posicion));
const UNICOS = conAncla.filter((m) => Array.isArray(m.posicion));
const SIN_POSICION = conAncla.filter((m) => m.posicion === null);

// F3: un marcador aproximado con posición y sin el aviso de desacuerdo entre fuentes (su fuente se muestra completa).
const DESACUERDO = ' Las fuentes no coinciden: ';
const GEN = marcadoresJson.find((m) => m.estado === 'aproximada' && m.posicion !== null && !m.fuente_ubicacion.es.includes(DESACUERDO))!;
const trozo = (t: string) => t.slice(0, 50);

// F2: un trazo con propuesta de un ramo de la lista (si no hay, el primero con no_es_ramo) y otro sin propuesta.
const trazosEnOrden = datosTrazos.map((t) => t.malla);
const datoDe = (malla: string) => datosTrazos.find((t) => t.malla === malla)!;
const CON = (datosTrazos.find((t) => t.propuesta !== null && t.propuesta !== 'no_es_ramo') ?? datosTrazos.find((t) => t.propuesta === 'no_es_ramo'))!.malla;
const SIN = datosTrazos.find((t) => t.propuesta === null)!.malla;
const TOTAL = trazosEnOrden.length;
const claveDe = (malla: string) => `vagus-nerve-x|trazo:${malla}|`;
const nombreEs = (id: string) => (id === 'no_es_ramo' ? 'No es un ramo (tronco o raicilla)' : estructurasJson[id]!.nombre.es);
const nombreEn = (id: string) => (id === 'no_es_ramo' ? 'Not a branch (trunk or rootlet)' : estructurasJson[id]!.nombre.en);
const CONFIANZA_ES: Record<string, string> = { alta: 'alta', media: 'media', baja: 'baja' };
const CONFIANZA_EN: Record<string, string> = { alta: 'high', media: 'medium', baja: 'low' };

// --------------------------------------------------------------------------------------------- ventana de la app

interface PuntoDibujado {
  id: string;
  lado: 'l' | 'r' | null;
  propuesta: boolean;
  pos: Vec;
}
interface VentanaPrueba {
  __atlas: {
    getState(): {
      centros: Record<string, number[]>;
      base: Record<string, number[]>;
      respuestas: Record<string, { veredicto: string; campo: string; ramo?: string; posicion?: Vec }>;
      seleccion: { entrada: string | null; malla: string | null };
      lecturaCanal: string;
      abrirTrazo(malla: string): void;
    };
  };
  __marcadores: { puntos: (() => PuntoDibujado[]) | null };
  __camara: { desfase: (() => number) | null; pedidosAplicados: number };
}

/** Lee del store de la app. `fn` se serializa: lo que necesite de este archivo entra por `arg`, no por cierre. */
const estado = <T, A = undefined>(page: Page, fn: (s: ReturnType<VentanaPrueba['__atlas']['getState']>, arg: A) => T, arg?: A) =>
  page.evaluate(`(${fn.toString()})(window.__atlas.getState(), ${JSON.stringify(arg ?? null)})`) as Promise<T>;

const puntosDibujados = (page: Page) => page.evaluate(() => (window as unknown as VentanaPrueba).__marcadores.puntos?.() ?? []);
const baseActual = (page: Page) => estado(page, (s) => s.base as Record<string, Vec>);
const centrosActuales = async (page: Page) => {
  // Las cajas y los centros se arman después de que el contador de piezas aparece: se espera a que existan.
  await expect.poll(async () => (await estado(page, (s) => Object.keys(s.centros))).length, { timeout: 60_000 }).toBeGreaterThan(100);
  return estado(page, (s) => Object.keys(s.centros));
};

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const resta = (a: readonly number[], b: readonly number[]): Vec => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const promedio = (vs: readonly (readonly number[])[]): Vec => [0, 1, 2].map((i) => vs.reduce((a, v) => a + v[i]!, 0) / vs.length) as Vec;
const TOL = 1e-4; // 0,1 mm, en metros

/** Piezas del modelo que sigue un marcador: la pieza del ancla o sus dos lados (`<ancla>-l`, `<ancla>-r`). */
function piezasDe(ancla: string, claves: string[], lado?: 'l' | 'r'): string[] {
  if (claves.includes(ancla)) return [ancla];
  return (lado ? [lado] : ['l', 'r']).map((l) => `${ancla}-${l}`).filter((p) => claves.includes(p));
}

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}
const modeloCargado = (page: Page) => expect(page.getByTestId('piezas')).toHaveText(/\d+ (piezas|pieces)/, { timeout: 150_000 });

// ------------------------------------------------------------------------------------------------ canal simulado

const URL_CANAL = 'https://canal-prueba.invalid/macros/s/e2e/exec';
const CORS = { 'access-control-allow-origin': '*' };

interface PeticionCanal {
  accion: string | null;
  cuerpo: Record<string, unknown>;
}
interface ElementoCarga {
  c: string;
  i?: string;
  d?: string;
  a?: string;
  m?: string;
  x?: unknown;
}

/** Fija la URL del canal antes de la primera carga (costura de desarrollo de src/main.tsx). */
const conCanal = (context: BrowserContext) =>
  context.addInitScript((u) => {
    (window as unknown as { __urlCanalInicial?: string }).__urlCanalInicial = u;
  }, URL_CANAL);

/** Canal del Apps Script simulado: `leer` sin respuestas, autorización vigente con el vago, `guardar` confirma cada fila. */
async function simularCanal(page: Page) {
  const peticiones: PeticionCanal[] = [];
  await page.route(
    (u) => u.hostname === 'canal-prueba.invalid',
    async (route) => {
      const pedido = route.request();
      if (pedido.method() !== 'POST') return route.abort('failed');
      const cuerpo = JSON.parse(pedido.postData() ?? '{}') as Record<string, unknown>;
      const accion = typeof cuerpo['accion'] === 'string' ? cuerpo['accion'] : null;
      peticiones.push({ accion, cuerpo });
      const json = (c: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(c) });
      if (accion === 'leer') {
        return json({ ok: true, respuestas: { v: 2, r: cuerpo['r'], e: {} }, autorizacion: { version: VERSION_AUTORIZACION, vago: true } });
      }
      if (accion === 'autorizar') return json({ ok: true });
      if (accion === 'guardar') {
        const e = (JSON.parse(String(cuerpo['carga'])) as { e: Record<string, { c: string; i?: string; f?: string }[]> }).e;
        const recibidas = Object.entries(e).flatMap(([id, els]) => els.map((el) => [id, el.c, el.i ?? '', el.f ?? ''].join('|')));
        return json({ ok: true, recibidas });
      }
      return route.abort('failed');
    },
  );
  const guardados = () =>
    peticiones
      .filter((p) => p.accion === 'guardar')
      .map((p) => (JSON.parse(String(p.cuerpo['carga'])) as { r: string; e: Record<string, ElementoCarga[]> }));
  return { peticiones, guardados };
}

/** Modo revisión con canal simulado, guía ya vista y modelo cargado. Devuelve el canal para leer lo que recibe. */
async function entrarRevision(page: Page, context: BrowserContext, codigo: string, idioma: 'es' | 'en' = 'es') {
  await context.addInitScript((c) => localStorage.setItem(c, '1'), claveGuiaVista(codigo));
  await conCanal(context);
  const canal = await simularCanal(page);
  await abrir(page, `/${idioma}/revision?r=${codigo}`);
  await expect(page.getByTestId('panel-revision')).toContainText(codigo);
  await modeloCargado(page);
  await expect.poll(() => estado(page, (s) => s.lecturaCanal)).toBe('hecha');
  return canal;
}

// ============================================================================================ F1: marcadores y piezas

test.describe('F1: los marcadores siguen a su pieza al separar y armar', () => {
  test.beforeEach(() => {
    // Los datos son la fuente: sin esto un filtro vacío haría fallar con un mensaje poco claro.
    expect(conAncla.length, 'src/data/marcadores.json trae marcadores con ancla').toBeGreaterThan(0);
  });

  async function separarAlMaximo(page: Page) {
    await page.getByTestId('explosion').fill('70');
    await expect
      .poll(async () => Math.max(...Object.values(await baseActual(page)).map((b) => Math.hypot(...b))))
      .toBeGreaterThan(0.01);
    // Espera a que el movimiento termine: dos lecturas separadas coinciden.
    await expect
      .poll(async () => {
        const a = await baseActual(page);
        await page.waitForTimeout(300);
        const b = await baseActual(page);
        return Math.max(...Object.keys(a).map((k) => dist(a[k]!, b[k]!)));
      })
      .toBeLessThan(1e-6);
  }

  test('F1-H: con las piezas separadas el marcador se desplaza lo mismo que su ancla y al armar vuelve exacto', async ({ page }) => {
    test.setTimeout(300_000);
    await abrir(page, '/es');
    await modeloCargado(page);
    const claves = await centrosActuales(page);
    // Un marcador de un solo punto: se prefiere el de una sola pieza de ancla (el desplazamiento es el de esa pieza).
    const M = UNICOS.find((m) => piezasDe(m.ancla!, claves).length === 1) ?? UNICOS[0]!;
    const original = M.posicion as Vec;
    const piezas = piezasDe(M.ancla!, claves);
    expect(piezas.length, `piezas del ancla ${M.ancla}`).toBeGreaterThan(0);

    const delMarcador = async () => (await puntosDibujados(page)).filter((p) => p.id === M.id && !p.propuesta);
    await expect.poll(async () => (await delMarcador()).length).toBe(1);
    // 1. Armado: se dibuja exactamente en la posición escrita.
    expect((await delMarcador())[0]!.pos).toEqual(original);

    // 2. Separadas: se desplaza lo mismo que su pieza ancla y no queda donde estaba.
    await separarAlMaximo(page);
    const base = await baseActual(page);
    const esperado = promedio(piezas.map((p) => base[p]!));
    expect(Math.hypot(...esperado), 'la pieza ancla sí se movió').toBeGreaterThan(1e-3);
    await expect.poll(async () => dist(resta((await delMarcador())[0]!.pos, original), esperado)).toBeLessThanOrEqual(TOL);
    expect(dist((await delMarcador())[0]!.pos, original), 'el marcador salió de su sitio original').toBeGreaterThan(1e-3);

    // 3. Reensamblar: vuelve exacto (0 mm) a la posición de los datos.
    await page.getByTestId('reensamblar').click();
    await expect.poll(async () => Object.values(await baseActual(page)).every((v) => v.every((x) => x === 0))).toBe(true);
    await expect.poll(async () => dist((await delMarcador())[0]!.pos, original)).toBe(0);
    expect((await delMarcador())[0]!.pos).toEqual(original);
  });

  test('F1-E1: un marcador con ancla y sin posición propia se dibuja en el centro de su pieza y la sigue', async ({ page }) => {
    // Hoy ningún marcador con ancla trae `posicion: null`: no se inventa uno (plan: se omite con el motivo).
    test.skip(SIN_POSICION.length === 0, 'src/data/marcadores.json ya no trae ningún marcador con ancla y posicion null');
    test.setTimeout(300_000);
    await abrir(page, '/es');
    await modeloCargado(page);
    const M = SIN_POSICION[0]!;
    const claves = await centrosActuales(page);
    const piezas = piezasDe(M.ancla!, claves);
    const centros = await estado(page, (s) => s.centros as Record<string, Vec>);
    const puntos = async () => (await puntosDibujados(page)).filter((p) => p.id === M.id);
    await expect.poll(async () => (await puntos()).length).toBe(piezas.length);
    for (const pieza of piezas) {
      expect((await puntos()).some((p) => dist(p.pos, centros[pieza]!) <= TOL), `centro de ${pieza}`).toBe(true);
    }
    await separarAlMaximo(page);
    const base = await baseActual(page);
    for (const pieza of piezas) {
      await expect
        .poll(async () => Math.min(...(await puntos()).map((p) => dist(p.pos, [0, 1, 2].map((i) => centros[pieza]![i]! + base[pieza]![i]!)))))
        .toBeLessThanOrEqual(TOL);
    }
    await page.getByTestId('reensamblar').click();
    await expect.poll(async () => Object.values(await baseActual(page)).every((v) => v.every((x) => x === 0))).toBe(true);
    for (const pieza of piezas) {
      await expect.poll(async () => Math.min(...(await puntos()).map((p) => dist(p.pos, centros[pieza]!)))).toBeLessThanOrEqual(TOL);
    }
  });

  test('F1-E2: un marcador par dibuja un punto por lado y cada uno sigue a su lado sin cruzar la línea media', async ({ page }) => {
    test.setTimeout(300_000);
    expect(PARES.length, 'src/data/marcadores.json trae marcadores pares con ancla').toBeGreaterThan(0);
    await abrir(page, '/es');
    await modeloCargado(page);
    const claves = await centrosActuales(page);
    await separarAlMaximo(page);
    const base = await baseActual(page);
    // Un par cuyos dos lados se mueven distinto: un punto pegado al lado equivocado no pasaría desapercibido.
    const M = PARES.find((m) => {
      const l = piezasDe(m.ancla!, claves, 'l');
      const r = piezasDe(m.ancla!, claves, 'r');
      return l.length === 1 && r.length === 1 && dist(base[l[0]!]!, base[r[0]!]!) > 1e-3;
    });
    expect(M, 'un marcador par cuyos lados se mueven distinto al separar').toBeDefined();
    const pos = M!.posicion as { l: Vec; r: Vec };
    const lados = { l: piezasDe(M!.ancla!, claves, 'l')[0]!, r: piezasDe(M!.ancla!, claves, 'r')[0]! };
    // Línea media: la coordenada lateral (x) de los dos lados tiene signo opuesto en los datos.
    expect(Math.sign(pos.l[0])).toBe(-Math.sign(pos.r[0]));

    const delMarcador = async () => (await puntosDibujados(page)).filter((p) => p.id === M!.id && !p.propuesta);
    for (const lado of ['l', 'r'] as const) {
      await expect
        .poll(async () => dist(resta((await delMarcador()).find((p) => p.lado === lado)?.pos ?? [Infinity, 0, 0], pos[lado]), base[lados[lado]]!))
        .toBeLessThanOrEqual(TOL);
    }
    const separado = await delMarcador();
    expect(separado.map((p) => p.lado).sort()).toEqual(['l', 'r']);
    for (const lado of ['l', 'r'] as const) {
      const p = separado.find((q) => q.lado === lado)!;
      expect(dist(p.pos, pos[lado]), `el lado ${lado} salió de su sitio`).toBeGreaterThan(1e-3);
      expect(dist(resta(p.pos, pos[lado]), base[lados[lado]]!), `el lado ${lado} sigue a su pieza`).toBeLessThanOrEqual(TOL);
      expect(Math.sign(p.pos[0]), `el lado ${lado} no cruza la línea media`).toBe(Math.sign(pos[lado][0]));
    }

    // Armado: dos puntos exactos, uno a cada lado, en la posición escrita para su lado.
    await page.getByTestId('reensamblar').click();
    await expect.poll(async () => Object.values(await baseActual(page)).every((v) => v.every((x) => x === 0))).toBe(true);
    await expect.poll(async () => (await delMarcador()).map((p) => dist(p.pos, pos[p.lado!])).reduce((a, b) => a + b, 0)).toBe(0);
    const armado = await delMarcador();
    expect(armado).toHaveLength(2);
    expect(armado.find((p) => p.lado === 'l')!.pos).toEqual(pos.l);
    expect(armado.find((p) => p.lado === 'r')!.pos).toEqual(pos.r);
  });
});

// ================================================================================== F2: trazos del vago con propuesta

const barra = (page: Page) => page.getByTestId('panel-revision');
const panelTrazo = (page: Page) => page.getByTestId('revision-trazo');
const seccionTrazos = (page: Page) => page.locator('details[data-seccion="trazos"]');
const seleccionMalla = (page: Page) => estado(page, (s) => s.seleccion.malla);

/** Abre un trazo como lo hace un toque sobre el nervio en el visor (el mismo camino que "Siguiente trazo"). */
async function tocarTrazo(page: Page, malla: string) {
  await page.evaluate((m) => {
    (window as unknown as VentanaPrueba).__atlas.getState().abrirTrazo(m);
    window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: 'vagus-nerve-x' } }));
  }, malla);
  await expect.poll(() => seleccionMalla(page)).toBe(malla);
  await expect(panelTrazo(page)).toBeVisible();
  await expect(panelTrazo(page).getByRole('heading', { name: new RegExp(`^(Trazo|Strand) ${/#t(\d+)$/.exec(malla)![1]}`) })).toBeVisible();
}

test.describe('F2: el docente revisa un trazo del vago con su propuesta', () => {
  test.beforeEach(() => {
    expect(datoDe(CON).propuesta, 'un trazo con propuesta en src/data/trazos-vago.json').not.toBeNull();
    expect(datoDe(CON).evidencia?.es).toBeTruthy();
    expect(datoDe(SIN).propuesta, 'un trazo sin propuesta en src/data/trazos-vago.json').toBeNull();
  });

  test('F2-H: se ve la propuesta con confianza, evidencia y fuente; un toque la confirma, se guarda y sigue marcada tras recargar', async ({ page, context }) => {
    test.setTimeout(420_000);
    const canal = await entrarRevision(page, context, 'PROPU001');
    const dato = datoDe(CON);

    // 1. Abrir el trazo desde "Qué revisar" (sección de trazos del vago).
    await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
    await seccionTrazos(page).locator('summary').click();
    await seccionTrazos(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' }).click();
    await expect(panelTrazo(page)).toBeVisible();
    const siguiente = panelTrazo(page).getByRole('button', { name: 'Siguiente trazo' });
    for (let i = 0; i < TOTAL && (await seleccionMalla(page)) !== CON; i++) {
      const actual = await seleccionMalla(page);
      await siguiente.click();
      await expect.poll(() => seleccionMalla(page)).not.toBe(actual);
    }
    expect(await seleccionMalla(page)).toBe(CON);

    // 2. El bloque de propuesta, en español y tal como está en los datos.
    await expect(panelTrazo(page).getByText(`La auditoría del modelo propone: ${nombreEs(dato.propuesta!)}`)).toBeVisible();
    await expect(page.getByTestId('trazo-confianza')).toHaveText(`Confianza: ${CONFIANZA_ES[dato.confianza!]}`);
    await expect(page.getByTestId('trazo-evidencia')).toHaveText(dato.evidencia!.es);
    await expect(page.getByTestId('trazo-fuente')).toHaveText(`Fuente de la regla: ${dato.fuente}`);

    // 3. Un solo toque en "Correcto, es lo propuesto".
    const correcto = panelTrazo(page).getByRole('button', { name: 'Correcto, es lo propuesto' });
    await expect(correcto).toHaveAttribute('aria-pressed', 'false');
    await correcto.click();
    await expect(correcto).toHaveAttribute('aria-pressed', 'true');
    expect(await estado(page, (s, k: string) => s.respuestas[k], claveDe(CON))).toMatchObject({ veredicto: 'correcto', ramo: dato.propuesta, campo: `trazo:${CON}` });
    // El canal simulado recibe un `guardar` con esa respuesta y la app dice "Guardado".
    await expect.poll(() => canal.guardados().length, { timeout: 30_000 }).toBeGreaterThan(0);
    const carga = canal.guardados().at(-1)!;
    expect(carga.r).toBe('PROPU001');
    expect(carga.e['vagus-nerve-x']).toEqual([expect.objectContaining({ c: `trazo:${CON}`, d: 'correcto', a: dato.propuesta, m: CON })]);
    await expect(page.getByTestId('estado-guardado')).toHaveText('Guardado ✓');

    // 4. Recargar: la respuesta sigue marcada.
    await page.reload();
    await barra(page).waitFor();
    await modeloCargado(page);
    await expect.poll(() => estado(page, (s) => s.lecturaCanal)).toBe('hecha');
    await expect.poll(() => estado(page, (s, k: string) => s.respuestas[k]?.veredicto, claveDe(CON))).toBe('correcto');
    await tocarTrazo(page, CON);
    await expect(panelTrazo(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('trazos-pendientes')).toHaveText(`Trazos por revisar: ${TOTAL - 1} de ${TOTAL}`);
  });

  test('F2-E1: un trazo sin propuesta dice "Sin propuesta de la auditoría", muestra la evidencia y no ofrece confirmar', async ({ page, context }) => {
    test.setTimeout(300_000);
    await entrarRevision(page, context, 'PROPU002');
    await tocarTrazo(page, SIN);
    const dato = datoDe(SIN);
    expect(dato.evidencia?.es).toBeTruthy();

    await expect(page.getByTestId('trazo-sin-propuesta')).toHaveText('Sin propuesta de la auditoría');
    await expect(page.getByTestId('trazo-evidencia')).toHaveText(dato.evidencia!.es);
    await expect(panelTrazo(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveCount(0);
    await expect(panelTrazo(page).getByText(/La auditoría del modelo propone/)).toHaveCount(0);

    // Igual puede elegir un ramo de la lista, "no es un ramo" o "no sé".
    const select = panelTrazo(page).getByRole('combobox', { name: 'Elige el ramo' });
    const opciones = await select.locator('option').allTextContents();
    expect(opciones).toContain('No es un ramo (tronco o raicilla)');
    expect(opciones).toContain('No sé');
    expect(opciones.length).toBeGreaterThan(3); // además de las dos anteriores y el texto guía, hay ramos
    await select.selectOption('no_se');
    await expect.poll(() => estado(page, (s, k: string) => s.respuestas[k]?.ramo, claveDe(SIN))).toBe('no_se');
    await select.selectOption('no_es_ramo');
    await expect.poll(() => estado(page, (s, k: string) => s.respuestas[k]?.ramo, claveDe(SIN))).toBe('no_es_ramo');
    // Sin propuesta, elegir algo es "corregir", nunca "correcto".
    expect(await estado(page, (s, k: string) => s.respuestas[k]?.veredicto, claveDe(SIN))).toBe('corregir');
  });

  test('F2-E2: en inglés la propuesta, la confianza, la evidencia y el botón están en inglés', async ({ page, context }) => {
    test.setTimeout(300_000);
    await entrarRevision(page, context, 'PROPU003', 'en');
    await tocarTrazo(page, CON);
    const dato = datoDe(CON);
    expect(dato.evidencia!.en).toBeTruthy();
    expect(dato.evidencia!.en).not.toBe(dato.evidencia!.es);

    await expect(panelTrazo(page).getByText(`The model audit proposes: ${nombreEn(dato.propuesta!)}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('trazo-confianza')).toHaveText(`Confidence: ${CONFIANZA_EN[dato.confianza!]}`);
    await expect(page.getByTestId('trazo-evidencia')).toHaveText(dato.evidencia!.en);
    await expect(page.getByTestId('trazo-fuente')).toHaveText(`Rule source: ${dato.fuente}`);
    await expect(panelTrazo(page).getByRole('button', { name: 'Correct, as proposed' })).toBeVisible();

    // Nada de la versión en español dentro del panel.
    const texto = (await panelTrazo(page).innerText()).toString();
    expect(texto).not.toContain(dato.evidencia!.es);
    expect(texto).not.toMatch(/Confianza|La auditoría del modelo|Correcto, es lo propuesto|Fuente de la regla|Sin propuesta/);
  });
});

// ================================================================================== F3: posición de un marcador

const respuestaPosicion = (page: Page) => estado(page, (s, k: string) => s.respuestas[k] ?? null, `${GEN.id}|posicion|`);

/** Abre la ficha del marcador con la búsqueda, como lo haría el docente, y espera su título. */
async function abrirFichaPorBusqueda(page: Page, id: string) {
  const nombre = estructurasJson[id]!.nombre.es;
  const campo = page.getByRole('combobox', { name: /Buscar|Search/ });
  if (!(await campo.isVisible())) await page.keyboard.press('Control+k');
  await expect(campo).toBeVisible();
  await campo.fill(nombre);
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha-titulo')).toHaveText(nombre);
  await expect.poll(() => estado(page, (s) => s.seleccion.entrada)).toBe(id);
}

test.describe('F3: el docente revisa la posición de un marcador', () => {
  test.beforeEach(() => {
    expect(GEN, 'un marcador aproximado con posición y fuente en src/data/marcadores.json').toBeDefined();
    expect(GEN.fuente_ubicacion.es.length).toBeGreaterThan(50);
  });

  test('F3-H: se ve el método y la fuente; "Correcto" guarda con un toque sin coordenadas y el segundo toque lo deshace', async ({ page, context }) => {
    test.setTimeout(300_000);
    const canal = await entrarRevision(page, context, 'PROPU004');
    await abrirFichaPorBusqueda(page, GEN.id);

    const fuente = page.getByTestId('fuente-posicion');
    const correcta = page.getByTestId('posicion-correcta');
    const proponer = page.getByRole('button', { name: 'Proponer posición' });
    await expect(fuente.getByRole('heading', { name: 'Método y fuente de la posición' })).toBeVisible();
    await expect(fuente).toContainText(trozo(GEN.fuente_ubicacion.es));
    await expect(fuente).not.toContainText(trozo(GEN.fuente_ubicacion.en));
    await expect(page.locator('section.ficha-campo').filter({ has: fuente }).filter({ has: proponer })).toHaveCount(1);

    await expect(correcta).toHaveText('Correcto, la posición propuesta está bien');
    await expect(correcta).toHaveAttribute('aria-pressed', 'false');
    await correcta.click();
    await expect(correcta).toHaveAttribute('aria-pressed', 'true');
    const r = await respuestaPosicion(page);
    expect(r).toMatchObject({ veredicto: 'correcto', campo: 'posicion' });
    expect(r?.posicion, 'sin coordenadas').toBeUndefined();
    // Sin pedir coordenadas: no se abre el modo ubicar.
    await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toHaveCount(0);

    // El canal simulado recibe la confirmación, sin posición.
    await expect.poll(() => canal.guardados().length, { timeout: 30_000 }).toBeGreaterThan(0);
    const enviada = canal.guardados().flatMap((g) => g.e[GEN.id] ?? []);
    expect(enviada).toEqual([expect.objectContaining({ c: 'posicion', d: 'correcto' })]);
    expect(enviada[0]).not.toHaveProperty('x');
    await expect(page.getByTestId('estado-guardado')).toHaveText('Guardado ✓');

    // El segundo toque la deshace y el botón vuelve a su estado inicial.
    await correcta.click();
    await expect(correcta).toHaveAttribute('aria-pressed', 'false');
    expect(await respuestaPosicion(page)).toBeNull();
    await expect(page.getByTestId('total-respuestas')).toHaveText('0 respuestas');
  });

  test('F3-E1: con una posición ya propuesta "Correcto" no aparece y los datos no cambian', async ({ page, context }) => {
    test.setTimeout(300_000);
    await entrarRevision(page, context, 'PROPU005');
    await abrirFichaPorBusqueda(page, GEN.id);
    const correcta = page.getByTestId('posicion-correcta');
    await expect(correcta).toBeVisible();
    const antes = (await puntosDibujados(page)).filter((p) => p.id === GEN.id && !p.propuesta);
    expect(antes.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Proponer posición' }).click();
    await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toBeVisible();
    // Se aísla un órgano de referencia (el estómago), que sí recibe el toque, y se encuadra.
    const pedidosAntes = await page.evaluate(() => (window as unknown as VentanaPrueba).__camara.pedidosAplicados);
    await page.evaluate(() => {
      const s = (window as unknown as { __atlas: { getState(): { aislarPiezas(p: string[], m: string): void; pedirCamara(o: unknown): void } } }).__atlas.getState();
      s.aislarPiezas(['stomach'], 'solo');
      s.pedirCamara({ encuadrar: ['stomach'] });
    });
    await expect.poll(() => page.evaluate(() => (window as unknown as VentanaPrueba).__camara.pedidosAplicados)).toBeGreaterThan(pedidosAntes);
    await expect.poll(() => page.evaluate(() => (window as unknown as VentanaPrueba).__camara.desfase?.() ?? Infinity), { timeout: 30_000 }).toBeLessThan(1e-4);
    const caja = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
    const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
    // El estómago tiene un hueco: se prueba el centro y después puntos alrededor hasta que la app registre el toque.
    let registrado = false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      await page.mouse.click(centro.x + dx! * 90, centro.y + dy! * 90);
      registrado = await expect(page.getByTestId('posicion-propuesta')).toBeVisible({ timeout: 2500 }).then(() => true, () => false);
      if (registrado) break;
    }
    expect(registrado, 'la app registró la posición propuesta').toBe(true);

    // La propuesta del docente queda registrada con coordenadas y "Correcto" ya no está.
    const r = await respuestaPosicion(page);
    expect(r).toMatchObject({ campo: 'posicion', veredicto: 'corregir' });
    expect(r?.posicion).toHaveLength(3);
    await expect(correcta).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Proponer posición' })).toHaveCount(0);

    // Los datos no cambian: el punto del marcador sigue en su posición, y la propuesta es otro punto aparte.
    const despues = await puntosDibujados(page);
    const delDato = despues.filter((p) => p.id === GEN.id && !p.propuesta);
    expect(delDato.map((p) => p.pos)).toEqual(antes.map((p) => p.pos));
    const propuestos = despues.filter((p) => p.id === GEN.id && p.propuesta);
    expect(propuestos).toHaveLength(1);
    expect(propuestos[0]!.pos).toEqual(r!.posicion);
  });

  test('F3-E2: un visitante normal no ve "Correcto" ni "Proponer posición" y sí el aviso de posición aproximada', async ({ page }) => {
    test.setTimeout(300_000);
    await abrir(page, '/es');
    await modeloCargado(page);
    await expect(barra(page)).toHaveCount(0);
    await abrirFichaPorBusqueda(page, GEN.id);

    const ficha = page.getByTestId('ficha');
    await expect(ficha.getByText('Esta estructura no viene en el modelo 3D. El punto marca una posición aproximada, pendiente de validación docente.')).toBeVisible();
    await expect(ficha.getByText(trozo(GEN.fuente_ubicacion.es))).toBeVisible();
    await expect(page.getByTestId('posicion-correcta')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Correcto, la posición propuesta está bien' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Proponer posición' })).toHaveCount(0);
    await expect(page.getByTestId('fuente-posicion')).toHaveCount(0);
    // El marcador sigue dibujado, en su posición.
    expect((await puntosDibujados(page)).some((p) => p.id === GEN.id && !p.propuesta)).toBe(true);
  });
});
