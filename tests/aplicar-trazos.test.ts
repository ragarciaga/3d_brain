// Aplicador de propuestas de trazos del vago (spec 04, T6): la lógica pura de scripts/lib/trazos.ts y el CLI
// scripts/aplicar-trazos.ts, que se corre con spawnSync en carpetas temporales (nunca con la raíz del repo como cwd).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ramosDeTrazo } from '../src/lib/trazos';
import type { Marcador, PropuestaTrazo } from '../src/data/tipos';
import { bandas, type Banda, type Rutas } from '../scripts/lib/asimetrias.ts';
import { TRONCO_VAGO } from '../scripts/lib/modelo.ts';
import {
  aplicarMediciones,
  argumentosAplicarTrazos,
  evidenciaDeTrazo,
  ramosDeMarcadores,
  REGLAS_TRAZO,
  RUTAS_POR_DEFECTO,
  serializarTrazos,
  validarMediciones,
  type Medicion,
  type ReglaTrazo,
} from '../scripts/lib/trazos.ts';

const raiz = resolve('.');
const rutaMarcadores = join(raiz, 'src/data/marcadores.json');
const textoMarcadores = readFileSync(rutaMarcadores, 'utf8');
const marcadores = JSON.parse(textoMarcadores) as Marcador[];
const textoReal = readFileSync(join(raiz, 'src/data/trazos-vago.json'), 'utf8');
const real = JSON.parse(textoReal) as { trazos: PropuestaTrazo[] };
const rutaRutas = join(raiz, 'public/modelos/rutas-vago.json');
const textoRutas = readFileSync(rutaRutas, 'utf8');
const BANDAS = bandas(JSON.parse(textoRutas) as Rutas);
const RAMOS = ramosDeMarcadores(marcadores);
const GUION_LARGO = String.fromCharCode(0x2014);
const HEPATICO = 'm-hepatic-branches-of-anterior-vagal-trunk';
const MALLA_REAL = 'Vagus nerve (X).l#t03';

const carpetas: string[] = [];
function carpeta(): string {
  const c = mkdtempSync(join(tmpdir(), 'atlas-trazos-'));
  carpetas.push(c);
  return c;
}
afterEach(() => {
  while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
});

const PROPUESTA: Record<ReglaTrazo, string | null> = {
  raicilla: 'no_es_ramo',
  tronco: 'no_es_ramo',
  faringeo: 'm-pharyngeal-branch-of-vagus-nerve',
  laringeo_superior: 'm-superior-laryngeal-nerve',
  abdominal_hepatico: HEPATICO,
  abdominal_gastrico_anterior: 'm-anterior-gastric-branches-of-anterior-vagal-trunk',
  abdominal_gastrico_posterior: 'm-posterior-gastric-branches-of-posterior-vagal-trunk',
  abdominal_celiaco: 'm-coeliac-branches-of-posterior-vagal-trunk',
  sin_regla: null,
};

/** Una medición con el esquema de pipeline/reglas_vago.py (T5); `extra` pisa cualquier campo. */
function medida(regla: ReglaTrazo, extra: Record<string, unknown> = {}): Medicion {
  return {
    altura_mm: { max: 1631.4, min: 1619.8 },
    largo_mm: 12.5,
    cerca_extremos: {
      superior: [
        { pieza: 'Medulla oblongata.l', mm: 2.5 },
        { pieza: 'Olive.l', mm: 9.7 },
      ],
      inferior: [
        { pieza: 'Liver', mm: 4.2 },
        { pieza: 'Stomach', mm: 11.3 },
      ],
    },
    regla,
    auditoria: `texto de ${regla}`,
    propuesta: PROPUESTA[regla],
    confianza: regla === 'sin_regla' ? null : 'alta',
    fuente: 'Kim2022',
    ...extra,
  } as Medicion;
}

/** Tres trazos; el primero trae una clave extra `nota`. */
function sinteticos(): { trazos: PropuestaTrazo[] } {
  return {
    trazos: [
      { malla: 'M0', auditoria: 'sin candidato', propuesta: null, fuente: 'viejo', nota: 'aparte' } as PropuestaTrazo,
      { malla: 'M1', auditoria: 'antes', propuesta: null, fuente: 'viejo1' },
      { malla: 'M2', auditoria: 'otro', propuesta: null, fuente: 'viejo2' },
    ],
  };
}

function aplicar(medidos: Record<string, unknown>, datos = sinteticos(), bandasUsadas: readonly Banda[] = BANDAS) {
  return aplicarMediciones(datos, medidos, RAMOS, bandasUsadas);
}

/** Texto de la sección `## malla` del resumen, hasta la siguiente. */
function seccion(resumen: string, malla: string): string {
  const s = resumen.split(/^## /m).slice(1).find((x) => x.startsWith(`${malla}\n`));
  if (s === undefined) throw new Error(`sin sección ${malla}`);
  return s;
}

function cli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [join(raiz, 'scripts/aplicar-trazos.ts'), ...args], { cwd, encoding: 'utf8' });
}

describe('formato (D1)', () => {
  it('aplicar {} al archivo real y serializar da el mismo texto, byte a byte', () => {
    expect(serializarTrazos(aplicar({}, real).datos)).toBe(textoReal);
  });

  it('el CLI con {} sobre una copia la deja idéntica', () => {
    const dir = carpeta();
    writeFileSync(join(dir, 't.json'), textoReal);
    writeFileSync(join(dir, 'm.json'), '{}');
    writeFileSync(join(dir, 'rutas.json'), textoRutas);
    const r = cli(dir, ['--medidos', 'm.json', '--trazos', 't.json', '--marcadores', rutaMarcadores, '--resumen', 'r.md', '--rutas', 'rutas.json']);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(dir, 't.json'), 'utf8')).toBe(textoReal);
  });
});

