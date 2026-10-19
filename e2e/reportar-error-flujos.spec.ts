// "Reportar un error" (F12, spec 05) como flujos de usuario, de punta a punta: plan en
// docs/specs/05-error-report/test-plan.md (F1-H, F1-E1, F1-E2, F2-H, F2-E1, F2-E2, F3-H, F3-E1, F3-E2).
// Las pruebas por tarea (botón, diálogo, formulario, almacenes, red, borrador y revisión bloqueada) siguen en
// e2e/reportar-error.spec.ts; aquí cada caso recorre el flujo completo que vive un estudiante.
// Nombres, slugs, versión y textos se leen de src/data, src/i18n y src/config (oráculo de solo lectura). Los códigos
// de revisión son de prueba y el canal real del editor nunca se llama (`protegerCanalReal`). Toda navegación a
// github.com se intercepta y se aborta.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { CORREO_REPORTES, MAX_DESCRIPCION, PLANTILLA, URL_ISSUES, type TipoReporte } from '../src/config/reporte';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

interface Entrada {
  nombre: { es: string; en: string };
  slug: { es: string; en: string };
  ficha: { version: string };
}
const estructuras = (JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as { estructuras: Record<string, Entrada> }).estructuras;
const HIPOCAMPO = estructuras['hippocampus']!;
const AMIGDALA = estructuras['amygdaloid-body']!;

type Lang = 'es' | 'en';
const textos: Record<Lang, unknown> = {
  es: JSON.parse(readFileSync('src/i18n/es.json', 'utf8')),
  en: JSON.parse(readFileSync('src/i18n/en.json', 'utf8')),
};
/** Texto de i18n en un idioma, con `{{x}}` llenado. Falla si la clave no existe. */
function tr(idioma: Lang, clave: string, vars: Record<string, string | number> = {}): string {
  let nodo = textos[idioma] as unknown;
  for (const parte of clave.split('.')) nodo = (nodo as Record<string, unknown> | undefined)?.[parte];
  if (typeof nodo !== 'string') throw new Error(`Falta la clave ${clave} en ${idioma}`);
  return nodo.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k]));
}

const TIPOS_FORM: TipoReporte[] = ['contenido', 'traduccion', 'enlace-roto', 'pieza'];

// --- Ayudas ---

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const pie = (page: Page) => page.getByTestId('ficha-pie');
const botonReportar = (page: Page, idioma: Lang) => pie(page).getByRole('button', { name: tr(idioma, 'reporte.boton'), exact: true });
const dialogo = (page: Page) => page.getByTestId('dialogo-reporte');
const descripcionDe = (page: Page) => dialogo(page).locator('textarea');
const parteDe = (page: Page) => dialogo(page).locator('select');
const enlaceGithubDe = (page: Page, idioma: Lang) => dialogo(page).getByRole('link', { name: tr(idioma, 'reporte.abrirGithub') });
const enlaceCorreoDe = (page: Page, idioma: Lang) => dialogo(page).getByRole('link', { name: tr(idioma, 'reporte.enviarCorreo') });
const cerrarDe = (page: Page, idioma: Lang) => dialogo(page).getByRole('button', { name: tr(idioma, 'reporte.cerrar'), exact: true });
const contadorDe = (page: Page, idioma: Lang, n: number) => dialogo(page).getByText(tr(idioma, 'reporte.contador', { n, max: MAX_DESCRIPCION }), { exact: true });
const elegirTipo = (page: Page, idioma: Lang, tipo: TipoReporte) =>
  dialogo(page).getByRole('radio', { name: tr(idioma, `reporte.tipo.${tipo}`), exact: true }).check();

/** Espera a que la ficha de la entrada esté en pantalla, no solo la URL. */
async function fichaLista(page: Page, id: string, nombre: string) {
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', id);
  await expect(page.locator('#ficha-titulo')).toHaveText(nombre);
}

