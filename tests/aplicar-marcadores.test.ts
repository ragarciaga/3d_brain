// Aplicador de propuestas de marcadores (spec 04, T3): la lógica pura de scripts/lib/marcadores.ts y el CLI
// scripts/aplicar-marcadores.ts, que se corre con spawnSync en carpetas temporales.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { posicionValida } from '../src/data/atlas';
import type { Marcador } from '../src/data/tipos';
import {
  aplicarPropuestas,
  argumentosAplicar,
  posicionPropuestaValida,
  RUTAS_POR_DEFECTO,
  serializarMarcadores,
  validarPropuestas,
  type Propuesta,
} from '../scripts/lib/marcadores.ts';

const raiz = resolve('.');
const textoReal = readFileSync(join(raiz, 'src/data/marcadores.json'), 'utf8');
const real = JSON.parse(textoReal) as Marcador[];
const RAFE = 'm-raphe-nuclei-of-medulla-oblongata';
const GUION_LARGO = String.fromCharCode(0x2014);

const carpetas: string[] = [];
function carpeta(): string {
  const c = mkdtempSync(join(tmpdir(), 'atlas-aplicar-'));
  carpetas.push(c);
  return c;
}
afterEach(() => {
  while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
});

function sinteticos(): Marcador[] {
  const vacio = { es: '', en: '' };
  return [
    { id: 'A', padre: 'g-a', ancla: null, posicion: null, estado: 'sin_ubicar', fuente_ubicacion: { ...vacio } },
    {
      id: 'B',
      padre: 'g-b',
      ancla: 'thalamus',
      posicion: null,
      estado: 'aproximada',
      fuente_ubicacion: { es: 'Punto provisional en el centro del tálamo.', en: 'Provisional point at the centre of the thalamus.' },
    },
    {
      id: 'C',
      padre: 'g-brainstem',
      ancla: 'medulla-oblongata',
      posicion: null,
      estado: 'aproximada',
      fuente_ubicacion: { es: 'Punto provisional en el bulbo.', en: 'Provisional point in the medulla.' },
      unir: true,
    },
    {
      id: 'V',
      padre: 'g-v',
      ancla: 'pons',
      unir: true,
      posicion: [1, 2, 3],
      estado: 'validada',
      fuente_ubicacion: { es: 'Validada por un docente.', en: 'Validated by a teacher.' },
    },
    { id: 'S', padre: 'g-s', ancla: null, posicion: null, estado: 'sin_ubicar', fuente_ubicacion: { ...vacio } },
  ];
}

const CITA = 'Truong P, Kim JH, Hum Brain Mapp. 2020. PMID 32870572. PMCID PMC7670631. DOI 10.1002/hbm.25185.';

function prop(id: string, extra: Partial<Propuesta> = {}): Propuesta {
  return {
    id,
    posicion: [0.01, 1.6, -0.02],
    estado: 'aproximada',
    metodo: { es: 'Centro de la malla del puente (derivado).', en: 'Centre of the pons mesh (derived).' },
    cita: { es: CITA, en: CITA },
    ...extra,
  };
}

function propNula(id: string, motivo: string, extra: Partial<Propuesta> = {}): Propuesta {
  return prop(id, { posicion: null, estado: 'sin_ubicar', motivo, cita: { es: '', en: '' }, ...extra });
}

/** Texto de la sección `## id` del resumen, hasta la siguiente. */
function seccion(resumen: string, id: string): string {
  const partes = resumen.split(/^## /m).slice(1);
  const s = partes.find((x) => x.startsWith(`${id}\n`));
  if (s === undefined) throw new Error(`sin sección ${id}`);
  return s;
}

function sinPropuestas(m: Marcador[], ps: Propuesta[]) {
  return aplicarPropuestas(m, ps);
}

describe('formato (D1)', () => {
  it('aplicar una lista vacía al archivo real y serializar da el mismo texto, byte a byte', () => {
    expect(serializarMarcadores(sinPropuestas(real, []).marcadores)).toBe(textoReal);
  });

  it('el CLI con [] sobre una copia la deja idéntica', () => {
    const dir = carpeta();
    writeFileSync(join(dir, 'm.json'), textoReal);
    writeFileSync(join(dir, 'p.json'), '[]');
    const r = cli(dir, ['--propuestas', 'p.json', '--marcadores', 'm.json', '--resumen', 'r.md']);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(dir, 'm.json'), 'utf8')).toBe(textoReal);
  });
});

