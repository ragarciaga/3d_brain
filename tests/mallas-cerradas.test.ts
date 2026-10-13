// Mallas cerradas del encéfalo (SPEC R3.2, ADR 0011): medición, selección y comparación con la
// lista commiteada. No abre el GLB; la coincidencia con el GLB la verifica npm run check:modelo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compararMallasCerradas, mallasDelEncefalo, medirMalla, type MedidaMalla, type Primitiva } from '../scripts/lib/mallas.ts';
import type { Arbol, NodoArbol } from '../src/data/tipos.ts';

const V = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
const TETRA = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
const tetra = (): Primitiva => ({ posiciones: V, indices: TETRA });
/** Tetraedro sin índices (12 vértices) con un desplazamiento por copia de cara. */
const noIndexado = (d: number[]): Primitiva => {
  const pos: number[] = [];
  TETRA.forEach((v, i) => {
    const copia = Math.floor(i / 3);
    for (let k = 0; k < 3; k++) pos.push(V[v * 3 + k]! + (copia === 1 ? d[k]! : 0));
  });
  return { posiciones: pos, indices: null };
};

describe('mallas cerradas (R3.2)', () => {
  it('tetraedro indexado: cerrado', () => {
    expect(medirMalla([tetra()])).toEqual({ triangulos: 4, bordes: 0, cerrada: true });
  });

  it('sin una cara: abierto con 3 bordes', () => {
    const m = medirMalla([{ posiciones: V, indices: TETRA.slice(0, 9) }]);
    expect(m.bordes).toBe(3);
    expect(m.cerrada).toBe(false);
  });

  it('cerrada más un triángulo suelto: abierta', () => {
    const pos = [...V, 5, 5, 5, 6, 5, 5, 5, 6, 5];
    const m = medirMalla([{ posiciones: pos, indices: [...TETRA, 4, 5, 6] }]);
    expect(m.bordes).toBe(3);
    expect(m.cerrada).toBe(false);
  });

  it('arista usada por 3 triángulos no cuenta como borde', () => {
    // El triángulo extra (0, 1, 4) comparte la arista 0-1 (ya usada por 2 caras) y añade 2 aristas nuevas.
    const m = medirMalla([{ posiciones: [...V, 5, 5, 5], indices: [...TETRA, 0, 1, 4] }]);
    expect(m.bordes).toBe(2);
    expect(m.cerrada).toBe(false);
  });

  it('vértices que difieren menos de 5e-7 se sueldan', () => {
    expect(medirMalla([noIndexado([4e-7, 0, 0])]).cerrada).toBe(true);
    expect(medirMalla([noIndexado([-1e-7, 0, 1e-7])]).cerrada).toBe(true);
  });

  it('vértices corridos 1e-5 no se sueldan', () => {
    expect(medirMalla([noIndexado([1e-5, 0, 0])]).cerrada).toBe(false);
  });

  it('tetraedro repartido en dos primitivas: cerrado', () => {
    const a: Primitiva = { posiciones: V, indices: TETRA.slice(0, 6) };
    const b: Primitiva = { posiciones: V, indices: TETRA.slice(6) };
    expect(medirMalla([a, b])).toEqual({ triangulos: 4, bordes: 0, cerrada: true });
  });

  it('lista vacía no es cerrada', () => {
    expect(medirMalla([])).toEqual({ triangulos: 0, bordes: 0, cerrada: false });
  });

  it('una primitiva que no es TRIANGLES deja la malla no cerrada', () => {
    expect(medirMalla([tetra(), { ...tetra(), modo: 1 }]).cerrada).toBe(false);
  });
});

const nodo = (id: string, extra: Partial<NodoArbol>): NodoArbol => ({ id, tipo: 'grupo', en: id, padre: null, hijos: [], ...extra });
const pieza = (id: string, malla: string, clase: 'estudio' | 'referencia' = 'estudio'): NodoArbol =>
  nodo(id, { tipo: 'pieza', malla, clase });

