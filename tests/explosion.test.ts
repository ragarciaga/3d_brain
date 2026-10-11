import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cajaBlenderAGltf, type Caja } from '../scripts/lib/modelo.ts';
import { mallaBase, nodos, piezasBajo } from '../src/data/atlas';
import {
  acercar,
  DISTANCIA_BASE,
  DISTANCIA_SEPARAR,
  desplazamientoSeparar,
  desplazamientosExplosion,
  FACTOR_RADIAL,
  magnitudExplosion,
  origenExplosion,
  promedio,
  RADIO_MAXIMO,
  RADIO_SALIDA,
  relativoAlOrigen,
  type Lado,
  type Vec3,
} from '../src/lib/explosion';
import { ladoDe } from '../src/store/useAtlas';

const centros: Record<string, Vec3> = { a: [1, 0, 0], b: [-1, 0, 0], c: [1, 1, 0] };
const norma = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
const dist = (a: Vec3, b: Vec3) => norma([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);

describe('fragmentar (F6)', () => {
  it('sin explosión no hay desplazamientos', () => {
    expect(desplazamientosExplosion(centros, ['a', 'b'], (p) => p, 0)).toEqual({});
  });

  it('cada pieza se aleja del centro del conjunto', () => {
    const d = desplazamientosExplosion(centros, ['a', 'b'], (p) => p, 1);
    expect(d.a![0]).toBeGreaterThan(0);
    expect(d.b![0]).toBeLessThan(0);
  });

  it('las piezas de un mismo bloque se mueven juntas', () => {
    const d = desplazamientosExplosion(centros, ['a', 'b', 'c'], (p) => (p === 'b' ? 'izq' : 'der'), 0.5);
    expect(d.a).toEqual(d.c);
  });

  it('reensamblar llega exactamente a cero, sin error acumulado (F7)', () => {
    let v: Vec3 = [0.12345, -0.5, 0.33];
    for (let i = 0; i < 200; i++) v = acercar(v, [0, 0, 0], 0.1);
    expect(v).toEqual([0, 0, 0]);
  });

  it('con un solo bloque visible no hay desplazamientos', () => {
    expect(desplazamientosExplosion(centros, ['a'], (p) => p, 1)).toEqual({});
    expect(desplazamientosExplosion(centros, ['a', 'c'], () => 'uno', 1)).toEqual({});
  });

  it('un bloque en el origen exacto sale hacia +Y con factor por DISTANCIA_BASE', () => {
    const c: Record<string, Vec3> = { a: [1, 0, 0], b: [-1, 0, 0], m: [0, 0, 0] };
    const lado = (p: string): Lado => (p === 'a' ? 'l' : p === 'b' ? 'r' : 'medio');
    const d1 = desplazamientosExplosion(c, ['a', 'b', 'm'], (p) => p, 1, lado);
    expect(d1.m).toEqual([0, DISTANCIA_BASE, 0]);
    const d05 = desplazamientosExplosion(c, ['a', 'b', 'm'], (p) => p, 0.5, lado);
    expect(d05.m).toEqual([0, DISTANCIA_BASE / 2, 0]);
  });

  it('la magnitud es factor por (base + radial por distancia al origen)', () => {
    const c: Record<string, Vec3> = { l: [0.02, 0, 0], r: [-0.02, 0, 0] };
    const lado = (p: string): Lado => (p === 'l' ? 'l' : 'r');
    const esperado = DISTANCIA_BASE + FACTOR_RADIAL * 0.02;
    expect(esperado).toBeCloseTo(0.11, 12);
    const d1 = desplazamientosExplosion(c, ['l', 'r'], (p) => p, 1, lado);
    expect(norma(d1.l!)).toBeCloseTo(esperado, 12);
    expect(norma(d1.r!)).toBeCloseTo(esperado, 12);
    const d05 = desplazamientosExplosion(c, ['l', 'r'], (p) => p, 0.5, lado);
    expect(norma(d05.l!)).toBeCloseTo(esperado / 2, 12);
    expect(magnitudExplosion(0.02)).toBeCloseTo(esperado, 12);
  });

  it('el término radial tiene tope: un bloque a 0,5 m se mueve DISTANCIA_BASE + FACTOR_RADIAL * RADIO_MAXIMO', () => {
    const c: Record<string, Vec3> = { lejos: [0.5, 0, 0], cerca: [0, 0, 0] };
    const d = desplazamientosExplosion(c, ['lejos', 'cerca'], (p) => p, 1, (p) => (p === 'lejos' ? 'l' : 'medio'));
    expect(norma(d.lejos!)).toBeCloseTo(DISTANCIA_BASE + FACTOR_RADIAL * RADIO_MAXIMO, 12);
    expect(norma(d.lejos!)).toBeCloseTo(0.41, 12);
  });

  it('un bloque r con centro en x positivo no cambia de lado (D4)', () => {
    const c: Record<string, Vec3> = { r: [0.02, 0, 0], l: [0.03, 0.01, 0] };
    const d = desplazamientosExplosion(c, ['r', 'l'], (p) => p, 1, (p) => (p === 'r' ? 'r' : 'l'));
    expect(d.r![0]).toBeLessThanOrEqual(0);
    expect(d.l![0]).toBeGreaterThanOrEqual(0);
  });

  it('con un conjunto visible de un solo lado, todo sigue su lado y queda en ese lado', () => {
    const c: Record<string, Vec3> = { a: [0.01, 0.01, 0], b: [0.03, -0.01, 0.01], d: [0.06, 0, -0.02] };
    const d = desplazamientosExplosion(c, ['a', 'b', 'd'], (p) => p, 1, () => 'l');
    for (const p of ['a', 'b', 'd']) {
      expect(d[p]![0]).toBeGreaterThanOrEqual(0);
      expect(c[p]![0] + d[p]![0]).toBeGreaterThan(0);
    }
  });

  it('un bloque medio con x = 0 tiene X exactamente 0', () => {
    const c: Record<string, Vec3> = { m: [0, 0.03, 0.01], a: [0.02, 0, 0], b: [-0.02, 0, 0] };
    const lado = (p: string): Lado => (p === 'a' ? 'l' : p === 'b' ? 'r' : 'medio');
    const d = desplazamientosExplosion(c, ['m', 'a', 'b'], (p) => p, 1, lado);
    expect(d.m![0]).toBe(0);
  });

  it('es determinista y no depende del orden de las visibles (D5)', () => {
    const c: Record<string, Vec3> = { a: [0.03, 0.01, 0.02], b: [-0.02, 0.04, -0.01], m: [0, -0.03, 0.02], d: [0.01, 0.02, 0.05] };
    const lado = (p: string): Lado => (p === 'a' || p === 'd' ? 'l' : p === 'b' ? 'r' : 'medio');
    const orden = ['a', 'b', 'm', 'd'];
    const uno = desplazamientosExplosion(c, orden, (p) => p, 0.7, lado);
    expect(desplazamientosExplosion(c, orden, (p) => p, 0.7, lado)).toEqual(uno);
    const inverso = desplazamientosExplosion(c, [...orden].reverse(), (p) => p, 0.7, lado);
    for (const p of orden) for (let i = 0; i < 3; i++) expect(Math.abs(inverso[p]![i]! - uno[p]![i]!)).toBeLessThan(1e-12);
  });
});

describe('separar una pieza (D7)', () => {
  const conjunto: Vec3 = [0.5, 1.6, 0.1];
  it('una pieza cerca del origen sale hasta quedar a RADIO_SALIDA', () => {
    const c: Vec3 = [0, 1.61, 0.1]; // x = 0 y 1 cm sobre el centro del conjunto: r = 0,01
    const d = desplazamientoSeparar(c, conjunto, 'medio');
    expect(norma(d)).toBeCloseTo(0.11, 12);
    const final = relativoAlOrigen([c[0] + d[0], c[1] + d[1], c[2] + d[2]], origenExplosion(conjunto), 'medio');
    expect(norma(final)).toBeCloseTo(RADIO_SALIDA, 12);
  });

  it('una pieza ya lejos se mueve al menos DISTANCIA_SEPARAR', () => {
    const d = desplazamientoSeparar([0.10, 1.6, 0.1], conjunto, 'l');
    expect(norma(d)).toBeCloseTo(DISTANCIA_SEPARAR, 12);
  });

  it('una pieza r con x positivo se va hacia -X', () => {
    expect(desplazamientoSeparar([0.02, 1.62, 0.1], conjunto, 'r')[0]).toBeLessThanOrEqual(0);
    expect(desplazamientoSeparar([0.02, 1.62, 0.1], conjunto, 'l')[0]).toBeGreaterThanOrEqual(0);
  });

  it('una pieza en el origen sale hacia +Y hasta RADIO_SALIDA', () => {
    expect(desplazamientoSeparar([0, 1.6, 0.1], conjunto, 'medio')).toEqual([0, RADIO_SALIDA, 0]);
  });
});

// Datos reales: centros de pipeline/cajas.json en coordenadas glTF.
const cajas = (JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, Caja> }).cajas;

