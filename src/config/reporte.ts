// Reportar un error (F12, ADR 0016): constantes del reporte. No hay backend: el reporte sale como un enlace
// a un formulario de issue de GitHub o como un correo, y la app no hace ninguna petición.
export const URL_ISSUES = 'https://github.com/ragarciaga/3d_brain/issues/new';
export const CORREO_REPORTES = 'info@maysasp.com';
export const TIPOS = ['contenido', 'traduccion', 'enlace-roto', 'pieza'] as const;
export type TipoReporte = (typeof TIPOS)[number];
export const PLANTILLA: Record<TipoReporte, string> = {
  contenido: 'contenido.yml',
  traduccion: 'traduccion.yml',
  'enlace-roto': 'enlace-roto.yml',
  pieza: 'pieza-mal-ubicada.yml',
};
export const MAX_DESCRIPCION = 1500;
export const MAX_URL = 8000;
