// Visor 3D (F1). Cada pieza se dibuja con la transformación original del GLB, sin tocarla, dentro de
// un grupo cuyo único papel es sumar el desplazamiento de fragmentar (F6, F7).
import { CameraControls, Html, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import {
  esFragmentable,
  origenDe,
  esMallaDeToque,
  estructuras,
  marcadores,
  nodos,
  piezaDeMalla,
  piezasDeAncla,
  piezasDeEntrada,
  puntosDeMarcador,
  trazoDeMalla,
} from '../data/atlas';
import type { Idioma, Marcador } from '../data/tipos';
import { acercar, CERO, promedio, type Vec3 } from '../lib/explosion';
import type { Vista } from '../lib/enlaces';
import { MARCA_INDICE_TOQUE, MARCA_MODELO_LEIDO, MARCA_MODELO_LISTO, MARCA_PRIMER_CUADRO } from '../lib/medicion';
import { crearLectorMovimiento } from '../lib/movimiento';
import { DIRECCIONES, desfaseVerticalPx, distanciaEncuadre, esSeleccionable } from '../lib/vistas';
import { nombre, nombrePieza } from '../lib/nombres';
import { ordenarTrazos } from '../lib/trazos';
import { nivelDeParada, paradasVago } from '../lib/recorrido';
import { fueraDeSitio, objetivo, piezasDeEncuadre, piezasSeleccionadas, piezasVisibles, useAtlas } from '../store/useAtlas';
import BarreraVisor from './BarreraVisor';
import { colorDePieza } from './colores';
import { marcarUnaVez, useMetricas } from './metricas';
import { punteado } from './acabados';
import { esEncefalo, hayCortes, type EstadoCuadros } from '../lib/cortes';
import ContornoCorte from './ContornoCorte';
import { actualizarPlanos, alCuadro, configurarRenderer, construirBvh, crearMallaFantasma, crearMallaRelleno, mallasRellenables, piezaConRelleno, piezasFantasmaCorte, planoRecorrido, PLANOS_CORTE, planosDePieza, puntoDeCorte, rangoActual, raycastCorte, raycastNulo, SIN_RECORTE, type CandidataCorte } from './recorte';
import RutasTrazadas from './RutasTrazadas';
import { useDensidadAdaptativa } from './useDensidadAdaptativa';

export const URL_MODELO = `${import.meta.env.BASE_URL}modelos/atlas.glb`;

interface MallaCargada {
  nombre: string;
  geometria: THREE.BufferGeometry;
  matriz: THREE.Matrix4; // transformación original del nodo, solo lectura
  toque: boolean;
  trazo: number | null;
}

/** Cajas de cada pieza en el mundo, para encuadrar. Se llenan al cargar el modelo. */
export const cajasPiezas = new Map<string, THREE.Box3>();

/** Caja de cada malla de trazo del vago en el mundo (sin desplazamiento), para encuadrar un trazo. Se llena al cargar el modelo. */
export const cajasMallas = new Map<string, THREE.Box3>();

interface Punto2 {
  x: number;
  y: number;
}

/** Acceso a la cámara para "Compartir esta vista". */
export const camaraActual: {
  leer: (() => number[]) | null;
  /** Posición en pantalla (px del lienzo) del punto que mira la cámara; para pruebas. */
  objetivoEnPantalla: (() => { x: number; y: number }) | null;
  /** Dónde está (`actual`, con su desplazamiento) y dónde va (`casa`) una pieza, en px del lienzo; para pruebas. */
  piezaEnPantalla: ((pieza: string) => { casa: Punto2; actual: Punto2 } | null) | null;
  /**
   * Distancia entre la cámara que dibuja (la que usan también los rayos del toque) y la pose a la que va (la de `leer`);
   * 0 al llegar. `leer` da la pose de destino, que no dice si la cámara ya llegó; para pruebas.
   */
  desfase: (() => number) | null;
  /** Cuántos pedidos de cámara (`pedirCamara`) ha aplicado el visor; para pruebas: indica que el pedido ya empezó a moverla. */
  pedidosAplicados: number;
} = { leer: null, objetivoEnPantalla: null, piezaEnPantalla: null, desfase: null, pedidosAplicados: 0 };

/** Nombre de la tarjeta gráfica, si el navegador lo informa (Safari suele decir solo "Apple GPU"). */
function nombreGpu(ctx: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  } catch {
    return '';
  }
}

/** Proyecta un punto del mundo a píxeles del lienzo (misma fórmula que `objetivoEnPantalla`). */
function aPantalla(p: THREE.Vector3, camara: THREE.Camera, ancho: number, alto: number): Punto2 {
  const q = p.clone().project(camara);
  return { x: ((q.x + 1) / 2) * ancho, y: ((1 - q.y) / 2) * alto };
}

/** Un arrastre para rotar no es un toque (R3F dispara onClick aunque el puntero se haya movido). */
const ARRASTRE_PX = 4;

/** Se lee una sola vez (no por pieza y por cuadro) y se actualiza cuando el sistema cambia la preferencia. */
export const reducirMovimiento = crearLectorMovimiento(typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined);

