import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { describe, expect, it } from 'vitest';
import { GRUPO_VAGO, nodos, piezasBajo, todasLasPiezas } from '../src/data/atlas';
import { actualizarPlanos, crearMallaFantasma, crearMallaRelleno, mallasDeRelleno, OPACIDAD_FANTASMA_CORTE, piezasFantasmaCorte, PLANOS_CORTE, PLANOS_FANTASMA, PLANOS_RECORRIDO, planosDePieza, puntoDeCorte, raycastCorte, raycastNulo, seVeConRecorte, type EstadoFantasma, type EstadoRelleno } from '../src/components/recorte';
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

describe('relleno del corte: qué mallas se rellenan (R8.3, R2.6, D1)', () => {
  const mA = nodos[A]!.malla ?? 'malla-A';
  const mVago = nodos[vago]!.malla ?? 'malla-vago';
  const mOrgano = nodos[organo]!.malla ?? 'malla-organo';
  // Lista inyectada: así cada exclusión depende solo de su propia condición.
  const cerradas = new Set([mA, mA + '#toque', mVago, mOrgano]);
  // Sagital en -10 mm: el plano (x = -0,01) cruza A; B queda entera del lado oculto. El vago y el órgano no son del encéfalo.
  const base: EstadoRelleno = { cortes: con({ sagital: { mm: -10 } }), ocultas: new Set(), aislar: null, soloEscaneada: false, cajas };

  it('control positivo: con el plano activo y la malla cerrada hay relleno', () => {
    expect(mallasDeRelleno(A, [mA], base, cerradas)).toEqual([mA]);
  });
  it('sin planos activos no hay relleno, tampoco con un plano inactivo que cruzaría la pieza (R8.3)', () => {
    expect(mallasDeRelleno(A, [mA], { ...base, cortes: cortesApagados() }, cerradas)).toEqual([]);
    const inactivo = { ...cortesApagados(), sagital: { activo: false, mm: -10, invertido: false } };
    expect(mallasDeRelleno(A, [mA], { ...base, cortes: inactivo }, cerradas)).toEqual([]);
  });
  it('una pieza oculta o fuera del aislamiento no se rellena, en modo solo y en contexto; dentro del aislamiento sí (R2.6)', () => {
    expect(mallasDeRelleno(A, [mA], { ...base, ocultas: new Set([A]) }, cerradas)).toEqual([]);
    expect(mallasDeRelleno(A, [mA], { ...base, aislar: { modo: 'solo', piezas: new Set([B]) } }, cerradas)).toEqual([]);
    expect(mallasDeRelleno(A, [mA], { ...base, aislar: { modo: 'contexto', piezas: new Set([B]) } }, cerradas)).toEqual([]);
    expect(mallasDeRelleno(A, [mA], { ...base, aislar: { modo: 'solo', piezas: new Set([A]) } }, cerradas)).toEqual([mA]);
    expect(mallasDeRelleno(A, [mA], { ...base, aislar: { modo: 'contexto', piezas: new Set([A]) } }, cerradas)).toEqual([mA]);
  });
  it('una malla abierta (fuera de la lista) no se rellena', () => {
    expect(mallasDeRelleno(A, [mA], base, new Set())).toEqual([]);
  });
  it('el tubo del toque no se rellena aunque esté en la lista', () => {
    expect(mallasDeRelleno(A, [mA, mA + '#toque'], base, cerradas)).toEqual([mA]);
  });
  it('el vago y el órgano no se rellenan aunque estén en la lista y el plano cruce su caja', () => {
    expect(mallasDeRelleno(vago, [mVago], base, cerradas)).toEqual([]);
    expect(mallasDeRelleno(organo, [mOrgano], base, cerradas)).toEqual([]);
  });
  it('la pieza que ningún plano cruza no se rellena, ni entera del lado oculto ni entera del lado visible', () => {
    expect(mallasDeRelleno(B, [nodos[B]!.malla!], base, new Set([nodos[B]!.malla!]))).toEqual([]);
    expect(mallasDeRelleno(A, [mA], { ...base, cortes: con({ sagital: { mm: 10 } }) }, cerradas)).toEqual([]);
  });
  it('con la lista real entra Thalamus.l y no una malla abierta del encéfalo', () => {
    const lista = new Set(JSON.parse(readFileSync('src/config/mallas-cerradas.json', 'utf8')) as string[]);
    const abierta = piezasBajo('g-brain').find((p) => nodos[p]!.malla && !lista.has(nodos[p]!.malla!))!;
    expect(abierta).toBeDefined();
    const cajasLocales: Record<string, Caja> = {
      'thalamus-l': [[-0.01, 1.5, -0.01], [0.01, 1.52, 0.01]],
      [abierta]: [[-0.01, 1.5, -0.01], [0.01, 1.52, 0.01]],
    };
    const s: EstadoRelleno = { ...base, cortes: con({ sagital: { mm: 0 } }), cajas: cajasLocales };
    expect(mallasDeRelleno('thalamus-l', ['Thalamus.l'], s)).toEqual(['Thalamus.l']);
    expect(mallasDeRelleno(abierta, [nodos[abierta]!.malla!], s)).toEqual([]);
  });
});