describe('evidencia (R4.1)', () => {
  it('trae altura, largo y las piezas cercanas de cada extremo con sus mm, en es con coma y en en con punto', () => {
    const { datos } = aplicar({ M1: medida('faringeo') });
    const e = datos.trazos[1]!.evidencia!;
    expect(e.es).toContain('Altura: de 1631,4 a 1619,8 mm. Largo: 12,5 mm.');
    expect(e.es).toContain('Cerca del extremo superior: Medulla oblongata.l (2,5 mm), Olive.l (9,7 mm).');
    expect(e.es).toContain('Cerca del extremo inferior: Liver (4,2 mm), Stomach (11,3 mm).');
    expect(e.en).toContain('Height: from 1631.4 to 1619.8 mm. Length: 12.5 mm.');
    expect(e.en).toContain('Near the upper end: Medulla oblongata.l (2.5 mm), Olive.l (9.7 mm).');
    expect(e.en).toContain('Near the lower end: Liver (4.2 mm), Stomach (11.3 mm).');
    expect(e.es).not.toContain('12.5');
    expect(e.en).not.toContain('12,5');
  });

  it('un extremo con una sola pieza lista solo esa', () => {
    const m = medida('tronco', { cerca_extremos: { superior: [{ pieza: 'Solo', mm: 1 }], inferior: [{ pieza: 'Otra', mm: 22 }] } });
    expect(evidenciaDeTrazo(m).es).toContain('Cerca del extremo superior: Solo (1,0 mm). Cerca del extremo inferior: Otra (22,0 mm).');
  });
});

describe('ramo, confianza y razón (R4.2)', () => {
  const casos = [
    ['alta', 'Confianza alta:', 'High confidence:', 'está a más del doble de distancia', 'is more than twice as far'],
    ['media', 'Confianza media:', 'Medium confidence:', 'está a no más del doble de distancia', 'is no more than twice as far'],
    ['baja', 'Confianza baja:', 'Low confidence:', 'alguna medida de la regla queda a menos de 3 mm de su umbral', 'some measure of the rule is less than 3 mm from its threshold'],
  ] as const;

  it.each(casos)('nivel %s: propuesta el ramo, confianza copiada y solo la razón de ese nivel', (nivel, es, en, esFrase, enFrase) => {
    const { datos } = aplicar({ M1: medida('abdominal_hepatico', { confianza: nivel }) });
    const t = datos.trazos[1]!;
    expect(t.propuesta).toBe(HEPATICO);
    expect(t.confianza).toBe(nivel);
    expect(t.evidencia!.es).toContain(es);
    expect(t.evidencia!.es).toContain(esFrase);
    expect(t.evidencia!.en).toContain(en);
    expect(t.evidencia!.en).toContain(enFrase);
    for (const otro of casos.filter((c) => c[0] !== nivel)) {
      expect(t.evidencia!.es).not.toContain(otro[1]);
      expect(t.evidencia!.es).not.toContain(otro[3]);
      expect(t.evidencia!.en).not.toContain(otro[2]);
      expect(t.evidencia!.en).not.toContain(otro[4]);
    }
  });

  it('la razón dice medida y umbral, no umbral y límite', () => {
    const alta = aplicar({ M1: medida('faringeo', { confianza: 'alta' }) }).datos.trazos[1]!.evidencia!;
    const baja = aplicar({ M1: medida('faringeo', { confianza: 'baja' }) }).datos.trazos[1]!.evidencia!;
    expect(alta.es).toContain('ninguna medida de la regla queda a menos de 3 mm de su umbral');
    expect(alta.en).toContain('no measure of the rule is less than 3 mm from its threshold');
    expect(baja.es).toContain('alguna medida de la regla queda a menos de 3 mm de su umbral');
    expect(baja.en).toContain('some measure of the rule is less than 3 mm from its threshold');
    for (const t of [alta.es, alta.en, baja.es, baja.en]) expect(t).not.toMatch(/límite|limit\b/);
  });

  it('la regla de un ramo sale en palabras, sin la frase de la raicilla ni la de sin regla', () => {
    const e = aplicar({ M1: medida('abdominal_hepatico') }).datos.trazos[1]!.evidencia!;
    expect(e.es).toContain('Regla del ramo hepático');
    expect(e.es).not.toContain('Raicilla');
    expect(e.es).not.toContain('no distingue');
    expect(e.en).toContain('Hepatic branch rule');
  });

  it('el extremo de la razón es el inferior en un ramo y el superior en la raicilla', () => {
    const ramo = aplicar({ M1: medida('faringeo') }).datos.trazos[1]!.evidencia!;
    expect(ramo.es).toContain('en el extremo inferior, la segunda pieza');
    expect(ramo.en).toContain('at the lower end, the second closest piece');
    expect(ramo.es).not.toContain('en el extremo superior,');
  });
});

describe('raicilla (R4.3)', () => {
  it('sale no_es_ramo, la evidencia dice raicilla en es y rootlet en en, y la razón nombra el extremo superior', () => {
    const t = aplicar({ M1: medida('raicilla', { confianza: 'media' }) }).datos.trazos[1]!;
    expect(t.propuesta).toBe('no_es_ramo');
    expect(t.confianza).toBe('media');
    expect(t.evidencia!.es).toContain('Raicilla');
    expect(t.evidencia!.en).toContain('Rootlet');
    expect(t.evidencia!.es).toContain('en el extremo superior, la segunda pieza');
    expect(t.evidencia!.en).toContain('at the upper end, the second closest piece');
    expect(t.evidencia!.es).not.toContain('en el extremo inferior,');
  });
});

