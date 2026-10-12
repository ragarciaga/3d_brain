// Visor 3D (F1). Cada pieza se dibuja con la transformación original del GLB, sin tocarla, dentro de
// un grupo cuyo único papel es sumar el desplazamiento de fragmentar (F6, F7).
import { CameraControls, Html, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import {
  esMallaDeToque,
  estructuras,
  marcadores,
  nodos,
  piezaDeMalla,
  piezasDeEntrada,
  trazoDeMalla,
} from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { acercar, CERO, type Vec3 } from '../lib/explosion';
import type { Vista } from '../lib/enlaces';
import { MARCA_MODELO_LISTO, MARCA_PRIMER_CUADRO } from '../lib/medicion';
import { crearLectorMovimiento } from '../lib/movimiento';
import { DIRECCIONES, desfaseVerticalPx, distanciaEncuadre, esSeleccionable } from '../lib/vistas';
import { nombrePieza, nombreVisible } from '../lib/nombres';
import { fueraDeSitio, objetivo, piezasDeEncuadre, piezasSeleccionadas, piezasVisibles, useAtlas } from '../store/useAtlas';
import BarreraVisor from './BarreraVisor';
import { colorDePieza } from './colores';
import { useMetricas } from './metricas';

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
} = { leer: null, objetivoEnPantalla: null, piezaEnPantalla: null };

const raycastNulo = () => null;

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
  // En el inventario (F6) los órganos de referencia no se mueven y quedarían encima de las repisas: se ocultan.
  const visible = useAtlas(
    (s) =>
      !s.ocultas.has(id) &&
      (!s.aislar || s.aislar.piezas.has(id) || s.aislar.modo === 'contexto') &&
      !(referencia && s.inventario),
  );
  const fantasma = useAtlas((s) => !!s.aislar && s.aislar.modo === 'contexto' && !s.aislar.piezas.has(id));
  const seleccionada = useAtlas((s) => piezasSeleccionadas(s.seleccion).includes(id));
  const mallaSel = useAtlas((s) => s.seleccion.malla);
  const ubicando = useAtlas((s) => !!s.ubicando);
  const revisando = useAtlas((s) => !!s.revisor);
  const shift = useAtlas((s) => s.shift);
  const [encima, setEncima] = useState(false);

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
      s.responder({
        estructura: s.ubicando,
        campo: 'posicion',
        veredicto: 'corregir',
        posicion: p.map((v) => Number(v.toFixed(5))) as [number, number, number],
        version: est?.ficha?.version ?? 'sin-ficha',
        fecha: new Date().toISOString(),
      });
      s.setUbicando(null);
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
            raycast={seleccionable ? acceleratedRaycast : raycastNulo}
            userData={{ nombreMalla: m.nombre }}
            renderOrder={referencia ? 2 : m.toque ? 3 : 0}
          >
            {m.toque ? (
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            ) : (
              <meshStandardMaterial
                color={esTrazoSel ? '#ff5a1f' : color}
                roughness={0.65}
                metalness={0}
                transparent={referencia || fantasma}
                opacity={referencia ? 0.18 : fantasma ? 0.08 : 1}
                depthWrite={!(referencia || fantasma)}
                emissive={seleccionada ? '#3c83f6' : encima ? '#444444' : '#000000'}
                emissiveIntensity={seleccionada ? 0.55 : 0.35}
              />
            )}
          </mesh>
        );
      })}
      {encima && (
        <Html position={centroLocal(mallas)} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="etiqueta-3d">{nombrePieza(id, idioma, useAtlas.getState().ambos, t)}</div>
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

  const porPieza = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const res = new Map<string, MallaCargada[]>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const nombre = (o.userData.name as string | undefined) ?? o.name;
      const pieza = piezaDeMalla(nombre);
      if (!pieza) return;
      // Árbol de intersección para tocar rápido aun con un millón de triángulos.
      if (!mesh.geometry.boundsTree) mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
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
    return res;
  }, [gltf]);

  useEffect(() => {
    const centros: Record<string, Vec3> = {};
    const cajas: Record<string, [Vec3, Vec3]> = {};
    cajasPiezas.clear();
    for (const [pieza, mallas] of porPieza) {
      const caja = new THREE.Box3();
      for (const m of mallas) {
        if (m.toque) continue;
        if (!m.geometria.boundingBox) m.geometria.computeBoundingBox();
        caja.union(m.geometria.boundingBox!.clone().applyMatrix4(m.matriz));
      }
      cajasPiezas.set(pieza, caja);
      const c = caja.getCenter(new THREE.Vector3());
      centros[pieza] = [c.x, c.y, c.z];
      cajas[pieza] = [caja.min.toArray(), caja.max.toArray()];
    }
    useMetricas.getState().setPiezas(porPieza.size);
    setCentros(centros, cajas);
    if (!performance.getEntriesByName(MARCA_MODELO_LISTO).length) performance.mark(MARCA_MODELO_LISTO);
  }, [porPieza, setCentros]);

  return (
    <>
      {[...porPieza.entries()].map(([id, mallas]) => (
        <Pieza key={id} id={id} mallas={mallas} idioma={idioma} />
      ))}
    </>
  );
}

