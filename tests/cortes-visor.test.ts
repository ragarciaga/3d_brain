import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { describe, expect, it } from 'vitest';
import { GRUPO_VAGO, piezasBajo, todasLasPiezas } from '../src/data/atlas';
import { actualizarPlanos, crearMallaFantasma, OPACIDAD_FANTASMA_CORTE, piezasFantasmaCorte, PLANOS_CORTE, PLANOS_FANTASMA, PLANOS_RECORRIDO, planosDePieza, puntoDeCorte, raycastCorte, raycastNulo, seVeConRecorte, type EstadoFantasma } from '../src/components/recorte';
import { cortesApagados, EJE, esEncefalo, ocultoPorCortes, PLANOS, rangoCerebro, type Cortes, type Plano } from '../src/lib/cortes';
import type { Vec3 } from '../src/lib/explosion';
import type { Caja } from '../src/lib/inventario';

// Piezas reales del árbol; las cajas son sintéticas, en metros (como tests/cortes.test.ts).
const [A, B] = [piezasBajo('g-brain')[0]!, piezasBajo('g-brain')[1]!];
const vago = piezasBajo(GRUPO_VAGO)[0]!;
const organo = 'stomach';

const cajas: Record<string, Caja> = {
  [A]: [[-0.07, 1.5, -0.09], [0.0, 1.56, 0.0]],
  [B]: [[0.0, 1.56, 0.0], [0.07, 1.62, 0.08]],
  [vago]: [[-0.2, 0.5, -0.3], [0.2, 1.6, 0.3]],
  [organo]: [[-0.1, 1.0, -0.1], [0.1, 1.2, 0.1]],
};
const rango = rangoCerebro(cajas, [A, B]);
const centro = rango.centro;

const con = (parcial: Partial<Record<Plano, { mm: number; invertido?: boolean }>>): Cortes => {
  const c = cortesApagados();
  for (const [p, v] of Object.entries(parcial) as [Plano, { mm: number; invertido?: boolean }][]) c[p] = { activo: true, mm: v.mm, invertido: v.invertido ?? false };
  return c;
};
const punto = (dx: number, dy: number, dz: number) => new THREE.Vector3(centro[0] + dx, centro[1] + dy, centro[2] + dz);

/** Caja de prueba con su árbol de intersección, centrada en `c`. */
function caja(lado: number, c: Vec3, material: THREE.Material = new THREE.MeshBasicMaterial()): THREE.Mesh {
  const g = new THREE.BoxGeometry(lado, lado, lado);
  g.boundsTree = new MeshBVH(g);
  const m = new THREE.Mesh(g, material);
  m.position.set(...c);
  m.updateMatrixWorld();
  return m;
}

describe('planos de corte: quién los lleva (R2.1, R8.3)', () => {
  it('con cortes, PLANOS_CORTE solo para las piezas del encéfalo; el vago el del recorrido; el órgano nada', () => {
    expect(todasLasPiezas.filter((p) => planosDePieza(p, true) === PLANOS_CORTE)).toEqual(todasLasPiezas.filter(esEncefalo));
    expect(planosDePieza(vago, true)).toBe(PLANOS_RECORRIDO);
    expect(PLANOS_RECORRIDO.some((p) => PLANOS_CORTE.includes(p))).toBe(false);
    expect(planosDePieza(organo, true)).toBeNull();
  });
  it('sin cortes el encéfalo y los órganos no llevan planos y el vago conserva el suyo', () => {
    expect(planosDePieza(A, false)).toBeNull();
    expect(planosDePieza(organo, false)).toBeNull();
    expect(planosDePieza(vago, false)).toBe(PLANOS_RECORRIDO);
  });
  it('sin cortes no hay fantasma aunque fantasmaCorte sea true, ni con un plano inactivo', () => {
    const base: EstadoFantasma = { cortes: cortesApagados(), fantasmaCorte: true, ocultas: new Set(), aislar: null, soloEscaneada: false, cajas };
    expect(piezasFantasmaCorte(base)).toEqual([]);
    const inactivo = { ...cortesApagados(), sagital: { activo: false, mm: -50, invertido: false } };
    expect(piezasFantasmaCorte({ ...base, cortes: inactivo })).toEqual([]);
  });
  it('actualizarPlanos muta en sitio, deja lejos lo inactivo y no recorta nada sin cortes', () => {
    const antes = [...PLANOS_CORTE];
    actualizarPlanos(con({ sagital: { mm: 5 } }), rango);
    expect([...PLANOS_CORTE]).toEqual(antes);
    PLANOS.forEach((_, i) => {
      expect(PLANOS_FANTASMA[i]!.normal.toArray()).toEqual(PLANOS_CORTE[i]!.normal.clone().negate().toArray());
      expect(PLANOS_FANTASMA[i]!.constant).toBe(-PLANOS_CORTE[i]!.constant);
    });
    actualizarPlanos(cortesApagados(), rango);
    for (const p of [punto(2, 2, 2), punto(-2, -2, -2), punto(0, 0, 0), punto(2, -2, 2)]) expect(seVeConRecorte(p, PLANOS_CORTE)).toBe(true);
  });
});