describe('malla de relleno (D2, R4.2)', () => {
  it('material de caras traseras con los planos de corte, geometría compartida, toque con raycastCorte y nombreMalla', () => {
    const geometria = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const matriz = new THREE.Matrix4().makeTranslation(0.1, 0.2, 0.3);
    const malla = crearMallaRelleno(geometria, matriz, '#fff', 'Thalamus.l');
    const m = malla.material as THREE.MeshBasicMaterial;
    expect(m).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(m.side).toBe(THREE.BackSide);
    expect(m.clippingPlanes).toBe(PLANOS_CORTE);
    expect(m.transparent).toBe(false);
    expect(malla.geometry).toBe(geometria);
    expect(malla.matrixAutoUpdate).toBe(false);
    expect(malla.matrix.equals(matriz)).toBe(true);
    expect(malla.raycast).toBe(raycastCorte);
    expect(malla.userData).toEqual({ nombreMalla: 'Thalamus.l', relleno: true });
  });
  it('un rayo que entra por la cara del corte pega en el relleno y no en la pieza', () => {
    const c: Vec3 = [centro[0], centro[1], centro[2]];
    const pieza = caja(0.01, c);
    pieza.raycast = raycastCorte;
    const relleno = crearMallaRelleno(pieza.geometry, pieza.matrixWorld, '#fff', 'Thalamus.l');
    relleno.updateMatrixWorld();
    actualizarPlanos(con({ sagital: { mm: 0 } }), rango);
    // El lado oculto es x > c0: el rayo entra por ahí; la pared del fondo (x = c0 - 0,005) es visible.
    const rayo = () => new THREE.Raycaster(new THREE.Vector3(c[0] + 1, c[1] + 0.0011, c[2] + 0.0007), new THREE.Vector3(-1, 0, 0));
    expect(rayo().intersectObject(pieza)).toEqual([]);
    const hits = rayo().intersectObject(relleno);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.object).toBe(relleno);
    expect(hits[0]!.point.x).toBeCloseTo(c[0] - 0.005, 6);
  });
});

