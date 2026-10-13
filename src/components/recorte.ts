// Revelado progresivo del recorrido del vago (F14): un plano que deja ver el nervio solo por encima de
// la altura de la parada. Fuera del recorrido el plano queda muy abajo y no recorta nada.
import * as THREE from 'three';

/** Constante del plano que no recorta nada (el modelo está entre 1 y 2 m de altura). */
export const SIN_RECORTE = 100;

/** Normal hacia arriba: se ve lo que tiene y >= -constant. */
export const planoRecorrido = new THREE.Plane(new THREE.Vector3(0, 1, 0), SIN_RECORTE);

/** Altura visible ahora (null si no recorta); para las pruebas E2E. */
export function alturaRecorte(): number | null {
  return planoRecorrido.constant >= SIN_RECORTE ? null : -planoRecorrido.constant;
}
