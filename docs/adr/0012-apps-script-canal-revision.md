# 0012. Apps Script del editor como canal de retorno de la revisión docente

Status: accepted
Date: 2026-10-14
Related: docs/specs/03-review-return-channel/design.md, docs/adr/0008-revision-docente.md, issue #67, docs/research/revision-docente/auditoria-ux.md
Approved by: el editor, con design.md el 2026-10-14
Amended: 2026-10-16, #162 (leer por POST y caché del padrón); 2026-10-16, #168 (responsable, contacto y página Privacidad); 2026-10-16, #169 y #166 (sin GET de lectura, versión exacta en `autorizar`, casilla del vago en `guardar`); 2026-10-18, #217 (quitar una marca se guarda como un retiro por `guardar`; `leer` declara `canal` y devuelve `retiradas`); 2026-10-19, #257 (la pestaña `Padrón` es la única fuente del padrón; menú "Maysa Brain" para crear revisores)

## Context
Cada docente revisa una sola vez. Con el formulario de Google (ADR 0008 y #58), la app no sabe si el docente pulsó Enviar, una revisión larga se parte por el tope de unos 7000 caracteres del enlace y lo no enviado se pierde si se borra el navegador o se cambia de equipo. AGENTS.md prohíbe un backend propio y datos personales en un servidor propio; la única excepción era el formulario de Google del editor.

## Decision
La app guardará cada respuesta, automáticamente, en la hoja de Google del editor mediante un Apps Script publicado en la cuenta del editor (`doPost` para leer las respuestas y la autorización de un código, guardar y autorizar; `doGet` ya no lee nada y responde siempre `formato`, #169). El script valida el código contra un padrón privado de la misma hoja, el tamaño, el ritmo y el formato. La autorización de tratamiento de datos (Ley 1581 de 2012) se da una vez dentro de la app. Las fichas muestran "Revisado por un docente universitario", sin datos personales. El formulario de revisión queda como respaldo; el de registro se retira. El código del script vive en `apps-script/Codigo.js`, sin datos.

La pestaña `Padrón` es la única fuente del padrón (#257). El script suma un menú "Maysa Brain" (`onOpen`) con "Crear revisor" y "Crear revisores…": agrega filas `[código, alias, sí]` bajo el mismo bloqueo que las demás escrituras, borra la caché del padrón y muestra el enlace personal en un aviso. El código nuevo tiene 10 símbolos de un alfabeto sin caracteres confundibles y sale de `Utilities.computeDigest` (SHA-256 de dos UUID), nunca de `Math.random`; no se escribe en ningún registro. El importador lee la pestaña descargada en CSV (`--padron`) y Activo no filtra las filas de `Respuestas`; las del formulario de respaldo de un código que no está en `sí` se descartan. `Codigo.js` sigue sin datos: su único URL es el sitio público. Según la documentación de Google, el menú corre con el código guardado y no con la versión implementada (se confirma a mano en #257); no cambia el host, el padrón ni la excepción de AGENTS.md.

Esto no es un backend propio en el sentido de AGENTS.md: corre en la cuenta de Google del editor, igual que el formulario, guarda en la misma hoja y no tiene servidor, base de datos ni cuentas nuevas. La excepción de AGENTS.md se reescribe para nombrarlo.

Quitar una marca también se guarda (#217). Deshacer un veredicto manda por `guardar` una fila de retiro dentro de la carga `v:2`: un elemento `{c, i?, d:"", f}` con la clave del veredicto y una fecha nueva. El retiro no lleva texto de propuesta ni de comentario (su campo, parte de la clave, admite hasta 120 caracteres si es de un trazo), no cuenta para la casilla del vago y exige la autorización vigente. La hoja sigue siendo de solo agregar: manda la última fila por clave, en `leer` y en el importador. `leer` deja las claves retiradas fuera de `respuestas`, las devuelve aparte en `retiradas` y declara `canal: 2`; la app solo manda retiros con `canal` 2 o más, así que con el script anterior el retiro queda pendiente en el equipo del docente sin frenar lo demás. El formulario de respaldo no lleva retiros, y el importador solo los acepta en filas de la pestaña `Respuestas` y solo quitan lo que llegó por ahí, nunca lo del formulario ni los `v:1`. Un retiro no suprime datos personales: la supresión sigue siendo manual (docs/revision-docente.md, sección 7). No hace falta un ADR nuevo: no cambia el host, el padrón ni la excepción de AGENTS.md.

El texto de la autorización nombra al responsable (Maysa Strategy Partners) y el contacto (info@maysasp.com) y enlaza a la página Privacidad (`/es/privacidad`, `/en/privacy`), que describe el tratamiento completo (#168).

## Alternatives considered
| Opción | Por qué se descartó |
|---|---|
| Seguir con el formulario de Google | Envío manual, confirmación no verificable, tope de largo, pérdida de lo no enviado |
| Firebase, Supabase u otro backend | Servicio y cuentas nuevas, datos fuera de la cuenta del editor, rompe la regla |
| Issues de GitHub o correo | Ya descartados en el ADR 0008 |
| Iniciar sesión con Google | Guarda correos y suma fricción |

## Consequences
- Positive: un solo paso para el docente (autorizar una vez), "guardado" verdadero, sin tope de largo, el avance sigue en cualquier equipo, costo cero.
- Negative: depende de Apps Script (cuotas, cambios de Google); la URL es pública y el código del docente actúa como llave, así que un código filtrado permite escribir a su nombre (mitigado por padrón, ritmo y la aprobación humana de todo cambio); el montaje lo hace el editor a mano; no se puede probar contra Google desde la nube.
- Revisit when: haya más de unos 50 revisores activos, aparezcan envíos falsos, o Google cambie las condiciones de Apps Script.