/** Abre una ficha como la abre un estudiante: Ctrl+K, escribe y Enter. */
async function abrirFichaPorBusqueda(page: Page, consulta: string, entrada: Entrada, id: string) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill(consulta);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/es/${entrada.slug.es}$`));
  await fichaLista(page, id, entrada.nombre.es);
}

/** Aborta toda navegación a github.com y anota su dirección. */
async function interceptarGithub(context: BrowserContext): Promise<string[]> {
  const vistas: string[] = [];
  await context.route(
    (url) => url.hostname === 'github.com',
    async (ruta) => {
      vistas.push(ruta.request().url());
      await ruta.abort('blockedbyclient');
    },
  );
  return vistas;
}

/** Cuenta las pestañas nuevas del contexto. */
function contarPestanasNuevas(context: BrowserContext): { n: () => number; paginas: Page[] } {
  const paginas: Page[] = [];
  context.on('page', (p) => paginas.push(p));
  return { n: () => paginas.length, paginas };
}

async function desactivado(enlace: Locator) {
  await expect(enlace).toHaveAttribute('aria-disabled', 'true');
  await expect(enlace).not.toHaveAttribute('href', /.*/);
}

function leerGithub(href: string): Record<string, string> {
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe(URL_ISSUES);
  // Exactamente los siete parámetros, ni uno más (nada de la ubicación de la página).
  expect([...url.searchParams.keys()]).toHaveLength(7);
  return Object.fromEntries(url.searchParams);
}

function esperadoGithub(idioma: Lang, tipo: TipoReporte, parte: string, descripcion: string) {
  return {
    template: PLANTILLA[tipo],
    title: `[${tr(idioma, `reporte.tipo.${tipo}`)}] ${HIPOCAMPO.nombre[idioma]} (hippocampus)`,
    estructura: 'hippocampus',
    idioma,
    version: HIPOCAMPO.ficha.version,
    parte,
    descripcion,
  };
}

function esperadoCorreo(idioma: Lang, tipo: TipoReporte, parte: string, descripcion: string): string {
  const version = HIPOCAMPO.ficha.version;
  const asunto = tr(idioma, 'reporte.correo.asunto', { tipo: tr(idioma, `reporte.tipo.${tipo}`), id: 'hippocampus', idioma, version });
  const cuerpo = tr(idioma, 'reporte.correo.cuerpo', { estructura: 'hippocampus', idioma, version, parte, descripcion });
  return `mailto:${CORREO_REPORTES}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/** Abre la ficha del hipocampo por URL y el diálogo de reporte. Devuelve el botón del pie. */
