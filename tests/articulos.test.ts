import { describe, expect, it } from 'vitest';
import { estructuras } from '../src/data/atlas';
import { enlacesArticulos, terminosDeBusqueda } from '../src/lib/articulos';

describe('búsqueda de artículos científicos (F9)', () => {
  it('usa el nombre principal y completa el alterno del paréntesis con el sustantivo', () => {
    expect(terminosDeBusqueda('Medial occipitotemporal gyrus (Parahippocampal*)')).toEqual([
      'medial occipitotemporal gyrus',
      'parahippocampal gyrus',
    ]);
  });

  it('descarta números romanos, abreviaturas y calificativos entre paréntesis', () => {
    expect(terminosDeBusqueda('Vagus nerve (X)')).toEqual(['vagus nerve']);
    expect(terminosDeBusqueda('Superior temporal gyrus (Lateral part)')).toEqual(['superior temporal gyrus']);
    expect(terminosDeBusqueda('Nervio vago (ambos lados)')).toEqual(['nervio vago']);
    expect(terminosDeBusqueda('Insula (Subcentral gyrus and ant. and post. sulci*)')).toEqual(['insula']);
    expect(terminosDeBusqueda('Straight gyrus (Gyrus rectus)')).toEqual(['straight gyrus', 'gyrus rectus']);
  });

  it('un nombre PENDIENTE o vacío no da términos ni enlaces', () => {
    expect(terminosDeBusqueda('PENDIENTE')).toEqual([]);
    expect(enlacesArticulos('PENDIENTE', 'Hipocampo')).toEqual([]);
  });

  it('el hipocampo da revisiones en PubMed, acceso abierto en Europe PMC, Google Académico y SciELO en español', () => {
    const e = estructuras['hippocampus']!;
    const enlaces = enlacesArticulos(e.nombre.en, e.nombre.es);
    expect(enlaces.map((l) => l.base)).toEqual(['pubmed', 'europepmc', 'scholar', 'scielo']);
    const url = (b: string) => new URL(enlaces.find((l) => l.base === b)!.url);
    expect(url('pubmed').searchParams.get('term')).toBe('"hippocampus"');
    expect(url('pubmed').searchParams.get('filter')).toBe('pubt.review');
    expect(url('europepmc').searchParams.get('query')).toBe('("hippocampus") AND OPEN_ACCESS:y');
    expect(url('scholar').searchParams.get('q')).toBe('"hippocampus" OR "hipocampo"');
    expect(url('scielo').searchParams.get('q')).toBe('"hipocampo"');
  });

  it('toda estructura, grupo y marcador con nombre en inglés tiene enlaces a bases https', () => {
    for (const [id, e] of Object.entries(estructuras)) {
      if (e.nombre.en === 'PENDIENTE') continue;
      const enlaces = enlacesArticulos(e.nombre.en, e.nombre.es);
      expect(enlaces.length, id).toBeGreaterThanOrEqual(3);
      for (const l of enlaces) expect(new URL(l.url).protocol, id).toBe('https:');
    }
  });
});
