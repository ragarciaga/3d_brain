# Requirements: Reportar un error desde la ficha (F12)

Status: draft  |  Date: 2026-10-19  |  Spec: docs/specs/05-error-report/
Brief: docs/brief.md  |  ADRs: docs/adr/0012-apps-script-canal-revision.md, docs/adr/0015-analitica-sin-cookies.md  |  Issue: #10  |  SPEC.md F12

## Context
El atlas sale al público en el hito 2 y cualquier estudiante puede encontrar un dato mal escrito, una traducción rara, un enlace roto o una pieza mal ubicada. Hoy no tiene cómo avisar. Este spec agrega "Reportar un error" en cada ficha: un formulario corto que abre un issue de GitHub ya llenado (o un correo a info@maysasp.com para quien no tiene cuenta), con el mismo formato de estructura, campo, idioma y versión que usa la revisión docente (F24). La app no recibe, no envía y no guarda nada del reporte.

## Users
- Estudiante o visitante: avisar de un error en menos de un minuto, con o sin cuenta de GitHub, sin que la app guarde sus datos.
- Editor: recibir cada reporte clasificado por tipo, con la estructura, el idioma, la versión de la ficha y la parte señalada, para corregirlo sin preguntar de qué se trata.
- Docente revisor: no ver una segunda vía de reporte mientras revisa, porque ya tiene la suya (F24).

## Out of scope
- Guardar reportes, un buzón propio o un backend: AGENTS.md prohíbe backend y datos personales en servidor.
- Avisar al editor por correo cuando llega un reporte: GitHub ya notifica los issues; se decide después del lanzamiento (tracked in docs/v2.md).
- Reportar desde el panel de trazos del vago o desde la guía del revisor: son del modo revisión, que tiene su propio canal (F24).
- Convertir un reporte en un cambio de `src/data/` de forma automática: solo un humano aprueba anatomía (AGENTS.md).
- Responder al reportante desde la app: la conversación sigue en GitHub o por correo.

## Existing behavior to preserve
- Ningún enlace que arma la app lleva el código del revisor (`r`): "Compartir" lee solo del estado de la vista, verificado por `e2e/revision-privacidad.spec.ts` (URL sin `r`) y `tests/enlaces.test.ts` `[e2e]`
- Política `strict-origin` de referrer y enlaces salientes con `target="_blank" rel="noopener noreferrer"`: verificado por `tests/analitica.test.ts` `[unit]`
- El beacon de analítica no se carga en modo revisión ni con código recordado: verificado por `tests/analitica.test.ts` `[unit]`
- La ficha en celular es una hoja inferior con alto medido para que el visor encuadre: verificado por `e2e/atlas.spec.ts` (viewport 390x844) `[e2e]`
- Orden de cierre con Escape: verificado por `tests/teclado.test.ts` `[unit]`
- `docs/enlaces.md` tiene exactamente los enlaces del repo que fija `tests/dominio.test.ts` `[unit]`
- Paridad de claves es y en, y cero textos en duro: verificado por `npm run check:i18n` y `tests/i18n.test.ts` `[unit]`

## R1: Botón en la ficha
Como visitante, quiero un botón visible en la ficha, para avisar de un error justo donde lo vi.

- R1.1 Mientras el modo revisión no está activo, el sistema deberá mostrar "Reportar un error" en el pie de cada ficha, junto a la versión, también en una entrada que no tiene ficha (versión `sin-ficha`). `[e2e]`
- R1.2 Mientras el modo revisión está activo (código en la URL o recordado), el sistema no deberá mostrar "Reportar un error". `[e2e]`
- R1.3 Cuando el visitante pulsa "Reportar un error", el sistema deberá abrir un diálogo con el foco en su título; Escape o "Cerrar" deberán cerrarlo y devolver el foco al botón. `[e2e]`
- R1.4 Mientras la pantalla mide 390 px de ancho, el sistema deberá mostrar el diálogo completo o desplazable hasta su último botón, sin tapar el contenido con elementos fijos. `[e2e]`

## R2: Formulario corto
Como visitante, quiero decir qué tipo de error es, en qué parte y qué está mal, para que el editor lo entienda sin preguntarme.

- R2.1 El sistema deberá pedir el tipo, obligatorio, entre cuatro opciones: contenido, traducción, enlace roto y pieza mal ubicada. `[e2e]`
- R2.2 El sistema deberá ofrecer la parte de la ficha, opcional, con las opciones que esa ficha tiene: nombre, latín, sinónimos, pieza, qué es, para qué sirve, ubicación, relaciones, cada afirmación de relevancia, cada fuente, recursos y "General", con "General" por omisión. `[unit]`
- R2.3 El sistema deberá pedir una descripción obligatoria de 1 a 1500 caracteres, con un contador visible, y no deberá aceptar más de 1500. `[unit]`
- R2.4 Si el tipo no está elegido o la descripción está vacía (o solo tiene espacios), entonces el sistema deberá mantener desactivados los dos botones de envío y decir qué falta. `[e2e]`
- R2.5 Antes de enviar, el sistema deberá avisar que el reporte por GitHub queda público, que no se pongan datos personales, y enlazar la página de Privacidad. `[e2e]`

