import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { arrancarIndice, avanzarIndice, colaDeIndice, PRESUPUESTO_INDICE_MS, programarTarea, type OpcionesIndice } from '../src/components/indiceToque';
import { construirBvh } from '../src/components/recorte';

/** Caja con `n` segmentos por lado: más segmentos, más triángulos. */
const caja = (n = 1) => new THREE.BoxGeometry(1, 1, 1, n, n, n);
const triangulos = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position!.count) / 3;

/** Reloj falso: cada lectura devuelve el siguiente valor (el último se repite). */
const reloj = (...valores: number[]) => {
  let i = 0;
  return () => valores[Math.min(i++, valores.length - 1)]!;
};

describe('cola del índice de toque (issue 178)', () => {
  it('una geometría compartida por dos mallas va una sola vez', () => {
    const g = caja();
    expect(colaDeIndice([g, g])).toEqual([g]);
  });

  it('las que ya tienen árbol no entran', () => {
    const con = caja();
    con.boundsTree = construirBvh(con);
    const sin = caja();
    expect(colaDeIndice([con, sin])).toEqual([sin]);
  });

  it('va de más a menos triángulos, con indexadas y no indexadas', () => {
    const chica = caja(1);
    const mediana = caja(2).toNonIndexed();
    const grande = caja(4);
    expect(triangulos(chica)).toBeLessThan(triangulos(mediana));
    expect(triangulos(mediana)).toBeLessThan(triangulos(grande));
    expect(colaDeIndice([chica, grande, mediana])).toEqual([grande, mediana, chica]);
  });

  it('a igual cantidad de triángulos conserva el orden de entrada', () => {
    const [a, b, c] = [caja(2), caja(2), caja(2)];
    expect(colaDeIndice([b, c, a])).toEqual([b, c, a]);
  });
});

describe('tandas del índice de toque (issue 178)', () => {
  it('con la cola vacía devuelve true y no construye nada', () => {
    expect(avanzarIndice([], 12, reloj(0))).toBe(true);
  });

  it('una geometría: le da árbol y devuelve true', () => {
    const g = caja();
    const cola = [g];
    expect(avanzarIndice(cola, 12, reloj(0, 1))).toBe(true);
    expect(g.boundsTree).toBeDefined();
    expect(cola).toEqual([]);
  });

  it('con varias se detiene al agotar el presupuesto y deja el resto en la cola', () => {
    const gs = [caja(), caja(), caja(), caja()];
    const cola = [...gs];
    // Lecturas: inicio 0, y después de cada árbol 5, 10, 15 (presupuesto 12): construye 3.
    expect(avanzarIndice(cola, 12, reloj(0, 5, 10, 15))).toBe(false);
    expect(gs.map((g) => g.boundsTree !== undefined)).toEqual([true, true, true, false]);
    expect(cola).toEqual([gs[3]]);
  });

  it('un solo árbol más largo que el presupuesto igual se arma: al menos uno por tanda', () => {
    const gs = [caja(), caja()];
    const cola = [...gs];
    expect(avanzarIndice(cola, 12, reloj(0, 100))).toBe(false);
    expect(gs.map((g) => g.boundsTree !== undefined)).toEqual([true, false]);
  });

  it('no reconstruye una geometría que recibió árbol mientras esperaba', () => {
    const g = caja();
    const cola = [g];
    const arbol = construirBvh(g);
    g.boundsTree = arbol;
    expect(avanzarIndice(cola, 12, reloj(0, 1))).toBe(true);
    expect(g.boundsTree).toBe(arbol);
  });

  it('las gemelas que comparten el índice quedan con índice propio (construirBvh, no new MeshBVH)', () => {
    const a = caja(2);
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', a.attributes.position!.clone());
    b.setIndex(a.index); // el mismo BufferAttribute, como el índice compartido del GLB
    expect(a.index).toBe(b.index);
    avanzarIndice([a, b], 1_000, reloj(0));
    expect(a.index).not.toBe(b.index);
    expect(a.index!.array).not.toBe(b.index!.array);
  });
});