async function abrirDialogo(page: Page, idioma: Lang): Promise<Locator> {
  await abrir(page, `/${idioma}/${HIPOCAMPO.slug[idioma]}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre[idioma]);
  const reportar = botonReportar(page, idioma);
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  return reportar;
}

// --- F1: el estudiante encuentra el botón y abre el reporte ---

test('F1-H: desde la búsqueda, el botón está en el pie de la ficha y el diálogo se abre y se cierra con Escape y con "Cerrar"', async ({ page }) => {
  await abrir(page, '/es');
  await abrirFichaPorBusqueda(page, 'hipocampo', HIPOCAMPO, 'hippocampus');

  const reportar = botonReportar(page, 'es');
  await expect(reportar).toBeVisible();
  // R1.1: el bloque de fuentes sigue cerrado y el botón no está dentro de él.
  await expect(page.locator('details.ficha-fuentes')).not.toHaveAttribute('open', /.*/);
  expect(await reportar.evaluate((el) => el.closest('details.ficha-fuentes'))).toBeNull();
  expect(await reportar.evaluate((el) => !!el.closest('[data-testid="ficha"]'))).toBe(true);
  // El pie va después del bloque de fuentes en el orden del documento: subir el pie por encima de ellas fallaría.
  expect(
    await reportar.evaluate((el) => {
      const fuentes = el.closest('[data-testid="ficha"]')!.querySelector('details.ficha-fuentes')!;
      return (fuentes.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    }),
  ).toBe(true);
  await expect(dialogo(page)).toHaveCount(0);

  // R1.3: el diálogo aparece con el foco en su título, que nombra la estructura.
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: tr('es', 'reporte.titulo', { nombre: HIPOCAMPO.nombre.es }) })).toBeFocused();
  await expect(dialogo(page)).toHaveAttribute('aria-modal', 'true');

  // Escape cierra el diálogo, devuelve el foco al botón y la ficha sigue abierta.
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'hippocampus');
  expect(page.url()).toMatch(new RegExp(`/es/${HIPOCAMPO.slug.es}$`));

  // Volver a abrir y cerrar con "Cerrar": mismo resultado.
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: tr('es', 'reporte.titulo', { nombre: HIPOCAMPO.nombre.es }) })).toBeFocused();
  await cerrarDe(page, 'es').click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', 'hippocampus');
});

test('F1-E1: en modo revisión, con el código en la URL y luego recordado, la ficha no tiene botón "Reportar un error"', async ({ page }) => {
  // Carga 1: código de prueba en la URL.
  await abrir(page, '/es/revision?r=PRUEBA01');
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
  await abrirFichaPorBusqueda(page, 'hipocampo', HIPOCAMPO, 'hippocampus');
  // Los controles de revisión ya están en la ficha: el pie, de haberlo, también estaría montado.
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  const primera = {
    pies: await page.getByTestId('ficha-pie').count(),
    botones: await page.getByRole('button', { name: tr('es', 'reporte.boton') }).count(),
  };
  expect(primera).toEqual({ pies: 0, botones: 0 });

  // Carga 2: el código quedó recordado; la URL ya no lo lleva y se abre otra ficha.
  await page.goto(`/es/${AMIGDALA.slug.es}`);
  expect(page.url()).not.toContain('r=');
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await fichaLista(page, 'amygdaloid-body', AMIGDALA.nombre.es);
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  const segunda = {
    pies: await page.getByTestId('ficha-pie').count(),
    botones: await page.getByRole('button', { name: tr('es', 'reporte.boton') }).count(),
  };
  expect(segunda).toEqual({ pies: 0, botones: 0 });
});

test('F1-E2: en celular y en inglés, el botón dice "Report an error" y el diálogo se desplaza hasta un "Close" completo y sin tapar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await abrir(page, `/en/${HIPOCAMPO.slug.en}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.en);
  const reportar = botonReportar(page, 'en');
  await expect(reportar).toHaveText('Report an error');
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  const caja = dialogo(page);
  await expect(caja).toBeVisible();
  await expect(page.getByRole('heading', { name: tr('en', 'reporte.titulo', { nombre: HIPOCAMPO.nombre.en }) })).toBeFocused();

  // Con el formulario lleno (el caso más alto) la caja no cabe en 568 de alto: se desplaza por dentro.
  await elegirTipo(page, 'en', 'contenido');
  await descripcionDe(page).fill('word '.repeat(300).slice(0, MAX_DESCRIPCION));
  const medidas = await caja.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { overflowY: s.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight, alto: window.innerHeight, arriba: r.top, abajo: r.bottom };
  });
  // Cabe en la pantalla o se desplaza; con este alto y este formulario debe desplazarse.
  expect(medidas.abajo - medidas.arriba).toBeLessThanOrEqual(medidas.alto);
  expect(medidas.scrollH).toBeGreaterThan(medidas.clientH);
  expect(['auto', 'scroll']).toContain(medidas.overflowY);

  await caja.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const cerrar = cerrarDe(page, 'en');
  await expect(cerrar).toHaveText('Close');
  await expect(cerrar).toBeInViewport({ ratio: 1 });
  const rect = (await cerrar.boundingBox())!;
  const encima = await page.evaluate(
    ({ x, y }) => {
      const b = document.elementFromPoint(x, y)?.closest('button');
      return { texto: b?.textContent?.trim() ?? null, enDialogo: !!b?.closest('[role=dialog]') };
    },
    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
  );
  expect(encima).toEqual({ texto: 'Close', enDialogo: true });
  await cerrar.click();
  await expect(caja).toHaveCount(0);
  await expect(reportar).toBeFocused();
});

// --- F2: el estudiante llena el reporte y lo abre por GitHub o por correo ---