describe('frases de la regla: lo que mide pipeline/reglas_vago.py', () => {
  it('la raicilla exige que todo el trazo quede por encima del foramen yugular, no solo el extremo', () => {
    const e = aplicar({ M1: medida('raicilla') }).datos.trazos[1]!.evidencia!;
    expect(e.es).toContain('todo el trazo queda por encima del foramen yugular');
    expect(e.en).toContain('the whole trace lies above the jugular foramen');
  });

  it.each([
    ['abdominal_gastrico_anterior', 'anterior', 'izquierdo'],
    ['abdominal_gastrico_posterior', 'posterior', 'derecho'],
  ] as const)('el ramo %s exige el estómago más cerca que las otras piezas de destino, como el hepático', (regla, cara, lado) => {
    const e = aplicar({ M1: medida(regla) }).datos.trazos[1]!.evidencia!;
    expect(e.es).toContain(`queda cerca del estómago, más cerca de él que de las otras piezas de destino, en su cara ${cara}, en el vago ${lado}`);
    expect(e.en).toContain('lies near the stomach, closer to it than to the other target pieces, on its');
  });
});

describe('sin regla (R4.4)', () => {
  it('sale con propuesta y confianza null, y la evidencia dice que la regla no distingue entre ramos', () => {
    const t = aplicar({ M1: medida('sin_regla') }).datos.trazos[1]!;
    expect(t.propuesta).toBeNull();
    expect(t.confianza).toBeNull();
    expect(t.evidencia!.es).toContain('La regla no distingue entre ramos');
    expect(t.evidencia!.en).toContain('The rule does not distinguish between branches');
    expect(t.evidencia!.es).not.toContain('Confianza');
    expect(t.evidencia!.en).not.toContain('confidence');
  });

  it('con una regla que propone, esa frase no aparece', () => {
    const e = aplicar({ M1: medida('tronco') }).datos.trazos[1]!.evidencia!;
    expect(e.es).not.toContain('no distingue');
    expect(e.en).not.toContain('does not distinguish');
  });
});

describe('fuente (R4.5)', () => {
  it.each([
    ['raicilla', 'Kim2022'],
    ['faringeo', 'Mansour2021'],
  ] as const)('con regla %s la fuente es la clave de la medición, copiada tal cual, y la evidencia la cita', (regla, fuente) => {
    const t = aplicar({ M1: medida(regla, { fuente }) }).datos.trazos[1]!;
    expect(t.fuente).toBe(fuente);
    expect(t.fuente).not.toBe(regla);
    expect(t.evidencia!.es).toContain(`Fuente: ${fuente}.`);
    expect(t.evidencia!.en).toContain(`Source: ${fuente}.`);
  });
});

describe('lo que no cambia (R6.2)', () => {
  it('malla, nota y el orden de las claves anteriores quedan iguales; solo se agregan evidencia y confianza', () => {
    const antes = sinteticos().trazos[0]!;
    const t = aplicar({ M0: medida('raicilla') }).datos.trazos[0]! as PropuestaTrazo & { nota: string };
    expect(t.malla).toBe('M0');
    expect(t.nota).toBe('aparte');
    expect(Object.keys(t).slice(0, Object.keys(antes).length)).toEqual(Object.keys(antes));
    expect(Object.keys(t).sort()).toEqual([...Object.keys(antes), 'evidencia', 'confianza'].sort());
    expect(t.auditoria).toBe('texto de raicilla');
    expect(t.propuesta).toBe('no_es_ramo');
    expect(t.fuente).toBe('Kim2022');
  });

  it('el orden de los trazos y los trazos sin medición quedan iguales, y el resumen dice por qué', () => {
    const { datos, resumen } = aplicar({ M1: medida('faringeo') });
    expect(datos.trazos.map((t) => t.malla)).toEqual(['M0', 'M1', 'M2']);
    expect(datos.trazos[0]).toEqual(sinteticos().trazos[0]);
    expect(datos.trazos[2]).toEqual(sinteticos().trazos[2]);
    expect(datos.trazos[1]).not.toEqual(sinteticos().trazos[1]);
    expect(seccion(resumen, 'M0')).toContain('Resultado: sin cambios');
    expect(seccion(resumen, 'M0')).toContain('no hay medición para este trazo');
    expect(seccion(resumen, 'M1')).toContain('Resultado: actualizado');
  });

  it('en el archivo real, una medición solo cambia su trazo y solo líneas de su objeto', () => {
    const { datos } = aplicar({ [MALLA_REAL]: medida('faringeo') }, real);
    expect(datos.trazos).toHaveLength(28);
    expect(datos.trazos.map((t) => t.malla)).toEqual(real.trazos.map((t) => t.malla));
    for (const [i, t] of real.trazos.entries()) {
      if (t.malla !== MALLA_REAL) expect(datos.trazos[i], t.malla).toEqual(t);
    }
    const nuevo = datos.trazos.find((t) => t.malla === MALLA_REAL)!;
    expect(nuevo.propuesta).toBe('m-pharyngeal-branch-of-vagus-nerve');
    expect(nuevo.evidencia).toBeDefined();

    const a = textoReal.split('\n');
    const b = serializarTrazos(datos).split('\n');
    const inicio = a.findIndex((l) => l.includes(`"malla": "${MALLA_REAL}"`));
    const fin = a.findIndex((l, i) => i > inicio && /^ {4}\},?$/.test(l));
    let prefijo = 0;
    while (a[prefijo] === b[prefijo]) prefijo++;
    let sufijo = 0;
    while (a[a.length - 1 - sufijo] === b[b.length - 1 - sufijo]) sufijo++;
    expect(prefijo).toBeGreaterThanOrEqual(inicio);
    expect(sufijo).toBeGreaterThanOrEqual(a.length - fin);
    // Cada clave que el trazo real aún no tenía agrega líneas: 4 por `evidencia` (la clave y su es, su en y el cierre)
    // y 1 por `confianza`. Si ya las trae, el objeto cambia de valores, no de largo.
    const antes = real.trazos.find((t) => t.malla === MALLA_REAL)!;
    expect(b.length - a.length).toBe((antes.evidencia === undefined ? 4 : 0) + (antes.confianza === undefined ? 1 : 0));
  });

  it('aplicar dos veces la misma medición no cambia nada la segunda vez', () => {
    const primera = aplicar({ M1: medida('faringeo') });
    const segunda = aplicar({ M1: medida('faringeo') }, primera.datos);
    expect(segunda.datos).toEqual(primera.datos);
    expect(seccion(segunda.resumen, 'M1')).toContain('Resultado: sin cambios');
    expect(seccion(segunda.resumen, 'M1')).toContain('coincide');
  });

  it('no muta sus entradas', () => {
    const datos = sinteticos();
    const medidos = { M1: medida('faringeo') };
    const ramos = [...RAMOS];
    const copias = structuredClone({ datos, medidos, ramos });
    const bandasEntrada = [...BANDAS];
    const salida = aplicarMediciones(datos, medidos, ramos, bandasEntrada);
    expect({ datos, medidos, ramos }).toEqual(copias);
    expect(bandasEntrada).toEqual(BANDAS);
    expect(salida.datos).not.toBe(datos);
    expect(salida.datos.trazos[1]).not.toBe(datos.trazos[1]);
  });
});

