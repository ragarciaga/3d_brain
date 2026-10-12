// Enlaces de búsqueda de artículos científicos para cada estructura (F9). No son contenido del atlas:
// son búsquedas por el nombre en bases abiertas, para que el estudiante llegue a la literatura de esa
// pieza aunque su ficha esté en preparación. Los resultados no los revisa nadie del atlas.

export interface EnlaceArticulos {
  base: 'pubmed' | 'europepmc' | 'scholar' | 'scielo';
  url: string;
}

/** Números romanos o abreviaturas cortas entre paréntesis ("Vagus nerve (X)") no sirven para buscar. */
const RELLENO = /^([ivxlc]+|.{1,2})$/i;
/** "(Lateral part)", "(ambos lados)", "(... ant. and post. sulci)": calificativos, no otro nombre de la estructura. */
const CALIFICATIVO = /(^|\s)(part|parts|parte|partes|side|sides|lado|lados|ant\.|post\.)(\s|$)/i;

/**
 * Términos de búsqueda a partir de un nombre de Z-Anatomy/TA2. El paréntesis suele traer el nombre
 * más usado ("Medial occipitotemporal gyrus (Parahippocampal*)"): si es una sola palabra se completa
 * con el sustantivo del nombre principal ("parahippocampal gyrus").
 */
export function terminosDeBusqueda(nombre: string): string[] {
  if (!nombre || nombre === 'PENDIENTE') return []; // mismo marcador que PENDIENTE en src/data/atlas.ts
  const limpio = (x: string) => x.replace(/[*"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const principal = limpio(nombre.replace(/\([^)]*\)/g, ''));
  const res = principal ? [principal] : [];
  for (const [, dentro] of nombre.matchAll(/\(([^)]*)\)/g)) {
    const alterno = limpio(dentro ?? '');
    if (!alterno || RELLENO.test(alterno) || CALIFICATIVO.test(alterno)) continue;
    const sustantivo = principal.split(' ').at(-1);
    const completo = !alterno.includes(' ') && sustantivo ? `${alterno} ${sustantivo}` : alterno;
    if (!res.includes(completo)) res.push(completo);
  }
  return res;
}

const unir = (terminos: string[]) => terminos.map((x) => `"${x}"`).join(' OR ');

/**
 * Cuatro búsquedas: revisiones en PubMed y acceso abierto en Europe PMC (por el nombre en inglés),
 * Google Académico (inglés y español) y SciELO (español, literatura latinoamericana abierta).
 * Sin términos en inglés no hay enlaces.
 */
export function enlacesArticulos(nombreEn: string, nombreEs: string): EnlaceArticulos[] {
  const en = terminosDeBusqueda(nombreEn);
  if (!en.length) return [];
  const es = terminosDeBusqueda(nombreEs);
  const q = encodeURIComponent;
  const enlaces: EnlaceArticulos[] = [
    { base: 'pubmed', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${q(unir(en))}&filter=pubt.review` },
    { base: 'europepmc', url: `https://europepmc.org/search?query=${q(`(${unir(en)}) AND OPEN_ACCESS:y`)}` },
    { base: 'scholar', url: `https://scholar.google.com/scholar?q=${q(unir([...en, ...es.filter((x) => !en.includes(x))]))}` },
  ];
  if (es.length) enlaces.push({ base: 'scielo', url: `https://search.scielo.org/?q=${q(unir(es))}&lang=es` });
  return enlaces;
}