function cli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [join(raiz, 'scripts/aplicar-marcadores.ts'), ...args], { cwd, encoding: 'utf8' });
}

describe('posición con punto o { l, r } (D2, R2.3)', () => {
  it('un punto: cambian posición, estado, ancla y fuente, con el método y la cita en es y en', () => {
    const p = prop('A', { ancla: 'pons' });
    const a = sinteticos()[0]!;
    const { marcadores } = sinPropuestas(sinteticos(), [p]);
    const m = marcadores[0]!;
    expect(m.posicion).toEqual([0.01, 1.6, -0.02]);
    expect(m.estado).toBe('aproximada');
    expect(m.ancla).toBe('pons');
    expect(m.id).toBe(a.id);
    expect(m.fuente_ubicacion.es).toContain(p.metodo.es);
    expect(m.fuente_ubicacion.es).toContain(p.cita.es);
    expect(m.fuente_ubicacion.en).toContain(p.metodo.en);
    expect(m.fuente_ubicacion.en).toContain(p.cita.en);
    for (const idioma of ['es', 'en'] as const) {
      expect(m.fuente_ubicacion[idioma]).toContain('2020');
      expect(m.fuente_ubicacion[idioma]).toContain('PMID 32870572');
    }
  });

  it('{ l, r } sin ancla en la propuesta: la posición es el objeto y se conserva el ancla', () => {
    const pos = { l: [-0.01, 1.5, 0] as [number, number, number], r: [0.01, 1.5, 0] as [number, number, number] };
    const { marcadores } = sinPropuestas(sinteticos(), [prop('B', { posicion: pos })]);
    const m = marcadores[1]!;
    expect(m.posicion).toEqual(pos);
    expect(m.estado).toBe('aproximada');
    expect(m.ancla).toBe('thalamus');
    expect(m.fuente_ubicacion.es).not.toBe(sinteticos()[1]!.fuente_ubicacion.es);
  });

  it('un marcador sin_ubicar con propuesta con posición queda aproximada', () => {
    expect(sinPropuestas(sinteticos(), [prop('S')]).marcadores[4]!.estado).toBe('aproximada');
  });
});

describe('desacuerdo de fuentes (R2.4)', () => {
  const desacuerdo = {
    es: 'Binder 2015 la sitúa en el giro temporal superior; Matchin 2022 la extiende al surco temporal superior.',
    en: 'Binder 2015 places it in the superior temporal gyrus; Matchin 2022 extends it to the superior temporal sulcus.',
  };

  it('el desacuerdo y sus dos citas quedan en fuente_ubicacion en es y en', () => {
    const p = prop('A', { desacuerdo });
    for (const t of [p.metodo.es, p.metodo.en, p.cita.es, p.cita.en]) {
      expect(t).not.toContain('Binder');
      expect(t).not.toContain('Matchin');
    }
    const f = sinPropuestas(sinteticos(), [p]).marcadores[0]!.fuente_ubicacion;
    for (const idioma of ['es', 'en'] as const) {
      expect(f[idioma]).toContain('Binder 2015');
      expect(f[idioma]).toContain('Matchin 2022');
    }
    expect(f.es).toContain('Las fuentes no coinciden:');
    expect(f.en).toContain('Sources disagree:');
  });

  it('sin desacuerdo no hay etiqueta', () => {
    const f = sinPropuestas(sinteticos(), [prop('A')]).marcadores[0]!.fuente_ubicacion;
    expect(f.es).not.toContain('Las fuentes no coinciden');
    expect(f.en).not.toContain('Sources disagree');
  });

  it('el resumen lleva el desacuerdo', () => {
    const { resumen } = sinPropuestas(sinteticos(), [prop('A', { desacuerdo })]);
    expect(seccion(resumen, 'A')).toContain(`Desacuerdo: ${desacuerdo.es}`);
  });
});

