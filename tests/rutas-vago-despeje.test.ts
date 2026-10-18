// Despeje de las rutas del vago (SPEC F25, ADR 0010): ninguna ruta publicada pasa por dentro de un
// órgano (trece anclajes y cinco lóbulos pulmonares), ninguna gira más de 30 grados entre segmentos
// seguidos, los dos recurrentes no se juntan y el asa del recurrente derecho queda junto al vago derecho.
// Mide sobre los archivos reales (pipeline/anclajes-vago.json, public/modelos/rutas-vago.json y la malla
// de public/modelos/atlas.glb para los pulmones), sin guardas: si falta uno, falla. El modelo de
// obstáculos es scripts/lib/despeje.ts y scripts/lib/pulmones.ts, independientes del generador
// (pipeline/generar-ramas-vago.py).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { aAltura, troncoPublicado, type P, type Rutas } from '../scripts/lib/asimetrias.ts';
import {
  CORTE_MINIMO,
  describir,
  distanciaAPolilinea,
  enGancho,
  GANCHO,
  giroMaximo,
  giros,
  GIRO_MAXIMO,
  monotonia,
  obstaculos,
  OBSTACULOS_CAJA,
  OBSTACULOS_TUBO,
  penetraciones,
  profundidad,
  separacion,
  TOLERANCIA,
  TOLERANCIA_GANCHO,
  TOLERANCIA_SURCO,
  toleranciaDe,
  yCimaArco,
  type AnclaConCortes,
  type DatosDespeje,
  type MallasPulmones,
  type Penetracion,
} from '../scripts/lib/despeje.ts';
import { io, triangulosDelDocumento } from '../scripts/lib/glb.ts';
import { LOBULOS, profundidadMalla, seccionar } from '../scripts/lib/pulmones.ts';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const mm = (m: number) => m * 1000;
const masBajoRuta = (pts: P[]): P => pts.reduce((a, b) => (b[1] < a[1] ? b : a));

const SEPARACION_MINIMA = 0.015; // 15 mm
const ASA_MAXIMA = 0.02; // 20 mm en planta

// ---------------------------------------------------------------------------------------------
// Unitarios del modelo, con anclajes escritos aquí (no dependen de los archivos reales).
// ---------------------------------------------------------------------------------------------
const caja = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): [P, P] => [
  [x0, y0, z0],
  [x1, y1, z1],
];
const malla = (cortes: { y: number; caja: [P, P] }[]): AnclaConCortes => ({
  tipo: 'MESH',
  // La caja de la pieza es la unión de sus franjas buenas: de ahí sale el eje anterior.
  caja: caja(
    Math.min(...cortes.map((c) => c.caja[0][0])),
    Math.min(...cortes.map((c) => c.caja[0][1])),
    Math.min(...cortes.map((c) => c.caja[0][2])),
    Math.max(...cortes.map((c) => c.caja[1][0])),
    Math.max(...cortes.map((c) => c.caja[1][1])),
    Math.max(...cortes.map((c) => c.caja[1][2])),
  ),
  cortes,
});
const sinte = (extra: Record<string, AnclaConCortes> = {}): DatosDespeje => ({
  anclas: {
    // La tráquea (z de −0,010 a 0,010) está por delante del esófago (z de −0,030 a −0,005): anterior = +Z.
    Trachea: malla([
      { y: 1.0025, caja: caja(-0.01, 1.0, -0.01, 0.01, 1.005, 0.01) },
      { y: 1.0075, caja: caja(-0.01, 1.005, -0.01, 0.01, 1.01, 0.01) },
      // Lámina de 0,03 mm de alto con caja ancha: no es una sección del órgano.
      { y: 1.0125, caja: caja(-0.05, 1.01, -0.05, 0.05, 1.01003, 0.05) },
      // Hueco entre franjas: de 1.01003 a 1.02 no hay órgano.
      { y: 1.0225, caja: caja(-0.01, 1.02, -0.01, 0.01, 1.025, 0.01) },
    ]),
    Oesophagus: malla([{ y: 1.0025, caja: caja(-0.008, 1.0, -0.03, 0.008, 1.005, -0.005) }]),
    ...extra,
  },
  trazos: {},
});