describe('validación (D2)', () => {
  const cambios: [string, Record<string, unknown>][] = [
    ['una propuesta que es el foramen yugular', { propuesta: 'm-jugular-foramen' }],
    ['una propuesta que no existe', { propuesta: 'm-no-existe' }],
    ['una propuesta vacía', { propuesta: '' }],
    ['una propuesta fuera de la lista', { propuesta: 'no_se' }],
    ['una regla desconocida', { regla: 'otra' }],
    ['una clave desconocida', { nota: 'x' }],
    ['una fuente que falta', { fuente: undefined }],
    ['una fuente vacía', { fuente: ' ' }],
    ['un largo que no es finito', { largo_mm: Number.NaN }],
    ['una altura con max menor que min', { altura_mm: { max: 1, min: 2 } }],
    ['sin piezas cerca del extremo superior', { cerca_extremos: { superior: [], inferior: [{ pieza: 'A', mm: 1 }] } }],
    ['tres piezas cerca del extremo inferior', { cerca_extremos: { superior: [{ pieza: 'A', mm: 1 }], inferior: [1, 2, 3].map((n) => ({ pieza: `P${n}`, mm: n })) } }],
    ['una pieza con distancia negativa', { cerca_extremos: { superior: [{ pieza: 'A', mm: -1 }], inferior: [{ pieza: 'A', mm: 1 }] } }],
    ['confianza alta con una sola pieza cerca del extremo inferior', { cerca_extremos: { superior: [{ pieza: 'A', mm: 1 }, { pieza: 'B', mm: 2 }], inferior: [{ pieza: 'A', mm: 1 }] } }],
    ['confianza media con una sola pieza cerca del extremo inferior', { confianza: 'media', cerca_extremos: { superior: [{ pieza: 'A', mm: 1 }, { pieza: 'B', mm: 2 }], inferior: [{ pieza: 'A', mm: 1 }] } }],
    ['una confianza null con propuesta', { confianza: null }],
    ['una confianza fuera de los niveles', { confianza: 'muy alta' }],
    ['un guion largo en la auditoría', { auditoria: `candidato ${GUION_LARGO} ramo` }],
    ['un guion largo en la fuente', { fuente: `Kim${GUION_LARGO}2022` }],
    ['una regla de ramo con no_es_ramo', { propuesta: 'no_es_ramo' }],
    ['una regla de ramo sin propuesta', { propuesta: null, confianza: null }],
  ];

  it.each(cambios)('con %s lanza un error que nombra la malla', (_n, extra) => {
    const m = { ...medida('faringeo'), ...extra };
    if ('fuente' in extra && extra['fuente'] === undefined) delete (m as Partial<Medicion>).fuente;
    expect(() => aplicar({ M1: m })).toThrow(/^M1: /);
  });

  it('la raicilla mira el extremo superior y los ramos el inferior para las dos piezas; la baja no las exige', () => {
    const uno = [{ pieza: 'A', mm: 1 }];
    const dos = [{ pieza: 'A', mm: 1 }, { pieza: 'B', mm: 2 }];
    expect(() => aplicar({ M1: medida('raicilla', { cerca_extremos: { superior: uno, inferior: dos } }) })).toThrow(/^M1: .*superior/);
    expect(() => aplicar({ M1: medida('raicilla', { cerca_extremos: { superior: dos, inferior: uno } }) })).not.toThrow();
    expect(() => aplicar({ M1: medida('faringeo', { cerca_extremos: { superior: dos, inferior: uno } }) })).toThrow(/^M1: .*inferior/);
    expect(() => aplicar({ M1: medida('faringeo', { cerca_extremos: { superior: uno, inferior: dos } }) })).not.toThrow();
    expect(() => aplicar({ M1: medida('faringeo', { confianza: 'baja', cerca_extremos: { superior: uno, inferior: uno } }) })).not.toThrow();
    expect(() => aplicar({ M1: medida('sin_regla', { cerca_extremos: { superior: uno, inferior: uno } }) })).not.toThrow();
  });

  it('una regla raicilla con el id de un ramo lanza', () => {
    expect(() => aplicar({ M1: medida('raicilla', { propuesta: HEPATICO }) })).toThrow(/^M1: /);
  });

  it('una regla sin_regla con propuesta o con confianza lanza', () => {
    expect(() => aplicar({ M1: medida('sin_regla', { propuesta: HEPATICO, confianza: 'alta' }) })).toThrow(/^M1: /);
    expect(() => aplicar({ M1: medida('sin_regla', { confianza: 'alta' }) })).toThrow(/^M1: /);
  });

  it('una malla desconocida lanza con su nombre', () => {
    expect(() => aplicar({ M9: medida('faringeo') })).toThrow(/^M9: malla desconocida/);
  });

  it('una entrada que no es un objeto lanza', () => {
    expect(() => aplicar([] as unknown as Record<string, unknown>)).toThrow(/no es un objeto/);
    expect(() => validarMediciones(null, ['M1'], RAMOS)).toThrow(/no es un objeto/);
  });

  it('un guion largo en los datos que ya estaban se detiene aunque el trazo no tenga medición', () => {
    const datos = sinteticos();
    datos.trazos[2]!.auditoria = `viejo ${GUION_LARGO} texto`;
    expect(() => aplicar({ M1: medida('faringeo') }, datos)).toThrow(/guion largo/);
  });

  it('una medición válida de cada regla pasa', () => {
    const todas = Object.fromEntries(REGLAS_TRAZO.map((r, i) => [`M${i}`, medida(r)]));
    const datos = { trazos: REGLAS_TRAZO.map((_r, i) => ({ malla: `M${i}`, auditoria: 'a', propuesta: null, fuente: 'f' })) };
    expect(Object.keys(validarMediciones(todas, datos.trazos.map((t) => t.malla), RAMOS))).toHaveLength(REGLAS_TRAZO.length);
  });
});

