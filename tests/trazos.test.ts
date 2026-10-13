// Trazos del vago (#62): lógica pura de la lista y datos copiados de la auditoría del modelo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRUPO_VAGO, marcadores, trazosAuditados } from '../src/data/atlas';
import type { Respuesta } from '../src/lib/revision';
import {
  avanceTrazos,
  claveTrazo,
  ENTRADA_VAGO,
  ordenarTrazos,
  propuestaDeTrazo,
  ramosDeTrazo,
  siguienteTrazo,
  trazosPendientes,
} from '../src/lib/trazos';

const cajas = (JSON.parse(readFileSync('pipeline/cajas.json', 'utf8')) as { cajas: Record<string, unknown> }).cajas;
const nombresDelModelo = Object.keys(cajas);
const trazos = ordenarTrazos(nombresDelModelo);
const TOTAL = nombresDelModelo.filter((n) => /#t\d+$/.test(n)).length; // conteo independiente de ordenarTrazos

const resp = (malla: string, extra: Partial<Respuesta> = {}): Respuesta => ({
  estructura: ENTRADA_VAGO,
  campo: `trazo:${malla}`,
  veredicto: 'correcto',
  malla,
  ramo: 'no_se',
  version: 'v',
  fecha: '2026-01-01T00:00:00.000Z',
  ...extra,
});
const respondidos = (l: string[]): Record<string, Respuesta> => Object.fromEntries(l.map((m) => [claveTrazo(m), resp(m)]));

describe('ordenarTrazos', () => {
  it('con las mallas del modelo da todos los trazos, sin los de toque, de .l#t00 a .r#t20', () => {
    expect(trazos).toHaveLength(TOTAL);
    expect(TOTAL).toBeGreaterThan(0);
    expect(trazos.some((n) => n.endsWith('#toque'))).toBe(false);
    expect(trazos[0]).toBe('Vagus nerve (X).l#t00');
    expect(trazos[trazos.length - 1]).toBe('Vagus nerve (X).r#t20');
  });

  it('quita repetidos, deja fuera lo que no es trazo o es de toque y ordena', () => {
    const entrada = [
      'Vagus nerve (X).r#t01',
      'Vagus nerve (X).l',
      'Vagus nerve (X).l#t01#toque',
      'Vagus nerve (X).l#t10',
      'Vagus nerve (X).l#t02',
      'Vagus nerve (X).r#t01',
      'Vagus nerve (X).l#t00',
    ];
    expect(ordenarTrazos(entrada)).toEqual([
      'Vagus nerve (X).l#t00',
      'Vagus nerve (X).l#t02',
      'Vagus nerve (X).l#t10',
      'Vagus nerve (X).r#t01',
    ]);
  });
});

describe('trazosPendientes y avanceTrazos', () => {
  it('sin respuestas, todos en orden; con uno respondido, ese ya no está; con todos, ninguno', () => {
    expect(trazosPendientes(trazos, {})).toEqual(trazos);
    const sinPrimero = trazosPendientes(trazos, respondidos([trazos[0]!]));
    expect(sinPrimero).toHaveLength(TOTAL - 1);
    expect(sinPrimero).not.toContain(trazos[0]);
    expect(trazosPendientes(trazos, respondidos(trazos))).toEqual([]);
  });

  it('la respuesta de un trazo se guarda con la clave que ya usan las respuestas en IndexedDB', () => {
    const m = trazos[0]!;
    expect(claveTrazo(m)).toBe(`vagus-nerve-x|trazo:${m}|`);
    const guardada = { [`vagus-nerve-x|trazo:${m}|`]: resp(m) };
    expect(trazosPendientes(trazos, guardada)).not.toContain(m);
  });

  it('las claves ajenas no cuentan', () => {
    const m = trazos[0]!;
    const ajenas: Record<string, Respuesta> = {
      'vagus-nerve-x|nombre|es': resp(m, { campo: 'nombre', idioma: 'es' }),
      [`hippocampus|trazo:${m}|`]: resp(m, { estructura: 'hippocampus' }),
      [`vagus-nerve-x|trazo:${m}|es`]: resp(m, { idioma: 'es' }),
    };
    expect(trazosPendientes(trazos, ajenas)).toEqual(trazos);
  });

  it('una respuesta incompleta (corregir sin ramo) deja el trazo pendiente', () => {
    const m = trazos[0]!;
    const r = { [claveTrazo(m)]: resp(m, { veredicto: 'corregir', ramo: undefined }) };
    expect(trazosPendientes(trazos, r)).toContain(m);
    expect(avanceTrazos(trazos, r).pendientes).toBe(TOTAL);
  });

  it('avanceTrazos cuenta pendientes y total', () => {
    expect(avanceTrazos(trazos, {})).toEqual({ pendientes: TOTAL, total: TOTAL });
    expect(avanceTrazos(trazos, respondidos([trazos[3]!]))).toEqual({ pendientes: TOTAL - 1, total: TOTAL });
    expect(avanceTrazos(trazos, respondidos(trazos))).toEqual({ pendientes: 0, total: TOTAL });
  });
});

describe('siguienteTrazo', () => {
  const [a, b, c, d] = trazos as [string, string, string, string];
  it('sin trazo actual da el primer pendiente', () => {
    expect(siguienteTrazo(trazos, {}, null)).toBe(a);
    expect(siguienteTrazo(trazos, respondidos([a]), null)).toBe(b);
  });
  it('con el actual en medio da el siguiente', () => {
    expect(siguienteTrazo(trazos, {}, b)).toBe(c);
  });
  it('salta los respondidos', () => {
    expect(siguienteTrazo(trazos, respondidos([c]), b)).toBe(d);
  });
  it('si el actual es el último pendiente, vuelve al primero', () => {
    const ultimo = trazos[trazos.length - 1]!;
    expect(siguienteTrazo(trazos, {}, ultimo)).toBe(a);
    expect(siguienteTrazo(trazos, respondidos(trazos.filter((m) => m !== a && m !== ultimo)), ultimo)).toBe(a);
  });
  it('si solo el actual está pendiente, o no hay ninguno, da null', () => {
    expect(siguienteTrazo(trazos, respondidos(trazos.filter((m) => m !== b)), b)).toBeNull();
    expect(siguienteTrazo(trazos, respondidos(trazos), null)).toBeNull();
    expect(siguienteTrazo(trazos, respondidos(trazos), a)).toBeNull();
  });
  it('un actual que no está en la lista da el primer pendiente', () => {
    expect(siguienteTrazo(trazos, respondidos([a]), 'Vagus nerve (X).l#t99')).toBe(b);
  });
});

describe('ramosDeTrazo', () => {
  it('son los marcadores del vago, menos el foramen yugular', () => {
    const ramos = ramosDeTrazo();
    expect(ramos).not.toContain('m-jugular-foramen');
    expect(ramos).toContain('m-pharyngeal-branch-of-vagus-nerve');
    expect(ramos).toContain('m-superior-laryngeal-nerve');
    for (const id of ramos) expect(marcadores.find((m) => m.id === id)?.padre).toBe(GRUPO_VAGO);
  });
});

describe('datos de la auditoría (src/data/trazos-vago.json)', () => {
  const tabla = readFileSync('docs/research/vago/auditoria-vago.md', 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| Vagus nerve (X).'))
    .map((l) => {
      const c = l.split('|').map((x) => x.trim());
      return { malla: c[1]!, propuesta: c[5]! };
    });

  it('trae un registro por trazo del modelo y por fila de la tabla, con la columna Propuesta tal cual', () => {
    expect(tabla).toHaveLength(TOTAL);
    expect(trazosAuditados.map((t) => t.malla)).toEqual(trazos);
    expect(trazosAuditados.map((t) => t.malla)).toEqual(tabla.map((f) => f.malla));
    expect(trazosAuditados.map((t) => t.auditoria)).toEqual(tabla.map((f) => f.propuesta));
  });

  it('solo propone cuando la auditoría da una sola opción de la lista', () => {
    const fija: Record<string, string> = {
      'candidato: ramo faríngeo': 'm-pharyngeal-branch-of-vagus-nerve',
      'candidato: nervio laríngeo superior': 'm-superior-laryngeal-nerve',
      'tronco del vago': 'no_es_ramo',
    };
    for (const t of trazosAuditados) expect(t.propuesta, t.malla).toBe(fija[t.auditoria] ?? null);
    const conPropuesta = trazosAuditados.filter((t) => t.propuesta !== null).map((t) => t.malla);
    expect(conPropuesta).toEqual([
      'Vagus nerve (X).l#t01',
      'Vagus nerve (X).l#t02',
      'Vagus nerve (X).r#t01',
      'Vagus nerve (X).r#t02',
    ]);
    const validas = [...ramosDeTrazo(), 'no_es_ramo'];
    for (const t of trazosAuditados) if (t.propuesta !== null) expect(validas).toContain(t.propuesta);
  });

  it('cada registro trae su fuente y el archivo no tiene guion largo', () => {
    for (const t of trazosAuditados) expect(t.fuente.trim(), t.malla).not.toBe('');
    const texto = readFileSync('src/data/trazos-vago.json', 'utf8');
    expect(texto.includes(String.fromCharCode(0x2014))).toBe(false);
  });

  it('propuestaDeTrazo lee del archivo', () => {
    expect(propuestaDeTrazo('Vagus nerve (X).r#t01')).toBe('m-pharyngeal-branch-of-vagus-nerve');
    expect(propuestaDeTrazo('Vagus nerve (X).l#t02')).toBe('no_es_ramo');
    expect(propuestaDeTrazo('Vagus nerve (X).r#t03')).toBeNull();
    expect(propuestaDeTrazo('Vagus nerve (X).l#t99')).toBeNull();
  });
});
