// Verificación de la feature "canal de retorno de la revisión docente" (spec 03, docs/specs/03-review-return-channel/test-plan.md).
// La suite ya cubre casi todos los casos del plan (revision-canal, revision-dialogos, respaldo, atlas). Este archivo
// solo trae lo que ninguna prueba existente comprobaba con la condición observable del plan:
//   F2-E2  cerrar el diálogo sin aceptar: nada sale, no hay "Guardado ✓" y la respuesta queda pendiente en el equipo.
//   F3-E2  sin conexión: el aviso, la respuesta pendiente y ningún paso de envío; más el tope literal de 3 s de R3.1.
//   F4-E1  respuestas malformadas del canal: solo se muestra la válida y la página no se rompe (R6.6).
//   F7-E1  vistas públicas sin alias del padrón ni "revisor" con un nombre (R9.2), en es y en en.
// El canal del editor se simula siempre con page.route sobre `canal-prueba.invalid`; el real nunca se llama.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { VERSION_AUTORIZACION } from '../src/config/revision';
import { ESPERA_CANAL_MS } from '../src/lib/colaGuardado';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
});

const URL_CANAL = 'https://canal-prueba.invalid/macros/s/e2e/exec';
const CORS = { 'access-control-allow-origin': '*' };

const barra = (page: Page) => page.getByTestId('panel-revision');
const estadoGuardado = (page: Page) => page.getByTestId('estado-guardado');
const dialogoAut = (page: Page) => page.getByTestId('dialogo-autorizacion');
const correcto = (page: Page, campo: string) => page.locator(`[data-campo="${campo}"]`).getByRole('button', { name: 'Correcto' });

/** Fija la URL del canal antes de la primera carga (costura de desarrollo de src/main.tsx). */
const conCanal = (context: BrowserContext) =>
  context.addInitScript((u) => {
    (window as unknown as { __urlCanalInicial?: string }).__urlCanalInicial = u;
  }, URL_CANAL);

/** Con la guía ya vista no se abre sola y no tapa los controles. */
const saltarGuia = (context: BrowserContext, codigo: string) =>
  context.addInitScript((c) => localStorage.setItem(`atlas:guia-vista:${c}`, '1'), codigo);

interface Peticion {
  accion: string | null;
  cuerpo: Record<string, unknown> | null;
}

interface Canal {
  autorizacion: unknown;
  guardar: 'ok' | 'red';
  respuestas: Record<string, Record<string, unknown>[]>;
  peticiones: Peticion[];
}

/** Protocolo del Apps Script (`leer`, `autorizar`, `guardar`), con lo mínimo que necesitan estos casos. */
async function simularCanal(page: Page, inicial: Partial<Pick<Canal, 'autorizacion' | 'guardar' | 'respuestas'>> = {}): Promise<Canal> {
  const canal: Canal = { autorizacion: null, guardar: 'ok', respuestas: {}, peticiones: [], ...inicial };
  await page.route(
    (u) => u.hostname === 'canal-prueba.invalid',
    async (route) => {
      const pedido = route.request();
      const url = new URL(pedido.url());
      const json = (cuerpo: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(cuerpo) });
      if (pedido.method() === 'GET') {
        // La app lee por POST (S4, #162): un GET es una petición que no debería salir.
        canal.peticiones.push({ accion: url.searchParams.get('accion'), cuerpo: null });
        return route.abort('failed');
      }
      const cuerpo = JSON.parse(pedido.postData() ?? '{}') as Record<string, unknown>;
      const accion = typeof cuerpo['accion'] === 'string' ? cuerpo['accion'] : null;
      canal.peticiones.push({ accion, cuerpo });
      if (accion === 'leer') return json({ ok: true, respuestas: { v: 2, r: cuerpo['r'], e: canal.respuestas }, autorizacion: canal.autorizacion });
      if (accion === 'autorizar') return json({ ok: true });
      if (accion === 'guardar') {
        if (canal.guardar === 'red') return route.abort('failed');
        const e = (JSON.parse(String(cuerpo['carga'])) as { e: Record<string, { c: string; i?: string; f?: string }[]> }).e;
        const recibidas = Object.entries(e).flatMap(([id, elementos]) => elementos.map((el) => [id, el.c, el.i ?? '', el.f ?? ''].join('|')));
        return json({ ok: true, recibidas });
      }
      return route.abort('failed');
    },
  );
  return canal;
}

const peticionesDe = (canal: Canal, accion: string) => canal.peticiones.filter((p) => p.accion === accion);

const lecturaDelStore = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState: () => { lecturaCanal: string } } }).__atlas.getState().lecturaCanal);

const autorizacionDelStore = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState: () => { autorizacion: unknown } } }).__atlas.getState().autorizacion);

interface RevisionGuardada {
  respuestas: Record<string, { fecha: string }>;
  confirmadas: Record<string, string>;
}

/** El registro `revision:<código>` de IndexedDB (undefined si no hay). */
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