## R3: Abrir el issue en GitHub
Como visitante con cuenta de GitHub, quiero que el issue se abra ya llenado, para solo revisarlo y enviarlo.

- R3.1 Cuando el visitante pulsa "Abrir en GitHub", el sistema deberá abrir en una pestaña nueva, con `rel="noopener noreferrer"`, el formulario de issue del tipo elegido en `github.com/ragarciaga/3d_brain`, con estructura, idioma, versión, parte y descripción ya llenos y un título "[<tipo>] <nombre de la estructura> (<id>)". `[unit]`
- R3.2 El sistema deberá armar el enlace solo con el tipo, el id de la estructura, el idioma, la versión de la ficha, la parte y la descripción; nunca deberá incluir el código del revisor, `location.search`, `location.hash` ni ningún otro dato de la URL o del navegador. `[unit]`
- R3.3 El sistema deberá codificar cada valor de modo que cualquier carácter de la descripción (`#`, `&`, saltos de línea, comillas, tildes) llegue intacto, y el enlace más largo posible (1500 caracteres en la descripción) deberá medir 8000 caracteres o menos. `[unit]`

## R4: Reportar por correo
Como visitante sin cuenta de GitHub, quiero enviar el mismo reporte por correo, para no tener que registrarme.

- R4.1 Cuando el visitante pulsa "Enviar por correo", el sistema deberá abrir un `mailto:` a info@maysasp.com con un asunto "[Maysa Brain] <tipo>: <id> (<idioma>, versión <versión>)" y un cuerpo con estructura, idioma, versión, parte y descripción. `[unit]`
- R4.2 El correo deberá cumplir la misma regla de datos que R3.2 y la misma codificación que R3.3. `[unit]`
- R4.3 El sistema deberá mostrar la dirección info@maysasp.com como texto en el diálogo, para quien no tiene un programa de correo configurado. `[e2e]`

## R5: La app no guarda ni envía nada
Como visitante, quiero que la app no se quede con lo que escribo, para reportar sin dar datos.

- R5.1 Mientras el diálogo está abierto y al enviar por cualquiera de las dos vías, el sistema no deberá escribir el reporte en IndexedDB, localStorage, sessionStorage ni cookies, ni hacer ninguna petición de red propia. `[e2e]`
- R5.2 Cuando el diálogo se cierra, el sistema deberá descartar el borrador; al abrirlo otra vez, el formulario deberá empezar vacío. `[e2e]`

## R6: Plantillas de issue
Como editor, quiero que cada reporte llegue clasificado, para ordenar el trabajo sin etiquetar a mano.

- R6.1 El repositorio deberá tener cuatro formularios de issue en `.github/ISSUE_TEMPLATE/` (contenido, traducción, enlace roto y pieza mal ubicada), cada uno con los campos estructura, idioma, versión, parte y descripción, y una etiqueta propia (`reporte:contenido`, `reporte:traduccion`, `reporte:enlace-roto`, `reporte:pieza`). `[unit]`
- R6.2 Los identificadores de campo de cada plantilla y su nombre de archivo deberán ser los mismos que usa la app para llenarlos. `[unit]`
- R6.3 Las cuatro etiquetas deberán existir en el repositorio antes de publicar la función. `[manual]` (reason: se crean en GitHub una vez y no hay prueba automática contra la API desde el CI)

## R7: Mismo formato que la revisión docente
Como editor, quiero que reportes y revisiones digan lo mismo de la misma forma, para cruzarlos.

- R7.1 El sistema deberá nombrar la parte con el mismo vocabulario de campos de F24 (`nombre`, `latin`, `sinonimos`, `pieza`, `que_es`, `para_que_sirve`, `ubicacion`, `relaciones`, `relevancia.N`, `fuente.N`), más `recursos` y `general`, y la versión con la de la ficha (o `sin-ficha`). `[unit]`

## R8: Textos y privacidad
Como visitante, quiero leer todo en mi idioma y saber qué pasa con mi reporte.

- R8.1 Todos los textos del botón, el diálogo, el asunto y el cuerpo del correo y el título del issue deberán salir de `es.json` y `en.json`, en el idioma activo. `[unit]`
- R8.2 La página de Privacidad deberá decir, en es y en, que un reporte por GitHub es público, que uno por correo llega a info@maysasp.com y que la app no guarda ninguno. `[unit]`
- R8.3 Las plantillas de issue deberán estar en español y en inglés en el mismo formulario. `[unit]`

## Verification summary
| Tag | Count |
|---|---|
| unit | 13 |
| integration | 0 |
| e2e | 10 |
| eval | 0 |
| manual | 1 |