describe('el CLI no escribe si algo falla (D2)', () => {
  function preparar(medidos: unknown) {
    const dir = carpeta();
    writeFileSync(join(dir, 't.json'), textoReal);
    writeFileSync(join(dir, 'm.json'), JSON.stringify(medidos));
    writeFileSync(join(dir, 'r.md'), 'centinela');
    writeFileSync(join(dir, 'rutas.json'), textoRutas);
    return { dir, args: ['--medidos', 'm.json', '--trazos', 't.json', '--marcadores', rutaMarcadores, '--resumen', 'r.md', '--rutas', 'rutas.json'] };
  }

  it.each([
    ['una malla desconocida', 'Vagus nerve (X).z#t99', medida('faringeo')],
    ['una propuesta inválida', MALLA_REAL, medida('faringeo', { propuesta: 'm-jugular-foramen' })],
    ['una regla desconocida', MALLA_REAL, medida('faringeo', { regla: 'otra' })],
  ])('con %s: sale distinto de 0, nombra la malla, no cambia el JSON y no toca el resumen', (_n, malla, m) => {
    const { dir, args } = preparar({ [malla]: m });
    const r = cli(dir, args);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(malla);
    expect(readFileSync(join(dir, 't.json'), 'utf8')).toBe(textoReal);
    expect(readFileSync(join(dir, 'r.md'), 'utf8')).toBe('centinela');

    rmSync(join(dir, 'r.md'));
    expect(cli(dir, args).status).not.toBe(0);
    expect(existsSync(join(dir, 'r.md'))).toBe(false);
  });

  it('si no está el archivo de mediciones, sale con 2 y dice cómo generarlo', () => {
    const r = cli(carpeta(), ['--medidos', 'nada.json']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('auditar-vago.py');
  });

  it('si no está el archivo de rutas, sale con 2, dice cómo generarlo y no escribe nada', () => {
    const { dir, args } = preparar({ [MALLA_REAL]: medida('faringeo') });
    rmSync(join(dir, 'rutas.json'));
    const r = cli(dir, args);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('generar-ramas-vago.py');
    expect(readFileSync(join(dir, 't.json'), 'utf8')).toBe(textoReal);
    expect(readFileSync(join(dir, 'r.md'), 'utf8')).toBe('centinela');
  });

  it('un archivo de rutas sin el objeto "rutas" sale con 1 y lo dice', () => {
    const { dir, args } = preparar({ [MALLA_REAL]: medida('faringeo') });
    writeFileSync(join(dir, 'rutas.json'), '{"otra": 1}');
    const r = cli(dir, args);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('"rutas"');
    expect(readFileSync(join(dir, 't.json'), 'utf8')).toBe(textoReal);
  });

  it('con una medición válida escribe el JSON y el resumen, y no toca marcadores.json', () => {
    const { dir, args } = preparar({ [MALLA_REAL]: medida('faringeo') });
    const copia = join(dir, 'marc.json');
    writeFileSync(copia, textoMarcadores);
    args[args.indexOf(rutaMarcadores)] = copia;
    const r = cli(dir, args);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(copia, 'utf8')).toBe(textoMarcadores);
    const nuevo = JSON.parse(readFileSync(join(dir, 't.json'), 'utf8')) as { trazos: PropuestaTrazo[] };
    expect(nuevo.trazos.find((t) => t.malla === MALLA_REAL)!.evidencia!.es).toContain('Fuente: Kim2022.');
    expect(readFileSync(join(dir, 'r.md'), 'utf8')).toContain(`## ${MALLA_REAL}`);
  });
});