describe('lo que no cambia (R6.2)', () => {
  it('id, padre, unir y el orden de las claves quedan iguales', () => {
    const antes = sinteticos()[2]!;
    const despues = sinPropuestas(sinteticos(), [prop('C', { ancla: 'pons' })]).marcadores[2]!;
    expect(despues.id).toBe(antes.id);
    expect(despues.padre).toBe(antes.padre);
    expect(despues.unir).toBe(true);
    expect(Object.keys(despues)).toEqual(Object.keys(antes));
    expect(despues.posicion).not.toEqual(antes.posicion);
  });

  it('en el archivo real, una propuesta solo cambia a su marcador y solo líneas de su objeto', () => {
    const p = prop(RAFE, { posicion: [0, 1.5, -0.03] });
    const { marcadores } = sinPropuestas(real, [p]);
    expect(marcadores).toHaveLength(real.length);
    for (const [i, m] of real.entries()) {
      if (m.id !== RAFE) expect(marcadores[i], m.id).toEqual(m);
    }
    const rafe = marcadores.find((m) => m.id === RAFE)!;
    const antes = real.find((m) => m.id === RAFE)!;
    expect(rafe.unir).toBe(true);
    expect(rafe.padre).toBe(antes.padre);
    expect(rafe.ancla).toBe(antes.ancla);
    expect(rafe.posicion).toEqual([0, 1.5, -0.03]);

    const a = textoReal.split('\n');
    const b = serializarMarcadores(marcadores).split('\n');
    const inicio = a.findIndex((l) => l.includes(`"id": "${RAFE}"`));
    const fin = a.findIndex((l, i) => i > inicio && l === ' {');
    let prefijo = 0;
    while (a[prefijo] === b[prefijo]) prefijo++;
    let sufijo = 0;
    while (a[a.length - 1 - sufijo] === b[b.length - 1 - sufijo]) sufijo++;
    expect(prefijo).toBeGreaterThanOrEqual(inicio);
    expect(sufijo).toBeGreaterThanOrEqual(a.length - fin);
    expect(b.length).toBeGreaterThan(a.length);
  });

  it('un marcador validada con propuesta queda igual campo por campo y el resumen dice que se omitió', () => {
    const original = sinteticos()[3]!;
    const p = prop('V', {
      posicion: [9, 9, 9],
      ancla: 'thalamus',
      desacuerdo: { es: 'Binder 2015 y Matchin 2022.', en: 'Binder 2015 and Matchin 2022.' },
    });
    const { marcadores, resumen } = sinPropuestas(sinteticos(), [p]);
    const v = marcadores[3]!;
    expect(v).toEqual(original);
    expect(v.posicion).toEqual([1, 2, 3]);
    expect(v.estado).toBe('validada');
    expect(v.ancla).toBe('pons');
    expect(v.fuente_ubicacion).toEqual(original.fuente_ubicacion);
    expect(seccion(resumen, 'V')).toContain('se omitió');
    expect(seccion(resumen, 'V')).toContain('Resultado: sin cambios');
  });
});

