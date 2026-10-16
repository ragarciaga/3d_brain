// Canal de retorno de la revisión docente (spec 03): enlace con código, modo revisión, autorización y avisos.
// Las tareas T7 a T10 de ese spec amplían este archivo. Helpers propios para no depender de otros specs.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { configRevision, VERSION_AUTORIZACION } from '../src/config/revision';
import { AVISO_RESPALDO_MS, ESPERA_CANAL_MS, ESPERA_ENVIO_MS, ESPERA_MAXIMA_MS, siguienteEspera } from '../src/lib/colaGuardado';
import { ESPERA_GUARDADO_MS } from '../src/lib/revision';
import { leerRutas } from '../src/lib/rutas';
import { protegerCanalReal } from './canal-real';

const barra = (page: Page) => page.getByTestId('panel-revision');

async function prepararContexto(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
}

/** Código de revisor en el store (window.__atlas solo existe en desarrollo, que es como corre el e2e). */
const revisorDelStore = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState: () => { revisor: string | null } } }).__atlas.getState().revisor);

const guardado = (page: Page) => page.evaluate(() => localStorage.getItem('atlas:revisor'));

/** Deja pasar un frame y una macrotarea, para que los efectos de React ya hayan corrido antes de una aserción negativa. */
const asentar = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(() => r(), 0))));

const SCRIPT = encodeURIComponent('<script>');

protegerCanalReal();

test.beforeEach(async ({ context }) => {
  await prepararContexto(context);
});

for (const lang of ['es', 'en'] as const) {
  test(`enlace válido activa el modo revisión sin pedir código (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/revision?r=D03-ok`);
    await expect(barra(page)).toBeVisible();
    await expect(barra(page)).toContainText('D03-ok');
    await expect(page.getByRole('textbox', { name: /código|code/i })).toHaveCount(0);
    expect(await guardado(page)).toBe('D03-ok');
  });

  test(`enlace inválido muestra el aviso y no activa el modo (${lang})`, async ({ page }) => {
    const texto = lang === 'es' ? 'Este enlace no es válido; pide uno nuevo al editor' : 'This link is not valid; ask the editor for a new one';
    await page.goto(`/${lang}/revision?r=${SCRIPT}`);
    await expect(page.getByTestId('enlace-invalido')).toContainText(texto);
    await asentar(page);
    await expect(barra(page)).toHaveCount(0);
    expect(await revisorDelStore(page)).toBeNull();
    expect(await guardado(page)).toBeNull();
  });
}

test('enlace inválido con un código ya recordado no lo activa ni lo cambia', async ({ page }) => {
  await page.goto('/es/revision?r=D03-ok');
  await expect(barra(page)).toContainText('D03-ok');
  expect(await guardado(page)).toBe('D03-ok');

  await page.goto(`/es/revision?r=${SCRIPT}`);
  await expect(page.getByTestId('enlace-invalido')).toBeVisible();
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
  expect(await guardado(page)).toBe('D03-ok');
});

test('enlace con ?r= vacío muestra el aviso y no cae en el código recordado', async ({ page }) => {
  await page.goto('/es/revision?r=D03-ok');
  await expect(barra(page)).toContainText('D03-ok');
  expect(await guardado(page)).toBe('D03-ok');

  await page.goto('/es/revision?r=');
  await expect(page.getByTestId('enlace-invalido')).toContainText('Este enlace no es válido; pide uno nuevo al editor');
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
  expect(await guardado(page)).toBe('D03-ok');
});

test('enlace: un código inválido ya guardado no activa el modo', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('atlas:revisor', '<script>'));
  await page.goto('/es');
  await expect(page.locator('.encabezado')).toBeVisible();
  await asentar(page);
  await expect(barra(page)).toHaveCount(0);
  expect(await revisorDelStore(page)).toBeNull();
});

// Autorización (T6). El canal se simula con page.route sobre un host .invalid, que nunca resuelve.
const URL_CANAL = 'https://canal-prueba.invalid/macros/s/e2e/exec';

/** Fija la URL del canal antes de la primera carga (costura de desarrollo de src/main.tsx; '' la anula). */
const conCanal = (context: BrowserContext, url: string) =>
  context.addInitScript((u) => {
    (window as unknown as { __urlCanalInicial?: string }).__urlCanalInicial = u;
  }, url);

/** Con la guía ya vista no se abre sola y no tapa los controles. */
const saltarGuia = (context: BrowserContext, codigo: string) =>
  context.addInitScript((c) => localStorage.setItem(`atlas:guia-vista:${c}`, '1'), codigo);

interface PeticionCanal {
  metodo: string;
  accion: string | null;
  url: string;
  cuerpo: Record<string, unknown> | null;
  /** `Date.now()` del momento en que la petición llega al simulador. */
  t: number;
}

interface CanalSimulado {
  autorizacion: unknown;
  leer: 'ok' | 'red' | 'inactivo';
  autorizar: 'ok' | 'red' | 'interno' | 'inactivo';
  /**
   * `otra_fecha` confirma cada respuesta con una fecha distinta de la enviada; `red` aborta la petición; `formato`
   * rechaza el lote como el script ante una carga que no cumple `v:2`; `inactivo` responde `codigo_no_activo`;
   * `sin_autorizacion` responde como el script cuando la hoja no tiene la autorización vigente del código (S1, #157).
   */
  guardar: 'ok' | 'red' | 'otra_fecha' | 'formato' | 'inactivo' | 'sin_autorizacion';
  /** Si existe, la respuesta de `leer` espera a que se resuelva (para probar lo que pasa mientras la lectura está pendiente). */
  retenerLeer: Promise<void> | null;
  /** Si existe, `autorizar` espera a que se resuelva antes de responder (para mirar la página con la petición en vuelo). */
  retenerAutorizar: Promise<void> | null;
  /** El `e` de la carga `v:2` que devuelve `leer`: elementos por estructura, con las claves cortas del canal. */
  respuestas: Record<string, Record<string, unknown>[]>;
  /** Demora (ms) de la respuesta de `leer`, para modelar una red lenta. */
  demoraLeer: number;
  peticiones: PeticionCanal[];
}

const CORS = { 'access-control-allow-origin': '*' };

/** Claves que confirma el canal real (`clavesRecibidas` de apps-script/Codigo.js): `estructura|campo|idioma|fecha`. */
function clavesRecibidas(carga: unknown, fechaFija?: string): string[] {
  const e = (JSON.parse(String(carga)) as { e: Record<string, { c: string; i?: string; f?: string }[]> }).e;
  return Object.entries(e).flatMap(([id, elementos]) => elementos.map((el) => [id, el.c, el.i ?? '', fechaFija ?? el.f ?? ''].join('|')));
}

async function simularCanal(
  page: Page,
  inicial: Partial<Pick<CanalSimulado, 'autorizacion' | 'leer' | 'autorizar' | 'guardar' | 'respuestas' | 'demoraLeer'>> = {},
): Promise<CanalSimulado> {
  const canal: CanalSimulado = {
    autorizacion: null,
    leer: 'ok',
    autorizar: 'ok',
    guardar: 'ok',
    retenerLeer: null,
    retenerAutorizar: null,
    respuestas: {},
    demoraLeer: 0,
    peticiones: [],
    ...inicial,
  };
  await page.route(
    (u) => u.hostname === 'canal-prueba.invalid',
    async (route) => {
      const pedido = route.request();
      const url = new URL(pedido.url());
      const json = (cuerpo: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(cuerpo) });
      if (pedido.method() === 'GET') {
        // La app ya no lee por GET (S4, #162): se anota para que las pruebas lo vean y se aborta.
        canal.peticiones.push({ metodo: 'GET', accion: url.searchParams.get('accion'), url: pedido.url(), cuerpo: null, t: Date.now() });
        return route.abort('failed');
      }
      const cuerpo = JSON.parse(pedido.postData() ?? '{}') as Record<string, unknown>;
      const accion = typeof cuerpo['accion'] === 'string' ? cuerpo['accion'] : null;
      canal.peticiones.push({ metodo: pedido.method(), accion, url: pedido.url(), cuerpo, t: Date.now() });
      if (accion === 'leer') {
        if (canal.leer === 'red') return route.abort('failed');
        if (canal.retenerLeer) await canal.retenerLeer;
        if (canal.demoraLeer) await new Promise((r) => setTimeout(r, canal.demoraLeer));
        if (canal.leer === 'inactivo') return json({ ok: false, error: 'codigo_no_activo' });
        return json({ ok: true, respuestas: { v: 2, r: cuerpo['r'], e: canal.respuestas }, autorizacion: canal.autorizacion });
      }
      if (accion === 'autorizar') {
        if (canal.retenerAutorizar) await canal.retenerAutorizar;
        if (canal.autorizar === 'red') return route.abort('failed');
        if (canal.autorizar === 'inactivo') return json({ ok: false, error: 'codigo_no_activo' });
        return json(canal.autorizar === 'interno' ? { ok: false, error: 'interno' } : { ok: true });
      }
      if (accion === 'guardar') {
        if (canal.guardar === 'red') return route.abort('failed');
        if (canal.guardar === 'inactivo') return json({ ok: false, error: 'codigo_no_activo' });
        if (canal.guardar === 'sin_autorizacion') return json({ ok: false, error: 'sin_autorizacion' });
        if (canal.guardar === 'formato') return json({ ok: false, error: 'formato' });
        return json({ ok: true, recibidas: clavesRecibidas(cuerpo['carga'], canal.guardar === 'otra_fecha' ? '2000-01-01T00:00:00.000Z' : undefined) });
      }
      return route.abort('failed');
    },
  );
  return canal;
}

