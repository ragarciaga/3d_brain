// Configuración del modo revisión (F24): el formulario de Google (docs/adr/0008) y el canal de retorno
// del Apps Script del editor (docs/adr/0012). Cómo llenarla: docs/revision-docente.md. Mientras
// urlFormulario esté vacía, la app ofrece descargar o copiar la revisión en vez de abrir el formulario.
// Mientras urlCanal esté vacía no hay canal y el formulario sigue siendo el único camino (R7.2).
export const configRevision = {
  /** URL del formulario terminada en /viewform, por ejemplo https://docs.google.com/forms/d/e/XXXX/viewform */
  // Formulario "Revisión del atlas Maysa Brain" en el Drive de Maysa Digital (2026-10-12).
  urlFormulario: 'https://docs.google.com/forms/d/e/1FAIpQLSfT2a766E2OwUtl65MyfFBRgZji_wEW5-EyUA4NGas_xpO5SQ/viewform',
  /** Formulario de registro del docente (una vez: nombre, rol y autorización, Ley 1581 de 2012). */
  urlRegistro: 'https://docs.google.com/forms/d/e/1FAIpQLSdy6h0gI-nrX6s_ZMGq9PSsSTYxhSd0e7ZVDx4p0_QvgHrJ2A/viewform',
  /**
   * URL /exec del Apps Script del editor (ADR 0012). Vacía significa sin canal: la revisión usa el
   * formulario como hasta ahora (R7.2). Se llena después del montaje (docs/revision-docente.md). Las
   * pruebas e2e la fijan o la anulan con la costura de desarrollo de src/main.tsx (`__urlCanalInicial` o
   * `__fijarUrlCanal`); este archivo no puede leer `import.meta` ni `window` porque Playwright lo importa desde Node.
   */
  urlCanal: '',
  /** Identificadores de las preguntas, del tipo entry.123456789 (se ven en "Obtener vínculo prellenado"). */
  campos: {
    codigo: 'entry.1587049987',
    estructura: 'entry.643468553',
    revision: 'entry.1116226740',
  },
};

/** Versión del texto de autorización de tratamiento de datos. Cambiarla vuelve a pedir la autorización a todos (R2.5). */
export const VERSION_AUTORIZACION = '1';
