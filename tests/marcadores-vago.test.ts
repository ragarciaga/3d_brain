// Los marcadores que se calculan sobre una ruta trazada del vago (ADR 0010, ADR 0013, issue 216) quedan sobre
// la polilínea de esa ruta en public/modelos/rutas-vago.json. Si alguien cambia la ruta o el marcador sin volver
// a correr pipeline/ubicar-marcadores.py y scripts/aplicar-marcadores.ts, esta prueba falla.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Marcador, PosicionMarcador } from '../src/data/tipos';
import type { P, Rutas } from '../scripts/lib/asimetrias.ts';

const raiz = resolve('.');
const marcadores = JSON.parse(readFileSync(join(raiz, 'src/data/marcadores.json'), 'utf8')) as Marcador[];
const rutas = (JSON.parse(readFileSync(join(raiz, 'public/modelos/rutas-vago.json'), 'utf8')) as Rutas).rutas;

/** 0,1 mm, igual que la tolerancia de check:modelo. */
const TOLERANCIA = 0.0001;

/** Distancia de un punto a una polilínea: la menor a alguno de sus segmentos. */
function distanciaAPolilinea(p: readonly number[], linea: readonly P[]): number {
  let mejor = Infinity;
  for (let i = 0; i + 1 < linea.length; i++) {
    const a = linea[i]!;
    const b = linea[i + 1]!;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const largo2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0]! - a[0]) * ab[0]! + (p[1]! - a[1]) * ab[1]! + (p[2]! - a[2]) * ab[2]!) / largo2));
    const q = [a[0] + ab[0]! * t, a[1] + ab[1]! * t, a[2] + ab[2]! * t];
    mejor = Math.min(mejor, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!));
  }
  return mejor;
}

function lado(m: Marcador, l: 'l' | 'r'): readonly number[] {
  const pos = m.posicion as PosicionMarcador;
  if (pos === null || Array.isArray(pos)) throw new Error(`${m.id}: la posición no es de dos lados`);
  return (pos as { l: number[]; r: number[] })[l];
}

const marcador = (id: string): Marcador => {
  const m = marcadores.find((x) => x.id === id);
  if (!m) throw new Error(`falta el marcador ${id}`);
  return m;
};

describe('marcadores sobre la ruta torácica trazada', () => {
  const casos = [
    ['m-thoracic-cardiac-branches-of-vagus-nerve', 'l', 'vago_toracico_izquierdo'],
    ['m-thoracic-cardiac-branches-of-vagus-nerve', 'r', 'vago_toracico_derecho'],
    ['m-superior-cervical-cardiac-branches-of-vagus-nerve', 'l', 'vago_toracico_izquierdo'],
  ] as const;

  it.each(casos)('%s (%s) queda a 0,1 mm o menos de la polilínea de %s', (id, l, ruta) => {
    expect(rutas[ruta], `falta la ruta ${ruta}`).toBeDefined();
    const d = distanciaAPolilinea(lado(marcador(id), l), rutas[ruta]!.puntos);
    expect(d, `${id} (${l}) a ${(d * 1000).toFixed(3)} mm de ${ruta}`).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('la distancia es la del segmento y no la del vértice más cercano: un punto a medio segmento se mide bien', () => {
    const linea: P[] = [
      [0, 0, 0],
      [0, 0.02, 0],
    ];
    expect(distanciaAPolilinea([0, 0.01, 0], linea)).toBeCloseTo(0, 12);
    expect(distanciaAPolilinea([0.003, 0.01, 0], linea)).toBeCloseTo(0.003, 12);
    expect(distanciaAPolilinea([0, 0.03, 0], linea)).toBeCloseTo(0.01, 12);
  });

  it('la prueba distingue una posición lejos de la ruta (la del tronco escaneado que se retiró)', () => {
    // Posición que tenía el cardíaco torácico izquierdo sobre el tronco escaneado, antes de este cambio.
    const antes = [0.01746, 1.37425, 0.00055];
    expect(distanciaAPolilinea(antes, rutas['vago_toracico_izquierdo']!.puntos)).toBeGreaterThan(TOLERANCIA * 10);
  });
});
