// Rutas trazadas del vago en la app (ADR 0009): validación del archivo publicado y la respuesta
// "Recorrido trazado" que pasa por el importador.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leerEnvios, parsearCsv } from '../scripts/lib/revisiones.ts';
import { estructuras } from '../src/data/atlas';
import { urlFormulario, type Respuesta } from '../src/lib/revision';
import { campoTrazado, cargarRutas, leerRutas } from '../src/lib/rutas';

const sintetico = JSON.parse(readFileSync('tests/fixtures/vago-sintetico/puntos.json', 'utf8')) as unknown;

describe('rutas trazadas: archivo publicado', () => {
  it('lee las tres rutas que escribe el generador, con su ficha y su estado', () => {
    const rutas = leerRutas(sintetico);
    expect(rutas.map((r) => r.id).sort()).toEqual(['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal']);
    for (const r of rutas) {
      expect(estructuras[r.entrada], r.entrada).toBeDefined();
      expect(r.revision.estado).toBe('en_revision');
      expect(r.puntos.length).toBeGreaterThan(10);
    }
  });

  it('descarta rutas mal formadas sin romper las demás', () => {
    const malo = JSON.parse(JSON.stringify(sintetico)) as { rutas: Record<string, Record<string, unknown>> };
    malo.rutas['laringeo_recurrente_derecho']!['puntos'] = [[0, 1, 'x']];
    malo.rutas['laringeo_recurrente_izquierdo']!['revision'] = { estado: 'lista' };
    expect(leerRutas(malo).map((r) => r.id)).toEqual(['vago_izquierdo_distal']);
    expect(leerRutas(null)).toEqual([]);
    expect(leerRutas({ rutas: 'x' })).toEqual([]);
  });

  it('el archivo publicado hoy es válido (aunque esté vacío)', () => {
    const publicado = JSON.parse(readFileSync('public/modelos/rutas-vago.json', 'utf8')) as unknown;
    expect(Array.isArray(leerRutas(publicado))).toBe(true);
  });

  it('sin archivo, con un 404 o con la página de la app en su lugar, no hay rutas', async () => {
    const con = (r: Partial<Response>) => (() => Promise.resolve(r as Response)) as unknown as typeof fetch;
    expect(await cargarRutas('/', con({ ok: false }))).toEqual([]);
    expect(await cargarRutas('/', con({ ok: true, json: () => Promise.reject(new SyntaxError('<html>')) }))).toEqual([]);
    expect(await cargarRutas('/', (() => Promise.reject(new Error('red'))) as unknown as typeof fetch)).toEqual([]);
    expect(await cargarRutas('/', con({ ok: true, json: () => Promise.resolve(sintetico) }))).toHaveLength(3);
  });
});

describe('rutas trazadas: revisión docente (F24)', () => {
  it('un campo por lado, y la respuesta llega intacta al importador', () => {
    const rutas = leerRutas(sintetico);
    const campos = rutas.filter((x) => x.entrada === 'm-recurrent-laryngeal-nerve').map(campoTrazado).sort();
    expect(campos).toEqual(['trazado_derecho', 'trazado_izquierdo']);
    const version = estructuras['m-recurrent-laryngeal-nerve']!.ficha!.version;
    const respuestas: Respuesta[] = [
      { estructura: 'm-recurrent-laryngeal-nerve', campo: 'trazado_derecho', veredicto: 'correcto', version, fecha: 'x' },
      { estructura: 'm-recurrent-laryngeal-nerve', campo: 'trazado_izquierdo', veredicto: 'corregir', propuesta: 'Debe pasar más cerca del ligamento arterioso', version, fecha: 'x' },
    ];
    const config = { urlFormulario: 'https://docs.google.com/forms/d/e/abc/viewform', campos: { codigo: 'entry.1', estructura: 'entry.2', revision: 'entry.3' } };
    const carga = new URL(urlFormulario(config, 'ANAT01', 'm-recurrent-laryngeal-nerve', respuestas)!).searchParams.get('entry.3')!;
    const csv = `Marca temporal,Código,Estructura,Revisión,Nombre\n2026-10-13 10:00,X,Y,"${carga.replace(/"/g, '""')}",Ana\n`;
    const { envios, invalidas } = leerEnvios(parsearCsv(csv), new Set(['m-recurrent-laryngeal-nerve']));
    expect(invalidas).toBe(0);
    expect(envios[0]!.respuestas.map((x) => [x.campo, x.veredicto])).toEqual([
      ['trazado_derecho', 'correcto'],
      ['trazado_izquierdo', 'corregir'],
    ]);
  });
});