describe('argumentos y rutas (D3)', () => {
  it('sin argumentos da las rutas por defecto', () => {
    expect(argumentosAplicarTrazos([])).toEqual(RUTAS_POR_DEFECTO);
    expect(RUTAS_POR_DEFECTO).toEqual({
      medidos: 'pipeline/salida/trazos-medidos.json',
      trazos: 'src/data/trazos-vago.json',
      marcadores: 'src/data/marcadores.json',
      resumen: 'docs/research/vago/resumen-trazos.md',
      rutas: 'public/modelos/rutas-vago.json',
    });
  });

  it('las cinco banderas cambian sus rutas', () => {
    expect(argumentosAplicarTrazos(['--medidos', 'a', '--trazos', 'b', '--marcadores', 'c', '--resumen', 'd', '--rutas', 'e'])).toEqual({
      medidos: 'a',
      trazos: 'b',
      marcadores: 'c',
      resumen: 'd',
      rutas: 'e',
    });
    expect(argumentosAplicarTrazos(['--rutas', 'e'])).toEqual({ ...RUTAS_POR_DEFECTO, rutas: 'e' });
    expect(argumentosAplicarTrazos(['--resumen', 'd'])).toEqual({ ...RUTAS_POR_DEFECTO, resumen: 'd' });
  });

  it.each([
    [['--otra', 'x']],
    [['--resumen']],
    [['--resumen', '--trazos']],
    [['--medidos', '--resumen']],
    [['posicional']],
    [['--trazos', 'a', '--trazos', 'b']],
    [['--rutas']],
    [['--rutas', 'a', '--rutas', 'b']],
  ])('uso indebido %j da null', (args) => {
    expect(argumentosAplicarTrazos(args)).toBeNull();
  });

  it('el CLI con una bandera desconocida muestra el uso y sale con 2', () => {
    const r = cli(carpeta(), ['--nada']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Uso');
  });

  function colocar(dir: string, medidos: unknown) {
    for (const ruta of [RUTAS_POR_DEFECTO.medidos, RUTAS_POR_DEFECTO.trazos, RUTAS_POR_DEFECTO.marcadores, RUTAS_POR_DEFECTO.rutas]) {
      mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    }
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.medidos), JSON.stringify(medidos, null, 1));
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.trazos), textoReal);
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.marcadores), textoMarcadores);
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.rutas), textoRutas);
  }

  it('el CLI sin argumentos usa las rutas por defecto, crea la carpeta del resumen y cuenta bien', () => {
    const dir = carpeta();
    colocar(dir, { [MALLA_REAL]: medida('faringeo'), 'Vagus nerve (X).r#t00': medida('sin_regla') });
    const r = cli(dir, []);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dir, RUTAS_POR_DEFECTO.resumen))).toBe(true);
    const nuevos = JSON.parse(readFileSync(join(dir, RUTAS_POR_DEFECTO.trazos), 'utf8')) as { trazos: PropuestaTrazo[] };
    expect(nuevos.trazos.find((t) => t.malla === MALLA_REAL)!.propuesta).toBe('m-pharyngeal-branch-of-vagus-nerve');
    expect(r.stdout).toContain('2 trazos actualizados, 26 sin cambios');
  });

  it('dos ejecuciones con las mismas entradas dan los mismos bytes, sin guion largo ni rutas temporales', () => {
    const corrida = () => {
      const dir = carpeta();
      colocar(dir, { [MALLA_REAL]: medida('abdominal_hepatico', { confianza: 'baja' }), 'Vagus nerve (X).r#t00': medida('raicilla') });
      const r = cli(dir, []);
      expect(r.status, r.stderr).toBe(0);
      return [RUTAS_POR_DEFECTO.trazos, RUTAS_POR_DEFECTO.resumen].map((ruta) => readFileSync(join(dir, ruta), 'utf8'));
    };
    const a = corrida();
    const b = corrida();
    expect(a[0]).not.toBe(textoReal);
    expect(a).toEqual(b);
    for (const t of a) {
      expect(t).not.toContain(GUION_LARGO);
      expect(t).not.toContain(tmpdir());
    }
  });
});

