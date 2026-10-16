// Densidad de píxeles del visor (issue 84). Devuelve el valor de la prop `dpr` del <Canvas> y publica en
// useMetricas la densidad efectiva para el panel ?medir=1.
//
// El tope va por la prop y no con un `setDpr` interno (AdaptiveDpr, useThree): R3F reconfigura el root en
// cada render del <Canvas> y reaplica la prop `dpr`, así que un ajuste interno se perdería en el siguiente
// render de Visor. Con `?dpr=<n>` la densidad queda fija y no hay ajuste automático.
import { useEffect, useState } from 'react';
import { DENSIDAD_INICIAL, dprEfectivo, leerDprFijo, siguienteDensidad, topeDpr } from '../lib/densidad';
import { useAtlas } from '../store/useAtlas';
import { useMetricas } from './metricas';

export function useDensidadAdaptativa(): number | [number, number] {
  const [fijo] = useState(() => leerDprFijo(window.location.search));
  const [tope, setTope] = useState(() => topeDpr(DENSIDAD_INICIAL));

  useEffect(() => {
    const publicar = (d: number | [number, number]) => {
      const valor = dprEfectivo(d, window.devicePixelRatio);
      const actual = useMetricas.getState();
      if (actual.densidad !== valor || actual.densidadFija !== (fijo !== null)) actual.setDensidad(valor, fijo !== null);
    };
    publicar(fijo ?? [1, topeDpr(DENSIDAD_INICIAL)]);
    if (fijo !== null) {
      return () => useMetricas.getState().setDensidad(0, false);
    }
    let estado = DENSIDAD_INICIAL;
    const quitar = useMetricas.subscribe((s, antes) => {
      // Solo las muestras de cuadros por segundo: setPiezas, setGpu y el propio setDensidad no cuentan.
      if (s.muestras === antes.muestras) return;
      const valida = useAtlas.getState().cargado && document.visibilityState === 'visible';
      const sig = siguienteDensidad(estado, s.fps, valida);
      if (sig.nivel !== estado.nivel) setTope(topeDpr(sig));
      estado = sig;
      publicar([1, topeDpr(sig)]);
    });
    return () => {
      quitar();
      useMetricas.getState().setDensidad(0, false);
    };
  }, [fijo]);

  return fijo ?? [1, tope];
}
