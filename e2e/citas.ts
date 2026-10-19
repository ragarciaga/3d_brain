// Cita esperada de una clave de fuente, leída de docs/research/marcadores/fuentes.md con un corte propio y simple
// (no usa el lector de producción de src/lib/trazos.ts, para que la prueba no dependa de lo que verifica).
// Línea: `- [Clave] Autores. Título. [Revista. ]Año. PMID n. [PMCID x.] [DOI d.] [nota].`
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export interface CitaEsperada {
  autores: string;
  titulo: string;
  anio: string;
  /** Los identificadores enlazados: lo que se ve y a dónde lleva. */
  ids: { texto: string; href: string }[];
}

const md = readFileSync('docs/research/marcadores/fuentes.md', 'utf8');
const referencias = md.slice(md.indexOf('\n## Referencias'));

export function citaEsperada(clave: string): CitaEsperada {
  const linea = referencias.split('\n').find((l) => l.startsWith(`- [${clave}] `));
  if (!linea) throw new Error(`fuentes.md no trae la clave ${clave} en ## Referencias`);
  const partes = linea.slice(`- [${clave}] `.length).replace(/\.$/, '').split('. ');
  const i = partes.findIndex((p, k) => k >= 2 && /^\d{4}$/.test(p));
  if (i < 0) throw new Error(`la entrada ${clave} no trae año`);
  const ids: CitaEsperada['ids'] = [];
  for (const p of partes.slice(i + 1)) {
    const pmid = /^PMID (\d+)$/.exec(p);
    const doi = /^DOI (10\.\S+)$/.exec(p);
    if (pmid) ids.push({ texto: p, href: `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/` });
    else if (doi) ids.push({ texto: p, href: `https://doi.org/${doi[1]}` });
    else if (p.startsWith('https://')) ids.push({ texto: p, href: p });
  }
  if (ids.length === 0) throw new Error(`la entrada ${clave} no trae identificador`);
  return { autores: partes[0]!, titulo: partes[1]!, anio: partes[i]!, ids };
}

/**
 * El bloque `trazo-fuente` muestra la cita de la clave (autores, título, año y cada identificador como enlace con
 * su href) detrás de la etiqueta de la lengua (`etiqueta`: "Fuente de la regla: " o "Rule source: "), y no la
 * clave sola. El texto de la cita no se traduce: es el mismo en los dos idiomas.
 */
export async function esperarCitaVisible(page: Page, clave: string, etiqueta: string): Promise<void> {
  const c = citaEsperada(clave);
  const bloque = page.getByTestId('trazo-fuente');
  await expect(bloque).toContainText(`${etiqueta}${c.autores}.`);
  await expect(bloque).toContainText(c.titulo);
  await expect(bloque).toContainText(c.anio);
  for (const id of c.ids) {
    const enlace = bloque.getByRole('link', { name: id.texto, exact: true });
    await expect(enlace).toHaveAttribute('href', id.href);
    await expect(enlace).toHaveAttribute('target', '_blank');
    await expect(enlace).toHaveAttribute('rel', /noopener/);
  }
  expect(await bloque.innerText()).not.toContain(clave);
}
