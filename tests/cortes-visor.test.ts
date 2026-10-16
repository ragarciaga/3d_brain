import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRUPO_VAGO, nodos, piezasBajo, todasLasPiezas } from '../src/data/atlas';
import { actualizarPlanos, alCuadro, alErrorShaderRelleno, alMuestraFps, configurarRenderer, construirBvh, crearLineaContorno, crearMallaFantasma, crearMallaRelleno, liberarContornos, mallasDeContorno, mallasDeRelleno, OPACIDAD_FANTASMA_CORTE, piezaConRelleno, piezasConContorno, piezasFantasmaCorte, PLANOS_CORTE, PLANOS_FANTASMA, PLANOS_RECORRIDO, planosActivos, planosDePieza, puntoDeCorte, raycastCorte, raycastNulo, refrescarContorno, segmentosDeCorte, seVeConRecorte, vistaDeMarcador, type EstadoFantasma, type EstadoRelleno } from '../src/components/recorte';
import { cortesApagados, EJE, esEncefalo, ocultoPorCortes, piezasCruzadas, PLANOS, rangoCerebro, type Cortes, type EstadoCuadros, type Plano } from '../src/lib/cortes';
import { useAtlas } from '../src/store/useAtlas';
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

/** Caja de prueba con su árbol de intersección (o sin él, como antes de que llegue el índice de toque), centrada en `c`. */
function caja(lado: number, c: Vec3, material: THREE.Material = new THREE.MeshBasicMaterial(), conArbol = true): THREE.Mesh {
  const g = new THREE.BoxGeometry(lado, lado, lado);
  if (conArbol) g.boundsTree = new MeshBVH(g);
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
  it('sin árbol (el índice de toque aún no llega) descarta el impacto oculto y conserva el visible, igual que con árbol', () => {
    const m = caja(0.01, c, new THREE.MeshBasicMaterial(), false);
    expect(m.geometry.boundsTree).toBeUndefined();
    m.raycast = raycastCorte;
    actualizarPlanos(cortesDe(1, -20), rango);
    expect(desdeArriba(c).intersectObject(m)).toEqual([]);
    actualizarPlanos(cortesDe(1, 20), rango);
    expect(desdeArriba(c).intersectObject(m)).toHaveLength(1);
    expect(m.geometry.boundsTree).toBeUndefined(); // tocar nunca construye el árbol
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
  it('si alguna candidata aún no tiene árbol da null; con todos los árboles da el punto', () => {
    actualizarPlanos(con({ sagital: { mm: 0 } }), rangoD);
    const cam = camaraEn(0.3);
    const sinArbol = [candidatas[0]!, { pieza: B, malla: caja(0.01, c, new THREE.MeshBasicMaterial(), false), cortada: true }];
    expect(puntoDeCorte(A, sinArbol, cam)).toBeNull();
    expect(puntoDeCorte(A, candidatas, cam)).not.toBeNull(); // control: la misma escena con todos los árboles
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
  const base: EstadoRelleno = { cortes: con({ sagital: { mm: -10 } }), ocultas: new Set(), aislar: null, soloEscaneada: false, cajas, rellenoApagado: false };

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

/** Tubo cuadrado abierto de 8 triángulos y 1 cm de radio (vértices (x, z) en (0, r), (r, 0), (0, -r), (-r, 0)), con su BVH. */
function tuboAbierto(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 4, 1, true);
  g.boundsTree = new MeshBVH(g);
  return g;
}

describe('contorno del corte: segmentos (R3.3)', () => {
  const centroTubo: Vec3 = [centro[0], centro[1], centro[2]];
  const matrizTubo = new THREE.Matrix4().makeTranslation(...centroTubo);
  const matrizEspejo = new THREE.Matrix4().makeTranslation(...centroTubo).multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  /** Extremos de los segmentos, llevados al mundo con `matriz`. */
  const extremos = (segs: Float32Array, matriz: THREE.Matrix4) =>
    Array.from({ length: segs.length / 3 }, (_, i) => new THREE.Vector3(segs[3 * i]!, segs[3 * i + 1]!, segs[3 * i + 2]!).applyMatrix4(matriz));
  const largoTotal = (segs: Float32Array) => {
    let suma = 0;
    for (let i = 0; i < segs.length; i += 6) suma += Math.hypot(segs[i]! - segs[i + 3]!, segs[i + 1]! - segs[i + 4]!, segs[i + 2]! - segs[i + 5]!);
    return suma;
  };

  it('un plano axial en 0 mm da la sección del tubo: 8 segmentos sobre el plano y de largo 4 lados', () => {
    const g = tuboAbierto();
    const segs = segmentosDeCorte(g, matrizTubo, planosActivos(con({ axial: { mm: 0 } }), rango));
    expect(segs.length).toBe(48);
    for (const e of extremos(segs, matrizTubo)) expect(e.y).toBeCloseTo(centroTubo[1], 9);
    expect(largoTotal(segs)).toBeCloseTo(4 * 0.01 * Math.SQRT2, 6);
  });
  it('usa el BVH de la geometría: un shapecast por plano activo', () => {
    const g = tuboAbierto();
    const espia = vi.spyOn(g.boundsTree!, 'shapecast');
    segmentosDeCorte(g, matrizTubo, planosActivos(con({ axial: { mm: 0 } }), rango));
    expect(espia).toHaveBeenCalledTimes(1);
    segmentosDeCorte(g, matrizTubo, planosActivos(con({ axial: { mm: 0 }, sagital: { mm: 3 } }), rango));
    expect(espia).toHaveBeenCalledTimes(3);
  });
  it('un plano que no cruza la malla, una geometría sin BVH o sin planos activos dan vacío', () => {
    const g = tuboAbierto();
    expect(segmentosDeCorte(g, matrizTubo, planosActivos(con({ axial: { mm: 15 } }), rango)).length).toBe(0);
    const sinArbol = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 4, 1, true);
    expect(segmentosDeCorte(sinArbol, matrizTubo, planosActivos(con({ axial: { mm: 0 } }), rango)).length).toBe(0);
    expect(sinArbol.boundsTree).toBeUndefined(); // nunca construye uno
    expect(segmentosDeCorte(g, matrizTubo, planosActivos(cortesApagados(), rango)).length).toBe(0);
  });
  it.each([
    ['sin espejo', matrizTubo],
    ['con espejo en x', matrizEspejo],
  ])('con dos planos, axial en 0 y sagital en +3 mm, los segmentos quedan del lado visible de ambos (%s)', (_, matriz) => {
    const g = tuboAbierto();
    const planos = planosActivos(con({ axial: { mm: 0 }, sagital: { mm: 3 } }), rango);
    const segs = segmentosDeCorte(g, matriz, planos);
    // La sección axial sin la parte con x > 3 mm, más dos tramos verticales de 10 mm del plano sagital bajo el axial.
    expect(largoTotal(segs)).toBeCloseTo(0.026 * Math.SQRT2 + 0.02, 6);
    const puntos = extremos(segs, matriz);
    expect(puntos.length).toBeGreaterThan(0);
    for (const e of puntos) for (const plano of planos) expect(plano.distanceToPoint(e)).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('árbol de intersección con índice compartido (R3.3, R3.4)', () => {
  // En el GLB varias mallas comparten el índice (núcleos del tronco, de topología idéntica) y MeshBVH reordena el índice en
  // sitio: construir el árbol de una dejaba sin triángulos al de la anterior y a esa pieza le faltaba el contorno.
  const centroTubo: Vec3 = [centro[0], centro[1], centro[2]];
  const matrizTubo = new THREE.Matrix4().makeTranslation(...centroTubo);
  /** Tubo abierto de 128 triángulos y 1 cm de radio, y su gemelo con el mismo índice y la altura invertida (otro orden de los triángulos en el árbol). */
  const gemelas = () => {
    const a = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 16, 4, true);
    const b = new THREE.BufferGeometry();
    const pos = a.attributes.position!.array as Float32Array;
    const cambiada = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) cambiada.set([pos[i]!, -pos[i + 1]!, pos[i + 2]!], i);
    b.setAttribute('position', new THREE.BufferAttribute(cambiada, 3));
    b.setIndex(a.index); // el mismo BufferAttribute: es lo que pasa con el índice compartido del GLB
    return [a, b] as const;
  };
  // Plano axial a 9,9 mm sobre el centro: el borde de arriba del tubo está a 10 mm, así que solo cruza la franja de arriba.
  const planos = () => planosActivos(con({ axial: { mm: 9.9 } }), rango);

  it('con una geometría gemela construida después, el árbol de la primera sigue dando todos sus segmentos', () => {
    const [a, b] = gemelas();
    a.boundsTree = construirBvh(a);
    const antes = segmentosDeCorte(a, matrizTubo, planos());
    expect(antes.length / 6).toBe(32); // control: 16 caras de la franja de arriba, 2 triángulos cada una
    b.boundsTree = construirBvh(b);
    const despues = segmentosDeCorte(a, matrizTubo, planos());
    expect(despues.length).toBe(antes.length);
    for (let i = 1; i < despues.length; i += 3) expect(despues[i]! + centroTubo[1]).toBeCloseTo(centroTubo[1] + 0.0099, 6);
    // La gemela tiene su propio árbol: su sección cruza el plano en sus propios segmentos.
    expect(segmentosDeCorte(b, matrizTubo, planos()).length).toBeGreaterThan(0);
  });
  it('la geometría recibe un índice propio: no comparte el arreglo con la gemela', () => {
    const [a, b] = gemelas();
    construirBvh(a);
    construirBvh(b);
    expect(a.index!.array).not.toBe(b.index!.array);
  });
});

describe('contorno del corte: qué piezas (R3.3, R3.4, R8.3)', () => {
  const conMalla = piezasBajo('g-brain').filter((p) => nodos[p]!.malla);
  const [P, Q, R] = [conMalla[0]!, conMalla[1]!, conMalla[2]!];
  const [mallaP, mallaQ] = [nodos[P]!.malla!, nodos[Q]!.malla!];
  // P cerrada, Q abierta: la lista se inyecta para que cada caso dependa solo de su condición.
  const cerradas = new Set([mallaP]);
  // Sagital en -10 mm: P y Q lo cruzan, R queda entera del lado oculto (x > plano) y el vago también lo cruza.
  const cajasL: Record<string, Caja> = {
    [P]: [[-0.03, 1.5, -0.01], [0.01, 1.56, 0.01]],
    [Q]: [[-0.03, 1.5, -0.01], [0.01, 1.56, 0.01]],
    [R]: [[0.02, 1.5, -0.01], [0.05, 1.56, 0.01]],
    [vago]: [[-0.2, 0.5, -0.3], [0.2, 1.6, 0.3]],
  };
  const base: EstadoRelleno = { cortes: con({ sagital: { mm: -10 } }), ocultas: new Set(), aislar: null, soloEscaneada: false, cajas: cajasL, rellenoApagado: false };
  const apagado: EstadoRelleno = { ...base, rellenoApagado: true };

  it('los datos de prueba son los esperados: P y Q cruzadas, R y el vago no cuentan, mallas distintas', () => {
    expect(mallaP).not.toBe(mallaQ);
    const rangoL = rangoCerebro(cajasL, piezasBajo('g-brain'));
    expect(piezasCruzadas(cajasL, [P, Q, R], base.cortes, rangoL)).toEqual([P, Q]);
    expect(piezasCruzadas(cajasL, [vago], base.cortes, rangoL)).toEqual([]); // no es del encéfalo, aunque la caja lo cruce
  });
  it('con el relleno encendido solo las piezas abiertas llevan contorno, y cada cruzada va a relleno o a contorno, no a ambos', () => {
    expect(piezasConContorno(base, cerradas)).toEqual([Q]);
    expect(mallasDeRelleno(P, [mallaP], base, cerradas)).toEqual([mallaP]); // control: la cerrada va a relleno
    const rangoL = rangoCerebro(cajasL, piezasBajo('g-brain'));
    for (const p of [P, Q, R]) {
      const cruzada = piezasCruzadas(cajasL, [p], base.cortes, rangoL).length > 0;
      const relleno = mallasDeRelleno(p, [nodos[p]!.malla!], base, cerradas).length > 0;
      const contorno = piezasConContorno(base, cerradas).includes(p);
      expect(Number(relleno) + Number(contorno), p).toBe(Number(cruzada));
    }
  });
  it('con el relleno apagado todas las cortadas llevan contorno y ninguna relleno (R3.4)', () => {
    expect(piezasConContorno(apagado, cerradas)).toEqual([P, Q]);
    expect(mallasDeRelleno(P, [mallaP], apagado, cerradas)).toEqual([]);
    expect(mallasDeRelleno(Q, [mallaQ], apagado, new Set([mallaQ]))).toEqual([]);
    expect(piezaConRelleno(P, apagado)).toBe(false);
    expect(piezaConRelleno(P, base)).toBe(true); // control: solo cambia rellenoApagado
  });
  it('cada condición saca a la pieza del contorno: oculta, fuera del aislamiento (solo y contexto), sin cortes', () => {
    expect(piezasConContorno({ ...apagado, ocultas: new Set([Q]) }, cerradas)).toEqual([P]);
    expect(piezasConContorno({ ...apagado, aislar: { modo: 'solo', piezas: new Set([P]) } }, cerradas)).toEqual([P]);
    expect(piezasConContorno({ ...apagado, aislar: { modo: 'contexto', piezas: new Set([P]) } }, cerradas)).toEqual([P]);
    expect(piezasConContorno({ ...apagado, aislar: { modo: 'solo', piezas: new Set([P, Q]) } }, cerradas)).toEqual([P, Q]);
    expect(piezasConContorno({ ...apagado, cortes: cortesApagados() }, cerradas)).toEqual([]);
    const inactivo = { ...cortesApagados(), sagital: { activo: false, mm: -10, invertido: false } };
    expect(piezasConContorno({ ...apagado, cortes: inactivo }, cerradas)).toEqual([]);
  });
  it('una pieza que ningún plano cruza no lleva contorno, y el vago nunca, aunque el plano cruce su caja', () => {
    expect(piezasConContorno(apagado, cerradas)).not.toContain(R);
    expect(piezasConContorno(apagado, cerradas)).not.toContain(vago);
    expect(piezasConContorno({ ...apagado, cortes: con({ axial: { mm: 0 } }) }, cerradas)).not.toContain(vago);
  });
  it('mallasDeContorno: sin el tubo del toque; una cerrada solo con el relleno apagado', () => {
    expect(mallasDeContorno(['M', 'M#toque'], false, new Set())).toEqual(['M']);
    expect(mallasDeContorno(['M'], false, new Set(['M']))).toEqual([]);
    expect(mallasDeContorno(['M'], true, new Set(['M']))).toEqual(['M']);
    expect(mallasDeContorno(['M#toque'], true, new Set(['M#toque']))).toEqual([]);
  });
});

describe('error de shader (R3.4)', () => {
  const conMalla = piezasBajo('g-brain').filter((p) => nodos[p]!.malla);
  const [P, Q] = [conMalla[0]!, conMalla[1]!];
  const cerradas = new Set([nodos[P]!.malla!]);
  const cajasL: Record<string, Caja> = {
    [P]: [[-0.03, 1.5, -0.01], [0.01, 1.56, 0.01]],
    [Q]: [[-0.03, 1.5, -0.01], [0.01, 1.56, 0.01]],
  };
  const sinRelleno: EstadoRelleno = { cortes: con({ sagital: { mm: -10 } }), ocultas: new Set(), aislar: null, soloEscaneada: false, cajas: cajasL, rellenoApagado: false };
  beforeEach(() => useAtlas.setState({ rellenoApagado: false }));
  afterEach(() => {
    useAtlas.setState({ rellenoApagado: false });
    vi.restoreAllMocks();
  });

  it('apaga el relleno del store, deja el resultado de "relleno apagado" y no escribe en la consola', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(useAtlas.getState().rellenoApagado).toBe(false);
    alErrorShaderRelleno(useAtlas.getState());
    expect(useAtlas.getState().rellenoApagado).toBe(true);
    const s: EstadoRelleno = { ...sinRelleno, rellenoApagado: useAtlas.getState().rellenoApagado };
    expect(piezasConContorno(s, cerradas)).toEqual([P, Q]);
    expect(mallasDeRelleno(P, [nodos[P]!.malla!], s, cerradas)).toEqual([]);
    expect(consola).toHaveBeenCalledTimes(0);
  });
  it('es idempotente', () => {
    alErrorShaderRelleno(useAtlas.getState());
    alErrorShaderRelleno(useAtlas.getState());
    expect(useAtlas.getState().rellenoApagado).toBe(true);
  });
});

describe('vigilante de cuadros (R8.2)', () => {
  const nuevo = (): EstadoCuadros => ({ bajas: 0, apagado: false });
  const muestras = (v: EstadoCuadros, estado: Parameters<typeof alMuestraFps>[2], fps: number, n: number) => {
    for (let i = 0; i < n; i++) alMuestraFps(v, fps, estado);
  };
  const conCortes = () => ({ cortes: con({ sagital: { mm: 0 } }), apagarRelleno: vi.fn() });

  it('9 muestras bajo 30 no apagan; la décima apaga, una sola vez', () => {
    const estado = conCortes();
    const v = nuevo();
    muestras(v, estado, 20, 9);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(0);
    muestras(v, estado, 20, 1);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(1);
    muestras(v, estado, 20, 10);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(1);
  });
  it('sin cortes nunca apaga, por lento que vaya', () => {
    const estado = { cortes: cortesApagados(), apagarRelleno: vi.fn() };
    muestras(nuevo(), estado, 5, 20);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(0);
  });
  it('una muestra de 30 reinicia la cuenta', () => {
    const estado = conCortes();
    const v = nuevo();
    muestras(v, estado, 20, 9);
    muestras(v, estado, 30, 1);
    muestras(v, estado, 20, 9);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(0);
  });
});

describe('cableado del visor: cuadros y renderer (R8.2, R3.4)', () => {
  const nuevoVigilante = (): EstadoCuadros => ({ bajas: 0, apagado: false });
  const nuevoAcumulado = () => ({ cuadros: 0, tiempo: 0 });
  // Cuadros de 0,5 s: cada llamada cierra una muestra de 2 cuadros por segundo.
  const cuadros = (n: number, estado: Parameters<typeof alCuadro>[3], v: EstadoCuadros, acum = nuevoAcumulado(), publicar: (fps: number) => void = () => undefined, sinVigilante?: boolean) => {
    for (let i = 0; i < n; i++) alCuadro(acum, 0.5, v, estado, publicar, sinVigilante);
  };

  it('con cortes, 10 muestras bajas apagan el relleno una sola vez; con 9 no', () => {
    const estado = { cortes: con({ sagital: { mm: 0 } }), apagarRelleno: vi.fn() };
    const v = nuevoVigilante();
    cuadros(9, estado, v);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(0);
    cuadros(1, estado, v);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(1);
    cuadros(10, estado, v);
    expect(estado.apagarRelleno).toHaveBeenCalledTimes(1);
  });
  it('con el flag sinVigilante (solo E2E) o sin cortes nunca apaga, pero sí publica los fps', () => {
    const publicar = vi.fn();
    const conFlag = { cortes: con({ sagital: { mm: 0 } }), apagarRelleno: vi.fn() };
    cuadros(20, conFlag, nuevoVigilante(), nuevoAcumulado(), publicar, true);
    expect(conFlag.apagarRelleno).toHaveBeenCalledTimes(0);
    expect(publicar).toHaveBeenCalledTimes(20);
    const sinCortes = { cortes: cortesApagados(), apagarRelleno: vi.fn() };
    cuadros(20, sinCortes, nuevoVigilante());
    expect(sinCortes.apagarRelleno).toHaveBeenCalledTimes(0);
  });
  it('publica los fps solo cada 0,5 s y reinicia el acumulado', () => {
    const publicar = vi.fn();
    const acum = nuevoAcumulado();
    const estado = { cortes: cortesApagados(), apagarRelleno: vi.fn() };
    const v = nuevoVigilante();
    alCuadro(acum, 0.2, v, estado, publicar);
    alCuadro(acum, 0.2, v, estado, publicar);
    expect(publicar).toHaveBeenCalledTimes(0);
    alCuadro(acum, 0.2, v, estado, publicar);
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(publicar).toHaveBeenCalledWith(5); // 3 cuadros en 0,6 s
    expect(acum).toEqual({ cuadros: 0, tiempo: 0 });
  });

  describe('configurarRenderer', () => {
    beforeEach(() => useAtlas.setState({ rellenoApagado: false }));
    afterEach(() => {
      useAtlas.setState({ rellenoApagado: false });
      vi.restoreAllMocks();
    });
    it('activa los recortes locales y deja un manejador que apaga el relleno del store sin escribir en la consola', () => {
      const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const gl = { localClippingEnabled: false, debug: { onShaderError: null as unknown as THREE.WebGLDebug['onShaderError'] } };
      configurarRenderer(gl, () => useAtlas.getState());
      expect(gl.localClippingEnabled).toBe(true);
      expect(typeof gl.debug.onShaderError).toBe('function');
      expect(useAtlas.getState().rellenoApagado).toBe(false);
      (gl.debug.onShaderError as unknown as () => void)();
      expect(useAtlas.getState().rellenoApagado).toBe(true);
      expect(consola).toHaveBeenCalledTimes(0);
    });
  });
});

describe('limpieza del contorno (D1, R8.3)', () => {
  const [P, Q] = [piezasBajo('g-brain')[0]!, piezasBajo('g-brain')[1]!];
  const matriz = new THREE.Matrix4().makeTranslation(centro[0], centro[1], centro[2]);
  const posiciones = (l: THREE.LineSegments) => l.geometry.attributes.position!.count;

  it('la línea no se toca, no recorta con planos de three, copia la matriz y no se confunde con una malla de pieza', () => {
    const linea = crearLineaContorno(matriz, '#ff0000', P);
    expect(linea).toBeInstanceOf(THREE.LineSegments);
    expect(linea.raycast).toBe(raycastNulo);
    expect(linea.matrixAutoUpdate).toBe(false);
    expect(linea.matrix.equals(matriz)).toBe(true);
    const m = linea.material as THREE.LineBasicMaterial;
    expect(m).toBeInstanceOf(THREE.LineBasicMaterial);
    expect(m.clippingPlanes ?? []).toHaveLength(0);
    expect(linea.userData).toEqual({ contorno: true, pieza: P });
    expect(posiciones(linea)).toBe(0);
    // Con el umbral de línea de three (1 unidad) un raycast normal taparía todo: con raycastNulo no hay impactos.
    const rayo = new THREE.Raycaster(new THREE.Vector3(centro[0], centro[1] + 1, centro[2]), new THREE.Vector3(0, -1, 0));
    expect(rayo.intersectObject(linea)).toEqual([]);
  });
  it('refrescarContorno recalcula solo con otra referencia de cortes y libera la geometría anterior', () => {
    const g = tuboAbierto();
    const linea = crearLineaContorno(matriz, '#ff0000', P);
    const cortes = con({ axial: { mm: 0 } });
    const vacia = linea.geometry;
    const disposeVacia = vi.spyOn(vacia, 'dispose');
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(true);
    expect(disposeVacia).toHaveBeenCalledTimes(1);
    expect(posiciones(linea)).toBeGreaterThan(0);

    const calculada = linea.geometry;
    const disposeCalculada = vi.spyOn(calculada, 'dispose');
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(false);
    expect(linea.geometry).toBe(calculada);
    expect(disposeCalculada).toHaveBeenCalledTimes(0);

    expect(refrescarContorno(linea, g, con({ axial: { mm: 0 } }), rango)).toBe(true);
    expect(linea.geometry).not.toBe(calculada);
    expect(disposeCalculada).toHaveBeenCalledTimes(1);
    expect(posiciones(linea)).toBeGreaterThan(0);

    expect(refrescarContorno(linea, g, cortesApagados(), rango)).toBe(true);
    expect(posiciones(linea)).toBe(0);
  });
  it('refrescarContorno recalcula cuando la geometría recibe su árbol, con los mismos cortes y rango', () => {
    const g = tuboAbierto();
    delete (g as { boundsTree?: unknown }).boundsTree;
    const linea = crearLineaContorno(matriz, '#ff0000', P);
    const cortes = con({ axial: { mm: 0 } });
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(true);
    expect(posiciones(linea)).toBe(0); // sin árbol la línea queda vacía
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(false); // y sigue igual mientras no llegue el árbol
    g.boundsTree = construirBvh(g);
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(true);
    expect(posiciones(linea)).toBeGreaterThan(0);
    expect(refrescarContorno(linea, g, cortes, rango)).toBe(false);
  });
  it('refrescarContorno recalcula también cuando cambia el rango', () => {
    const g = tuboAbierto();
    const linea = crearLineaContorno(matriz, '#ff0000', P);
    const cortes = con({ axial: { mm: 0 } });
    refrescarContorno(linea, g, cortes, rango);
    expect(refrescarContorno(linea, g, cortes, { ...rango })).toBe(true);
  });
  it('liberarContornos libera la geometría y el material de cada línea, no la geometría de la pieza', () => {
    const g = tuboAbierto();
    const disposePieza = vi.spyOn(g, 'dispose');
    const lineas = [crearLineaContorno(matriz, '#ff0000', P), crearLineaContorno(matriz, '#00ff00', Q)];
    for (const l of lineas) refrescarContorno(l, g, con({ axial: { mm: 0 } }), rango);
    const espias = lineas.flatMap((l) => [vi.spyOn(l.geometry, 'dispose'), vi.spyOn(l.material as THREE.Material, 'dispose')]);
    liberarContornos(lineas);
    for (const e of espias) expect(e).toHaveBeenCalledTimes(1);
    expect(disposePieza).toHaveBeenCalledTimes(0);
  });
  it('sin cortes no hay piezas con contorno, tampoco con el relleno apagado', () => {
    const s: EstadoRelleno = { cortes: cortesApagados(), ocultas: new Set(), aislar: null, soloEscaneada: false, cajas, rellenoApagado: true };
    expect(piezasConContorno(s, new Set())).toEqual([]);
    expect(piezasConContorno({ ...s, rellenoApagado: false }, new Set())).toEqual([]);
  });
});

describe('marcadores con cortes (D1, D2, D3, D6)', () => {
  const PADRE = 'g-diencephalon';
  const estado = (cortes: Cortes, fantasmaCorte: boolean) => ({ cortes, fantasmaCorte, cajas });
  const en = (d: Vec3): Vec3 => [centro[0] + d[0], centro[1] + d[1], centro[2] + d[2]];
  /** Punto a `dist` m del plano (10 mm) de ese eje; positivo es el lado que se esconde por defecto. */
  const aDistancia = (plano: Plano, dist: number): Vec3 => {
    const d: Vec3 = [0, 0, 0];
    d[EJE[plano]] = dist + 0.01;
    return en(d);
  };

  it('sin cortes da visible aunque fantasmaCorte sea true, y con un plano inactivo también', () => {
    const oculto = aDistancia('sagital', 0.02);
    expect(vistaDeMarcador(oculto, PADRE, estado(con({ sagital: { mm: 10 } }), false))).toBe('oculto');
    expect(vistaDeMarcador(oculto, PADRE, estado(cortesApagados(), true))).toBe('visible');
    const inactivo = { ...cortesApagados(), sagital: { activo: false, mm: -50, invertido: false } };
    expect(vistaDeMarcador(oculto, PADRE, estado(inactivo, true))).toBe('visible');
  });
  it.each(PLANOS.flatMap((p) => [[p, false], [p, true]] as [Plano, boolean][]))(
    'con solo el plano %s (invertido: %s) el lado oculto es oculto o fantasma y el otro lado es visible',
    (plano, invertido) => {
      const cortes = con({ [plano]: { mm: 10, invertido } });
      const signo = invertido ? -1 : 1;
      const delOculto = aDistancia(plano, 0.02 * signo);
      const delVisible = aDistancia(plano, -0.02 * signo);
      expect(ocultoPorCortes(delOculto, cortes, rango)).toBe(true);
      expect(vistaDeMarcador(delOculto, PADRE, estado(cortes, false))).toBe('oculto');
      expect(vistaDeMarcador(delOculto, PADRE, estado(cortes, true))).toBe('fantasma');
      expect(vistaDeMarcador(delVisible, PADRE, estado(cortes, false))).toBe('visible');
      expect(vistaDeMarcador(delVisible, PADRE, estado(cortes, true))).toBe('visible');
    },
  );
  it('un punto exactamente sobre el plano se ve (distancia 0)', () => {
    const cortes = con({ sagital: { mm: 0 } });
    expect(vistaDeMarcador(en([0, 0, 0]), PADRE, estado(cortes, false))).toBe('visible');
    expect(vistaDeMarcador(en([0, 0, 0]), PADRE, estado(cortes, true))).toBe('visible');
  });
  it('con dos planos basta uno para esconder (unión, R1.4)', () => {
    const cortes = con({ sagital: { mm: 0 }, axial: { mm: 10 } });
    const soloAxial = en([-0.02, 0.03, 0]);
    expect(ocultoPorCortes(soloAxial, cortes, rango)).toBe(true);
    expect(vistaDeMarcador(soloAxial, PADRE, estado(cortes, false))).toBe('oculto');
    expect(vistaDeMarcador(en([-0.02, 0, 0]), PADRE, estado(cortes, false))).toBe('visible');
  });
  it('el vago y un padre nulo nunca se cortan; la única diferencia con el oculto es el padre (R2.1)', () => {
    const cortes = con({ sagital: { mm: 10 } });
    const p = aDistancia('sagital', 0.02);
    for (const fantasma of [false, true]) {
      expect(vistaDeMarcador(p, 'g-vagus-nerve-x', estado(cortes, fantasma))).toBe('visible');
      expect(vistaDeMarcador(p, null, estado(cortes, fantasma))).toBe('visible');
    }
    expect(vistaDeMarcador(p, PADRE, estado(cortes, false))).toBe('oculto');
  });
  it.each([
    ['dos planos', con({ sagital: { mm: 0 }, axial: { mm: 10 } })],
    ['tres planos con el coronal invertido', con({ sagital: { mm: 0 }, axial: { mm: 10 }, coronal: { mm: -5, invertido: true } })],
  ])('%s: lo oculto coincide con lo que las piezas esconden', (_, cortes) => {
    actualizarPlanos(cortes, rango);
    const grilla = [-0.04, -0.02, 0, 0.02, 0.04];
    let ocultos = 0;
    let visibles = 0;
    for (const x of grilla) {
      for (const y of grilla) {
        for (const z of grilla) {
          const p = punto(x, y, z);
          const oculto = vistaDeMarcador(p.toArray(), PADRE, estado(cortes, false)) === 'oculto';
          if (oculto) ocultos++;
          else visibles++;
          expect(oculto, `${x} ${y} ${z}`).toBe(!seVeConRecorte(p, PLANOS_CORTE));
        }
      }
    }
    expect(ocultos).toBeGreaterThan(0);
    expect(visibles).toBeGreaterThan(0);
  });
});
