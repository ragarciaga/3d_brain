import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, type Caja as CajaBlender } from '../scripts/lib/modelo.ts';
import { mallaBase, nodos, piezasBajo } from '../src/data/atlas';
import { desplazamientosExplosion, type Lado, type Vec3 } from '../src/lib/explosion';
import {
  desplazamientosDeslizador,
  desplazamientosInventario,
  INICIO_INVENTARIO,
  MINIMO_BLOQUES_INVENTARIO,
  SEPARACION_INVENTARIO,
  type Caja,
} from '../src/lib/inventario';
import { bloqueDe, grupoInventario, ladoDe } from '../src/store/useAtlas';

// Datos reales: cajas de pipeline/cajas.json en coordenadas glTF.
const crudas = (JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, CajaBlender> }).cajas;

function datosReales() {
  const porMalla = new Map<string, CajaBlender[]>();
  for (const [nombre, caja] of Object.entries(crudas)) {
    if (nombre.endsWith('#toque')) continue;
    const base = mallaBase(nombre);
    porMalla.set(base, [...(porMalla.get(base) ?? []), cajaBlenderAGltf(caja)]);
  }
  const centros: Record<string, Vec3> = {};
  const cajas: Record<string, Caja> = {};
  for (const n of Object.values(nodos)) {
    if (n.tipo !== 'pieza' || !n.malla) continue;
    const l = porMalla.get(n.malla);
    if (!l?.length) continue;
    const min: Vec3 = [Math.min(...l.map((c) => c[0])), Math.min(...l.map((c) => c[1])), Math.min(...l.map((c) => c[2]))];
    const max: Vec3 = [Math.max(...l.map((c) => c[3])), Math.max(...l.map((c) => c[4])), Math.max(...l.map((c) => c[5]))];
    cajas[n.id] = [min, max];
    centros[n.id] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  }
  return { centros, cajas };
}

const { centros, cajas } = datosReales();
const encefalo = piezasBajo('g-brain').filter((p) => nodos[p]!.clase === 'estudio');
const visibles = [...encefalo, ...piezasBajo('g-vagus-nerve-x')];
const niveles = ['piezas', 'lobulos', 'hemisferios'] as const;

/** Caja de cada bloque ya movido al inventario. */
function cajasMovidas(d: Record<string, Vec3>, nivel: (typeof niveles)[number]) {
  const res = new Map<string, Caja>();
  for (const p of visibles) {
    const [a, b] = cajas[p]!;
    const t = d[p]!;
    const lo: Vec3 = [a[0] + t[0], a[1] + t[1], a[2] + t[2]];
    const hi: Vec3 = [b[0] + t[0], b[1] + t[1], b[2] + t[2]];
    const k = bloqueDe(p, nivel);
    const q = res.get(k);
    if (!q) res.set(k, [lo, hi]);
    else res.set(k, [lo.map((v, i) => Math.min(v, q[0][i]!)) as Vec3, hi.map((v, i) => Math.max(v, q[1][i]!)) as Vec3]);
  }
  return res;
}

