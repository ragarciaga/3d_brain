import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type Estado = Record<string, (...a: unknown[]) => void> & {
  cajas: Record<string, [number[], number[]]>;
  base: Record<string, number[]>;
  separadas: Record<string, number[]>;
  devueltas: Set<string>;
  ocultas: Set<string>;
  aislar: unknown;
  cortes: Record<string, { activo: boolean }>;
};
interface VentanaCortes {
  __atlas: { getState(): Estado };
  __cortes: {
    planosDe(p: string): number;
    fantasmas(): string[];
    cajasMundo(): Record<string, number[]>;
    recortePorVertices(): Record<string, { dibujada: boolean; planos: number; vertices: number; ocultos: number }>;
  };
  __puntoCorte(p: string): { x: number; y: number } | null;
  __recorte: () => number | null;
  __camara: { leer: (() => number[]) | null };
}

// Copias de los ayudantes de atlas.spec.ts: este archivo no los comparte para que cada prueba sea independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // El navegador de la prueba no tiene GPU y da pocos cuadros por segundo: sin esto el vigilante (R8.2) apagaría el relleno que se mira.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaCortes).__camara.leer?.() ?? []);
async function camaraQuieta(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await leerCamara(page);
        await page.waitForTimeout(400);
        const b = await leerCamara(page);
        return a.length !== 6 || b.length !== 6 ? Infinity : Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(1e-4);
}

const planosDe = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaCortes).__cortes.planosDe(p), pieza);
const fantasmas = (page: Page) => page.evaluate(() => (window as unknown as VentanaCortes).__cortes.fantasmas());
const recortePorVertices = (page: Page) => page.evaluate(() => (window as unknown as VentanaCortes).__cortes.recortePorVertices());
const puntoCorte = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaCortes).__puntoCorte(p), pieza);
/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaCortes).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);
const instantanea = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as VentanaCortes).__atlas.getState();
    return { base: s.base, separadas: s.separadas, devueltas: [...s.devueltas], ocultas: [...s.ocultas].sort(), aislar: s.aislar };
  });

/** Cajas y vértices de cada pieza tal como están en la escena, estables en dos lecturas separadas 300 ms. */
async function cajasMundo(page: Page) {
  const leer = () => page.evaluate(() => (window as unknown as VentanaCortes).__cortes.cajasMundo());
  let ultima = await leer();
  await expect
    .poll(async () => {
      await page.waitForTimeout(300);
      const b = await leer();
      const igual = JSON.stringify(b) === JSON.stringify(ultima);
      ultima = b;
      return igual;
    })
    .toBe(true);
  return ultima;
}

const nodos = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')).nodos as Record<string, { tipo: string; hijos?: string[] }>;
const piezasBajo = (id: string): string[] => (nodos[id]?.tipo === 'pieza' ? [id] : (nodos[id]?.hijos ?? []).flatMap(piezasBajo));