describe('propuestas sin posición y marcadores sin propuesta (D3, D4, D5)', () => {
  it('D3: posicion null con motivo deja sin_ubicar y el resumen da el motivo', () => {
    const motivo = 'fuente sin registrar en fuentes.md: no se inventa la posición';
    const { marcadores, resumen } = sinPropuestas(sinteticos(), [propNula('A', motivo)]);
    const a = marcadores[0]!;
    expect(a).toEqual(sinteticos()[0]);
    expect(a.estado).toBe('sin_ubicar');
    expect(a.posicion).toBeNull();
    expect(a.fuente_ubicacion).toEqual({ es: '', en: '' });
    expect(seccion(resumen, 'A')).toContain(motivo);
    expect(seccion(resumen, 'A')).toContain('Resultado: sin cambios');
  });

  it('D4: posicion null en un marcador aproximada con ancla no lo baja a sin_ubicar', () => {
    const motivo = 'el punto queda a más de 5 mm de las mallas';
    const { marcadores, resumen } = sinPropuestas(sinteticos(), [propNula('B', motivo, { ancla: 'pons' })]);
    const b = marcadores[1]!;
    expect(b).toEqual(sinteticos()[1]);
    expect(b.estado).toBe('aproximada');
    expect(b.ancla).toBe('thalamus');
    expect(b.fuente_ubicacion.es).not.toBe('');
    const s = seccion(resumen, 'B');
    expect(s).toContain('no trae posición');
    expect(s).toContain(motivo);
    expect(s).toContain('se conserva');
  });

  it('D5: un marcador sin propuesta queda igual y el resumen lo dice', () => {
    const { marcadores, resumen } = sinPropuestas(sinteticos(), [prop('A')]);
    expect(marcadores[4]).toEqual(sinteticos()[4]);
    expect(seccion(resumen, 'S')).toContain('no hay propuesta para este marcador');
    expect(seccion(resumen, 'S')).toContain('Regla: sin propuesta');
  });

  it('es pura: no muta las entradas', () => {
    const m = sinteticos();
    const ps = [prop('A', { ancla: 'pons' }), propNula('B', 'x'), prop('V')];
    const m0 = structuredClone(m);
    const ps0 = structuredClone(ps);
    sinPropuestas(m, ps);
    expect(m).toEqual(m0);
    expect(ps).toEqual(ps0);
  });
});

describe('validación (D6)', () => {
  const m = sinteticos();
  const malas = (p: unknown) => () => validarPropuestas([p], m);

  it('id desconocido', () => {
    expect(malas(prop('Z'))).toThrow(/Z: id desconocido/);
    expect(() => aplicarPropuestas(sinteticos(), [prop('Z')])).toThrow(/Z/);
  });

  it('id repetido', () => {
    expect(() => validarPropuestas([prop('A'), prop('A')], m)).toThrow(/A: id repetido/);
  });

  it.each([
    ['dos coordenadas', [1, 2]],
    ['coordenada nula', [1, 2, null]],
    ['objeto vacío', {}],
    ['clave distinta de l o r', { x: [1, 2, 3] }],
    ['lado con dos coordenadas', { l: [1, 2] }],
    ['texto', '1,2,3'],
  ])('posición mal formada: %s', (_n, posicion) => {
    expect(malas({ ...prop('A'), posicion })).toThrow(/A: posición mal formada/);
  });

  it('estado validada', () => {
    expect(malas({ ...prop('A'), estado: 'validada' })).toThrow(/A: estado/);
  });

  it('estado sin_ubicar con posición', () => {
    expect(malas({ ...prop('A'), estado: 'sin_ubicar' })).toThrow(/A: estado/);
  });

  it('posicion null sin motivo', () => {
    const sinMotivo: Record<string, unknown> = { ...propNula('A', 'x') };
    delete sinMotivo['motivo'];
    expect(malas(sinMotivo)).toThrow(/A: sin posición, falta el motivo/);
  });

  it('con posición, cita.es vacía', () => {
    expect(malas(prop('A', { cita: { es: ' ', en: CITA } }))).toThrow(/A: con posición/);
  });

  it('clave desconocida', () => {
    expect(malas({ ...prop('A'), padre: 'g-x' })).toThrow(/A: clave desconocida "padre"/);
  });

  it('ancla vacía y desacuerdo incompleto', () => {
    expect(malas(prop('A', { ancla: '' }))).toThrow(/A: ancla/);
    expect(malas(prop('A', { desacuerdo: { es: 'x', en: '' } }))).toThrow(/A: desacuerdo/);
  });

  it('la entrada que no es una lista', () => {
    expect(() => validarPropuestas({}, m)).toThrow(/no es una lista/);
  });

  it('una propuesta válida pasa tal cual', () => {
    expect(validarPropuestas([prop('A'), propNula('B', 'x')], m)).toHaveLength(2);
  });
});

