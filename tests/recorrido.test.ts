// Recorrido guiado del vago (F14, ADR 0009): datos válidos, textos con fuente y niveles que bajan.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, type Caja as CajaBlender } from '../scripts/lib/modelo.ts';
import { esFragmentable, estructuras, mallaBase, nodos, piezasBajo, piezasDeEntrada } from '../src/data/atlas';
import type { Vec3 } from '../src/lib/explosion';
import type { Caja } from '../src/lib/inventario';
import { encuadreDeParada, nivelDeParada, paradasVago, piezasDelRecorrido } from '../src/lib/recorrido';
import { useAtlas } from '../src/store/useAtlas';

/** Caja de cada pieza en coordenadas glTF, desde pipeline/cajas.json (medida en Blender). */
function cajasReales(): Record<string, Caja> {
  const crudas = (JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, CajaBlender> }).cajas;
  const porMalla = new Map<string, number[][]>();
  for (const [nombre, caja] of Object.entries(crudas)) {
    if (nombre.endsWith('#toque')) continue;
    const base = mallaBase(nombre);
    porMalla.set(base, [...(porMalla.get(base) ?? []), cajaBlenderAGltf(caja)]);
  }
  const res: Record<string, Caja> = {};
  for (const n of Object.values(nodos)) {
    if (n.tipo !== 'pieza' || !n.malla) continue;
    const l = porMalla.get(n.malla);
    if (!l?.length) continue;
    const min: Vec3 = [Math.min(...l.map((c) => c[0]!)), Math.min(...l.map((c) => c[1]!)), Math.min(...l.map((c) => c[2]!))];
    const max: Vec3 = [Math.max(...l.map((c) => c[3]!)), Math.max(...l.map((c) => c[4]!)), Math.max(...l.map((c) => c[5]!))];
    res[n.id] = [min, max];
  }
  return res;
}

describe('recorrido del vago: datos', () => {
  it('cada parada apunta a entradas que existen, y la principal tiene ficha con fuentes', () => {
    expect(paradasVago.map((p) => p.id)).toEqual(['bulbo', 'cuello', 'torax', 'abdomen']);
    for (const p of paradasVago) {
      for (const id of [p.principal, ...p.relacionadas, ...p.encuadrar, ...(p.hasta ? [p.hasta.entrada] : [])]) {
        expect(estructuras[id], `${p.id}: ${id}`).toBeDefined();
      }
      const ficha = estructuras[p.principal]!.ficha;
      expect(ficha, p.principal).not.toBeNull();
      expect(ficha!.fuentes.length, p.principal).toBeGreaterThan(0);
      expect(ficha!.ubicacion.es && ficha!.ubicacion.en, p.principal).toBeTruthy();
      expect(encuadreDeParada(p).length, p.id).toBeGreaterThan(0);
    }
  });

  it('lo que queda nítido incluye los dos vagos, los núcleos del bulbo y los órganos de referencia', () => {
    const nitidas = new Set(piezasDelRecorrido());
    for (const p of [...piezasBajo('g-vagus-nerve-x'), ...piezasDeEntrada('nucleus-of-solitary-tract'), 'stomach', 'trachea']) {
      expect(nitidas.has(p), p).toBe(true);
    }
    expect(nitidas.has('hippocampus-l')).toBe(false);
  });
});

describe('recorrido del vago: revelado progresivo con el modelo real', () => {
  const cajas = cajasReales();

  it('cada parada baja: el nivel de una es más bajo que el de la anterior, y la última muestra el nervio completo', () => {
    const niveles = paradasVago.map((p) => nivelDeParada(p, cajas));
    expect(niveles.at(-1)).toBeNull();
    const conNivel = niveles.slice(0, -1) as number[];
    for (const n of conNivel) expect(n).toEqual(expect.any(Number));
    for (let i = 1; i < conNivel.length; i++) expect(conNivel[i]!).toBeLessThan(conNivel[i - 1]!);
  });

  it('los niveles caen dentro del vago: ninguna parada intermedia lo muestra completo ni lo esconde entero', () => {
    const vagos = piezasBajo('g-vagus-nerve-x').map((p) => cajas[p]!);
    const arriba = Math.max(...vagos.map((c) => c[1][1]));
    const abajo = Math.min(...vagos.map((c) => c[0][1]));
    for (const p of paradasVago.slice(0, -1)) {
      const n = nivelDeParada(p, cajas)!;
      expect(n, p.id).toBeLessThan(arriba);
      expect(n, p.id).toBeGreaterThan(abajo);
    }
  });
});

describe('recorrido del vago: estado', () => {
  beforeEach(() => {
    useAtlas.setState({ recorrido: null, aislar: null, explosion: 0.6, separadas: {}, devueltas: new Set(), ocultas: new Set(['thalamus-l']) });
  });

  it('iniciar arma el conjunto, deja el resto como fantasma y va a la primera parada; salir de aislar lo termina', () => {
    useAtlas.getState().iniciarRecorrido();
    let s = useAtlas.getState();
    expect(s.recorrido).toBe(0);
    expect(s.explosion).toBe(0);
    expect(s.ocultas.size).toBe(0);
    expect(s.aislar?.modo).toBe('contexto');
    expect(s.aislar?.piezas.has('vagus-nerve-x-r')).toBe(true);
    expect(s.camara?.encuadrar?.length).toBeGreaterThan(0);
    s.irAParada(99);
    expect(useAtlas.getState().recorrido).toBe(paradasVago.length - 1);
    useAtlas.getState().deseleccionar(); // tocar el vacío no corta el recorrido
    expect(useAtlas.getState().recorrido).toBe(paradasVago.length - 1);
    useAtlas.getState().salirAislar(); // Escape o "Mostrar todo"
    s = useAtlas.getState();
    expect(s.recorrido).toBeNull();
    expect(s.aislar).toBeNull();
  });

  it('el vago nunca es fragmentable', () => {
    for (const p of piezasBajo('g-vagus-nerve-x')) expect(esFragmentable(p)).toBe(false);
  });
});