const peticionesDe = (canal: CanalSimulado, accion: string) => canal.peticiones.filter((p) => p.accion === accion);

type EstadoCanal = { autorizacion: unknown; lecturaCanal: string };
const estadoDelStore = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __atlas: { getState: () => EstadoCanal } }).__atlas.getState();
    return { autorizacion: s.autorizacion, lecturaCanal: s.lecturaCanal };
  });
const autorizacionDelStore = async (page: Page) => (await estadoDelStore(page)).autorizacion;
const lecturaDelStore = async (page: Page) => (await estadoDelStore(page)).lecturaCanal;

/** Lo que el modo revisión guardó de la autorización en IndexedDB para un código (undefined si no hay registro). */
const autorizacionGuardada = (page: Page, codigo: string) =>
  page.evaluate(
    (c) =>
      new Promise<unknown>((resolver) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => resolver(undefined);
        abrirDb.onsuccess = () => {
          const db = abrirDb.result;
          if (!db.objectStoreNames.contains('keyval')) return resolver(undefined);
          const pedido = db.transaction('keyval').objectStore('keyval').get(`revision:${c}`);
          pedido.onsuccess = () => resolver(pedido.result?.autorizacion);
          pedido.onerror = () => resolver(undefined);
        };
      }),
    codigo,
  );

interface RevisionGuardada {
  respuestas: Record<string, { fecha: string }>;
  confirmadas: Record<string, string>;
}

/** El registro `revision:<código>` de IndexedDB completo (undefined si no hay). */
const revisionGuardada = (page: Page, codigo: string) =>
  page.evaluate(
    (c) =>
      new Promise<RevisionGuardada | undefined>((resolver) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => resolver(undefined);
        abrirDb.onsuccess = () => {
          const db = abrirDb.result;
          if (!db.objectStoreNames.contains('keyval')) return resolver(undefined);
          const pedido = db.transaction('keyval').objectStore('keyval').get(`revision:${c}`);
          pedido.onsuccess = () => resolver(pedido.result);
          pedido.onerror = () => resolver(undefined);
        };
      }),
    codigo,
  );

/** Fecha de una respuesta en el store (undefined si no está). */
const fechaDelStore = (page: Page, clave: string) =>
  page.evaluate(
    (k) => (window as unknown as { __atlas: { getState: () => { respuestas: Record<string, { fecha: string }> } } }).__atlas.getState().respuestas[k]?.fecha,
    clave,
  );

interface CargaGuardar {
  v: number;
  r: string;
  e: Record<string, { c: string; i?: string; d?: string; f?: string }[]>;
}

/** Carga `v:2` (texto JSON dentro del cuerpo) de una petición `guardar`. */
const cargaDe = (p: PeticionCanal) => JSON.parse(String(p.cuerpo?.['carga'])) as CargaGuardar;

const estadoGuardado = (page: Page) => page.getByTestId('estado-guardado');
const enviarPorForm = (page: Page) => barra(page).getByRole('button', { name: 'Enviar por formulario' });

/** La carga `v:2` que lleva el enlace "Abrir formulario" en el campo de revisión. */
const cargaDelEnlace = (href: string) => JSON.parse(new URL(href).searchParams.get(configRevision.campos.revision)!) as CargaGuardar;

/** Entra directo a la ficha del hipocampo con el código ya recordado, sin guía ni búsqueda. */
async function entrarDirecto(page: Page, context: BrowserContext, codigo: string) {
  await saltarGuia(context, codigo);
  await context.addInitScript((c) => localStorage.setItem('atlas:revisor', c), codigo);
  await page.goto('/es/hipocampo');
  await expect(barra(page)).toContainText(codigo);
  await expect(correcto(page, 'que_es.es')).toBeVisible();
}

const aislarModo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState(): { aislar: { modo: string } | null } } }).__atlas.getState().aislar?.modo ?? null);

/** Abre la ficha del hipocampo con la búsqueda (solo la ruta /revision activa el modo revisión). */
async function irAlHipocampo(page: Page) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
}

/** Entra con un código propio, sin guía, y llega a la ficha del hipocampo con la lectura del canal ya hecha. */
async function entrarEnRevision(page: Page, context: BrowserContext, codigo: string) {
  await saltarGuia(context, codigo);
  await page.goto(`/es/revision?r=${codigo}`);
  await expect(barra(page)).toContainText(codigo);
  await irAlHipocampo(page);
  await expect.poll(() => aislarModo(page)).toBe('contexto');
}

const correcto = (page: Page, campo: string) => page.locator(`[data-campo="${campo}"]`).getByRole('button', { name: 'Correcto' });
const dialogoAut = (page: Page) => page.getByTestId('dialogo-autorizacion');
const casillaAcepto = (page: Page) => dialogoAut(page).getByRole('checkbox', { name: 'Autorizo el tratamiento de estos datos (Ley 1581 de 2012)' });
const casillaVago = (page: Page) =>
  dialogoAut(page).getByRole('checkbox', { name: 'También puedo revisar el recorrido del nervio vago en cuello y tórax' });
const continuar = (page: Page) => dialogoAut(page).getByRole('button', { name: 'Continuar' });

test('autorización: casilla obligatoria, Escape con foco de vuelta y sin campos personales', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: null, autorizar: 'ok' });
  await conCanal(context, URL_CANAL);
  await entrarEnRevision(page, context, 'AUT01');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  expect(peticionesDe(canal, 'leer').length).toBeGreaterThan(0);
  // S4 (#162): cada lectura es un POST con el código en el cuerpo y la URL sin query.
  for (const p of peticionesDe(canal, 'leer')) {
    expect(p.metodo).toBe('POST');
    expect(p.cuerpo).toEqual({ accion: 'leer', r: 'AUT01' });
    expect(new URL(p.url).search).toBe('');
  }

  // R2.1 y (c): al marcar la primera respuesta completa aparece el diálogo y su título toma el foco.
  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(dialogoAut(page).getByRole('heading', { name: 'Autorización de tratamiento de datos' })).toBeFocused();
  await expect(casillaAcepto(page)).toBeVisible();
  await expect(casillaVago(page)).toBeVisible();

  // R2.6: ni nombre, ni correo, ni profesión, ni universidad.
  await expect(dialogoAut(page).getByRole('textbox')).toHaveCount(0);
  await expect(dialogoAut(page).locator('input[type=email], textarea')).toHaveCount(0);
  await expect(dialogoAut(page).getByRole('checkbox')).toHaveCount(2);

  // R2.2: sin la casilla obligatoria, "Continuar" no se puede pulsar y no sale nada.
  await expect(continuar(page)).toBeDisabled();
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
  await casillaVago(page).check();
  await expect(continuar(page)).toBeDisabled();
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  // (c) y D2: Escape cierra el diálogo sin aceptar, devuelve el foco y no sale del aislamiento.
  await page.keyboard.press('Escape');
  await expect(dialogoAut(page)).toHaveCount(0);
  await expect(correcto(page, 'que_es.es')).toBeFocused();
  expect(await aislarModo(page)).toBe('contexto');
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
  expect(await autorizacionDelStore(page)).toBeNull();

  // D3: en el siguiente cambio de respuestas vuelve.
  await correcto(page, 'ubicacion.es').click();
  await expect(dialogoAut(page)).toBeVisible();

  // (b): solo la obligatoria manda vago false; al confirmar el canal, el diálogo se cierra.
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'AUT01', version: VERSION_AUTORIZACION, vago: false });
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });

  // D3: con la autorización vigente, otra respuesta completa no lo muestra.
  await correcto(page, 'para_que_sirve.es').click();
  await asentar(page);
  await expect(page.getByTestId('total-respuestas')).toHaveText('3 respuestas');
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);

  // S4 (#162): con `guardar` ya visto, ninguna petición del canal (leer, autorizar, guardar) tiene query, lleva el código en la URL ni es un GET.
  await expect.poll(() => peticionesDe(canal, 'guardar').length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(canal.peticiones.length).toBeGreaterThanOrEqual(3);
  for (const p of canal.peticiones) {
    expect(p.metodo).toBe('POST');
    expect(new URL(p.url).search).toBe('');
    expect(p.url).not.toContain('AUT01');
  }
});