describe('el CLI no escribe si algo falla (D6)', () => {
  it.each([
    ['un id desconocido', [prop('m-no-existe')]],
    ['una posición mal formada', [{ ...prop(RAFE), posicion: [1, 2] }]],
  ])('con %s: sale distinto de 0, no cambia marcadores.json y no toca el resumen', (_n, propuestas) => {
    const dir = carpeta();
    writeFileSync(join(dir, 'm.json'), textoReal);
    writeFileSync(join(dir, 'p.json'), JSON.stringify(propuestas));
    writeFileSync(join(dir, 'r.md'), 'centinela');
    const args = ['--propuestas', 'p.json', '--marcadores', 'm.json', '--resumen', 'r.md'];
    const r = cli(dir, args);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain((propuestas[0] as { id: string }).id);
    expect(readFileSync(join(dir, 'm.json'), 'utf8')).toBe(textoReal);
    expect(readFileSync(join(dir, 'r.md'), 'utf8')).toBe('centinela');

    rmSync(join(dir, 'r.md'));
    expect(cli(dir, args).status).not.toBe(0);
    expect(existsSync(join(dir, 'r.md'))).toBe(false);
  });

  it('si no está el archivo de propuestas, sale con 2 y dice cómo generarlo', () => {
    const dir = carpeta();
    const r = cli(dir, ['--propuestas', 'nada.json']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('ubicar-marcadores.py');
  });
});

describe('paridad con posicionValida (D7)', () => {
  it.each([
    ['un punto', [0.01, 1.6, -0.02]],
    ['solo l', { l: [1, 2, 3] }],
    ['solo r', { r: [1, 2, 3] }],
    ['l y r', { l: [1, 2, 3], r: [-1, 2, 3] }],
    ['null', null],
    ['dos coordenadas', [1, 2]],
    ['una coordenada nula', [1, 2, null]],
    ['cuatro coordenadas', [1, 2, 3, 4]],
    ['una coordenada NaN', [1, Number.NaN, 3]],
    ['objeto vacío', {}],
    ['lado con dos coordenadas', { l: [1, 2] }],
    ['un texto', '1,2,3'],
    ['clave distinta de l o r', { x: [1, 2, 3] }],
    ['clave extra junto a una válida', { l: [1, 2, 3], x: [1, 2, 3] }],
    ['undefined', undefined],
  ])('%s', (_n, v) => {
    expect(posicionPropuestaValida(v)).toBe(posicionValida(v));
  });
});

describe('resumen (D8)', () => {
  it('una sección por marcador en el orden de entrada, con antes, después, regla y fuente', () => {
    const p = prop('A', { posicion: { l: [-0.01, 1.5, 0], r: [0.01, 1.5, 0] }, ancla: 'pons' });
    const { resumen } = sinPropuestas(sinteticos(), [p]);
    const ids = [...resumen.matchAll(/^## (.+)$/gm)].map((x) => x[1]);
    expect(ids).toEqual(['A', 'B', 'C', 'V', 'S']);
    const s = seccion(resumen, 'A');
    expect(s).toContain('Resultado: actualizado');
    expect(s).toMatch(/Antes: sin_ubicar; posición sin posición; ancla ninguna/);
    expect(s).toContain(`Después: aproximada; posición ${JSON.stringify(p.posicion)}; ancla \`pons\``);
    expect(s).toContain(`Regla: ${p.metodo.es}`);
    expect(s).toContain(`Fuente: ${p.cita.es}`);
    expect(s).not.toContain('Motivo:');
    expect(resumen.endsWith('\n')).toBe(true);
    expect(resumen.endsWith('\n\n')).toBe(false);
  });

  it('sin fuente cuando la cita viene vacía', () => {
    const { resumen } = sinPropuestas(sinteticos(), [propNula('A', 'x')]);
    expect(seccion(resumen, 'A')).toContain('Fuente: sin fuente');
  });
});

describe('argumentos y rutas (D9)', () => {
  it('sin argumentos da las rutas por defecto', () => {
    expect(argumentosAplicar([])).toEqual(RUTAS_POR_DEFECTO);
    expect(RUTAS_POR_DEFECTO).toEqual({
      propuestas: 'pipeline/salida/marcadores-propuestos.json',
      marcadores: 'src/data/marcadores.json',
      resumen: 'docs/research/marcadores/resumen-propuestas.md',
    });
  });

  it('las tres banderas cambian sus rutas', () => {
    expect(argumentosAplicar(['--propuestas', 'a', '--marcadores', 'b', '--resumen', 'c'])).toEqual({
      propuestas: 'a',
      marcadores: 'b',
      resumen: 'c',
    });
    expect(argumentosAplicar(['--resumen', 'c'])).toEqual({ ...RUTAS_POR_DEFECTO, resumen: 'c' });
  });

  it.each([
    [['--otra', 'x']],
    [['--resumen']],
    [['--resumen', '--marcadores']],
    [['--marcadores', '--resumen']],
    [['posicional']],
    [['--resumen', 'a', '--resumen', 'b']],
  ])('uso indebido %j da null', (args) => {
    expect(argumentosAplicar(args)).toBeNull();
  });

  it('el CLI con una bandera desconocida muestra el uso y sale con 2', () => {
    const r = cli(carpeta(), ['--nada']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Uso');
  });

  it('el CLI sin argumentos usa las rutas por defecto y crea la carpeta del resumen', () => {
    const dir = carpeta();
    for (const ruta of [RUTAS_POR_DEFECTO.propuestas, RUTAS_POR_DEFECTO.marcadores]) mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.marcadores), textoReal);
    writeFileSync(join(dir, RUTAS_POR_DEFECTO.propuestas), JSON.stringify([prop(RAFE, { posicion: [0, 1.5, -0.03] })]));
    const r = cli(dir, []);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dir, RUTAS_POR_DEFECTO.resumen))).toBe(true);
    const nuevos = JSON.parse(readFileSync(join(dir, RUTAS_POR_DEFECTO.marcadores), 'utf8')) as Marcador[];
    expect(nuevos.find((m) => m.id === RAFE)!.posicion).toEqual([0, 1.5, -0.03]);
    expect(nuevos.find((m) => m.id === RAFE)!.estado).toBe('aproximada');
    expect(r.stdout).toContain('1 marcadores actualizados, 25 sin cambios');
  });
});