describe('modelo de obstáculos: cajas por franja', () => {
  const d = sinte();

  it('el centro de la tráquea está adentro: 10 mm hasta la cara más cercana', () => {
    // z = 0 queda a 10 mm de las dos caras z, x = 0 a 10 mm de las caras x. Pared común: el esófago
    // llega a z = −0,005 y la tráquea a z = −0,010, así que la pared se parte en −0,0075 (2,5 mm del eje de z).
    expect(mm(profundidad(d, 'Trachea', [0, 1.0025, 0.0]))).toBeCloseTo(7.5, 6);
    // Sin esófago en esa altura (1.0075) no hay pared común.
    expect(mm(profundidad(d, 'Trachea', [0, 1.0075, 0.0]))).toBeCloseTo(10, 6);
  });

  it('un punto fuera de la caja tiene profundidad negativa', () => {
    expect(mm(profundidad(d, 'Trachea', [0.012, 1.0075, 0]))).toBeCloseTo(-2, 6);
  });

  it('la pared común vale 0 para la tráquea y para el esófago', () => {
    const pared: [number, number, number] = [0, 1.0025, -0.0075];
    expect(profundidad(d, 'Trachea', pared)).toBeCloseTo(0, 9);
    expect(profundidad(d, 'Oesophagus', pared)).toBeCloseTo(0, 9);
    // A 1 mm hacia el esófago, está 1 mm dentro del esófago y 1 mm fuera de la tráquea.
    expect(mm(profundidad(d, 'Oesophagus', [0, 1.0025, -0.0085]))).toBeCloseTo(1, 6);
    expect(mm(profundidad(d, 'Trachea', [0, 1.0025, -0.0085]))).toBeCloseTo(-1, 6);
  });

  it('una franja de menos de 1 mm de alto se ignora', () => {
    expect(CORTE_MINIMO).toBe(0.001);
    expect(profundidad(d, 'Trachea', [0.04, 1.01001, 0.04])).toBe(-Infinity);
  });

  it('entre dos franjas no hay órgano', () => {
    expect(profundidad(d, 'Trachea', [0, 1.015, 0])).toBe(-Infinity);
  });
});

describe('modelo de obstáculos: tubos', () => {
  const eje: P[] = [
    [0, 1.0, 0],
    [0, 2.0, 0],
  ];
  const d = sinte({ 'Aortic arch': { tipo: 'CURVE', caja: caja(-0.01, 1, -0.01, 0.01, 2, 0.01), cortes: [], puntos: eje, radio: 0.01 } });

  it('sobre el eje la profundidad es el radio', () => {
    expect(mm(profundidad(d, 'Aortic arch', [0, 1.5, 0]))).toBeCloseTo(10, 9);
  });

  it('a radio + 1 mm del eje está 1 mm fuera', () => {
    expect(mm(profundidad(d, 'Aortic arch', [0.011, 1.5, 0]))).toBeCloseTo(-1, 9);
  });

  it('más allá del extremo usa la distancia al extremo', () => {
    // 3 mm sobre el extremo y 4 mm al lado: distancia 5 mm, adentro por 5 mm.
    expect(mm(profundidad(d, 'Aortic arch', [0.004, 2.003, 0]))).toBeCloseTo(5, 9);
    expect(mm(profundidad(d, 'Aortic arch', [0, 2.02, 0]))).toBeCloseTo(-10, 9);
  });
});

describe('separación entre rutas', () => {
  it('es la menor distancia de un punto de una a la polilínea de la otra', () => {
    const a: P[] = [
      [0, 0, 0],
      [0, 1, 0],
    ];
    const b: P[] = [
      [0.05, 0, 0],
      [0.05, 1, 0],
    ];
    expect(separacion(a, b)).toBeCloseTo(0.05, 9);
    expect(distanciaAPolilinea([0.02, 0.5, 0], a)).toBeCloseTo(0.02, 9);
    // Es simétrica: los vértices de una ruta corta pueden estar cerca del interior de una larga y no al revés.
    const larga: P[] = [
      [-1, 0, 0],
      [1, 0, 0],
    ];
    const corta: P[] = [
      [0, 0.01, 0],
      [0, 0.02, 0],
    ];
    expect(separacion(larga, corta)).toBeCloseTo(0.01, 9);
    expect(separacion(corta, larga)).toBeCloseTo(0.01, 9);
  });
});

