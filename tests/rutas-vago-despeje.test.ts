// Despeje de las rutas del vago (SPEC F25, ADR 0010): ninguna ruta publicada pasa por dentro de un
// órgano, los dos recurrentes no se juntan y el asa del recurrente derecho queda junto al vago derecho.
// Mide sobre los archivos reales (pipeline/anclajes-vago.json y public/modelos/rutas-vago.json), sin
// guardas: si falta uno, falla. El modelo de obstáculos es scripts/lib/despeje.ts, independiente del
// generador (pipeline/generar-ramas-vago.py).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aAltura, troncoPublicado, type P, type Rutas } from '../scripts/lib/asimetrias.ts';
import {
  CORTE_MINIMO,
  describir,
  distanciaAPolilinea,
  obstaculos,
  OBSTACULOS_CAJA,
  OBSTACULOS_TUBO,
  penetraciones,
  profundidad,
  separacion,
  TOLERANCIA,
  TOLERANCIA_SURCO,
  toleranciaDe,
  type AnclaConCortes,
  type DatosDespeje,
} from '../scripts/lib/despeje.ts';

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
// Modelo real. Sin guardas: si falta un archivo, falla.
// ---------------------------------------------------------------------------------------------
describe('rutas del vago con el modelo real: despeje', () => {
  const d = leer<DatosDespeje>('pipeline/anclajes-vago.json');
  const r = leer<Rutas>('public/modelos/rutas-vago.json');
  const rutas = (id: string): P[] => {
    const x = r.rutas[id];
    if (!x) throw new Error(`Falta la ruta ${id}`);
    return x.puntos;
  };

  it('el modelo trae los 13 obstáculos con sus franjas', () => {
    expect(obstaculos()).toHaveLength(OBSTACULOS_CAJA.length + OBSTACULOS_TUBO.length);
    for (const n of obstaculos()) expect(d.anclas[n]?.cortes?.length, n).toBeGreaterThan(0);
  });

  it('D1 y D2: ningún punto de ninguna ruta está dentro de un órgano más allá de su tolerancia', () => {
    // 0,5 mm (el radio del nervio) en general; 1 mm solo contra la tráquea y el esófago (decisión del editor, 2026-10-17: el recurrente va en el surco traqueoesofágico).
    expect(TOLERANCIA).toBe(0.0005);
    expect(TOLERANCIA_SURCO).toBe(0.001);
    for (const n of obstaculos()) expect(toleranciaDe(n), n).toBe(n === 'Trachea' || n === 'Oesophagus' ? 0.001 : 0.0005);
    const dentro = penetraciones(d, r).map(describir);
    expect(dentro).toEqual([]);
  });

  it('los puntos seguidos de cada ruta están a 2,5 mm o menos, y los puntos medios de cada tramo también respetan el despeje', () => {
    // Lo que se dibuja es la polilínea: si dos puntos seguidos se separan, el tramo entre ellos puede cruzar un órgano sin que ningún punto lo haga.
    const densa = copia(r);
    for (const [id, ruta] of Object.entries(densa.rutas)) {
      const medios: P[] = [];
      ruta.puntos.forEach((q, i) => {
        const sig = ruta.puntos[i + 1];
        if (!sig) return;
        expect(mm(Math.hypot(q[0] - sig[0], q[1] - sig[1], q[2] - sig[2])), `${id}, punto ${i}`).toBeLessThanOrEqual(2.5);
        medios.push([(q[0] + sig[0]) / 2, (q[1] + sig[1]) / 2, (q[2] + sig[2]) / 2]);
      });
      ruta.puntos = [...ruta.puntos, ...medios];
    }
    expect(penetraciones(d, densa).map(describir)).toEqual([]);
  });

  it('D3: los dos recurrentes nunca están a menos de 15 mm', () => {
    const s = separacion(rutas('laringeo_recurrente_derecho'), rutas('laringeo_recurrente_izquierdo'));
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
    it('un punto en el centro de la tráquea (franja 1.4425) se detecta y nombra la tráquea', () => {
      const c = d.anclas['Trachea']!.cortes.find((k) => Math.abs(k.y - 1.4425) < 1e-9)!;
      const centro: P = [(c.caja[0][0] + c.caja[1][0]) / 2, 1.4425, (c.caja[0][2] + c.caja[1][2]) / 2];
      const mala = copia(r);
      mala.rutas['laringeo_recurrente_derecho']!.puntos.push(centro);
      const dentro = penetraciones(d, mala);
      expect(dentro.some((p) => p.ancla === 'Trachea' && p.ruta === 'laringeo_recurrente_derecho')).toBe(true);
      expect(dentro.map(describir).join('\n')).toMatch(/laringeo_recurrente_derecho pasa [\d.]+ mm dentro de Trachea en y = 1442\.5 mm/);
    });

    it('un punto 1,2 mm dentro de la tráquea falla aunque el límite contra ella sea 1 mm', () => {
      const c = d.anclas['Trachea']!.cortes.find((k) => Math.abs(k.y - 1.4425) < 1e-9)!;
      // 1,2 mm adentro de la cara lateral derecha de la franja, a media altura de z.
      const p: P = [c.caja[0][0] + 0.0012, 1.4425, (c.caja[0][2] + c.caja[1][2]) / 2];
      expect(profundidad(d, 'Trachea', p)).toBeCloseTo(0.0012, 9);
      const mala = copia(r);
      mala.rutas['laringeo_recurrente_derecho']!.puntos.push(p);
      expect(penetraciones(d, mala).some((q) => q.ancla === 'Trachea' && q.ruta === 'laringeo_recurrente_derecho')).toBe(true);
      // Y 0,9 mm adentro sí se tolera (control positivo de la tolerancia de 1 mm).
      const justa = copia(r);
      justa.rutas['laringeo_recurrente_derecho']!.puntos.push([p[0] - 0.0003, p[1], p[2]]);
      expect(penetraciones(d, justa).some((q) => q.ancla === 'Trachea' && q.ruta === 'laringeo_recurrente_derecho' && Math.abs(q.profundidad - 0.0009) < 1e-9)).toBe(false);
    });

    it('contra una arteria el límite sigue en 0,5 mm', () => {
      const eje = d.anclas['Left common carotid artery']!;
      const radio = eje.radio!;
      // Un punto 0,7 mm dentro de la superficie (radio − 0,7 mm del eje).
      const p: P = [eje.puntos![5]![0] + radio - 0.0007, eje.puntos![5]![1], eje.puntos![5]![2]];
      expect(profundidad(d, 'Left common carotid artery', p)).toBeGreaterThan(0.0005);
      const mala = copia(r);
      mala.rutas['vago_toracico_izquierdo']!.puntos.push(p);
      expect(penetraciones(d, mala).some((q) => q.ancla === 'Left common carotid artery' && q.ruta === 'vago_toracico_izquierdo')).toBe(true);
    });

    it('un punto de la línea central de la carótida común izquierda se detecta y nombra la arteria', () => {
      const eje = d.anclas['Left common carotid artery']!.puntos![5]!;
      const mala = copia(r);
      mala.rutas['vago_toracico_izquierdo']!.puntos.push(eje);
      const dentro = penetraciones(d, mala);
      expect(dentro.some((p) => p.ancla === 'Left common carotid artery' && p.ruta === 'vago_toracico_izquierdo')).toBe(true);
    });

    it('el recurrente izquierdo reflejado sobre el derecho rompe los 15 mm', () => {
      const espejo = rutas('laringeo_recurrente_izquierdo').map(([x, y, z]): P => [-x, y, z]);
      expect(mm(separacion(rutas('laringeo_recurrente_derecho'), espejo))).toBeLessThan(mm(SEPARACION_MINIMA));
    });

    it('un asa del recurrente derecho a 8 cm de la línea media rompe los 20 mm', () => {
      const bajo = masBajoRuta(rutas('laringeo_recurrente_derecho'));
      const lejos: P = [bajo[0] - 0.05, bajo[1] - 0.001, bajo[2]];
      const vago = aAltura(troncoPublicado(d, r, 'derecho'), lejos[1])!;
      expect(mm(Math.hypot(lejos[0] - vago[0], lejos[2] - vago[2]))).toBeGreaterThan(mm(ASA_MAXIMA));
    });
  });
});