test('F2-H: llena el reporte y GitHub y el correo llevan estructura, idioma, versión, parte y la descripción intacta', async ({ page, context }) => {
  const rutaGithub = await interceptarGithub(context);
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);

  // R2.1: cuatro tipos y ninguno marcado.
  await expect(caja.getByRole('radio')).toHaveCount(4);
  for (const tipo of TIPOS_FORM) {
    await expect(caja.getByRole('radio', { name: tr('es', `reporte.tipo.${tipo}`), exact: true })).not.toBeChecked();
  }

  // R3.1 y R4.1 (lo visible): aviso de reporte público con enlace a Privacidad; la dirección es texto, no enlace.
  const aviso = caja.locator('p', { hasText: tr('es', 'reporte.aviso') });
  await expect(aviso).toBeVisible();
  await expect(aviso.getByRole('link', { name: tr('es', 'privacidad.leer') })).toHaveAttribute('href', /\/es\/privacidad$/);
  await expect(caja.getByText(tr('es', 'reporte.correoTexto', { correo: CORREO_REPORTES }), { exact: true })).toBeVisible();
  await expect(caja.getByRole('link', { name: new RegExp(CORREO_REPORTES.replace('.', '\\.')) })).toHaveCount(0);
  await expect(enlaceGithubDe(page, 'es')).toBeVisible();
  await expect(enlaceCorreoDe(page, 'es')).toBeVisible();

  // R2.1 y R2.5: tipo, parte y una descripción con `#`, `&`, salto de línea, comillas y tildes.
  const descripcion = 'Falta la fuente #2 & "otra"\nsegunda línea: él dijo ñandú á é í ó ú';
  await elegirTipo(page, 'es', 'contenido');
  await parteDe(page).selectOption('que_es');
  await descripcionDe(page).fill(descripcion);
  await expect(descripcionDe(page)).toHaveValue(descripcion);

  const github = enlaceGithubDe(page, 'es');
  const correo = enlaceCorreoDe(page, 'es');
  await expect(github).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(github).toHaveAttribute('target', '_blank');
  const hrefGithub = (await github.getAttribute('href'))!;
  expect(leerGithub(hrefGithub)).toEqual(esperadoGithub('es', 'contenido', 'que_es', descripcion));
  // Los caracteres reservados viajan codificados, no sueltos.
  expect(hrefGithub).not.toContain('#2');
  expect(hrefGithub).not.toContain('\n');

  // "Abrir en GitHub": pestaña nueva con ese destino (la pide pero se aborta).
  const urlAntes = page.url();
  const [nueva] = await Promise.all([context.waitForEvent('page'), github.click()]);
  await expect.poll(() => rutaGithub.length, { message: 'la pestaña de GitHub no pidió su dirección' }).toBe(1);
  expect(rutaGithub[0]).toBe(hrefGithub);
  const destino = new URL(rutaGithub[0]!);
  expect(destino.hostname).toBe('github.com');
  expect(destino.pathname).toBe('/ragarciaga/3d_brain/issues/new');
  expect(destino.searchParams.get('template')).toBe(PLANTILLA['contenido']);
  expect(page.url()).toBe(urlAntes);
  await expect(dialogo(page)).toBeVisible();
  await nueva.close();

  // "Enviar por correo": mailto al editor con asunto y cuerpo del idioma activo y la misma descripción.
  await expect(correo).not.toHaveAttribute('target', /.*/);
  const hrefCorreo = (await correo.getAttribute('href'))!;
  expect(hrefCorreo).toBe(esperadoCorreo('es', 'contenido', 'que_es', descripcion));
  const mailto = new URL(hrefCorreo);
  expect(mailto.protocol).toBe('mailto:');
  expect(mailto.pathname).toBe(CORREO_REPORTES);
  expect(mailto.searchParams.get('subject')).toBe(
    tr('es', 'reporte.correo.asunto', { tipo: tr('es', 'reporte.tipo.contenido'), id: 'hippocampus', idioma: 'es', version: HIPOCAMPO.ficha.version }),
  );
  expect(mailto.searchParams.get('body')).toContain(descripcion);
  expect(mailto.searchParams.get('body')).toContain(tr('es', 'reporte.correo.cuerpo', { estructura: 'hippocampus', idioma: 'es', version: HIPOCAMPO.ficha.version, parte: 'que_es', descripcion }));
});