test('cortes en el visor: planos solo en el encéfalo, fantasma con ocultas y aislamiento, nada se mueve y punto sobre la cara del corte', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');
  const cajas = await page.evaluate(() => (window as unknown as VentanaCortes).__atlas.getState().cajas);

  // Oráculo independiente del código bajo prueba: el centro Z del encéfalo y un plano coronal que cruza el tálamo.
  const encefalo = piezasBajo('g-brain');
  const zs = encefalo.flatMap((p) => (cajas[p] ? [cajas[p]![0][2]!, cajas[p]![1][2]!] : []));
  const centroZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const zTalamo = (cajas['thalamus-l']![0][2]! + cajas['thalamus-l']![1][2]!) / 2;
  const mm = Math.round((zTalamo - centroZ) * 1000);
  const cruza = (p: string) => cajas[p]![0][2]! < centroZ + mm / 1000 && centroZ + mm / 1000 < cajas[p]![1][2]!;

  await test.step('(1) sin cortes ninguna pieza lleva planos (R8.3)', async () => {
    // Sin esta espera el 0 siguiente sería vacío: el vago siempre lleva su plano cuando el visor ya responde.
    await expect.poll(() => planosDe(page, 'vagus-nerve-x-r')).toBe(1);
    expect(await planosDe(page, 'thalamus-l')).toBe(0);
    expect(await planosDe(page, 'stomach')).toBe(0);
    expect(await puntoCorte(page, 'thalamus-l')).toBeNull();
    await accion(page, 'setFantasmaCorte', true);
    expect(await fantasmas(page)).toEqual([]);
  });

  await accion(page, 'alternarVisibles', ['thalamus-r'], false);
  const antes = await cajasMundo(page);
  const previo = await instantanea(page);
  expect(Object.keys(antes)).toHaveLength(287);
  expect(cruza('thalamus-l') && cruza('thalamus-r')).toBe(true);
  const plano = centroZ + mm / 1000;
  const enteraOculta = encefalo.find((p) => p !== 'thalamus-r' && cajas[p] && cajas[p]![0][2]! > plano)!;
  const enteraVisible = encefalo.find((p) => cajas[p] && cajas[p]![1][2]! < plano)!;
  expect([enteraOculta, enteraVisible]).not.toContain(undefined);

  await test.step('(3) un plano: 3 planos en la cruzada, 0 en la entera visible, la entera oculta sin dibujar, 1 en el vago, 0 en el órgano, y nada se mueve (R1.4, R2.1, R2.5)', async () => {
    await accion(page, 'setCorte', 'coronal', { activo: true, mm });
    await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(3);
    await expect.poll(() => planosDe(page, enteraVisible)).toBe(0);
    await expect.poll(async () => (await recortePorVertices(page))[enteraOculta]?.dibujada).toBe(false);
    expect((await recortePorVertices(page))['thalamus-l']!.dibujada).toBe(true);
    expect(await planosDe(page, 'vagus-nerve-x-r')).toBe(1);
    expect(await planosDe(page, 'stomach')).toBe(0);
    expect(await cajasMundo(page)).toEqual(antes);
  });

  await test.step('(4) fantasma: entra lo visible, cruzado o entero del lado oculto; no lo oculto, lo entero del lado visible ni lo que queda fuera del aislamiento (R2.6, R5.2)', async () => {
    await expect.poll(() => fantasmas(page)).toContain('thalamus-l');
    expect(await fantasmas(page)).not.toContain('thalamus-r');
    await expect.poll(() => fantasmas(page)).toContain(enteraOculta);
    expect(await fantasmas(page)).not.toContain(enteraVisible);
    await accion(page, 'alternarVisibles', ['thalamus-r'], true);
    await expect.poll(() => fantasmas(page)).toEqual(expect.arrayContaining(['thalamus-l', 'thalamus-r']));
    await accion(page, 'aislarPiezas', ['thalamus-l'], 'solo');
    await expect.poll(async () => (await fantasmas(page)).includes('thalamus-r')).toBe(false);
    expect(await fantasmas(page)).toContain('thalamus-l');
    await accion(page, 'salirAislar');
    await accion(page, 'alternarVisibles', ['thalamus-r'], false);
    await expect.poll(async () => (await fantasmas(page)).includes('thalamus-r')).toBe(false);
  });

  await test.step('(5) __puntoCorte da un punto sobre la cara del corte, dentro del lienzo (D1)', async () => {
    await accion(page, 'pedirCamara', { vista: 'anterior', encuadrar: ['thalamus-l'] });
    await camaraQuieta(page);
    const lienzo = await page.getByTestId('visor').locator('canvas').boundingBox();
    let p: { x: number; y: number } | null = null;
    await expect.poll(async () => (p = await puntoCorte(page, 'thalamus-l')) !== null).toBe(true);
    expect(p!.x).toBeGreaterThan(lienzo!.x);
    expect(p!.x).toBeLessThan(lienzo!.x + lienzo!.width);
    expect(p!.y).toBeGreaterThan(lienzo!.y);
    expect(p!.y).toBeLessThan(lienzo!.y + lienzo!.height);
  });

  await test.step('(6) tres planos: siguen 3 planos y nada se mueve (R1.4, R2.5)', async () => {
    await accion(page, 'setCorte', 'sagital', { activo: true, mm: 10 });
    await accion(page, 'setCorte', 'axial', { activo: true, mm: 3, invertido: true });
    expect(await planosDe(page, 'thalamus-l')).toBe(3);
    expect((await fantasmas(page)).length).toBeGreaterThan(0);
    expect(await cajasMundo(page)).toEqual(antes);
  });

  await test.step('(7) al quitar los cortes todo vuelve: sin planos, sin fantasma y cada pieza donde estaba (R8.3, R2.5)', async () => {
    await accion(page, 'quitarCortes');
    await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(0);
    await expect.poll(() => fantasmas(page)).toEqual([]);
    expect(await planosDe(page, 'vagus-nerve-x-r')).toBe(1);
    expect(await cajasMundo(page)).toEqual(antes);
    expect(await instantanea(page)).toEqual(previo);
  });
});