describe('banda del tronco cortado (ADR 0010)', () => {
  const IZQ = TRONCO_VAGO.izquierdo;
  const DER = TRONCO_VAGO.derecho;
  const banda1: Banda = { lado: 'izquierdo', y_max: 1.4248, y_min: null };
  const banda2: Banda = { lado: 'derecho', y_max: 1.4211, y_min: 1.3482 };
  const datosTronco = () => ({
    trazos: [IZQ, DER, 'M1'].map((malla) => ({ malla, auditoria: 'antes', propuesta: null, fuente: 'viejo' }) as PropuestaTrazo),
  });
  const tronco = (max: number, min: number) => medida('tronco', { altura_mm: { max, min } });

  it('el trazo del tronco izquierdo (banda de una parte) lleva la frase con las alturas publicadas, en es y en en', () => {
    const { datos } = aplicar({ [IZQ]: tronco(1573.4, 1346.6) }, datosTronco(), [banda1, banda2]);
    const e = datos.trazos[0]!.evidencia!;
    expect(e.es).toContain(
      'En el atlas publicado se retira lo que este trazo tiene por debajo de 1424,8 mm (ADR 0010): ahí se ve el tramo torácico trazado. ' +
        'Lo publicado va de 1573,4 a 1424,8 mm. Las medidas anteriores son las del trazo de Z-Anatomy sin cortar.',
    );
    expect(e.en).toContain(
      'In the published atlas, the part of this trace below 1424.8 mm is removed (ADR 0010): the traced thoracic segment is shown there. ' +
        'What is published runs from 1573.4 to 1424.8 mm. The earlier measurements are those of the uncut Z-Anatomy trace.',
    );
  });

  it('el trazo del tronco derecho (banda de dos partes) dice entre qué alturas se retira y las dos partes publicadas', () => {
    const { datos } = aplicar({ [DER]: tronco(1573.4, 1128.2) }, datosTronco(), [banda1, banda2]);
    const e = datos.trazos[1]!.evidencia!;
    expect(e.es).toContain(
      'En el atlas publicado se retira lo que este trazo tiene entre 1421,1 y 1348,2 mm (ADR 0010): ahí se ve el tramo torácico trazado. ' +
        'Lo publicado queda en dos partes, de 1573,4 a 1421,1 mm y de 1348,2 a 1128,2 mm. Las medidas anteriores son las del trazo de Z-Anatomy sin cortar.',
    );
    expect(e.en).toContain(
      'In the published atlas, the part of this trace between 1421.1 and 1348.2 mm is removed (ADR 0010): the traced thoracic segment is shown there. ' +
        'What is published stays in two parts, from 1573.4 to 1421.1 mm and from 1348.2 to 1128.2 mm. The earlier measurements are those of the uncut Z-Anatomy trace.',
    );
  });

  it('la frase va después de las medidas y antes de la regla, y las medidas siguen siendo las del trazo sin cortar', () => {
    const e = aplicar({ [IZQ]: tronco(1573.4, 1346.6) }, datosTronco(), [banda1, banda2]).datos.trazos[0]!.evidencia!;
    expect(e.es.indexOf('Cerca del extremo inferior')).toBeLessThan(e.es.indexOf('En el atlas publicado'));
    expect(e.es.indexOf('En el atlas publicado')).toBeLessThan(e.es.indexOf('Regla del tronco'));
    expect(e.es).toContain('Altura: de 1573,4 a 1346,6 mm.');
    expect(e.en.indexOf('Near the lower end')).toBeLessThan(e.en.indexOf('In the published atlas'));
    expect(e.en.indexOf('In the published atlas')).toBeLessThan(e.en.indexOf('Trunk rule'));
  });

  it('un trazo que no es un tronco escaneado no lleva la frase, aunque su regla sea tronco', () => {
    const { datos } = aplicar({ M1: tronco(1573.4, 1346.6) }, datosTronco(), [banda1, banda2]);
    expect(datos.trazos[2]!.evidencia).toEqual(evidenciaDeTrazo(tronco(1573.4, 1346.6)));
    expect(datos.trazos[2]!.evidencia!.es).not.toContain('ADR 0010');
    expect(datos.trazos[2]!.evidencia!.en).not.toContain('ADR 0010');
  });

  it.each([
    ['una parte, el trazo queda todo por debajo de la banda', IZQ, 1400, 1346.6],
    ['una parte, el trazo queda todo por encima de la banda', IZQ, 1573.4, 1500],
    ['dos partes, el trazo queda todo por debajo de la banda', DER, 1400, 1128.2],
    ['dos partes, el trazo queda todo por encima de la banda', DER, 1573.4, 1430],
    ['dos partes, el trazo termina dentro de la banda', DER, 1573.4, 1350],
  ])('si la banda no corta el trazo como se espera (%s) lanza con la malla', (_n, malla, max, min) => {
    expect(() => aplicar({ [malla]: tronco(max, min) }, datosTronco(), [banda1, banda2])).toThrow(
      new RegExp(`^${malla.replace(/[().]/g, '\\$&')}: la banda del vago `),
    );
  });

  it('si falta la banda del lado del tronco lanza con la malla y el lado', () => {
    expect(() => aplicar({ [IZQ]: tronco(1573.4, 1346.6) }, datosTronco(), [banda2])).toThrow(
      `${IZQ}: falta la banda del vago izquierdo`,
    );
    expect(() => aplicar({ [DER]: tronco(1573.4, 1128.2) }, datosTronco(), [])).toThrow(`${DER}: falta la banda del vago derecho`);
    // Sin medición del tronco no hace falta su banda.
    expect(() => aplicar({ M1: tronco(1573.4, 1346.6) }, datosTronco(), [])).not.toThrow();
  });

  it('con las bandas reales, los dos troncos del archivo real llevan la frase con las alturas de su banda', () => {
    const hoy = (lado: Banda['lado']) => BANDAS.find((b) => b.lado === lado)!;
    const alto = (y: number) => (y * 1000).toFixed(1).replace('.', ',');
    const izq = real.trazos.find((t) => t.malla === IZQ)!.evidencia!;
    const der = real.trazos.find((t) => t.malla === DER)!.evidencia!;
    expect(izq.es).toContain(`por debajo de ${alto(hoy('izquierdo').y_max)} mm (ADR 0010)`);
    expect(der.es).toContain(`entre ${alto(hoy('derecho').y_max)} y ${alto(hoy('derecho').y_min!)} mm (ADR 0010)`);
    expect(izq.en).toContain(`below ${alto(hoy('izquierdo').y_max).replace(',', '.')} mm is removed (ADR 0010)`);
    expect(der.en).toContain(`between ${alto(hoy('derecho').y_max).replace(',', '.')} and ${alto(hoy('derecho').y_min!).replace(',', '.')} mm is removed`);
    // Ningún otro trazo real lleva la frase.
    for (const tz of real.trazos) {
      if (tz.malla !== IZQ && tz.malla !== DER) expect(tz.evidencia?.es ?? '').not.toContain('ADR 0010');
    }
  });

  it('el CLI con las rutas reales escribe la frase en el trazo del tronco', () => {
    const dir = carpeta();
    const medidos = { [IZQ]: tronco(1573.4, 1346.6) };
    writeFileSync(join(dir, 'm.json'), JSON.stringify(medidos));
    writeFileSync(join(dir, 't.json'), textoReal);
    writeFileSync(join(dir, 'rutas.json'), textoRutas);
    const r = cli(dir, ['--medidos', 'm.json', '--trazos', 't.json', '--marcadores', rutaMarcadores, '--resumen', 'r.md', '--rutas', 'rutas.json']);
    expect(r.status, r.stderr).toBe(0);
    const nuevo = JSON.parse(readFileSync(join(dir, 't.json'), 'utf8')) as { trazos: PropuestaTrazo[] };
    expect(nuevo.trazos.find((tz) => tz.malla === IZQ)!.evidencia!.es).toContain('(ADR 0010)');
    // Una banda que no corta el trazo detiene el CLI sin escribir.
    writeFileSync(join(dir, 't2.json'), textoReal);
    writeFileSync(join(dir, 'm.json'), JSON.stringify({ [IZQ]: tronco(1400, 1346.6) }));
    const r2 = cli(dir, ['--medidos', 'm.json', '--trazos', 't2.json', '--marcadores', rutaMarcadores, '--resumen', 'r2.md', '--rutas', 'rutas.json']);
    expect(r2.status).toBe(1);
    expect(r2.stderr).toContain(IZQ);
    expect(readFileSync(join(dir, 't2.json'), 'utf8')).toBe(textoReal);
    expect(existsSync(join(dir, 'r2.md'))).toBe(false);
  });
});

