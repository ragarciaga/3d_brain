# Requirements: Canal de retorno de la revisión docente por Apps Script

Status: approved  |  Date: 2026-10-14  |  Spec: docs/specs/03-review-return-channel/
Línea base: desconocida
Brief: docs/brief.md  |  ADRs: docs/adr/0008-revision-docente.md, docs/adr/0012-apps-script-canal-revision.md  |  Decisión: issue #67 (opción B)

## Context
Hoy el docente revisa dentro de la web, pero devolver la revisión exige registrarse en un formulario de Google, pulsar "Enviar todo", enviar uno o varios formularios prellenados y volver a pulsar "Sí, lo envié". Si cierra la pestaña sin enviar, borra el navegador o cambia de equipo, la revisión se pierde y nadie se entera. Como cada docente tiene una sola oportunidad de revisar, este spec reemplaza ese camino por un Apps Script en la cuenta de Google del editor: las respuestas se guardan solas mientras el docente revisa, la autorización se da una vez dentro de la app y el avance sigue en cualquier equipo. Además, las fichas dejan de mostrar el nombre del revisor y dicen "Revisado por un docente universitario".

## Users
- Docente revisor (psicólogo que dicta neuropsicología o biopsicología): revisar sin pasos de envío, sin formularios y sin perder nada.
- Editor: recibir cada respuesta en su hoja de Google, saber quién autorizó y quién puede revisar el vago, e importar con el importador de siempre.
- Estudiante: saber que una ficha fue revisada por un docente, sin datos personales del revisor.

## Out of scope
- Iniciar sesión con Google: guarda correos; ya se descartó en el ADR 0008 (tracked in docs/v2.md).
- Aviso por correo al editor cuando llega una revisión: se decide después de la primera sesión docente (tracked in docs/v2.md).
- Revisar la descripción de los grupos de estudio: ya está diferido en docs/v2.md.
- Aplicar revisiones solas a `src/data/`: AGENTS.md lo prohíbe; el importador solo genera resúmenes.
- Mostrar el nombre, la profesión o la universidad del revisor: decisión del editor del 2026-10-14.

## Existing behavior to preserve
- Solo viajan respuestas completas (un "Corregir" sin propuesta, posición ni ramo no se envía): verificado por `tests/revision.test.ts` (incompletas) y `e2e/revision-dialogos.spec.ts` `[e2e]`
- Una respuesta editada después de guardarse vuelve a quedar pendiente hasta guardarse otra vez (misma clave, fecha distinta): verificado por `tests/revision.test.ts` (pendientes y confirmadas) `[unit]`
- Recargar la página no pierde respuestas ni su estado de guardado (IndexedDB): verificado por `e2e/revision-dialogos.spec.ts` `[e2e]`
- La carga `v:2` (`{"v":2,"r":<código>,"e":{<id>:[claves cortas]}}`) y la importación de `v:1` y `v:2`: verificado por `tests/revisiones.test.ts` `[unit]`
- El importador trata todo como entrada no confiable, descarta códigos fuera del padrón y nunca escribe el código en la salida (solo el alias): verificado por `tests/revisiones.test.ts` `[unit]`
- `?r=` activa y recuerda el modo revisión; "Salir del modo revisión" olvida el código y conserva el avance: verificado por `e2e/respaldo.spec.ts` (código recordado) y `tests/persistencia.test.ts` `[e2e]`
- Foco, Escape y final visible en celular de los diálogos de revisión: verificado por `e2e/revision-dialogos.spec.ts` `[e2e]`
- Paridad de claves es y en, y cero textos en duro: verificado por `npm run check:i18n` y `tests/i18n.test.ts` `[unit]`

## R1: Entrada con el enlace personal
Como docente, quiero entrar con mi enlace sin escribir ningún código, para empezar a revisar de inmediato.

- R1.1 Cuando el docente abre `/es/revision?r=<código>` o `/en/revision?r=<código>`, el sistema deberá activar el modo revisión con ese código sin pedirle que lo escriba. `[e2e]`
- R1.2 Si el código del enlace no cumple el formato de código de revisor (1 a 40 caracteres entre letras, números, guion y guion bajo), entonces el sistema deberá mostrar "Este enlace no es válido; pide uno nuevo al editor" y no deberá activar el modo revisión ni guardar el código. `[e2e]`
- R1.3 Si el canal de retorno responde que el código no está en el padrón, entonces el sistema deberá mostrar "Tu código no está activo; escribe al editor" y no deberá guardar respuestas en el canal. `[e2e]`

## R2: Autorización una sola vez dentro de la app
Como docente, quiero autorizar el tratamiento de mis datos una sola vez y en la misma pantalla, para no llenar formularios aparte.

