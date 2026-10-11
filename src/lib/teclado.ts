// Reglas del teclado global (Escape) que no dependen del DOM, para poder probarlas sin navegador.

/** Si el foco está en algo donde el usuario escribe o elige: Escape es de ese control, no del atlas. */
export function esCampoDeTexto(t: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  const etiqueta = t?.tagName?.toUpperCase();
  return etiqueta === 'INPUT' || etiqueta === 'SELECT' || etiqueta === 'TEXTAREA' || !!t?.isContentEditable;
}

export type AccionEscape = 'cerrar-menu' | 'cancelar-ubicar' | 'terminar-armado' | 'salir-aislar' | null;

/**
 * Qué hace Escape, en orden: cerrar el cajón del celular, cancelar "proponer posición", terminar el
 * armado pieza por pieza, salir del aislamiento. Dentro de un campo de texto no se termina el armado
 * ni se sale del aislamiento. Con el armado y el aislamiento activos, Escape sale solo del armado.
 */
export function accionEscape(p: {
  menuAbierto: boolean;
  ubicando: boolean;
  aislado: boolean;
  enCampo: boolean;
  armando?: boolean;
}): AccionEscape {
  if (p.menuAbierto) return 'cerrar-menu';
  if (p.ubicando) return 'cancelar-ubicar';
  if (p.armando && !p.enCampo) return 'terminar-armado';
  if (p.aislado && !p.enCampo) return 'salir-aislar';
  return null;
}
