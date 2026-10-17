import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { protegerCanalReal } from './canal-real';

protegerCanalReal();

type Vec = [number, number, number];

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
      cajas: Record<string, [number[], number[]]>;
      base: Record<string, number[]>;
      separadas: Record<string, number[]>;
    };
  };
  __marcadores: {
    inyectar(l: unknown[]): void;
    puntos: (() => PuntoDibujado[]) | null;
  };
}

async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  await page.goto(ruta);
}

async function modeloCargado(page: Page) {
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const puntosDibujados = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaPrueba).__marcadores.puntos?.() ?? []);

const baseActual = (page: Page) =>
  page.evaluate(() => (window as unknown as VentanaPrueba).__atlas.getState().base as Record<string, Vec>);

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const suma = (a: readonly number[], b: readonly number[]): Vec => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const resta = (a: readonly number[], b: readonly number[]): Vec => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const medio = (a: readonly number[], b: readonly number[]): Vec => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, (a[2]! + b[2]!) / 2];
const dentro = (p: readonly number[], c: [number[], number[]]) => [0, 1, 2].every((i) => p[i]! >= c[0]![i]! && p[i]! <= c[1]![i]!);

const TOL = 1e-4; // 0,1 mm, en metros

test('marcadores: un punto por lado, siguen a su ancla al separar y vuelven exactos al armar', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');
  await modeloCargado(page);

  const { cL, cR, cajaL, cajaR } = await page.evaluate(() => {
    const s = (window as unknown as VentanaPrueba).__atlas.getState();
    return { cL: s.centros['thalamus-l']!, cR: s.centros['thalamus-r']!, cajaL: s.cajas['thalamus-l']!, cajaR: s.cajas['thalamus-r']! };
  });
  const posL = cL as Vec;
  const posR = cR as Vec;

  const base = { padre: 'g-diencephalon', estado: 'aproximada', fuente_ubicacion: { es: 'prueba', en: 'test' } };
  await page.evaluate(
    ([lista]) => (window as unknown as VentanaPrueba).__marcadores.inyectar(lista as unknown[]),
    [
      [
        { ...base, id: 't-par', ancla: 'thalamus', posicion: { l: posL, r: posR } },
        { ...base, id: 't-unico', ancla: 'thalamus', posicion: posL },
        { ...base, id: 't-sin-posicion', ancla: 'thalamus', posicion: null },
        { ...base, id: 't-sin-ancla', ancla: null, posicion: posL },
      ],
    ],
  );

  const de = (todos: PuntoDibujado[], id: string) => todos.filter((p) => p.id === id);
  const unico = (todos: PuntoDibujado[], id: string, lado: 'l' | 'r' | null) => {
    const r = de(todos, id).filter((p) => p.lado === lado);
    expect(r, `${id} ${lado}`).toHaveLength(1);
    return r[0]!.pos;
  };

  await expect
    .poll(async () => {
      const todos = await puntosDibujados(page);
      return ['t-par', 't-unico', 't-sin-posicion', 't-sin-ancla'].every((id) => de(todos, id).length > 0);
    })
    .toBe(true);

  await test.step('(a) en reposo, { l, r } dibuja un punto sobre cada tálamo', async () => {
    const todos = await puntosDibujados(page);
    const par = de(todos, 't-par');
    expect(par.map((p) => p.lado).sort()).toEqual(['l', 'r']);
    const pl = unico(todos, 't-par', 'l');
    const pr = unico(todos, 't-par', 'r');
    expect(dentro(pl, cajaL)).toBe(true);
    expect(dentro(pl, cajaR)).toBe(false);
    expect(dentro(pr, cajaR)).toBe(true);
    expect(dentro(pr, cajaL)).toBe(false);
    expect(pl).toEqual(posL);
    expect(pr).toEqual(posR);
  });

  await test.step('(d) en reposo, sin posición se dibuja en el centro de cada pieza', async () => {
    const todos = await puntosDibujados(page);
    expect(de(todos, 't-sin-posicion')).toHaveLength(2);
    expect(unico(todos, 't-sin-posicion', 'l')).toEqual(posL);
    expect(unico(todos, 't-sin-posicion', 'r')).toEqual(posR);
  });

  await test.step('separar al 60 %', async () => {
    await page.getByTestId('explosion').fill('60');
    await expect
      .poll(async () => {
        const b = (await baseActual(page))['thalamus-l'];
        return b ? Math.hypot(...(b as Vec)) : 0;
      })
      .toBeGreaterThan(0.01);
    const b = await baseActual(page);
    // Si los dos lados se movieran igual, un punto pegado al lado equivocado o al promedio no se notaría.
    expect(dist(b['thalamus-l']!, b['thalamus-r']!)).toBeGreaterThan(0.01);
  });

  const b = await baseActual(page);
  const bL = b['thalamus-l']!;
  const bR = b['thalamus-r']!;
  const promedioLR = medio(bL, bR);

  await test.step('(b) cada punto se desplaza lo mismo que su ancla', async () => {
    await expect
      .poll(async () => {
        const todos = await puntosDibujados(page);
        const pl = de(todos, 't-par').find((p) => p.lado === 'l')?.pos;
        const pr = de(todos, 't-par').find((p) => p.lado === 'r')?.pos;
        if (!pl || !pr) return Infinity;
        return Math.max(dist(resta(pl, posL), bL), dist(resta(pr, posR), bR));
      })
      .toBeLessThanOrEqual(TOL);
    const todos = await puntosDibujados(page);
    expect(dist(resta(unico(todos, 't-unico', null), posL), promedioLR)).toBeLessThanOrEqual(TOL);
    // El promedio no es el desplazamiento de un solo lado: una implementación que siguiera a una pieza fallaría.
    expect(dist(promedioLR, bL)).toBeGreaterThan(1e-3);
  });

  await test.step('(d) separado, sin posición sigue al centro de cada pieza', async () => {
    const todos = await puntosDibujados(page);
    expect(dist(unico(todos, 't-sin-posicion', 'l'), suma(posL, bL))).toBeLessThanOrEqual(TOL);
    expect(dist(unico(todos, 't-sin-posicion', 'r'), suma(posR, bR))).toBeLessThanOrEqual(TOL);
  });

  await test.step('(e) con posición y sin ancla no se mueve', async () => {
    const todos = await puntosDibujados(page);
    expect(unico(todos, 't-sin-ancla', null)).toEqual(posL);
  });

  await test.step('(c) al reensamblar cada punto vuelve exacto a su posición', async () => {
    await page.getByTestId('reensamblar').click();
    await expect
      .poll(async () => {
        const bb = await baseActual(page);
        return Object.values(bb).every((v) => v.every((x) => x === 0));
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const todos = await puntosDibujados(page);
        const pl = de(todos, 't-par').find((p) => p.lado === 'l')?.pos;
        return pl ? dist(pl, posL) : Infinity;
      })
      .toBe(0);
    const todos = await puntosDibujados(page);
    expect(unico(todos, 't-par', 'l')).toEqual(posL);
    expect(unico(todos, 't-par', 'r')).toEqual(posR);
    expect(unico(todos, 't-unico', null)).toEqual(posL);
    expect(unico(todos, 't-sin-ancla', null)).toEqual(posL);
    expect(unico(todos, 't-sin-posicion', 'l')).toEqual(posL);
    expect(unico(todos, 't-sin-posicion', 'r')).toEqual(posR);
  });
});

