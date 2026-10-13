// Acabados según el origen de la geometría (F25, ADR 0009). Lo trazado se ve distinto de lo medido
// sin tener que leer la leyenda: mate y punteado a lo largo, con huecos cada pocos milímetros.
import type * as THREE from 'three';

/** Largo del ciclo trazo + hueco, en metros (4 mm). */
export const PERIODO_PUNTEADO = 0.004;
/** Fracción del ciclo que se dibuja. */
export const LLENO_PUNTEADO = 0.55;

/** onBeforeCompile para MeshStandardMaterial: descarta los fragmentos de los huecos según la posición en el mundo. */
export function punteado(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;')
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>\nif (fract((vPosMundo.x + vPosMundo.y + vPosMundo.z) / ${PERIODO_PUNTEADO.toFixed(4)}) > ${LLENO_PUNTEADO.toFixed(2)}) discard;`,
    );
}