test('F2-E1: sin tipo, sin descripción o con solo espacios, los dos envíos están desactivados, dicen qué falta y no abren nada', async ({ page, context }) => {
  const rutaGithub = await interceptarGithub(context);
  const pestanas = contarPestanasNuevas(context);
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  const github = enlaceGithubDe(page, 'es');
  const correo = enlaceCorreoDe(page, 'es');
  const faltaTipo = caja.getByText(tr('es', 'reporte.falta.tipo'), { exact: true });
  const faltaDescripcion = caja.getByText(tr('es', 'reporte.falta.descripcion'), { exact: true });

  // 1. Recién abierto: faltan los dos.
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toBeVisible();
  await expect(faltaDescripcion).toBeVisible();
  await expect(github).toHaveAccessibleDescription(new RegExp(tr('es', 'reporte.falta.tipo')));
  await expect(correo).toHaveAccessibleDescription(new RegExp(tr('es', 'reporte.falta.descripcion')));
  await github.click({ force: true });
  await correo.click({ force: true });

  // 2. Descripción sin tipo: falta el tipo.
  await descripcionDe(page).fill('Hay un error en la ficha');
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toBeVisible();
  await expect(faltaDescripcion).toHaveCount(0);
  await github.click({ force: true });
  await correo.click({ force: true });

  // 3. Tipo con una descripción de solo espacios: falta la descripción.
  await elegirTipo(page, 'es', 'traduccion');
  await descripcionDe(page).fill('   \n  ');
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toHaveCount(0);
  await expect(faltaDescripcion).toBeVisible();
  await github.click({ force: true });
  await correo.click({ force: true });

  // Control: con tipo y texto válido los enlaces se activan; si no, lo anterior no probaría nada.
  await descripcionDe(page).fill('La traducción no dice lo mismo');
  await expect(github).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await expect(correo).toHaveAttribute('href', /^mailto:/);
  await expect(faltaTipo).toHaveCount(0);
  await expect(faltaDescripcion).toHaveCount(0);

  // Ninguna pestaña nueva ni petición a GitHub en los tres momentos.
  expect(pestanas.n()).toBe(0);
  expect(rutaGithub).toEqual([]);
  expect(page.url()).toMatch(new RegExp(`/es/${HIPOCAMPO.slug.es}$`));
});

test('F2-E2: 1501 caracteres quedan en 1500; un texto que no cabe en GitHub desactiva solo GitHub y el correo sigue', async ({ page, context }) => {
  const rutaGithub = await interceptarGithub(context);
  const pestanas = contarPestanasNuevas(context);
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  const github = enlaceGithubDe(page, 'es');
  const correo = enlaceCorreoDe(page, 'es');
  const muyLargo = caja.getByText(tr('es', 'reporte.muyLargo'), { exact: true });
  await elegirTipo(page, 'es', 'contenido');

  // R2.3: pegar 1501 deja 1500 y el contador lo dice.
  await descripcionDe(page).focus();
  await page.keyboard.insertText('a'.repeat(MAX_DESCRIPCION + 1));
  await expect(contadorDe(page, 'es', MAX_DESCRIPCION)).toBeVisible();
  expect((await descripcionDe(page).inputValue()).length).toBe(MAX_DESCRIPCION);
  expect(tr('es', 'reporte.contador', { n: MAX_DESCRIPCION, max: MAX_DESCRIPCION })).toBe('1500 / 1500');
  // 1500 caracteres simples sí caben en GitHub: el límite es de la dirección, no del conteo.
  await expect(github).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await expect(muyLargo).toHaveCount(0);

  // 1500 caracteres que ocupan mucho al codificarse (cada "€" son nueve en la dirección).
  const pesado = '€'.repeat(MAX_DESCRIPCION);
  await descripcionDe(page).fill(pesado);
  await expect(contadorDe(page, 'es', MAX_DESCRIPCION)).toBeVisible();
  await desactivado(github);
  await expect(muyLargo).toBeVisible();
  await expect(github).toHaveAccessibleDescription(new RegExp(tr('es', 'reporte.muyLargo')));
  await expect(correo).not.toHaveAttribute('aria-disabled', /.*/);
  expect(await correo.getAttribute('href')).toBe(esperadoCorreo('es', 'contenido', 'general', pesado));
  await github.click({ force: true });

  // Control: acortar devuelve GitHub y quita el mensaje.
  await descripcionDe(page).fill('€'.repeat(10));
  await expect(github).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await expect(muyLargo).toHaveCount(0);

  expect(pestanas.n()).toBe(0);
  expect(rutaGithub).toEqual([]);
});

// --- F3: el reporte no se queda en la app ---

type Pares = [string, string | null][];
interface Foto {
  localStorage: Pares;
  sessionStorage: Pares;
  cookie: string;
  indexedDB: { nombre: string; version: number; almacenes: { nombre: string; llaves: string; valores: string }[] }[];
}

/**
 * Todo lo que la página puede haber guardado, con los valores. De IndexedDB solo abre las bases que lista
 * `indexedDB.databases()`: abrir `keyval-store` a ciegas la crearía y la foto cambiaría el estado.
 */