test('autorización: con la casilla del vago manda vago true y si autorizar falla el diálogo sigue abierto', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: null, autorizar: 'red' });
  await conCanal(context, URL_CANAL);
  await entrarEnRevision(page, context, 'AUT02');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await casillaAcepto(page).check();
  await casillaVago(page).check();

  // (g) red caída: el diálogo sigue abierto con "Sin conexión" y nada queda registrado.
  await continuar(page).click();
  await expect.poll(() => peticionesDe(canal, 'autorizar').length).toBe(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'AUT02', version: VERSION_AUTORIZACION, vago: true });
  await expect(dialogoAut(page).getByRole('alert')).toContainText('Sin conexión');
  await expect(dialogoAut(page)).toBeVisible();
  expect(await autorizacionDelStore(page)).toBeNull();
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // (g) error del canal: igual.
  canal.autorizar = 'interno';
  await continuar(page).click();
  await expect.poll(() => peticionesDe(canal, 'autorizar').length).toBe(2);
  await expect(dialogoAut(page).getByRole('alert')).toContainText('Sin conexión');
  await expect(dialogoAut(page)).toBeVisible();
  expect(await autorizacionDelStore(page)).toBeNull();

  // Con el canal de vuelta se registra, con vago true.
  canal.autorizar = 'ok';
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(3);
  expect(peticionesDe(canal, 'autorizar')[2]!.cuerpo).toEqual({ accion: 'autorizar', r: 'AUT02', version: VERSION_AUTORIZACION, vago: true });
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: true });

  // R2.6: con el canal, la guía ya no habla de un registro previo con nombre ni de rol, ni enlaza al formulario.
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  const guia = page.getByTestId('como-revisar');
  await expect(guia).toBeVisible();
  await expect(guia).not.toContainText(/regístrate/i);
  await expect(guia.getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(0);
  await expect(guia.getByRole('link')).toHaveCount(0);
  // R10.3: con canal la guía dice que todo se guarda solo y que se sigue en otro equipo con el mismo enlace.
  await expect(guia).toContainText('Guardado ✓');
  await expect(guia).toContainText('mismo enlace');

  // T7: ya autorizada, la respuesta pendiente se guarda sola.
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBeGreaterThan(0);
});

test('autorización v3 (#168): nombra responsable y contacto, enlaza Privacidad en otra pestaña sin cerrar el diálogo', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: null, autorizar: 'ok' });
  await conCanal(context, URL_CANAL);
  await entrarEnRevision(page, context, 'AUT07');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  // El pie del modo revisión también enlaza la página.
  await expect(page.locator('footer').getByRole('link', { name: 'Privacidad', exact: true })).toHaveAttribute('href', '/es/privacidad');

  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(dialogoAut(page).locator('#autorizacion-texto')).toContainText('Maysa Strategy Partners');
  await expect(dialogoAut(page).locator('#autorizacion-texto')).toContainText('info@maysasp.com');
  const enlace = dialogoAut(page).getByRole('link', { name: 'Lee el aviso de privacidad' });
  await expect(enlace).toHaveAttribute('href', '/es/privacidad');
  await expect(enlace).toHaveAttribute('target', '_blank');
  await expect(enlace).toHaveAttribute('rel', /noopener/);

  // D2: el enlace abre otra pestaña sin código en la URL; el diálogo de esta sigue abierto y no se autoriza nada.
  const [nueva] = await Promise.all([context.waitForEvent('page'), enlace.click()]);
  await expect(nueva.getByRole('heading', { level: 1, name: 'Privacidad', exact: true })).toBeVisible();
  const url = new URL(nueva.url());
  expect(url.pathname).toBe('/es/privacidad');
  expect(url.search).toBe('');
  await nueva.close();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(dialogoAut(page).getByRole('checkbox')).toHaveCount(2);
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  // Al aceptar, la autorización lleva la versión vigente.
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'AUT07', version: VERSION_AUTORIZACION, vago: false });
});

test('autorización: la vigente no se vuelve a pedir, ni sin conexión, y la del canal manda sobre la copia local', async ({ page, context }) => {
  // `guardar: 'red'`: así la respuesta nunca queda guardada y el diálogo puede volver con la autorización de otra
  // versión. Si el canal la confirmara, antes de la última recarga no habría nada por guardar y no aparecería.
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'red' });
  await conCanal(context, URL_CANAL);

  // R2.4: la respuesta de `leer` se retiene. Con la lectura todavía pendiente, marcar una respuesta no
  // muestra el diálogo (aún no se sabe si ya hay autorización); después, con la autorización vigente
  // del canal, tampoco.
  let soltarLeer!: () => void;
  canal.retenerLeer = new Promise<void>((resolver) => {
    soltarLeer = resolver;
  });
  // El código ya recordado activa el modo en cualquier ruta: se entra directo a la ficha, sin pasar por la búsqueda,
  // para que el clic llegue bien antes de los 10 s que `leer` espera su respuesta.
  await saltarGuia(context, 'AUT03');
  await context.addInitScript(() => localStorage.setItem('atlas:revisor', 'AUT03'));
  await page.goto('/es/hipocampo');
  await expect(barra(page)).toContainText('AUT03');
  await expect(correcto(page, 'que_es.es')).toBeVisible();
  await expect.poll(() => peticionesDe(canal, 'leer').length).toBeGreaterThan(0);
  expect(await lecturaDelStore(page)).toBe('pendiente');
  await correcto(page, 'que_es.es').click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await asentar(page);
  expect(await lecturaDelStore(page)).toBe('pendiente');
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  soltarLeer();
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  await asentar(page);
  await expect(dialogoAut(page)).toHaveCount(0);
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  // D4: la autorización vigente queda en IndexedDB y sirve cuando `leer` falla.
  await expect.poll(() => autorizacionGuardada(page, 'AUT03')).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  canal.leer = 'red';
  await page.reload();
  await expect(barra(page)).toContainText('AUT03');
  await expect.poll(() => lecturaDelStore(page)).toBe('fallida');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta'); // la pendiente salió de IndexedDB
  await asentar(page);
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });

  // R2.5 y D4: lo que devuelve un `leer` exitoso manda sobre la copia local. Una autorización de otra
  // versión cuenta como faltante: se borra la copia y el diálogo vuelve a pedirla.
  canal.leer = 'ok';
  canal.autorizacion = { version: `${VERSION_AUTORIZACION}-anterior`, vago: true };
  await page.reload();
  await expect(barra(page)).toContainText('AUT03');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  expect(await autorizacionDelStore(page)).toBeNull();
  await expect(dialogoAut(page)).toBeVisible();
  await expect.poll(() => autorizacionGuardada(page, 'AUT03')).toBeNull();
});

