// Trazos del vago desde "Qué revisar" (#62): sección con contador, abrir el primero pendiente, recorrerlos
// con "Siguiente trazo", comentario y propuesta de la auditoría. Helpers propios, como revision-dialogos.spec.ts.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

interface RespuestaTrazo {
  veredicto: string;
  ramo?: string;
  malla?: string;
  comentario?: string;
}

interface VentanaAtlas {
  __atlas: {
    getState(): {
      aislar: { modo: string } | null;
      seleccion: { entrada: string | null; pieza: string | null; malla: string | null };
      camara: { malla?: string } | null;
      respuestas: Record<string, RespuestaTrazo>;
      cargarRespuestas(r: Record<string, unknown>): void;
      rutas: unknown[];
    };
  };
  __camara: { leer: (() => number[]) | null };
}

// El total sale del modelo medido en Blender, sin escribirlo a mano.
const mallas = Object.keys((JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, unknown> }).cajas);
const trazos = mallas.filter((n) => /#t\d+$/.test(n)).sort();
const TOTAL = trazos.length;
const R20 = 'Vagus nerve (X).r#t20';
const claveDe = (malla: string) => `vagus-nerve-x|trazo:${malla}|`;

// Los trazos que prueba el recorrido salen de los datos que aprueba el editor, no de nombres escritos aquí: la
// auditoría de pipeline/auditar-vago.py decide cuál no tiene propuesta, cuál tiene un ramo y cuál no es ramo.
const datosTrazos = (JSON.parse(readFileSync('src/data/trazos-vago.json', 'utf8')) as { trazos: { malla: string; propuesta: string | null }[] }).trazos;
const estructurasJson = (
  JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as { estructuras: Record<string, { nombre: { es: string; en: string } }> }
).estructuras;
const NO_ES_RAMO = 'No es un ramo (tronco o raicilla)'; // revision.noEsRamo en es.json
const enOrden = (malla: string) => datosTrazos.find((t) => t.malla === malla)!;
/** Falla con un mensaje claro si los datos no traen el trazo que el recorrido necesita. */
function exigir(malla: string | undefined, cual: string): string {
  if (malla === undefined) throw new Error(`src/data/trazos-vago.json no trae ${cual}: el recorrido de trazos lo necesita`);
  return malla;
}
const SIN = exigir(
  trazos.find((m) => enOrden(m).propuesta === null),
  'ningún trazo sin propuesta',
);
const NO_ES = exigir(
  trazos.find((m) => enOrden(m).propuesta === 'no_es_ramo'),
  'ningún trazo con propuesta no_es_ramo',
);
// Con un ramo de la lista; si la corrida no trae ninguno, el siguiente no_es_ramo.
const CON = exigir(
  trazos.find((m) => ![null, 'no_es_ramo'].includes(enOrden(m).propuesta)) ?? trazos.find((m) => m !== NO_ES && enOrden(m).propuesta === 'no_es_ramo'),
  'ningún trazo con un ramo de la lista ni un segundo no_es_ramo',
);
/** Lo que la interfaz escribe tras "La auditoría del modelo propone:" para una propuesta, en español. */
const nombreDePropuesta = (id: string) => {
  if (id === 'no_es_ramo') return NO_ES_RAMO;
  const n = estructurasJson[id]!.nombre;
  return n.es !== 'PENDIENTE' ? n.es : n.en;
};
const tituloDe = (malla: string) => `Trazo ${/#t(\d+)$/.exec(malla)![1]} del vago ${malla.includes('.l#') ? 'izquierdo' : 'derecho'}`;

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

const barra = (page: Page) => page.getByTestId('panel-revision');
const queRevisar = (page: Page) => page.getByTestId('que-revisar');
const seccion = (page: Page) => page.locator('details[data-seccion="trazos"]');
const panel = (page: Page) => page.getByTestId('revision-trazo');
const contador = (page: Page) => page.getByTestId('trazos-pendientes');
const respuesta = (page: Page, malla: string) =>
  page.evaluate((k) => (window as unknown as VentanaAtlas).__atlas.getState().respuestas[k] ?? null, claveDe(malla));
const seleccion = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().seleccion);

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__camara.leer?.() ?? []);

