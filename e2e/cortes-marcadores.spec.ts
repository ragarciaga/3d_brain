import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type Vec = [number, number, number];

interface PuntoDibujado {
  id: string;
  lado: 'l' | 'r' | null;
  propuesta: boolean;
  fantasma: boolean;
  encima: boolean;
  opacidad: number;
  escribeProfundidad: boolean;
  pos: Vec;
}

interface VentanaMarcadores {
  __atlas: { getState(): Record<string, (...a: unknown[]) => void> & { cajas: Record<string, [number[], number[]]>; seleccion: { entrada: string | null } } };
  __marcadores: {
    inyectar(l: unknown[]): void;
    puntos: (() => PuntoDibujado[]) | null;
    enPantalla: ((pos: Vec) => { x: number; y: number }) | null;
  };
  __cortes: { planosDe(p: string): number };
  __camara: { leer: (() => number[]) | null };
}

// Copias de los ayudantes de cortes-visor.spec.ts: este archivo no los comparte para que cada prueba sea independiente.
async function abrir(page: Page, ruta: string) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // El navegador de la prueba no tiene GPU y da pocos cuadros por segundo: sin esto el vigilante (R8.2) apagaría el relleno.
  await page.addInitScript(() => Object.assign(window, { __sinVigilante: true }));
  await page.goto(ruta);
  await expect(page.getByTestId('piezas')).toHaveText(/287 (piezas|pieces)/, { timeout: 150_000 });
}

const leerCamara = (page: Page) => page.evaluate(() => (window as unknown as VentanaMarcadores).__camara.leer?.() ?? []);
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

/** Llama una acción del store (solo pruebas, con `window.__atlas` de DEV). */
const accion = (page: Page, nombre: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as VentanaMarcadores).__atlas.getState()[n as string]!(...(a as unknown[])), [nombre, args] as const);
const puntos = (page: Page) => page.evaluate(() => (window as unknown as VentanaMarcadores).__marcadores.puntos?.() ?? []);
const seleccionada = (page: Page) => page.evaluate(() => (window as unknown as VentanaMarcadores).__atlas.getState().seleccion.entrada);
const planosDe = (page: Page, pieza: string) => page.evaluate((p) => (window as unknown as VentanaMarcadores).__cortes.planosDe(p), pieza);
const inyectar = (page: Page, lista: unknown[]) => page.evaluate((l) => (window as unknown as VentanaMarcadores).__marcadores.inyectar(l), lista);
const enPantalla = (page: Page, pos: Vec) => page.evaluate((p) => (window as unknown as VentanaMarcadores).__marcadores.enPantalla?.(p) ?? null, pos);

/** Toca el lugar de un punto del mundo. Antes comprueba que el clic cae sobre el lienzo y que no había nada seleccionado. */
async function tocar(page: Page, pos: Vec) {
  await accion(page, 'deseleccionar');
  expect(await seleccionada(page)).toBeNull();
  const p = await enPantalla(page, pos);
  expect(p).not.toBeNull();
  const lienzo = (await page.getByTestId('visor').locator('canvas').boundingBox())!;
  expect(p!.x).toBeGreaterThan(lienzo.x);
  expect(p!.x).toBeLessThan(lienzo.x + lienzo.width);
  expect(p!.y).toBeGreaterThan(lienzo.y);
  expect(p!.y).toBeLessThan(lienzo.y + lienzo.height);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [p!.x, p!.y])).toBe('CANVAS');
  await page.mouse.click(p!.x, p!.y);
}

const nodos = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')).nodos as Record<string, { tipo: string; hijos?: string[]; padre: string | null }>;
const piezasBajo = (id: string): string[] => (nodos[id]?.tipo === 'pieza' ? [id] : (nodos[id]?.hijos ?? []).flatMap(piezasBajo));
/** Oráculo: sube por el árbol hasta `g-brain`. */
function enEncefaloOraculo(id: string): boolean {
  for (let n: string | null = id, i = 0; n && i < 64; n = nodos[n]?.padre ?? null, i++) if (n === 'g-brain') return true;
  return false;
}
const marcadoresJson = JSON.parse(readFileSync('src/data/marcadores.json', 'utf8')) as { id: string; padre: string }[];
const padreDe = new Map(marcadoresJson.map((m) => [m.id, m.padre]));