- R2.1 Cuando el docente va a guardar su primera respuesta y su código no tiene autorización registrada, el sistema deberá mostrar un diálogo con una casilla obligatoria de autorización (Ley 1581 de 2012) y una casilla opcional "También puedo revisar el recorrido del nervio vago en cuello y tórax". `[e2e]`
- R2.2 Mientras la casilla de autorización no esté marcada, el sistema deberá mantener deshabilitado el botón para continuar y no deberá enviar nada al canal de retorno. `[e2e]`
- R2.3 Cuando el docente acepta, el sistema deberá registrar en la hoja del editor el código, la fecha y hora, la versión del texto de autorización y el valor de la casilla del vago. `[integration]`
- R2.4 Si el código ya tiene una autorización registrada con la versión vigente del texto, entonces el sistema no deberá volver a mostrar el diálogo, en ningún equipo. `[e2e]`
- R2.5 Si la versión del texto de autorización cambia, entonces el sistema deberá mostrar el diálogo otra vez antes del siguiente guardado. `[unit]`
- R2.6 El sistema no deberá pedir nombre, correo, profesión ni universidad en ningún paso. `[e2e]`

## R3: Guardado automático
Como docente, quiero que cada respuesta se guarde sola, para no tener que acordarme de enviar.

- R3.1 Cuando el docente completa o cambia una respuesta, el sistema deberá enviarla al canal de retorno a más tardar 3 s después del último cambio. `[e2e]`
- R3.2 Cuando el canal confirma la recepción, el sistema deberá marcar la respuesta como guardada y mostrar "Guardado ✓" en el panel de revisión. `[e2e]`
- R3.3 El sistema deberá marcar una respuesta como guardada solo cuando el canal haya confirmado la recepción de esa misma versión (clave y fecha). `[unit]`
- R3.4 Si el envío falla por red o por error del canal, entonces el sistema deberá conservar la respuesta como pendiente, mostrar "Sin conexión: se guardará cuando vuelva" y reintentar con espera creciente (2 s, 4 s, 8 s, hasta 5 min entre intentos). `[unit]`
- R3.5 Si el docente recarga o cierra la página con respuestas pendientes, entonces el sistema deberá reintentar enviarlas la siguiente vez que abra la app con su código. `[e2e]`
- R3.6 Si el canal recibe dos veces la misma versión de una respuesta, entonces la hoja deberá conservar el resultado como una sola respuesta para el importador (la última por código, estructura, campo e idioma). `[unit]`
- R3.7 El sistema no deberá mostrar ningún botón ni paso de "Enviar", "Abrir formulario" o "Sí, lo envié" mientras el canal de retorno funcione. `[e2e]`
- R3.8 Cuando el docente quita una marca (pulsa otra vez el mismo botón o deshace la posición propuesta), el sistema deberá guardar en el canal un retiro con la misma clave (estructura, campo e idioma) y una fecha nueva, sin texto de propuesta ni de comentario, de modo que la última fila por clave manda en la hoja, en `leer` (que deja la clave fuera de `respuestas` y la devuelve aparte en `retiradas`) y en el importador. El retiro exige la autorización vigente y no cuenta para la casilla del vago. `[unit]` (#217)
- R3.9 Si el script del canal no declara `canal` 2 o más en la lectura, entonces el sistema no deberá mandar el retiro: lo dejará pendiente en el equipo, sin frenar los demás guardados, y la guía dirá que quitar la marca no se guarda hasta que el editor actualice el canal; al declararlo, el retiro saldrá solo. `[e2e]` (#217)

## R4: Seguir en otro equipo
Como docente, quiero abrir mi enlace en otro equipo y encontrar lo que ya respondí, para empezar en el PC y seguir en el celular.

- R4.1 Cuando el docente abre su enlace, el sistema deberá pedir al canal sus respuestas ya guardadas y mostrarlas junto con las locales en menos de 5 s con una red de 4G. `[e2e]`
- R4.2 Si una misma respuesta existe en el equipo y en el canal con fechas distintas, entonces el sistema deberá quedarse con la más reciente. `[unit]`
- R4.3 El canal deberá devolver a un código solo las respuestas de ese código. `[integration]`
- R4.4 El sistema deberá retirar los botones "Descargar respaldo" y "Cargar respaldo". `[e2e]`
- R4.5 Si un retiro y un veredicto de la misma clave existen en el equipo y en el canal con fechas distintas, entonces el sistema deberá quedarse con el más reciente: un retiro del canal más nuevo borra el veredicto local, también en otro equipo, y un veredicto del canal igual o más viejo que un retiro local no vuelve. `[unit]` (#217)

## R5: Qué revisar según la casilla del vago
Como docente, quiero ver solo lo que me siento capaz de revisar, para no aprobar algo que no domino.

- R5.1 Mientras el código no tenga marcada la casilla del vago, el sistema deberá excluir de "Qué revisar" los trazos y las rutas trazadas del vago. `[e2e]`
- R5.2 Mientras el código tenga marcada la casilla del vago, el sistema deberá incluir en "Qué revisar" los trazos y las rutas trazadas del vago. `[e2e]`
- R5.3 Cuando el docente cambia la casilla del vago desde el menú de acciones del modo revisión, el sistema deberá registrar el nuevo valor en la hoja del editor y actualizar "Qué revisar". `[e2e]`

## R6: Canal de retorno seguro
Como editor, quiero que el canal solo acepte revisiones válidas de mis docentes, para que nadie llene mi hoja con basura.

- R6.1 Si llega una petición con un código que no está en el padrón de la hoja, entonces el canal deberá rechazarla sin escribir nada y responder "código no activo". `[unit]` (2026-10-16, #162: el script guarda una copia del padrón unos 60 s, así que el rechazo de un código que sale del padrón, o la aceptación de uno nuevo, se aplica con hasta 60 s de retraso.)
- R6.2 Si una petición pesa más de 64 KB o su carga no cumple el formato `v:2` con las validaciones del importador, entonces el canal deberá rechazarla sin escribir nada. `[unit]`
- R6.3 Si un mismo código envía más de 120 peticiones en un minuto, entonces el canal deberá rechazar las siguientes durante ese minuto y responder "demasiadas peticiones". `[unit]`
- R6.4 El canal deberá escribir cada respuesta aceptada en una fila con la fecha y hora de recepción en la primera columna y la carga `v:2` en una celda, para que el importador actual la lea sin cambios de formato. `[unit]`
- R6.5 El código fuente del canal deberá estar en el repositorio, sin códigos de revisor, nombres ni datos del padrón. `[unit]`
- R6.6 El sistema deberá validar en la app toda respuesta que el canal devuelva (R4.1) con las mismas reglas de entrada externa del importador antes de mostrarla. `[unit]`

## R7: Respaldo si el canal falla
Como docente, quiero tener una salida si el canal no responde, para no perder la sesión.

- R7.1 Si el canal no confirma ningún envío durante 10 min seguidos con respuestas pendientes, entonces el sistema deberá ofrecer "Enviar por formulario" con el formulario de revisión de Google como respaldo. `[e2e]`
- R7.2 Si el canal de retorno no está configurado, entonces el sistema deberá usar el formulario de revisión como único canal, como hoy. `[e2e]`
- R7.3 El formulario de respaldo no deberá llevar retiros (un veredicto que llegó por el formulario solo se corrige con otro veredicto), y el importador solo deberá aceptar un retiro en una fila con la forma de la pestaña `Respuestas`. `[unit]` (#217)

## R8: Importación de la hoja
Como editor, quiero importar lo que llegó con el mismo importador, para revisar y aprobar como siempre.

- R8.1 Cuando el editor exporta la hoja de respuestas a CSV, el importador deberá leerla y producir los mismos resúmenes por estructura y el consolidado que produce hoy con el CSV del formulario. `[unit]`
- R8.2 El importador deberá ignorar las filas de autorización y de padrón. `[unit]`
- R8.3 Cuando una fila de `Respuestas` trae un retiro, el importador deberá quitar las respuestas anteriores de esa clave del mismo revisor de las tablas, de los archivos por estructura y de las secciones "Descartadas", dejar ganar a un veredicto posterior, y listar en `resumen.md` las marcas retiradas (alias, estructura, campo e idioma, sin veredicto, propuesta ni comentario; el campo de un trazo admite hasta 120 caracteres). Solo quita lo que llegó en filas con la forma de `Respuestas`: nunca lo del formulario ni los `v:1`. `[unit]` (#217)

## R9: Revisión visible sin datos personales
Como estudiante, quiero saber que una ficha fue revisada por un docente, sin conocer datos personales del revisor.

- R9.1 Cuando una ficha está verificada en el idioma visible, el sistema deberá mostrar "Revisado por un docente universitario" y la fecha de la revisión. `[e2e]`
- R9.2 El sistema no deberá mostrar el nombre, el código ni el alias de ningún revisor en ninguna vista pública. `[e2e]`
- R9.3 Los datos públicos del repositorio (`src/data/`) no deberán contener nombres de revisores. `[unit]`

## R10: Contrato y documentos al día
Como editor, quiero que las reglas del proyecto digan lo que de verdad se hace, para que nadie construya contra una regla vieja.

- R10.1 El sistema deberá dejar en AGENTS.md la excepción de datos personales con el Apps Script del editor como canal de retorno, en SPEC.md F24 y sección 13 el canal nuevo y "revisión docente visible" en vez de "revisor visible", y en el ADR 0012 la decisión frente a la regla "sin backend propio". `[manual]` (razón: texto de contrato que aprueba el editor; no hay oráculo automático)
- R10.2 El sistema deberá dejar en `docs/revision-docente.md` los pasos para montar el Apps Script en la cuenta del editor, con comandos y pantallas para Windows. `[manual]` (razón: el montaje ocurre en la cuenta de Google del editor, fuera del repositorio)
- R10.3 La guía "Cómo revisar" y `docs/guia-docentes.md` no deberán mencionar el formulario de registro ni los pasos de envío. `[unit]`

## Verification summary
| Tag | Count |
|---|---|
| unit | 19 |
| integration | 2 |
| e2e | 21 |
| eval | 0 |
| manual | 2 |