// ---------------------------------------------------------------------------------------------
// Unitarios de la malla 3D (pulmones), con un cubo de 12 triángulos escrito aquí.
// ---------------------------------------------------------------------------------------------
/** Cubo de lado 2h centrado en el origen: seis caras de dos triángulos. `sin` quita los triángulos de una cara (0 a 5). */
function cubo(h: number, sin?: number): Float64Array {
  const v = (x: number, y: number, z: number): P => [x * h, y * h, z * h];
  const caras: [P, P, P, P][] = [
    [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], // +x
    [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], // -x
    [v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], // +y
    [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], // -y
    [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], // +z
    [v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], // -z
  ];
  const tris: number[] = [];
  caras.forEach(([a, b, c, d], i) => {
    if (i !== sin) tris.push(...a, ...b, ...c, ...a, ...c, ...d);
  });
  return Float64Array.from(tris);
}

describe('profundidad en una malla de triángulos', () => {
  const lado = 0.01; // mitad del lado: el cubo mide 2 cm
  it('el centro de un cubo está a la mitad del lado de la cara más cercana', () => {
    expect(mm(profundidadMalla(cubo(lado), [0, 0, 0]))).toBeCloseTo(10, 6);
    expect(mm(profundidadMalla(cubo(lado), [0.004, 0.001, -0.002]))).toBeCloseTo(6, 6);
  });

  it('afuera da menos la distancia a la cara', () => {
    expect(mm(profundidadMalla(cubo(lado), [0.015, 0, 0]))).toBeCloseTo(-5, 6);
    // Frente a una arista: la distancia es a la arista, no a la cara.
    expect(mm(profundidadMalla(cubo(lado), [0.013, 0.014, 0]))).toBeCloseTo(-Math.hypot(3, 4), 6);
  });

  it('lejos de la caja de la malla no se mide y da una cota negativa', () => {
    const lejos = profundidadMalla(cubo(lado), [1, 0, 0]);
    expect(lejos).toBeLessThan(-0.03);
    expect(lejos).toBeCloseTo(-0.99, 9);
  });

  it('sin una cara el voto de 2 de 3 rayos sigue dando adentro', () => {
    for (let cara = 0; cara < 6; cara++) {
      // Solo dos de los tres rayos (+x, +y, +z) ven su cara cuando falta una de las tres caras positivas; con una negativa los tres ven la suya.
      expect(profundidadMalla(cubo(lado, cara), [0.001, 0.0005, -0.0007]), `sin la cara ${cara}`).toBeGreaterThan(0);
    }
    // Y un punto de afuera no pasa a dentro por faltar una cara.
    for (let cara = 0; cara < 6; cara++) expect(profundidadMalla(cubo(lado, cara), [0.015, 0.001, 0.0005]), `sin la cara ${cara}`).toBeLessThan(0);
  });

  it('la sección horizontal de un cubo es un cuadrado cerrado', () => {
    const seg = seccionar(cubo(lado), 0.002);
    expect(seg).toHaveLength(8); // cuatro caras, dos triángulos cada una
    for (const [x0, z0, x1, z1] of seg) {
      for (const v of [x0, z0, x1, z1]) expect(Math.abs(v)).toBeLessThanOrEqual(lado + 1e-12);
      expect(Math.hypot(x1 - x0, z1 - z0)).toBeGreaterThan(0);
    }
    expect(seccionar(cubo(lado), 0.02)).toHaveLength(0);
  });
});

describe('giros entre segmentos seguidos', () => {
  it('una recta da 0 grados', () => {
    const recta: P[] = [0, 1, 2, 3, 4].map((k) => [k * 0.002, 0, 0]);
    expect(giros(recta)).toHaveLength(3);
    expect(giroMaximo(recta)!.grados).toBeLessThan(1e-4);
  });

  it('un zigzag de 1,36 mm cada 2 mm da más de 30 grados', () => {
    const zigzag: P[] = [0, 1, 2, 3, 4].map((k) => [k * 0.002, (k % 2) * 0.00136, 0]);
    const g = giroMaximo(zigzag)!;
    expect(g.grados).toBeGreaterThan(GIRO_MAXIMO);
    expect(g.grados).toBeCloseTo(2 * (Math.atan2(1.36, 2) * 180) / Math.PI, 6);
  });

  it('los puntos a menos de 0,5 mm del anterior se descartan antes de medir', () => {
    // Un punto intermedio a 0,3 mm fuera de la recta, pegado al anterior, no es un giro.
    const con: P[] = [
      [0, 0, 0],
      [0.002, 0, 0],
      [0.0022, 0.0003, 0],
      [0.004, 0, 0],
      [0.006, 0, 0],
    ];
    expect(giros(con)).toHaveLength(2);
    expect(giroMaximo(con)!.grados).toBeLessThan(1e-4);
    // Si el punto se aleja 0,6 mm del anterior sí cuenta.
    const lejos: P[] = [
      [0, 0, 0],
      [0.002, 0, 0],
      [0.002, 0.0006, 0],
      [0.004, 0, 0],
    ];
    expect(giroMaximo(lejos)!.grados).toBeGreaterThan(GIRO_MAXIMO);
  });
});