test('marcadores con cortes: el lado oculto no se dibuja ni se toca, el fantasma es translúcido, el vago no se corta y nada se mueve', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, '/es');
  const cajas = await page.evaluate(() => (window as unknown as VentanaMarcadores).__atlas.getState().cajas);

  // Oráculo independiente: centro y caja del encéfalo con las cajas del store.
  const encefalo = piezasBajo('g-brain');
  const lo: Vec = [Infinity, Infinity, Infinity];
  const hi: Vec = [-Infinity, -Infinity, -Infinity];
  for (const p of encefalo) {
    const c = cajas[p];
    if (!c) continue;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, c[0][i]!);
      hi[i] = Math.max(hi[i]!, c[1][i]!);
    }
  }
  const [cx, cy, cz] = [0, 1, 2].map((i) => (lo[i]! + hi[i]!) / 2) as Vec;
  const [minX, maxX, maxZ] = [lo[0], hi[0], hi[2]] as Vec;

  const base = { estado: 'aproximada', ancla: null, fuente_ubicacion: { es: 'prueba', en: 'test' } };
  const delante: Vec = [minX - 0.02, cy, maxZ + 0.01];
  const lado: Vec = [maxX + 0.02, cy, cz - 0.02];
  const vago: Vec = [minX - 0.02, cy + 0.02, maxZ + 0.01];
  const inyectados = [
    { ...base, id: 't-delante', padre: 'g-diencephalon', posicion: delante },
    { ...base, id: 't-lado', padre: 'g-diencephalon', posicion: lado },
    { ...base, id: 't-vago', padre: 'g-vagus-nerve-x', posicion: vago },
  ];
  const ids = ['t-delante', 't-lado', 't-vago'];
  const de = async (id: string) => (await puntos(page)).filter((p) => p.id === id);
  const unico = async (id: string) => {
    const r = await de(id);
    expect(r, id).toHaveLength(1);
    return r[0]!;
  };

  await test.step('(1) encuadre y marcadores inyectados', async () => {
    await accion(page, 'pedirCamara', { vista: 'anterior', encuadrar: encefalo });
    await camaraQuieta(page);
    await inyectar(page, inyectados);
    await expect.poll(async () => (await puntos(page)).filter((p) => ids.includes(p.id)).length).toBe(3);
  });

  await test.step('(2) sin cortes: los tres se dibujan normales y un toque selecciona (control positivo)', async () => {
    for (const [id, pos] of [['t-delante', delante], ['t-lado', lado], ['t-vago', vago]] as const) {
      const p = await unico(id);
      expect(p.fantasma).toBe(false);
      expect(p.pos).toEqual(pos);
    }
    await tocar(page, delante);
    await expect.poll(() => seleccionada(page)).toBe('t-delante');
  });

  await test.step('(3) coronal en 0: lo del lado oculto desaparece y no se toca; el lado visible y el vago siguen (D1, D3, D5, D6)', async () => {
    await accion(page, 'deseleccionar');
    await accion(page, 'setCorte', 'coronal', { activo: true, mm: 0 });
    await expect.poll(() => planosDe(page, 'thalamus-l')).toBe(3);
    await expect.poll(async () => (await de('t-delante')).length).toBe(0);
    for (const [id, pos] of [['t-lado', lado], ['t-vago', vago]] as const) {
      const p = await unico(id);
      expect(p.fantasma).toBe(false);
      expect(p.pos).toEqual(pos);
    }
    await tocar(page, delante);
    await page.waitForTimeout(300);
    expect(await seleccionada(page)).not.toBe('t-delante');
  });

  await test.step('(4) el lado visible se toca y se ve por encima (D3)', async () => {
    await tocar(page, lado);
    await expect.poll(() => seleccionada(page)).toBe('t-lado');
    expect((await unico('t-lado')).encima).toBe(true);
    // Control positivo de la etiqueta: el seleccionado visible la lleva.
    await expect.poll(() => page.locator('.etiqueta-3d').count()).toBe(1);
  });

  await test.step('(5) fantasma: translúcido, sin toque y con prueba de profundidad aunque esté seleccionado (D2)', async () => {
    await accion(page, 'setFantasmaCorte', true);
    await expect.poll(async () => (await de('t-delante')).length).toBe(1);
    const f = await unico('t-delante');
    expect(f.fantasma).toBe(true);
    expect(f.opacidad).toBeGreaterThan(0);
    expect(f.opacidad).toBeLessThanOrEqual(0.25);
    expect(f.escribeProfundidad).toBe(false);
    expect(f.pos).toEqual(delante);
    for (const [id, pos] of [['t-lado', lado], ['t-vago', vago]] as const) {
      const p = await unico(id);
      expect(p.fantasma).toBe(false);
      expect(p.opacidad).toBe(1);
      expect(p.escribeProfundidad).toBe(true);
      expect(p.pos).toEqual(pos);
    }
    await tocar(page, delante);
    await page.waitForTimeout(300);
    expect(await seleccionada(page)).not.toBe('t-delante');
    await accion(page, 'seleccionar', { entrada: 't-delante' });
    await expect.poll(async () => (await unico('t-delante')).fantasma).toBe(true);
    expect((await unico('t-delante')).encima).toBe(false);
    // Sin etiqueta: se lee una vez, con el fantasma ya seleccionado.
    expect(await page.locator('.etiqueta-3d').count()).toBe(0);
  });

  await test.step('(6) esconder con el fantasma apagado quita también al seleccionado (D1)', async () => {
    await accion(page, 'setFantasmaCorte', false);
    await expect.poll(async () => (await de('t-delante')).length).toBe(0);
    expect(await seleccionada(page)).toBe('t-delante');
  });

  await test.step('(7) al quitar los cortes todo vuelve normal y se toca (D4, D5)', async () => {
    await accion(page, 'quitarCortes');
    await expect.poll(async () => (await de('t-delante')).length).toBe(1);
    const p = await unico('t-delante');
    expect(p.fantasma).toBe(false);
    expect(p.encima).toBe(true);
    expect(p.opacidad).toBe(1);
    expect(p.escribeProfundidad).toBe(true);
    expect(p.pos).toEqual(delante);
    await tocar(page, delante);
    await expect.poll(() => seleccionada(page)).toBe('t-delante');
  });

  await test.step('(8) con datos reales: los tres planos en 0 mm (el enlace del issue) y solo el sagital esconden el lado recortado y dejan el resto (D7)', async () => {
    await accion(page, 'deseleccionar');
    await inyectar(page, []);
    await expect.poll(async () => (await puntos(page)).some((p) => ids.includes(p.id))).toBe(false);
    const reposo = await puntos(page);
    expect(reposo.length).toBeGreaterThan(0);
    const centro: Vec = [cx, cy, cz];
    // Oráculo: se esconde un punto cuyo marcador cuelga de `g-brain` y que queda en el lado positivo (el que se esconde por defecto) de algún eje cortado.
    const oculto = (p: PuntoDibujado, ejes: number[]) => enEncefaloOraculo(padreDe.get(p.id) ?? '') && ejes.some((e) => p.pos[e]! > centro[e]!);
    const casos: { planos: string[]; ejes: number[] }[] = [
      { planos: ['sagital', 'coronal', 'axial'], ejes: [0, 1, 2] },
      { planos: ['sagital'], ejes: [0] },
    ];
    for (const { planos, ejes } of casos) {
      for (const plano of planos) await accion(page, 'setCorte', plano, { activo: true, mm: 0 });
      const ocultos = reposo.filter((p) => oculto(p, ejes));
      const visibles = reposo.filter((p) => !oculto(p, ejes));
      expect(ocultos.length, planos.join()).toBeGreaterThan(0);
      expect(ocultos.map((p) => p.id), planos.join()).toContain('m-wernicke-area');
      if (planos.length === 1) expect(visibles.length).toBeGreaterThan(0);
      await expect.poll(async () => (await puntos(page)).length, planos.join()).toBe(visibles.length);
      expect(await puntos(page), planos.join()).toEqual(visibles);
      await accion(page, 'quitarCortes');
      await expect.poll(async () => (await puntos(page)).length).toBe(reposo.length);
      expect(await puntos(page)).toEqual(reposo);
    }
  });
  await test.step('(9) las propuestas de posición (verdes) siguen la misma regla: la del encéfalo se esconde y la del vago no (D1, D6)', async () => {
    const delEncefalo = 'm-wernicke-area';
    const delVago = marcadoresJson.find((m) => m.padre === 'g-vagus-nerve-x')!.id;
    expect(enEncefaloOraculo(padreDe.get(delEncefalo)!)).toBe(true);
    expect(enEncefaloOraculo(padreDe.get(delVago)!)).toBe(false);
    const pos: Vec = [cx, cy, cz + 0.03];
    const base = { campo: 'posicion', veredicto: 'corregir', posicion: pos, version: 'prueba', fecha: '2026-01-01' };
    await accion(page, 'responder', { ...base, estructura: delEncefalo });
    await accion(page, 'responder', { ...base, estructura: delVago });
    const propuestas = async () => (await puntos(page)).filter((p) => p.propuesta);
    await expect.poll(async () => (await propuestas()).length).toBe(2);
    expect((await propuestas()).map((p) => p.pos)).toEqual([pos, pos]);
    await accion(page, 'setCorte', 'coronal', { activo: true, mm: 0 });
    await expect.poll(async () => (await propuestas()).map((p) => p.id)).toEqual([delVago]);
    expect((await propuestas())[0]!.fantasma).toBe(false);
    await accion(page, 'setFantasmaCorte', true);
    await expect.poll(async () => (await propuestas()).map((p) => `${p.id}:${p.fantasma}`)).toEqual([`${delEncefalo}:true`, `${delVago}:false`]);
    await accion(page, 'quitarCortes');
    await expect.poll(async () => (await propuestas()).map((p) => `${p.id}:${p.fantasma}`)).toEqual([`${delEncefalo}:false`, `${delVago}:false`]);
    expect((await propuestas()).map((p) => p.pos)).toEqual([pos, pos]);
  });
});
