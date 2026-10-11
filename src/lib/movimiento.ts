// "Reducir movimiento" del sistema (prefers-reduced-motion). Se lee una sola vez y se actualiza con
// el evento change: el visor lo consulta por pieza y por cuadro, y matchMedia es caro para eso.

interface ConsultaMedios {
  matches: boolean;
  addEventListener(tipo: 'change', f: (e: { matches: boolean }) => void): void;
}

export type FabricaConsulta = ((consulta: string) => ConsultaMedios) | undefined;

export function crearLectorMovimiento(matchMedia: FabricaConsulta): () => boolean {
  const mq = matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let reducido = !!mq?.matches;
  mq?.addEventListener('change', (e) => {
    reducido = e.matches;
  });
  return () => reducido;
}
