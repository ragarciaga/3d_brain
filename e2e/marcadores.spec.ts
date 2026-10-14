import { expect, test, type Page } from '@playwright/test';

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
