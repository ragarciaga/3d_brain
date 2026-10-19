// "Reportar un error" (F12, spec 05, T5, T6 y T7): el botón del pie de la ficha, su ausencia en modo revisión, el
// diálogo (foco, Escape, aislamiento y desplazamiento en celular), el formulario (tipo, parte, descripción,
// enlaces a GitHub y al correo), el silencio de la app (almacenes y red), el borrador que no sobrevive al cierre
// y el estado de revisión bloqueada. Nombres, slugs, versión y textos se leen de los datos y de i18n (oráculo de
// solo lectura); los códigos de revisión son de prueba.
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { CORREO_REPORTES, MAX_DESCRIPCION, PLANTILLA, URL_ISSUES, type TipoReporte } from '../src/config/reporte';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

const estructuras = (JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<
    string,
    {
      nombre: { es: string; en: string };
      slug: { es: string; en: string };
      sinonimos: { es: string[]; en: string[] };
      ficha: { version: string; relaciones: unknown[]; relevancia: unknown[]; fuentes: unknown[]; recursos: unknown[] };
    }
  >;
}).estructuras;
const HIPOCAMPO = estructuras['hippocampus']!;

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

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const aislarActual = (page: Page) =>
  page.evaluate(() => (window as unknown as { __atlas: { getState(): { aislar: { modo: string } | null } } }).__atlas.getState().aislar?.modo ?? null);

const pie = (page: Page) => page.getByTestId('ficha-pie');
const boton = (page: Page, nombre: string) => pie(page).getByRole('button', { name: nombre });
const dialogo = (page: Page) => page.getByTestId('dialogo-reporte');

/** Espera a que la ficha de la entrada esté en pantalla, no solo la URL. */
async function fichaLista(page: Page, entrada: string, nombre: string) {
  await expect(page.getByTestId('ficha')).toHaveAttribute('data-entrada', entrada);
  await expect(page.locator('#ficha-titulo')).toHaveText(nombre);
}

