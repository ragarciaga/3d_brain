# 0012. Apps Script del editor como canal de retorno de la revisión docente

Status: accepted
Date: 2026-10-14
Related: docs/specs/03-review-return-channel/design.md, docs/adr/0008-revision-docente.md, issue #67, docs/research/revision-docente/auditoria-ux.md
Approved by: el editor, con design.md el 2026-10-14

## Context
Cada docente revisa una sola vez. Con el formulario de Google (ADR 0008 y #58), la app no sabe si el docente pulsó Enviar, una revisión larga se parte por el tope de unos 7000 caracteres del enlace y lo no enviado se pierde si se borra el navegador o se cambia de equipo. AGENTS.md prohíbe un backend propio y datos personales en un servidor propio; la única excepción era el formulario de Google del editor.

## Decision
La app guardará cada respuesta, automáticamente, en la hoja de Google del editor mediante un Apps Script publicado en la cuenta del editor (`doGet` para leer las respuestas y la autorización de un código, `doPost` para guardar y autorizar). El script valida el código contra un padrón privado de la misma hoja, el tamaño, el ritmo y el formato. La autorización de tratamiento de datos (Ley 1581 de 2012) se da una vez dentro de la app. Las fichas muestran "Revisado por un docente universitario", sin datos personales. El formulario de revisión queda como respaldo; el de registro se retira. El código del script vive en `apps-script/Codigo.js`, sin datos.

Esto no es un backend propio en el sentido de AGENTS.md: corre en la cuenta de Google del editor, igual que el formulario, guarda en la misma hoja y no tiene servidor, base de datos ni cuentas nuevas. La excepción de AGENTS.md se reescribe para nombrarlo.

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
