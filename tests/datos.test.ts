// Integridad del contenido: lo que la app promete en AGENTS.md (fuente obligatoria, bilingüe,
// nada huérfano) se verifica aquí, no a mano.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
  arbol,
  entradaPorSlug,
  estructuras,
  grupos,
  marcadores,
  nodos,
  piezasDeAncla,
  piezasDeEntrada,
  posicionValida,
  puntosDeMarcador,
  SIN_TERMINO,
} from '../src/data/atlas';
import { crearBuscador } from '../src/lib/busqueda';
import { latinVisible, nombre } from '../src/lib/nombres';
import { ALIAS_VALIDO } from '../scripts/lib/revisiones.ts';

const idiomas = ['es', 'en'] as const;

describe('datos del atlas', () => {
  it('cada pieza del árbol tiene su entrada en estructuras.json', () => {
    const faltan = Object.values(nodos)
      .filter((n) => (n.tipo === 'pieza' ? !estructuras[n.estructura!] : !estructuras[n.id] && n.id !== 'g-organos-referencia'))
      .map((n) => n.id);
    expect(faltan).toEqual([]);
  });

  it('cada pieza del árbol corresponde a una fila de mapeo.csv', () => {
    const csv = readFileSync('pipeline/mapeo.csv', 'utf8').trim().split('\n').slice(1);
    const mallas = new Set(csv.map((l) => (l.startsWith('"') ? l.slice(1, l.indexOf('"', 1)) : l.split(',')[0])));
    const piezas = Object.values(nodos).filter((n) => n.tipo === 'pieza');
    expect(piezas.filter((n) => !mallas.has(n.malla!)).map((n) => n.id)).toEqual([]);
    expect(arbol.raices.length).toBeGreaterThan(0);
  });

  it('cada fila de mapeo.csv tiene su pieza en el árbol', () => {
    const csv = readFileSync('pipeline/mapeo.csv', 'utf8').trim().split('\n').slice(1);
    const mallas = csv.map((l) => (l.startsWith('"') ? l.slice(1, l.indexOf('"', 1)) : l.split(',')[0]!));
    expect(mallas.length).toBeGreaterThan(0);
    const delArbol = new Set(Object.values(nodos).filter((n) => n.tipo === 'pieza').map((n) => n.malla));
    expect(mallas.filter((m) => !delArbol.has(m))).toEqual([]);
  });

  it('la glándula pineal y el plexo coroideo están en el árbol y en estructuras.json', () => {
    for (const id of ['pineal-gland', 'choroid-plexus']) expect(estructuras[id], id).toBeTruthy();
    const piezas = Object.values(nodos).filter((n) => n.tipo === 'pieza');
    expect(piezas.some((n) => n.estructura === 'pineal-gland')).toBe(true);
    expect(piezas.filter((n) => n.estructura === 'choroid-plexus').map((n) => n.id).sort()).toEqual(['choroid-plexus-l', 'choroid-plexus-r']);
  });

  it('el marcador del área de Wernicke está bajo el lóbulo temporal, aproximado sobre el giro temporal superior izquierdo', () => {
    const m = marcadores.find((x) => x.id === 'm-wernicke-area');
    expect(m?.padre).toBe('g-temporal-lobe');
    expect(m?.estado).toBe('aproximada');
    // Un solo punto Vec3 en el hemisferio izquierdo (+X): la regla solo cubre el lado izquierdo.
    expect(Array.isArray(m?.posicion)).toBe(true);
    const p = m!.posicion as number[];
    expect(p).toHaveLength(3);
    expect(p.every((c) => Number.isFinite(c))).toBe(true);
    expect(p[0]!).toBeGreaterThan(0);
    // La fuente nombra las tres posturas que no coinciden con la clásica, en cada idioma.
    for (const cita of ['Binder 2015', 'Matchin 2022', 'Dick 2016']) {
      expect(m?.fuente_ubicacion.es, cita).toContain(cita);
      expect(m?.fuente_ubicacion.en, cita).toContain(cita);
    }
    expect(m?.fuente_ubicacion.es).toContain('Tremblay y Dick');
    expect(m?.fuente_ubicacion.en).toContain('Tremblay and Dick');
    expect(m?.ancla).toBe('superior-temporal-gyrus-lateral-part-l');
    expect(nodos[m!.ancla!]?.lado).toBe('l');
    expect(estructuras['m-wernicke-area']?.tipo).toBe('marcador');
  });

  it('los slugs son únicos por idioma', () => {
    for (const i of idiomas) {
      const slugs = Object.values(estructuras).map((e) => e.slug[i]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('los marcadores tienen slugs reales por idioma, no su id', () => {
    for (const m of marcadores) {
      const e = estructuras[m.id]!;
      for (const i of idiomas) {
        expect(e.slug[i], `${m.id} ${i}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(e.slug[i], `${m.id} ${i}`).not.toMatch(/^m-/);
      }
    }
    expect(estructuras['m-wernicke-area']!.slug).toEqual({ es: 'area-de-wernicke', en: 'wernickes-area' });
    expect(estructuras['m-periaqueductal-grey']!.slug).toEqual({ es: 'sustancia-gris-periacueductal', en: 'periaqueductal-grey' });
  });

  it('la fuente de ubicación de un marcador es bilingüe y la nota en inglés existe si existe la de español', () => {
    for (const m of marcadores) {
      expect(typeof m.fuente_ubicacion.es, m.id).toBe('string');
      expect(typeof m.fuente_ubicacion.en, m.id).toBe('string');
      expect(m.fuente_ubicacion.en.trim() === '', `${m.id} falta la nota en inglés`).toBe(m.fuente_ubicacion.es.trim() === '');
    }
    const pag = marcadores.find((m) => m.id === 'm-periaqueductal-grey')!;
    // Ni el rótulo ni la cita de un idioma aparecen en el otro.
    for (const m of marcadores) {
      const { es, en } = m.fuente_ubicacion;
      expect(en, m.id).not.toContain(' Fuente: ');
      expect(en, m.id).not.toContain('Las fuentes no coinciden');
      expect(es, m.id).not.toContain(' Source: ');
      expect(es, m.id).not.toContain('Sources disagree');
    }
    expect(Array.isArray(pag.posicion)).toBe(true);
    expect(pag.fuente_ubicacion.es).toContain(' Fuente: ');
    expect(pag.fuente_ubicacion.es).toContain('PMID 32870572');
    expect(pag.fuente_ubicacion.en).not.toContain(pag.fuente_ubicacion.es.split(' Fuente: ')[0]!);
    expect(pag.fuente_ubicacion.en).toContain(' Source: ');
    expect(pag.fuente_ubicacion.en).toContain('PMID 32870572');
    expect(estructuras['m-periaqueductal-grey']!.fuente_nombre).toContain('TA2');
    expect(estructuras['m-wernicke-area']!.fuente_nombre).toContain('Terminologia Neuroanatomica');
  });

  it('el grupo del vago no repite el nombre de la estructura del vago ni su slug', () => {
    const g = estructuras['g-vagus-nerve-x']!;
    expect(g.nombre).toEqual({ es: 'Nervio vago (ambos lados)', en: 'Vagus nerve (both sides)' });
    expect(g.slug).toEqual({ es: 'nervio-vago-ambos-lados', en: 'vagus-nerve-both-sides' });
    expect(g.fuente_nombre).toBe('interfaz');
    expect(estructuras['vagus-nerve-x']!.slug.es).toBe('nervio-vago-x');
  });

  it('toda ficha tiene los dos idiomas, fuentes y estado de revisión', () => {
    for (const e of Object.values(estructuras)) {
      const f = e.ficha;
      if (!f) continue;
      for (const i of idiomas) {
        expect(f.ubicacion[i].trim(), `${e.id} ubicacion ${i}`).not.toBe('');
        expect(f.que_es[i].trim(), `${e.id} que_es ${i}`).not.toBe('');
        expect(f.para_que_sirve[i].trim(), `${e.id} para_que_sirve ${i}`).not.toBe('');
        expect(f.revision[i].estado).toBeTruthy();
      }
      expect(f.fuentes.length, `${e.id} sin fuentes`).toBeGreaterThan(0);
      for (const a of f.relevancia) expect(a.fuentes.length, `${e.id} afirmación sin fuente`).toBeGreaterThan(0);
      for (const r of f.relaciones) expect(estructuras[r], `${e.id} relación rota: ${r}`).toBeTruthy();
    }
  });

  it('una ficha verificada tiene revisor y fecha', () => {
    for (const e of Object.values(estructuras)) {
      for (const i of idiomas) {
        const r = e.ficha?.revision[i];
        if (r?.estado === 'verificado') expect(r.revisado_por && r.fecha, `${e.id} ${i}`).toBeTruthy();
      }
    }
  });

  it('todo nombre tiene fuente o está marcado PENDIENTE', () => {
    for (const e of Object.values(estructuras)) {
      expect(e.fuente_nombre, e.id).toBeTruthy();
    }
  });

  it('el latín es un término, PENDIENTE, sin término oficial con su fuente, o vacío solo en grupos de la interfaz', () => {
    for (const e of Object.values(estructuras)) {
      if (e.latin === '') expect(e.fuente_nombre, e.id).toBe('interfaz');
      if (e.latin === SIN_TERMINO) expect(e.fuente_nombre, e.id).toMatch(/sin término oficial/i);
    }
    expect(estructuras['paracentral-gyrus-and-sulcus']!.latin).toBe(SIN_TERMINO);
    expect(estructuras['m-wernicke-area']!.latin).toBe('Gyrus temporalis superior, pars posterior');
  });

  it('el latín se muestra traducido cuando no hay término y no aparece en grupos de la interfaz', () => {
    const t = ((k: string) => k) as unknown as TFunction;
    expect(latinVisible(estructuras['paracentral-gyrus-and-sulcus'], t)).toBe('ficha.latinSinTermino');
    expect(latinVisible(estructuras['g-organos-referencia'], t)).toBeNull();
    expect(latinVisible(estructuras['hippocampus'], t)).toBe('Hippocampus');
  });

  it('marcadores y grupos de estudio apuntan a cosas que existen', () => {
    for (const m of marcadores) {
      expect(estructuras[m.id], m.id).toBeTruthy();
      expect(nodos[m.padre], m.padre).toBeTruthy();
      if (m.ancla) expect(piezasDeAncla(m.ancla).length, m.ancla).toBeGreaterThan(0);
      if (m.estado !== 'sin_ubicar') expect(m.posicion || m.ancla, m.id).toBeTruthy();
      // Una posición aproximada siempre dice de dónde sale.
      if (m.estado === 'aproximada') expect(m.fuente_ubicacion.es && m.fuente_ubicacion.en, m.id).toBeTruthy();
    }
    for (const g of grupos) {
      for (const miembro of g.miembros) expect(piezasDeEntrada(miembro).length, `${g.id}: ${miembro}`).toBeGreaterThan(0);
      expect(g.fuentes.length).toBeGreaterThan(0);
    }
  });

  it('ningún dato usa el guion largo', () => {
    for (const f of ['src/data/estructuras.json', 'src/data/grupos.json', 'src/data/marcadores.json', 'src/i18n/es.json', 'src/i18n/en.json']) {
      expect(readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), f).toBe(false);
    }
  });
});

// R9.3: el repositorio nunca guarda el nombre de un revisor; solo `null` o un alias `D07`.
function revisorPublico(v: unknown): boolean {
  return v === null || (typeof v === 'string' && ALIAS_VALIDO.test(v));
}

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const r = join(dir, f);
    return statSync(r).isDirectory() ? archivosTs(r) : /\.tsx?$/.test(f) ? [r] : [];
  });
}

describe('revisión sin datos personales (R9)', () => {
  it.each([
    ['null', null],
    ['un alias de dos dígitos', 'D07'],
    ['un alias de tres dígitos', 'D123'],
  ])('revisorPublico acepta %s', (_n, v) => {
    expect(revisorPublico(v)).toBe(true);
  });

  it.each([
    ['un nombre', 'Ana Pérez'],
    ['un código de revisor', 'PRUEBA01'],
    ['la cadena vacía', ''],
    ['un alias en minúscula', 'd07'],
    ['un alias de un dígito', 'D7'],
    ['un alias de cuatro dígitos', 'D1234'],
    ['undefined', undefined],
  ])('revisorPublico rechaza %s', (_n, v) => {
    expect(revisorPublico(v)).toBe(false);
  });

  it('todo revisado_por de estructuras.json es null o un alias', () => {
    let vistos = 0;
    for (const e of Object.values(estructuras)) {
      if (!e.ficha) continue;
      for (const i of idiomas) {
        vistos++;
        expect(revisorPublico(e.ficha.revision[i].revisado_por), `${e.id} ${i}`).toBe(true);
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('todo revisado_por de las rutas publicadas es null o un alias', () => {
    const json = JSON.parse(readFileSync('public/modelos/rutas-vago.json', 'utf8')) as {
      rutas?: Record<string, { revision?: { revisado_por?: unknown } }>;
    };
    for (const [id, ruta] of Object.entries(json.rutas ?? {})) {
      expect(revisorPublico(ruta.revision?.revisado_por), id).toBe(true);
    }
  });

  it('todo revisado_por de pipeline/rutas-vago.yaml es null o un alias', () => {
    const texto = readFileSync('pipeline/rutas-vago.yaml', 'utf8');
    const valores = [...texto.matchAll(/revisado_por:\s*([^,}\s]+)/g)].map((m) => m[1]!);
    // El mínimo evita que la guarda pase vacía si cambia el formato del archivo.
    expect(valores.length).toBeGreaterThanOrEqual(5);
    for (const v of valores) expect(v === 'null' || ALIAS_VALIDO.test(v), v).toBe(true);
  });

  it('ninguna vista pública lee revisado_por (src/components)', () => {
    const lectores = archivosTs('src/components').filter((f) => readFileSync(f, 'utf8').includes('revisado_por'));
    expect(lectores).toEqual([]);
  });
});

describe('posición de marcadores (R3)', () => {
  it.each([
    ['un punto', [0.01, 1.6, -0.02]],
    ['solo l', { l: [1, 2, 3] }],
    ['solo r', { r: [1, 2, 3] }],
    ['l y r', { l: [1, 2, 3], r: [-1, 2, 3] }],
    ['null', null],
  ])('posicionValida acepta %s', (_n, v) => {
    expect(posicionValida(v)).toBe(true);
  });

  it.each([
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
  ])('posicionValida rechaza %s', (_n, v) => {
    expect(posicionValida(v)).toBe(false);
  });

  it('todos los marcadores de marcadores.json tienen una posición válida', () => {
    for (const m of marcadores) expect(posicionValida(m.posicion), m.id).toBe(true);
  });

  it('puntosDeMarcador: sin posición no hay puntos, aunque haya ancla', () => {
    expect(puntosDeMarcador({ posicion: null, ancla: 'thalamus' })).toEqual([]);
  });

  it('puntosDeMarcador: un punto sigue a todas las piezas del ancla', () => {
    const r = puntosDeMarcador({ posicion: [1, 2, 3], ancla: 'thalamus' });
    expect(r).toHaveLength(1);
    expect(r[0]!.lado).toBeNull();
    expect(r[0]!.posicion).toEqual([1, 2, 3]);
    expect([...r[0]!.piezas].sort()).toEqual(['thalamus-l', 'thalamus-r']);
  });

  it('puntosDeMarcador: un punto sin ancla no sigue a ninguna pieza', () => {
    expect(puntosDeMarcador({ posicion: [1, 2, 3], ancla: null })).toEqual([{ lado: null, posicion: [1, 2, 3], piezas: [] }]);
  });

  it('puntosDeMarcador: { l, r } da un punto por lado con las piezas de su lado, en orden l, r', () => {
    expect(puntosDeMarcador({ posicion: { r: [-1, 2, 3], l: [1, 2, 3] }, ancla: 'thalamus' })).toEqual([
      { lado: 'l', posicion: [1, 2, 3], piezas: ['thalamus-l'] },
      { lado: 'r', posicion: [-1, 2, 3], piezas: ['thalamus-r'] },
    ]);
  });

  it('puntosDeMarcador: { l } da solo el punto izquierdo', () => {
    const r = puntosDeMarcador({ posicion: { l: [1, 2, 3] }, ancla: 'thalamus' });
    expect(r).toEqual([{ lado: 'l', posicion: [1, 2, 3], piezas: ['thalamus-l'] }]);
  });

  it('puntosDeMarcador: si el ancla no tiene piezas de ese lado, sigue a todas las del ancla', () => {
    expect(nodos['aqueduct-of-midbrain']?.lado).toBe('');
    expect(puntosDeMarcador({ posicion: { r: [1, 2, 3] }, ancla: 'aqueduct-of-midbrain' })).toEqual([
      { lado: 'r', posicion: [1, 2, 3], piezas: ['aqueduct-of-midbrain'] },
    ]);
  });

  it('puntosDeMarcador: { l, r } sin ancla da dos puntos sin piezas', () => {
    expect(puntosDeMarcador({ posicion: { l: [1, 2, 3], r: [-1, 2, 3] }, ancla: null })).toEqual([
      { lado: 'l', posicion: [1, 2, 3], piezas: [] },
      { lado: 'r', posicion: [-1, 2, 3], piezas: [] },
    ]);
  });
});

describe('propuestas de la spec 04 (T4)', () => {
  const resumen = readFileSync('docs/research/marcadores/resumen-propuestas.md', 'utf8');
  const secciones = new Map(resumen.split('\n## ').slice(1).map((s) => [s.slice(0, s.indexOf('\n')).trim(), s]));
  const ids = marcadores.map((m) => m.id);

  it('hay un marcador por cada sección del resumen y viceversa', () => {
    expect(ids).toHaveLength(26);
    expect([...secciones.keys()].sort()).toEqual([...ids].sort());
  });

  it.each(ids)('%s: tiene punto, o es sin_ubicar, o es aproximada con ancla y sin punto, y en esos dos casos el resumen dice el motivo', (id) => {
    const m = marcadores.find((x) => x.id === id)!;
    if (m.posicion !== null) return;
    const sinUbicar = m.estado === 'sin_ubicar';
    const aproximadaConAncla = m.estado === 'aproximada' && typeof m.ancla === 'string' && m.ancla !== '';
    expect(sinUbicar || aproximadaConAncla, `${id} sin punto debe ser sin_ubicar o aproximada con ancla`).toBe(true);
    const motivo = (secciones.get(id) ?? '').split('\n').find((l) => l.startsWith('- Motivo: '));
    expect(motivo, `${id} sin línea "- Motivo: " en el resumen`).toBeDefined();
    expect(motivo!.slice('- Motivo: '.length).trim(), id).not.toBe('');
  });

  it('ningún marcador es validada: solo un docente valida', () => {
    expect(marcadores.filter((m) => m.estado === 'validada').map((m) => m.id)).toEqual([]);
  });

  it('toda aproximada trae la fuente de ubicación en español y en inglés', () => {
    for (const m of marcadores.filter((x) => x.estado === 'aproximada')) {
      expect(m.fuente_ubicacion.es.trim(), `${m.id} es`).not.toBe('');
      expect(m.fuente_ubicacion.en.trim(), `${m.id} en`).not.toBe('');
    }
  });
});

describe('rutas por slug (F11)', () => {
  it('las mayúsculas en el slug no impiden resolverlo', () => {
    expect(entradaPorSlug('HIPOCAMPO', 'es')).toBe('hippocampus');
    expect(entradaPorSlug('Hippocampus', 'en')).toBe('hippocampus');
  });

  it('un slug que no existe no resuelve a nada', () => {
    expect(entradaPorSlug('no-existe', 'es')).toBeUndefined();
  });
});

describe('búsqueda bilingüe (F3)', () => {
  const b = crearBuscador(Object.values(estructuras));
  it.each([
    ['amygdala', 'amygdaloid-body'],
    ['amígdala', 'amygdaloid-body'],
    ['neumogastrico', 'vagus-nerve-x'],
    ['cranial nerve X', 'vagus-nerve-x'],
    ['hipocampo', 'hippocampus'],
    ['insular cortex', 'g-insula'],
    ['hypothalamus', 'hypothalamus'],
  ])('"%s" encuentra %s', (q, id) => {
    expect(b.buscar(q).slice(0, 3)).toContain(id);
  });

  it('"nervio vago" no devuelve dos resultados con el mismo nombre', () => {
    for (const i of idiomas) {
      const nombres = b.buscar('nervio vago').map((id) => nombre(estructuras[id], i));
      expect(nombres.length).toBeGreaterThan(1);
      expect(new Set(nombres).size, nombres.join(' | ')).toBe(nombres.length);
    }
  });

  it('tolera errores de digitación', () => {
    expect(b.buscar('hipocampp').slice(0, 3)).toContain('hippocampus');
  });
});