describe('planos de corte: lado oculto (R1.4)', () => {
  const grilla = [-0.04, -0.02, 0, 0.02, 0.04];
  it.each([
    ['dos planos', con({ sagital: { mm: 0 }, axial: { mm: 10 } })],
    ['tres planos con el coronal invertido', con({ sagital: { mm: 0 }, axial: { mm: 10 }, coronal: { mm: -5, invertido: true } })],
  ])('%s: seVeConRecorte coincide con ocultoPorCortes', (_, cortes) => {
    actualizarPlanos(cortes, rango);
    let ocultos = 0;
    for (const x of grilla) {
      for (const y of grilla) {
        for (const z of grilla) {
          const p = punto(x, y, z);
          const oculto = ocultoPorCortes(p.toArray(), cortes, rango);
          if (oculto) ocultos++;
          expect(seVeConRecorte(p, PLANOS_CORTE), `${x} ${y} ${z}`).toBe(!oculto);
        }
      }
    }
    expect(ocultos).toBeGreaterThan(0);
    expect(ocultos).toBeLessThan(grilla.length ** 3);
  });
});

describe('fantasma del corte (R5.2, R5.3, R2.6)', () => {
  const geometria = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const matriz = new THREE.Matrix4().makeTranslation(0.1, 0.2, 0.3);

  it('material casi transparente, solo con los planos negados y en intersección', () => {
    const malla = crearMallaFantasma(geometria, matriz, '#ff0000', A);
    const m = malla.material as THREE.MeshStandardMaterial;
    expect(OPACIDAD_FANTASMA_CORTE).toBeLessThanOrEqual(0.25);
    expect(m.opacity).toBeLessThanOrEqual(0.25);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.clipIntersection).toBe(true);
    expect(m.clippingPlanes).toBe(PLANOS_FANTASMA);
  });
  it.each(PLANOS.flatMap((p) => [[p, false], [p, true]] as [Plano, boolean][]))(
    'con solo el plano %s (invertido: %s) el fantasma muestra solo el lado oculto',
    (plano, invertido) => {
      const cortes = con({ [plano]: { mm: 10, invertido } });
      actualizarPlanos(cortes, rango);
      const m = crearMallaFantasma(geometria, matriz, '#fff', A).material as THREE.MeshStandardMaterial;
      for (const signo of [-1, 1]) {
        const d: Vec3 = [0, 0, 0];
        d[EJE[plano]] = 0.02 * signo + 0.01;
        const p = punto(...d);
        const oculto = ocultoPorCortes(p.toArray(), cortes, rango);
        expect(seVeConRecorte(p, m.clippingPlanes, m.clipIntersection)).toBe(oculto);
        expect(seVeConRecorte(p, PLANOS_CORTE)).toBe(!oculto);
      }
    },
  );
  it('la malla del fantasma no se toca y comparte la geometría', () => {
    const malla = crearMallaFantasma(geometria, matriz, '#fff', A);
    expect(malla.raycast).toBe(raycastNulo);
    const rayo = new THREE.Raycaster(new THREE.Vector3(0.1, 0.2, 1), new THREE.Vector3(0, 0, -1));
    expect(rayo.intersectObject(malla)).toEqual([]);
    expect(malla.geometry).toBe(geometria);
    expect(malla.matrixAutoUpdate).toBe(false);
    expect(malla.matrix.equals(matriz)).toBe(true);
    expect(malla.userData).toEqual({ fantasmaCorte: true, pieza: A });
  });
  it('piezasFantasmaCorte: cada condición cambia el resultado', () => {
    const base: EstadoFantasma = { cortes: con({ sagital: { mm: -10 } }), fantasmaCorte: true, ocultas: new Set(), aislar: null, soloEscaneada: false, cajas };
    // Sagital en -10 mm: A (x de -0,07 a 0) lo cruza y B (x de 0 a 0,07) queda entera del lado oculto.
    expect(piezasFantasmaCorte(base)).toEqual([A, B]);
    expect(piezasFantasmaCorte({ ...base, ocultas: new Set([A]) })).toEqual([B]);
    expect(piezasFantasmaCorte({ ...base, aislar: { modo: 'solo', piezas: new Set([B]) } })).toEqual([B]);
    expect(piezasFantasmaCorte({ ...base, aislar: { modo: 'contexto', piezas: new Set([A]) } })).toEqual([A]);
    expect(piezasFantasmaCorte({ ...base, fantasmaCorte: false })).toEqual([]);
    // El plano axial en -10 mm también cruza la caja del vago (0,5 a 1,6 m): nunca se incluye.
    expect(piezasFantasmaCorte({ ...base, cortes: con({ axial: { mm: -10 } }) })).toEqual([A, B]);
  });
  it('piezasFantasmaCorte: una pieza entera del lado oculto entra y una entera del lado visible no (R5.2)', () => {
    const base: EstadoFantasma = { cortes: con({ sagital: { mm: 10 } }), fantasmaCorte: true, ocultas: new Set(), aislar: null, soloEscaneada: false, cajas };
    expect(piezasFantasmaCorte(base)).toEqual([B]); // A queda entera del lado visible (x hasta 0) y B lo cruza
    // Invertido, A queda entera del lado oculto; con dos planos basta uno (el coronal invertido en +55 mm oculta a A).
    expect(piezasFantasmaCorte({ ...base, cortes: con({ sagital: { mm: 10, invertido: true } }) })).toEqual([A, B]);
    expect(piezasFantasmaCorte({ ...base, cortes: con({ sagital: { mm: 10 }, coronal: { mm: 55, invertido: true } }) })).toEqual([A, B]);
  });
});