test('formulario de respaldo: sin urlCanal el formulario es el único camino, sin diálogo de autorización ni peticiones al canal, y los trazos y recorridos del vago como hoy', async ({
  page,
  context,
}) => {
  const salidas: string[] = [];
  page.on('request', (p) => {
    const url = new URL(p.url());
    if (url.searchParams.has('accion') || ['canal-prueba.invalid', 'script.google.com'].includes(url.hostname) || (p.postData() ?? '').includes('"accion"')) {
      salidas.push(`${p.method()} ${p.url()}`);
    }
  });
  await conCanal(context, '');
  await rutasSinteticas(page);
  await entrarEnRevision(page, context, 'AUT05');
  await inyectarVago(page);
  await correcto(page, 'que_es.es').click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await asentar(page);
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(salidas).toEqual([]);
  const estado = await estadoDelStore(page);
  expect(estado).toEqual({ autorizacion: null, lecturaCanal: 'pendiente' });

  // D1: sin canal no hay estado de guardado y el envío por formulario sigue en la barra.
  await expect(estadoGuardado(page)).toHaveCount(0);
  await expect(barra(page).getByRole('button', { name: 'Enviar revisión' })).toBeVisible();

  // T8 (R4.4, D5): sin canal el aviso dice que las respuestas viven solo aquí, y no hay respaldo por archivo.
  await expect(page.getByTestId('aviso-local')).toContainText('solo en este navegador');
  await expect(page.getByRole('button', { name: /Descargar respaldo|Cargar respaldo/ })).toHaveCount(0);
  await expect(page.getByTestId('entrada-respaldo')).toHaveCount(0);

  // T10 (R5, R7.2), D2: sin canal el filtro del vago no actúa: trazos y recorridos trazados salen como hoy y no hay casilla.
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(1);
  await expect(seccionQR(page, 'vago')).toHaveCount(1);
  await seccionQR(page, 'vago').locator('summary').click();
  await seccionQR(page, 'vago').getByRole('button').first().click();
  await expect(queRevisar(page)).toHaveCount(0); // elegir una ficha cierra la lista
  await expect(page.locator('[data-campo^="trazado_"]').first().getByRole('button', { name: 'Correcto' })).toBeVisible();
  await expect(barra(page).getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByTestId('casilla-vago')).toHaveCount(0);

  // R10.3: sin canal la guía tampoco habla de registro ni lo enlaza; el enlace vive en el diálogo de envío.
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(page.getByTestId('como-revisar')).not.toContainText(/regístrate/i);
  await expect(page.getByTestId('como-revisar')).not.toContainText('mismo enlace');
  await expect(page.getByTestId('como-revisar')).toContainText('Trazos del vago');
  await expect(page.getByTestId('como-revisar')).not.toContainText('solo aparecen si marcas');
  await expect(page.getByTestId('como-revisar').getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(0);
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);

  // T9 (R7.2): sin canal el envío por formulario es el de siempre: diálogo con registro y "Enviar todo", sin el respaldo.
  await barra(page).getByRole('button', { name: 'Enviar revisión' }).click();
  const envio = page.getByRole('dialog', { name: 'Enviar revisión' });
  await expect(envio).toBeVisible();
  await expect(envio).toContainText('Las fichas no muestran tu nombre');
  await expect(envio.getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(1);
  await envio.getByRole('button', { name: 'Enviar todo' }).click();
  const abrirForm = envio.getByRole('link', { name: 'Abrir formulario' });
  await expect(abrirForm).toBeVisible();
  await expect(envio).not.toContainText('no tienes que enviarlas otra vez');
  expect((await abrirForm.getAttribute('href'))?.startsWith(configRevision.urlFormulario)).toBe(true);
  await expect(page.getByRole('button', { name: 'Enviar por formulario' })).toHaveCount(0);
  await envio.getByRole('button', { name: 'Cerrar' }).click();
  await expect(envio).toHaveCount(0);
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(salidas).toEqual([]);
});

// Guardado automático (T7). Con canal, cada respuesta completa sale sola; sin pasos de envío por formulario mientras el
// canal confirma (el respaldo de R7.1 aparece a los 10 min sin confirmación y tiene sus propias pruebas).
const TEXTOS_DE_ENVIO = /Enviar revisión|Enviar todo|Abrir formulario|Sí, lo envié/;

async function sinPasosDeEnvio(page: Page) {
  await expect(page.getByRole('button', { name: /Enviar revisión|Enviar todo|Sí, lo envié/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Abrir formulario/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(TEXTOS_DE_ENVIO);
}

test('guardado: sale a los 3 s, dice Guardando... y Guardado ✓ solo con la misma fecha, sin pasos de envío', async ({ page, context }) => {
  await page.clock.install();
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'otra_fecha' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'GUA01');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(estadoGuardado(page)).toHaveText('');

  // R3.7: con canal (y sin 10 min sin confirmar) no hay botón ni diálogo de envío, ni enlace al formulario, tampoco en la guía.
  await sinPasosDeEnvio(page);
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(page.getByTestId('como-revisar')).toBeVisible();
  await sinPasosDeEnvio(page);
  // Con el reloj simulado, la espera de estabilidad de Playwright tarda unos 20 s por clic: `force` la salta (el botón ya se vio).
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click({ force: true });
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);

  // `asentar` usa el requestAnimationFrame de la página, que el reloj pausado congela: no se usa desde aquí.
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);

  // R3.1: mientras espera dice "Guardando..." y no sale nada antes de la espera del panel; en cuanto se cumple, sale.
  // `fastForward` y no `runFor`: este avanza frame por frame y el visor, que dibuja en cada uno, tarda minutos;
  // aquel dispara cada temporizador vencido una vez.
  await correcto(page, 'que_es.es').click({ force: true });
  await expect(estadoGuardado(page)).toHaveText('Guardando...');
  const fecha = await fechaDelStore(page, 'hippocampus|que_es|es');
  expect(fecha).toBeTruthy();
  await page.clock.fastForward(ESPERA_ENVIO_MS - 1);
  await page.waitForTimeout(500); // tiempo real: deja llegar al simulador una petición que hubiera salido antes
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
  await expect(estadoGuardado(page)).toHaveText('Guardando...');
  await page.clock.fastForward(1);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(1);
  const carga = cargaDe(peticionesDe(canal, 'guardar')[0]!);
  expect(carga.r).toBe('GUA01');
  expect(carga.e['hippocampus']).toEqual([expect.objectContaining({ c: 'que_es', i: 'es', d: 'correcto', f: fecha })]);

  // R3.2: una confirmación de otra fecha no es "Guardado ✓" y la respuesta sigue pendiente.
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');
  await expect(estadoGuardado(page)).not.toContainText('Guardado ✓');

  // El reintento llega a los 2000 ms; con la confirmación correcta queda guardada.
  canal.guardar = 'ok';
  await page.clock.fastForward(siguienteEspera(1));
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(2);
  expect(cargaDe(peticionesDe(canal, 'guardar')[1]!).e['hippocampus']).toEqual([expect.objectContaining({ c: 'que_es', f: fecha })]);
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  await expect.poll(async () => (await revisionGuardada(page, 'GUA01'))?.confirmadas['hippocampus|que_es|es']).toBe(fecha);

  // R3.1 con texto: la propuesta llega al store 500 ms después de la última tecla (`ESPERA_GUARDADO_MS`) y el
  // envío sale antes de que pasen 3 s de la última tecla, no 3 s después de que el texto llegó al store.
  const control = page.locator('[data-campo="ubicacion.es"]');
  await control.getByRole('button', { name: 'Corregir' }).click({ force: true });
  const propuesta = control.getByLabel('Cambio propuesto');
  await propuesta.fill('Texto propuesto', { force: true });
  await expect(propuesta).toHaveValue('Texto propuesto');
  await page.clock.fastForward(ESPERA_GUARDADO_MS); // pasan 500 ms desde la última tecla
  await expect(estadoGuardado(page)).toHaveText('Guardando...');
  await page.clock.fastForward(ESPERA_ENVIO_MS - 1); // 2899 ms desde la última tecla
  await page.waitForTimeout(500);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(2);
  await page.clock.fastForward(1); // 2900 ms: menos de ESPERA_CANAL_MS
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(3);
  expect(cargaDe(peticionesDe(canal, 'guardar')[2]!).e['hippocampus']).toEqual([
    expect.objectContaining({ c: 'ubicacion', d: 'corregir', p: 'Texto propuesto' }),
  ]);
});

test('guardado: sin conexión queda pendiente, al recargar se guarda sola y un código no activo detiene el guardado', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'red' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'GUA02');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');

  // R3.5: con la red caída la respuesta queda pendiente.
  await correcto(page, 'que_es.es').click();
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');
  expect(peticionesDe(canal, 'guardar').length).toBeGreaterThan(0);
  await expect.poll(async () => Object.keys((await revisionGuardada(page, 'GUA02'))?.respuestas ?? {})).toContain('hippocampus|que_es|es');
  expect((await revisionGuardada(page, 'GUA02'))?.confirmadas).not.toHaveProperty(['hippocampus|que_es|es']);
  const fecha = await fechaDelStore(page, 'hippocampus|que_es|es');

  // Al recargar con el canal arriba, sin tocar nada, sale sola.
  canal.guardar = 'ok';
  await page.reload();
  await expect(barra(page)).toContainText('GUA02');
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  const ultima = peticionesDe(canal, 'guardar').at(-1)!;
  expect(cargaDe(ultima).e['hippocampus']).toEqual([expect.objectContaining({ c: 'que_es', f: fecha })]);
  await expect.poll(async () => (await revisionGuardada(page, 'GUA02'))?.confirmadas['hippocampus|que_es|es']).toBe(fecha);

  // R1.3: con `codigo_no_activo` al guardar, el panel lo dice y no vuelve a salir nada.
  canal.guardar = 'inactivo';
  await correcto(page, 'ubicacion.es').click();
  await expect(estadoGuardado(page)).toHaveText('Tu código no está activo; escribe al editor');
  expect(await lecturaDelStore(page)).toBe('inactivo');
  const n = peticionesDe(canal, 'guardar').length;
  await correcto(page, 'para_que_sirve.es').click();
  await page.waitForTimeout(ESPERA_CANAL_MS + 1000);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(n);
  const claves = Object.keys((await revisionGuardada(page, 'GUA02'))?.respuestas ?? {});
  expect(claves).toContain('hippocampus|ubicacion|es');
  expect(claves).toContain('hippocampus|para_que_sirve|es');

  // Si falla la lectura de IndexedDB de otro código, las respuestas en memoria son del anterior: no salen con el nuevo.
  canal.guardar = 'ok';
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, clave: IDBValidKey | IDBKeyRange) {
      if (clave === 'revision:GUA04') throw new Error('lectura de prueba rota');
      return original.call(this, clave);
    };
  });
  const antes = peticionesDe(canal, 'guardar').length;
  await page.evaluate(() => (window as unknown as { __atlas: { getState: () => { setRevisor: (c: string) => void } } }).__atlas.getState().setRevisor('GUA04'));
  await expect(barra(page)).toContainText('GUA04');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(page.getByTestId('total-respuestas')).toHaveText('0 respuestas');
  await page.waitForTimeout(ESPERA_CANAL_MS + 1000);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(antes);
});

