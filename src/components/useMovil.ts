// Si la pantalla es de celular: el mismo punto de corte que el CSS (max-width: 900px).
import { useSyncExternalStore } from 'react';

export const CONSULTA_MOVIL = '(max-width: 900px)';

function suscribir(avisar: () => void): () => void {
  const mq = window.matchMedia(CONSULTA_MOVIL);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

export function useMovil(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA_MOVIL).matches,
    () => false,
  );
}