describe('arranque del índice de toque (issue 178)', () => {
  /** Opciones con tareas falsas: `programar` y `esperar` encolan, `correr` ejecuta la primera tarea pendiente. */
  function montar(cola: THREE.BufferGeometry[], retenidoInicial = false) {
    const geometrias = [...cola];
    const arboles = () => geometrias.filter((g) => g.boundsTree !== undefined).length;
    const tareas: (() => void)[] = [];
    const llamadas = { programar: 0, esperar: 0, empezar: 0, terminar: 0 };
    const arbolesAl = { empezar: -1, terminar: -1 };
    const estado = { retenido: retenidoInicial };
    const o: OpcionesIndice = {
      presupuestoMs: PRESUPUESTO_INDICE_MS,
      // Cada lectura avanza 5 ms: dos árboles por tanda.
      ahora: (() => {
        let t = 0;
        return () => (t += 5);
      })(),
      programar: (fn) => {
        llamadas.programar++;
        tareas.push(fn);
      },
      esperar: (fn) => {
        llamadas.esperar++;
        tareas.push(fn);
      },
      retenido: () => estado.retenido,
      alEmpezar: () => {
        llamadas.empezar++;
        arbolesAl.empezar = arboles();
      },
      alTerminar: () => {
        llamadas.terminar++;
        arbolesAl.terminar = arboles();
      },
    };
    const cancelar = arrancarIndice(cola, o);
    const correr = () => tareas.shift()?.();
    return { cancelar, correr, tareas, llamadas, estado, arbolesAl };
  }
  const conArbol = (gs: THREE.BufferGeometry[]) => gs.filter((g) => g.boundsTree !== undefined).length;

  it('al llamarse no construye nada ni avisa: solo programa la primera tanda', () => {
    const gs = [caja(), caja()];
    const m = montar([...gs]);
    expect(conArbol(gs)).toBe(0);
    expect(m.llamadas).toEqual({ programar: 1, esperar: 0, empezar: 0, terminar: 0 });
  });

  it('avisa una vez al empezar, antes del primer árbol, y una vez al terminar, después del último', () => {
    const gs = [caja(), caja(), caja(), caja(), caja()];
    const m = montar([...gs]);
    m.correr();
    expect(m.llamadas.empezar).toBe(1);
    expect(m.arbolesAl.empezar).toBe(0);
    expect(conArbol(gs)).toBeGreaterThan(0);
    expect(m.llamadas.terminar).toBe(0);
    while (m.tareas.length) m.correr();
    expect(conArbol(gs)).toBe(5);
    expect(m.llamadas.empezar).toBe(1);
    expect(m.llamadas.terminar).toBe(1);
    expect(m.arbolesAl.terminar).toBe(5);
  });

  it('con el índice retenido no construye ni empieza, y espera en vez de programar; al soltarlo sigue y termina', () => {
    const gs = [caja(), caja()];
    const m = montar([...gs], true);
    m.correr();
    m.correr();
    expect(conArbol(gs)).toBe(0);
    expect(m.llamadas.empezar).toBe(0);
    expect(m.llamadas.esperar).toBe(2);
    expect(m.llamadas.programar).toBe(1); // solo la primera
    m.estado.retenido = false;
    while (m.tareas.length) m.correr();
    expect(conArbol(gs)).toBe(2);
    expect(m.llamadas.empezar).toBe(1);
    expect(m.llamadas.terminar).toBe(1);
  });

  it('cancelar entre dos tandas deja árboles sin construir y nunca avisa que terminó', () => {
    const gs = [caja(), caja(), caja(), caja(), caja()];
    const m = montar([...gs]);
    m.correr();
    const hechos = conArbol(gs);
    expect(hechos).toBeGreaterThan(0);
    expect(hechos).toBeLessThan(5);
    m.cancelar();
    while (m.tareas.length) m.correr();
    expect(conArbol(gs)).toBe(hechos);
    expect(m.llamadas.terminar).toBe(0);
  });

  it('con la cola vacía empieza y termina, una vez cada uno, en la primera tarea', () => {
    const m = montar([]);
    expect(m.llamadas.empezar).toBe(0);
    m.correr();
    expect(m.llamadas).toEqual({ programar: 1, esperar: 0, empezar: 1, terminar: 1 });
    expect(m.tareas).toHaveLength(0);
  });
});

describe('programarTarea (issue 178)', () => {
  it('corre la función como tarea, no en la misma llamada, y una sola vez', async () => {
    const fn = vi.fn();
    programarTarea(fn);
    expect(fn).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('sin MessageChannel usa setTimeout', async () => {
    vi.stubGlobal('MessageChannel', undefined);
    try {
      const fn = vi.fn();
      programarTarea(fn);
      expect(fn).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 20));
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