function centrosReales(): Record<string, Vec3> {
  const porMalla = new Map<string, Caja[]>();
  for (const [nombre, caja] of Object.entries(cajas)) {
    if (nombre.endsWith('#toque')) continue;
    const base = mallaBase(nombre);
    porMalla.set(base, [...(porMalla.get(base) ?? []), cajaBlenderAGltf(caja)]);
  }
  const res: Record<string, Vec3> = {};
  for (const n of Object.values(nodos)) {
    if (n.tipo !== 'pieza' || !n.malla) continue;
    const l = porMalla.get(n.malla);
    if (!l?.length) continue;
    const u = [
      Math.min(...l.map((c) => c[0])),
      Math.min(...l.map((c) => c[1])),
      Math.min(...l.map((c) => c[2])),
      Math.max(...l.map((c) => c[3])),
      Math.max(...l.map((c) => c[4])),
      Math.max(...l.map((c) => c[5])),
    ];
    res[n.id] = [(u[0]! + u[3]!) / 2, (u[1]! + u[4]!) / 2, (u[2]! + u[5]!) / 2];
  }
  return res;
}

describe('explosión con el modelo real (D1, D2, D4)', () => {
  const c = centrosReales();
  const encefalo = piezasBajo('g-brain').filter((p) => nodos[p]!.clase === 'estudio');
  const visibles = [...encefalo, ...piezasBajo('g-vagus-nerve-x')];
  const explotar = (f: number) => desplazamientosExplosion(c, visibles, (p) => p, f, ladoDe);

  it('tiene los centros de las 253 piezas del encéfalo y de los dos vagos', () => {
    expect(encefalo).toHaveLength(253);
    expect(piezasBajo('g-vagus-nerve-x')).toHaveLength(2);
    for (const p of visibles) expect(c[p], p).toBeDefined();
  });

  it('precondición: los centros del encéfalo están a RADIO_MAXIMO o menos del origen y cada lado está en el suyo', () => {
    const origen = origenExplosion(promedio(visibles.map((p) => c[p]!)));
    for (const p of encefalo) {
      const rel = relativoAlOrigen(c[p]!, origen, ladoDe(p));
      expect(norma(rel), p).toBeLessThanOrEqual(RADIO_MAXIMO);
      if (ladoDe(p) === 'l') expect(c[p]![0], p).toBeGreaterThanOrEqual(0);
      if (ladoDe(p) === 'r') expect(c[p]![0], p).toBeLessThanOrEqual(0);
    }
  });

  it.each([
    [1, 4],
    [0.5, 2.5],
  ])('al factor %s, cada par de piezas del encéfalo queda al menos %s veces más lejos que armado', (f, veces) => {
    const d = explotar(f);
    let peor = Infinity;
    for (let i = 0; i < encefalo.length; i++) {
      for (let j = i + 1; j < encefalo.length; j++) {
        const a = encefalo[i]!;
        const b = encefalo[j]!;
        const armada = dist(c[a]!, c[b]!);
        if (armada < 1e-9) continue;
        const sumar = (p: string): Vec3 => [c[p]![0] + d[p]![0], c[p]![1] + d[p]![1], c[p]![2] + d[p]![2]];
        peor = Math.min(peor, dist(sumar(a), sumar(b)) / armada);
      }
    }
    expect(peor).toBeGreaterThanOrEqual(veces - 1e-9);
  });

  it('al factor 1 toda pieza del encéfalo se aleja al menos DISTANCIA_BASE, también las profundas', () => {
    const d = explotar(1);
    for (const p of encefalo) expect(norma(d[p]!), p).toBeGreaterThanOrEqual(0.05 - 1e-12);
    for (const p of ['thalamus-l', 'third-ventricle', 'corpus-callosum', 'globus-pallidus-l', 'hypothalamus']) {
      expect(d[p], p).toBeDefined();
      expect(norma(d[p]!), p).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('el vago derecho, con centro en x positivo, se aleja hacia -X', () => {
    expect(c['vagus-nerve-x-r']![0]).toBeGreaterThan(0);
    expect(explotar(1)['vagus-nerve-x-r']![0]).toBeLessThanOrEqual(0);
  });
});