const foto = (page: Page): Promise<Foto> =>
  page.evaluate(async () => {
    const pares = (s: Storage): Pares => Object.keys(s).sort().map((k) => [k, s.getItem(k)]);
    const abrirBase = (nombre: string) =>
      new Promise<IDBDatabase>((ok, mal) => {
        const pedido = indexedDB.open(nombre);
        pedido.onsuccess = () => ok(pedido.result);
        pedido.onerror = () => mal(pedido.error);
        pedido.onblocked = () => mal(new Error(`base bloqueada: ${nombre}`));
        pedido.onupgradeneeded = () => {
          pedido.transaction?.abort();
          mal(new Error(`la base ya no existe: ${nombre}`));
        };
      });
    const leer = <T,>(pedido: IDBRequest<T>) =>
      new Promise<T>((ok, mal) => {
        pedido.onsuccess = () => ok(pedido.result);
        pedido.onerror = () => mal(pedido.error);
      });
    const bases = (await indexedDB.databases()).filter((b) => typeof b.name === 'string').sort((a, b) => a.name!.localeCompare(b.name!));
    const salida: Foto['indexedDB'] = [];
    for (const b of bases) {
      const db = await abrirBase(b.name!);
      const nombres = [...db.objectStoreNames].sort();
      const almacenes: Foto['indexedDB'][number]['almacenes'] = [];
      if (nombres.length > 0) {
        const tx = db.transaction(nombres, 'readonly');
        for (const nombre of nombres) {
          const almacen = tx.objectStore(nombre);
          const [llaves, valores] = await Promise.all([leer(almacen.getAllKeys()), leer(almacen.getAll())]);
          almacenes.push({ nombre, llaves: JSON.stringify(llaves), valores: JSON.stringify(valores) });
        }
      }
      salida.push({ nombre: b.name!, version: db.version, almacenes });
      db.close();
    }
    return { localStorage: pares(localStorage), sessionStorage: pares(sessionStorage), cookie: document.cookie, indexedDB: salida };
  });

interface Red {
  /** Peticiones de la página principal, `método url tipo`, desde la última vez que se vaciaron. */
  pagina: string[];
  /** Peticiones de cualquier otra página del contexto (las pestañas nuevas). */
  otras: string[];
  paginasNuevas: Page[];
  /** Hora de la última petición de cualquier página. */
  ultima: number;
}

function registrarRed(context: BrowserContext, page: Page): Red {
  const red: Red = { pagina: [], otras: [], paginasNuevas: [], ultima: Date.now() };
  context.on('request', (peticion) => {
    red.ultima = Date.now();
    let propia = false;
    try {
      propia = peticion.frame().page() === page;
    } catch {
      // Una petición sin marco (un service worker) cuenta como ajena a la página.
    }
    (propia ? red.pagina : red.otras).push(`${peticion.method()} ${peticion.url()} ${peticion.resourceType()}`);
  });
  context.on('page', (nueva) => red.paginasNuevas.push(nueva));
  return red;
}

const esperarSilencio = (red: Red) =>
  expect.poll(() => Date.now() - red.ultima, { message: 'la red no se calmó antes de abrir el diálogo' }).toBeGreaterThan(1000);