describe('inventario (F6)', () => {
  it.each(niveles)('nivel %s: ningún bloque se monta sobre otro en el plano frontal', (nivel) => {
    const d = desplazamientosInventario(centros, cajas, visibles, (p) => bloqueDe(p, nivel), grupoInventario, ladoDe);
    const lista = [...cajasMovidas(d, nivel)];
    const margen = SEPARACION_INVENTARIO / 2;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const [ka, [a0, a1]] = lista[i]!;
        const [kb, [b0, b1]] = lista[j]!;
        const enX = a0[0] < b1[0] - margen && b0[0] < a1[0] - margen;
        const enY = a0[1] < b1[1] - margen && b0[1] < a1[1] - margen;
        expect(enX && enY, `${ka} y ${kb}`).toBe(false);
      }
    }
  });

  it.each(niveles)('nivel %s: la izquierda queda en +X, la derecha en -X, y cada par en espejo (D4)', (nivel) => {
    const d = desplazamientosInventario(centros, cajas, visibles, (p) => bloqueDe(p, nivel), grupoInventario, ladoDe);
    const x = (p: string) => centros[p]![0] + d[p]![0];
    for (const p of visibles) {
      if (ladoDe(p) === 'l') expect(x(p), p).toBeGreaterThan(0);
      if (ladoDe(p) === 'r') expect(x(p), p).toBeLessThan(0);
    }
    for (const [l, r] of [['thalamus-l', 'thalamus-r'], ['vagus-nerve-x-l', 'vagus-nerve-x-r']] as const) {
      expect(x(l)).toBeCloseTo(-x(r), 9);
      expect(centros[l]![1] + d[l]![1]).toBeCloseTo(centros[r]![1] + d[r]![1], 9);
    }
  });

  it('las piezas de un mismo bloque se mueven juntas y todo queda en un solo plano frontal', () => {
    const d = desplazamientosInventario(centros, cajas, visibles, (p) => bloqueDe(p, 'lobulos'), grupoInventario, ladoDe);
    expect(d['precentral-gyrus-l']).toEqual(d['superior-frontal-gyrus-l']);
    const zs = [...cajasMovidas(d, 'lobulos').values()].map(([a, b]) => (a[2] + b[2]) / 2);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-9);
  });

  it('con un solo bloque visible no hay inventario', () => {
    expect(desplazamientosInventario(centros, cajas, ['thalamus-l'], (p) => p, grupoInventario, ladoDe)).toEqual({});
  });

  it('es determinista y no depende del orden de las visibles', () => {
    const uno = desplazamientosInventario(centros, cajas, visibles, (p) => p, grupoInventario, ladoDe);
    const otro = desplazamientosInventario(centros, cajas, [...visibles].reverse(), (p) => p, grupoInventario, ladoDe);
    expect(otro).toEqual(uno);
  });
});

describe('deslizador de explosión (F6)', () => {
  const deslizar = (f: number) =>
    desplazamientosDeslizador(centros, cajas, visibles, (p) => p, grupoInventario, f, ladoDe as (p: string) => Lado);

  it('hasta INICIO_INVENTARIO es la explosión radial, que ahí llega a su factor 1', () => {
    expect(deslizar(0)).toEqual({});
    expect(deslizar(INICIO_INVENTARIO / 2)).toEqual(desplazamientosExplosion(centros, visibles, (p) => p, 0.5, ladoDe));
    expect(deslizar(INICIO_INVENTARIO)).toEqual(desplazamientosExplosion(centros, visibles, (p) => p, 1, ladoDe));
  });

  it('al 100 % cada pieza está exactamente en su lugar del inventario', () => {
    expect(deslizar(1)).toEqual(desplazamientosInventario(centros, cajas, visibles, (p) => p, grupoInventario, ladoDe));
  });

  it('entre los dos tramos el recorrido es continuo', () => {
    const a = deslizar(INICIO_INVENTARIO);
    const b = deslizar(INICIO_INVENTARIO + 1e-6);
    for (const p of visibles) for (const i of [0, 1, 2]) expect(Math.abs(a[p]![i]! - b[p]![i]!), p).toBeLessThan(1e-6);
  });

  it('con menos de MINIMO_BLOQUES_INVENTARIO bloques no hay inventario: la radial ocupa todo el recorrido', () => {
    const pocas = visibles.slice(0, MINIMO_BLOQUES_INVENTARIO - 1);
    const radial = (f: number) => desplazamientosExplosion(centros, pocas, (p) => p, f, ladoDe);
    const deslizarPocas = (f: number) => desplazamientosDeslizador(centros, cajas, pocas, (p) => p, grupoInventario, f, ladoDe);
    expect(deslizarPocas(1)).toEqual(radial(1));
    expect(deslizarPocas(INICIO_INVENTARIO)).toEqual(radial(INICIO_INVENTARIO));
  });

  it('con exactamente MINIMO_BLOQUES_INVENTARIO bloques sí hay inventario', () => {
    const justas = visibles.slice(0, MINIMO_BLOQUES_INVENTARIO);
    expect(desplazamientosDeslizador(centros, cajas, justas, (p) => p, grupoInventario, 1, ladoDe)).toEqual(
      desplazamientosInventario(centros, cajas, justas, (p) => p, grupoInventario, ladoDe),
    );
  });

  it('por hemisferios hay menos de MINIMO_BLOQUES_INVENTARIO bloques: nunca entra al inventario', () => {
    const bloques = new Set(visibles.map((p) => bloqueDe(p, 'hemisferios')));
    expect(bloques.size).toBeLessThan(MINIMO_BLOQUES_INVENTARIO);
  });
});