test('guardado: código no activo al autorizar o al leer', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: null, autorizar: 'inactivo' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'GUA03');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');

  // R1.3 por `autorizar`: el diálogo se cierra con el mensaje y no sale ningún `guardar`.
  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  await expect(estadoGuardado(page)).toHaveText('Tu código no está activo; escribe al editor');
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // R1.3 por `leer`: sin diálogo y sin `guardar`, y las respuestas siguen en IndexedDB. Caso real: el docente ya tenía
  // una autorización vigente guardada en este navegador y después le desactivaron el código; solo `inactivo` frena el envío.
  await page.evaluate(
    (version) =>
      new Promise<void>((resolver, rechazar) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => rechazar(abrirDb.error);
        abrirDb.onsuccess = () => {
          const almacen = abrirDb.result.transaction('keyval', 'readwrite').objectStore('keyval');
          const pedido = almacen.get('revision:GUA03');
          pedido.onsuccess = () => {
            const poner = almacen.put({ ...pedido.result, autorizacion: { version, vago: false } }, 'revision:GUA03');
            poner.onsuccess = () => resolver();
            poner.onerror = () => rechazar(poner.error);
          };
          pedido.onerror = () => rechazar(pedido.error);
        };
      }),
    VERSION_AUTORIZACION,
  );
  expect(await autorizacionGuardada(page, 'GUA03')).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  canal.leer = 'inactivo';
  await page.reload();
  await expect(barra(page)).toContainText('GUA03');
  await expect.poll(() => lecturaDelStore(page)).toBe('inactivo');
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  await expect(estadoGuardado(page)).toHaveText('Tu código no está activo; escribe al editor');
  await expect(dialogoAut(page)).toHaveCount(0);
  await correcto(page, 'ubicacion.es').click();
  await page.waitForTimeout(ESPERA_CANAL_MS + 1000);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  await expect(dialogoAut(page)).toHaveCount(0);
  const claves = Object.keys((await revisionGuardada(page, 'GUA03'))?.respuestas ?? {});
  expect(claves).toContain('hippocampus|que_es|es');
  expect(claves).toContain('hippocampus|ubicacion|es');
});

test('guardado: sin_autorizacion al guardar vuelve a pedir la autorización, no reintenta solo y al aceptar guarda', async ({ page, context }) => {
  // Fase 1: el editor borró la fila de `Autorizaciones` a mitad de sesión, con `leer` ya hecha.
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'sin_autorizacion' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'AUT06');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(dialogoAut(page)).toHaveCount(0);

  await correcto(page, 'que_es.es').click();
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(1);
  await expect(dialogoAut(page)).toBeVisible();
  expect(await autorizacionDelStore(page)).toBeNull();
  await expect.poll(() => autorizacionGuardada(page, 'AUT06')).toBeNull();

  // Sin autorización no sale otro `guardar` y el estado de guardado queda vacío (se lee una sola vez, ya asentado).
  await page.waitForTimeout(ESPERA_CANAL_MS + 1000);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(1);
  expect(await estadoGuardado(page).textContent()).toBe('');
  expect(Object.keys((await revisionGuardada(page, 'AUT06'))?.confirmadas ?? {})).not.toContain('hippocampus|que_es|es');

  // Al aceptar sale `autorizar` con la versión vigente y la cola sigue sola.
  canal.guardar = 'ok';
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'AUT06', version: VERSION_AUTORIZACION, vago: false });
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  expect(peticionesDe(canal, 'guardar')).toHaveLength(2);
  await expect.poll(() => autorizacionGuardada(page, 'AUT06')).toEqual({ version: VERSION_AUTORIZACION, vago: false });

  // Fase 2, el caso de S1: `leer` falla y la autorización en caché hace que la app guarde; el script responde
  // `sin_autorizacion` y la app deja de confiar en la copia local.
  canal.leer = 'red';
  canal.guardar = 'sin_autorizacion';
  await page.reload();
  await expect(barra(page)).toContainText('AUT06');
  await expect.poll(() => lecturaDelStore(page)).toBe('fallida');
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  await expect(dialogoAut(page)).toHaveCount(0);
  const n = peticionesDe(canal, 'guardar').length;

  await correcto(page, 'ubicacion.es').click();
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(n + 1);
  await expect(dialogoAut(page)).toBeVisible();
  expect(await autorizacionDelStore(page)).toBeNull();
  await expect.poll(() => autorizacionGuardada(page, 'AUT06')).toBeNull();
  await page.waitForTimeout(ESPERA_CANAL_MS + 1000);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(n + 1);
  expect(await estadoGuardado(page).textContent()).toBe('');
});

// Traer lo guardado al abrir (T8). `leer` devuelve respuestas del canal; se fusionan con lo local y quedan guardadas.
const FECHA_CANAL = '2026-01-01T10:00:00.000Z';
const VERSION_HIPOCAMPO = (JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as { estructuras: Record<string, { ficha: { version: string } }> })
  .estructuras['hippocampus']!.ficha.version;
const TEXTOS_RESPALDO = /Descargar respaldo|Cargar respaldo/;
const campo = (page: Page, nombre: string) => page.locator(`[data-campo="${nombre}"]`);

test('otro equipo: trae lo guardado al abrir en menos de 5 s, no lo reenvía, conserva lo local más reciente y no hay botones de respaldo', async ({
  page,
  context,
}) => {
  const canal = await simularCanal(page, {
    autorizacion: { version: VERSION_AUTORIZACION, vago: false },
    demoraLeer: 1500,
    respuestas: {
      hippocampus: [
        { c: 'que_es', i: 'es', d: 'no_es_mi_area', s: VERSION_HIPOCAMPO, f: FECHA_CANAL },
        { c: 'ubicacion', i: 'es', d: 'correcto', s: VERSION_HIPOCAMPO, f: FECHA_CANAL },
      ],
    },
  });
  await conCanal(context, URL_CANAL);
  await saltarGuia(context, 'OTR01');

  // Fase A: un contexto nuevo (IndexedDB vacío) abre el enlace y encuentra lo que ya respondió.
  await page.goto('/es/revision?r=OTR01');
  await expect(barra(page)).toContainText('OTR01');
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  expect(Date.now() - peticionesDe(canal, 'leer')[0]!.t).toBeLessThan(5000); // R4.1
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');

  // D1: lo traído ya está guardado, así que no sale ningún `guardar`.
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // R4.4 y D5 con canal: sin respaldo por archivo y sin el aviso de "solo en este navegador".
  await expect(page.getByRole('button', { name: TEXTOS_RESPALDO })).toHaveCount(0);
  await expect(page.getByTestId('entrada-respaldo')).toHaveCount(0);
  await expect(page.getByTestId('aviso-local')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Descargar respaldo|Cargar respaldo|solo en este navegador/);
  await expect
    .poll(async () => (await revisionGuardada(page, 'OTR01'))?.confirmadas)
    .toEqual({ 'hippocampus|que_es|es': FECHA_CANAL, 'hippocampus|ubicacion|es': FECHA_CANAL });

  // Fase B: la ficha marca lo que trajo el canal y lo nuevo sale solo, sin lo traído.
  await irAlHipocampo(page);
  await expect(campo(page, 'que_es.es').getByRole('button', { name: 'No es mi área' })).toHaveAttribute('aria-pressed', 'true');
  await expect(campo(page, 'ubicacion.es').getByRole('button', { name: 'Correcto' })).toHaveAttribute('aria-pressed', 'true');
  await correcto(page, 'que_es.es').click();
  const local = await fechaDelStore(page, 'hippocampus|que_es|es');
  expect(local).toBeTruthy();
  expect(local).not.toBe(FECHA_CANAL);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBeGreaterThan(0);
  expect(cargaDe(peticionesDe(canal, 'guardar')[0]!).e).toEqual({
    hippocampus: [expect.objectContaining({ c: 'que_es', d: 'correcto', f: local })],
  });
  for (const p of peticionesDe(canal, 'guardar')) {
    expect(Object.values(cargaDe(p).e).flat().some((el) => el.f === FECHA_CANAL)).toBe(false);
  }
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  await expect.poll(async () => (await revisionGuardada(page, 'OTR01'))?.confirmadas['hippocampus|que_es|es']).toBe(local);

  // Fase C (D2): al reabrir, el canal sigue con la versión vieja y lo local más reciente se conserva.
  const enviadas = peticionesDe(canal, 'guardar').length;
  await page.reload();
  await expect(barra(page)).toContainText('OTR01');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  // Lo local que ya estaba guardado sigue guardado: la fecha del canal no pisa `confirmadas` y no se reenvía nada.
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  expect(peticionesDe(canal, 'guardar')).toHaveLength(enviadas);
  await expect.poll(async () => (await revisionGuardada(page, 'OTR01'))?.confirmadas['hippocampus|que_es|es']).toBe(local);
  await expect(correcto(page, 'que_es.es')).toHaveAttribute('aria-pressed', 'true');
  await expect(campo(page, 'que_es.es').getByRole('button', { name: 'No es mi área' })).toHaveAttribute('aria-pressed', 'false');
  expect(await fechaDelStore(page, 'hippocampus|que_es|es')).toBe(local);
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  for (const p of peticionesDe(canal, 'guardar')) {
    expect(Object.values(cargaDe(p).e).flat().some((el) => el.f === FECHA_CANAL)).toBe(false);
  }
});