async function distancia(page: Page) {
  const c = await leerCamara(page);
  return c.length === 6 ? Math.hypot(c[0]! - c[3]!, c[1]! - c[4]!, c[2]! - c[5]!) : -1;
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

/** Entra en modo revisión con un código propio, cierra la guía que se abre sola y espera el modelo. */
async function entrar(page: Page, codigo: string) {
  await abrir(page, `/es/revision?r=${codigo}`);
  await expect(barra(page)).toContainText(codigo);
  await expect(page.getByTestId('piezas')).toHaveText(/\d+ (piezas|pieces)/, { timeout: 150_000 });
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
}

/** Pulsa "Siguiente trazo" hasta que el trazo seleccionado sea `malla`; como mucho TOTAL pulsaciones. */
async function avanzarHasta(page: Page, malla: string) {
  const siguiente = panel(page).getByRole('button', { name: 'Siguiente trazo' });
  for (let i = 0; i < TOTAL; i++) {
    const actual = (await seleccion(page)).malla;
    if (actual === malla) return;
    await siguiente.click();
    await expect.poll(async () => (await seleccion(page)).malla).not.toBe(actual);
  }
  await expect.poll(async () => (await seleccion(page)).malla).toBe(malla);
}

/** Abre "Qué revisar" y la sección de trazos (cerrada por defecto). */
async function abrirSeccion(page: Page) {
  // En celular los botones de la barra están en el menú "Acciones".
  const acciones = barra(page).getByRole('button', { name: 'Acciones', exact: true });
  if (await acciones.isVisible()) await acciones.click();
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(queRevisar(page)).toBeVisible();
  await seccion(page).locator('summary').click();
  await expect(seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' })).toBeVisible();
}

test('trazos del vago desde "Qué revisar": se abren, se recorren con "Siguiente trazo" y el contador baja (#62)', async ({ page }) => {
  await entrar(page, 'TRAZOS01');
  await camaraQuieta(page);
  const antes = await distancia(page);
  expect(antes).toBeGreaterThan(0);

  // D1: la sección va justo después de las dudas y cuenta los trazos del modelo.
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(seccion(page)).toHaveCount(1);
  await expect(seccion(page).locator('summary')).toHaveText(`Trazos del vago (${TOTAL} de ${TOTAL})`);
  await expect(seccion(page).evaluate((el) => el.previousElementSibling?.getAttribute('data-seccion'))).resolves.toBe('dudas');
  await expect(seccion(page).getByRole('heading')).toHaveCount(0);
  await expect(seccion(page).locator('li')).toHaveCount(0);

  // D2: abrir el primer pendiente cierra el diálogo, abre la ficha del vago, lo resalta y lo encuadra.
  await seccion(page).locator('summary').click();
  await seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' }).click();
  await expect(queRevisar(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/es\/nervio-vago-x$/);
  await expect(page.locator('#ficha-titulo')).toBeFocused();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(trazos[0]);
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().aislar?.modo)).toBe('contexto');
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().camara?.malla)).toBe(trazos[0]);
  await camaraQuieta(page);
  expect(await distancia(page)).toBeLessThan(antes);

  // D3 y D9: el panel del trazo va primero en la ficha, con su contador y el select con etiqueta visible. Se prueba
  // con un trazo sin propuesta de la auditoría: no hay botón "Correcto, es lo propuesto".
  await avanzarHasta(page, SIN);
  await expect(page.getByTestId('ficha').locator('.ficha-campo').first()).toHaveAttribute('data-testid', 'revision-trazo');
  await expect(panel(page).getByRole('heading', { name: tituloDe(SIN) })).toBeVisible();
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL} de ${TOTAL}`);
  await expect(panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveCount(0);
  await expect(panel(page).locator('label', { hasText: /^Elige el ramo$/ })).toBeVisible();
  const select = panel(page).getByRole('combobox', { name: 'Elige el ramo' });
  await expect(select).toHaveCount(1);

  // D5: el comentario aparece con la respuesta, se guarda tras la pausa y sobrevive a cambiar el ramo.
  await expect(panel(page).getByLabel('Comentario (opcional)')).toHaveCount(0);
  await select.selectOption('no_se');
  await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL - 1} de ${TOTAL}`);
  const comentario = panel(page).getByLabel('Comentario (opcional)');
  await expect(comentario).toBeVisible();
  await expect(panel(page).locator('label', { hasText: /^Comentario \(opcional\)$/ })).toBeVisible();
  expect(await comentario.getAttribute('placeholder')).toBeNull();
  await expect(comentario).toHaveAttribute('maxlength', '4000'); // el tope que valida el importador
  await comentario.fill('revisar en disección');
  // Sin salir del campo: solo lo guarda la pausa de escritura (500 ms). El visor dibuja con WebGL por software y
  // un cuadro puede bloquear la página varios segundos (se midió hasta 5 s con PerformanceObserver 'longtask');
  // ese bloqueo atrasa el temporizador y también la lectura del estado, así que el tope es holgado.
  await expect.poll(async () => (await respuesta(page, SIN))?.comentario, { timeout: 30_000 }).toBe('revisar en disección');
  expect(await respuesta(page, SIN)).toMatchObject({ veredicto: 'corregir', ramo: 'no_se', malla: SIN });
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, SIN))?.ramo).toBe('no_es_ramo');
  expect(await respuesta(page, SIN)).toMatchObject({ comentario: 'revisar en disección', veredicto: 'corregir' });

  // Salir del campo guarda al instante, sin esperar la pausa: escribir y salir en una sola tarea de la página
  // (el temporizador de 500 ms no puede correr en medio), y leer el estado en esa misma tarea.
  const guardadoAlSalir = await comentario.evaluate((el, clave) => {
    const campo = el as HTMLTextAreaElement;
    campo.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, 'texto al salir');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.blur();
    return (window as unknown as VentanaAtlas).__atlas.getState().respuestas[clave]?.comentario ?? null;
  }, claveDe(SIN));
  expect(guardadoAlSalir).toBe('texto al salir');
  expect(await respuesta(page, SIN)).toMatchObject({ veredicto: 'corregir', ramo: 'no_es_ramo', malla: SIN });

  // D4: "Siguiente trazo" conserva el foco y no arrastra valores del trazo anterior.
  const siguiente = panel(page).getByRole('button', { name: 'Siguiente trazo' });
  await siguiente.click();
  await expect(siguiente).toBeFocused();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(trazos[(trazos.indexOf(SIN) + 1) % TOTAL]);
  await expect(select).toHaveValue('');
  await expect(panel(page).getByLabel('Comentario (opcional)')).toHaveCount(0);

  // D6: la auditoría propone un ramo de la lista (o que no es ramo); confirmarlo guarda "correcto" con esa propuesta.
  await avanzarHasta(page, CON);
  const propuestaCon = enOrden(CON).propuesta!;
  await expect(panel(page).getByText(`La auditoría del modelo propone: ${nombreDePropuesta(propuestaCon)}`)).toBeVisible();
  const correcto = panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' });
  await expect(correcto).toHaveAttribute('aria-pressed', 'false');
  await correcto.click();
  await expect(correcto).toHaveAttribute('aria-pressed', 'true');
  await expect(select).toHaveValue(propuestaCon);
  expect(await respuesta(page, CON)).toMatchObject({ veredicto: 'correcto', ramo: propuestaCon, malla: CON });
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL - 2} de ${TOTAL}`);

  // Elegir en el select el mismo valor de la propuesta también es "correcto"; otro valor es "corregir".
  await avanzarHasta(page, NO_ES);
  await expect(panel(page).getByText(`La auditoría del modelo propone: ${NO_ES_RAMO}`)).toBeVisible();
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, NO_ES))?.veredicto).toBe('correcto');
  await expect(panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveAttribute('aria-pressed', 'true');
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL - 3} de ${TOTAL}`);
  await select.selectOption('no_se');
  await expect.poll(async () => (await respuesta(page, NO_ES))?.veredicto).toBe('corregir');
  await expect(panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveAttribute('aria-pressed', 'false');

  // Un segundo toque en "Correcto, es lo propuesto" borra la respuesta.
  await panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' }).click();
  await expect.poll(async () => (await respuesta(page, NO_ES))?.veredicto).toBe('correcto');
  await panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' }).click();
  await expect.poll(async () => await respuesta(page, NO_ES)).toBeNull();
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, NO_ES))?.veredicto).toBe('correcto');

  // D1: al reabrir "Qué revisar", el resumen refleja lo respondido.
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(seccion(page).locator('summary')).toHaveText(`Trazos del vago (${TOTAL - 3} de ${TOTAL})`);
});

