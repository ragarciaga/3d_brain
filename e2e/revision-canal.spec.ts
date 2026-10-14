// Canal de retorno de la revisión docente (spec 03): enlace con código, modo revisión, autorización y avisos.
// Las tareas T7 a T10 de ese spec amplían este archivo. Helpers propios para no depender de otros specs.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { VERSION_AUTORIZACION } from '../src/config/revision';

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
}

interface CanalSimulado {
  autorizacion: unknown;
  leer: 'ok' | 'red';
  autorizar: 'ok' | 'red' | 'interno';
  /** Si existe, la respuesta de `leer` espera a que se resuelva (para probar lo que pasa mientras la lectura está pendiente). */
  retenerLeer: Promise<void> | null;
  peticiones: PeticionCanal[];
}

const CORS = { 'access-control-allow-origin': '*' };

async function simularCanal(page: Page, inicial: Partial<Pick<CanalSimulado, 'autorizacion' | 'leer' | 'autorizar'>> = {}): Promise<CanalSimulado> {
  const canal: CanalSimulado = { autorizacion: null, leer: 'ok', autorizar: 'ok', retenerLeer: null, peticiones: [], ...inicial };
  await page.route(
    (u) => u.hostname === 'canal-prueba.invalid',
    async (route) => {
      const pedido = route.request();
      const url = new URL(pedido.url());
      const json = (cuerpo: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(cuerpo) });
      if (pedido.method() === 'GET') {
        const accion = url.searchParams.get('accion');
        canal.peticiones.push({ metodo: 'GET', accion, url: pedido.url(), cuerpo: null });
        if (accion !== 'leer' || canal.leer === 'red') return route.abort('failed');
        if (canal.retenerLeer) await canal.retenerLeer;
        return json({ ok: true, respuestas: { v: 2, r: url.searchParams.get('r'), e: {} }, autorizacion: canal.autorizacion });
      }
      const cuerpo = JSON.parse(pedido.postData() ?? '{}') as Record<string, unknown>;
      const accion = typeof cuerpo['accion'] === 'string' ? cuerpo['accion'] : null;
      canal.peticiones.push({ metodo: pedido.method(), accion, url: pedido.url(), cuerpo });
      if (accion === 'autorizar') {
        if (canal.autorizar === 'red') return route.abort('failed');
        return json(canal.autorizar === 'interno' ? { ok: false, error: 'interno' } : { ok: true });
      }
      if (accion === 'guardar') return json({ ok: true, recibidas: [] });
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
  expect(peticionesDe(canal, 'leer').every((p) => new URL(p.url).searchParams.get('r') === 'AUT01')).toBe(true);

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
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // R2.6: con el canal, la guía ya no habla de un registro previo con nombre ni de rol, ni enlaza al formulario.
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  const guia = page.getByTestId('como-revisar');
  await expect(guia).toBeVisible();
  await expect(guia).not.toContainText(/regístrate/i);
  await expect(guia.getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(0);
  await expect(guia.getByRole('link')).toHaveCount(0);
});

test('autorización: la vigente no se vuelve a pedir, ni sin conexión, y la del canal manda sobre la copia local', async ({ page, context }) => {
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false } });
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

test('autorización: sin urlCanal no aparece el diálogo ni sale ninguna petición', async ({ page, context }) => {
  const salidas: string[] = [];
  page.on('request', (p) => {
    const url = new URL(p.url());
    if (url.searchParams.has('accion') || ['canal-prueba.invalid', 'script.google.com'].includes(url.hostname) || (p.postData() ?? '').includes('"accion"')) {
      salidas.push(`${p.method()} ${p.url()}`);
    }
  });
  await conCanal(context, '');
  await entrarEnRevision(page, context, 'AUT05');
  await correcto(page, 'que_es.es').click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await asentar(page);
  await expect(dialogoAut(page)).toHaveCount(0);
  expect(salidas).toEqual([]);
  const estado = await estadoDelStore(page);
  expect(estado).toEqual({ autorizacion: null, lecturaCanal: 'pendiente' });

  // Control de R2.6: sin canal la guía queda como siempre, con el aviso de registro y su enlace.
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(page.getByTestId('como-revisar')).toContainText('regístrate');
  await expect(page.getByTestId('como-revisar').getByRole('link', { name: 'Registrarme (una sola vez)' })).toHaveCount(1);
});
