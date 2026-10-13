// F25, origen de la geometría (ADR 0009): lo trazado se marca y se dibuja distinto de lo medido.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LLENO_PUNTEADO, PERIODO_PUNTEADO, punteado } from '../src/components/acabados';
import { nodos, origenDe, piezasAproximadas, todasLasPiezas } from '../src/data/atlas';

describe('origen de la geometría (F25)', () => {
  it('sin el campo, una pieza es escaneada; hoy no hay ninguna trazada', () => {
    expect(origenDe('thalamus-l')).toBe('escaneada');
    expect(origenDe('vagus-nerve-x-r')).toBe('escaneada');
    expect(piezasAproximadas).toEqual(todasLasPiezas.filter((p) => nodos[p]!.origen === 'aproximada'));
    expect(piezasAproximadas).toHaveLength(0);
  });

  it('el acabado punteado descarta los huecos en el shader estándar, después del recorte', () => {
    const shader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    punteado(shader);
    expect(shader.vertexShader).toContain('varying vec3 vPosMundo;');
    expect(shader.vertexShader).toContain('vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    expect(shader.fragmentShader).toContain('varying vec3 vPosMundo;');
    const linea = shader.fragmentShader.split('\n').find((l) => l.includes('discard') && l.includes('vPosMundo'));
    expect(linea).toContain(`/ ${PERIODO_PUNTEADO.toFixed(4)}`);
    expect(linea).toContain(`> ${LLENO_PUNTEADO.toFixed(2)}`);
    // Si three.js cambia los nombres de los includes, el reemplazo no ocurre y esta prueba lo dice.
    expect(shader.fragmentShader.indexOf('vPosMundo')).toBeLessThan(shader.fragmentShader.indexOf('discard'));
  });
});
