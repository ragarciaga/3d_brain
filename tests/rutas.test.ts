// Rutas trazadas del vago en la app (ADR 0009): validación del archivo publicado y la respuesta
// "Recorrido trazado" que pasa por el importador.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leerEnvios, parsearCsv } from '../scripts/lib/revisiones.ts';
import { estructuras } from '../src/data/atlas';
import { cargaRevisionV2, type Respuesta } from '../src/lib/revision';
import { campoTrazado, cargarRutas, leerRutas } from '../src/lib/rutas';

const sintetico = JSON.parse(readFileSync('tests/fixtures/vago-sintetico/puntos.json', 'utf8')) as unknown;

describe('rutas trazadas: archivo publicado', () => {
  it('lee las cinco rutas que escribe el generador, con su ficha y su estado', () => {
    const rutas = leerRutas(sintetico);
    expect(rutas.map((r) => r.id).sort()).toEqual(['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal', 'vago_toracico_derecho', 'vago_toracico_izquierdo']);
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
    expect(leerRutas(malo).map((r) => r.id).sort()).toEqual(['vago_izquierdo_distal', 'vago_toracico_derecho', 'vago_toracico_izquierdo']);
    expect(leerRutas(null)).toEqual([]);
    expect(leerRutas({ rutas: 'x' })).toEqual([]);
  });

  it('conserva reemplaza válido, solo con sus tres claves, y las rutas sin banda no lo traen', () => {
    const porId = Object.fromEntries(leerRutas(sintetico).map((r) => [r.id, r]));
    expect(porId['vago_toracico_derecho']!.reemplaza).toEqual({ lado: 'derecho', y_max: 1.415, y_min: 1.34 });
    expect(porId['vago_toracico_izquierdo']!.reemplaza).toEqual({ lado: 'izquierdo', y_max: 1.41, y_min: null });
    for (const id of ['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal']) {
      expect(porId[id]!.reemplaza, id).toBeUndefined();
      expect('reemplaza' in porId[id]!, id).toBe(false);
    }
    const extra = JSON.parse(JSON.stringify(sintetico)) as { rutas: Record<string, { reemplaza: Record<string, unknown> }> };
    extra.rutas['vago_toracico_derecho']!.reemplaza['z'] = 1;
    const leida = leerRutas(extra).find((r) => r.id === 'vago_toracico_derecho')!;
    expect(Object.keys(leida.reemplaza!).sort()).toEqual(['lado', 'y_max', 'y_min']);
  });

  const otras = ['laringeo_recurrente_derecho', 'laringeo_recurrente_izquierdo', 'vago_izquierdo_distal', 'vago_toracico_izquierdo'];
  const valido = { lado: 'derecho', y_max: 1.415, y_min: 1.34 };
  it.each<[string, unknown]>([
    ['lado fuera de izquierdo y derecho', { ...valido, lado: 'centro' }],
    ['sin lado', { y_max: 1.415, y_min: 1.34 }],
    ['y_max texto', { ...valido, y_max: '1.4' }],
    ['sin y_max', { lado: 'derecho', y_min: 1.34 }],
    ['y_min texto', { ...valido, y_min: '1.3' }],
    ['sin y_min', { lado: 'derecho', y_max: 1.415 }],
    ['y_min igual a y_max', { ...valido, y_min: 1.415 }],
    ['y_min mayor que y_max', { ...valido, y_min: 1.5 }],
    ['reemplaza nulo', null],
    ['reemplaza texto', 'banda'],
    ['reemplaza arreglo', [1.415, 1.34]],
  ])('descarta solo la ruta con reemplaza mal formado: %s', (_caso, reemplaza) => {
    const malo = JSON.parse(JSON.stringify(sintetico)) as { rutas: Record<string, Record<string, unknown>> };
    malo.rutas['vago_toracico_derecho']!['reemplaza'] = reemplaza;
    expect(leerRutas(malo).map((r) => r.id).sort()).toEqual(otras);
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
    expect(await cargarRutas('/', con({ ok: true, json: () => Promise.resolve(sintetico) }))).toHaveLength(5);
  });
});

describe('rutas trazadas: revisión docente (F24)', () => {
  const CINCO = [
    'trazado_vago_toracico_derecho',
    'trazado_vago_toracico_izquierdo',
    'trazado_laringeo_recurrente_derecho',
    'trazado_laringeo_recurrente_izquierdo',
    'trazado_vago_izquierdo_distal',
  ];

  it('un campo por ruta, con el id de la ruta, y ninguno es un campo por lado', () => {
    expect(campoTrazado({ id: 'x_y' })).toBe('trazado_x_y');
    const rutas = leerRutas(sintetico);
    const campos = rutas.map(campoTrazado);
    expect([...campos].sort()).toEqual([...CINCO].sort());
    expect(new Set(campos).size).toBe(5);
    expect(rutas.filter((x) => x.entrada === 'm-recurrent-laryngeal-nerve').map(campoTrazado).sort()).toEqual([
      'trazado_laringeo_recurrente_derecho',
      'trazado_laringeo_recurrente_izquierdo',
    ]);
    expect(campos).not.toContain('trazado_derecho');
    expect(campos).not.toContain('trazado_izquierdo');
  });

  it('la respuesta de cada ruta llega intacta al importador', () => {
    const rutas = leerRutas(sintetico);
    const entradas = [...new Set(rutas.map((r) => r.entrada))];
    const veredicto = (i: number) => (i % 2 === 0 ? 'correcto' : 'corregir');
    const respuestas: Respuesta[] = rutas.map((r, i): Respuesta => {
      const version = estructuras[r.entrada]?.ficha?.version ?? 'sin-ficha';
      return veredicto(i) === 'correcto'
        ? { estructura: r.entrada, campo: campoTrazado(r), veredicto: 'correcto', version, fecha: '2026-10-13T10:00:00Z' }
        : { estructura: r.entrada, campo: campoTrazado(r), veredicto: 'corregir', propuesta: 'Debe pasar más cerca del ligamento arterioso', version, fecha: '2026-10-13T10:00:00Z' };
    });
    // Un solo envío v:2 con las cinco respuestas, en una fila CSV como la que exporta el formulario.
    const carga = cargaRevisionV2('ANAT01', respuestas);
    const csv = `Marca temporal,Código,Estructura,Revisión,Nombre\n2026-10-13 10:00,X,Y,"${carga.replace(/"/g, '""')}",Ana\n`;
    const { envios, invalidas } = leerEnvios(parsearCsv(csv), new Set(entradas));
    expect(invalidas).toBe(0);
    const recibidas = envios.flatMap((e) => e.respuestas.map((x) => [x.campo, x.veredicto, x.estructura]));
    expect(recibidas.map(([c, v]) => [c, v]).sort()).toEqual(rutas.map((r, i) => [campoTrazado(r), veredicto(i)]).sort());
    expect(recibidas.map(([c]) => c).sort()).toEqual([...CINCO].sort());
    for (const r of rutas) expect(recibidas.find(([c]) => c === campoTrazado(r))![2], campoTrazado(r)).toBe(r.entrada);
    expect(envios.flatMap((e) => e.respuestas).filter((x) => x.veredicto === 'corregir').every((x) => x.propuesta?.includes('ligamento arterioso'))).toBe(true);
  });
});
