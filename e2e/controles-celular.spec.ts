// Issue 194: en celular los botones del dock se salían por la derecha, las marcas del deslizador se
// pisaban con él y Post asomaba fuera del círculo de la brújula. Se miden las cajas reales (sin modelo:
// el dock y la brújula no dependen de él) a varios anchos y con la raíz al 100 % y al 125 %.
import { expect, test, type Page } from '@playwright/test';

interface R {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Control {
  nombre: string;
  caja: R;
  texto: R | null;
}
interface Medida {
  rem: number;
  letraNivel: number;
  dock: { caja: R; interior: R; scrollW: number; clientW: number; ancho: string };
  controles: Control[];
  deslizador: R;
  marcas: Control[];
  marcasPosicion: string;
  brujula: { caja: R; radioInterior: number; padding: number };
  botones: Control[];
  centro: R;
}

async function preparar(page: Page, ruta: string, texto125: boolean) {
  await page.addInitScript(() => localStorage.setItem('atlas:aviso-visto', '1'));
  // Sin transiciones: las cajas no se miden a mitad de una animación.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Sin modelo: el visor muestra su error y el dock y la brújula quedan montados.
  await page.route('**/modelos/atlas.glb', (r) => r.abort());
  await page.goto(ruta);
  await expect(page.getByTestId('visor-error')).toBeVisible();
  // Texto grande: la raíz al 125 % (rem = 20 px). Se comprueba con D9 en cada prueba.
  if (texto125) await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

/** Corte activo y un filtro, sin modelo (con `setState` directo): aparecen la nota y "Mostrar todo". */
async function conCortesYFiltro(page: Page) {
  await page.evaluate(() => {
    const a = (
      window as unknown as {
        __atlas: { getState(): { cortes: Record<string, unknown> }; setState(p: object): void };
      }
    ).__atlas;
    a.setState({
      ocultas: new Set(['thalamus-r']),
      cortes: { ...a.getState().cortes, coronal: { activo: true, mm: 0, invertido: false } },
    });
  });
  await expect(page.getByTestId('explosion-bloqueada')).toBeVisible();
  await expect(page.getByTestId('mostrar-todo')).toBeVisible();
}

const medir = (page: Page): Promise<Medida> =>
  page.evaluate(() => {
    const caja = (b: DOMRect): R => ({ x: b.x, y: b.y, w: b.width, h: b.height });
    const texto = (e: Element): R => {
      const g = document.createRange();
      g.selectNodeContents(e);
      return caja(g.getBoundingClientRect());
    };
    const control = (e: Element, nombre: string, conTexto: boolean): Control => ({
      nombre,
      caja: caja(e.getBoundingClientRect()),
      texto: conTexto ? texto(e) : null,
    });
    const dock = document.querySelector('.dock')!;
    const brujula = document.querySelector('.brujula')!;
    const d = caja(dock.getBoundingClientRect());
    const cd = getComputedStyle(dock);
    const bi = parseFloat(cd.borderLeftWidth);
    const bs = parseFloat(cd.borderTopWidth);
    const interior: R = { x: d.x + bi, y: d.y + bs, w: d.w - 2 * bi, h: d.h - 2 * bs };

    const controles: Control[] = [];
    dock.querySelectorAll('.dock-niveles button').forEach((e) => controles.push(control(e, `nivel ${e.textContent}`, true)));
    controles.push(control(dock.querySelector('[data-testid="reensamblar"]')!, 'Reensamblar', true));
    controles.push(control(dock.querySelector('[data-testid="explosion"]')!, 'deslizador', false));
    controles.push(control(dock.querySelector('.dock-valor')!, 'valor', false));
    const mostrar = dock.querySelector('[data-testid="mostrar-todo"]');
    if (mostrar) controles.push(control(mostrar, 'Mostrar todo', true));
    const nota = dock.querySelector('[data-testid="explosion-bloqueada"]');
    if (nota) controles.push(control(nota, 'nota de cortes', true));

    const marcas: Control[] = [];
    dock.querySelectorAll('.dock-marcas li').forEach((e) => marcas.push(control(e, e.textContent ?? '', true)));

    const cb = getComputedStyle(brujula);
    const bb = caja(brujula.getBoundingClientRect());
    const borde = parseFloat(cb.borderLeftWidth);
    const botones: Control[] = [];
    brujula.querySelectorAll('button').forEach((e) => botones.push(control(e, e.getAttribute('data-vista') ?? '', true)));

    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      letraNivel: parseFloat(getComputedStyle(dock.querySelector('.dock-niveles button')!).fontSize),
      dock: { caja: d, interior, scrollW: dock.scrollWidth, clientW: dock.clientWidth, ancho: cd.width },
      controles,
      deslizador: caja(dock.querySelector('[data-testid="explosion"]')!.getBoundingClientRect()),
      marcas,
      marcasPosicion: getComputedStyle(dock.querySelector('.dock-marcas')!).position,
      brujula: { caja: bb, radioInterior: (bb.w - 2 * borde) / 2, padding: parseFloat(cb.paddingTop) },
      botones,
      centro: caja(document.querySelector('.centro')!.getBoundingClientRect()),
    };
  });

const TOL = 0.5;
/** Cuánto se sale `a` de `b` por el lado que más se sale (0 o menos: queda dentro). */
const exceso = (a: R, b: R) => Math.max(b.x - a.x, b.y - a.y, a.x + a.w - (b.x + b.w), a.y + a.h - (b.y + b.h));
const seIntersecan = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fmt = (r: R) => `[x ${r.x.toFixed(1)}, y ${r.y.toFixed(1)}, ${r.w.toFixed(1)} x ${r.h.toFixed(1)}]`;

/** D1, D2 y D5: cada control del dock dentro del interior del dock, sin desborde horizontal, texto dentro de su botón. */
function comprobarDock(m: Medida, etiqueta: string) {
  for (const c of m.controles) {
    expect.soft(exceso(c.caja, m.dock.interior), `${etiqueta}: ${c.nombre} dentro del dock ${fmt(c.caja)} en ${fmt(m.dock.interior)}`).toBeLessThanOrEqual(TOL);
    if (c.texto) {
      expect.soft(exceso(c.texto, c.caja), `${etiqueta}: texto de ${c.nombre} dentro de su caja ${fmt(c.texto)} en ${fmt(c.caja)}`).toBeLessThanOrEqual(TOL);
    }
  }
  expect.soft(m.dock.scrollW, `${etiqueta}: el dock no tiene desborde horizontal`).toBeLessThanOrEqual(m.dock.clientW);
}

/** D3: las marcas se leen completas, no tocan el deslizador, no se cruzan y conservan su altura. */
function comprobarMarcas(m: Medida, etiqueta: string) {
  expect.soft(m.marcas, `${etiqueta}: hay tres marcas`).toHaveLength(3);
  const yI = m.deslizador.y + 0.45 * m.rem;
  const yA = m.deslizador.y + m.deslizador.h - 0.45 * m.rem;
  const esperado = [yI, yA - 0.7 * (yA - yI), yA];
  m.marcas.forEach((c, i) => {
    const t = c.texto!;
    expect.soft(exceso(t, m.dock.interior), `${etiqueta}: marca ${c.nombre} dentro del dock ${fmt(t)} en ${fmt(m.dock.interior)}`).toBeLessThanOrEqual(TOL);
    expect.soft(t.x + t.w, `${etiqueta}: marca ${c.nombre} a 0,2rem o más del deslizador (borde derecho ${(t.x + t.w).toFixed(1)}, deslizador en ${m.deslizador.x.toFixed(1)})`).toBeLessThanOrEqual(m.deslizador.x - 0.2 * m.rem + 0.01);
    expect.soft(Math.abs(t.y + t.h / 2 - esperado[i]!), `${etiqueta}: altura de la marca ${c.nombre} (centro ${(t.y + t.h / 2).toFixed(1)}, esperado ${esperado[i]!.toFixed(1)})`).toBeLessThanOrEqual(1);
    for (const otra of m.marcas.slice(i + 1)) {
      expect.soft(seIntersecan(t, otra.texto!), `${etiqueta}: las marcas ${c.nombre} y ${otra.nombre} no se cruzan`).toBe(false);
    }
  });
}

/** D4 y D5 de la brújula: cuadrada, cada botón dentro del círculo y su texto dentro de su botón. */
function comprobarBrujula(m: Medida, etiqueta: string) {
  const b = m.brujula;
  expect.soft(Math.abs(b.caja.w - b.caja.h), `${etiqueta}: la brújula es cuadrada ${fmt(b.caja)}`).toBeLessThanOrEqual(TOL);
  const cx = b.caja.x + b.caja.w / 2;
  const cy = b.caja.y + b.caja.h / 2;
  expect.soft(m.botones, `${etiqueta}: hay seis botones en la brújula`).toHaveLength(6);
  for (const c of m.botones) {
    const dist = Math.hypot(c.caja.x + c.caja.w / 2 - cx, c.caja.y + c.caja.h / 2 - cy);
    const alcance = dist + c.caja.w / 2;
    expect.soft(alcance, `${etiqueta}: ${c.nombre} dentro del círculo (alcance ${alcance.toFixed(1)}, radio interior ${b.radioInterior.toFixed(1)})`).toBeLessThanOrEqual(b.radioInterior + TOL);
    expect.soft(exceso(c.texto!, c.caja), `${etiqueta}: texto de ${c.nombre} dentro de su botón ${fmt(c.texto!)} en ${fmt(c.caja)}`).toBeLessThanOrEqual(TOL);
  }
}

/** D6: el dock y la brújula no se cruzan y los dos quedan dentro de `.centro`. */
function comprobarSinCruces(m: Medida, etiqueta: string) {
  expect.soft(seIntersecan(m.dock.caja, m.brujula.caja), `${etiqueta}: dock ${fmt(m.dock.caja)} y brújula ${fmt(m.brujula.caja)} no se cruzan`).toBe(false);
  expect.soft(exceso(m.dock.caja, m.centro), `${etiqueta}: el dock dentro de .centro ${fmt(m.centro)}`).toBeLessThanOrEqual(TOL);
  expect.soft(exceso(m.brujula.caja, m.centro), `${etiqueta}: la brújula dentro de .centro ${fmt(m.centro)}`).toBeLessThanOrEqual(TOL);
}

/** D9: la emulación de texto grande surte efecto. */
function comprobarTexto(m: Medida, etiqueta: string, texto125: boolean) {
  expect.soft(Math.abs(m.letraNivel - (texto125 ? 13.6 : 10.88)), `${etiqueta}: tamaño de letra del botón de nivel (${m.letraNivel}px)`).toBeLessThanOrEqual(0.01);
}

const TAMANOS = [
  { w: 320, h: 568 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 428, h: 926 },
];
const TEXTOS = [false, true];

for (const { w, h } of TAMANOS) {
  test.describe(`celular ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

    for (const texto125 of TEXTOS) {
      const pct = texto125 ? '125 %' : '100 %';
      test(`es, texto al ${pct}: el dock y la brújula caben en su caja (#194)`, async ({ page }) => {
        const base = `${w}x${h} ${pct} es base`;
        await preparar(page, '/es', texto125);
        const m = await medir(page);
        comprobarTexto(m, base, texto125);
        comprobarDock(m, base);
        comprobarMarcas(m, base);
        comprobarBrujula(m, base);
        comprobarSinCruces(m, base);

        const extra = `${w}x${h} ${pct} es con corte y filtro`;
        await conCortesYFiltro(page);
        const e = await medir(page);
        comprobarDock(e, extra);
        comprobarMarcas(e, extra);
      });
    }
  });
}

