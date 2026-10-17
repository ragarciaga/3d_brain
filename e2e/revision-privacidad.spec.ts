// Privacidad del modo revisión (#149): adopción de un código en una página con el beacon de analítica (recarga con
// tope), `?r=` fuera de la barra, llaves locales con huella, "Borrar también de este equipo" y salida sincronizada
// entre pestañas. Solo códigos falsos; el canal del editor nunca se llama. El beacon real no existe en desarrollo
// (el plugin es solo del build): las pruebas lo simulan con un `<script data-cf-beacon>` o con `data-beacon-cargado`.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { claveGuiaVista, claveRevisionIdb } from '../src/lib/huella';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const barra = (page: Page) => page.getByTestId('panel-revision');
const guia = (page: Page) => page.getByTestId('como-revisar');
const dialogoSalida = (page: Page) => page.getByRole('alertdialog', { name: '¿Salir del modo revisión?' });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
});

interface Registro {
  respuestas: Record<string, unknown>;
}

/** Lo que hay en IndexedDB (`keyval-store`) bajo una llave exacta; undefined si no hay. */
const leerIdb = (page: Page, clave: string) =>
  page.evaluate(
    (k) =>
      new Promise<Registro | undefined>((resolver) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => resolver(undefined);
        abrirDb.onsuccess = () => {
          const db = abrirDb.result;
          if (!db.objectStoreNames.contains('keyval')) return resolver(undefined);
          const pedido = db.transaction('keyval').objectStore('keyval').get(k);
          pedido.onsuccess = () => resolver(pedido.result);
          pedido.onerror = () => resolver(undefined);
        };
      }),
    clave,
  );

/** Escribe un valor en IndexedDB (`keyval-store`), creando el almacén si no existe, como lo hace idb-keyval. */
const ponerIdb = (page: Page, clave: string, valor: unknown) =>
  page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolver, rechazar) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onupgradeneeded = () => abrirDb.result.createObjectStore('keyval');
        abrirDb.onerror = () => rechazar(abrirDb.error);
        abrirDb.onsuccess = () => {
          const tx = abrirDb.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(v, k as string);
          tx.oncomplete = () => resolver();
          tx.onerror = () => rechazar(tx.error);
        };
      }),
    [clave, valor] as const,
  );

/** Borra una llave de IndexedDB (`keyval-store`) desde la página, como lo haría otra pestaña. */
const quitarIdb = (page: Page, clave: string) =>
  page.evaluate(
    (k) =>
      new Promise<void>((resolver, rechazar) => {
        const abrirDb = indexedDB.open('keyval-store');
        abrirDb.onerror = () => rechazar(abrirDb.error);
        abrirDb.onsuccess = () => {
          const tx = abrirDb.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').delete(k);
          tx.oncomplete = () => resolver();
          tx.onerror = () => rechazar(tx.error);
        };
      }),
    clave,
  );

const local = (page: Page, clave: string) => page.evaluate((k) => localStorage.getItem(k), clave);

/** Todas las llaves de localStorage, sessionStorage y de todas las bases y almacenes de IndexedDB. */
const todasLasLlaves = (page: Page) =>
  page.evaluate(async () => {
    const llaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) llaves.push(`local:${localStorage.key(i)}`);
    for (let i = 0; i < sessionStorage.length; i++) llaves.push(`sesion:${sessionStorage.key(i)}`);
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolver, rechazar) => {
        const abrir = indexedDB.open(info.name!);
        abrir.onsuccess = () => resolver(abrir.result);
        abrir.onerror = () => rechazar(abrir.error);
      });
      for (const almacen of Array.from(db.objectStoreNames)) {
        const claves = await new Promise<IDBValidKey[]>((resolver, rechazar) => {
          const pedido = db.transaction(almacen).objectStore(almacen).getAllKeys();
          pedido.onsuccess = () => resolver(pedido.result);
          pedido.onerror = () => rechazar(pedido.error);
        });
        for (const c of claves) llaves.push(`idb:${info.name}/${almacen}:${String(c)}`);
      }
      db.close();
    }
    return llaves;
  });

async function irAlHipocampo(page: Page) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/hipocampo$/);
}