interface RespuestaMarcador {
  veredicto: string;
  campo: string;
  posicion?: Vec;
}

interface VentanaRevision {
  __atlas: {
    getState(): {
      seleccion: { entrada: string | null };
      ubicando: string | null;
      respuestas: Record<string, RespuestaMarcador>;
      responder(r: Record<string, unknown>): void;
    };
  };
}

// Los marcadores de la prueba salen de los datos, no de nombres escritos aquí; solo Wernicke se nombra porque la spec lo pide.
type DatoMarcador = { id: string; estado: string; posicion: unknown; fuente_ubicacion: { es: string; en: string } };
const datosMarcadores = JSON.parse(readFileSync('src/data/marcadores.json', 'utf8')) as DatoMarcador[];
const DESACUERDO = ' Las fuentes no coinciden: ';
const confirmables = datosMarcadores.filter((m) => m.estado === 'aproximada' && m.posicion !== null);
const GEN = confirmables.find((m) => !m.fuente_ubicacion.es.includes(DESACUERDO))!;
const OTRO = confirmables.find((m) => m.id !== GEN.id && !m.fuente_ubicacion.es.includes(DESACUERDO))!;
const WERNICKE = datosMarcadores.find((m) => m.id === 'm-wernicke-area')!;
const trozo = (t: string) => t.slice(0, 50);

