// Prueba de las cuatro asimetrías del vago (ADR 0009, SPEC F25). Criterio de bloqueo: la geometría
// trazada no se publica si alguna falla o si falta un anclaje; esta prueba corre en cada CI.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { asimetria1, asimetria2, asimetria3, asimetria4, comprobar, signoAnterior, type Anclajes, type Rutas } from '../scripts/lib/asimetrias.ts';
import { piezasAproximadas } from '../src/data/atlas';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(ruta, 'utf8')) as T;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// Modelo sintético con las relaciones bien puestas (pipeline/pruebas/vago_sintetico.py) y las rutas
// que calculó pipeline/generar-ramas-vago.py sobre él con pipeline/rutas-vago.yaml.
const sintAnclajes = leer<Anclajes>('tests/fixtures/vago-sintetico/anclajes.json');
const sintRutas = leer<Rutas>('tests/fixtures/vago-sintetico/puntos.json');

describe('asimetrías del vago con el modelo sintético', () => {
  it('el eje anterior sale de los datos (tráquea delante del esófago)', () => {
    expect(signoAnterior(sintAnclajes)).toBe(1);
  });

  it('las rutas generadas desde rutas-vago.yaml cumplen las cuatro', () => {
    const res = comprobar(sintAnclajes, sintRutas);
    expect(res.map((r) => r.asimetria)).toEqual([1, 2, 3, 4]);
    for (const r of res) expect(r.ok, `asimetría ${r.asimetria}: ${r.detalle}`).toBe(true);
  });

  it('1 falla si el recurrente derecho pasa por encima de la subclavia', () => {
    const r = copia(sintRutas);
    r.rutas['laringeo_recurrente_derecho']!.puntos = r.rutas['laringeo_recurrente_derecho']!.puntos.map(([x, y, z]) => [x, Math.max(y, 1.43), z]);
    const res = asimetria1(sintAnclajes, r);
    expect(res.ok).toBe(false);
    expect(res.detalle).toMatch(/no rodea la subclavia derecha/);
  });

  it('2 falla si el recurrente izquierdo no baja hasta el arco', () => {
    const r = copia(sintRutas);
    r.rutas['laringeo_recurrente_izquierdo']!.puntos = r.rutas['laringeo_recurrente_izquierdo']!.puntos.filter((p) => p[1] > 1.37);
    expect(asimetria2(sintAnclajes, r).ok).toBe(false);
  });

  it('3 falla si el vago izquierdo cruza el arco por detrás', () => {
    const d = copia(sintAnclajes);
    d.trazos['Vagus nerve (X).l#t00']!.puntos = d.trazos['Vagus nerve (X).l#t00']!.puntos.map(([x, y, z]) => [x, y, z - 0.05]);
    const res = asimetria3(d, sintRutas);
    expect(res.ok).toBe(false);
    expect(res.detalle).toMatch(/por detrás/);
  });

  it('4 falla si el vago derecho pasa por delante del esófago', () => {
    const d = copia(sintAnclajes);
    d.trazos['Vagus nerve (X).r#t00']!.puntos = d.trazos['Vagus nerve (X).r#t00']!.puntos.map(([x, y, z]) => [x, y, y < 1.33 ? z + 0.06 : z]);
    expect(asimetria4(d).ok).toBe(false);
  });

  it('si falta un anclaje la prueba falla con un mensaje que lo nombra, nunca en silencio', () => {
    const d = copia(sintAnclajes);
    delete d.anclas['Aortic arch'];
    expect(() => comprobar(d, sintRutas)).toThrow(/Falta el anclaje "Aortic arch"/);
  });
});

describe('asimetrías del vago con el modelo real', () => {
  const rutaAnclajes = 'pipeline/anclajes-vago.json';
  const rutaPuntos = 'pipeline/rutas-vago-puntos.json';

  it('no hay geometría trazada sin anclajes medidos ni rutas calculadas (criterio de bloqueo de F25)', () => {
    if (piezasAproximadas.length) {
      expect(existsSync(rutaAnclajes), `${rutaAnclajes}: corre pipeline/auditar-vago.py`).toBe(true);
      expect(existsSync(rutaPuntos), `${rutaPuntos}: corre pipeline/generar-ramas-vago.py`).toBe(true);
    }
  });

  it.runIf(existsSync(rutaAnclajes))('el modelo medido cumple las asimetrías que se pueden comprobar', () => {
    const d = leer<Anclajes>(rutaAnclajes);
    const r = existsSync(rutaPuntos) ? leer<Rutas>(rutaPuntos) : null;
    for (const res of comprobar(d, r)) expect(res.ok, `asimetría ${res.asimetria}: ${res.detalle}`).toBe(true);
  });
});