test('el botón está en el pie, fuera de las fuentes; el diálogo toma el foco y Escape no sale del aislamiento', async ({ page }) => {
  await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  const reportar = boton(page, 'Reportar un error');
  await expect(reportar).toBeVisible();
  // `details.ficha-fuentes` está cerrado: no se busca por rol dentro de él, se pregunta por el ancestro.
  expect(await reportar.evaluate((el) => el.closest('details.ficha-fuentes'))).toBeNull();
  await expect.poll(() => aislarActual(page)).toBe('contexto');

  // Escape: cierra el diálogo, devuelve el foco al botón y deja el aislamiento como estaba.
  await reportar.click();
  await expect(page.getByRole('heading', { name: `Reportar un error en ${HIPOCAMPO.nombre.es}` })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();
  await page.waitForTimeout(300);
  expect(await aislarActual(page)).toBe('contexto');

  // "Cerrar" hace lo mismo.
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await dialogo(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();

  // Control: sin diálogo, el siguiente Escape sí sale del aislamiento.
  await page.keyboard.press('Escape');
  await expect.poll(() => aislarActual(page)).toBeNull();
});

test('en inglés dice "Report an error"; en una entrada sin ficha el pie también está', async ({ page }) => {
  await abrir(page, `/en/${HIPOCAMPO.slug.en}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.en);
  const reportar = boton(page, 'Report an error');
  await expect(reportar).toBeVisible();
  expect(await reportar.evaluate((el) => el.closest('details.ficha-fuentes'))).toBeNull();
  await reportar.click();
  await expect(page.getByRole('heading', { name: `Report an error in ${HIPOCAMPO.nombre.en}` })).toBeFocused();

  // Hoy todas las entradas del atlas tienen ficha: la entrada sin ficha es el hipocampo con `ficha: null`, que se
  // fija en el módulo de datos que sirve Vite (solo el servidor de desarrollo, como la costura del canal).
  await page.route('**/src/data/estructuras.json?*', async (route) => {
    const respuesta = await route.fetch();
    const texto = await respuesta.text();
    expect(texto, 'el módulo de datos que sirve Vite ya no exporta `estructuras`').toContain('export const estructuras');
    await route.fulfill({ response: respuesta, body: `${texto}\nestructuras.hippocampus.ficha = null;\n` });
  });
  await page.goto(`/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  await expect(page.locator('details.ficha-fuentes')).toHaveCount(0);
  await expect(boton(page, 'Reportar un error')).toBeVisible();
});

test('en modo revisión, por código en la URL o recordado, no hay botón ni pie', async ({ page }) => {
  await abrir(page, '/es/revision?r=PRUEBA01');
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Buscar|Search/ }).fill('hipocampo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/es/${HIPOCAMPO.slug.es}$`));
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  // Los controles de revisión ya están: el pie, de haberlo, también estaría montado. Se lee una vez.
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  expect(await page.getByTestId('ficha-pie').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Reportar un error' }).count()).toBe(0);

  // Segunda carga: el código ya quedó recordado, sin `?r=`.
  await page.goto(`/es/${HIPOCAMPO.slug.es}`);
  await expect(page.getByTestId('panel-revision')).toContainText('PRUEBA01');
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  await expect(page.locator('[data-campo="que_es.es"]')).toBeVisible();
  expect(await page.getByTestId('ficha-pie').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Reportar un error' }).count()).toBe(0);
});

// 844 es el alto del criterio; 568 es un teléfono corto, donde el diálogo no cabe sin desplazarse.
for (const alto of [844, 568]) {
  test(`celular (390 x ${alto}): la caja del diálogo se desplaza y "Cerrar" se ve completo y sin tapar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: alto });
    await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
    await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
    const reportar = boton(page, 'Reportar un error');
    await reportar.scrollIntoViewIfNeeded();
    await reportar.click();
    const caja = dialogo(page);
    await expect(caja).toBeVisible();

    const estilo = await caja.evaluate((el) => {
      const s = getComputedStyle(el);
      return { maxHeight: parseFloat(s.maxHeight), overflowY: s.overflowY, alto: window.innerHeight };
    });
    // `parseFloat('none')` es NaN y no pasa la comparación.
    expect(estilo.maxHeight <= estilo.alto).toBe(true);
    expect(['auto', 'scroll']).toContain(estilo.overflowY);

    // Se llega al final con el desplazamiento de la propia caja, no con el de la página.
    await caja.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const cerrar = caja.getByRole('button', { name: 'Cerrar' });
    await expect(cerrar).toBeInViewport({ ratio: 1 });
    const rect = (await cerrar.boundingBox())!;
    const encima = await page.evaluate(
      ({ x, y }) => {
        const b = document.elementFromPoint(x, y)?.closest('button');
        return { texto: b?.textContent?.trim() ?? null, enDialogo: !!b?.closest('[role=dialog]') };
      },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    );
    expect(encima).toEqual({ texto: 'Cerrar', enDialogo: true });
    await cerrar.click();
    await expect(caja).toHaveCount(0);
    await expect(reportar).toBeFocused();
  });
}

// --- Formulario (T6) ---

/** Abre la ficha del hipocampo en el idioma y el diálogo de reporte. Devuelve el botón del pie. */
async function abrirDialogo(page: Page, idioma: Lang): Promise<Locator> {
  await abrir(page, `/${idioma}/${HIPOCAMPO.slug[idioma]}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre[idioma]);
  const reportar = boton(page, tr(idioma, 'reporte.boton'));
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  return reportar;
}

const enlaceGithubDe = (page: Page, idioma: Lang) => dialogo(page).getByRole('link', { name: tr(idioma, 'reporte.abrirGithub') });
const enlaceCorreoDe = (page: Page, idioma: Lang) => dialogo(page).getByRole('link', { name: tr(idioma, 'reporte.enviarCorreo') });
const descripcionDe = (page: Page) => dialogo(page).locator('textarea');
const parteDe = (page: Page) => dialogo(page).locator('select');
const elegirTipo = (page: Page, idioma: Lang, tipo: TipoReporte) =>
  dialogo(page).getByRole('radio', { name: tr(idioma, `reporte.tipo.${tipo}`), exact: true }).check();

async function desactivado(enlace: Locator) {
  await expect(enlace).toHaveAttribute('aria-disabled', 'true');
  await expect(enlace).not.toHaveAttribute('href', /.*/);
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

function leerGithub(href: string): Record<string, string> {
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe(URL_ISSUES);
  // Exactamente los siete parámetros, ni uno más (nada de la ubicación de la página).
  expect([...url.searchParams.keys()]).toHaveLength(7);
  return Object.fromEntries(url.searchParams);
}

function esperadoCorreo(idioma: Lang, tipo: TipoReporte, parte: string, descripcion: string): string {
  const version = HIPOCAMPO.ficha.version;
  const asunto = tr(idioma, 'reporte.correo.asunto', { tipo: tr(idioma, `reporte.tipo.${tipo}`), id: 'hippocampus', idioma, version });
  const cuerpo = tr(idioma, 'reporte.correo.cuerpo', { estructura: 'hippocampus', idioma, version, parte, descripcion });
  return `mailto:${CORREO_REPORTES}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

const TIPOS_FORM: TipoReporte[] = ['contenido', 'traduccion', 'enlace-roto', 'pieza'];

test('es: el formulario abre vacío; los enlaces se activan con tipo y descripción y llevan el reporte', async ({ page }) => {
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);

  // R2.1: cuatro tipos y ninguno marcado.
  await expect(caja.getByRole('radio')).toHaveCount(4);
  for (const tipo of TIPOS_FORM) {
    const radio = caja.getByRole('radio', { name: tr('es', `reporte.tipo.${tipo}`), exact: true });
    await expect(radio).toBeVisible();
    await expect(radio).not.toBeChecked();
    await expect(radio).toHaveAccessibleDescription(tr('es', `reporte.tipoAyuda.${tipo}`));
  }

  // Partes: las de la ficha, con "General" elegido.
  const f = HIPOCAMPO.ficha;
  const ids = [
    'general',
    'nombre',
    'latin',
    ...(HIPOCAMPO.sinonimos.es.length + HIPOCAMPO.sinonimos.en.length > 0 ? ['sinonimos'] : []),
    'pieza',
    'que_es',
    'para_que_sirve',
    'ubicacion',
    ...(f.relaciones.length > 0 ? ['relaciones'] : []),
    ...f.relevancia.map((_, i) => `relevancia.${i}`),
    ...f.fuentes.map((_, i) => `fuente.${i}`),
    ...(f.recursos.length > 0 ? ['recursos'] : []),
  ];
  const opciones = await parteDe(page).locator('option').evaluateAll((os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: o.textContent ?? '' })));
  expect(opciones.map((o) => o.valor)).toEqual(ids);
  const etiquetaEsperada = (id: string): string => {
    const n = Number(id.split('.')[1]) + 1;
    if (id.startsWith('relevancia.')) return tr('es', 'reporte.parteRelevancia', { n });
    if (id.startsWith('fuente.')) return tr('es', 'reporte.parteFuente', { n });
    const claves: Record<string, string> = {
      general: 'reporte.parteGeneral',
      nombre: 'reporte.parteNombre',
      latin: 'ficha.latin',
      sinonimos: 'reporte.parteSinonimos',
      pieza: 'reporte.partePieza',
      que_es: 'ficha.queEs',
      para_que_sirve: 'ficha.paraQueSirve',
      ubicacion: 'ficha.ubicacion',
      relaciones: 'ficha.relaciones',
      recursos: 'reporte.parteRecursos',
    };
    return tr('es', claves[id]!);
  };
  expect(opciones.map((o) => o.texto)).toEqual(ids.map(etiquetaEsperada));
  await expect(parteDe(page)).toHaveValue('general');
  await expect(parteDe(page)).toHaveAccessibleName(tr('es', 'reporte.parte'));
  await expect(descripcionDe(page)).toHaveAccessibleName(tr('es', 'reporte.descripcion'));

  // Contador, aviso con enlace a Privacidad y dirección como texto (no como enlace).
  await expect(caja.getByText(tr('es', 'reporte.contador', { n: 0, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
  const aviso = caja.locator('p', { hasText: tr('es', 'reporte.aviso') });
  await expect(aviso).toBeVisible();
  const privacidad = aviso.getByRole('link', { name: tr('es', 'privacidad.leer') });
  await expect(privacidad).toHaveAttribute('href', /\/es\/privacidad$/);
  await expect(privacidad).toHaveAttribute('target', '_blank');
  await expect(caja.getByText(tr('es', 'reporte.correoTexto', { correo: CORREO_REPORTES }), { exact: true })).toBeVisible();
  await expect(caja.getByRole('link', { name: /info@maysasp/ })).toHaveCount(0);

  // R2.4: recién abierto, los dos enlaces están desactivados y se dice qué falta.
  const github = enlaceGithubDe(page, 'es');
  const correo = enlaceCorreoDe(page, 'es');
  const faltaTipo = caja.getByText(tr('es', 'reporte.falta.tipo'), { exact: true });
  const faltaDescripcion = caja.getByText(tr('es', 'reporte.falta.descripcion'), { exact: true });
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toBeVisible();
  await expect(faltaDescripcion).toBeVisible();
  await expect(github).toHaveAccessibleDescription(new RegExp(tr('es', 'reporte.falta.tipo')));

  // Solo la descripción: falta el tipo.
  await descripcionDe(page).fill('Hay un error');
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toBeVisible();
  await expect(faltaDescripcion).toHaveCount(0);

  // Tipo con una descripción de solo espacios: falta la descripción.
  await elegirTipo(page, 'es', 'contenido');
  await descripcionDe(page).fill('   ');
  await desactivado(github);
  await desactivado(correo);
  await expect(faltaTipo).toHaveCount(0);
  await expect(faltaDescripcion).toBeVisible();
  await expect(caja.getByText(tr('es', 'reporte.contador', { n: 3, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();

  // Tipo y texto válidos: ninguna falta y los dos enlaces llevan el reporte (D1).
  const descripcion = 'Falta un enlace #1 & "otro"\nsegunda línea á';
  await elegirTipo(page, 'es', 'enlace-roto');
  await parteDe(page).selectOption('que_es');
  await descripcionDe(page).fill(descripcion);
  await expect(faltaTipo).toHaveCount(0);
  await expect(faltaDescripcion).toHaveCount(0);
  await expect(github).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /noopener/);
  await expect(github).toHaveAttribute('rel', /noreferrer/);
  const href = (await github.getAttribute('href'))!;
  expect(leerGithub(href)).toEqual(esperadoGithub('es', 'enlace-roto', 'que_es', descripcion));
  expect(href).toContain('title=%5BEnlace+roto%5D+Hipocampo+%28hippocampus%29');
  await expect(correo).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(correo).not.toHaveAttribute('target', /.*/);
  expect(await correo.getAttribute('href')).toBe(esperadoCorreo('es', 'enlace-roto', 'que_es', descripcion));
});

test('en: textos en inglés, aviso con /en/privacy y enlaces con las plantillas en inglés', async ({ page }) => {
  await abrirDialogo(page, 'en');
  const caja = dialogo(page);
  await expect(caja.getByRole('radio')).toHaveCount(4);
  for (const tipo of TIPOS_FORM) {
    await expect(caja.getByRole('radio', { name: tr('en', `reporte.tipo.${tipo}`), exact: true })).not.toBeChecked();
  }
  await expect(caja.getByText(tr('en', 'reporte.contador', { n: 0, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
  const aviso = caja.locator('p', { hasText: tr('en', 'reporte.aviso') });
  await expect(aviso.getByRole('link', { name: tr('en', 'privacidad.leer') })).toHaveAttribute('href', /\/en\/privacy$/);
  await expect(caja.getByText(tr('en', 'reporte.correoTexto', { correo: CORREO_REPORTES }), { exact: true })).toBeVisible();
  await expect(caja.getByText(tr('en', 'reporte.falta.tipo'), { exact: true })).toBeVisible();
  await expect(caja.getByText(tr('en', 'reporte.falta.descripcion'), { exact: true })).toBeVisible();
  await expect(parteDe(page)).toHaveAccessibleName(tr('en', 'reporte.parte'));

  const descripcion = 'The translation reads poorly';
  await elegirTipo(page, 'en', 'traduccion');
  await descripcionDe(page).fill(descripcion);
  const href = (await enlaceGithubDe(page, 'en').getAttribute('href'))!;
  const params = leerGithub(href);
  expect(params).toEqual(esperadoGithub('en', 'traduccion', 'general', descripcion));
  expect(params['title']).toBe('[Translation] Hippocampus (hippocampus)');
  expect(params['idioma']).toBe('en');
  expect(await enlaceCorreoDe(page, 'en').getAttribute('href')).toBe(esperadoCorreo('en', 'traduccion', 'general', descripcion));
});

test('largo: 1501 caracteres pegados quedan en 1500, y un texto largo desactiva solo GitHub', async ({ page }) => {
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  const github = enlaceGithubDe(page, 'es');
  const correo = enlaceCorreoDe(page, 'es');
  const muyLargo = caja.getByText(tr('es', 'reporte.muyLargo'), { exact: true });
  await elegirTipo(page, 'es', 'contenido');

  // R3.4: 1500 'ñ' codifican a más de MAX_URL; el correo sigue activo.
  await descripcionDe(page).fill('ñ'.repeat(MAX_DESCRIPCION));
  await desactivado(github);
  await expect(muyLargo).toBeVisible();
  await expect(correo).toHaveAttribute('href', /^mailto:/);
  await expect(correo).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(github).toHaveAccessibleDescription(new RegExp(tr('es', 'reporte.muyLargo')));
  // Control: con un texto corto GitHub vuelve a estar activo y el motivo se va.
  await descripcionDe(page).fill('ñ'.repeat(10));
  await expect(github).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await expect(muyLargo).toHaveCount(0);

  // R2.3: pegar 1501 deja 1500 y el contador lo dice.
  await descripcionDe(page).fill('');
  await descripcionDe(page).focus();
  await page.keyboard.insertText('a'.repeat(MAX_DESCRIPCION + 1));
  await expect(caja.getByText(tr('es', 'reporte.contador', { n: MAX_DESCRIPCION, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
  expect((await descripcionDe(page).inputValue()).length).toBe(MAX_DESCRIPCION);
});

test('D3: un surrogate suelto, alto o bajo, no rompe el formulario y los enlaces llevan U+FFFD', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  await elegirTipo(page, 'es', 'contenido');
  // El valor se fija por programa: ninguna tecla escribe un surrogate suelto.
  const fijar = (valor: string) =>
    descripcionDe(page).evaluate((el, v) => {
      const area = el as HTMLTextAreaElement;
      const poner = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      poner.call(area, v);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }, valor);
  const comprobar = async (valor: string, esperado: string) => {
    await fijar(valor);
    await expect(caja.getByText(tr('es', 'reporte.contador', { n: valor.length, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
    const href = (await enlaceGithubDe(page, 'es').getAttribute('href'))!;
    expect(leerGithub(href)['descripcion']).toBe(esperado);
    const mailto = (await enlaceCorreoDe(page, 'es').getAttribute('href'))!;
    expect(decodeURIComponent(new URL(mailto).search.split('&body=')[1]!)).toContain(esperado);
    expect(mailto).toBe(esperadoCorreo('es', 'contenido', 'general', esperado));
    await expect(caja).toBeVisible();
    expect(errores).toEqual([]);
  };
  // Alto sin pareja al final y, sin recargar, bajo sin pareja al inicio.
  await comprobar('a' + String.fromCharCode(0xd83d), 'a�');
  await comprobar(String.fromCharCode(0xde00) + 'b', '�b');
});

// R1.4: con el formulario completo y un texto largo, la dirección y "Cerrar" se alcanzan y nada los tapa.
for (const alto of [844, 568]) {
  test(`celular (390 x ${alto}): con el formulario lleno, la dirección y "Cerrar" se alcanzan y no los tapa nada`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: alto });
    const reportar = await abrirDialogo(page, 'es');
    const caja = dialogo(page);
    await elegirTipo(page, 'es', 'contenido');
    await parteDe(page).selectOption('que_es');
    await descripcionDe(page).fill('palabra '.repeat(200).slice(0, MAX_DESCRIPCION));

    const direccion = caja.getByText(tr('es', 'reporte.correoTexto', { correo: CORREO_REPORTES }), { exact: true });
    const cerrar = caja.getByRole('button', { name: 'Cerrar' });
    for (const objetivo of [direccion, cerrar]) {
      await objetivo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(objetivo).toBeInViewport({ ratio: 1 });
      const tapado = await objetivo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 20);
        return [r.top + 1, r.top + r.height / 2, r.bottom - 1].filter((y) => {
          const encima = document.elementFromPoint(x, y);
          return encima === null || !(encima === el || el.contains(encima));
        });
      });
      expect(tapado).toEqual([]);
    }
    // A 568 el formulario no cabe: la prueba no pasa sin desplazar nada.
    const desplazable = await caja.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (alto === 568) expect(desplazable).toBe(true);

    await cerrar.click();
    await expect(caja).toHaveCount(0);
    await expect(reportar).toBeFocused();
  });
}

test('Escape cierra el diálogo con el foco en el textarea o en el select y el foco vuelve al botón', async ({ page }) => {
  const reportar = await abrirDialogo(page, 'es');
  await descripcionDe(page).fill('algo');
  await expect(descripcionDe(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();

  // Reabrir: el borrador se descartó al cerrar.
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  await expect(descripcionDe(page)).toHaveValue('');
  await parteDe(page).focus();
  await expect(parteDe(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(reportar).toBeFocused();
});

// --- Silencio, borrador y estado bloqueado (T7) ---

/**
 * Como en revision-privacidad.spec.ts: estas pruebas solo miran la ficha, el diálogo, los almacenes y la red, que no
 * dependen del modelo 3D. Abortar su descarga quita además de la red una fuente de peticiones de fondo.
 */
const sinModelo = (context: BrowserContext) => context.route('**/modelos/atlas.glb', (ruta) => ruta.abort());

type Pares = [string, string | null][];
interface Foto {
  localStorage: Pares;
  sessionStorage: Pares;
  cookie: string;
  indexedDB: { nombre: string; version: number; almacenes: { nombre: string; llaves: string; valores: string }[] }[];
}

/**
 * Todo lo que la página puede haber guardado, con los valores y no solo las llaves. De IndexedDB solo abre las
 * bases que lista `indexedDB.databases()`: abrir `keyval-store` a ciegas la crearía y la foto cambiaría el estado.
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
        // Una base borrada entre `databases()` y `open()` se crearía vacía: se cancela en vez de crearla.
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
    const indexedDBFoto: Foto['indexedDB'] = [];
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
      indexedDBFoto.push({ nombre: b.name!, version: db.version, almacenes });
      db.close();
    }
    return { localStorage: pares(localStorage), sessionStorage: pares(sessionStorage), cookie: document.cookie, indexedDB: indexedDBFoto };
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

/** Cuenta las peticiones de todas las páginas del contexto, también las de una pestaña nueva desde su primera. */
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

/** Espera a que pase más de un segundo sin ninguna petición, para que el conteo posterior no dependa del azar. */
const esperarSilencio = (red: Red) =>
  expect.poll(() => Date.now() - red.ultima, { message: 'la red no se calmó antes de abrir el diálogo' }).toBeGreaterThan(1000);

const baseFoto = (page: Page) =>
  page.evaluate(() => ({
    beacons: document.querySelectorAll('script[data-cf-beacon]').length,
    marca: document.documentElement.hasAttribute('data-beacon-cargado'),
  }));

/** Un control prueba que `foto` ve el cambio y que, al deshacerlo, vuelve a la base. */
async function controlDetecta(page: Page, base: Foto, nombre: string, poner: () => Promise<unknown>, quitar: () => Promise<unknown>) {
  await poner();
  expect(await foto(page), `control ${nombre}: la foto no vio el cambio`).not.toEqual(base);
  await quitar();
  expect(await foto(page), `control ${nombre}: no volvió a la base`).toEqual(base);
}

const ponerIdb = (page: Page, valor: string) =>
  page.evaluate(
    (v) =>
      new Promise<void>((ok, mal) => {
        const pedido = indexedDB.open('e2e-control', 1);
        pedido.onupgradeneeded = () => pedido.result.createObjectStore('x');
        pedido.onerror = () => mal(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          const tx = db.transaction('x', 'readwrite');
          tx.objectStore('x').put(v, 'k');
          tx.oncomplete = () => {
            db.close();
            ok();
          };
          tx.onerror = () => mal(tx.error);
        };
      }),
    valor,
  );

const quitarIdb = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((ok, mal) => {
        const pedido = indexedDB.deleteDatabase('e2e-control');
        pedido.onsuccess = () => ok();
        pedido.onerror = () => mal(pedido.error);
        pedido.onblocked = () => mal(new Error('base de control bloqueada'));
      }),
  );

test('R5.1: abrir, escribir y pulsar GitHub y correo no guarda nada en el navegador ni sale a la red', async ({ page, context }) => {
  await sinModelo(context);
  const rutaGithub: string[] = [];
  await context.route(
    (url) => url.hostname === 'github.com',
    async (ruta) => {
      rutaGithub.push(ruta.request().url());
      await ruta.abort('blockedbyclient');
    },
  );
  const red = registrarRed(context, page);
  await abrir(page, `/es/${HIPOCAMPO.slug.es}`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);

  // Precondiciones: sin analítica en el documento (el build la lleva) y un registro que sí ve la carga.
  expect(await baseFoto(page), 'el documento ya trae el beacon de analítica: esta prueba corre contra el servidor de desarrollo').toEqual({ beacons: 0, marca: false });
  expect(red.pagina.length, 'el registro no vio ninguna petición de la carga').toBeGreaterThan(0);
  await esperarSilencio(red);
  const base = await foto(page);
  expect(base.localStorage, 'la foto no lee localStorage').toContainEqual(['atlas:aviso-visto', '1']);

  // Desde aquí, la página no puede hacer ninguna petición.
  red.pagina.length = 0;
  red.otras.length = 0;
  const reportar = boton(page, tr('es', 'reporte.boton'));
  await reportar.scrollIntoViewIfNeeded();
  await reportar.click();
  await expect(dialogo(page)).toBeVisible();
  const fotoVacio = await foto(page);

  await elegirTipo(page, 'es', 'contenido');
  await parteDe(page).selectOption('que_es');
  const marcador = 'zqxr51marcador';
  const texto = `El dato ${marcador} está mal escrito`;
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

  // El correo se pulsa de verdad, sin interceptarlo ni filtrarlo. Chromium informa la navegación a `mailto:` como un
  // evento `request` (`GET mailto:... document`), aunque nada sale a la red: el sistema operativo se la entrega al
  // programa de correo. Por eso la lista de la página debe quedar con esa única entrada, igual al `href` del enlace;
  // cualquier otra petición hace fallar la prueba.
  const correo = enlaceCorreoDe(page, 'es');
  const hrefCorreo = (await correo.getAttribute('href'))!;
  expect(hrefCorreo).toMatch(/^mailto:info@maysasp\.com\?/);
  const peticionesAntesDelCorreo = [...red.pagina];
  const urlAntes = page.url();
  await correo.click();
  await page.waitForTimeout(1000);
  const urlDespues = page.url();
  const dialogoVisible = await dialogo(page).isVisible();
  const fotoFinal = await foto(page);

  // Todo se lee una vez, al final.
  const peticionesPagina = [...red.pagina];
  const peticionesOtras = red.otras.map((linea) => linea.split(' ')[1]);
  const nuevas = red.paginasNuevas.length;
  expect(peticionesAntesDelCorreo, 'peticiones de la página desde que se abre el diálogo hasta pulsar el correo').toEqual([]);
  expect(peticionesPagina, 'peticiones de la página tras pulsar el correo').toEqual([`GET ${hrefCorreo} document`]);
  expect(nuevas, 'pestañas nuevas').toBe(1);
  expect(peticionesOtras, 'peticiones de la pestaña nueva').toEqual([hrefGithub]);
  expect(rutaGithub).toEqual([hrefGithub]);
  expect(urlDespues).toBe(urlAntes);
  expect(dialogoVisible).toBe(true);
  expect(fotoVacio, 'con el diálogo vacío').toEqual(base);
  expect(fotoMitad, 'a mitad del texto').toEqual(base);
  expect(fotoTexto, 'con el texto completo').toEqual(base);
  expect(fotoGithub, 'después de GitHub').toEqual(base);
  expect(fotoFinal, 'después del correo').toEqual(base);
  expect(JSON.stringify(fotoFinal)).not.toContain(marcador);
  await nueva.close();

  // Controles: la foto ve un cambio en cada almacén y vuelve a la base al deshacerlo.
  await controlDetecta(
    page,
    base,
    'localStorage',
    () => page.evaluate(() => localStorage.setItem('e2e-control', '1')),
    () => page.evaluate(() => localStorage.removeItem('e2e-control')),
  );
  await controlDetecta(
    page,
    base,
    'sessionStorage',
    () => page.evaluate(() => sessionStorage.setItem('e2e-control', '1')),
    () => page.evaluate(() => sessionStorage.removeItem('e2e-control')),
  );
  await controlDetecta(
    page,
    base,
    'cookie',
    () => page.evaluate(() => (document.cookie = 'e2e-control=1; path=/')),
    () => page.evaluate(() => (document.cookie = 'e2e-control=; path=/; max-age=0')),
  );
  // IndexedDB: además de las llaves, la foto lee los valores (la misma llave con otro valor cambia la foto).
  await ponerIdb(page, 'a');
  const conA = await foto(page);
  expect(conA, 'control IndexedDB: la foto no vio la base nueva').not.toEqual(base);
  await ponerIdb(page, 'b');
  expect(await foto(page), 'control IndexedDB: la foto no lee los valores').not.toEqual(conA);
  await quitarIdb(page);
  expect(await foto(page), 'control IndexedDB: no volvió a la base').toEqual(base);
});

/** Formulario recién abierto: nada marcado, parte `general`, descripción vacía, contador en cero y enlaces apagados. */
async function formularioVacio(page: Page) {
  const caja = dialogo(page);
  await expect(caja.getByRole('radio')).toHaveCount(4);
  for (const tipo of TIPOS_FORM) {
    await expect(caja.getByRole('radio', { name: tr('es', `reporte.tipo.${tipo}`), exact: true })).not.toBeChecked();
  }
  await expect(parteDe(page)).toHaveValue('general');
  await expect(descripcionDe(page)).toHaveValue('');
  await expect(caja.getByText(tr('es', 'reporte.contador', { n: 0, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
  await desactivado(enlaceGithubDe(page, 'es'));
  await desactivado(enlaceCorreoDe(page, 'es'));
}

test('R5.2: cerrar con Escape o con "Cerrar" descarta el borrador y al reabrir el formulario está vacío', async ({ page }) => {
  const reportar = await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  await formularioVacio(page);

  const rondas: { tipo: TipoReporte; parte: string; cerrar: () => Promise<void> }[] = [
    { tipo: 'pieza', parte: 'que_es', cerrar: () => page.keyboard.press('Escape') },
    { tipo: 'traduccion', parte: 'ubicacion', cerrar: () => caja.getByRole('button', { name: tr('es', 'reporte.cerrar') }).click() },
  ];
  for (const ronda of rondas) {
    const escrito = 'texto de prueba';
    await elegirTipo(page, 'es', ronda.tipo);
    await parteDe(page).selectOption(ronda.parte);
    await descripcionDe(page).fill(escrito);
    // El formulario sí quedó lleno: sin esto, "vacío" al reabrir no probaría nada.
    await expect(caja.getByRole('radio', { name: tr('es', `reporte.tipo.${ronda.tipo}`), exact: true })).toBeChecked();
    await expect(parteDe(page)).toHaveValue(ronda.parte);
    await expect(descripcionDe(page)).toHaveValue(escrito);
    await expect(caja.getByText(tr('es', 'reporte.contador', { n: escrito.length, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
    await expect(enlaceGithubDe(page, 'es')).toHaveAttribute('href', /^https:\/\/github\.com\//);

    await ronda.cerrar();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(reportar).toBeFocused();
    await reportar.click();
    await expect(dialogo(page)).toBeVisible();
    await formularioVacio(page);
  }
});

test('D1: en revisión bloqueada, con r=PRUEBA01 en la URL, ningún enlace del reporte lleva el código', async ({ page, context }) => {
  await sinModelo(context);
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e-cargas', String(Number(sessionStorage.getItem('e2e-cargas') ?? '0') + 1));
    // Como un beacon que no se quita con la recarga: <html> lleva la marca del cargador en cada carga.
    const marcar = () => document.documentElement?.setAttribute('data-beacon-cargado', '1');
    marcar();
    new MutationObserver(marcar).observe(document, { childList: true, subtree: true });
  });
  // Carga 1: la app recarga para adoptar el código; carga 2: la marca sigue puesta y la revisión queda bloqueada.
  await abrir(page, '/es/revision?r=PRUEBA01');
  await expect(page.getByTestId('revision-bloqueada')).toBeVisible();
  const estado = await page.evaluate(() => ({
    cargas: sessionStorage.getItem('e2e-cargas'),
    revisor: (window as unknown as { __atlas: { getState(): { revisor: string | null } } }).__atlas.getState().revisor,
  }));
  expect(estado).toEqual({ cargas: '2', revisor: null });
  expect(page.url()).toContain('r=PRUEBA01');

  // Navegación del cliente a la ficha conservando `?r=` (sin recargar, para no volver a la carga 1).
  await page.evaluate((ruta) => {
    history.pushState({}, '', ruta);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `/es/${HIPOCAMPO.slug.es}?r=PRUEBA01`);
  await fichaLista(page, 'hippocampus', HIPOCAMPO.nombre.es);
  expect(page.url()).toContain('r=PRUEBA01');
  const reportar = boton(page, tr('es', 'reporte.boton'));
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
  // Tal cual y decodificado: `?r=PRUEBA01` pegado a la descripción saldría como `%3Fr%3DPRUEBA01`.
  for (const href of [hrefGithub, hrefCorreo, decodeURIComponent(hrefGithub), decodeURIComponent(hrefCorreo)]) {
    expect(href).not.toContain('PRUEBA01');
    expect(href).not.toContain('r=');
  }
});
