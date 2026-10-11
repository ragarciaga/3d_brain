// Normalización para búsqueda tolerante a tildes y mayúsculas.
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