describe('monotonía de la altura', () => {
  const ruta = (ys: number[]): P[] => ys.map((y, i) => [i * 0.002, y, 0]);
  it('una meseta no cuenta, un rebote de más de 0,1 mm sí', () => {
    expect(monotonia(ruta([1.4, 1.399, 1.399, 1.399, 1.398]), 'baja')).toEqual([]);
    const rebote = monotonia(ruta([1.4, 1.399, 1.3993, 1.398]), 'baja');
    expect(rebote.map((r) => r.indice)).toEqual([2]);
    expect(monotonia(ruta([1.4, 1.399, 1.39905, 1.398]), 'baja')).toEqual([]);
  });

  it('"baja y sube" exige bajar hasta el punto más bajo y después solo subir', () => {
    expect(monotonia(ruta([1.4, 1.39, 1.38, 1.385, 1.39, 1.41]), 'baja y sube')).toEqual([]);
    expect(monotonia(ruta([1.4, 1.39, 1.392, 1.38, 1.385]), 'baja y sube').map((r) => r.indice)).toEqual([2]);
    expect(monotonia(ruta([1.4, 1.39, 1.38, 1.385, 1.384, 1.41]), 'baja y sube').map((r) => r.indice)).toEqual([4]);
  });
});

describe('gancho del recurrente izquierdo', () => {
  const ruta: P[] = [1.4, 1.39, 1.37, 1.375, 1.384, 1.386, 1.39, 1.4].map((y, i) => [i * 0.002, y, 0]);
  it('va del primer punto al primero, después del más bajo, que llega a la cima del arco', () => {
    expect(enGancho(GANCHO.ruta, ruta, 1.385)).toEqual([true, true, true, true, true, true, false, false]);
    // Con la cima justo en un punto, ese punto es el último del gancho.
    expect(enGancho(GANCHO.ruta, ruta, 1.384).lastIndexOf(true)).toBe(4);
  });

  it('las demás rutas no tienen gancho', () => {
    expect(enGancho('vago_toracico_izquierdo', ruta, 1.385).some(Boolean)).toBe(false);
    expect(enGancho('laringeo_recurrente_derecho', ruta, 1.385).some(Boolean)).toBe(false);
  });

  it('el gancho solo cambia la tolerancia contra el arco aórtico', () => {
    expect(TOLERANCIA_GANCHO).toBe(0.001);
    expect(toleranciaDe('Aortic arch')).toBe(0.0005);
    expect(toleranciaDe('Aortic arch', true)).toBe(0.001);
    expect(toleranciaDe('Left main bronchus', true)).toBe(0.0005);
    expect(toleranciaDe('Trachea', true)).toBe(0.001);
    expect(toleranciaDe('Superior lobe of left lung', true)).toBe(0.0005);
  });
});

// ---------------------------------------------------------------------------------------------
// Modelo real. Sin guardas: si falta un archivo, falla.
// ---------------------------------------------------------------------------------------------
const planta = (a: P, b: P) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const RUTAS = [
  'vago_toracico_derecho',
  'vago_toracico_izquierdo',
  'laringeo_recurrente_derecho',
  'laringeo_recurrente_izquierdo',
  'vago_izquierdo_distal',
] as const;
const IZQUIERDO = 'laringeo_recurrente_izquierdo';

/** Franja no degenerada del anclaje más cercana a la altura y (como `corte()` del generador). */
function franjaCercana(d: DatosDespeje, nombre: string, y: number): [P, P] {
  const buenas = d.anclas[nombre]!.cortes.filter((c) => c.caja[1][1] - c.caja[0][1] >= CORTE_MINIMO);
  return buenas.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a)).caja;
}

/** Mueve `base` en la dirección `dir` (unitaria) hasta que quede `fondo` metros dentro del obstáculo. */
function aDentro(d: DatosDespeje, nombre: string, base: P, dir: P, fondo: number): P {
  let t = d.anclas[nombre]!.radio ?? 0;
  const en = (s: number): P => [base[0] + dir[0] * s, base[1] + dir[1] * s, base[2] + dir[2] * s];
  for (let k = 0; k < 40; k++) t += profundidad(d, nombre, en(t)) - fondo;
  expect(profundidad(d, nombre, en(t))).toBeCloseTo(fondo, 9);
  return en(t);
}

