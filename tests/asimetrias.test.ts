// Prueba de las cuatro asimetrías del vago (ADR 0009, SPEC F25). Criterio de bloqueo: la geometría
// trazada no se publica si alguna falla o si falta un anclaje; esta prueba corre en cada CI.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  asimetria1,
  asimetria2,
  asimetria3,
  asimetria4,
  bandas,
  comprobar,
  comprobarBanda,
  puntosEnBanda,
  recortarBanda,
  signoAnterior,
  TOLERANCIA_BANDA,
  tronco,
  troncoPublicado,
  type Anclajes,
  type Banda,
  type P,
  type Rutas,
} from '../scripts/lib/asimetrias.ts';
import { piezasAproximadas } from '../src/data/atlas';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// Modelo sintético con las relaciones bien puestas (pipeline/pruebas/vago_sintetico.py) y las rutas
// que calculó pipeline/generar-ramas-vago.py sobre él con pipeline/rutas-vago.yaml.
const sintAnclajes = leer<Anclajes>('tests/fixtures/vago-sintetico/anclajes.json');
const sintRutas = leer<Rutas>('tests/fixtures/vago-sintetico/puntos.json');

describe('asimetrías del vago con el modelo sintético', () => {
  it('el eje anterior sale de los datos (tráquea delante del esófago)', () => {
    expect(signoAnterior(sintAnclajes)).toBe(1);
  });

  it('las rutas generadas desde rutas-vago.yaml cumplen las cuatro', () => {
    const res = comprobar(sintAnclajes, sintRutas);
    expect(res.map((r) => r.asimetria)).toEqual([1, 2, 3, 4]);
    for (const r of res) expect(r.ok, `asimetría ${r.asimetria}: ${r.detalle}`).toBe(true);
  });

  it('1 falla si el recurrente derecho pasa por encima de la subclavia', () => {
    const r = copia(sintRutas);
    r.rutas['laringeo_recurrente_derecho']!.puntos = r.rutas['laringeo_recurrente_derecho']!.puntos.map(([x, y, z]) => [x, Math.max(y, 1.43), z]);
    const res = asimetria1(sintAnclajes, r);
    expect(res.ok).toBe(false);
    expect(res.detalle).toMatch(/no rodea la subclavia derecha/);
  });

  it('2 falla si el recurrente izquierdo no baja hasta el arco', () => {
    const r = copia(sintRutas);
    r.rutas['laringeo_recurrente_izquierdo']!.puntos = r.rutas['laringeo_recurrente_izquierdo']!.puntos.filter((p) => p[1] > 1.37);
    expect(asimetria2(sintAnclajes, r).ok).toBe(false);
  });

  it('3 falla si el vago izquierdo cruza el arco por detrás', () => {
    // El escaneado izquierdo bajo y_max ya no se publica: se mueve la ruta torácica, que es lo que se ve.
    const r = copia(sintRutas);
    r.rutas['vago_toracico_izquierdo']!.puntos = r.rutas['vago_toracico_izquierdo']!.puntos.map(([x, y, z]) => [x, y, z - 0.05]);
    const res = asimetria3(sintAnclajes, r);
    expect(res.ok).toBe(false);
    expect(res.detalle).toMatch(/por detrás/);
  });

  it('4 falla si el vago derecho pasa por delante del esófago', () => {
    const d = copia(sintAnclajes);
    d.trazos['Vagus nerve (X).r#t00']!.puntos = d.trazos['Vagus nerve (X).r#t00']!.puntos.map(([x, y, z]) => [x, y, y < 1.33 ? z + 0.06 : z]);
    expect(asimetria4(d, sintRutas).ok).toBe(false);
  });

  it('si falta un anclaje la prueba falla con un mensaje que lo nombra, nunca en silencio', () => {
    const d = copia(sintAnclajes);
    delete d.anclas['Aortic arch'];
    expect(() => comprobar(d, sintRutas)).toThrow(/Falta el anclaje "Aortic arch"/);
  });

  it('sin rutas solo se comprueba la 4, sobre el escaneado, y no lanza', () => {
    const res = comprobar(sintAnclajes, null);
    expect(res.map((r) => r.asimetria)).toEqual([4]);
    expect(res[0]!.ok).toBe(true);
  });
});

