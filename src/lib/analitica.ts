// Analítica de visitas (docs/adr/0015-analitica-sin-cookies.md). El cargador inline de `vite.config.ts` crea el
// `<script>` del beacon de Cloudflare solo en páginas que no se abrieron en modo revisión. Una página abierta
// antes (bfcache, otra pestaña) conserva su beacon, que podría leer el código recordado: si la app va a adoptar
// un código en una página así, recarga una vez en vez de activar el modo en caliente (#149).

/** Atributo del `<script>` del beacon. Debe coincidir con `CARGADOR_BEACON` (una prueba lo fija). */
export const ATRIBUTO_BEACON = 'data-cf-beacon';
export const SELECTOR_BEACON = `script[${ATRIBUTO_BEACON}]`;
/** Marca que el cargador pone en `<html>` al crear el script. */
export const ATRIBUTO_DOCUMENTO = 'data-beacon-cargado';
/** Llave de sessionStorage: ya se recargó una vez por un intento de adopción. No contiene el código. */
export const MARCA_RECARGA = 'atlas:recarga-revision';

type Sesion = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

function sesionPorDefecto(): Sesion {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** true si este documento tiene el beacon: el `<script>` o la marca que el cargador deja en `<html>`. */
export function beaconCargado(
  doc: Pick<Document, 'querySelector' | 'documentElement'> | null = typeof document !== 'undefined' ? document : null,
): boolean {
  if (!doc) return false;
  if (doc.querySelector(SELECTOR_BEACON)) return true;
  return doc.documentElement?.getAttribute(ATRIBUTO_DOCUMENTO) === '1';
}

/**
 * Qué hacer cuando la app va a adoptar un código de revisor. Sin beacon: adoptar (y se borra la marca de recarga,
 * así que el tope es de una recarga por intento de adopción). Con beacon: recargar una vez; si ya se recargó, o no
 * se puede escribir la marca, bloquear. Nunca se adopta en caliente con beacon.
 */
export function decidirAdopcion(beacon: boolean, sesion: Sesion = sesionPorDefecto()): 'adoptar' | 'recargar' | 'bloquear' {
  if (!beacon) {
    try {
      sesion?.removeItem(MARCA_RECARGA);
    } catch {
      /* sin sessionStorage: nada que borrar */
    }
    return 'adoptar';
  }
  try {
    if (!sesion) return 'bloquear';
    if (sesion.getItem(MARCA_RECARGA)) return 'bloquear';
    sesion.setItem(MARCA_RECARGA, '1');
    return sesion.getItem(MARCA_RECARGA) === '1' ? 'recargar' : 'bloquear';
  } catch {
    return 'bloquear';
  }
}
