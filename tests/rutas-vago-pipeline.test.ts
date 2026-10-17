// Rutas del vago que calcula pipeline/generar-ramas-vago.py (ADR 0010): los tramos torácicos, los
// empalmes con el tronco escaneado y con los ramos, y la banda que reemplazan. Las mismas aserciones
// (casosDeRutas) corren sobre el modelo sintético (tests/fixtures/vago-sintetico/, lo escribe
// pipeline/pruebas/vago_sintetico.py) y sobre el modelo real (pipeline/anclajes-vago.json y
// public/modelos/rutas-vago.json). El bloque real no se salta: si falta un archivo, falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tronco, type Anclajes, type P } from '../scripts/lib/asimetrias.ts';

interface Banda {
  lado: 'izquierdo' | 'derecho';
  y_max: number;
  y_min: number | null;
}
interface RutaGenerada {
  lado: 'izquierdo' | 'derecho';
  entrada: string;
  revision: { estado: string; revisado_por: string | null; fecha: string | null };
  puntos: P[];
  reemplaza?: Banda;
}
interface Salida {
  fuentes: string[];
  rutas: Record<string, RutaGenerada>;
}

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const anclajes = leer<Anclajes>('tests/fixtures/vago-sintetico/anclajes.json');
const salida = leer<Salida>('tests/fixtures/vago-sintetico/puntos.json');
const yaml = readFileSync('pipeline/rutas-vago.yaml', 'utf8');

const EMPALME = 0.0025; // 2,5 mm
const IDS = ['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal', 'vago_toracico_derecho', 'vago_toracico_izquierdo'];

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Distancia mínima de un punto a una polilínea (punto contra cada segmento). */
function distanciaAPolilinea(p: P, pts: P[]): number {
  let mejor = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const largo2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / largo2));
    mejor = Math.min(mejor, dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
  }
  return mejor;
}

function alturaAncla(d: Anclajes, nombre: string, cual: 'mas_alto' | 'mas_bajo'): number {
  const pts = d.anclas[nombre]?.puntos;
  if (!pts?.length) throw new Error(`El anclaje "${nombre}" no trae puntos`);
  const ys = pts.map((p) => p[1]);
  return cual === 'mas_alto' ? Math.max(...ys) : Math.min(...ys);
}

function ruta(s: Salida, id: string): RutaGenerada {
  const r = s.rutas[id];
  if (!r) throw new Error(`Falta la ruta ${id}`);
  return r;
}

/** Aserciones R1.2, R1.3, R1.4 y R2.4: valen igual para el modelo sintético y para el real. */
function casosDeRutas(anclajes: Anclajes, salida: Salida): void {
  // Perezosas: si falta una ruta, falla la prueba que la usa y nombra la ruta que falta.
  const derecho = () => ruta(salida, 'vago_toracico_derecho');
  const izquierdo = () => ruta(salida, 'vago_toracico_izquierdo');
  const distal = () => ruta(salida, 'vago_izquierdo_distal');

  it('R1.2: el torácico derecho va de la subclavia derecha al bronquio principal derecho, sobre el tronco', () => {
    const primero = derecho().puntos[0]!;
    const ultimo = derecho().puntos.at(-1)!;
    expect(Math.abs(primero[1] - alturaAncla(anclajes, 'Right subclavian artery', 'mas_alto'))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(ultimo[1] - alturaAncla(anclajes, 'Right main bronchus', 'mas_bajo'))).toBeLessThanOrEqual(1e-6);
    expect(distanciaAPolilinea(primero, tronco(anclajes, 'derecho'))).toBeLessThanOrEqual(EMPALME);
    expect(distanciaAPolilinea(ultimo, tronco(anclajes, 'derecho'))).toBeLessThanOrEqual(EMPALME);
  });

  it('R1.3: el torácico izquierdo arranca en la subclavia izquierda y el distal sigue donde termina', () => {
    const primero = izquierdo().puntos[0]!;
    expect(Math.abs(primero[1] - alturaAncla(anclajes, 'Left subclavian artery', 'mas_alto'))).toBeLessThanOrEqual(1e-6);
    expect(distanciaAPolilinea(primero, tronco(anclajes, 'izquierdo'))).toBeLessThanOrEqual(EMPALME);
    expect(dist(distal().puntos[0]!, izquierdo().puntos.at(-1)!)).toBeLessThanOrEqual(EMPALME);
  });

  it('R1.4: cada recurrente sale del tramo torácico de su lado', () => {
    expect(distanciaAPolilinea(ruta(salida, 'laringeo_recurrente_derecho').puntos[0]!, derecho().puntos)).toBeLessThanOrEqual(EMPALME);
    expect(distanciaAPolilinea(ruta(salida, 'laringeo_recurrente_izquierdo').puntos[0]!, izquierdo().puntos)).toBeLessThanOrEqual(EMPALME);
  });

  it('R2.4: la banda que reemplaza cada torácica sale de los anclajes', () => {
    expect(derecho().reemplaza?.lado).toBe('derecho');
    expect(Math.abs(derecho().reemplaza!.y_max - alturaAncla(anclajes, 'Right subclavian artery', 'mas_alto'))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(derecho().reemplaza!.y_min! - alturaAncla(anclajes, 'Right main bronchus', 'mas_bajo'))).toBeLessThanOrEqual(1e-6);
    expect(izquierdo().reemplaza?.lado).toBe('izquierdo');
    expect(Math.abs(izquierdo().reemplaza!.y_max - alturaAncla(anclajes, 'Left subclavian artery', 'mas_alto'))).toBeLessThanOrEqual(1e-6);
    expect(izquierdo().reemplaza!.y_min).toBeNull();
    for (const id of ['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal']) {
      expect(ruta(salida, id).reemplaza, id).toBeUndefined();
    }
  });
}