test('F3-H: llenar el reporte y pulsar GitHub y correo no escribe en ningún almacén ni hace peticiones propias', async ({ page, context }) => {
  // Sin modelo 3D: se quita su descarga y con ella las peticiones de fondo que ensuciarían la cuenta.
  await context.route('**/modelos/atlas.glb', (ruta) => ruta.abort());
  const rutaGithub = await interceptarGithub(context);
  const red = registrarRed(context, page);
  await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  expect(red.pagina.length, 'el registro no vio ninguna petición de la carga').toBeGreaterThan(0);
  await esperarSilencio(red);
  const base = await foto(page);
  expect(base.localStorage, 'la foto no lee localStorage').toContainEqual(['atlas:aviso-visto', '1']);

  // Control: la foto detecta una escritura en cada almacén y vuelve a la base al deshacerla.
  await page.evaluate(() => {
    localStorage.setItem('e2e-control', '1');
    sessionStorage.setItem('e2e-control', '1');
    document.cookie = 'e2e-control=1; path=/';
  });
  const conEscritura = await foto(page);
  expect(conEscritura.localStorage).not.toEqual(base.localStorage);
  expect(conEscritura.sessionStorage).not.toEqual(base.sessionStorage);
  expect(conEscritura.cookie).not.toEqual(base.cookie);
  await page.evaluate(() => {
    localStorage.removeItem('e2e-control');
    sessionStorage.removeItem('e2e-control');
    document.cookie = 'e2e-control=; path=/; max-age=0';
  });
  expect(await foto(page), 'los controles no volvieron a la base').toEqual(base);
  await page.evaluate(
    () =>
      new Promise<void>((ok, mal) => {
        const pedido = indexedDB.open('e2e-control', 1);
        pedido.onupgradeneeded = () => pedido.result.createObjectStore('x');
        pedido.onerror = () => mal(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          const tx = db.transaction('x', 'readwrite');
          tx.objectStore('x').put('a', 'k');
          tx.oncomplete = () => {
            db.close();
            ok();
          };
          tx.onerror = () => mal(tx.error);
        };
      }),
  );
  expect((await foto(page)).indexedDB, 'control IndexedDB: la foto no vio la base nueva').not.toEqual(base.indexedDB);
  await page.evaluate(
    () =>
      new Promise<void>((ok, mal) => {
        const pedido = indexedDB.deleteDatabase('e2e-control');
        pedido.onsuccess = () => ok();
        pedido.onerror = () => mal(pedido.error);
        pedido.onblocked = () => mal(new Error('base de control bloqueada'));
      }),
  );
  expect(await foto(page), 'control IndexedDB: no volvió a la base').toEqual(base);

  // Desde aquí, la página no puede hacer ninguna petición.
  red.pagina.length = 0;
  red.otras.length = 0;
  const reportar = botonReportar(page, 'es');
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  const fotoAbierto = await foto(page);

  await elegirTipo(page, 'es', 'traduccion');
  await parteDe(page).selectOption('ubicacion');
  const marcador = 'zqxr51flujo';
  const texto = `La traducción ${marcador} no dice lo mismo`;
  const mitad = Math.floor(texto.length / 2);
  await descripcionDe(page).pressSequentially(texto.slice(0, mitad));
  const fotoMitad = await foto(page);
  await descripcionDe(page).pressSequentially(texto.slice(mitad));
  await expect(descripcionDe(page)).toHaveValue(texto);
  const fotoTexto = await foto(page);

  const github = enlaceGithubDe(page, 'es');
  const hrefGithub = (await github.getAttribute('href'))!;
  expect(hrefGithub).toContain(marcador);
  const [nueva] = await Promise.all([context.waitForEvent('page'), github.click()]);
  await expect.poll(() => rutaGithub.length, { message: 'la pestaña de GitHub no pidió su dirección' }).toBe(1);
  const fotoGithub = await foto(page);

  // El correo se pulsa de verdad. Chromium informa la navegación a `mailto:` como una petición de documento aunque
  // nada salga a la red (el sistema la entrega al programa de correo): es la única entrada permitida de la página.
  const correo = enlaceCorreoDe(page, 'es');
  const hrefCorreo = (await correo.getAttribute('href'))!;
  expect(hrefCorreo).toMatch(new RegExp(`^mailto:${CORREO_REPORTES.replace('.', '\\.')}\\?`));
  const peticionesAntesDelCorreo = [...red.pagina];
  await correo.click();
  // Condición, no pausa: la navegación a `mailto:` aparece en la lista; luego se espera un rato sin ninguna petición.
  await expect
    .poll(() => red.pagina.includes(`GET ${hrefCorreo} document`), { message: 'la navegación mailto: no apareció entre las peticiones' })
    .toBe(true);
  await esperarSilencio(red);
  const dialogoVisible = await dialogo(page).isVisible();
  const fotoCorreo = await foto(page);

  // 2. Cerrar el diálogo y mirar de nuevo.
  await cerrarDe(page, 'es').click();
  await expect(dialogo(page)).toHaveCount(0);
  const fotoCerrado = await foto(page);

  // Todo se lee una vez, al final.
  const peticionesPagina = [...red.pagina];
  const peticionesOtras = red.otras.map((linea) => linea.split(' ')[1]);
  const nuevas = red.paginasNuevas.length;
  expect(peticionesAntesDelCorreo, 'peticiones de la página desde que se abre el diálogo hasta pulsar el correo').toEqual([]);
  expect(peticionesPagina, 'peticiones de la página en todo el flujo').toEqual([`GET ${hrefCorreo} document`]);
  expect(nuevas, 'pestañas nuevas').toBe(1);
  expect(peticionesOtras, 'peticiones de la pestaña nueva').toEqual([hrefGithub]);
  expect(rutaGithub).toEqual([hrefGithub]);
  expect(dialogoVisible).toBe(true);
  expect(fotoAbierto, 'con el diálogo abierto').toEqual(base);
  expect(fotoMitad, 'a mitad del texto').toEqual(base);
  expect(fotoTexto, 'con el texto completo').toEqual(base);
  expect(fotoGithub, 'después de GitHub').toEqual(base);
  expect(fotoCorreo, 'después del correo').toEqual(base);
  expect(fotoCerrado, 'después de cerrar').toEqual(base);
  expect(JSON.stringify(fotoCerrado)).not.toContain(marcador);
  await nueva.close();
});

