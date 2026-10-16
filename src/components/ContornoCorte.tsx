import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useAtlas } from '../store/useAtlas';
import { colorDePieza } from './colores';
import { crearLineaContorno, liberarContornos, mallasDeContorno, piezasConContorno, rangoActual, refrescarContorno, type MallaParaContorno } from './recorte';

/**
 * Contorno del corte (R3.3, R3.4): líneas con el color de la pieza donde los planos cortan sus mallas abiertas, o todas
 * las cortadas con el relleno apagado. Se suscribe a los campos crudos y calcula con useMemo: un selector que devuelva
 * un arreglo nuevo hace un bucle en zustand 5 (ver `FantasmaCorte`). `Modelo` lo monta solo con cortes activos.
 */
export default function ContornoCorte({ porPieza }: { porPieza: ReadonlyMap<string, readonly MallaParaContorno[]> }) {
  const cortes = useAtlas((s) => s.cortes);
  const rellenoApagado = useAtlas((s) => s.rellenoApagado);
  const ocultas = useAtlas((s) => s.ocultas);
  const aislar = useAtlas((s) => s.aislar);
  const soloEscaneada = useAtlas((s) => s.soloEscaneada);
  const cajas = useAtlas((s) => s.cajas);
  const ids = useMemo(
    () => piezasConContorno({ cortes, rellenoApagado, ocultas, aislar, soloEscaneada, cajas }),
    [cortes, rellenoApagado, ocultas, aislar, soloEscaneada, cajas],
  );
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => (
        <ContornoDePieza key={id} id={id} mallas={porPieza.get(id) ?? []} rellenoApagado={rellenoApagado} />
      ))}
    </>
  );
}

function ContornoDePieza({ id, mallas, rellenoApagado }: { id: string; mallas: readonly MallaParaContorno[]; rellenoApagado: boolean }) {
  const pares = useMemo(() => {
    const llevan = new Set(mallasDeContorno(mallas.map((m) => m.nombre), rellenoApagado));
    return mallas.filter((m) => llevan.has(m.nombre)).map((m) => ({ linea: crearLineaContorno(m.matriz, colorDePieza(id), id), geometria: m.geometria }));
  }, [id, mallas, rellenoApagado]);
  // La geometría y el material son de la línea; la geometría de la pieza se comparte y no se libera.
  useEffect(() => () => liberarContornos(pares.map((p) => p.linea)), [pares]);
  // Como máximo una vez por cuadro, y solo cuando cambia la referencia de `cortes` (o el rango).
  useFrame(() => {
    const s = useAtlas.getState();
    const rango = rangoActual(s.cajas);
    for (const p of pares) refrescarContorno(p.linea, p.geometria, s.cortes, rango);
  });
  return (
    <>
      {pares.map((p) => (
        <primitive key={p.linea.uuid} object={p.linea} />
      ))}
    </>
  );
}