// Respaldo por formulario (T9, R7.1). Con canal, 10 min sin ninguna confirmación y con pendientes ofrecen el formulario.
// Reloj simulado: `fastForward` dispara cada temporizador vencido una vez, y cada salto que dispara un envío espera
// antes su petición y su efecto, para que el temporizador de 10 s del canal no aborte una petición en vuelo.
test('formulario de respaldo: con el canal caído no aparece a los 9 min, aparece a los 10, abre las partes con la carga v:2 y se va cuando el canal vuelve', async ({
  page,
  context,
}) => {
  await page.clock.install();
  // Una respuesta que el canal ya tiene: se trae al abrir y no sale en el formulario.
  const canal = await simularCanal(page, {
    autorizacion: { version: VERSION_AUTORIZACION, vago: false },
    guardar: 'red',
    respuestas: { hippocampus: [{ c: 'ubicacion', i: 'es', d: 'correcto', s: VERSION_HIPOCAMPO, f: FECHA_CANAL }] },
  });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'RES01');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect(correcto(page, 'ubicacion.es')).toHaveAttribute('aria-pressed', 'true');
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);

  // Primer envío: con la red caída queda pendiente.
  await correcto(page, 'que_es.es').click({ force: true });
  const fecha = await fechaDelStore(page, 'hippocampus|que_es|es');
  expect(fecha).toBeTruthy();
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBeGreaterThanOrEqual(1);
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');

  // (a) a los 9 min del cambio no hay botón.
  await page.clock.fastForward(AVISO_RESPALDO_MS - 60_000 - ESPERA_ENVIO_MS);
  await page.waitForTimeout(500); // tiempo real: deja pintar lo que haya disparado el salto
  await expect(enviarPorForm(page)).toHaveCount(0);

  // (b) a los 10 min aparece y abre el diálogo de partes con la carga v:2.
  await page.clock.fastForward(60_000);
  await expect(enviarPorForm(page)).toBeVisible();
  await enviarPorForm(page).click({ force: true });
  const dialogo = page.getByRole('dialog', { name: 'Enviar por formulario' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('link')).toHaveCount(1);
  const abrirForm = dialogo.getByRole('link', { name: 'Abrir formulario' });
  await expect(abrirForm).toBeVisible();
  const href = (await abrirForm.getAttribute('href'))!;
  expect(href.startsWith(configRevision.urlFormulario)).toBe(true);
  // Con canal, después de "Sí, lo envié" las respuestas siguen sin enviar hasta que el canal las confirme: el diálogo lo dice.
  await expect(dialogo).toContainText('no tienes que enviarlas otra vez');
  expect(cargaDelEnlace(href)).toEqual({
    v: 2,
    r: 'RES01',
    e: { hippocampus: [expect.objectContaining({ c: 'que_es', i: 'es', d: 'correcto', f: fecha })] },
  });

  // D1: con canal, el diálogo explica el respaldo y no pide ni promete nada del nombre (R2.6).
  await expect(dialogo).toContainText('lleva 10 minutos sin confirmar');
  await expect(dialogo).not.toContainText('Las fichas no muestran tu nombre');
  await expect(dialogo.getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(0);

  // R3.3 y R4.1: con canal, "Sí, lo envié" cierra la parte pero no marca nada como guardado: solo lo confirma el canal.
  // El enlace no navega (no se abre docs.google.com): el clic llega a React, que marca la parte como abierta.
  await abrirForm.evaluate((el) => el.addEventListener('click', (e) => e.preventDefault()));
  await abrirForm.click({ force: true });
  await dialogo.getByRole('button', { name: 'Sí, lo envié' }).click({ force: true });
  await expect(dialogo.getByTestId('parte-envio')).toHaveAttribute('data-estado', 'confirmada');
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');
  await expect(estadoGuardado(page)).not.toContainText('Guardado ✓');
  // La ventana de 10 min se reinicia: un salto corto dispara el temporizador que hubiera vencido y no vuelve el botón.
  await page.clock.fastForward(1000);
  await page.waitForTimeout(500); // tiempo real: deja pintar y que IndexedDB reciba lo que hubiera marcado
  await expect(enviarPorForm(page)).toHaveCount(0);
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');
  const guardada = await revisionGuardada(page, 'RES01');
  expect(guardada?.respuestas).toHaveProperty(['hippocampus|que_es|es']);
  expect(guardada?.confirmadas).not.toHaveProperty(['hippocampus|que_es|es']);
  await dialogo.getByRole('button', { name: 'Cerrar' }).click({ force: true });
  await expect(dialogo).toHaveCount(0);

  // D2: cuando el canal vuelve, lo pendiente sale por el canal y solo entonces dice "Guardado ✓".
  const antes = peticionesDe(canal, 'guardar').length;
  canal.guardar = 'ok';
  await page.clock.fastForward(ESPERA_MAXIMA_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBeGreaterThan(antes);
  expect(cargaDe(peticionesDe(canal, 'guardar').at(-1)!).e['hippocampus']).toEqual([expect.objectContaining({ c: 'que_es', f: fecha })]);
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  await expect(enviarPorForm(page)).toHaveCount(0);
  await expect.poll(async () => (await revisionGuardada(page, 'RES01'))?.confirmadas['hippocampus|que_es|es']).toBe(fecha);
});

test('formulario de respaldo: sin autorización vigente o con el código no activo no se ofrece, ni a los 10 min', async ({ page, context }) => {
  await page.clock.install();
  const canal = await simularCanal(page, { autorizacion: null, autorizar: 'ok', guardar: 'ok' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'RES03');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);

  // Sin autorización: el diálogo se descarta y la respuesta queda pendiente, sin enviarse ni ofrecer el formulario.
  await correcto(page, 'que_es.es').click({ force: true });
  await expect(dialogoAut(page)).toBeVisible();
  await dialogoAut(page).getByRole('button', { name: 'Cerrar' }).click({ force: true });
  await expect(dialogoAut(page)).toHaveCount(0);
  await page.clock.fastForward(AVISO_RESPALDO_MS);
  await page.waitForTimeout(500);
  await expect(enviarPorForm(page)).toHaveCount(0);
  expect(await autorizacionDelStore(page)).toBeNull();
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // Con el código no activo: se autoriza en el siguiente cambio y el canal responde `codigo_no_activo` al guardar.
  canal.guardar = 'inactivo';
  await correcto(page, 'ubicacion.es').click({ force: true });
  await expect(dialogoAut(page)).toBeVisible();
  await casillaAcepto(page).check({ force: true });
  await continuar(page).click({ force: true });
  await expect(dialogoAut(page)).toHaveCount(0);
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(1);
  await expect(estadoGuardado(page)).toHaveText('Tu código no está activo; escribe al editor');
  expect(await lecturaDelStore(page)).toBe('inactivo');
  await page.clock.fastForward(AVISO_RESPALDO_MS);
  await page.waitForTimeout(500);
  await expect(enviarPorForm(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(1);
});

test('formulario de respaldo: con el canal confirmando no aparece a los 10 min, y una respuesta rechazada sola sale por el formulario 10 min después de la última confirmación', async ({
  page,
  context,
}) => {
  await page.clock.install();
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'ok' });
  await conCanal(context, URL_CANAL);
  await entrarDirecto(page, context, 'RES02');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);

  // R7.1 negativo: el canal confirma la primera; la segunda queda pendiente 1 s antes de cumplirse 10 min desde esa confirmación.
  await correcto(page, 'que_es.es').click({ force: true });
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(1);
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  await page.clock.fastForward(AVISO_RESPALDO_MS - 1000);
  await correcto(page, 'ubicacion.es').click({ force: true });
  await page.clock.fastForward(1000);
  await page.waitForTimeout(500);
  await expect(enviarPorForm(page)).toHaveCount(0);
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(2);
  await expect(estadoGuardado(page)).toHaveText('Guardado ✓');
  await expect(enviarPorForm(page)).toHaveCount(0);

  // D3: el canal rechaza sola una respuesta (`formato`): sigue pendiente y no se reenvía.
  canal.guardar = 'formato';
  await correcto(page, 'para_que_sirve.es').click({ force: true });
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(3);
  await expect(estadoGuardado(page)).toHaveText('Guardando...');
  // 5 min después otra respuesta sí se confirma: la ventana se mueve a esa confirmación.
  canal.guardar = 'ok';
  await page.clock.fastForward(300_000 - ESPERA_ENVIO_MS);
  await correcto(page, 'nombre.es').click({ force: true });
  await page.clock.fastForward(ESPERA_ENVIO_MS);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(4);
  expect(cargaDe(peticionesDe(canal, 'guardar')[3]!).e['hippocampus']).toEqual([expect.objectContaining({ c: 'nombre' })]);
  await expect.poll(async () => (await revisionGuardada(page, 'RES02'))?.confirmadas['hippocampus|nombre|es']).toBeTruthy();
  // A los 10 min de la primera pendiente rechazada todavía no; a los 10 min de la última confirmación, sí.
  await page.clock.fastForward(AVISO_RESPALDO_MS - 300_000);
  await page.waitForTimeout(500);
  await expect(enviarPorForm(page)).toHaveCount(0);
  await page.clock.fastForward(300_000);
  await expect(enviarPorForm(page)).toBeVisible();
  await enviarPorForm(page).click({ force: true });
  const abrirForm = page.getByRole('dialog', { name: 'Enviar por formulario' }).getByRole('link', { name: 'Abrir formulario' });
  await expect(abrirForm).toBeVisible();
  expect(cargaDelEnlace((await abrirForm.getAttribute('href'))!).e).toEqual({ hippocampus: [expect.objectContaining({ c: 'para_que_sirve' })] });
  expect(peticionesDe(canal, 'guardar')).toHaveLength(4); // la rechazada no se reenvía
});