/** Marcadores (SPEC sección 6): lo que no tiene malla. Solo se dibujan los que tienen posición. */
function Marcadores({ idioma }: { idioma: Idioma }) {
  const cargado = useAtlas((s) => s.cargado);
  const seleccion = useAtlas((s) => s.seleccion.entrada);
  const ambos = useAtlas((s) => s.ambos);
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
  const puntos: { id: string; pos: THREE.Vector3; aproximada: boolean; propuesta: boolean }[] = [];
  for (const m of marcadores) {
    if (m.posicion) {
      puntos.push({ id: m.id, pos: new THREE.Vector3(...m.posicion), aproximada: m.estado !== 'validada', propuesta: false });
    } else if (m.ancla) {
      const piezas = piezasDeEntrada(m.ancla);
      if (!piezas.some((p) => visibles.has(p))) continue;
      const s = useAtlas.getState();
      for (const p of piezas) {
        const c = cajasPiezas.get(p)?.getCenter(new THREE.Vector3());
        if (c) puntos.push({ id: m.id, pos: c.add(new THREE.Vector3(...objetivo(s, p))), aproximada: true, propuesta: false });
      }
    }
  }
  for (const r of Object.values(respuestas)) {
    if (r.campo === 'posicion' && r.posicion) {
      puntos.push({ id: r.estructura, pos: new THREE.Vector3(...r.posicion), aproximada: true, propuesta: true });
    }
  }
  return (
    <>
      {puntos.map((p, i) => (
        <mesh
          key={`${p.id}-${i}`}
          position={p.pos}
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
              <div className="etiqueta-3d">{nombreVisible(estructuras[p.id], idioma, ambos)}</div>
            </Html>
          )}
        </mesh>
      ))}
    </>
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
  const hoja = useAtlas((s) => s.hoja);
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
    if (pedido.camara && pedido.camara.length === 6) {
      const [a, b, c, d, e, f] = pedido.camara as [number, number, number, number, number, number];
      void controles.current?.setLookAt(a, b, c, d, e, f, !reducirMovimiento());
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

function MedidorCuadros() {
  const acumulado = useRef({ cuadros: 0, tiempo: 0 });
  const marcado = useRef(false);
  useFrame((_, dt) => {
    // Primer cuadro dibujado con el modelo ya cargado (medición de carga, issue 6).
    if (!marcado.current && useAtlas.getState().cargado) {
      marcado.current = true;
      performance.mark(MARCA_PRIMER_CUADRO);
    }
    const a = acumulado.current;
    a.cuadros += 1;
    a.tiempo += dt;
    if (a.tiempo >= 0.5) {
      useMetricas.getState().setFps(Math.round(a.cuadros / a.tiempo));
      a.cuadros = 0;
      a.tiempo = 0;
    }
  });
  return null;
}

export default function Visor({ idioma, vistaInicial, camaraInicial }: { idioma: Idioma; vistaInicial?: Vista; camaraInicial?: number[] }) {
  const { t } = useTranslation();
  const ubicando = useAtlas((s) => s.ubicando);
  const cargado = useAtlas((s) => s.cargado);
  const inicioPuntero = useRef<{ x: number; y: number } | null>(null);

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
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => useMetricas.getState().setGpu(nombreGpu(gl.getContext()))}
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
          </Suspense>
          <ControlCamara vistaInicial={vistaInicial} camaraInicial={camaraInicial} />
          <MedidorCuadros />
        </Canvas>
      </BarreraVisor>
    </div>
  );
}

useGLTF.preload(URL_MODELO);