for (const { w, h } of [TAMANOS[0]!, TAMANOS[3]!]) {
  test.describe(`celular ${w}x${h} en inglés`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

    for (const texto125 of TEXTOS) {
      const pct = texto125 ? '125 %' : '100 %';
      // "Assembled" es la marca más ancha: separa las marcas en flujo de las absolutas.
      test(`en, texto al ${pct}: el dock y la brújula caben en su caja (#194)`, async ({ page }) => {
        const base = `${w}x${h} ${pct} en base`;
        await preparar(page, '/en', texto125);
        const m = await medir(page);
        comprobarTexto(m, base, texto125);
        comprobarDock(m, base);
        comprobarMarcas(m, base);
        comprobarBrujula(m, base);
        comprobarSinCruces(m, base);

        const extra = `${w}x${h} ${pct} en con corte y filtro`;
        await conCortesYFiltro(page);
        const e = await medir(page);
        comprobarDock(e, extra);
        comprobarMarcas(e, extra);
      });
    }
  });
}

// Escritorio: el dock no cambia; la brújula conserva el tamaño de sus botones y crece solo en el
// padding para que Post (esquina) quepa en el círculo.
for (const alto of [720, 800]) {
  test(`escritorio 1280x${alto}: el dock sigue igual y la brújula contiene sus seis botones (#194)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: alto });
    const etiqueta = `1280x${alto} 100 % es base`;
    await preparar(page, '/es', false);
    const m = await medir(page);
    comprobarTexto(m, etiqueta, false);
    // D8: el dock no cambia.
    // Chromium redondea el ancho calculado a 1/64 px (105.594px): se compara con tolerancia, no como texto.
    expect.soft(Math.abs(parseFloat(m.dock.ancho) - 105.6), `${etiqueta}: ancho calculado del dock (${m.dock.ancho})`).toBeLessThanOrEqual(0.1);
    expect.soft(Math.abs(m.dock.caja.w - 105.6), `${etiqueta}: ancho del dock ${fmt(m.dock.caja)}`).toBeLessThanOrEqual(0.1);
    expect.soft(m.marcasPosicion, `${etiqueta}: las marcas siguen absolutas`).toBe('absolute');
    comprobarDock(m, etiqueta);
    comprobarMarcas(m, etiqueta);
    // Los botones de la brújula no cambian de tamaño; su padding sube a 1,15rem (18,4 px).
    for (const c of m.botones) {
      expect.soft(Math.abs(c.caja.w - 38.4) + Math.abs(c.caja.h - 38.4), `${etiqueta}: botón ${c.nombre} de 38,4 px ${fmt(c.caja)}`).toBeLessThanOrEqual(0.1);
    }
    expect.soft(Math.abs(m.brujula.padding - 18.4), `${etiqueta}: padding de la brújula (${m.brujula.padding}px)`).toBeLessThanOrEqual(0.1);
    expect.soft(Math.abs(m.brujula.caja.w - 160.4) + Math.abs(m.brujula.caja.h - 160.4), `${etiqueta}: brújula de 160,4 px ${fmt(m.brujula.caja)}`).toBeLessThanOrEqual(0.2);
    comprobarBrujula(m, etiqueta);
    comprobarSinCruces(m, etiqueta);
  });
}
