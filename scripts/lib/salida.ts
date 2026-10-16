import { lstatSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Vacía la carpeta de salida del importador de revisiones antes de escribir, para que ningún `<id>.md` de
 * una corrida anterior se mezcle con los nuevos. Qué borra: solo las entradas de primer nivel de la carpeta
 * `join(raiz, ...partes)` cuyo nombre termina en `.md` (sin importar mayúsculas) y que son archivo o enlace;
 * de un enlace se borra el enlace, nunca su destino, y el borrado no pasa por la papelera. Qué no toca:
 * subcarpetas (no entra a ellas), archivos con otra extensión y todo lo que hay fuera de la carpeta, por
 * ejemplo el resto de `pipeline/salida/`.
 *
 * Cada tramo de la ruta se revisa con `lstat`, nunca con `stat` ni `realpath`: si algún tramo es un enlace
 * simbólico (o junction) o un archivo, lanza un `Error` sin borrar nada, así un enlace no puede llevar el
 * borrado fuera de la carpeta. `raiz` no se revisa (el repositorio puede vivir bajo un enlace). Los tramos
 * que faltan se crean. Devuelve la carpeta y cuántos archivos borró.
 */
export function vaciarSalida(raiz: string, partes: readonly string[]): { carpeta: string; borrados: number } {
  let ruta = raiz;
  for (let i = 0; i < partes.length; i++) {
    ruta = join(ruta, partes[i]!);
    const estado = lstatSync(ruta, { throwIfNoEntry: false });
    if (!estado) {
      mkdirSync(ruta);
    } else if (estado.isSymbolicLink() || !estado.isDirectory()) {
      throw new Error(`${join(...partes.slice(0, i + 1))} es un enlace o un archivo, no una carpeta: no se borró nada.`);
    }
  }
  let borrados = 0;
  for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
    if (entrada.name.toLowerCase().endsWith('.md') && (entrada.isFile() || entrada.isSymbolicLink())) {
      unlinkSync(join(ruta, entrada.name));
      borrados++;
    }
  }
  return { carpeta: ruta, borrados };
}