describe('determinismo (D10)', () => {
  const propuestas = [
    prop('m-nucleus-accumbens', { ancla: 'caudate-nucleus' }),
    prop('m-caerulean-nucleus', { posicion: { l: [-0.004, 1.4, -0.03], r: [0.004, 1.4, -0.03] } }),
    propNula('m-area-postrema', 'el punto queda a más de 5 mm de las mallas'),
  ];

  function corrida(): { marcadores: string; resumen: string } {
    const dir = carpeta();
    writeFileSync(join(dir, 'm.json'), textoReal);
    writeFileSync(join(dir, 'p.json'), JSON.stringify(propuestas, null, 1));
    const r = cli(dir, ['--propuestas', 'p.json', '--marcadores', 'm.json', '--resumen', 'sub/r.md']);
    expect(r.status, r.stderr).toBe(0);
    return { marcadores: readFileSync(join(dir, 'm.json'), 'utf8'), resumen: readFileSync(join(dir, 'sub', 'r.md'), 'utf8') };
  }

  it('dos ejecuciones con las mismas entradas dan los mismos bytes, sin guion largo ni rutas temporales', () => {
    const a = corrida();
    const b = corrida();
    expect(a.marcadores).not.toBe(textoReal);
    expect(a.marcadores).toBe(b.marcadores);
    expect(a.resumen).toBe(b.resumen);
    for (const t of [a.marcadores, a.resumen]) {
      expect(t).not.toContain(GUION_LARGO);
      expect(t).not.toContain(tmpdir());
    }
  });
});