function Pieza({ id, mallas, idioma }: { id: string; mallas: MallaCargada[]; idioma: Idioma }) {
  const grupo = useRef<THREE.Group>(null);
  const desplazamiento = useRef<Vec3>(CERO);
  const { t } = useTranslation();
  const nodo = nodos[id]!;
  const referencia = nodo.clase === 'referencia';
  // En el inventario (F6) lo que no se desarma (órganos de referencia y vago) quedaría encima de las repisas: se oculta.
  const fija = referencia || !esFragmentable(id);
  const aproximada = origenDe(id) === 'aproximada'; // F25: trazado, no medido
  const visible = useAtlas(
    (s) =>
      !s.ocultas.has(id) &&
      (!s.aislar || s.aislar.piezas.has(id) || s.aislar.modo === 'contexto') &&
      !(fija && s.inventario) &&
      !(aproximada && s.soloEscaneada),
  );
  const fantasma = useAtlas((s) => !!s.aislar && s.aislar.modo === 'contexto' && !s.aislar.piezas.has(id));
  const seleccionada = useAtlas((s) => piezasSeleccionadas(s.seleccion).includes(id));
  const mallaSel = useAtlas((s) => s.seleccion.malla);
  const ubicando = useAtlas((s) => !!s.ubicando);
  const revisando = useAtlas((s) => !!s.revisor);
  const shift = useAtlas((s) => s.shift);
  const conCortes = useAtlas((s) => hayCortes(s.cortes));
  // Booleano, nunca un arreglo: en zustand 5 un selector que devuelve un arreglo nuevo entra en bucle.
  const conRelleno = useAtlas((s) => piezaConRelleno(id, s));
  const [encima, setEncima] = useState(false);

  // Planos de la pieza: los de corte (encéfalo), el del recorrido (vago) o ninguno (órganos y sin cortes).
  const planos = planosDePieza(id, conCortes);
  const color = colorDePieza(id);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    const obj = objetivo(useAtlas.getState(), id);
    const nuevo = acercar(desplazamiento.current, obj, reducirMovimiento() ? 1 : dt * 6);
    desplazamiento.current = nuevo;
    g.position.set(nuevo[0], nuevo[1], nuevo[2]);
  });

  // Una pieza oculta nunca se toca; un fantasma (aislar con contexto) solo con Shift, para sumarlo.
  // Al proponer una posición (revisión) también los órganos de referencia reciben el toque.
  const seleccionable = esSeleccionable({ visible, referencia, fantasma, shift, ubicando });

  const alTocar = (e: ThreeEvent<MouseEvent>) => {
    if (!seleccionable || e.delta > ARRASTRE_PX) return;
    e.stopPropagation();
    const s = useAtlas.getState();
    if (s.ubicando) {
      // Propuesta de posición (F24): punto sobre la malla visible (no el tubo de toque), menos el
      // desplazamiento actual de la pieza.
      const visibleHit = e.intersections.find(
        (i) => i.eventObject === e.eventObject && !String(i.object.userData.nombreMalla ?? '').endsWith('#toque'),
      );
      const punto = visibleHit?.point ?? e.point;
      const d = desplazamiento.current;
      const p: [number, number, number] = [punto.x - d[0], punto.y - d[1], punto.z - d[2]];
      const est = estructuras[s.ubicando];
      s.proponerPosicion(
        {
          estructura: s.ubicando,
          campo: 'posicion',
          veredicto: 'corregir',
          posicion: p.map((v) => Number(v.toFixed(5))) as [number, number, number],
          version: est?.ficha?.version ?? 'sin-ficha',
          fecha: new Date().toISOString(),
        },
        id,
      );
      return;
    }
    const nombreMalla = (e.object.userData.nombreMalla as string | undefined) ?? null;
    const entrada = nodo.estructura ?? null;
    const shift = (e.nativeEvent as MouseEvent).shiftKey;
    if (shift) {
      s.aislarPiezas([id], s.aislar?.modo ?? 'solo', true);
      return;
    }
    s.seleccionar({
      entrada,
      pieza: id,
      malla: s.revisor && nombreMalla && trazoDeMalla(nombreMalla) !== null ? nombreMalla.replace('#toque', '') : null,
    });
    window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada } }));
  };

  const alDobleTocar = (e: ThreeEvent<MouseEvent>) => {
    if (!seleccionable || e.delta > ARRASTRE_PX) return;
    e.stopPropagation();
    const s = useAtlas.getState();
    if (fueraDeSitio(s, id)) s.devolver([id]);
    else s.pedirCamara({ encuadrar: [id] });
  };

  return (
    <group
      ref={grupo}
      visible={visible}
      onClick={alTocar}
      onDoubleClick={alDobleTocar}
      onPointerOver={(e) => {
        if (!seleccionable) return;
        e.stopPropagation();
        setEncima(true);
      }}
      onPointerOut={() => setEncima(false)}
    >
      {mallas.map((m) => {
        const esTrazoSel = revisando && mallaSel !== null && m.nombre.replace('#toque', '') === mallaSel && !m.toque;
        return (
          <mesh
            key={m.nombre}
            geometry={m.geometria}
            matrixAutoUpdate={false}
            matrix={m.matriz}
            raycast={seleccionable ? (planos === PLANOS_CORTE ? raycastCorte : acceleratedRaycast) : raycastNulo}
            userData={{ nombreMalla: m.nombre }}
            renderOrder={referencia ? 2 : m.toque ? 3 : 0}
          >
            {m.toque ? (
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            ) : (
              <meshStandardMaterial
                color={esTrazoSel ? '#ff5a1f' : color}
                roughness={aproximada ? 1 : 0.65}
                onBeforeCompile={aproximada ? punteado : undefined}
                customProgramCacheKey={aproximada ? () => 'punteado' : undefined}
                metalness={0}
                transparent={referencia || fantasma}
                opacity={referencia ? 0.18 : fantasma ? 0.08 : 1}
                depthWrite={!(referencia || fantasma)}
                emissive={seleccionada ? '#3c83f6' : encima ? '#444444' : '#000000'}
                emissiveIntensity={seleccionada ? 0.55 : 0.35}
                clippingPlanes={planos}
              />
            )}
          </mesh>
        );
      })}
      {/* Hijo del grupo: el cursor y el toque del relleno burbujean a los manejadores de arriba (etiqueta, selección, ficha). */}
      {conRelleno && <RellenoDePieza mallas={mallas} color={color} tocable={seleccionable} />}
      {encima && (
        <Html position={centroLocal(mallas)} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="etiqueta-3d">{nombrePieza(id, idioma, t)}</div>
        </Html>
      )}
    </group>
  );
}

