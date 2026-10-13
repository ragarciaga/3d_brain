// Abre un trazo del vago: lo selecciona, lo encuadra y lleva a la ficha del vago. La usan la sección
// "Trazos del vago" de "Qué revisar" y el botón "Siguiente trazo" del panel del trazo.
import { ENTRADA_VAGO } from '../lib/trazos';
import { useAtlas } from '../store/useAtlas';

/**
 * Misma ruta que un toque en el visor (`atlas:seleccion`): `Pagina` navega a la ficha sin llamar a
 * `resaltar`, que borraría `seleccion.malla`. `enfocar` lleva el foco al título de la ficha; se pide
 * después del evento porque `Pagina` lo pone en null.
 */
export function irATrazo(malla: string, { enfocar }: { enfocar: boolean }) {
  useAtlas.getState().abrirTrazo(malla);
  window.dispatchEvent(new CustomEvent('atlas:seleccion', { detail: { entrada: ENTRADA_VAGO } }));
  if (enfocar) useAtlas.getState().pedirFocoFicha(ENTRADA_VAGO);
}
