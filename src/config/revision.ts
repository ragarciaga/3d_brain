// Configuración del formulario de Google para el modo revisión (F24, docs/adr/0008).
// Cómo llenarla: docs/revision-docente.md. Mientras urlFormulario esté vacía, la app ofrece
// descargar o copiar la revisión en vez de abrir el formulario.
export const configRevision = {
  /** URL del formulario terminada en /viewform, por ejemplo https://docs.google.com/forms/d/e/XXXX/viewform */
  // Formulario "Revisión del atlas Maysa Brain" en el Drive de Maysa Digital (2026-10-12).
  urlFormulario: 'https://docs.google.com/forms/d/e/1FAIpQLSfT2a766E2OwUtl65MyfFBRgZji_wEW5-EyUA4NGas_xpO5SQ/viewform',
  /** Formulario de registro del docente (una vez: nombre, rol y autorización, Ley 1581 de 2012). */
  urlRegistro: 'https://docs.google.com/forms/d/e/1FAIpQLSdy6h0gI-nrX6s_ZMGq9PSsSTYxhSd0e7ZVDx4p0_QvgHrJ2A/viewform',
  /** Identificadores de las preguntas, del tipo entry.123456789 (se ven en "Obtener vínculo prellenado"). */
  campos: {
    codigo: 'entry.1587049987',
    estructura: 'entry.643468553',
    revision: 'entry.1116226740',
  },
};