function arbolMinimo(): Arbol {
  const nodos = [
    nodo('g-brain', { hijos: ['g-cx', 'p-ref', 'g-brainstem', 'p-toque', 'g-vagus-nerve-x'] }),
    nodo('g-cx', { hijos: ['g-lobulo'] }),
    nodo('g-lobulo', { hijos: ['p-a', 'p-sulco'] }),
    pieza('p-a', 'Gyrus A.l'),
    pieza('p-sulco', ' Sulcus.l'),
    pieza('p-ref', 'Referencia.l', 'referencia'),
    nodo('g-brainstem', { hijos: ['p-nuc'] }),
    pieza('p-nuc', 'Posterior nucleus of vagus nerve.l'),
    pieza('p-toque', 'Vagus nerve#toque'),
    nodo('g-vagus-nerve-x', { hijos: ['p-vago'] }),
    pieza('p-vago', 'Vagus nerve.l'),
    nodo('g-organos-referencia', { hijos: ['p-trq'] }),
    pieza('p-trq', 'Trachea'),
  ];
  return {
    fuente: 'x',
    raices: ['g-brain', 'g-vagus-nerve-x', 'g-organos-referencia'],
    nodos: Object.fromEntries(nodos.map((n) => [n.id, n])),
  };
}

describe('mallasDelEncefalo (R3.2)', () => {
  it('toma piezas de estudio anidadas y excluye referencia, #toque, vago y órganos', () => {
    expect(mallasDelEncefalo(arbolMinimo())).toEqual(['Gyrus A.l', ' Sulcus.l', 'Posterior nucleus of vagus nerve.l']);
  });

  it('lanza en español si no hay g-brain', () => {
    const a = arbolMinimo();
    delete a.nodos['g-brain'];
    expect(() => mallasDelEncefalo(a)).toThrow(/g-brain/);
  });
});

describe('compararMallasCerradas (R3.2)', () => {
  const cer: MedidaMalla = { triangulos: 4, bordes: 0, cerrada: true };
  const abi: MedidaMalla = { triangulos: 3, bordes: 3, cerrada: false };
  const medidas = { A: cer, B: abi };
  const glb = ['A', 'B', 'Trachea'];

  it('igual: sin errores', () => {
    expect(compararMallasCerradas(['A'], medidas, glb)).toEqual([]);
  });

  it('reporta con su nombre la que falta', () => {
    expect(compararMallasCerradas([], medidas, glb)).toEqual(['Falta en mallas-cerradas.json (cerrada en el GLB): A']);
  });

  it('reporta con su nombre la que sobra', () => {
    expect(compararMallasCerradas(['A', 'B'], medidas, glb)).toEqual([
      'Sobra en mallas-cerradas.json (tiene 3 bordes abiertos en el GLB): B',
    ]);
  });

  it('reporta la listada que no existe en el GLB', () => {
    expect(compararMallasCerradas(['A', 'Z'], medidas, glb)).toEqual([
      'mallas-cerradas.json nombra una malla que no existe en el GLB: Z',
    ]);
  });

  it('reporta la listada que no es pieza de estudio del encéfalo', () => {
    expect(compararMallasCerradas(['A', 'Trachea'], medidas, glb)).toEqual([
      'mallas-cerradas.json nombra una malla que no es pieza de estudio del encéfalo: Trachea',
    ]);
  });
});

describe('src/config/mallas-cerradas.json (contrato)', () => {
  const lista = JSON.parse(readFileSync('src/config/mallas-cerradas.json', 'utf8')) as unknown;
  const arbol = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')) as Arbol;

  it('es un arreglo de strings ordenado y sin repetidos', () => {
    expect(Array.isArray(lista)).toBe(true);
    const nombres = lista as string[];
    expect(nombres.every((n) => typeof n === 'string')).toBe(true);
    expect(nombres).toEqual([...nombres].sort());
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('cada nombre es una malla del encéfalo en arbol.json', () => {
    const validas = new Set(mallasDelEncefalo(arbol));
    for (const n of lista as string[]) expect(validas.has(n), n).toBe(true);
  });
});