describe('rutas del vago con el modelo sintético', () => {
  const derecho = ruta(salida, 'vago_toracico_derecho');
  const izquierdo = ruta(salida, 'vago_toracico_izquierdo');

  it('publica exactamente las cinco rutas', () => {
    expect(Object.keys(salida.rutas).sort()).toEqual(IDS);
  });

  it('R1.1: las torácicas abren la ficha del vago, con fuentes y en revisión', () => {
    for (const r of [derecho, izquierdo]) {
      expect(r.entrada).toBe('vagus-nerve-x');
      expect(r.revision).toEqual({ estado: 'en_revision', revisado_por: null, fecha: null });
    }
    expect(salida.fuentes.length).toBeGreaterThan(0);
  });

  it('R1.1: el YAML no trae coordenadas escritas a mano', () => {
    const lista3 = /\[\s*[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?\s*,\s*[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?\s*,\s*[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?\s*\]/;
    const enBloque = /^\s*-\s*-?\d/m;
    expect(yaml).toContain('vago_toracico_derecho:');
    expect(yaml).toContain('vago_toracico_izquierdo:');
    expect(lista3.test(yaml)).toBe(false);
    expect(enBloque.test(yaml)).toBe(false);
    // Control negativo: las dos expresiones sí detectan lo que dicen detectar.
    expect(lista3.test('- [0.1, -1.2, 3e-3]')).toBe(true);
    expect(enBloque.test('pasos:\n  - 0.5')).toBe(true);
  });

  it('control negativo: un empalme movido 3 mm se detecta', () => {
    const movida = copia(salida);
    const d = ruta(movida, 'vago_toracico_derecho').puntos[0]!;
    d[0] += 0.003;
    expect(distanciaAPolilinea(d, tronco(anclajes, 'derecho'))).toBeGreaterThan(EMPALME);
    const r = ruta(movida, 'laringeo_recurrente_izquierdo').puntos[0]!;
    r[2] += 0.003;
    expect(distanciaAPolilinea(r, ruta(movida, 'vago_toracico_izquierdo').puntos)).toBeGreaterThan(EMPALME);
  });

  casosDeRutas(anclajes, salida);
});

describe('rutas del vago con el modelo real', () => {
  // Sin guarda: si falta uno de los dos archivos, readFileSync lanza y la prueba falla.
  const anclajesReales = leer<Anclajes>('pipeline/anclajes-vago.json');
  const publicadas = leer<Salida>('public/modelos/rutas-vago.json');

  it('publica exactamente las cinco rutas, todas en revisión', () => {
    expect(Object.keys(publicadas.rutas).sort()).toEqual(IDS);
    for (const id of IDS) expect(ruta(publicadas, id).revision.estado, id).toBe('en_revision');
  });

  casosDeRutas(anclajesReales, publicadas);
});