function centroLocal(mallas: MallaCargada[]): THREE.Vector3 {
  const caja = new THREE.Box3();
  for (const m of mallas) {
    if (m.toque) continue;
    if (!m.geometria.boundingBox) m.geometria.computeBoundingBox();
    caja.union(m.geometria.boundingBox!.clone().applyMatrix4(m.matriz));
  }
  return caja.getCenter(new THREE.Vector3());
}

function Modelo({ idioma }: { idioma: Idioma }) {
  const gltf = useGLTF(URL_MODELO);
  const setCentros = useAtlas((s) => s.setCentros);
  const conCortes = useAtlas((s) => hayCortes(s.cortes));

  const porPieza = useMemo(() => {
    marcarUnaVez(MARCA_MODELO_LEIDO);
    gltf.scene.updateMatrixWorld(true);
    const res = new Map<string, MallaCargada[]>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const nombre = (o.userData.name as string | undefined) ?? o.name;
      const pieza = piezaDeMalla(nombre);
      if (!pieza) return;
      // Árbol de intersección para tocar rápido aun con un millón de triángulos.
      if (!mesh.geometry.boundsTree) mesh.geometry.boundsTree = construirBvh(mesh.geometry);
      const l = res.get(pieza) ?? [];
      l.push({
        nombre,
        geometria: mesh.geometry,
        matriz: o.matrixWorld.clone(),
        toque: esMallaDeToque(nombre),
        trazo: trazoDeMalla(nombre),
      });
      res.set(pieza, l);
    });
    marcarUnaVez(MARCA_INDICE_TOQUE);
    return res;
  }, [gltf]);

  useEffect(() => {
    const centros: Record<string, Vec3> = {};
    const cajas: Record<string, [Vec3, Vec3]> = {};
    cajasPiezas.clear();
    cajasMallas.clear();
    const nombresMallas: string[] = [];
    for (const [pieza, mallas] of porPieza) {
      const caja = new THREE.Box3();
      for (const m of mallas) {
        nombresMallas.push(m.nombre);
        if (m.toque) continue;
        if (!m.geometria.boundingBox) m.geometria.computeBoundingBox();
        const cajaMalla = m.geometria.boundingBox!.clone().applyMatrix4(m.matriz);
        if (m.trazo !== null) cajasMallas.set(m.nombre, cajaMalla);
        caja.union(cajaMalla);
      }
      cajasPiezas.set(pieza, caja);
      const c = caja.getCenter(new THREE.Vector3());
      centros[pieza] = [c.x, c.y, c.z];
      cajas[pieza] = [caja.min.toArray(), caja.max.toArray()];
    }
    useMetricas.getState().setPiezas(porPieza.size);
    setCentros(centros, cajas);
    useAtlas.getState().setTrazos(ordenarTrazos(nombresMallas));
    if (!performance.getEntriesByName(MARCA_MODELO_LISTO).length) performance.mark(MARCA_MODELO_LISTO);
  }, [porPieza, setCentros]);

  return (
    <>
      {[...porPieza.entries()].map(([id, mallas]) => (
        <Pieza key={id} id={id} mallas={mallas} idioma={idioma} />
      ))}
      <FantasmaCorte porPieza={porPieza} />
      {conCortes && <ContornoCorte porPieza={porPieza} />}
    </>
  );
}

/**
 * Fantasma del corte (F8): una copia translúcida del lado oculto de cada pieza del encéfalo visible que un plano cruza.
 * Se suscribe a los campos crudos y calcula con useMemo: un selector que devuelva un arreglo nuevo hace un bucle en zustand 5.
 */