describe('punto del lado oculto (D3)', () => {
  const cajaA: Caja = [[-0.02, 1.54, -0.02], [0.02, 1.58, 0.02]];
  const rangoD = rangoCerebro({ [A]: cajaA, [B]: cajaA }, [A, B]);
  const c = rangoD.centro as Vec3;
  const candidatas = [
    { pieza: A, malla: caja(0.04, c), cortada: true },
    { pieza: B, malla: caja(0.01, c), cortada: true },
  ];
  const camaraEnZ = (z: number) => {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 10);
    cam.position.set(c[0], c[1], c[2] + z);
    cam.lookAt(c[0], c[1], c[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return cam;
  };

  it('con la cámara de canto sobre el plano da un punto cuyo rayo cruza A solo del lado oculto', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    const cam = camaraEnZ(0.3);
    const ndc = puntoDeCorte(A, candidatas, cam, PLANOS_CORTE, 'oculto');
    expect(ndc).not.toBeNull();
    expect(ndc!.x).toBeGreaterThan(0);
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(new THREE.Vector2(ndc!.x, ndc!.y), cam);
    for (const dz of [-0.02, 0.02]) {
      const en = rayo.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -(c[2] + dz)), new THREE.Vector3())!;
      expect(en.x).toBeGreaterThan(c[0]);
      expect(Math.abs(en.x - c[0])).toBeLessThanOrEqual(0.02);
      expect(Math.abs(en.y - c[1])).toBeLessThanOrEqual(0.02);
      expect(seVeConRecorte(en, PLANOS_CORTE)).toBe(false);
    }
  });
  it('el punto elegido queda en el medio de la región válida: aguanta un desfase de 6 mm en la cara del corte', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    const cam = camaraEnZ(0.3);
    const raiz = new THREE.Raycaster();
    // Lado oculto: el rayo cruza A en x > c0 y los planos z = c2 +- 0,02 dentro de la caja de A.
    const ndc = puntoDeCorte(A, candidatas, cam, PLANOS_CORTE, 'oculto')!;
    raiz.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), cam);
    const centrado = raiz.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -c[2]), new THREE.Vector3())!;
    for (const [dx, dy] of [[0.006, 0], [-0.006, 0], [0, 0.006], [0, -0.006]]) {
      const p = centrado.clone().add(new THREE.Vector3(dx, dy, 0));
      const nuevo = p.clone().project(cam);
      raiz.setFromCamera(new THREE.Vector2(nuevo.x, nuevo.y), cam);
      const hits = raiz.intersectObjects(candidatas.map((k) => k.malla));
      // A sigue por delante: cualquier impacto del rayo cae del lado oculto, igual que en el punto elegido.
      expect(hits.length, `${dx} ${dy}`).toBeGreaterThan(0);
      expect(hits.every((h) => !seVeConRecorte(h.point, PLANOS_CORTE)), `${dx} ${dy}`).toBe(true);
    }
  });
  it('un rayo que no toca nada no cuenta: el punto cae sobre la malla del objetivo, no en el hueco de su caja', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    // La malla es una caja chica del lado oculto (x de 5 a 15 mm) con una caja envolvente mentirosa de 4 cm: la mayoría de
    // las celdas no tocan nada y ninguna de ellas es visible.
    const g = new THREE.BoxGeometry(0.01, 0.01, 0.01).translate(0.01, 0, 0);
    g.boundsTree = new MeshBVH(g);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.02, -0.02, -0.02), new THREE.Vector3(0.02, 0.02, 0.02));
    const malla = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    malla.position.set(...c);
    malla.updateMatrixWorld();
    const cam = camaraEnZ(0.3);
    const ndc = puntoDeCorte(A, [{ pieza: A, malla, cortada: true }], cam, PLANOS_CORTE, 'oculto');
    expect(ndc).not.toBeNull();
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(new THREE.Vector2(ndc!.x, ndc!.y), cam);
    expect(rayo.intersectObject(malla).length).toBeGreaterThan(0);
  });
  describe('otra pieza cortada junto al objetivo', () => {
    // A es una caja chica (6 mm) a +3 cm en y; B, una caja mayor (2 cm) a -3 cm en y, entera del lado oculto. La caja
    // envolvente de A es mentirosa (10 cm) y cubre a B: las celdas sobre B solo cruzan B. Ninguna toca a la otra.
    const mallaA = (x: number) => {
      const g = new THREE.BoxGeometry(0.006, 0.006, 0.006).translate(x, 0.03, 0);
      g.boundsTree = new MeshBVH(g);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.05, -0.05, -0.05), new THREE.Vector3(0.05, 0.05, 0.05));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      m.position.set(...c);
      m.updateMatrixWorld();
      return m;
    };
    const mallaB = () => caja(0.02, [c[0] + 0.01, c[1] - 0.03, c[2]]);

    it('el punto cae sobre el objetivo y no sobre otra pieza cortada que también está del lado oculto', () => {
      actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
      const a = mallaA(0.01); // x de 7 a 13 mm: del lado oculto
      const cam = camaraEnZ(0.3);
      const ndc = puntoDeCorte(A, [{ pieza: A, malla: a, cortada: true }, { pieza: B, malla: mallaB(), cortada: true }], cam, PLANOS_CORTE, 'oculto');
      expect(ndc).not.toBeNull();
      const rayo = new THREE.Raycaster();
      rayo.setFromCamera(new THREE.Vector2(ndc!.x, ndc!.y), cam);
      const hits = rayo.intersectObject(a);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => !seVeConRecorte(h.point, PLANOS_CORTE))).toBe(true);
    });
    it('si el objetivo no se cruza del lado oculto en ninguna celda, da null aunque otra pieza cortada sí', () => {
      actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
      const a = mallaA(-0.01); // x de -13 a -7 mm: del lado visible, así que cada celda sobre A tiene un impacto visible
      const cam = camaraEnZ(0.3);
      expect(puntoDeCorte(A, [{ pieza: A, malla: a, cortada: true }, { pieza: B, malla: mallaB(), cortada: true }], cam, PLANOS_CORTE, 'oculto')).toBeNull();
    });
  });
  it('con la cámara del lado visible da null', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 10);
    cam.position.set(c[0] - 0.3, c[1], c[2]);
    cam.lookAt(c[0], c[1], c[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    expect(puntoDeCorte(A, candidatas, cam, PLANOS_CORTE, 'oculto')).toBeNull();
  });
  it('sin cortes da null', () => {
    actualizarPlanos(cortesApagados(), rangoD);
    expect(puntoDeCorte(A, candidatas, camaraEnZ(0.3), PLANOS_CORTE, 'oculto')).toBeNull();
  });
  it('una candidata no cortada que tapa el rayo da null', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    expect(puntoDeCorte(A, candidatas, camaraEnZ(0.3), PLANOS_CORTE, 'oculto')).not.toBeNull(); // partida: sin la tapa sí hay punto
    const tapada = [...candidatas, { pieza: 'stomach', malla: caja(0.08, c), cortada: false }];
    expect(puntoDeCorte(A, tapada, camaraEnZ(0.3), PLANOS_CORTE, 'oculto')).toBeNull();
  });
});
