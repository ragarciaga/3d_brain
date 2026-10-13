// Reglas del teclado global (Escape) que no dependen del DOM, para poder probarlas sin navegador.

/** Si el foco está en algo donde el usuario escribe o elige: Escape es de ese control, no del atlas. */
export function esCampoDeTexto(t: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  const etiqueta = t?.tagName?.toUpperCase();
  return etiqueta === 'INPUT' || etiqueta === 'SELECT' || etiqueta === 'TEXTAREA' || !!t?.isContentEditable;
}

export type AccionEscape = 'cerrar-revision' | 'cerrar-menu' | 'cancelar-ubicar' | 'salir-aislar' | null;

/**
 * Qué hace Escape, en orden: cerrar el diálogo de revisión, cerrar el cajón del celular, cancelar
 * "proponer posición", salir del aislamiento. El diálogo de revisión se cierra aunque el foco esté
 * en un campo de texto; el aislamiento no se sale desde un campo.
 */
export function accionEscape(p: {
  dialogoRevision: boolean;
  menuAbierto: boolean;
  ubicando: boolean;
  aislado: boolean;
  enCampo: boolean;
}): AccionEscape {
  if (p.dialogoRevision) return 'cerrar-revision';
  if (p.menuAbierto) return 'cerrar-menu';
  if (p.ubicando) return 'cancelar-ubicar';
  if (p.aislado && !p.enCampo) return 'salir-aislar';
  return null;
}
