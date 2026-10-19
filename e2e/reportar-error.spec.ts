// "Reportar un error" (F12, spec 05, T5 y T6): el botón del pie de la ficha, su ausencia en modo revisión, el
// diálogo (foco, Escape, aislamiento y desplazamiento en celular) y el formulario (tipo, parte, descripción,
// enlaces a GitHub y al correo). Nombres, slugs, versión y textos se leen de los datos y de i18n (oráculo de
// solo lectura); los códigos de revisión son de prueba.
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
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

test('D3: un surrogate suelto no rompe el formulario y los enlaces llevan U+FFFD', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await abrirDialogo(page, 'es');
  const caja = dialogo(page);
  await elegirTipo(page, 'es', 'contenido');
  // El valor se fija por programa: ninguna tecla escribe un surrogate suelto.
  await descripcionDe(page).evaluate((el) => {
    const area = el as HTMLTextAreaElement;
    const poner = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    poner.call(area, 'a' + String.fromCharCode(0xd83d));
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(caja.getByText(tr('es', 'reporte.contador', { n: 2, max: MAX_DESCRIPCION }), { exact: true })).toBeVisible();
  const href = (await enlaceGithubDe(page, 'es').getAttribute('href'))!;
  expect(leerGithub(href)['descripcion']).toBe('a�');
  const mailto = (await enlaceCorreoDe(page, 'es').getAttribute('href'))!;
  expect(decodeURIComponent(new URL(mailto).search.split('&body=')[1]!)).toContain('a�');
  expect(mailto).toBe(esperadoCorreo('es', 'contenido', 'general', 'a�'));
  await expect(caja).toBeVisible();
  expect(errores).toEqual([]);
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