function FantasmaCorte({ porPieza }: { porPieza: Map<string, MallaCargada[]> }) {
  const cortes = useAtlas((s) => s.cortes);
  const fantasmaCorte = useAtlas((s) => s.fantasmaCorte);
  const ocultas = useAtlas((s) => s.ocultas);
  const aislar = useAtlas((s) => s.aislar);
  const soloEscaneada = useAtlas((s) => s.soloEscaneada);
  const cajas = useAtlas((s) => s.cajas);
  const ids = useMemo(
    () => piezasFantasmaCorte({ cortes, fantasmaCorte, ocultas, aislar, soloEscaneada, cajas }),
    [cortes, fantasmaCorte, ocultas, aislar, soloEscaneada, cajas],
  );
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => (
        <FantasmaDePieza key={id} id={id} mallas={porPieza.get(id) ?? []} />
      ))}
    </>
  );
}

function FantasmaDePieza({ id, mallas }: { id: string; mallas: MallaCargada[] }) {
  const copias = useMemo(
    () => mallas.filter((m) => !m.toque).map((m) => crearMallaFantasma(m.geometria, m.matriz, colorDePieza(id), id)),
    [id, mallas],
  );
  // Solo el material: la geometría es la de la pieza y se comparte.
  useEffect(() => () => copias.forEach((c) => (c.material as THREE.Material).dispose()), [copias]);
  return (
    <>
      {copias.map((c) => (
        <primitive key={c.uuid} object={c} />
      ))}
    </>
  );
}

/** Relleno de la cara del corte (ADR 0011): la cara trasera de cada malla cerrada de la pieza, con el color de la pieza. */
function RellenoDePieza({ mallas, color, tocable }: { mallas: MallaCargada[]; color: string; tocable: boolean }) {
  const copias = useMemo(() => {
    const rellenables = new Set(mallasRellenables(mallas.map((m) => m.nombre)));
    return mallas.filter((m) => rellenables.has(m.nombre)).map((m) => crearMallaRelleno(m.geometria, m.matriz, color, m.nombre));
  }, [mallas, color]);
  // Solo el material: la geometría es la de la pieza y se comparte.
  useEffect(() => () => copias.forEach((c) => (c.material as THREE.Material).dispose()), [copias]);
  return (
    <>
      {copias.map((c) => (
        <primitive key={c.uuid} object={c} raycast={tocable ? raycastCorte : raycastNulo} />
      ))}
    </>
  );
}

/** Un punto de marcador tal como se dibuja, con su posición en el mundo. */
export interface PuntoDibujado {
  id: string;
  lado: 'l' | 'r' | null;
  propuesta: boolean;
  pos: [number, number, number];
}

let extraPrueba: Marcador[] = [];
const oyentesPrueba = new Set<() => void>();
function suscribirPrueba(cb: () => void) {
  oyentesPrueba.add(cb);
  return () => {
    oyentesPrueba.delete(cb);
  };
}

/** Solo pruebas E2E: se expone en DEV desde src/main.tsx. Inyecta marcadores y lee los puntos dibujados. */
export const marcadoresDePrueba: { inyectar(lista: Marcador[]): void; puntos: (() => PuntoDibujado[]) | null } = {
  inyectar(lista) {
    extraPrueba = [...lista];
    for (const cb of oyentesPrueba) cb();
  },
  puntos: null,
};

/**
 * Marcadores (SPEC sección 6): lo que no tiene malla. Con posición propia se dibuja uno o un punto por lado y
 * sigue a su ancla al separar. Sin posición y con ancla, en el centro de cada pieza del ancla.
 */
