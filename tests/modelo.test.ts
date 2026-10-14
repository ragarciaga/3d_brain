import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { bandas, type Banda, type P, type Rutas } from '../scripts/lib/asimetrias.ts';
import { cajasDelDocumento, io, verticesDelDocumento } from '../scripts/lib/glb.ts';
import { cajaBlenderAGltf, cajaDePuntos, comprobarBandas, compararCajas, mallasDelTronco, TRONCO_VAGO, type Caja } from '../scripts/lib/modelo.ts';

const blender: Caja = [0.01, -0.02, 1.5, 0.03, 0.04, 1.6];

describe('invariante de posición (check:modelo)', () => {
  it('convierte Blender (Z arriba) a glTF (Y arriba)', () => {
    expect(cajaBlenderAGltf(blender)).toEqual([0.01, 1.5, -0.04, 0.03, 1.6, 0.02]);
  });

  it('acepta una pieza en su sitio', () => {
    const r = compararCajas({ a: blender }, { a: cajaBlenderAGltf(blender) });
    expect(r.errores).toEqual([]);
  });

  it('falla si una pieza se corre más de 0,1 mm', () => {
    const corrida = cajaBlenderAGltf(blender).map((v, i) => (i === 0 ? v + 0.0002 : v)) as Caja;
    const r = compararCajas({ a: blender }, { a: corrida });
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain('se corrió 0.200 mm');
  });

  it('tolera el error de cuantización por debajo de 0,1 mm', () => {
    const cuantizada = cajaBlenderAGltf(blender).map((v) => v + 0.00003) as Caja;
    expect(compararCajas({ a: blender }, { a: cuantizada }).errores).toEqual([]);
  });

  it('falla si falta o sobra una pieza', () => {
    const r = compararCajas({ a: blender }, { b: blender });
    expect(r.errores.some((e) => e.includes('Falta en el GLB: a'))).toBe(true);
    expect(r.errores.some((e) => e.includes('Sobra en el GLB'))).toBe(true);
  });
});

describe('tronco del vago fuera de la banda (check:modelo)', () => {
  const der: Banda = { lado: 'derecho', y_max: 1.45, y_min: 1.35 };
  const izq: Banda = { lado: 'izquierdo', y_max: 1.47, y_min: null };
  const R = TRONCO_VAGO.derecho;
  const L = TRONCO_VAGO.izquierdo;
  // Vértices válidos: por encima de y_max y por debajo de y_min (derecho), solo por encima (izquierdo).
  const validos = (): Record<string, P[]> => ({
    [R]: [[0, 1.6, 0], [0, 1.2, 0]],
    [`${R}#toque`]: [[0, 1.6, 0], [0, 1.2, 0]],
    [L]: [[0, 1.6, 0], [0, 1.5, 0]],
    [`${L}#toque`]: [[0, 1.6, 0], [0, 1.5, 0]],
  });
  const con = (malla: string, ...ys: number[]) => {
    const v = validos();
    v[malla] = [...v[malla]!, ...ys.map((y): P => [0, y, 0])];
    return v;
  };

  it('pasa si todas las mallas tienen vértices solo fuera de la banda', () => {
    expect(comprobarBandas([der, izq], validos())).toEqual([]);
  });

  it('falla nombrando la malla visible y la altura', () => {
    const e = comprobarBandas([der, izq], con(R, 1.4));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain(`${R}:`);
    expect(e[0]).not.toContain('#toque');
    expect(e[0]).toContain('y = 1.4000');
  });

  it('falla solo en el toque y lo nombra', () => {
    const e = comprobarBandas([der, izq], con(`${R}#toque`, 1.4));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain(`${R}#toque:`);
  });

  it('da un solo error por malla con la cuenta y la altura del primero', () => {
    const e = comprobarBandas([der, izq], con(R, 1.4, 1.38, 1.42));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('3 vértice(s)');
    expect(e[0]).toContain('y = 1.4000');
  });

  it('el borde superior tolera 0,05 mm y falla a 0,2 mm', () => {
    expect(comprobarBandas([der], con(R, der.y_max - 0.00005))).toEqual([]);
    expect(comprobarBandas([der], con(R, der.y_max - 0.0002))).toHaveLength(1);
  });

  it('el borde inferior tolera 0,05 mm y falla a 0,2 mm', () => {
    expect(comprobarBandas([der], con(R, der.y_min! + 0.00005))).toEqual([]);
    expect(comprobarBandas([der], con(R, der.y_min! + 0.0002))).toHaveLength(1);
  });

  it('el izquierdo con y_min nulo vigila desde y_max hacia abajo', () => {
    const e = comprobarBandas([der, izq], con(L, 1.2));
    expect(e).toHaveLength(1);
    expect(e[0]).toContain(`${L}:`);
    expect(e[0]).toContain('abajo');
    expect(comprobarBandas([der, izq], con(L, 1.9))).toEqual([]);
  });

  it('cada banda vigila solo las mallas de su lado', () => {
    expect(comprobarBandas([izq], con(R, 1.4))).toEqual([]);
    expect(comprobarBandas([der], con(L, 1.2))).toEqual([]);
  });

  it('con bandas() de las rutas: una por cada ruta con reemplaza', () => {
    const rutas: Rutas = {
      rutas: {
        vago_toracico_derecho: { lado: 'derecho', puntos: [], reemplaza: der },
        vago_toracico_izquierdo: { lado: 'izquierdo', puntos: [], reemplaza: izq },
        laringeo_recurrente_derecho: { lado: 'derecho', puntos: [] },
      },
    };
    const v = validos();
    v[R] = [...v[R]!, [0, 1.4, 0]];
    v[L] = [...v[L]!, [0, 1.3, 0]];
    expect(bandas(rutas)).toHaveLength(2);
    expect(comprobarBandas(bandas(rutas), v)).toHaveLength(2);
  });

  it('con rutas vacías (el archivo publicado hoy) no vigila nada', () => {
    const v = con(R, 1.4, 1.3);
    expect(comprobarBandas(bandas({ rutas: {} }), v)).toEqual([]);
  });

  it('falla si falta una malla del tronco en el GLB', () => {
    const v = validos();
    delete v[`${R}#toque`];
    const e = comprobarBandas([der], v);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain(`Falta en el GLB ${R}#toque`);
  });

  it('una banda mal formada falla nombrando el lado, no pasa en vacío', () => {
    const e = comprobarBandas([{ lado: 'derecho', y_max: NaN, y_min: null }], validos());
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('derecho');
    expect(comprobarBandas([{ lado: 'derecho', y_max: 1.4, y_min: 1.5 }], validos())).toHaveLength(1);
    expect(comprobarBandas([{ lado: 'medio' as never, y_max: 1.4, y_min: null }], validos())).toHaveLength(1);
  });

  it('mallasDelTronco da la malla visible y su toque', () => {
    expect(mallasDelTronco('derecho')).toEqual(['Vagus nerve (X).r#t02', 'Vagus nerve (X).r#t02#toque']);
    expect(mallasDelTronco('izquierdo')).toEqual(['Vagus nerve (X).l#t02', 'Vagus nerve (X).l#t02#toque']);
  });
});

