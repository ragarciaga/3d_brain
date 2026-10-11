// Integridad del contenido: lo que la app promete en AGENTS.md (fuente obligatoria, bilingüe,
// nada huérfano) se verifica aquí, no a mano.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arbol, entradaPorSlug, estructuras, grupos, marcadores, nodos, piezasDeEntrada } from '../src/data/atlas';
import { crearBuscador } from '../src/lib/busqueda';
import { nombre } from '../src/lib/nombres';

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

  it('el marcador del área de Wernicke existe sin ubicar, bajo el lóbulo temporal', () => {
    const m = marcadores.find((x) => x.id === 'm-wernicke-area');
    expect(m?.padre).toBe('g-temporal-lobe');
    expect(m?.estado).toBe('sin_ubicar');
    expect(m?.posicion).toBeNull();
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
    expect(pag.fuente_ubicacion.en).toContain('cerebral aqueduct of the midbrain');
    expect(estructuras['m-periaqueductal-grey']!.fuente_nombre).toBe('PENDIENTE');
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

  it('marcadores y grupos de estudio apuntan a cosas que existen', () => {
    for (const m of marcadores) {
      expect(estructuras[m.id], m.id).toBeTruthy();
      expect(nodos[m.padre], m.padre).toBeTruthy();
      if (m.ancla) expect(piezasDeEntrada(m.ancla).length, m.ancla).toBeGreaterThan(0);
      if (m.estado !== 'sin_ubicar') expect(m.posicion || m.ancla, m.id).toBeTruthy();
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