function Marcadores({ idioma }: { idioma: Idioma }) {
  const cargado = useAtlas((s) => s.cargado);
  const extra = useSyncExternalStore(suscribirPrueba, () => extraPrueba);
  const grupo = useRef<THREE.Group>(null);
  useEffect(() => {
    marcadoresDePrueba.puntos = () =>
      (grupo.current?.children ?? []).flatMap((obj) => {
        const u = obj.userData as { marcador?: string; lado?: 'l' | 'r' | null; propuesta?: boolean };
        if (!u.marcador) return [];
        const p = obj.getWorldPosition(new THREE.Vector3()).toArray();
        return [{ id: u.marcador, lado: u.lado ?? null, propuesta: u.propuesta ?? false, pos: [p[0], p[1], p[2]] as [number, number, number] }];
      });
    return () => {
      marcadoresDePrueba.puntos = null;
    };
  }, []);
  const seleccion = useAtlas((s) => s.seleccion.entrada);
  const respuestas = useAtlas((s) => s.respuestas);
  // Los marcadores con ancla siguen a su pieza cuando se fragmenta.
  const base = useAtlas((s) => s.base);
  const separadas = useAtlas((s) => s.separadas);
  const devueltas = useAtlas((s) => s.devueltas);
  void base;
  void separadas;
  void devueltas;
  const ocultas = useAtlas((s) => s.ocultas);
  const aislar = useAtlas((s) => s.aislar);
  const visibles = useMemo(() => new Set(piezasVisibles({ ocultas, aislar })), [ocultas, aislar]);
  if (!cargado) return null;
  const s = useAtlas.getState();
  const puntos: { id: string; lado: 'l' | 'r' | null; pos: THREE.Vector3; aproximada: boolean; propuesta: boolean }[] = [];
  for (const m of [...marcadores, ...extra]) {
    if (m.posicion) {
      // Con posición propia, cada punto suma lo que se desplaza su ancla (el promedio si son varias piezas).
      // Se dibuja aunque el ancla esté oculta.
      for (const b of puntosDeMarcador(m)) {
        const d = promedio(b.piezas.map((p) => objetivo(s, p)));
        puntos.push({
          id: m.id,
          lado: b.lado,
          pos: new THREE.Vector3(...b.posicion).add(new THREE.Vector3(...d)),
          aproximada: m.estado !== 'validada',
          propuesta: false,
        });
      }
    } else if (m.ancla) {
      // El ancla puede ser una estructura (sus lados) o una pieza de un solo lado (Wernicke, izquierda).
      const piezas = piezasDeAncla(m.ancla);
      if (!piezas.some((p) => visibles.has(p))) continue;
      const centros = piezas.flatMap((p) => {
        const c = cajasPiezas.get(p)?.getCenter(new THREE.Vector3());
        const lado = nodos[p]?.lado;
        return c ? [{ pos: c.add(new THREE.Vector3(...objetivo(s, p))), lado: lado === 'l' || lado === 'r' ? lado : null }] : [];
      });
      if (m.unir && centros.length) {
        // Línea media (rafe, área postrema): un punto entre los dos lados, no uno por lado.
        const medio = centros.reduce((a, c) => a.add(c.pos), new THREE.Vector3()).multiplyScalar(1 / centros.length);
        puntos.push({ id: m.id, lado: null, pos: medio, aproximada: true, propuesta: false });
      } else {
        for (const c of centros) puntos.push({ id: m.id, lado: c.lado, pos: c.pos, aproximada: true, propuesta: false });
      }
    }
  }
  for (const r of Object.values(respuestas)) {
    if (r.campo === 'posicion' && r.posicion) {
      puntos.push({ id: r.estructura, lado: null, pos: new THREE.Vector3(...r.posicion), aproximada: true, propuesta: true });
    }
  }
  return (
    <group ref={grupo}>
      {puntos.map((p, i) => (
        <mesh
          key={`${p.id}-${i}`}
          position={p.pos}
          userData={{ marcador: p.id, lado: p.lado, propuesta: p.propuesta }}
          renderOrder={5}
          onClick={(e) => {
            e.stopPropagation();
            useAtlas.getState().seleccionar({ entrada: p.id });
            window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: p.id } }));
          }}
        >
          <sphereGeometry args={[p.id === seleccion ? 0.0028 : 0.002, 16, 16]} />
          <meshBasicMaterial
            color={p.propuesta ? '#00a36c' : p.aproximada ? '#ff8c1a' : '#d6336c'}
            depthTest={p.id !== seleccion && !p.propuesta}
            transparent
          />
          {p.id === seleccion && (
            <Html center style={{ pointerEvents: 'none' }} position={[0, 0.006, 0]}>
              <div className="etiqueta-3d">{nombre(estructuras[p.id], idioma)}</div>
            </Html>
          )}
        </mesh>
      ))}
    </group>
  );
}


/** Caja de las piezas donde están ahora (posición original más su desplazamiento). */
function cajaDe(piezas: string[]): THREE.Box3 {
  const s = useAtlas.getState();
  const caja = new THREE.Box3();
  for (const p of piezas) {
    const c = cajasPiezas.get(p);
    if (c) caja.union(c.clone().translate(new THREE.Vector3(...objetivo(s, p))));
  }
  return caja;
}