describe('toque con cortes (R4.3)', () => {
  // El rayo se corre un poco del centro: ahí pasa justo por la diagonal de la cara y daría dos impactos.
  const desdeArriba = (c: Vec3) => new THREE.Raycaster(new THREE.Vector3(c[0] + 0.0011, c[1] + 1, c[2] + 0.0007), new THREE.Vector3(0, -1, 0));
  const c: Vec3 = [centro[0], centro[1], centro[2]];
  // Siempre pasa el último plano: los anteriores ven la caja y solo el último la oculta.
  const orden: Plano[] = ['sagital', 'coronal', 'axial'];
  const cortesDe = (n: number, ultimo: number) =>
    con(Object.fromEntries(orden.slice(0, n).map((p, i) => [p, { mm: i === n - 1 ? ultimo : 20 }])) as Record<Plano, { mm: number }>);

  it.each([1, 2, 3])('con %i plano(s) activos descarta el impacto oculto y conserva el visible', (n) => {
    const m = caja(0.01, c);
    m.raycast = raycastCorte;
    actualizarPlanos(cortesDe(n, -20), rango);
    expect(desdeArriba(c).intersectObject(m)).toEqual([]);
    actualizarPlanos(cortesDe(n, 20), rango);
    expect(desdeArriba(c).intersectObject(m)).toHaveLength(1);
  });
  it('sin planos activos el impacto se conserva', () => {
    const m = caja(0.01, c);
    m.raycast = raycastCorte;
    actualizarPlanos(cortesApagados(), rango);
    expect(desdeArriba(c).intersectObject(m)).toHaveLength(1);
  });
  it('con firstHitOnly se queda con el impacto visible aunque el primero esté oculto, y con dos visibles con el más cercano', () => {
    const m = caja(0.01, c, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.raycast = raycastCorte;
    // El plano axial en 0 esconde la cara de arriba y deja la de abajo.
    actualizarPlanos(con({ axial: { mm: 0 } }), rango);
    const rayo = desdeArriba(c);
    rayo.firstHitOnly = true;
    const hits = rayo.intersectObject(m);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.point.y).toBeCloseTo(c[1] - 0.005, 6);
    expect(rayo.firstHitOnly).toBe(true);
    actualizarPlanos(cortesApagados(), rango); // dos impactos visibles: firstHitOnly deja el más cercano, la cara de arriba
    const unico = rayo.intersectObject(m);
    expect(unico).toHaveLength(1);
    expect(unico[0]!.point.y).toBeCloseTo(c[1] + 0.005, 6);
  });
});

describe('punto sobre la cara del corte (D1)', () => {
  const cajaA: Caja = [[-0.02, 1.54, -0.02], [0.02, 1.58, 0.02]];
  const rangoD = rangoCerebro({ [A]: cajaA, [B]: cajaA }, [A, B]);
  const c = rangoD.centro as Vec3;
  const candidatas = [
    { pieza: A, malla: caja(0.04, c), cortada: true },
    { pieza: B, malla: caja(0.01, c), cortada: true },
  ];
  const camaraEn = (x: number) => {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 10);
    cam.position.set(c[0] + x, c[1], c[2]);
    cam.lookAt(c[0], c[1], c[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return cam;
  };

  it('con la cámara del lado oculto el rayo cruza la sección de A y no la de B', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    const cam = camaraEn(0.3);
    const ndc = puntoDeCorte(A, candidatas, cam);
    expect(ndc).not.toBeNull();
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(new THREE.Vector2(ndc!.x, ndc!.y), cam);
    const en = rayo.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), -c[0]), new THREE.Vector3())!;
    const d = Math.max(Math.abs(en.y - c[1]), Math.abs(en.z - c[2]));
    expect(d).toBeLessThan(0.02);
    expect(d).toBeGreaterThan(0.005);
  });
  it('sin cortes y con la cámara del lado visible da null', () => {
    actualizarPlanos(cortesApagados(), rangoD);
    expect(puntoDeCorte(A, candidatas, camaraEn(0.3))).toBeNull();
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    expect(puntoDeCorte(A, candidatas, camaraEn(-0.3))).toBeNull();
  });
});