/** Entra directo a la ficha del hipocampo con el código ya recordado, sin guía ni búsqueda. */
async function entrarDirecto(page: Page, context: BrowserContext, codigo: string) {
  await saltarGuia(context, codigo);
  await context.addInitScript((c) => localStorage.setItem('atlas:revisor', c), codigo);
  await page.goto('/es/hipocampo');
  await expect(barra(page)).toContainText(codigo);
  await expect(correcto(page, 'que_es.es')).toBeVisible();
}

const TEXTOS_DE_ENVIO = /Enviar revisión|Enviar todo|Abrir formulario|Sí, lo envié|Enviar por formulario/;

/** R3.7: con el canal activo no hay ningún paso de envío por formulario antes de los 10 min sin confirmación. */
async function sinPasosDeEnvio(page: Page) {
  await expect(page.getByRole('button', { name: TEXTOS_DE_ENVIO })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Abrir formulario/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(TEXTOS_DE_ENVIO);
}

test('F2-E2: cerrar el diálogo sin aceptar (Escape o Cerrar) deja la respuesta pendiente en el equipo, sin Guardado ✓ ni peticiones', async ({
  page,
  context,
}) => {
  // Reloj simulado: las aserciones negativas se leen una sola vez, después de pasar el tope de 3 s de R3.1. Leídas antes,
  // una app que enviara `guardar` tras cerrar el diálogo pasaría igual. Tampoco se usa rAF: el reloj pausado lo congela.
  await page.clock.install();
  const canal = await simularCanal(page, { autorizacion: null });
  await conCanal(context);
  await entrarDirecto(page, context, 'VER01');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);
  const pasarElTope = async () => {
    await page.clock.fastForward(ESPERA_CANAL_MS + 1000);
    await page.waitForTimeout(500); // tiempo real: deja llegar al simulador y pintar lo que hubiera disparado el salto
  };

  // Escape: el diálogo se cierra, la respuesta sigue en la ficha y en IndexedDB, y no sale nada.
  await correcto(page, 'que_es.es').click({ force: true });
  await expect(dialogoAut(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogoAut(page)).toHaveCount(0);
  await pasarElTope();
  await expect(correcto(page, 'que_es.es')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect.poll(async () => Object.keys((await revisionGuardada(page, 'VER01'))?.respuestas ?? {})).toContain('hippocampus|que_es|es');
  expect((await revisionGuardada(page, 'VER01'))?.confirmadas ?? {}).toEqual({});
  expect(await estadoGuardado(page).textContent()).not.toContain('Guardado ✓');
  expect(await autorizacionDelStore(page)).toBeNull();
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);

  // Cerrar: igual con el botón del diálogo, en el siguiente cambio.
  await correcto(page, 'ubicacion.es').click({ force: true });
  await expect(dialogoAut(page)).toBeVisible();
  await dialogoAut(page).getByRole('button', { name: 'Cerrar' }).click({ force: true });
  await expect(dialogoAut(page)).toHaveCount(0);
  await pasarElTope();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  await expect.poll(async () => Object.keys((await revisionGuardada(page, 'VER01'))?.respuestas ?? {}).sort()).toEqual([
    'hippocampus|que_es|es',
    'hippocampus|ubicacion|es',
  ]);
  expect((await revisionGuardada(page, 'VER01'))?.confirmadas ?? {}).toEqual({});
  expect(await estadoGuardado(page).textContent()).not.toContain('Guardado ✓');
  expect(peticionesDe(canal, 'autorizar')).toHaveLength(0);
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
});

test('F3-E2: sin conexión el panel avisa, la respuesta sigue pendiente y no aparece ningún paso de envío; el primer intento sale a los 3 s', async ({
  page,
  context,
}) => {
  await page.clock.install();
  const canal = await simularCanal(page, { autorizacion: { version: VERSION_AUTORIZACION, vago: false }, guardar: 'red' });
  await conCanal(context);
  await entrarDirecto(page, context, 'VER02');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  const ahora = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(ahora + 1000);

  // R3.1: el tope de la spec es de 3 s; el simulador no ve nada antes del cambio y sí a los 3 s (valor escrito aquí, no el de la app).
  expect(ESPERA_CANAL_MS).toBe(3000);
  await correcto(page, 'que_es.es').click({ force: true });
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
  await page.clock.fastForward(3000);
  await expect.poll(() => peticionesDe(canal, 'guardar').length).toBe(1);

  // F3-E2: el aviso, la respuesta pendiente y ningún paso de envío (R3.4 visible, R3.7).
  await expect(estadoGuardado(page)).toHaveText('Sin conexión: se guardará cuando vuelva');
  await expect(estadoGuardado(page)).not.toContainText('Guardado ✓');
  await sinPasosDeEnvio(page);
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  const guardada = await revisionGuardada(page, 'VER02');
  expect(guardada?.respuestas).toHaveProperty(['hippocampus|que_es|es']);
  expect(guardada?.confirmadas ?? {}).not.toHaveProperty(['hippocampus|que_es|es']);
});

const VERSION_HIPOCAMPO = (JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as { estructuras: Record<string, { ficha: { version: string } }> })
  .estructuras['hippocampus']!.ficha.version;
const FECHA_CANAL = '2026-01-01T10:00:00.000Z';

test('F4-E1: de lo que devuelve el canal solo se muestra la respuesta válida; la malformada ni se ve ni rompe la página', async ({ page, context }) => {
  // Reloj simulado sin pausar: al final se pasa el tope de 3 s de R3.1 para leer una sola vez que no salió ningún `guardar`.
  await page.clock.install();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = { i: 'es', s: VERSION_HIPOCAMPO, f: FECHA_CANAL };
  const canal = await simularCanal(page, {
    autorizacion: { version: VERSION_AUTORIZACION, vago: false },
    respuestas: {
      hippocampus: [
        { c: 'que_es', d: 'correcto', ...base }, // válida
        { c: 'ubicacion', d: 'excelente', ...base }, // veredicto inventado
        { c: 'para_que_sirve', d: 'correcto', ...base, extra: 'no permitido' }, // clave fuera del protocolo
      ],
      'estructura-inventada': [{ c: 'que_es', d: 'correcto', ...base }], // clave inexistente
    },
  });
  await conCanal(context);
  await saltarGuia(context, 'VER03');

  await page.goto('/es/revision?r=VER03');
  await expect(barra(page)).toContainText('VER03');
  await expect.poll(() => lecturaDelStore(page)).toBe('hecha');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');

  // La ficha del hipocampo marca solo la válida.
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
  await expect(correcto(page, 'que_es.es')).toHaveAttribute('aria-pressed', 'true');
  for (const campo of ['ubicacion.es', 'para_que_sirve.es']) {
    await expect(page.locator(`[data-campo="${campo}"]`)).toBeVisible();
    await expect(page.locator(`[data-campo="${campo}"] [aria-pressed="true"]`)).toHaveCount(0);
  }
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await page.clock.fastForward(ESPERA_CANAL_MS + 1000);
  await page.waitForTimeout(500); // tiempo real: deja llegar al simulador lo que hubiera disparado el salto
  expect(errores).toEqual([]);
  // Lo válido ya lo tiene el canal y lo malformado no se reenvía como si fuera del docente.
  expect(peticionesDe(canal, 'guardar')).toHaveLength(0);
});

// R9.2: ninguna vista pública muestra un alias del padrón (`D` y dos cifras) ni "revisor" seguido de un nombre.
const ALIAS = /\bD\d{2}\b/;
const REVISOR_CON_NOMBRE = /\b(?:[Rr]evisor(?:a|es)?|[Rr]eviewers?)\s*:?\s+\p{Lu}\p{Ll}+/u;

for (const [lang, ficha, licencia] of [
  ['es', 'hipocampo', 'Fuentes y licencia'],
  ['en', 'hippocampus', 'Sources and license'],
] as const) {
  test(`F7-E1: las vistas públicas (inicio, ficha sin verificar, licencia) no muestran alias ni revisor con nombre (${lang})`, async ({ page }) => {
    const sinRevisor = async (vista: string) => {
      const texto = await page.locator('body').innerText();
      expect(texto, `texto de ${vista}`).not.toMatch(ALIAS);
      expect(texto, `texto de ${vista}`).not.toMatch(REVISOR_CON_NOMBRE);
      // `innerText` no ve title, aria-label ni alt: también se mira el HTML del cuerpo.
      const html = await page.locator('body').evaluate((el) => el.outerHTML);
      expect(html, `HTML de ${vista}`).not.toMatch(ALIAS);
      expect(html, `HTML de ${vista}`).not.toMatch(REVISOR_CON_NOMBRE);
    };

    await page.goto(`/${lang}`);
    await expect(page.getByTestId('idioma-actual')).toHaveText(lang.toUpperCase());
    await expect(page.getByRole('link', { name: licencia })).toBeVisible();
    await sinRevisor('inicio');

    // La ficha se abre como lo hace la app al elegir una pieza; sin verificar, dice que es borrador.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('atlas:elegir', { detail: { entrada: 'hippocampus' } })));
    await expect(page).toHaveURL(new RegExp(`/${lang}/${ficha}$`));
    await expect(page.getByTestId('estado-revision')).toHaveText(lang === 'es' ? 'Borrador: aún no revisado por docentes' : 'Draft: not yet reviewed by teachers');
    await expect(page.getByTestId('ficha')).not.toContainText(/Revisado por un docente universitario|Reviewed by a university teacher/);
    await sinRevisor('ficha');

    await page.getByRole('link', { name: licencia }).click();
    await expect(page.getByTestId('licencia')).toContainText('Z-Anatomy');
    await sinRevisor('licencia');
  });
}
