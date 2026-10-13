// Lo que el modo revisión recuerda en este navegador: el código del revisor y el almacenamiento persistente.
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

/** Código guardado en este navegador, o null. Si solo está en sessionStorage (pestaña anterior al cambio), se usa ese. */
export function revisorRecordado(local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): string | null {
  for (const a of [local, sesion]) {
    try {
      const v = a?.getItem(CLAVE_REVISOR);
      if (v) return v;
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return null;
}

/** Guarda el código en localStorage (hasta "Salir del modo revisión") y limpia la copia de sesión. */
export function recordarRevisor(codigo: string, local: Almacen = almacen('localStorage'), sesion: Almacen = almacen('sessionStorage')): void {
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
