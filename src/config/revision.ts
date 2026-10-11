// Configuración del formulario de Google para el modo revisión (F24, docs/adr/0008).
// Cómo llenarla: docs/revision-docente.md. Mientras urlFormulario esté vacía, la app ofrece
// descargar o copiar la revisión en vez de abrir el formulario.
export const configRevision = {
  /** URL del formulario terminada en /viewform, por ejemplo https://docs.google.com/forms/d/e/XXXX/viewform */
  urlFormulario: '',
  /** Identificadores de las preguntas, del tipo entry.123456789 (se ven en "Obtener vínculo prellenado"). */
  campos: {
    codigo: '',
    estructura: '',
    revision: '',
  },
};