async function cerrarGuia(page: Page) {
  await guia(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(guia(page)).toHaveCount(0);
}

const correcto = (page: Page, campo: string) => page.locator(`[data-campo="${campo}"]`).getByRole('button', { name: 'Correcto' });

/** Entra con el enlace, cierra la guía, abre el hipocampo y responde "Correcto" en `ubicacion.es`. */
async function entrarYResponder(page: Page, codigo: string) {
  await page.goto(`/es/revision?r=${codigo}`);
  await expect(barra(page)).toContainText(codigo);
  await cerrarGuia(page);
  await irAlHipocampo(page);
  await correcto(page, 'ubicacion.es').click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect.poll(async () => Object.keys((await leerIdb(page, claveRevisionIdb(codigo)))?.respuestas ?? {})).toContain('hippocampus|ubicacion|es');
}

async function pedirSalida(page: Page) {
  await page.locator('.encabezado').getByRole('button', { name: 'Salir del modo revisión' }).click();
  await expect(dialogoSalida(page)).toBeVisible();
}

/**
 * Con dos páginas en el mismo contexto, cada una cargaría y dibujaría el modelo 3D completo y en un CI con poca CPU
 * el hilo principal de la segunda no atiende teclas ni eventos `storage`. Estas pruebas solo miran la barra, la
 * ficha y el almacenamiento, que no dependen del modelo: se aborta su descarga en todo el contexto.
 */
const sinModelo = (context: BrowserContext) => context.route('**/modelos/atlas.glb', (ruta) => ruta.abort());

const BEACON_FALSO = '{"token":"falso","spa":false}';

// ---------- D1 y D2: adopción en un documento con beacon ----------

test('B1: con beacon en el documento, adoptar el código recordado recarga y queda en modo revisión', async ({ page }) => {
  await page.goto('/es');
  // Simula lo que deja Atrás con bfcache (Playwright lanza Chromium con la caché desactivada): un documento que ya
  // tenía el beacon, y un código que se recordó después en otra pestaña.
  await page.evaluate((cfg) => {
    const s = document.createElement('script');
    s.setAttribute('data-cf-beacon', cfg);
    document.head.appendChild(s);
    (window as unknown as { __marcaDocumento: number }).__marcaDocumento = 1;
    localStorage.setItem('atlas:revisor', 'BEACON01');
  }, BEACON_FALSO);
  await page.getByRole('link', { name: 'Fuentes y licencia' }).click();
  await expect(page).toHaveURL(/\/es\/licencia$/);
  await page.getByRole('link', { name: 'Volver al atlas' }).click();

  // El modo solo puede activarse tras la recarga (en el documento con beacon la app no lo adopta en caliente), así
  // que la marca de la página vieja ya no existe cuando aparece la barra.
  await expect(barra(page)).toContainText('BEACON01');
  expect(await page.evaluate(() => (window as unknown as { __marcaDocumento?: number }).__marcaDocumento)).toBeUndefined();
});

test('B2: sin beacon la adopción es en caliente y no recarga', async ({ page }) => {
  await page.goto('/es');
  await page.evaluate(() => {
    (window as unknown as { __marcaDocumento: number }).__marcaDocumento = 1;
    localStorage.setItem('atlas:revisor', 'BEACON02');
  });
  await page.getByRole('link', { name: 'Fuentes y licencia' }).click();
  await page.getByRole('link', { name: 'Volver al atlas' }).click();
  await expect(barra(page)).toContainText('BEACON02');
  // Leído una vez, después de adoptar: el documento es el mismo (sin recarga) y no quedó marca de recarga.
  expect(await page.evaluate(() => (window as unknown as { __marcaDocumento?: number }).__marcaDocumento)).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('atlas:recarga-revision'))).toBeNull();
});

test('B3: si tras la recarga el documento sigue con beacon, no adopta, avisa y no vuelve a recargar', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e-cargas', String(Number(sessionStorage.getItem('e2e-cargas') ?? '0') + 1));
    localStorage.setItem('atlas:revisor', 'TOPE01');
    // Como un beacon que no se quita con la recarga: <html> lleva la marca del cargador en cada carga.
    const marcar = () => document.documentElement?.setAttribute('data-beacon-cargado', '1');
    marcar();
    new MutationObserver(marcar).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/es');
  await expect(page.getByTestId('revision-bloqueada')).toContainText('No pudimos abrir el modo revisión en esta pestaña');
  // Estado final, leído una vez: una sola recarga (dos cargas), sin bucle y sin modo revisión.
  await expect(barra(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __atlas: { getState(): { revisor: string | null } } }).__atlas.getState().revisor)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('e2e-cargas'))).toBe('2');
});

