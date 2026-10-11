// Convierte las respuestas del formulario de Google (CSV exportado de la hoja) en un resumen por
// estructura. Los issues usan el código del revisor, nunca su nombre: el nombre solo vive en la
// hoja del editor y aparece en la ficha cuando el editor aprueba la revisión.
import type { Respuesta } from '../../src/lib/revision.ts';

export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

export interface Envio {
  revisor: string;
  estructura: string;
  respuestas: Respuesta[];
  marcaTemporal: string;
}

const ID_VALIDO = /^[a-z0-9-]+$/;

/**
 * Busca en cada fila la celda con la carga JSON de la app ({"v":1,...}). El CSV viene de un
 * formulario público: un envío solo vale si su estructura (y la de cada respuesta) es un id
 * conocido y con forma de slug, así nadie puede escribir fuera de la carpeta de salida.
 */
export function leerEnvios(filas: string[][], idsValidos?: Set<string>): { envios: Envio[]; invalidas: number } {
  const envios: Envio[] = [];
  let invalidas = 0;
  for (const fila of filas.slice(1)) {
    const celda = fila.find((c) => c.trim().startsWith('{"v":'));
    if (!celda) {
      invalidas++;
      continue;
    }
    try {
      const d = JSON.parse(celda) as { revisor: string; estructura: string; respuestas: Respuesta[] };
      const ok = (id: unknown) => typeof id === 'string' && ID_VALIDO.test(id) && (!idsValidos || idsValidos.has(id));
      if (!ok(d.estructura) || !Array.isArray(d.respuestas) || !d.respuestas.every((r) => ok(r.estructura))) {
        invalidas++;
        continue;
      }
      envios.push({ revisor: String(d.revisor).slice(0, 40), estructura: d.estructura, respuestas: d.respuestas, marcaTemporal: fila[0] ?? '' });
    } catch {
      invalidas++;
    }
  }
  return { envios, invalidas };
}

/**
 * Un docente puede reenviar la misma estructura (o enviarla en partes): por revisor, campo e idioma
 * queda la respuesta más reciente. Las filas del CSV de Google vienen en orden cronológico.
 */
export function ultimasRespuestas(envios: Envio[]): { revisor: string; r: Respuesta }[] {
  const m = new Map<string, { revisor: string; r: Respuesta }>();
  for (const e of envios) {
    for (const r of e.respuestas) m.set(`${e.revisor}|${r.estructura}|${r.campo}|${r.idioma ?? ''}`, { revisor: e.revisor, r });
  }
  return [...m.values()];
}

export function resumenMarkdown(estructura: string, envios: Envio[], versionActual: string): string {
  const lineas = [`## Revisiones de \`${estructura}\``, '', `Versión actual del contenido: ${versionActual}`, ''];
  lineas.push('| Revisor | Campo | Idioma | Veredicto | Propuesta | Versión revisada |', '|---|---|---|---|---|---|');
  const limpiar = (t: string) => t.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');
  for (const { revisor, r } of ultimasRespuestas(envios)) {
    const propuesta = limpiar(r.propuesta ?? (r.posicion ? `posición ${r.posicion.join(', ')}` : r.ramo ? `ramo: ${r.ramo} (${r.malla})` : ''));
    const comentario = r.comentario ? ` Comentario: ${limpiar(r.comentario)}` : '';
    const vieja = r.version !== versionActual ? ' (desactualizada)' : '';
    lineas.push(`| ${revisor} | ${r.campo} | ${r.idioma ?? ''} | ${r.veredicto} | ${propuesta}${comentario} | ${r.version}${vieja} |`);
  }
  lineas.push('', 'Siguiente paso: preparar el cambio en `src/data/estructuras.json` y que el editor lo apruebe (tier C).');
  return lineas.join('\n');
}

/** Un solo resumen con todas las estructuras de la importación (un issue por importación). */
export function resumenConsolidado(envios: Envio[], versionDe: (id: string) => string): string {
  const ids = [...new Set(envios.map((e) => e.estructura))].sort();
  const partes = ids.map((id) => resumenMarkdown(id, envios.filter((e) => e.estructura === id), versionDe(id)));
  const total = ultimasRespuestas(envios).length;
  return [`# Revisiones docentes (${total} respuestas, ${ids.length} estructuras)`, '', ...partes].join('\n\n');
}
