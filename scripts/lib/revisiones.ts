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

/** Busca en cada fila la celda con la carga JSON de la app ({"v":1,...}). */
export function leerEnvios(filas: string[][]): { envios: Envio[]; invalidas: number } {
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
      envios.push({ revisor: d.revisor, estructura: d.estructura, respuestas: d.respuestas, marcaTemporal: fila[0] ?? '' });
    } catch {
      invalidas++;
    }
  }
  return { envios, invalidas };
}

export function resumenMarkdown(estructura: string, envios: Envio[], versionActual: string): string {
  const lineas = [`## Revisiones de \`${estructura}\``, '', `Versión actual del contenido: ${versionActual}`, ''];
  lineas.push('| Revisor | Campo | Idioma | Veredicto | Propuesta | Versión revisada |', '|---|---|---|---|---|---|');
  for (const e of envios) {
    for (const r of e.respuestas) {
      const propuesta = (r.propuesta ?? (r.posicion ? `posición ${r.posicion.join(', ')}` : r.ramo ? `ramo: ${r.ramo} (${r.malla})` : ''))
        .replace(/\|/g, '/')
        .replace(/\n/g, ' ');
      const vieja = r.version !== versionActual ? ' (desactualizada)' : '';
      lineas.push(`| ${e.revisor} | ${r.campo} | ${r.idioma ?? ''} | ${r.veredicto} | ${propuesta} | ${r.version}${vieja} |`);
    }
  }
  lineas.push('', 'Siguiente paso: preparar el cambio en `src/data/estructuras.json` y que el editor lo apruebe (tier C).');
  return lineas.join('\n');
}
