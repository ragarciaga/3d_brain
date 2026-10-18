// Rutas trazadas del vago en 3D (ADR 0009, SPEC F25): mate y punteadas, para que no se confundan con
// lo escaneado. Se ven con su estado de revisión; los docentes las juzgan en la ficha con F24. En el lanzamiento
// docente no hay ninguna (Plan B, ADR 0010): el vago torácico queda como hueco, que dice la leyenda.
// El plano del recorrido también las corta, como al resto del vago.
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Idioma } from '../data/tipos';
import { cargarRutas, type RutaTrazada } from '../lib/rutas';
import { useAtlas } from '../store/useAtlas';
import { punteado } from './acabados';
import { colorDePieza } from './colores';
import { planoRecorrido } from './recorte';

/** Radio de la malla invisible para tocar la ruta (el mismo de los nervios, pipeline/extraer.py). */
const RADIO_TOQUE = 0.003;
const PLANOS = [planoRecorrido];
const COLOR = colorDePieza('vagus-nerve-x-l');

/** Lo que una ruta dibuja ahora mismo, leído de la escena (solo pruebas E2E). */
export interface RutaDibujada {
  id: string;
  punteado: boolean;
  cortadaPorRecorrido: boolean;
  /** Un punto de la ruta que se puede tocar (px CSS del viewport), o nulo si ninguno queda a la vista y sin nada delante. */
  enPantalla: { x: number; y: number } | null;
}

/** Solo pruebas E2E: se expone en DEV desde src/main.tsx. */
export const rutasDePrueba: { dibujadas: (() => RutaDibujada[]) | null } = { dibujadas: null };

/** Fracciones de la curva que se prueban como punto tocable. */
const CANDIDATOS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

function Ruta({ ruta, idioma }: { ruta: RutaTrazada; idioma: Idioma }) {
  const [encima, setEncima] = useState(false);
  const seleccionada = useAtlas((s) => s.seleccion.entrada === ruta.entrada);
  const { visible, toque, mitad, curva } = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3(ruta.puntos.map((p) => new THREE.Vector3(...p)));
    const segmentos = Math.max(16, ruta.puntos.length);
    return {
      visible: new THREE.TubeGeometry(curva, segmentos, ruta.radio[0], 8, false),
      toque: new THREE.TubeGeometry(curva, Math.ceil(segmentos / 2), RADIO_TOQUE, 6, false),
      mitad: curva.getPoint(0.5),
      curva,
    };
  }, [ruta]);
  useEffect(
    () => () => {
      visible.dispose();
      toque.dispose();
    },
    [visible, toque],
  );

  const alTocar = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useAtlas.getState().seleccionar({ entrada: ruta.entrada });
    window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: ruta.entrada } }));
  };

  return (
    <group
      onClick={alTocar}
      onPointerOver={(e) => {
        e.stopPropagation();
        setEncima(true);
      }}
      onPointerOut={() => setEncima(false)}
      userData={{ rutaTrazada: ruta.id, curva }}
    >
      <mesh geometry={visible} userData={{ rutaVisible: true }}>
        <meshStandardMaterial
          color={COLOR}
          roughness={1}
          metalness={0}
          onBeforeCompile={punteado}
          customProgramCacheKey={() => 'punteado'}
          clippingPlanes={PLANOS}
          emissive={seleccionada ? '#3c83f6' : encima ? '#444444' : '#000000'}
          emissiveIntensity={seleccionada ? 0.55 : 0.35}
        />
      </mesh>
      <mesh geometry={toque} renderOrder={3}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {encima && (
        <Html position={mitad} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="etiqueta-3d">{ruta.nombre[idioma]}</div>
        </Html>
      )}
    </group>
  );
}

export default function RutasTrazadas({ idioma }: { idioma: Idioma }) {
  const rutas = useAtlas((s) => s.rutas);
  // Como el vago: fuera en el inventario (no se desarma) y con el filtro "solo escaneada".
  const ocultas = useAtlas((s) => s.soloEscaneada || s.inventario || (s.aislar?.modo === 'solo' && s.recorrido === null));
  const obtener = useThree((s) => s.get);

  useEffect(() => {
    rutasDePrueba.dibujadas = () => {
      const { scene, camera, gl } = obtener();
      const caja = gl.domElement.getBoundingClientRect();
      const todas = useAtlas.getState().rutas;
      const lista: RutaDibujada[] = [];
      scene.traverse((obj) => {
        const u = obj.userData as { rutaTrazada?: string; curva?: THREE.Curve<THREE.Vector3> };
        if (!u.rutaTrazada || !u.curva) return;
        const id = u.rutaTrazada;
        const curva = u.curva;
        const malla = obj.children.find((h) => (h.userData as { rutaVisible?: boolean }).rutaVisible) as THREE.Mesh | undefined;
        const material = malla?.material as THREE.Material | undefined;
        // Más lejos de las otras rutas primero: en un empalme el rayo daría con la ruta vecina.
        const otras = todas.filter((r) => r.id !== id).flatMap((r) => r.puntos.map((p) => new THREE.Vector3(...p)));
        const holgura = (v: THREE.Vector3) => otras.reduce((m, o) => Math.min(m, o.distanceTo(v)), Infinity);
        const candidatos = CANDIDATOS.map((t) => curva.getPoint(t)).sort((a, b) => holgura(b) - holgura(a));
        let enPantalla: RutaDibujada['enPantalla'] = null;
        for (const punto of candidatos) {
          const ndc = punto.clone().project(camera);
          if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) continue;
          const rayo = new THREE.Raycaster();
          rayo.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
          const impacto = rayo.intersectObjects(scene.children, true)[0];
          let ancestro: THREE.Object3D | null = impacto?.object ?? null;
          while (ancestro && (ancestro.userData as { rutaTrazada?: string }).rutaTrazada !== id) ancestro = ancestro.parent;
          if (!ancestro) continue;
          enPantalla = { x: caja.left + ((ndc.x + 1) / 2) * caja.width, y: caja.top + ((1 - ndc.y) / 2) * caja.height };
          break;
        }
        lista.push({
          id,
          punteado: (material as THREE.MeshStandardMaterial | undefined)?.onBeforeCompile === punteado,
          cortadaPorRecorrido: material?.clippingPlanes?.includes(planoRecorrido) ?? false,
          enPantalla,
        });
      });
      return lista;
    };
    return () => {
      rutasDePrueba.dibujadas = null;
    };
  }, [obtener]);

  useEffect(() => {
    let vigente = true;
    void cargarRutas(import.meta.env.BASE_URL).then((r) => {
      if (!vigente) return;
      useAtlas.getState().setRutas(r.rutas);
      useAtlas.getState().setHuecos(r.huecos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (ocultas) return null;
  return (
    <>
      {rutas.map((r) => (
        <Ruta key={r.id} ruta={r} idioma={idioma} />
      ))}
    </>
  );
}
