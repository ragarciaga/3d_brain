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
  __camara: { leer: (() => number[]) | null; desfase: (() => number) | null; pedidosAplicados: number };
}

// El total sale del modelo medido en Blender, sin escribirlo a mano.
const mallas = Object.keys((JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, unknown> }).cajas);
const trazos = mallas.filter((n) => /#t\d+$/.test(n)).sort();
const TOTAL = trazos.length;
const L00 = 'Vagus nerve (X).l#t00';
const L01 = 'Vagus nerve (X).l#t01';
const L02 = 'Vagus nerve (X).l#t02';
const R20 = 'Vagus nerve (X).r#t20';
const claveDe = (malla: string) => `vagus-nerve-x|trazo:${malla}|`;
const FARINGEO = 'm-pharyngeal-branch-of-vagus-nerve';

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

/** Cuánto le falta a la cámara real para llegar a su destino. `leer` da el destino, que no cambia mientras la cámara se mueve. */
const desfaseCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__camara.desfase?.() ?? Infinity);
const pedidosAplicados = (page: Page) => page.evaluate(() => (window as unknown as VentanaAtlas).__camara.pedidosAplicados);
/** El visor aplica el pedido de cámara en el siguiente render: antes de eso el destino que se lee es el del pedido anterior. */
const hastaPedidoAplicado = (page: Page, antes: number) => expect.poll(() => pedidosAplicados(page)).toBeGreaterThan(antes);

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
  // `leer` da el destino: con pocos cuadros por segundo (CPU lenta, índice de toque armándose) el destino ya es el final
  // pero la cámara que dibuja y que usan los rayos sigue en camino, y un punto proyectado así cae al lado de lo que se toca.
  await expect.poll(() => desfaseCamara(page)).toBeLessThan(1e-4);
}

/** Entra en modo revisión con un código propio, cierra la guía que se abre sola y espera el modelo. */
async function entrar(page: Page, codigo: string) {
  await abrir(page, `/es/revision?r=${codigo}`);
  await expect(barra(page)).toContainText(codigo);
  await expect(page.getByTestId('piezas')).toHaveText(/\d+ (piezas|pieces)/, { timeout: 150_000 });
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
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
  const pedidosAntes = await pedidosAplicados(page);
  await seccion(page).getByRole('button', { name: 'Abrir el primer trazo pendiente' }).click();
  await expect(queRevisar(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/es\/nervio-vago-x$/);
  await expect(page.locator('#ficha-titulo')).toBeFocused();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(L00);
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().aislar?.modo)).toBe('contexto');
  expect(await page.evaluate(() => (window as unknown as VentanaAtlas).__atlas.getState().camara?.malla)).toBe(L00);
  await hastaPedidoAplicado(page, pedidosAntes);
  await camaraQuieta(page);
  expect(await distancia(page)).toBeLessThan(antes);

  // D3 y D9: el panel del trazo va primero en la ficha, con su contador y el select con etiqueta visible.
  await expect(page.getByTestId('ficha').locator('.ficha-campo').first()).toHaveAttribute('data-testid', 'revision-trazo');
  await expect(panel(page).getByRole('heading', { name: 'Trazo 00 del vago izquierdo' })).toBeVisible();
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
  await expect.poll(async () => (await respuesta(page, L00))?.comentario, { timeout: 30_000 }).toBe('revisar en disección');
  expect(await respuesta(page, L00)).toMatchObject({ veredicto: 'corregir', ramo: 'no_se', malla: L00 });
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, L00))?.ramo).toBe('no_es_ramo');
  expect(await respuesta(page, L00)).toMatchObject({ comentario: 'revisar en disección', veredicto: 'corregir' });

  // Salir del campo guarda al instante, sin esperar la pausa: escribir y salir en una sola tarea de la página
  // (el temporizador de 500 ms no puede correr en medio), y leer el estado en esa misma tarea.
  const guardadoAlSalir = await comentario.evaluate((el, clave) => {
    const campo = el as HTMLTextAreaElement;
    campo.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, 'texto al salir');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.blur();
    return (window as unknown as VentanaAtlas).__atlas.getState().respuestas[clave]?.comentario ?? null;
  }, claveDe(L00));
  expect(guardadoAlSalir).toBe('texto al salir');
  expect(await respuesta(page, L00)).toMatchObject({ veredicto: 'corregir', ramo: 'no_es_ramo', malla: L00 });

  // D4: "Siguiente trazo" conserva el foco y no arrastra valores del trazo anterior.
  const siguiente = panel(page).getByRole('button', { name: 'Siguiente trazo' });
  await siguiente.click();
  await expect(siguiente).toBeFocused();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(L01);
  await expect(select).toHaveValue('');
  await expect(panel(page).getByLabel('Comentario (opcional)')).toHaveCount(0);

  // D6: la auditoría propone el ramo faríngeo; confirmarlo guarda "correcto" con ese ramo.
  await expect(panel(page).getByText('La auditoría del modelo propone: Ramo faríngeo del nervio vago')).toBeVisible();
  const correcto = panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' });
  await expect(correcto).toHaveAttribute('aria-pressed', 'false');
  await correcto.click();
  await expect(correcto).toHaveAttribute('aria-pressed', 'true');
  await expect(select).toHaveValue(FARINGEO);
  expect(await respuesta(page, L01)).toMatchObject({ veredicto: 'correcto', ramo: FARINGEO, malla: L01 });
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL - 2} de ${TOTAL}`);

  // Elegir en el select el mismo valor de la propuesta también es "correcto"; otro valor es "corregir".
  await siguiente.click();
  await expect.poll(async () => (await seleccion(page)).malla).toBe(L02);
  await expect(panel(page).getByText('La auditoría del modelo propone: No es un ramo (tronco del vago)')).toBeVisible();
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, L02))?.veredicto).toBe('correcto');
  await expect(panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveAttribute('aria-pressed', 'true');
  await expect(contador(page)).toHaveText(`Trazos por revisar: ${TOTAL - 3} de ${TOTAL}`);
  await select.selectOption('no_se');
  await expect.poll(async () => (await respuesta(page, L02))?.veredicto).toBe('corregir');
  await expect(panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' })).toHaveAttribute('aria-pressed', 'false');

  // Un segundo toque en "Correcto, es lo propuesto" borra la respuesta.
  await panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' }).click();
  await expect.poll(async () => (await respuesta(page, L02))?.veredicto).toBe('correcto');
  await panel(page).getByRole('button', { name: 'Correcto, es lo propuesto' }).click();
  await expect.poll(async () => await respuesta(page, L02)).toBeNull();
  await select.selectOption('no_es_ramo');
  await expect.poll(async () => (await respuesta(page, L02))?.veredicto).toBe('correcto');

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