test('la rama que recarga no escribe atlas:revisor antes de recargar (solo lo escribe la carga limpia)', async ({ page }) => {
  await page.addInitScript(() => {
    const carga = String(Number(sessionStorage.getItem('e2e-cargas') ?? '0') + 1);
    sessionStorage.setItem('e2e-cargas', carga);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, clave: string, valor: string) {
      if (this === localStorage && clave === 'atlas:revisor') {
        const previo = JSON.parse(sessionStorage.getItem('e2e-escrituras') ?? '[]') as string[];
        original.call(sessionStorage, 'e2e-escrituras', JSON.stringify([...previo, carga]));
      }
      original.call(this, clave, valor);
    };
  });
  await page.goto('/es');
  await page.evaluate((cfg) => {
    const s = document.createElement('script');
    s.setAttribute('data-cf-beacon', cfg);
    document.head.appendChild(s);
    (window as unknown as { __marcaDocumento: number }).__marcaDocumento = 1;
    // Navegación del cliente a un enlace de revisión, dentro de un documento que tiene el beacon.
    history.pushState({}, '', '/es/revision?r=SINESCRIBIR01');
    dispatchEvent(new PopStateEvent('popstate'));
  }, BEACON_FALSO);
  await expect(barra(page)).toContainText('SINESCRIBIR01');
  expect(await page.evaluate(() => (window as unknown as { __marcaDocumento?: number }).__marcaDocumento)).toBeUndefined();
  // Leído una vez: el código solo se escribió en la carga 2 (la limpia), nunca en la carga 1 (con beacon).
  const escrituras = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-escrituras') ?? '[]') as string[]);
  expect(escrituras.length).toBeGreaterThan(0);
  expect([...new Set(escrituras)]).toEqual(['2']);
});

// ---------- Escritura del código: solo si vino del enlace ----------

/** Anota en sessionStorage cada escritura de `atlas:revisor` en localStorage (la anotación sobrevive a recargas). */
const espiarEscrituraDelCodigo = (page: Page) =>
  page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, clave: string, valor: string) {
      if (this === localStorage && clave === 'atlas:revisor') {
        const previo = JSON.parse(sessionStorage.getItem('e2e-escrituras') ?? '[]') as string[];
        original.call(sessionStorage, 'e2e-escrituras', JSON.stringify([...previo, valor]));
      }
      original.call(this, clave, valor);
    };
  });

const escrituras = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-escrituras') ?? '[]') as string[]);

test('un código que viene del almacén no se vuelve a escribir al navegar dentro de la app', async ({ page, context }) => {
  await sinModelo(context);
  await entrarYResponder(page, 'SOLOUNA01');

  // Otra pestaña del mismo navegador: adopta el código recordado, sin enlace.
  const otra = await context.newPage();
  await espiarEscrituraDelCodigo(otra);
  await otra.goto('/es');
  await expect(barra(otra)).toContainText('SOLOUNA01');
  await irAlHipocampo(otra);
  await otra.getByRole('link', { name: 'Fuentes y licencia' }).click();
  await expect(otra).toHaveURL(/\/es\/licencia$/);
  await otra.getByRole('link', { name: 'Volver al atlas' }).click();
  await expect(barra(otra)).toContainText('SOLOUNA01');
  await irAlHipocampo(otra);

  // Ninguna carga ni navegación de esa pestaña escribió el código (podría resucitar uno borrado desde otra pestaña).
  expect(await escrituras(otra)).toEqual([]);
  expect(await local(otra, 'atlas:revisor')).toBe('SOLOUNA01');
});

test('un código que viene del enlace sí se escribe y queda recordado', async ({ page }) => {
  await espiarEscrituraDelCodigo(page);
  await page.goto('/es/revision?r=ENLACE01');
  await expect(barra(page)).toContainText('ENLACE01');
  await expect(page).toHaveURL(/\/es\/revision$/);
  const hechas = await escrituras(page);
  expect(hechas.length).toBeGreaterThan(0);
  expect([...new Set(hechas)]).toEqual(['ENLACE01']);
  expect(await local(page, 'atlas:revisor')).toBe('ENLACE01');
});

