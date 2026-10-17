// Lo que el modo revisión recuerda en este navegador: el código del revisor y el almacenamiento persistente.
import { delMany } from 'idb-keyval';
import { claveGuiaVista, claveRevisionIdb } from './huella';
import { REVISOR_VALIDO } from './revision';

export const CLAVE_REVISOR = 'atlas:revisor';

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

// En Safari privado o con el almacenamiento bloqueado, el solo acceso a la propiedad lanza.
function almacen(nombre: 'localStorage' | 'sessionStorage'): Almacen {
  try {
    return globalThis[nombre] ?? null;
  } catch {
    return null;
  }
}

/**
 * Código válido (REVISOR_VALIDO) guardado en este navegador, o null. Un valor guardado que no cumple el formato
 * se ignora sin borrarlo. Si solo hay uno válido en sessionStorage (pestaña anterior al cambio), se usa ese.
 */
export function revisorRecordado(local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): string | null {
  for (const a of [local, sesion]) {
    try {
      const v = a?.getItem(CLAVE_REVISOR);
      if (v && REVISOR_VALIDO.test(v)) return v;
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return null;
}

/**
 * Guarda el código en localStorage (hasta "Salir del modo revisión") y limpia la copia de sesión, solo si cumple
 * REVISOR_VALIDO. Un código inválido no escribe ni borra nada.
 */
export function recordarRevisor(codigo: string, local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): void {
  if (!REVISOR_VALIDO.test(codigo)) return;
  try {
    local?.setItem(CLAVE_REVISOR, codigo);
    sesion?.removeItem(CLAVE_REVISOR);
  } catch {
    /* sin almacenamiento local: el modo dura hasta recargar */
  }
}

/** Borra el código de los dos almacenes. No toca IndexedDB. */
export function olvidarRevisor(local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): void {
  for (const a of [local, sesion]) {
    try {
      a?.removeItem(CLAVE_REVISOR);
    } catch {
      /* nada que borrar */
    }
  }
}

/**
 * La misma búsqueda sin el parámetro `r` (el código del enlace de revisión), con los demás intactos.
 * Devuelve '' o '?' + resto.
 */
export function busquedaSinCodigo(search: string): string {
  const p = new URLSearchParams(search);
  p.delete('r');
  const resto = p.toString();
  return resto ? `?${resto}` : '';
}

/**
 * true si este navegador ya no recuerda `codigo`: se pudo leer al menos un almacén y ninguno de los legibles lo
 * guarda en `atlas:revisor`. Si no se puede leer ninguno, da false (no se puede saber, así que se permite escribir).
 * Las escrituras de IndexedDB y de la llave de guía lo consultan para no recrear lo que otra pestaña borró.
 */
export function codigoRetirado(codigo: string, local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): boolean {
  let legible = false;
  for (const a of [local, sesion]) {
    try {
      if (!a) continue;
      const v = a.getItem(CLAVE_REVISOR);
      legible = true;
      if (v === codigo) return false;
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return legible;
}

/**
 * "Borrar también de este equipo": quita la llave de la guía y el registro de IndexedDB de ese código, con huella
 * y también las llaves viejas en claro (`revision:<código>`, `atlas:guia-vista:<código>`). No toca los de otro
 * código. Nunca rechaza.
 */
export async function borrarDeEsteEquipo(
  codigo: string,
  local: Almacen = almacen('localStorage'),
  borrarIdb: (claves: string[]) => Promise<void> = delMany,
): Promise<void> {
  try {
    local?.removeItem(claveGuiaVista(codigo));
    local?.removeItem(`atlas:guia-vista:${codigo}`);
  } catch {
    /* sin almacenamiento local */
  }
  try {
    await borrarIdb([claveRevisionIdb(codigo), `revision:${codigo}`]);
  } catch {
    /* sin IndexedDB: no hay nada que borrar */
  }
}

type VentanaEventos = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Saca del modo revisión a esta pestaña cuando otra borra o cambia el código recordado (`atlas:revisor`), también con
 * `localStorage.clear()` (`key` null), y al volver del bfcache (`pageshow` con `persisted`) si el código ya no está
 * recordado. sessionStorage no emite `storage` entre pestañas; `recordarRevisor` guarda en localStorage, que sí.
 * Devuelve la función que quita los oyentes.
 */
export function escucharRetiroDelCodigo(
  actual: () => string | null,
  alRetirar: () => void,
  ventana: VentanaEventos = window,
  retirado: (codigo: string) => boolean = codigoRetirado,
): () => void {
  const alAlmacenar = (e: Event) => {
    const { key, newValue } = e as StorageEvent;
    if (key !== CLAVE_REVISOR && key !== null) return;
    const codigo = actual();
    if (codigo === null) return;
    if (key === null || newValue !== codigo) alRetirar();
  };
  const alMostrar = (e: Event) => {
    if (!(e as PageTransitionEvent).persisted) return;
    const codigo = actual();
    if (codigo && retirado(codigo)) alRetirar();
  };
  ventana.addEventListener('storage', alAlmacenar);
  ventana.addEventListener('pageshow', alMostrar);
  return () => {
    ventana.removeEventListener('storage', alAlmacenar);
    ventana.removeEventListener('pageshow', alMostrar);
  };
}

type AlmacenamientoPersistente = { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> };

/**
 * Pide al navegador que no borre el almacenamiento del sitio (sin garantía de que lo conceda).
 * Nunca lanza ni rechaza: sin soporte o ante un error devuelve false.
 */
export async function pedirPersistencia(
  storage: AlmacenamientoPersistente | null | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined,
): Promise<boolean> {
  try {
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