describe('tronco publicado y bandas (ADR 0010)', () => {
  const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const bandaDer: Banda = { lado: 'derecho', y_max: 1.415, y_min: 1.34 };
  const bandaIzq: Banda = { lado: 'izquierdo', y_max: 1.41, y_min: null };
  const rutaDer = sintRutas.rutas['vago_toracico_derecho']!;
  const rutaIzq = sintRutas.rutas['vago_toracico_izquierdo']!;
  const distal = sintRutas.rutas['vago_izquierdo_distal']!;
  const escDer = tronco(sintAnclajes, 'derecho');
  const escIzq = tronco(sintAnclajes, 'izquierdo');

  describe('bandas', () => {
    it('devuelve exactamente las bandas de las rutas que traen reemplaza', () => {
      const res = bandas(sintRutas).sort((a, b) => a.lado.localeCompare(b.lado));
      expect(res).toEqual([
        { lado: 'derecho', y_max: 1.415, y_min: 1.34 },
        { lado: 'izquierdo', y_max: 1.41, y_min: null },
      ]);
    });

    it('sin rutas da una lista vacía', () => {
      expect(bandas({ rutas: {} })).toEqual([]);
    });
  });

  describe('recortarBanda', () => {
    const banda: Banda = { lado: 'derecho', y_max: 1.5, y_min: 0.5 };

    it('un segmento que cruza toda la banda queda con un punto de borde en y_max y otro en y_min', () => {
      expect(
        recortarBanda(
          [
            [0, 2, 0],
            [0, 0, 1],
          ],
          banda,
        ),
      ).toEqual({
        arriba: [
          [0, 2, 0],
          [0, 1.5, 0.25],
        ],
        abajo: [
          [0, 0.5, 0.75],
          [0, 0, 1],
        ],
      });
    });

    it('la entrada de abajo hacia arriba da lo mismo: se orienta de arriba abajo', () => {
      const res = recortarBanda(
        [
          [0, 0, 1],
          [0, 2, 0],
        ],
        banda,
      );
      expect(res.arriba).toEqual([
        [0, 2, 0],
        [0, 1.5, 0.25],
      ]);
      expect(res.abajo).toEqual([
        [0, 0.5, 0.75],
        [0, 0, 1],
      ]);
    });

    it('ninguno y uno', () => {
      expect(recortarBanda([], banda)).toEqual({ arriba: [], abajo: [] });
      expect(recortarBanda([[0, 2, 0]], banda)).toEqual({ arriba: [[0, 2, 0]], abajo: [] });
    });

    it('un punto exactamente en y_max se conserva sin borde duplicado', () => {
      const res = recortarBanda(
        [
          [0, 2, 0],
          [0, 1.5, 0],
          [0, 1, 0],
        ],
        { lado: 'izquierdo', y_max: 1.5, y_min: null },
      );
      expect(res.arriba).toEqual([
        [0, 2, 0],
        [0, 1.5, 0],
      ]);
      expect(res.abajo).toEqual([]);
    });

    it('con y_min nulo conserva solo lo de arriba más el borde', () => {
      const res = recortarBanda(
        [
          [0, 2, 0],
          [0, 1, 1],
          [0, 0, 2],
        ],
        { lado: 'izquierdo', y_max: 1.5, y_min: null },
      );
      expect(res.arriba).toEqual([
        [0, 2, 0],
        [0, 1.5, 0.5],
      ]);
      expect(res.abajo).toEqual([]);
    });

    it('no mueve ningún punto conservado (misma tupla, no una copia)', () => {
      const a: P = [0, 2, 0];
      const c: P = [0, 0, 1];
      const res = recortarBanda([a, c], banda);
      expect(res.arriba[0]).toBe(a);
      expect(res.abajo[1]).toBe(c);
    });
  });

  describe('troncoPublicado', () => {
    const { arriba, abajo } = recortarBanda(escDer, bandaDer);

    it('el derecho conserva lo de arriba y lo de abajo, con bordes exactos en el empalme de la ruta', () => {
      expect(arriba.slice(0, -1)).toEqual(escDer.filter((p) => p[1] >= 1.415));
      expect(arriba.at(-1)![1]).toBe(1.415);
      expect(dist(arriba.at(-1)!, rutaDer.puntos[0]!)).toBeLessThanOrEqual(1e-5);
      expect(abajo.slice(1)).toEqual(escDer.filter((p) => p[1] <= 1.34));
      expect(abajo[0]![1]).toBe(1.34);
      expect(dist(abajo[0]!, rutaDer.puntos.at(-1)!)).toBeLessThanOrEqual(1e-5);
    });

    it('el derecho no deja escaneado entre y_max y y_min e incluye la ruta torácica, por tramos', () => {
      expect(puntosEnBanda([...arriba, ...abajo], bandaDer)).toHaveLength(0);
      const pub = troncoPublicado(sintAnclajes, sintRutas, 'derecho');
      expect(pub).toEqual([...arriba, ...rutaDer.puntos, ...abajo]);
      expect(pub[0]).toEqual(escDer[0]);
      expect(pub[0]![1]).toBe(1.574);
      expect(pub.at(-1)).toEqual(escDer.at(-1));
      expect(pub.at(-1)![1]).toBe(1.13);
    });

    it('el izquierdo conserva solo lo de arriba, más la ruta torácica y el distal', () => {
      const pub = troncoPublicado(sintAnclajes, sintRutas, 'izquierdo');
      expect(pub).toEqual([...escIzq.filter((p) => p[1] >= 1.41), ...rutaIzq.puntos, ...distal.puntos]);
      // El escaneado tiene un punto exacto en 1.41: se conserva una sola vez y no agrega borde.
      expect(escIzq.filter((p) => p[1] === 1.41)).toHaveLength(1);
      expect(pub.filter((p) => p[1] === 1.41 && p[0] === 0.026)).toHaveLength(2);
      expect(pub.filter((p) => !rutaIzq.puntos.includes(p) && !distal.puntos.includes(p)).every((p) => p[1] >= 1.41)).toBe(true);
      expect(pub[0]![1]).toBe(1.574);
      expect(pub.at(-1)![1]).toBe(1.21);
    });
  });

  describe('asimetrías sobre lo publicado', () => {
    it('3 no ve el escaneado izquierdo que queda dentro de la banda', () => {
      const d = copia(sintAnclajes);
      const t = d.trazos['Vagus nerve (X).l#t00']!;
      t.puntos = t.puntos.map(([x, y, z]) => [x, y, y < 1.41 ? z - 0.05 : z]);
      expect(asimetria3(d, sintRutas).ok).toBe(true);
      // Control: la inyección sí rompe el escaneado.
      expect(asimetria3(d, null).ok).toBe(false);
    });

    it('4 no ve el escaneado derecho que queda dentro de la banda', () => {
      const d = copia(sintAnclajes);
      const t = d.trazos['Vagus nerve (X).r#t00']!;
      t.puntos = t.puntos.map(([x, y, z]) => [x, y, y > 1.34 && y < 1.415 ? z + 0.06 : z]);
      expect(asimetria4(d, sintRutas).ok).toBe(true);
      expect(asimetria4(d, null).ok).toBe(false);
    });
  });

  describe('comprobarBanda', () => {
    const { arriba: arribaDer, abajo: abajoDer } = recortarBanda(escDer, bandaDer);
    const { arriba: arribaIzq } = recortarBanda(escIzq, bandaIzq);

    it('derecho: sin el punto inyectado pasa y con él lanza nombrando lado y altura', () => {
      expect(() => comprobarBanda([...arribaDer, ...abajoDer], bandaDer, 'derecho')).not.toThrow();
      const con: P[] = [...arribaDer, [-0.02, 1.38, -0.008], ...abajoDer];
      expect(() => comprobarBanda(con, bandaDer, 'derecho')).toThrow(/vago derecho/);
      expect(() => comprobarBanda(con, bandaDer, 'derecho')).toThrow(/1\.3800/);
    });

    it('izquierdo (y_min nulo): sin el punto inyectado pasa y con él lanza nombrando lado y altura', () => {
      expect(() => comprobarBanda(arribaIzq, bandaIzq, 'izquierdo')).not.toThrow();
      const con: P[] = [...arribaIzq, [0.02, 1.3, 0]];
      expect(() => comprobarBanda(con, bandaIzq, 'izquierdo')).toThrow(/vago izquierdo/);
      expect(() => comprobarBanda(con, bandaIzq, 'izquierdo')).toThrow(/1\.3000/);
    });

    it('el borde tiene 0,1 mm de tolerancia', () => {
      expect(TOLERANCIA_BANDA).toBe(0.0001);
      for (const y of [1.415, 1.415 - 0.00005, 1.34 + 0.00005]) {
        expect(() => comprobarBanda([[0, y, 0]], bandaDer, 'derecho'), `y = ${y}`).not.toThrow();
      }
      for (const y of [1.415 - 0.0002, 1.34 + 0.0002]) {
        expect(() => comprobarBanda([[0, y, 0]], bandaDer, 'derecho'), `y = ${y}`).toThrow(/vago derecho/);
      }
    });
  });

  describe('comprobar con rutas incompletas', () => {
    it.each(['vago_toracico_derecho', 'vago_toracico_izquierdo'])('lanza nombrando %s si no trae reemplaza', (id) => {
      const r = copia(sintRutas);
      delete r.rutas[id]!.reemplaza;
      expect(() => comprobar(sintAnclajes, r)).toThrow(new RegExp(`${id}.*reemplaza`));
    });

    it('lanza nombrando la ruta si falta la torácica izquierda', () => {
      const r = copia(sintRutas);
      delete r.rutas['vago_toracico_izquierdo'];
      expect(() => comprobar(sintAnclajes, r)).toThrow(/Falta la ruta vago_toracico_izquierdo/);
    });

    it('lanza nombrando la ruta si falta la torácica derecha', () => {
      const r = copia(sintRutas);
      delete r.rutas['vago_toracico_derecho'];
      expect(() => comprobar(sintAnclajes, r)).toThrow(/Falta la ruta vago_toracico_derecho/);
    });
  });
});

describe('asimetrías del vago con el modelo real', () => {
  const rutaAnclajes = 'pipeline/anclajes-vago.json';
  // Lo que dibuja la app (pipeline/generar-ramas-vago.py lo escribe).
  const publicadas = leer<Rutas>('public/modelos/rutas-vago.json');
  const hayRutas = Object.keys(publicadas.rutas).length > 0;

  it('no hay geometría trazada sin anclajes medidos (criterio de bloqueo de F25)', () => {
    if (piezasAproximadas.length || hayRutas) {
      expect(existsSync(rutaAnclajes), `${rutaAnclajes}: corre pipeline/auditar-vago.py`).toBe(true);
    }
  });

  it.runIf(existsSync(rutaAnclajes))('el modelo medido y las rutas publicadas cumplen las asimetrías', () => {
    const d = leer<Anclajes>(rutaAnclajes);
    for (const res of comprobar(d, hayRutas ? publicadas : null)) expect(res.ok, `asimetría ${res.asimetria}: ${res.detalle}`).toBe(true);
  });
});
