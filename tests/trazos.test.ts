// Trazos del vago (#62): lógica pura de la lista y datos copiados de la auditoría del modelo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { GRUPO_VAGO, marcadores, nodos, trazosAuditados } from '../src/data/atlas';
import { nombrePieza } from '../src/lib/nombres';
import type { Respuesta } from '../src/lib/revision';
import { nombrePiezaEvidencia, validarNombresPiezas } from '../scripts/lib/trazos.ts';
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
  const NOMBRES = validarNombresPiezas(JSON.parse(readFileSync('pipeline/nombres-anclajes.json', 'utf8')));
  const evidenciaDe = (malla: string) => trazosAuditados.find((t) => t.malla === malla)!.evidencia!;
  // El `t` de i18next, leyendo las claves de es.json y en.json.
  const tDe = (idioma: 'es' | 'en') => {
    const textos = JSON.parse(readFileSync(`src/i18n/${idioma}.json`, 'utf8')) as Record<string, unknown>;
    return ((clave: string) => clave.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], textos)) as unknown as TFunction;
  };
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

  it('R4.1: cada trazo trae evidencia en es y en, con altura, largo y las piezas cercanas de la tabla, por su nombre en la app', () => {
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
        expect(e!.es, `${t.malla}: ${pieza}`).toContain(nombrePiezaEvidencia(pieza, NOMBRES, 'es'));
        expect(e!.en, `${t.malla}: ${pieza}`).toContain(nombrePiezaEvidencia(pieza, NOMBRES, 'en'));
      }
    }
  });

  it('D1: ninguna evidencia lleva el sufijo de lado .l/.r ni el nombre crudo de una malla', () => {
    expect(Object.keys(NOMBRES).length).toBeGreaterThanOrEqual(24);
    for (const t of trazosAuditados) {
      for (const idioma of ['es', 'en'] as const) {
        expect(t.evidencia![idioma], `${t.malla} ${idioma}`).not.toMatch(/\.(l|r)\b/);
        for (const malla of Object.keys(NOMBRES)) {
          if (idioma === 'es') expect(t.evidencia!.es, `${t.malla}: ${malla}`).not.toContain(malla);
        }
      }
    }
  });

  it('D2: el nombre de cada pieza de la app en la tabla es el que da nombrePieza, y las demás traen su fuente de TA2', () => {
    const enLaApp = Object.values(nodos).filter((n) => n.malla !== undefined);
    for (const [malla, n] of Object.entries(NOMBRES)) {
      if (n.pieza !== undefined) {
        expect(nodos[n.pieza]?.malla, malla).toBe(malla);
        for (const idioma of ['es', 'en'] as const) {
          expect(nombrePiezaEvidencia(malla, NOMBRES, idioma), `${malla} ${idioma}`).toBe(nombrePieza(n.pieza, idioma, tDe(idioma)));
        }
        expect(n.fuente, malla).toBe('src/data/estructuras.json');
      } else {
        expect(enLaApp.some((x) => x.malla === malla), `${malla} está en la app pero la tabla no trae su pieza`).toBe(false);
        expect(n.fuente, malla).toMatch(/^TA2 \(Z-Anatomy\)/);
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

  it('R4.4: cada trazo sin_regla queda sin propuesta ni confianza, y la evidencia nombra la regla más cercana y cada condición que falla', () => {
    const sinRegla = conRegla('sin_regla');
    expect(sinRegla.length).toBeGreaterThan(0);
    for (const t of sinRegla) {
      expect(t.propuesta, t.malla).toBeNull();
      expect(t.confianza, t.malla).toBeNull();
      expect(t.evidencia!.es, t.malla).toContain('Ninguna regla se cumple: queda sin propuesta.');
      expect(t.evidencia!.es, t.malla).toMatch(/la regla más cercana es|las reglas más cercanas son/);
      expect(t.evidencia!.es, t.malla).toMatch(/no se cumple que .*\(falla (por \d+,\d mm|por menos de 0,1 mm)\)/);
      expect(t.evidencia!.en, t.malla).toContain('No rule is met: no proposal.');
      expect(t.evidencia!.en, t.malla).toMatch(/not met: .*\(fails (by \d+\.\d mm|by less than 0\.1 mm)\)/);
      for (const x of [t.evidencia!.es, t.evidencia!.en]) expect(x, t.malla).not.toMatch(/no distingue|does not distinguish/);
    }
    // Los trazos con regla no llevan esas frases.
    for (const t of trazosAuditados.filter((x) => x.propuesta !== null)) expect(t.evidencia!.es, t.malla).not.toContain('Ninguna regla se cumple');
  });

  it('D4: los seis trazos del bulbo tienen a la raicilla como regla más cercana y esta es exactamente su lista de fallas: `detras_oliva` en los seis y, además, `sobre_foramen` en l#t04 y r#t18', () => {
    const oliva = (mm: string) => ({
      es: `no se cumple que su extremo superior quede por detrás de la oliva (falla por ${mm.replace('.', ',')} mm)`,
      en: `not met: its upper end lies dorsal to the olive (fails by ${mm} mm)`,
    });
    const foramen = { es: ' y que todo el trazo quede por encima del foramen yugular (falla por 0,4 mm)', en: '; the whole trace lies above the jugular foramen (fails by 0.4 mm)' };
    const esperado: [string, string, boolean][] = [
      ['l#t03', '1.2', false],
      ['l#t04', '0.6', true],
      ['l#t05', '0.6', false],
      ['r#t17', '1.2', false],
      ['r#t18', '0.6', true],
      ['r#t19', '0.6', false],
    ];
    for (const [corto, mm, conForamen] of esperado) {
      const malla = `Vagus nerve (X).${corto}`;
      const e = evidenciaDe(malla);
      expect(filaDe(malla).regla, malla).toBe('sin_regla');
      // La lista entera, con su cierre: la regla más cercana y cada condición que falla, ni una más.
      expect(e.es, malla).toContain(`la regla más cercana es la de la raicilla; ${oliva(mm).es}${conForamen ? foramen.es : ''}. Fuente: `);
      expect(e.en, malla).toContain(`the closest rule is the rootlet rule; ${oliva(mm).en}${conForamen ? foramen.en : ''}. Source: `);
      const fallas = conForamen ? 2 : 1;
      expect(e.es.split('(falla por ').length - 1, malla).toBe(fallas);
      expect(e.en.split('(fails by ').length - 1, malla).toBe(fallas);
      expect(e.es, malla).not.toContain('ramo faríngeo');
    }
  });

  it('D4: el trazo r#t09 cruza el hiato por 0,2 mm: es abdominal y no nombra las reglas del cuello', () => {
    const e = evidenciaDe('Vagus nerve (X).r#t09');
    expect(e.es).toContain('la regla más cercana es la del ramo hepático; no se cumple que todo el trazo quede por debajo del hiato esofágico (falla por 0,2 mm).');
    expect(e.en).toContain('the closest rule is the hepatic branch rule; not met: the whole trace lies below the oesophageal hiatus (fails by 0.2 mm).');
    expect(e.es).not.toMatch(/faríngeo|laríngeo/);
  });

  it('la propuesta de cada trazo es la que la regla de su fila da en pipeline/reglas_vago.py (PROPUESTA)', () => {
    // El mapa regla -> propuesta se lee del código que la decide, sin copiarlo: `"regla": "id"` o `"regla": None`.
    const py = readFileSync('pipeline/reglas_vago.py', 'utf8');
    const bloque = /^PROPUESTA = \{([^}]*)\}/m.exec(py)?.[1] ?? '';
    const porRegla = new Map([...bloque.matchAll(/"(\w+)":\s*(?:"([^"]+)"|None)/g)].map((m) => [m[1]!, m[2] ?? null]));
    expect(porRegla.size).toBeGreaterThan(0);
    expect(porRegla.get('sin_regla')).toBeNull();
    expect(porRegla.get('raicilla')).toBe('no_es_ramo');
    for (const t of trazosAuditados) {
      const regla = filaDe(t.malla).regla;
      expect(porRegla.has(regla), `${t.malla}: regla ${regla} sin propuesta en reglas_vago.py`).toBe(true);
      expect(t.propuesta, `${t.malla} (${regla})`).toBe(porRegla.get(regla));
    }
    const ramos = ramosDeTrazo();
    for (const [regla, id] of porRegla) if (id !== null && id !== 'no_es_ramo') expect(ramos, regla).toContain(id);
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
