// Trazos del vago (#62): lógica pura de la lista y datos copiados de la auditoría del modelo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRUPO_VAGO, marcadores, trazosAuditados } from '../src/data/atlas';
import type { Respuesta } from '../src/lib/revision';
import {
  auditoriaDeTrazo,
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
  // Tabla de docs/research/vago/auditoria-vago.md: Trazo | Altura | Largo | Cercanos | Propuesta | Regla | Confianza | Fuente.
  const tabla = readFileSync('docs/research/vago/auditoria-vago.md', 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| Vagus nerve (X).'))
    .map((l) => {
      const c = l.split('|').map((x) => x.trim());
      expect(c, l).toHaveLength(10);
      // Las piezas de "Cercanos (arriba / abajo)": "Pieza 3 mm, Otra 5 mm / Pieza 4 mm, Otra 6 mm".
      const piezas = c[4]!.split(/ \/ |, /).map((p) => p.replace(/ \d+ mm$/, ''));
      return { malla: c[1]!, piezas, propuesta: c[5]!, regla: c[6]!, confianza: c[7]!, fuente: c[8]! };
    });
  const filaDe = (malla: string) => tabla.find((f) => f.malla === malla)!;
  const conRegla = (regla: string) => trazosAuditados.filter((t) => filaDe(t.malla).regla === regla);

  // Claves de la bibliografía: las líneas "- [Clave] ..." que siguen a "## Referencias".
  const fuentes = readFileSync('docs/research/marcadores/fuentes.md', 'utf8');
  const claves = fuentes
    .slice(fuentes.indexOf('\n## Referencias'))
    .split('\n')
    .flatMap((l) => /^- \[([^\]]+)\]/.exec(l)?.[1] ?? []);

  it('trae un registro por trazo del modelo y por fila de la tabla, en el mismo orden', () => {
    expect(tabla).toHaveLength(TOTAL);
    expect(trazosAuditados).toHaveLength(TOTAL);
    expect(trazosAuditados.map((t) => t.malla)).toEqual(trazos);
    expect(trazosAuditados.map((t) => t.malla)).toEqual(tabla.map((f) => f.malla));
  });

  it('D2: la tabla y el archivo coinciden trazo por trazo en propuesta de la auditoría, confianza y fuente', () => {
    for (const [i, t] of trazosAuditados.entries()) {
      const f = tabla[i]!;
      expect(t.malla).toBe(f.malla);
      expect(t.auditoria, t.malla).toBe(f.propuesta);
      expect(t.confianza ?? '-', t.malla).toBe(f.confianza); // la tabla pone "-" donde el archivo tiene null
      expect(t.fuente, t.malla).toBe(f.fuente);
    }
  });

  it('R4.1: cada trazo trae evidencia en es y en, con altura, largo y las piezas cercanas de la tabla', () => {
    for (const t of trazosAuditados) {
      const e = t.evidencia;
      expect(e, t.malla).toBeDefined();
      expect(e!.es.trim(), t.malla).not.toBe('');
      expect(e!.en.trim(), t.malla).not.toBe('');
      expect(e!.es, t.malla).toContain('Altura: ');
      expect(e!.es, t.malla).toContain('Largo: ');
      expect(e!.en, t.malla).toContain('Height: ');
      expect(e!.en, t.malla).toContain('Length: ');
      const piezas = filaDe(t.malla).piezas;
      expect(piezas.length, t.malla).toBeGreaterThan(0);
      for (const pieza of piezas) {
        expect(e!.es, `${t.malla}: ${pieza}`).toContain(pieza);
        expect(e!.en, `${t.malla}: ${pieza}`).toContain(pieza);
      }
    }
  });

  it('R4.2: la confianza es no nula exactamente cuando hay propuesta, y con ella la evidencia da la razón', () => {
    expect(trazosAuditados.some((t) => t.propuesta !== null)).toBe(true);
    for (const t of trazosAuditados) {
      expect(Object.hasOwn(t, 'confianza'), t.malla).toBe(true);
      if (t.propuesta === null) {
        expect(t.confianza, t.malla).toBeNull();
        continue;
      }
      expect(['alta', 'media', 'baja'], t.malla).toContain(t.confianza);
      expect(t.evidencia!.es, t.malla).toContain('Confianza ');
      expect(t.evidencia!.en, t.malla).toMatch(/confidence/);
    }
  });

  it('R4.3: cada raicilla propone no_es_ramo y su evidencia dice Raicilla y Rootlet', () => {
    const raicillas = conRegla('raicilla');
    expect(raicillas.length).toBeGreaterThan(0);
    for (const t of raicillas) {
      expect(t.propuesta, t.malla).toBe('no_es_ramo');
      expect(t.evidencia!.es, t.malla).toContain('Raicilla');
      expect(t.evidencia!.en, t.malla).toContain('Rootlet');
    }
  });

  it('R4.4: cada trazo sin_regla queda sin propuesta ni confianza, y la evidencia dice que la regla no distingue', () => {
    const sinRegla = conRegla('sin_regla');
    expect(sinRegla.length).toBeGreaterThan(0);
    for (const t of sinRegla) {
      expect(t.propuesta, t.malla).toBeNull();
      expect(t.confianza, t.malla).toBeNull();
      expect(t.evidencia!.es, t.malla).toContain('La regla no distingue entre ramos');
      expect(t.evidencia!.en, t.malla).toContain('does not distinguish');
    }
  });

  it('la propuesta sigue a la regla: tronco y raicilla no son ramo, el resto es un ramo de la lista, y sin_regla ninguno', () => {
    const ramos = ramosDeTrazo();
    for (const t of trazosAuditados) {
      const regla = filaDe(t.malla).regla;
      if (regla === 'sin_regla') expect(t.propuesta, t.malla).toBeNull();
      else if (regla === 'tronco' || regla === 'raicilla') expect(t.propuesta, t.malla).toBe('no_es_ramo');
      else expect(ramos, `${t.malla} (${regla})`).toContain(t.propuesta);
    }
    const validas = [...ramos, 'no_es_ramo'];
    for (const t of trazosAuditados) if (t.propuesta !== null) expect(validas).toContain(t.propuesta);
  });

  it('R4.5: la fuente de cada trazo es una clave de la bibliografía y la evidencia la cita', () => {
    expect(claves.length).toBeGreaterThan(0);
    for (const t of trazosAuditados) {
      expect(claves, t.malla).toContain(t.fuente);
      expect(t.evidencia!.es, t.malla).toContain(`Fuente: ${t.fuente}.`);
      expect(t.evidencia!.en, t.malla).toContain(`Source: ${t.fuente}.`);
    }
  });

  it('el archivo y la auditoría no tienen guion largo', () => {
    const guion = String.fromCharCode(0x2014);
    expect(readFileSync('src/data/trazos-vago.json', 'utf8').includes(guion)).toBe(false);
    expect(readFileSync('docs/research/vago/auditoria-vago.md', 'utf8').includes(guion)).toBe(false);
  });

  it('D3: propuestaDeTrazo lee del archivo para los trazos y da null para una malla desconocida', () => {
    for (const t of trazosAuditados) expect(propuestaDeTrazo(t.malla), t.malla).toBe(t.propuesta);
    expect(propuestaDeTrazo('Vagus nerve (X).l#t99')).toBeNull();
  });

  it('R5.1: auditoriaDeTrazo da propuesta, confianza, evidencia y fuente del registro de cada trazo', () => {
    expect(trazosAuditados.length).toBeGreaterThan(0);
    for (const t of trazosAuditados) {
      const a = auditoriaDeTrazo(t.malla);
      expect(a, t.malla).not.toBeNull();
      expect(a!.propuesta, t.malla).toBe(t.propuesta);
      expect(a!.confianza, t.malla).toBe(t.confianza ?? null);
      expect(a!.evidencia, t.malla).toEqual(t.evidencia);
      expect(a!.fuente, t.malla).toBe(t.fuente);
    }
  });

  it('R5.1: un trazo sin propuesta da confianza null y conserva la evidencia; una malla desconocida da null', () => {
    const sin = trazosAuditados.filter((t) => t.propuesta === null);
    expect(sin.length).toBeGreaterThan(0);
    for (const t of sin) {
      const a = auditoriaDeTrazo(t.malla)!;
      expect(a.propuesta, t.malla).toBeNull();
      expect(a.confianza, t.malla).toBeNull();
      expect(a.evidencia?.es.trim(), t.malla).toBeTruthy();
      expect(a.evidencia?.en.trim(), t.malla).toBeTruthy();
    }
    expect(auditoriaDeTrazo('Vagus nerve (X).l#t99')).toBeNull();
  });

  it('D3: es.json y en.json traen revision.confianza_<c> para cada confianza presente en el archivo', () => {
    const textos = (i: 'es' | 'en') => (JSON.parse(readFileSync(`src/i18n/${i}.json`, 'utf8')) as { revision: Record<string, unknown> }).revision;
    const presentes = new Set(trazosAuditados.flatMap((t) => (t.confianza ? [t.confianza] : [])));
    expect(presentes.size).toBeGreaterThan(0);
    for (const c of presentes) {
      for (const i of ['es', 'en'] as const) {
        const v = textos(i)[`confianza_${c}`];
        expect(typeof v === 'string' && v.trim() !== '', `${i}: confianza_${c}`).toBe(true);
      }
    }
  });
});