// Filtro del vago (T10, R5). Trazos y rutas sin esperar el modelo: el GLB tarda hasta 150 s en CI; los mismos datos que
// cargaría el visor.
const TRAZOS = Object.keys((JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, unknown> }).cajas)
  .filter((n) => /#t\d+$/.test(n))
  .sort();
const RUTAS_JSON = readFileSync('tests/fixtures/vago-sintetico/puntos.json', 'utf8');
const RUTAS = leerRutas(JSON.parse(RUTAS_JSON));
const L00 = 'Vagus nerve (X).l#t00';
const TEXTO_VAGO = 'También puedo revisar el recorrido del nervio vago en cuello y tórax';
// El testid, porque el diálogo de autorización está dentro de `panel-revision` y tiene una casilla con el mismo nombre.
const casillaAcciones = (page: Page) => page.getByTestId('casilla-vago').getByRole('checkbox', { name: TEXTO_VAGO });
const queRevisar = (page: Page) => page.getByTestId('que-revisar');
const seccionQR = (page: Page, seccion: string) => queRevisar(page).locator(`details[data-seccion="${seccion}"]`);
const guiaDeRevision = (page: Page) => page.getByTestId('como-revisar');

async function abrirQueRevisar(page: Page) {
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(queRevisar(page)).toBeVisible();
}

async function cerrarQueRevisar(page: Page) {
  await queRevisar(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(queRevisar(page)).toHaveCount(0);
}

async function abrirGuia(page: Page) {
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(guiaDeRevision(page)).toBeVisible();
}

async function cerrarGuia(page: Page) {
  await guiaDeRevision(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(guiaDeRevision(page)).toHaveCount(0);
}

/** `rutas-vago.json` con las rutas sintéticas, para que una carga tardía del modelo deje las mismas que `inyectarVago`. */
const rutasSinteticas = (page: Page) =>
  page.route('**/modelos/rutas-vago.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: RUTAS_JSON }));

/** Pone en el store los trazos y las rutas que cargaría el visor; `setTrazos` ignora una lista igual. */
const inyectarVago = (page: Page) =>
  page.evaluate(
    ([trazos, rutas]) => {
      const s = (window as unknown as { __atlas: { getState: () => { setTrazos(l: string[]): void; setRutas(r: unknown[]): void } } }).__atlas.getState();
      s.setTrazos(trazos as string[]);
      s.setRutas(rutas as unknown[]);
    },
    [TRAZOS, RUTAS] as const,
  );

/** Como `entrarDirecto`, pero en otra ficha (`entrarDirecto` está fijo en el hipocampo y lo usa T9). */
async function entrarDirectoEn(page: Page, context: BrowserContext, codigo: string, ruta: string) {
  await saltarGuia(context, codigo);
  await context.addInitScript((c) => localStorage.setItem('atlas:revisor', c), codigo);
  await page.goto(ruta);
  await expect(barra(page)).toContainText(codigo);
  await expect(correcto(page, 'que_es.es')).toBeVisible();
}

/** Toca un trazo en el modelo sin esperar el GLB: la misma selección y el mismo evento que `alTocar` de Visor.tsx. */
const tocarTrazo = (page: Page, malla: string) =>
  page.evaluate((m) => {
    (window as unknown as { __atlas: { getState: () => { abrirTrazo(m: string): void } } }).__atlas.getState().abrirTrazo(m);
    window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: 'vagus-nerve-x' } }));
  }, malla);

test('vago: sin la casilla no hay trazos ni recorridos que revisar, la casilla de Acciones los muestra y los quita, y si autorizar falla no cambia nada', async ({
  page,
  context,
}) => {
  const canal = await simularCanal(page, { autorizacion: null });
  await conCanal(context, URL_CANAL);
  await rutasSinteticas(page);
  await entrarDirectoEn(page, context, 'VAG01', '/es/nervio-laringeo-recurrente');
  await inyectarVago(page);
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  // Sanidad: sin estos datos las negativas de abajo pasarían sin probar nada.
  expect(TRAZOS).toContain(L00);
  expect(RUTAS).toHaveLength(5);
  const trazadoRLN = 'trazado_laringeo_recurrente_derecho';
  const trazadoVago = 'trazado_vago_toracico_derecho';

  // (d) Sin autorización registrada no hay casilla ni sale `autorizar`.
  await asentar(page);
  await expect(casillaAcciones(page)).toHaveCount(0);
  await expect(page.getByTestId('casilla-vago')).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  await expect(page.locator('[data-campo^="trazado_"]')).toHaveCount(0);

  // Autorizar sin vago: la autorización queda registrada con `vago: false`.
  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  await expect.poll(() => autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'VAG01', version: VERSION_AUTORIZACION, vago: false });

  // (a) Con autorización y sin la casilla: ni trazos ni recorridos trazados que revisar.
  await expect(casillaAcciones(page)).toBeVisible();
  await expect(casillaAcciones(page)).not.toBeChecked();
  await expect(page.getByTestId(`ruta-${trazadoRLN}`)).toContainText('Pendiente de revisión docente');
  await expect(page.locator('[data-campo^="trazado_"]')).toHaveCount(0);
  await expect(page.getByTestId('ficha')).not.toContainText('Míralo en 3D');
  await expect(correcto(page, 'ubicacion.es')).toBeVisible(); // control positivo del modo revisión
  const nombreRln = ((await page.locator('#ficha-titulo').textContent()) ?? '').trim();
  expect(nombreRln).not.toBe('');
  // Solo la primera sección de la lista viene abierta; un `details` cerrado esconde sus botones al árbol de accesibilidad.
  const avanceRln = async (seccion: string) => {
    const detalle = seccionQR(page, seccion);
    if ((await detalle.getAttribute('open')) === null) await detalle.locator('summary').click();
    return detalle
      .locator('li')
      .filter({ has: page.getByRole('button', { name: nombreRln, exact: true }) })
      .getByTestId('avance-ficha');
  };
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(0);
  await expect(seccionQR(page, 'vago')).toHaveCount(0);
  await expect(await avanceRln('resto')).toHaveText(/1 de \d+ campos/);
  const sinRutas = Number(/1 de (\d+) campos/.exec((await (await avanceRln('resto')).textContent()) ?? '')![1]);
  await cerrarQueRevisar(page);

  // D3: la guía explica cómo activar la casilla y no describe secciones que este docente no ve.
  await abrirGuia(page);
  await expect(guiaDeRevision(page)).toContainText('solo aparecen si marcas');
  await expect(guiaDeRevision(page)).not.toContainText('Trazos del vago');
  await expect(guiaDeRevision(page)).not.toContainText('Recorrido trazado');
  await cerrarGuia(page);

  // Tocar un trazo en el modelo lleva a la ficha del vago, sin el control de revisión.
  await tocarTrazo(page, L00);
  await expect(page).toHaveURL(/\/es\/nervio-vago-x$/);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __atlas: { getState: () => { seleccion: { malla: string | null } } } }).__atlas.getState().seleccion.malla))
    .toBe(L00);
  await asentar(page);
  await expect(page.getByTestId('revision-trazo')).toHaveCount(0);
  await expect(page.locator(`[data-campo="${trazadoVago}"]`)).toHaveCount(0);
  await expect(page.getByTestId(`ruta-${trazadoVago}`)).toContainText('Pendiente de revisión docente');

  // (b) Marcar la casilla: sale `autorizar` con `vago: true` y aparecen los trazos, las rutas y sus controles.
  await casillaAcciones(page).check();
  await expect.poll(() => peticionesDe(canal, 'autorizar').length).toBe(2);
  expect(peticionesDe(canal, 'autorizar')[1]!.cuerpo).toEqual({ accion: 'autorizar', r: 'VAG01', version: VERSION_AUTORIZACION, vago: true });
  await expect.poll(() => autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: true });
  await expect(casillaAcciones(page)).toBeChecked();
  await expect(page.getByTestId('revision-trazo')).toBeVisible();
  await expect(page.getByTestId('trazos-pendientes')).toHaveText(`Trazos por revisar: ${TRAZOS.length} de ${TRAZOS.length}`);
  await expect(correcto(page, trazadoVago)).toBeVisible();
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(1);
  await expect(seccionQR(page, 'vago')).toHaveCount(1);
  await expect(await avanceRln('vago')).toHaveText(new RegExp(`1 de ${sinRutas + 2} campos`)); // las dos rutas del laríngeo recurrente
  await cerrarQueRevisar(page);

  // (b) Desmarcarla: sale `autorizar` con `vago: false` y todo eso desaparece.
  await casillaAcciones(page).uncheck();
  await expect.poll(() => peticionesDe(canal, 'autorizar').length).toBe(3);
  expect(peticionesDe(canal, 'autorizar')[2]!.cuerpo).toEqual({ accion: 'autorizar', r: 'VAG01', version: VERSION_AUTORIZACION, vago: false });
  await expect.poll(() => autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  await expect(page.getByTestId('revision-trazo')).toHaveCount(0);
  await expect(page.locator('[data-campo^="trazado_"]')).toHaveCount(0);
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(0);
  await expect(seccionQR(page, 'vago')).toHaveCount(0);
  await expect(await avanceRln('resto')).toHaveText(new RegExp(`1 de ${sinRutas} campos`));
  await cerrarQueRevisar(page);
  await expect.poll(() => autorizacionGuardada(page, 'VAG01')).toEqual({ version: VERSION_AUTORIZACION, vago: false });

  // (e) Con la petición en vuelo, la casilla muestra lo pedido pero el filtro sigue en el valor confirmado; si `autorizar`
  // falla, la casilla vuelve a su valor anterior y nada cambia.
  canal.autorizar = 'red';
  let soltarAutorizar!: () => void;
  canal.retenerAutorizar = new Promise<void>((resolver) => {
    soltarAutorizar = resolver;
  });
  await casillaAcciones(page).click(); // `click` y no `check`: tras el aborto `check` vería la casilla ya desmarcada
  await expect.poll(() => peticionesDe(canal, 'autorizar').length).toBe(4);
  expect(peticionesDe(canal, 'autorizar')[3]!.cuerpo).toEqual({ accion: 'autorizar', r: 'VAG01', version: VERSION_AUTORIZACION, vago: true });
  await expect(casillaAcciones(page)).toBeChecked();
  await expect(casillaAcciones(page)).toBeDisabled();
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  // Lecturas únicas y no `toHaveCount(0)`: este reintenta hasta que la petición falla por tiempo y el estado vuelve atrás,
  // y así una aserción negativa pasaría aunque el filtro hubiera seguido el valor en vuelo.
  expect(await page.getByTestId('revision-trazo').count()).toBe(0);
  await abrirQueRevisar(page);
  expect(await seccionQR(page, 'trazos').count()).toBe(0);
  expect(await seccionQR(page, 'vago').count()).toBe(0);
  expect(await page.getByTestId('casilla-vago').getByRole('checkbox').isDisabled()).toBe(true); // sigue en vuelo
  await cerrarQueRevisar(page);
  soltarAutorizar();
  await expect(barra(page).getByRole('alert')).toContainText('Sin conexión: no se pudo cambiar la casilla del vago');
  await expect(casillaAcciones(page)).not.toBeChecked();
  await expect(casillaAcciones(page)).toBeEnabled();
  expect(await autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: false });
  await expect(page.getByTestId('revision-trazo')).toHaveCount(0);
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(0);
  await expect(seccionQR(page, 'vago')).toHaveCount(0);
  await cerrarQueRevisar(page);

  // "Marcar todo como correcto" tampoco responde las rutas que este docente no ve (misma lista que la ficha).
  await page.getByTestId('marcar-todo').getByRole('button', { name: 'Marcar todo como correcto' }).click();
  await page.getByTestId('marcar-todo').getByRole('button', { name: /^Marcar \d+ campos?$/ }).click();
  await expect(correcto(page, 'que_es.es')).toHaveAttribute('aria-pressed', 'true');
  const claves = await page.evaluate(() =>
    Object.keys((window as unknown as { __atlas: { getState: () => { respuestas: Record<string, unknown> } } }).__atlas.getState().respuestas),
  );
  expect(claves.filter((c) => c.startsWith('vagus-nerve-x|')).length).toBeGreaterThan(1);
  expect(claves.filter((c) => c.includes('|trazado_'))).toEqual([]);
});