test('con un corte activo el recorrido del vago revela el nervio parada por parada y el corte sigue (R9.1)', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es/nervio-vago-x');
  const cajas = await page.evaluate(() => (window as unknown as VentanaCortes).__atlas.getState().cajas);
  // Oráculo independiente: con el coronal en 0 (centro Z del encéfalo) una pieza que el plano cruza lleva 3 planos;
  // el tálamo izquierdo puede quedar entero de un lado y llevar 0.
  const zs = piezasBajo('g-brain').flatMap((p) => (cajas[p] ? [cajas[p]![0][2]!, cajas[p]![1][2]!] : []));
  const centroZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const enElCorte = piezasBajo('g-brain').find((p) => cajas[p] && cajas[p]![0][2]! < centroZ && centroZ < cajas[p]![1][2]!)!;
  expect(enElCorte).toBeDefined();
  await accion(page, 'setCorte', 'coronal', { activo: true });
  await expect.poll(() => planosDe(page, enElCorte)).toBe(3);
  await page.getByTestId('iniciar-recorrido').click();
  const panel = page.getByTestId('recorrido');
  const altura = () => page.evaluate(() => (window as unknown as VentanaCortes).__recorte());
  // Misma espera que atlas.spec.ts, "el vago no se separa": el plano llega al nivel de la parada y queda quieto.
  const esperarEstable = async () => {
    let anterior = Number.NaN;
    await expect
      .poll(
        async () => {
          const a = await altura();
          const quieto = a !== null && Math.abs(a - anterior) < 1e-4;
          anterior = a ?? Number.NaN;
          return quieto;
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    return anterior;
  };
  const niveles: number[] = [];
  for (const n of [1, 2, 3, 4]) {
    if (n > 1) await page.getByTestId('recorrido-siguiente').click();
    await expect(panel).toContainText(`Parada ${n} de 4`);
    if (n > 1) await expect.poll(async () => (await altura()) ?? Infinity, { timeout: 30_000 }).toBeLessThan(niveles.at(-1)! - 0.005);
    niveles.push(await esperarEstable());
    const cortes = await page.evaluate(() => (window as unknown as VentanaCortes).__atlas.getState().cortes);
    expect(cortes['coronal']!.activo, `parada ${n}`).toBe(true);
    expect(await planosDe(page, enElCorte), `parada ${n}`).toBe(3);
    expect(await planosDe(page, 'vagus-nerve-x-r'), `parada ${n}`).toBe(1);
  }
  for (let i = 1; i < niveles.length; i++) expect(niveles[i]!).toBeLessThan(niveles[i - 1]!);
});

test('recorte por caja (#177): lo que no se dibuja estaba entero del lado oculto, lo que va sin planos entero del lado visible, y el fantasma sigue', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');
  const cajas = await page.evaluate(() => (window as unknown as VentanaCortes).__atlas.getState().cajas);
  const conCaja = piezasBajo('g-brain').filter((p) => cajas[p]);
  const antes = await cajasMundo(page);

  // Vacío si todo cumple. La equivalencia por vértices es exacta: un fragmento es combinación convexa de los vértices de su
  // triángulo, así que un semiespacio que contiene o excluye todos los vértices contiene o excluye todos sus fragmentos.
  const revisar = async () => {
    const r = await recortePorVertices(page);
    const piezas = Object.entries(r);
    const malas: string[] = [];
    for (const [p, v] of piezas) {
      if (!v.dibujada && v.ocultos !== v.vertices) malas.push(`${p}: no se dibuja y tiene ${v.vertices - v.ocultos} de ${v.vertices} vértices visibles`);
      if (v.dibujada && v.planos === 0 && v.ocultos !== 0) malas.push(`${p}: sin planos y tiene ${v.ocultos} vértices ocultos`);
      if (v.dibujada && v.planos !== 0 && v.planos !== 3) malas.push(`${p}: lleva ${v.planos} planos`);
    }
    const sinDibujar = piezas.filter(([, v]) => !v.dibujada).length;
    const sinPlanos = piezas.filter(([, v]) => v.dibujada && v.planos === 0).length;
    const conPlanos = piezas.filter(([, v]) => v.dibujada && v.planos === 3).length;
    if (!sinDibujar || !sinPlanos || !conPlanos) malas.push(`falta una clase: sin dibujar ${sinDibujar}, sin planos ${sinPlanos}, con 3 planos ${conPlanos}`);
    return malas.slice(0, 5).join(' | ');
  };

  await test.step('(1) sin cortes toda pieza del encéfalo se dibuja sin planos', async () => {
    await expect
      .poll(async () => {
        const r = await recortePorVertices(page);
        return Object.keys(r).length === conCaja.length && Object.values(r).every((v) => v.dibujada && v.planos === 0);
      })
      .toBe(true);
  });

  await test.step('(2) solo el sagital en 0: lo que no se dibuja está entero del lado oculto y lo que va sin planos entero del visible', async () => {
    await accion(page, 'setCorte', 'sagital', { activo: true, mm: 0 });
    await expect.poll(revisar, { timeout: 30_000 }).toBe('');
  });

  await test.step('(3) sagital, coronal y axial en 0 (el caso del issue): las mismas aserciones', async () => {
    await accion(page, 'setCorte', 'coronal', { activo: true, mm: 0 });
    await accion(page, 'setCorte', 'axial', { activo: true, mm: 0 });
    await expect.poll(revisar, { timeout: 30_000 }).toBe('');
  });

  await test.step('(4) con el fantasma activo, el fantasma incluye piezas que no se dibujan (R5.2)', async () => {
    await accion(page, 'setFantasmaCorte', true);
    await expect
      .poll(async () => {
        const r = await recortePorVertices(page);
        return (await fantasmas(page)).some((p) => r[p] && !r[p].dibujada);
      })
      .toBe(true);
  });

  await test.step('(5) al quitar los cortes todo se dibuja sin planos y ninguna caja cambia (R8.3, R2.5)', async () => {
    await accion(page, 'quitarCortes');
    await expect
      .poll(async () => {
        const r = await recortePorVertices(page);
        return Object.keys(r).length === conCaja.length && Object.values(r).every((v) => v.dibujada && v.planos === 0);
      })
      .toBe(true);
    expect(await cajasMundo(page)).toEqual(antes);
  });
});