describe('resumen', () => {
  it('trae una sección por trazo en el orden del archivo, con antes, después, regla y fuente, y un solo salto final', () => {
    const { resumen } = aplicar({ M1: medida('faringeo', { fuente: 'Mansour2021' }) });
    expect(resumen.startsWith('# Resumen de las propuestas de trazos\n')).toBe(true);
    expect(resumen).toContain('node scripts/aplicar-trazos.ts');
    expect(resumen).toContain('pipeline/auditar-vago.py');
    expect(resumen.match(/^## .*$/gm)).toEqual(['## M0', '## M1', '## M2']);
    expect(resumen.endsWith('\n')).toBe(true);
    expect(resumen.endsWith('\n\n')).toBe(false);
    const s = seccion(resumen, 'M1');
    expect(s).toContain('- Antes: propuesta ninguna; confianza sin dato; auditoria "antes"');
    expect(s).toContain('- Después: propuesta m-pharyngeal-branch-of-vagus-nerve; confianza alta; auditoria "texto de faringeo"');
    expect(s).toContain('- Regla: faringeo');
    expect(s).toContain('- Fuente: Mansour2021');
    expect(seccion(resumen, 'M0')).toContain('- Fuente: sin medición');
  });
});

describe('paridad con las otras copias de las listas', () => {
  it('ramosDeMarcadores sobre los marcadores reales es igual a ramosDeTrazo y no trae el foramen', () => {
    expect(RAMOS).toEqual(ramosDeTrazo());
    expect(RAMOS).not.toContain('m-jugular-foramen');
    expect(RAMOS).toContain(HEPATICO);
  });

  it('REGLAS_TRAZO es igual a la tupla REGLAS de pipeline/reglas_vago.py', () => {
    const py = readFileSync(join(raiz, 'pipeline/reglas_vago.py'), 'utf8');
    const tupla = /^REGLAS = \(([^)]*)\)/m.exec(py);
    expect(tupla).not.toBeNull();
    expect([...tupla![1]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1])).toEqual([...REGLAS_TRAZO]);
  });

  it('las propuestas de cada regla del pipeline son ramos de la lista, no_es_ramo o null', () => {
    const py = readFileSync(join(raiz, 'pipeline/reglas_vago.py'), 'utf8');
    const bloque = /^PROPUESTA = \{([^}]*)\}/m.exec(py)![1]!;
    const pares = [...bloque.matchAll(/"([a-z_]+)": (?:"([^"]+)"|None)/g)].map((x) => [x[1], x[2] ?? null]);
    expect(Object.fromEntries(pares)).toEqual(PROPUESTA);
    for (const [, p] of pares) if (p !== null && p !== 'no_es_ramo') expect(RAMOS).toContain(p);
  });
});

describe('la evidencia no lleva el guion largo ni espacios sobrantes', () => {
  it.each(REGLAS_TRAZO)('regla %s', (regla) => {
    const e = evidenciaDeTrazo(medida(regla));
    for (const t of [e.es, e.en]) {
      expect(t).not.toContain(GUION_LARGO);
      expect(t.trim()).toBe(t);
    }
    expect(e.es).toContain('Fuente: Kim2022.');
  });
});