test('sin la sección de dudas, la de trazos es la primera de "Qué revisar" (#62)', async ({ page }) => {
  await entrar(page, 'TRAZOS04');
  // Todos los campos de las fichas con dudas, respondidos: salen de la lista y la sección "dudas" desaparece.
  const n = await page.evaluate(async () => {
    // Los mismos módulos que usa la app (el servidor de desarrollo los sirve por ruta); la ruta va en una variable
    // para que TypeScript no intente resolverla.
    const prioridad = '/src/lib/prioridad.ts';
    const atlas = '/src/data/atlas.ts';
    const { camposDeFicha } = await import(/* @vite-ignore */ prioridad);
    const { dudas } = await import(/* @vite-ignore */ atlas);
    const w = window as unknown as VentanaAtlas;
    const rutas = w.__atlas.getState().rutas;
    const hechas: Record<string, unknown> = {};
    for (const id of Object.keys(dudas)) {
      for (const clave of camposDeFicha(id, 'es', rutas) as string[]) {
        const [estructura, campo, idioma] = clave.split('|');
        hechas[clave] = { estructura, campo, idioma: idioma || undefined, veredicto: 'correcto', version: 'v', fecha: '2026-01-01T00:00:00.000Z' };
      }
    }
    w.__atlas.getState().cargarRespuestas(hechas);
    return Object.keys(hechas).length;
  });
  expect(n).toBeGreaterThan(0);
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await expect(queRevisar(page)).toBeVisible();
  await expect(queRevisar(page).locator('details[data-seccion="dudas"]')).toHaveCount(0);
  await expect(queRevisar(page).locator('details').first()).toHaveAttribute('data-seccion', 'trazos');
  await expect(queRevisar(page).locator('details[data-seccion="trazos"]')).toHaveCount(1);
  await expect(seccion(page).locator('summary')).toHaveText(`Trazos del vago (${TOTAL} de ${TOTAL})`);
});