async function entrarRevision(page: Page, codigo: string) {
  await abrir(page, `/es/revision?r=${codigo}`);
  await expect(page.getByTestId('panel-revision')).toContainText(codigo);
  await modeloCargado(page);
  await page.getByTestId('como-revisar').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('como-revisar')).toHaveCount(0);
}

/** Abre la ficha como lo hacen la búsqueda y el árbol, y espera a que la selección y el título sean los suyos. */
async function elegir(page: Page, id: string) {
  await page.evaluate((entrada) => window.dispatchEvent(new CustomEvent('atlas:elegir', { detail: { entrada } })), id);
  await expect.poll(() => page.evaluate(() => (window as unknown as VentanaRevision).__atlas.getState().seleccion.entrada)).toBe(id);
  await expect(page.locator('#ficha-titulo')).toBeVisible();
}

const respuestaDe = (page: Page, id: string) =>
  page.evaluate((k) => (window as unknown as VentanaRevision).__atlas.getState().respuestas[k] ?? null, `${id}|posicion|`);
const ubicandoAhora = (page: Page) => page.evaluate(() => (window as unknown as VentanaRevision).__atlas.getState().ubicando);

test('revisión de marcadores: fuente de la posición, "Correcto" con un toque y casos sin el botón (spec 04 R5.2, R5.3)', async ({ page }) => {
  test.setTimeout(240_000);
  expect(GEN, 'un marcador aproximado con posición y sin desacuerdo').toBeDefined();
  expect(OTRO).toBeDefined();
  expect(WERNICKE?.fuente_ubicacion.es, 'Wernicke trae el desacuerdo').toContain(DESACUERDO);
  await entrarRevision(page, 'MARCA01');

  const fuente = page.getByTestId('fuente-posicion');
  const correcta = page.getByTestId('posicion-correcta');
  const proponer = page.getByRole('button', { name: 'Proponer posición' });

  await test.step('(c) la fuente de la posición sale en el idioma activo y en la misma sección que "Proponer posición"', async () => {
    await elegir(page, GEN.id);
    await expect(fuente).toContainText(trozo(GEN.fuente_ubicacion.es));
    await expect(fuente).not.toContainText(trozo(GEN.fuente_ubicacion.en));
    await expect(fuente.getByRole('heading', { name: 'Método y fuente de la posición' })).toBeVisible();
    await expect(page.locator('section.ficha-campo').filter({ has: fuente }).filter({ has: proponer })).toHaveCount(1);
    // Sin duplicar el texto: solo está en el bloque de la fuente.
    await expect(page.getByTestId('ficha').getByText(trozo(GEN.fuente_ubicacion.es))).toHaveCount(1);

    await elegir(page, WERNICKE.id);
    const desacuerdo = WERNICKE.fuente_ubicacion.es.slice(WERNICKE.fuente_ubicacion.es.indexOf(DESACUERDO) + DESACUERDO.length);
    await expect(fuente).toContainText(trozo(desacuerdo));

    await elegir(page, GEN.id);
    await page.getByTestId('cambiar-idioma').click();
    await expect(page.getByTestId('idioma-actual')).toHaveText('EN');
    await expect.poll(() => page.evaluate(() => (window as unknown as VentanaRevision).__atlas.getState().seleccion.entrada)).toBe(GEN.id);
    await expect(fuente).toContainText(trozo(GEN.fuente_ubicacion.en));
    await expect(fuente).not.toContainText(trozo(GEN.fuente_ubicacion.es));
    await expect(fuente.getByRole('heading', { name: 'Method and source of the position' })).toBeVisible();
    await expect(correcta).toHaveText('Correct, the proposed position is right');
    await page.getByTestId('cambiar-idioma').click();
    await expect(page.getByTestId('idioma-actual')).toHaveText('ES');
    await expect(correcta).toHaveText('Correcto, la posición propuesta está bien');
  });

  await test.step('(d) "Correcto" guarda con un toque, sin coordenadas y sin modo ubicar; el segundo toque la borra', async () => {
    // Con "Proponer posición" abierto, confirmar cierra el modo ubicar.
    await proponer.click();
    await expect.poll(() => ubicandoAhora(page)).toBe(GEN.id);
    await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toBeVisible();

    await expect(correcta).toHaveAttribute('aria-pressed', 'false');
    await correcta.click();
    await expect(correcta).toHaveAttribute('aria-pressed', 'true');
    const r = await respuestaDe(page, GEN.id);
    expect(r).toMatchObject({ veredicto: 'correcto', campo: 'posicion' });
    expect(r?.posicion).toBeUndefined();
    expect(await ubicandoAhora(page)).toBeNull();
    await expect(page.getByText('Toca en el modelo el punto donde va esta estructura.')).toHaveCount(0);
    await expect(page.getByTestId('total-respuestas')).toHaveText('1 respuesta');
    await expect(page.getByTestId('posicion-propuesta')).toHaveCount(0);

    await correcta.click();
    await expect(correcta).toHaveAttribute('aria-pressed', 'false');
    expect(await respuestaDe(page, GEN.id)).toBeNull();
    await expect(page.getByTestId('total-respuestas')).toHaveText('0 respuestas');
  });

  await test.step('(e) con una posición ya propuesta, "Correcto" no aparece y la propuesta sigue', async () => {
    await page.evaluate(
      (id) =>
        (window as unknown as VentanaRevision).__atlas.getState().responder({
          estructura: id,
          campo: 'posicion',
          veredicto: 'corregir',
          posicion: [0.1, 1.5, -0.02],
          version: 'sin-ficha',
          fecha: '2026-10-11T00:00:00.000Z',
        }),
      GEN.id,
    );
    await expect(page.getByTestId('posicion-propuesta')).toBeVisible();
    await expect(correcta).toHaveCount(0);
    expect((await respuestaDe(page, GEN.id))?.posicion).toEqual([0.1, 1.5, -0.02]);
  });

  await test.step('(f) un marcador sin ubicar no muestra "Correcto" ni la fuente, pero sí "Proponer posición"', async () => {
    // El mismo módulo que usa la app (como atlas.spec.ts con la ficha revisada): se deja un marcador sin ubicar.
    await page.evaluate(async (id) => {
      const atlas = '/src/data/atlas.ts';
      const { marcadores } = await import(/* @vite-ignore */ atlas);
      const m = marcadores.find((x: { id: string }) => x.id === id);
      Object.assign(m, { estado: 'sin_ubicar', posicion: null, ancla: null, fuente_ubicacion: { es: '', en: '' } });
    }, OTRO.id);
    await elegir(page, OTRO.id);
    await expect(proponer).toBeVisible();
    await expect(correcta).toHaveCount(0);
    await expect(fuente).toHaveCount(0);
  });
});