function ControlCamara({ vistaInicial, camaraInicial }: { vistaInicial?: Vista; camaraInicial?: number[] }) {
  const controles = useRef<CameraControls>(null);
  const cargado = useAtlas((s) => s.cargado);
  const pedido = useAtlas((s) => s.camara);
  // Lo que tapa la parte de abajo del visor en celular: la hoja de la ficha o el panel del recorrido.
  const hoja = useAtlas((s) => Math.max(s.hoja, s.recorrido === null ? 0 : s.panelRecorrido));
  const { camera } = useThree();
  const tamano = useThree((s) => s.size);
  const obtener = useThree((s) => s.get);

  useEffect(() => {
    camaraActual.leer = () => {
      const c = controles.current;
      if (!c) return [];
      const pos = c.getPosition(new THREE.Vector3());
      const obj = c.getTarget(new THREE.Vector3());
      return [pos.x, pos.y, pos.z, obj.x, obj.y, obj.z];
    };
    camaraActual.objetivoEnPantalla = () => {
      const p = controles.current?.getTarget(new THREE.Vector3()).project(obtener().camera) ?? new THREE.Vector3();
      const { width, height } = obtener().size;
      return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
    };
    camaraActual.desfase = () => {
      const c = controles.current;
      if (!c) return Infinity;
      const destino = c.getPosition(new THREE.Vector3(), true);
      const mira = c.getTarget(new THREE.Vector3(), true).sub(destino).normalize();
      const cam = obtener().camera;
      return Math.max(cam.position.distanceTo(destino), cam.getWorldDirection(new THREE.Vector3()).distanceTo(mira));
    };
    camaraActual.piezaEnPantalla = (pieza) => {
      const caja = cajasPiezas.get(pieza);
      if (!caja) return null;
      const { camera: cam, size } = obtener();
      const casa = caja.getCenter(new THREE.Vector3());
      const actual = casa.clone().add(new THREE.Vector3(...objetivo(useAtlas.getState(), pieza)));
      return { casa: aPantalla(casa, cam, size.width, size.height), actual: aPantalla(actual, cam, size.width, size.height) };
    };
    return () => {
      camaraActual.leer = null;
      camaraActual.objetivoEnPantalla = null;
      camaraActual.piezaEnPantalla = null;
      camaraActual.desfase = null;
    };
  }, [obtener]);

  // En celular la ficha tapa la parte baja del visor: se corre la imagen hacia arriba para que lo que
  // se mira quede en la parte visible. No mueve ninguna pieza; solo cambia la ventana de la cámara.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dy = desfaseVerticalPx(hoja, tamano.height);
    if (dy > 0) cam.setViewOffset(tamano.width, tamano.height, 0, dy, tamano.width, tamano.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [camera, hoja, tamano.width, tamano.height]);

  const mirar = (direccion: [number, number, number], caja: THREE.Box3, animar: boolean) => {
    const c = controles.current;
    if (!c || caja.isEmpty()) return;
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = caja.getBoundingSphere(new THREE.Sphere()).radius;
    const cam = camera as THREE.PerspectiveCamera;
    const dist = distanciaEncuadre(radio, cam.fov ?? 40, cam.aspect ?? 1);
    const d = new THREE.Vector3(...direccion).normalize();
    void c.setLookAt(centro.x + d.x * dist, centro.y + d.y * dist, centro.z + d.z * dist, centro.x, centro.y, centro.z, animar && !reducirMovimiento());
  };

  useEffect(() => {
    if (!cargado) return;
    if (camaraInicial && camaraInicial.length === 6) {
      const [a, b, c, d, e, f] = camaraInicial as [number, number, number, number, number, number];
      void controles.current?.setLookAt(a, b, c, d, e, f, false);
      return;
    }
    const encefalo = piezasDeEntrada('g-brain');
    mirar(DIRECCIONES[vistaInicial ?? 'inicio'], cajaDe(encefalo), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado]);

  useEffect(() => {
    if (!pedido || !cargado) return;
    camaraActual.pedidosAplicados += 1;
    if (pedido.camara && pedido.camara.length === 6) {
      const [a, b, c, d, e, f] = pedido.camara as [number, number, number, number, number, number];
      void controles.current?.setLookAt(a, b, c, d, e, f, !reducirMovimiento());
    } else if (pedido.malla) {
      // Un trazo mide unos milímetros: la caja se agranda 1 cm para que la cámara no llegue a minDistance.
      const base = cajasMallas.get(pedido.malla);
      const pieza = piezaDeMalla(pedido.malla);
      const pos = controles.current?.getPosition(new THREE.Vector3());
      const obj = controles.current?.getTarget(new THREE.Vector3());
      if (base && pieza) {
        const caja = base.clone().translate(new THREE.Vector3(...objetivo(useAtlas.getState(), pieza))).expandByScalar(0.01);
        const dir: [number, number, number] = pos && obj ? (pos.sub(obj).normalize().toArray() as [number, number, number]) : DIRECCIONES.inicio;
        mirar(dir, caja, true);
      }
    } else if (pedido.encuadrar?.length && pedido.vista) {
      mirar(DIRECCIONES[pedido.vista], cajaDe(pedido.encuadrar), true);
    } else if (pedido.encuadrar?.length) {
      const caja = cajaDe(pedido.encuadrar);
      const pos = controles.current?.getPosition(new THREE.Vector3());
      const obj = controles.current?.getTarget(new THREE.Vector3());
      const dir: [number, number, number] = pos && obj ? (pos.sub(obj).normalize().toArray() as [number, number, number]) : DIRECCIONES.inicio;
      mirar(dir, caja, true);
    } else if (pedido.vista) {
      mirar(DIRECCIONES[pedido.vista], cajaDe(piezasDeEncuadre(useAtlas.getState())), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  return <CameraControls ref={controles} makeDefault minDistance={0.01} maxDistance={3} dollySpeed={0.6} />;
}

/** Baja el plano del recorrido hasta el nivel de la parada, con una animación corta. */
function RecorteRecorrido() {
  useFrame((_, dt) => {
    const s = useAtlas.getState();
    const parada = s.recorrido === null ? null : paradasVago[s.recorrido];
    if (!parada) {
      planoRecorrido.constant = SIN_RECORTE;
      return;
    }
    const nivel = nivelDeParada(parada, s.cajas);
    const destino = nivel === null ? -minimoVago(s.cajas) + 0.01 : -nivel;
    // Al empezar, el nervio arranca oculto desde su punto más alto y baja hasta la primera parada.
    if (planoRecorrido.constant >= SIN_RECORTE) planoRecorrido.constant = -maximoVago(s.cajas);
    const d = destino - planoRecorrido.constant;
    planoRecorrido.constant = reducirMovimiento() || Math.abs(d) < 1e-4 ? destino : planoRecorrido.constant + d * Math.min(1, dt * 3);
  });
  return null;
}

/** Pone los planos de corte del estado en los planos compartidos, una vez por cuadro. */
function PlanosCorte() {
  useFrame(() => {
    const s = useAtlas.getState();
    actualizarPlanos(s.cortes, rangoActual(s.cajas));
  });
  return null;
}

/** Solo pruebas E2E: se exponen en DEV desde src/main.tsx. Leen la escena, no el estado. */
export const cortesVisor: {
  planosDe: ((pieza: string) => number) | null;
  fantasmas: (() => string[]) | null;
  cajasMundo: (() => Record<string, number[]>) | null;
  /** Mallas de relleno en la escena (todas, visibles o no); con `pieza`, solo las de esa pieza. */
  rellenos: ((pieza?: string) => number) | null;
  /**
   * Punto en px CSS del viewport (listo para `page.mouse`), distinto de los px del lienzo de `piezaEnPantalla`.
   * `lado` 'corte' (por defecto): sobre la cara del corte; 'oculto': donde el rayo cruza la pieza solo del lado oculto.
   */
  puntoCorte: ((pieza: string, lado?: 'corte' | 'oculto') => { x: number; y: number } | null) | null;
  /** Líneas de contorno con segmentos en la escena (todas, visibles o no); con `pieza`, solo las de esa pieza. */
  contornos: ((pieza?: string) => number) | null;
  /** Geometrías vivas en la GPU del renderer (`gl.info.memory.geometries`): detecta lo que no se libera al desmontar. */
  geometrias: (() => number) | null;
} = { planosDe: null, fantasmas: null, cajasMundo: null, rellenos: null, puntoCorte: null, contornos: null, geometrias: null };

const seVeEnMundo = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

function AyudasCortes() {
  const obtener = useThree((s) => s.get);
  useEffect(() => {
    // Solo mallas de pieza (con `nombreMalla`): quedan fuera los fantasmas, los rellenos (`userData.relleno`, que llevan
    // el `nombreMalla` de su pieza) y las esferas de los marcadores.
    const mallasDePieza = () => {
      const res: { malla: THREE.Mesh; pieza: string; toque: boolean }[] = [];
      obtener().scene.traverse((o) => {
        const nombreMalla = o.userData.nombreMalla as string | undefined;
        const pieza = nombreMalla && !o.userData.fantasmaCorte && !o.userData.relleno ? piezaDeMalla(nombreMalla) : undefined;
        if ((o as THREE.Mesh).isMesh && pieza) res.push({ malla: o as THREE.Mesh, pieza, toque: esMallaDeToque(nombreMalla!) });
      });
      return res;
    };
    cortesVisor.planosDe = (pieza) => {
      const m = mallasDePieza().find((x) => x.pieza === pieza && !x.toque);
      return (m?.malla.material as THREE.Material | undefined)?.clippingPlanes?.length ?? 0;
    };
    cortesVisor.fantasmas = () => {
      const ids = new Set<string>();
      obtener().scene.traverse((o) => {
        if (o.userData.fantasmaCorte && seVeEnMundo(o)) ids.add(o.userData.pieza as string);
      });
      return [...ids].sort();
    };
    cortesVisor.cajasMundo = () => {
      const res: Record<string, THREE.Box3> = {};
      const vertices: Record<string, number> = {};
      for (const { malla, pieza, toque } of mallasDePieza()) {
        if (toque) continue;
        const caja = new THREE.Box3().setFromObject(malla);
        res[pieza] = res[pieza] ? res[pieza].union(caja) : caja;
        vertices[pieza] = (vertices[pieza] ?? 0) + malla.geometry.attributes.position!.count;
      }
      return Object.fromEntries(Object.entries(res).map(([p, c]) => [p, [...c.min.toArray(), ...c.max.toArray(), vertices[p]!]]));
    };
    cortesVisor.rellenos = (pieza) => {
      let n = 0;
      obtener().scene.traverse((o) => {
        if (o.userData.relleno !== true) return;
        if (pieza === undefined || piezaDeMalla(o.userData.nombreMalla as string) === pieza) n++;
      });
      return n;
    };
    cortesVisor.contornos = (pieza) => {
      let n = 0;
      obtener().scene.traverse((o) => {
        if (o.userData.contorno !== true) return;
        if (pieza !== undefined && o.userData.pieza !== pieza) return;
        if (((o as THREE.LineSegments).geometry.attributes.position?.count ?? 0) > 0) n++;
      });
      return n;
    };
    cortesVisor.geometrias = () => obtener().gl.info.memory.geometries;
    cortesVisor.puntoCorte = (pieza, lado = 'corte') => {
      if (!hayCortes(useAtlas.getState().cortes)) return null;
      const { camera, gl } = obtener();
      const candidatas: CandidataCorte[] = mallasDePieza()
        .filter((x) => !x.toque && seVeEnMundo(x.malla) && x.malla.raycast !== raycastNulo)
        .map((x) => ({ pieza: x.pieza, malla: x.malla, cortada: esEncefalo(x.pieza) }));
      const ndc = puntoDeCorte(pieza, candidatas, camera, PLANOS_CORTE, lado);
      if (!ndc) return null;
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((ndc.x + 1) / 2) * r.width, y: r.top + ((1 - ndc.y) / 2) * r.height };
    };
    return () => {
      cortesVisor.planosDe = null;
      cortesVisor.fantasmas = null;
      cortesVisor.cajasMundo = null;
      cortesVisor.rellenos = null;
      cortesVisor.puntoCorte = null;
      cortesVisor.contornos = null;
      cortesVisor.geometrias = null;
    };
  }, [obtener]);
  return null;
}

function alturasVago(cajas: Record<string, [Vec3, Vec3]>): number[][] {
  return Object.entries(cajas)
    .filter(([p]) => !esFragmentable(p))
    .map(([, c]) => [c[0][1], c[1][1]]);
}
const minimoVago = (cajas: Record<string, [Vec3, Vec3]>) => Math.min(...alturasVago(cajas).map((a) => a[0]!));
const maximoVago = (cajas: Record<string, [Vec3, Vec3]>) => Math.max(...alturasVago(cajas).map((a) => a[1]!));

function MedidorCuadros() {
  const acumulado = useRef({ cuadros: 0, tiempo: 0 });
  const marcado = useRef(false);
  // Vigilante de R8.2: con cortes y 10 muestras seguidas bajo 30 fps apaga el relleno, una sola vez.
  const vigilante = useRef<EstadoCuadros>({ bajas: 0, apagado: false });
  useFrame((_, dt) => {
    // Primer cuadro dibujado con el modelo ya cargado (medición de carga, issue 6).
    if (!marcado.current && useAtlas.getState().cargado) {
      marcado.current = true;
      performance.mark(MARCA_PRIMER_CUADRO);
    }
    // Solo E2E (DEV): sin GPU el navegador da pocos cuadros por segundo y apagaría el relleno que la prueba mira.
    const sinVigilante = import.meta.env.DEV && (window as unknown as { __sinVigilante?: boolean }).__sinVigilante === true;
    alCuadro(acumulado.current, dt, vigilante.current, useAtlas.getState(), (fps) => useMetricas.getState().setFps(fps), sinVigilante);
  });
  return null;
}

export default function Visor({ idioma, vistaInicial, camaraInicial }: { idioma: Idioma; vistaInicial?: Vista; camaraInicial?: number[] }) {
  const { t } = useTranslation();
  const ubicando = useAtlas((s) => s.ubicando);
  const cargado = useAtlas((s) => s.cargado);
  const inicioPuntero = useRef<{ x: number; y: number } | null>(null);
  const dpr = useDensidadAdaptativa();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Shift') useAtlas.getState().setShift(e.type === 'keydown');
    };
    const alSalir = () => useAtlas.getState().setShift(false);
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('keyup', alTeclear);
    window.addEventListener('blur', alSalir);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('keyup', alTeclear);
      window.removeEventListener('blur', alSalir);
    };
  }, []);

  return (
    <div
      className={`visor${ubicando ? ' visor-ubicando' : ''}`}
      data-testid="visor"
      onPointerDown={(e) => {
        inicioPuntero.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <BarreraVisor alReintentar={() => useGLTF.clear(URL_MODELO)}>
        {/* Aviso de carga fuera del lienzo: con <Html> de drei como fallback de Suspense, al desmontarse
            React lanzaba removeChild a mitad del montaje y en cargas lentas el visor podía quedar vacío. */}
        {!cargado && (
          <div className="cargando cargando-visor" role="status" data-testid="cargando">
            {t('visor.cargando')}
          </div>
        )}
        <Canvas
          camera={{ fov: 40, near: 0.002, far: 20, position: [0.5, 1.7, 0.5] }}
          dpr={dpr}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            configurarRenderer(gl, () => useAtlas.getState()); // recortes locales y shader que no compila (R3.4)
            useMetricas.getState().setGpu(nombreGpu(gl.getContext()));
          }}
          onPointerMissed={(e) => {
            const i = inicioPuntero.current;
            if (i && Math.hypot(e.clientX - i.x, e.clientY - i.y) > ARRASTRE_PX) return; // fue un arrastre
            const s = useAtlas.getState();
            if (s.ubicando) return;
            // Tocar el vacío deselecciona: la URL vuelve a /:lang para que el estado y la URL coincidan.
            window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: null } }));
          }}
        >
          <hemisphereLight args={['#ffffff', '#8a94a6', 1.1]} />
          <directionalLight position={[1, 3, 2]} intensity={1.6} />
          <directionalLight position={[-2, 1, -1]} intensity={0.6} />
          <Suspense fallback={null}>
            <Modelo idioma={idioma} />
            <Marcadores idioma={idioma} />
            <RutasTrazadas idioma={idioma} />
          </Suspense>
          <ControlCamara vistaInicial={vistaInicial} camaraInicial={camaraInicial} />
          <MedidorCuadros />
          <RecorteRecorrido />
          <PlanosCorte />
          <AyudasCortes />
        </Canvas>
      </BarreraVisor>
    </div>
  );
}

useGLTF.preload(URL_MODELO);