test('vago: en otro equipo, con vago true en el canal, los trazos y recorridos aparecen sin tocar la casilla', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: true } });
  await conCanal(context, URL_CANAL);
  await rutasSinteticas(page);
  await entrarDirectoEn(page, context, 'VAG03', '/es/nervio-laringeo-recurrente');
  await inyectarVago(page);
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');

  // (c) Sin tocar nada: control de recorrido, casilla marcada y las dos secciones.
  await expect(correcto(page, 'trazado_laringeo_recurrente_derecho')).toBeVisible();
  await expect(casillaAcciones(page)).toBeChecked();
  await abrirQueRevisar(page);
  await expect(seccionQR(page, 'trazos')).toHaveCount(1);
  await expect(seccionQR(page, 'vago')).toHaveCount(1);
  await cerrarQueRevisar(page);

  // D3: la guía describe los trazos y recorridos, no la casilla.
  await abrirGuia(page);
  await expect(guiaDeRevision(page)).toContainText('Trazos del vago');
  await expect(guiaDeRevision(page)).not.toContainText('solo aparecen si marcas');
  await cerrarGuia(page);

  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
});

const TEXTO_AUTORIZACION_ES = (JSON.parse(readFileSync('src/i18n/es.json', 'utf8')) as { revision: { autorizacion: { texto: string } } }).revision.autorizacion.texto;

test('vago: con una autorización de otra versión en memoria, la casilla muestra el diálogo con el texto vigente y no autoriza sin aceptar (#162)', async ({
  page,
  context,
}) => {
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false } });
  await conCanal(context, URL_CANAL);
  await rutasSinteticas(page);
  await entrarDirectoEn(page, context, 'VAG04', '/es/nervio-laringeo-recurrente');
  await inyectarVago(page);
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(casillaAcciones(page)).toBeVisible();
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  // Con la versión vigente, `leer` nunca deja en memoria otra; la costura de desarrollo modela una copia de otra versión.
  const vieja = { version: `${VERSION_AUTORIZACION}-anterior`, vago: false };
  await page.evaluate(
    (a) => (window as unknown as { __atlas: { getState: () => { setAutorizacion(x: unknown): void } } }).__atlas.getState().setAutorizacion(a),
    vieja,
  );
  expect(await autorizacionDelStore(page)).toEqual(vieja);

  // Tocar la casilla abre el diálogo con el texto vigente, con la casilla del vago ya marcada y sin la obligatoria.
  await casillaAcciones(page).click();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(dialogoAut(page).locator('#autorizacion-texto')).toHaveText(TEXTO_AUTORIZACION_ES);
  await expect(casillaVago(page)).toBeChecked();
  await expect(casillaAcepto(page)).not.toBeChecked();
  await expect(continuar(page)).toBeDisabled();

  // Sin aceptar no sale `autorizar`, la casilla de Acciones sigue sin marcar y el store conserva lo que había.
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(await page.getByTestId('casilla-vago').getByRole('checkbox').isChecked()).toBe(false);
  expect(await autorizacionDelStore(page)).toEqual(vieja);

  // Escape lo cierra sin aceptar.
  await page.keyboard.press('Escape');
  await expect(dialogoAut(page)).toHaveCount(0);
  await asentar(page);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(await autorizacionDelStore(page)).toEqual(vieja);

  // Otro toque y aceptar: sale `autorizar` con la versión vigente y el valor pedido.
  await casillaAcciones(page).click();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(casillaVago(page)).toBeChecked();
  await casillaAcepto(page).check();
  await continuar(page).click();
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(1);
  expect(peticionesDe(canal, 'autorizar')[0]!.cuerpo).toEqual({ accion: 'autorizar', r: 'VAG04', version: VERSION_AUTORIZACION, vago: true });
  await expect.poll(() => autorizacionDelStore(page)).toEqual({ version: VERSION_AUTORIZACION, vago: true });
  await expect(casillaAcciones(page)).toBeChecked();
});

test('autorización: con una copia local de otra versión y la lectura fallida no hay casilla del vago ni autorizar, y al responder sale el diálogo vigente (#162)', async ({
  page,
  context,
}) => {
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: true } });
  await conCanal(context, URL_CANAL);
  await rutasSinteticas(page);
  await entrarDirectoEn(page, context, 'VAG05', '/es/nervio-laringeo-recurrente');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect.poll(() => autorizacionGuardada(page, 'VAG05')).toEqual({ version: VERSION_AUTORIZACION, vago: true });

  // La copia de IndexedDB pasa a una autorización de otra versión (vago true, para que una fuga se note).
  await page.evaluate(
    (a) =>
      new Promise<void>((resolver, rechazar) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => rechazar(abrirDb.error);
        abrirDb.onsuccess = () => {
          const db = abrirDb.result;
          const tx = db.transaction('keyval', 'readwrite');
          const almacen = tx.objectStore('keyval');
          const pedido = almacen.get('revision:VAG05');
          pedido.onsuccess = () => almacen.put({ ...pedido.result, autorizacion: a }, 'revision:VAG05');
          tx.oncomplete = () => resolver();
          tx.onerror = () => rechazar(tx.error);
        };
      }),
    { version: `${VERSION_AUTORIZACION}-anterior`, vago: true },
  );
  expect(await autorizacionGuardada(page, 'VAG05')).toEqual({ version: `${VERSION_AUTORIZACION}-anterior`, vago: true });

  canal.leer = 'red';
  const lecturas = peticionesDe(canal, 'leer').length;
  await page.reload();
  await expect(barra(page)).toContainText('VAG05');
  await expect.poll(() => lecturaDelStore(page)).toBe('fallida');
  expect(peticionesDe(canal, 'leer').length).toBeGreaterThan(lecturas);
  await asentar(page);
  expect(await autorizacionDelStore(page)).toBeNull();
  expect(await page.getByTestId('casilla-vago').count()).toBe(0);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);

  // Al responder un campo vuelve a pedirse la autorización, con el texto vigente.
  await correcto(page, 'que_es.es').click();
  await expect(dialogoAut(page)).toBeVisible();
  await expect(dialogoAut(page).locator('#autorizacion-texto')).toHaveText(TEXTO_AUTORIZACION_ES);
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
});