describe('rutas del vago con el modelo real: despeje', () => {
  const d = leer<DatosDespeje>('pipeline/anclajes-vago.json');
  const r = leer<Rutas>('public/modelos/rutas-vago.json');
  let pulmones: MallasPulmones = {};
  beforeAll(async () => {
    const doc = await (await io()).read('public/modelos/atlas.glb');
    pulmones = triangulosDelDocumento(doc, new Set(LOBULOS));
  }, 120_000);
  const rutas = (id: string): P[] => {
    const x = r.rutas[id];
    if (!x) throw new Error(`Falta la ruta ${id}`);
    return x.puntos;
  };
  /** Cada ruta con el punto medio de cada tramo intercalado (no al final), para conservar el orden del gancho. */
  const conMedios = (rr: Rutas): Rutas => {
    const densa = copia(rr);
    for (const ruta of Object.values(densa.rutas)) {
      ruta.puntos = ruta.puntos.flatMap((q, i): P[] => {
        const sig = ruta.puntos[i + 1];
        return sig ? [q, [(q[0] + sig[0]) / 2, (q[1] + sig[1]) / 2, (q[2] + sig[2]) / 2]] : [q];
      });
    }
    return densa;
  };
  const resumen = (pen: Penetracion[]) => pen.map(describir);

  it('el modelo trae los 13 obstáculos con sus franjas y los cinco lóbulos pulmonares en el GLB', () => {
    expect(obstaculos()).toHaveLength(OBSTACULOS_CAJA.length + OBSTACULOS_TUBO.length);
    for (const n of obstaculos()) expect(d.anclas[n]?.cortes?.length, n).toBeGreaterThan(0);
    expect(LOBULOS).toHaveLength(5);
    for (const n of LOBULOS) expect(pulmones[n]?.length, n).toBeGreaterThan(0);
  });

  it('D1 y D2: ningún punto de ninguna ruta está dentro de un órgano más allá de su tolerancia', () => {
    // 0,5 mm (el radio del nervio) en general; 1 mm contra la tráquea y el esófago (el recurrente va en el surco traqueoesofágico) y contra el arco aórtico solo en el gancho.
    expect(TOLERANCIA).toBe(0.0005);
    expect(TOLERANCIA_SURCO).toBe(0.001);
    for (const n of obstaculos()) expect(toleranciaDe(n), n).toBe(n === 'Trachea' || n === 'Oesophagus' ? 0.001 : 0.0005);
    expect(resumen(penetraciones(d, r))).toEqual([]);
  });

  it('los puntos seguidos de cada ruta están a 2,5 mm o menos, y los puntos medios de cada tramo también respetan el despeje (D1, D2 y D8)', () => {
    // Lo que se dibuja es la polilínea: si dos puntos seguidos se separan, el tramo entre ellos puede cruzar un órgano sin que ningún punto lo haga.
    for (const [id, ruta] of Object.entries(r.rutas)) {
      ruta.puntos.forEach((q, i) => {
        const sig = ruta.puntos[i + 1];
        if (sig) expect(mm(Math.hypot(q[0] - sig[0], q[1] - sig[1], q[2] - sig[2])), `${id}, punto ${i}`).toBeLessThanOrEqual(2.5);
      });
    }
    const pen = penetraciones(d, conMedios(r), true, pulmones);
    expect(resumen(pen.filter((p) => !(LOBULOS as readonly string[]).includes(p.ancla)))).toEqual([]);
    expect(resumen(pen.filter((p) => (LOBULOS as readonly string[]).includes(p.ancla)))).toEqual([]);
  });

  it('D8: el eje de la subclavia izquierda sí entra más de 5 mm en un lóbulo izquierdo (control positivo de la medida)', () => {
    const eje = d.anclas['Left subclavian artery']!.puntos!;
    const izquierdos = ['Superior lobe of left lung', 'Inferior lobe of left lung'];
    const profundidades = eje.map((p) => Math.max(...izquierdos.map((n) => profundidadMalla(pulmones[n]!, p))));
    const dentro = profundidades.filter((v) => v > 0).length;
    const maxima = Math.max(...profundidades);
    expect(mm(maxima), `${dentro} de ${eje.length} puntos del eje dentro de un lóbulo izquierdo; máxima ${mm(maxima).toFixed(2)} mm`).toBeGreaterThan(5);
  });

  it('D10: el giro entre segmentos seguidos es de 30 grados o menos en las cinco rutas', () => {
    for (const id of RUTAS) {
      const g = giroMaximo(rutas(id))!;
      expect(g.grados, `${id} gira ${g.grados.toFixed(1)}° en y = ${mm(g.y).toFixed(1)} mm`).toBeLessThanOrEqual(GIRO_MAXIMO);
    }
    expect(GIRO_MAXIMO).toBe(30);
  });

  it('D11: los recurrentes bajan hasta su punto más bajo y después solo suben; los torácicos solo bajan', () => {
    for (const id of ['laringeo_recurrente_derecho', IZQUIERDO] as const) {
      expect(monotonia(rutas(id), 'baja y sube').map((m) => `${id}, punto ${m.indice}, y = ${mm(m.y).toFixed(2)} mm, retrocede ${mm(m.retroceso).toFixed(2)} mm`), id).toEqual([]);
    }
    for (const id of ['vago_toracico_derecho', 'vago_toracico_izquierdo'] as const) {
      expect(monotonia(rutas(id), 'baja').map((m) => `${id}, punto ${m.indice}, y = ${mm(m.y).toFixed(2)} mm, retrocede ${mm(m.retroceso).toFixed(2)} mm`), id).toEqual([]);
    }
  });

  it('D12: el asa del recurrente izquierdo queda bajo el eje del arco, dentro de su radio en planta y junto al ganglio del ligamento', () => {
    const arco = d.anclas['Aortic arch']!;
    const bajo = masBajoRuta(rutas(IZQUIERDO));
    const cerca = arco.puntos!.reduce((a, b) => (planta(b, bajo) < planta(a, bajo) ? b : a));
    expect(mm(cerca[1] - bajo[1]) - mm(arco.radio!), 'el asa debe quedar más abajo que el eje menos el radio').toBeGreaterThan(0);
    expect(mm(planta(bajo, cerca)), 'distancia en planta al eje del arco').toBeLessThanOrEqual(mm(arco.radio!));
    const caja = d.anclas['Node of ligamentum arteriosum']!.caja;
    const ganglio: P = [(caja[0][0] + caja[1][0]) / 2, (caja[0][1] + caja[1][1]) / 2, (caja[0][2] + caja[1][2]) / 2];
    const lejos = Math.hypot(bajo[0] - ganglio[0], bajo[1] - ganglio[1], bajo[2] - ganglio[2]);
    expect(mm(lejos), `el asa queda a ${mm(lejos).toFixed(1)} mm del centro del ganglio`).toBeLessThanOrEqual(8);
  });

  it('D13: desde 10 mm sobre el asa hasta el cricoides, el recurrente izquierdo va en el surco', () => {
    const puntos = rutas(IZQUIERDO);
    const bajo = masBajoRuta(puntos);
    const cricoides = d.anclas['Cricoid cartilage']!.cortes.filter((c) => c.caja[1][1] - c.caja[0][1] >= CORTE_MINIMO)[0]!;
    const yCricoides = (cricoides.caja[0][1] + cricoides.caja[1][1]) / 2;
    const tramo = puntos.filter((p) => p[1] >= bajo[1] + 0.01 && p[1] <= yCricoides + 1e-6);
    expect(tramo.length, 'puntos del tramo del surco').toBeGreaterThan(10);
    const ant = d.anclas['Trachea']!.caja[0][2] + d.anclas['Trachea']!.caja[1][2] > d.anclas['Oesophagus']!.caja[0][2] + d.anclas['Oesophagus']!.caja[1][2] ? 1 : -1;
    for (const p of tramo) {
      const t = franjaCercana(d, 'Trachea', p[1]);
      const e = franjaCercana(d, 'Oesophagus', p[1]);
      const contacto = ((ant > 0 ? t[0][2] : t[1][2]) + (ant > 0 ? e[1][2] : e[0][2])) / 2;
      expect(mm(Math.abs(p[0] - t[1][0])), `y = ${mm(p[1]).toFixed(1)} mm: distancia a la cara izquierda de la tráquea`).toBeLessThanOrEqual(5);
      expect(mm(Math.abs(p[2] - contacto)), `y = ${mm(p[1]).toFixed(1)} mm: distancia al plano de contacto tráquea-esófago`).toBeLessThanOrEqual(6);
    }
  });

  it('D3: los dos recurrentes nunca están a menos de 15 mm', () => {
    const s = separacion(rutas('laringeo_recurrente_derecho'), rutas(IZQUIERDO));
    expect(mm(s), `separación mínima ${mm(s).toFixed(2)} mm`).toBeGreaterThanOrEqual(mm(SEPARACION_MINIMA));
  });

  it('D4: el punto más bajo del recurrente derecho queda a 20 mm o menos, en planta, del vago derecho', () => {
    const bajo = masBajoRuta(rutas('laringeo_recurrente_derecho'));
    const vago = aAltura(troncoPublicado(d, r, 'derecho'), bajo[1]);
    expect(vago, 'el vago derecho publicado no llega a esa altura').not.toBeNull();
    const enPlanta = Math.hypot(bajo[0] - vago![0], bajo[2] - vago![2]);
    expect(mm(enPlanta), `a ${mm(enPlanta).toFixed(1)} mm en planta`).toBeLessThanOrEqual(mm(ASA_MAXIMA));
  });

  describe('controles negativos', () => {
    /** Una copia de las rutas con `p` agregado a la ruta `id` (al final, o en el índice `donde`). */
    const con = (id: string, p: P, donde?: number): Rutas => {
      const mala = copia(r);
      const pts = mala.rutas[id]!.puntos;
      if (donde === undefined) pts.push(p);
      else pts.splice(donde, 0, p);
      return mala;
    };

    it('un punto en el centro de la tráquea (franja 1.4425) se detecta y nombra la tráquea', () => {
      const c = d.anclas['Trachea']!.cortes.find((k) => Math.abs(k.y - 1.4425) < 1e-9)!;
      const centro: P = [(c.caja[0][0] + c.caja[1][0]) / 2, 1.4425, (c.caja[0][2] + c.caja[1][2]) / 2];
      const dentro = penetraciones(d, con('laringeo_recurrente_derecho', centro));
      expect(dentro.some((p) => p.ancla === 'Trachea' && p.ruta === 'laringeo_recurrente_derecho')).toBe(true);
      expect(dentro.map(describir).join('\n')).toMatch(/laringeo_recurrente_derecho pasa [\d.]+ mm dentro de Trachea en y = 1442\.5 mm/);
    });

    it('un punto 1,2 mm dentro de la tráquea falla aunque el límite contra ella sea 1 mm', () => {
      const c = d.anclas['Trachea']!.cortes.find((k) => Math.abs(k.y - 1.4425) < 1e-9)!;
      // 1,2 mm adentro de la cara lateral derecha de la franja, a media altura de z.
      const p: P = [c.caja[0][0] + 0.0012, 1.4425, (c.caja[0][2] + c.caja[1][2]) / 2];
      expect(profundidad(d, 'Trachea', p)).toBeCloseTo(0.0012, 9);
      expect(penetraciones(d, con('laringeo_recurrente_derecho', p)).some((q) => q.ancla === 'Trachea' && q.ruta === 'laringeo_recurrente_derecho')).toBe(true);
      // Y 0,9 mm adentro sí se tolera (control positivo de la tolerancia de 1 mm).
      const justa = penetraciones(d, con('laringeo_recurrente_derecho', [p[0] - 0.0003, p[1], p[2]]));
      expect(justa.some((q) => q.ancla === 'Trachea' && q.ruta === 'laringeo_recurrente_derecho' && Math.abs(q.profundidad - 0.0009) < 1e-9)).toBe(false);
    });

    it('contra una arteria el límite sigue en 0,5 mm', () => {
      const eje = d.anclas['Left common carotid artery']!;
      const radio = eje.radio!;
      // Un punto 0,7 mm dentro de la superficie (radio − 0,7 mm del eje).
      const p: P = [eje.puntos![5]![0] + radio - 0.0007, eje.puntos![5]![1], eje.puntos![5]![2]];
      expect(profundidad(d, 'Left common carotid artery', p)).toBeGreaterThan(0.0005);
      expect(penetraciones(d, con('vago_toracico_izquierdo', p)).some((q) => q.ancla === 'Left common carotid artery' && q.ruta === 'vago_toracico_izquierdo')).toBe(true);
    });

    it('un punto de la línea central de la carótida común izquierda se detecta y nombra la arteria', () => {
      const eje = d.anclas['Left common carotid artery']!.puntos![5]!;
      const dentro = penetraciones(d, con('vago_toracico_izquierdo', eje));
      expect(dentro.some((p) => p.ancla === 'Left common carotid artery' && p.ruta === 'vago_toracico_izquierdo')).toBe(true);
    });

    it('el recurrente izquierdo reflejado sobre el derecho rompe los 15 mm', () => {
      const espejo = rutas(IZQUIERDO).map(([x, y, z]): P => [-x, y, z]);
      expect(mm(separacion(rutas('laringeo_recurrente_derecho'), espejo))).toBeLessThan(mm(SEPARACION_MINIMA));
    });

    it('un asa del recurrente derecho a 8 cm de la línea media rompe los 20 mm', () => {
      const bajo = masBajoRuta(rutas('laringeo_recurrente_derecho'));
      const lejos: P = [bajo[0] - 0.05, bajo[1] - 0.001, bajo[2]];
      const vago = aAltura(troncoPublicado(d, r, 'derecho'), lejos[1])!;
      expect(mm(Math.hypot(lejos[0] - vago[0], lejos[2] - vago[2]))).toBeGreaterThan(mm(ASA_MAXIMA));
    });

    it('D9: 0,7 mm dentro del arco falla en el torácico izquierdo y en el recurrente izquierdo después del gancho; 0,9 mm dentro del gancho pasa', () => {
      const eje = d.anclas['Aortic arch']!.puntos!;
      const base = eje[Math.floor(eje.length / 2)]!;
      const arriba: P = [0, 1, 0];
      const contraArco = (pen: Penetracion[], id: string) => pen.some((q) => q.ancla === GANCHO.ancla && q.ruta === id);
      const p07 = aDentro(d, GANCHO.ancla, base, arriba, 0.0007);
      const p09 = aDentro(d, GANCHO.ancla, base, arriba, 0.0009);
      // Fuera del gancho: la tolerancia es 0,5 mm.
      expect(contraArco(penetraciones(d, con('vago_toracico_izquierdo', p07)), 'vago_toracico_izquierdo')).toBe(true);
      const alFinal = rutas(IZQUIERDO).length;
      expect(contraArco(penetraciones(d, con(IZQUIERDO, p07, alFinal)), IZQUIERDO), 'después del gancho').toBe(true);
      // Dentro del gancho (justo después del primer punto): 0,9 mm se tolera, y 1,2 mm no.
      expect(enGancho(IZQUIERDO, con(IZQUIERDO, p09, 1).rutas[IZQUIERDO]!.puntos, yCimaArco(d))[1]).toBe(true);
      expect(contraArco(penetraciones(d, con(IZQUIERDO, p09, 1)), IZQUIERDO), '0,9 mm dentro del gancho').toBe(false);
      const p12 = aDentro(d, GANCHO.ancla, base, arriba, 0.0012);
      expect(contraArco(penetraciones(d, con(IZQUIERDO, p12, 1)), IZQUIERDO), '1,2 mm dentro del gancho').toBe(true);
      // Y 0,9 mm en el torácico izquierdo (sin gancho) sí falla: el control es distinto de pasar por no tener tolerancia.
      expect(contraArco(penetraciones(d, con('vago_toracico_izquierdo', p09)), 'vago_toracico_izquierdo')).toBe(true);
    });

    it('D8: un punto en el centro de un lóbulo pulmonar se detecta y nombra el lóbulo', () => {
      // El centro de la caja de cada lóbulo puede quedar en el hilio, fuera de la malla: se toma el punto de la malla más profundo entre varios candidatos.
      const n = 'Inferior lobe of right lung';
      const tris = pulmones[n]!;
      let mejor: P = [0, 0, 0];
      let prof = -Infinity;
      for (let t = 0; t < tris.length / 9; t += 40) {
        const cand: P = [(tris[t * 9]! + tris[t * 9 + 3]! + tris[t * 9 + 6]!) / 3, (tris[t * 9 + 1]! + tris[t * 9 + 4]! + tris[t * 9 + 7]!) / 3, (tris[t * 9 + 2]! + tris[t * 9 + 5]! + tris[t * 9 + 8]!) / 3];
        const q: P = [cand[0] - 0.01, cand[1] - 0.01, cand[2]];
        const v = profundidadMalla(tris, q);
        if (v > prof) {
          prof = v;
          mejor = q;
        }
      }
      expect(mm(prof), 'el candidato debe estar al menos 2 mm dentro').toBeGreaterThan(2);
      const dentro = penetraciones(d, con('vago_toracico_derecho', mejor), true, pulmones);
      expect(dentro.some((p) => p.ancla === n && p.ruta === 'vago_toracico_derecho')).toBe(true);
    });
  });
});
