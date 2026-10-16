// Línea que `e2e/canal-real.ts` anota por cada petición que sale a un host de Apps Script. Es una función
// pura, sin Playwright, para probarla con Vitest (tests/canal-real.test.ts). Devuelve solo método, host y
// acción: nunca la URL completa, el cuerpo ni el código del revisor.

const ACCION_VALIDA = /^[a-z]{1,20}$/;

/** La acción del cuerpo POST (JSON con `accion` de texto), si la trae. */
function accionDelCuerpo(cuerpo: string | null): string | null {
  if (typeof cuerpo !== 'string') return null;
  try {
    const d: unknown = JSON.parse(cuerpo);
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
    const accion = (d as Record<string, unknown>)['accion'];
    return typeof accion === 'string' ? accion : null;
  } catch {
    return null;
  }
}

/**
 * `<método> <host> accion=<acción>`. La acción sale del cuerpo POST si es un JSON con `accion` de texto; si no,
 * de la query; si no, queda vacía. Un valor que no sea de 1 a 20 letras minúsculas se anota como `?`, para que
 * un código del revisor puesto en ese lugar no llegue a la salida.
 */
export function lineaDeSalida(metodo: string, url: URL, cuerpo: string | null): string {
  const elegida = accionDelCuerpo(cuerpo) ?? url.searchParams.get('accion') ?? '';
  const accion = elegida === '' || ACCION_VALIDA.test(elegida) ? elegida : '?';
  return `${metodo} ${url.hostname} accion=${accion}`;
}
