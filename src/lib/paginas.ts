// Rutas de las páginas de texto (#168).
import type { Idioma } from '../data/tipos';

/** Slug de la página Privacidad por idioma. Ningún slug de estructura puede coincidir (lo prueba tests/paginas.test.ts). */
export const SLUG_PRIVACIDAD: Record<Idioma, string> = { es: 'privacidad', en: 'privacy' };

/** Ruta de la página Privacidad en el idioma dado. */
export function rutaPrivacidad(idioma: Idioma): string {
  return `/${idioma}/${SLUG_PRIVACIDAD[idioma]}`;
}

/** Verdadero si `resto` (lo que sigue al idioma en la URL) es uno de los dos slugs; ambos valen en los dos idiomas. */
export function esPrivacidad(resto: string): boolean {
  return Object.values(SLUG_PRIVACIDAD).includes(resto);
}
