// Rutas trazadas del vago en 3D (ADR 0009, SPEC F25): mate y punteadas, para que no se confundan con
// lo escaneado. En revisión solo las ven los revisores, que las juzgan en la ficha con F24. El plano
// del recorrido también las corta, como al resto del vago.
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Idioma } from '../data/tipos';
import { cargarRutas, rutaVisible, type RutaTrazada } from '../lib/rutas';
import { useAtlas } from '../store/useAtlas';
import { punteado } from './acabados';
import { colorDePieza } from './colores';
import { planoRecorrido } from './recorte';

/** Radio de la malla invisible para tocar la ruta (el mismo de los nervios, pipeline/extraer.py). */
const RADIO_TOQUE = 0.003;
const PLANOS = [planoRecorrido];
const COLOR = colorDePieza('vagus-nerve-x-l');

function Ruta({ ruta, idioma }: { ruta: RutaTrazada; idioma: Idioma }) {
  const [encima, setEncima] = useState(false);
  const seleccionada = useAtlas((s) => s.seleccion.entrada === ruta.entrada);
  const { visible, toque, mitad } = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3(ruta.puntos.map((p) => new THREE.Vector3(...p)));
    const segmentos = Math.max(16, ruta.puntos.length);
    return {
      visible: new THREE.TubeGeometry(curva, segmentos, ruta.radio[0], 8, false),
      toque: new THREE.TubeGeometry(curva, Math.ceil(segmentos / 2), RADIO_TOQUE, 6, false),
      mitad: curva.getPoint(0.5),
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
      userData={{ rutaTrazada: ruta.id }}
    >
      <mesh geometry={visible}>
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
  const revisor = useAtlas((s) => !!s.revisor);
  // Como el vago: fuera en el inventario (no se desarma) y con el filtro "solo escaneada".
  const ocultas = useAtlas((s) => s.soloEscaneada || s.inventario || (s.aislar?.modo === 'solo' && s.recorrido === null));

  useEffect(() => {
    let vigente = true;
    void cargarRutas(import.meta.env.BASE_URL).then((r) => {
      if (vigente) useAtlas.getState().setRutas(r);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (ocultas) return null;
  return (
    <>
      {rutas
        .filter((r) => rutaVisible(r, revisor))
        .map((r) => (
          <Ruta key={r.id} ruta={r} idioma={idioma} />
        ))}
    </>
  );
}