describe('lector de vértices del GLB', () => {
  function documento(): Document {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const pos = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([0.01, 0.4, 0, 0.02, 0.5, 0.01]))
      .setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos);
    const mesh = doc.createMesh('m').addPrimitive(prim);
    const hijo = doc.createNode(TRONCO_VAGO.derecho).setMesh(mesh);
    const padre = doc.createNode('padre').setTranslation([0, 1, 0]).addChild(hijo);
    doc.createScene().addChild(padre);
    return doc;
  }

  it('devuelve posiciones de mundo, con la matriz del padre', () => {
    const v = verticesDelDocumento(documento());
    expect(v[TRONCO_VAGO.derecho]![0]![0]).toBeCloseTo(0.01, 6);
    expect(v[TRONCO_VAGO.derecho]![0]![1]).toBeCloseTo(1.4, 6);
    expect(v[TRONCO_VAGO.derecho]![0]![2]).toBeCloseTo(0, 6);
    expect(v[TRONCO_VAGO.derecho]).toHaveLength(2);
  });

  it('con nombres solo devuelve esos nodos', () => {
    expect(verticesDelDocumento(documento(), new Set(['otro']))).toEqual({});
    expect(Object.keys(verticesDelDocumento(documento(), new Set([TRONCO_VAGO.derecho])))).toEqual([TRONCO_VAGO.derecho]);
  });

  it('cajasDelDocumento es la caja de esos mismos vértices', () => {
    const doc = documento();
    expect(cajasDelDocumento(doc)).toEqual({ [TRONCO_VAGO.derecho]: cajaDePuntos(verticesDelDocumento(doc)[TRONCO_VAGO.derecho]!) });
  });
});

describe('tronco del vago en el GLB publicado', () => {
  it('trae las cuatro mallas y detecta una banda que las cruza', async () => {
    const doc = await (await io()).read('public/modelos/atlas.glb');
    const nombres = new Set([...mallasDelTronco('izquierdo'), ...mallasDelTronco('derecho')]);
    const v = verticesDelDocumento(doc, nombres);
    expect(Object.keys(v).sort()).toEqual([...nombres].sort());
    for (const lado of ['izquierdo', 'derecho'] as const) {
      for (const malla of mallasDelTronco(lado)) {
        const top = Math.max(...v[malla]!.map((p) => p[1]));
        const cruza = comprobarBandas([{ lado, y_max: top - 0.01, y_min: top - 0.03 }], v);
        expect(cruza.some((e) => e.startsWith(`${malla}:`))).toBe(true);
        expect(comprobarBandas([{ lado, y_max: top + 0.1, y_min: top + 0.05 }], v)).toEqual([]);
      }
    }
  }, 30000);
});