// ---------- D5: ?r= fuera de la barra ----------

test('S5: tras un ?r= válido la barra no lleva r, Atrás no vuelve a él y el modo sigue tras recargar', async ({ page }) => {
  await page.goto('/es');
  await page.goto('/es/revision?r=LIMPIA01&otro=1#frag');
  await expect(barra(page)).toContainText('LIMPIA01');
  await expect(page).toHaveURL(/\/es\/revision\?otro=1#frag$/);

  await page.reload();
  await expect(barra(page)).toContainText('LIMPIA01');
  expect(page.url()).not.toContain('r=');

  await page.goBack();
  expect(page.url()).not.toMatch(/[?&]r=/);
  expect(new URL(page.url()).pathname).toBe('/es');
});

test('S5: sin otros parámetros la URL queda en /es/revision', async ({ page }) => {
  await page.goto('/es/revision?r=LIMPIA02');
  await expect(barra(page)).toContainText('LIMPIA02');
  await expect(page).toHaveURL(/\/es\/revision$/);
});

test('S5: un ?r= inválido se queda en la barra con su aviso', async ({ page }) => {
  await page.goto('/es/revision?r=mal%20codigo');
  await expect(page.getByTestId('enlace-invalido')).toBeVisible();
  expect(page.url()).toContain('r=');
  await expect(barra(page)).toHaveCount(0);
});

// ---------- D6: llaves con huella ----------

test('S6: ninguna llave de localStorage, sessionStorage ni IndexedDB contiene el código en claro', async ({ page }) => {
  await entrarYResponder(page, 'CLARO01');
  expect(await local(page, claveGuiaVista('CLARO01'))).toBe('1');
  const llaves = await todasLasLlaves(page);
  expect(llaves).toContain(`idb:keyval-store/keyval:${claveRevisionIdb('CLARO01')}`);
  expect(llaves).toContain(`local:${claveGuiaVista('CLARO01')}`);
  expect(llaves.filter((l) => l.includes('CLARO01'))).toEqual([]);
});

// ---------- D7: salir con y sin borrar ----------

test('S6: salir sin marcar la casilla conserva el registro y la guía', async ({ page }) => {
  await entrarYResponder(page, 'GUARDA01');
  await pedirSalida(page);
  const casilla = dialogoSalida(page).getByTestId('salir-borrar');
  await expect(casilla).toBeVisible();
  await expect(casilla).not.toBeChecked();
  await expect(dialogoSalida(page).getByLabel('Borrar también de este equipo')).toBeVisible();
  await expect(dialogoSalida(page)).toContainText('Borra de este navegador');
  await dialogoSalida(page).getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(barra(page)).toHaveCount(0);

  // Al reabrir, el avance sigue y la guía no se abre sola.
  await page.goto('/es/revision?r=GUARDA01');
  await expect(barra(page)).toContainText('GUARDA01');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect(guia(page)).toHaveCount(0);
  expect(await leerIdb(page, claveRevisionIdb('GUARDA01'))).toBeDefined();
  expect(await local(page, claveGuiaVista('GUARDA01'))).toBe('1');
});

test('S6: la ayuda de la casilla nombra historial, formulario de Google, Descargas y portapapeles', async ({ page }) => {
  await page.goto('/es/revision?r=AYUDA01');
  await expect(barra(page)).toContainText('AYUDA01');
  await cerrarGuia(page);
  await pedirSalida(page);
  const ayuda = dialogoSalida(page).locator('#salir-borrar-ayuda');
  await expect(ayuda).toBeVisible();
  for (const parte of ['historial del navegador', 'formulario de Google', 'Descargas', 'portapapeles', 'ventana privada']) {
    await expect(ayuda).toContainText(parte);
  }
});

test('S6: salir con la casilla marcada borra el registro y la guía de ese código, también en claro, y deja los de otro', async ({ page }) => {
  await page.goto('/es');
  await ponerIdb(page, claveRevisionIdb('OTRO01'), { respuestas: {}, confirmadas: {} });
  await ponerIdb(page, 'revision:BORRA01', { respuestas: {}, confirmadas: {} });
  await page.evaluate(
    ([guiaOtro, guiaClaro]) => {
      localStorage.setItem(guiaOtro!, '1');
      localStorage.setItem(guiaClaro!, '1');
    },
    [claveGuiaVista('OTRO01'), 'atlas:guia-vista:BORRA01'],
  );

  await entrarYResponder(page, 'BORRA01');
  await pedirSalida(page);
  await dialogoSalida(page).getByTestId('salir-borrar').check();
  await dialogoSalida(page).getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(barra(page)).toHaveCount(0);

  await expect.poll(() => leerIdb(page, claveRevisionIdb('BORRA01'))).toBeUndefined();
  expect(await leerIdb(page, 'revision:BORRA01')).toBeUndefined();
  expect(await local(page, claveGuiaVista('BORRA01'))).toBeNull();
  expect(await local(page, 'atlas:guia-vista:BORRA01')).toBeNull();
  expect(await local(page, 'atlas:revisor')).toBeNull();
  expect(await leerIdb(page, claveRevisionIdb('OTRO01'))).toBeDefined();
  expect(await local(page, claveGuiaVista('OTRO01'))).toBe('1');

  // Al reabrir, la guía se abre sola y no hay respuestas.
  await page.goto('/es/revision?r=BORRA01');
  await expect(guia(page)).toBeVisible();
  await expect(page.getByTestId('total-respuestas')).toHaveText('0 respuestas');
});

// ---------- D8: varias pestañas ----------

test('P1: salir y borrar en una pestaña saca a la otra del modo y no vuelve a escribir sus llaves', async ({ page, context }) => {
  await sinModelo(context);
  await entrarYResponder(page, 'MULTI01');

  const otra = await context.newPage();
  await otra.goto('/es');
  await expect(barra(otra)).toContainText('MULTI01');
  await irAlHipocampo(otra);
  await expect(correcto(otra, 'ubicacion.es')).toBeVisible();

  await pedirSalida(page);
  await dialogoSalida(page).getByTestId('salir-borrar').check();
  await dialogoSalida(page).getByRole('button', { name: 'Salir', exact: true }).click();
  await expect.poll(() => leerIdb(page, claveRevisionIdb('MULTI01'))).toBeUndefined();

  // La otra pestaña sale del modo sin que nadie la toque (estado final, así que toHaveCount(0) es válido).
  await expect(barra(otra)).toHaveCount(0);
  await expect(correcto(otra, 'ubicacion.es')).toHaveCount(0);

  // Un intento de responder en la otra pestaña no recrea el registro ni la guía.
  await otra.evaluate(() =>
    (
      window as unknown as { __atlas: { getState(): { responder(r: unknown): void } } }
    ).__atlas.getState().responder({
      estructura: 'hippocampus',
      campo: 'para_que_sirve',
      idioma: 'es',
      veredicto: 'correcto',
      version: 'sin-ficha',
      fecha: new Date().toISOString(),
    }),
  );
  await otra.waitForTimeout(1000);
  expect(await leerIdb(otra, claveRevisionIdb('MULTI01'))).toBeUndefined();
  expect(await local(otra, claveGuiaVista('MULTI01'))).toBeNull();
  expect(await local(otra, 'atlas:revisor')).toBeNull();
});

test('P2: si el código se retira sin aviso, las escrituras de registro y de guía se frenan', async ({ page }) => {
  await entrarYResponder(page, 'GUARDIA01');

  // En la misma pestaña no hay evento `storage`: el código y el registro desaparecen sin que la app se entere.
  await page.evaluate((guiaHuella) => {
    localStorage.removeItem('atlas:revisor');
    localStorage.removeItem(guiaHuella);
  }, claveGuiaVista('GUARDIA01'));
  await quitarIdb(page, claveRevisionIdb('GUARDIA01'));

  await correcto(page, 'para_que_sirve.es').click();
  await expect(page.getByTestId('total-respuestas')).toHaveText('2 respuestas');
  await page.waitForTimeout(1000);
  expect(await leerIdb(page, claveRevisionIdb('GUARDIA01'))).toBeUndefined();

  // Abrir y cerrar la guía tampoco recrea la llave de "guía vista".
  await barra(page).getByRole('button', { name: 'Cómo revisar' }).click();
  await expect(guia(page)).toBeVisible();
  await cerrarGuia(page);
  expect(await local(page, claveGuiaVista('GUARDIA01'))).toBeNull();
});