test('"Siguiente trazo" queda deshabilitado con un solo pendiente y la sección avisa cuando no queda ninguno (#62)', async ({ page }) => {
  await entrar(page, 'TRAZOS02');
  const hechas = Object.fromEntries(
    trazos
      .filter((m) => m !== R20)
      .map((m) => [
        claveDe(m),
        { estructura: 'vagus-nerve-x', campo: `trazo:${m}`, veredicto: 'correcto', malla: m, ramo: 'no_se', version: 'v', fecha: '2026-01-01T00:00:00.000Z' },
      ]),
  );
  await page.evaluate((r) => (window as unknown as VentanaAtlas).__atlas.getState().cargarRespuestas(r), hechas);
  await expect(page.getByTestId('total-respuestas')).toHaveText(`${TOTAL - 1} respuestas`);

  await abrirSeccion(page);
  await expect(seccion(page).locator('summary')).toHaveText(`Trazos del vago (1 de ${TOTAL})`);
  await seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' }).click();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(R20);
  await expect(panel(page).getByRole('button', { name: 'Siguiente trazo' })).toBeDisabled();

  await panel(page).getByRole('combobox', { name: 'Elige el ramo' }).selectOption('no_se');
  await expect(contador(page)).toHaveText(`Trazos por revisar: 0 de ${TOTAL}`);
  await barra(page).getByRole('button', { name: /Qué revisar/ }).click();
  await seccion(page).locator('summary').click();
  await expect(seccion(page).getByText('Ya respondiste todos los trazos.')).toBeVisible();
  await expect(seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' })).toHaveCount(0);
});

test.describe('celular (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el select del trazo ocupa el ancho de la hoja sin salirse (#62)', async ({ page }) => {
    await entrar(page, 'TRAZOS03');
    await abrirSeccion(page);
    await seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' }).click();
    await expect(panel(page)).toBeVisible();

    const select = panel(page).getByRole('combobox', { name: 'Elige el ramo' });
    await select.scrollIntoViewIfNeeded();
    const caja = (await select.boundingBox())!;
    const hoja = (await page.locator('#panel-ficha').boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(hoja.x - 0.5);
    expect(caja.x + caja.width).toBeLessThanOrEqual(hoja.x + hoja.width + 0.5);
    expect(caja.width).toBeGreaterThan(hoja.width * 0.7);
    const medidas = await page.locator('#panel-ficha').evaluate((el) => ({ ancho: el.scrollWidth, visible: el.clientWidth }));
    expect(medidas.ancho).toBeLessThanOrEqual(medidas.visible);

    const siguiente = panel(page).getByRole('button', { name: 'Siguiente trazo' });
    await siguiente.scrollIntoViewIfNeeded();
    await expect(siguiente).toBeVisible();
  });
});