test('F3-E1: cerrar con Escape o con "Cerrar" descarta el borrador: tipo, parte y descripción vuelven vacíos', async ({ page }) => {
  const reportar = await abrirDialogo(page, 'es');
  const caja = dialogo(page);

  const vacio = async () => {
    await expect(caja.getByRole('radio')).toHaveCount(4);
    for (const tipo of TIPOS_FORM) {
      await expect(caja.getByRole('radio', { name: tr('es', `reporte.tipo.${tipo}`), exact: true })).not.toBeChecked();
    }
    await expect(parteDe(page)).toHaveValue('general');
    await expect(parteDe(page).locator('option:checked')).toHaveText(tr('es', 'reporte.parteGeneral'));
    await expect(descripcionDe(page)).toHaveValue('');
    await expect(contadorDe(page, 'es', 0)).toBeVisible();
    await expect(contadorDe(page, 'es', 0)).toHaveText('0 / 1500');
  };
  await vacio();

  const rondas: { tipo: TipoReporte; parte: string; cerrar: () => Promise<void> }[] = [
    { tipo: 'enlace-roto', parte: 'ubicacion', cerrar: () => page.keyboard.press('Escape') },
    { tipo: 'pieza', parte: 'nombre', cerrar: () => cerrarDe(page, 'es').click() },
  ];
  for (const ronda of rondas) {
    const escrito = 'borrador que no debe sobrevivir';
    await elegirTipo(page, 'es', ronda.tipo);
    await parteDe(page).selectOption(ronda.parte);
    await descripcionDe(page).fill(escrito);
    // El formulario sí quedó lleno: sin esto, "vacío" al reabrir no probaría nada.
    await expect(caja.getByRole('radio', { name: tr('es', `reporte.tipo.${ronda.tipo}`), exact: true })).toBeChecked();
    await expect(parteDe(page)).toHaveValue(ronda.parte);
    await expect(descripcionDe(page)).toHaveValue(escrito);
    await expect(contadorDe(page, 'es', escrito.length)).toBeVisible();

    await ronda.cerrar();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(reportar).toBeFocused();
    await reportar.click();
    await expect(dialogo(page)).toBeVisible();
    await vacio();
  }
});

test('F3-E2: con ?r= en la URL pero sin modo revisión, ni el enlace de GitHub ni el del correo llevan el código', async ({ page, context }) => {
  await interceptarGithub(context);
  // Visitante: el modo revisión solo vive en /revision, así que `?r=` en la ficha no lo activa y el botón se ve.
  await abrir(page, `/es/${HIPOCAMPO.slug.es}?r=PRUEBA01`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  await expect(page.getByTestId('panel-revision')).toHaveCount(0);
  // Control: la URL de la página sí lleva el código.
  expect(page.url()).toContain('r=PRUEBA01');

  const reportar = botonReportar(page, 'es');
  await expect(reportar).toBeVisible();
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await elegirTipo(page, 'es', 'contenido');
  await descripcionDe(page).fill('texto de prueba');

  const hrefGithub = (await enlaceGithubDe(page, 'es').getAttribute('href'))!;
  const hrefCorreo = (await enlaceCorreoDe(page, 'es').getAttribute('href'))!;
  expect(hrefGithub).toMatch(/^https:\/\/github\.com\//);
  expect(hrefCorreo).toMatch(/^mailto:/);
  // Los enlaces son del reporte (control de que no están vacíos) y no tienen el código, tal cual ni decodificado.
  expect(leerGithub(hrefGithub)).toEqual(esperadoGithub('es', 'contenido', 'general', 'texto de prueba'));
  expect(hrefCorreo).toBe(esperadoCorreo('es', 'contenido', 'general', 'texto de prueba'));
  for (const href of [hrefGithub, hrefCorreo, decodeURIComponent(hrefGithub), decodeURIComponent(hrefCorreo)]) {
    expect(href).not.toContain('PRUEBA01');
    expect(href).not.toContain('r=');
  }
});
