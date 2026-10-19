# 0008. Revisión docente por campo con formulario de Google (F24)

Status: accepted
Date: 2026-10-11
Related: SPEC.md F24 y sección 7
Approved by: kickoff synthesis

## Context
Los docentes deben poder decir, en cada parte específica (pieza, nombre, campo de ficha por idioma, marcador, trazo del vago), si es correcta o qué cambio proponen. La app no tiene servidor. Los docentes no tienen por qué tener cuenta de GitHub.

## Decision
F24 agrega un modo revisión con enlace personal por revisor. Las respuestas se acumulan en IndexedDB y "Enviar revisión" abre un formulario de Google del editor ya lleno; el revisor confirma. Las respuestas llegan a una hoja de cálculo del editor; `scripts/importar-revisiones.ts` las convierte en un resumen por ficha y un `resumen.md` de toda la importación, que es el cuerpo de un solo issue; Claude prepara el cambio y el editor lo aprueba. Cada respuesta lleva estructura, campo, idioma, versión del contenido y revisor. Nombre, rol y consentimiento explícito para mostrar el nombre se piden una sola vez, en un formulario de registro del revisor ligado a su código.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Issues de GitHub prellenados | Cada docente necesitaría cuenta de GitHub; barrera alta |
| Correo prellenado (mailto) | Falla en equipos sin programa de correo configurado y es difícil de procesar |
| Servidor propio o función sin servidor | Rompe la regla de no tener backend |

## Consequences
- Positive: cero cuentas para los docentes, costo cero, trazabilidad por campo y versión.
- Negative: depende de Google; las URL prellenadas tienen límite de largo (desde 2026-10-13 todo va en una carga y solo se parte si pasa de 7000 caracteres; ver la actualización); el código del enlace atribuye pero no autentica, así que el editor valida cada respuesta.
- Revisit when: haya más de unos 20 revisores activos o aparezcan respuestas falsas.

## Actualización 2026-10-12: alias públicos y padrón privado (#15)

El repositorio es público y los issues de importación mostraban el código de cada revisor, que
bastaba para enviar revisiones a su nombre. Ahora:

- Cada docente tiene un código aleatorio (8 caracteres sin letras ni dígitos confundibles) y un
  alias público (D01, D02...). El padrón código -> alias vive fuera del repositorio: en una carpeta
  privada del Drive del editor y, al importar, en `pipeline/revisores.local.json` (ignorado por
  git); `scripts/crear-revisores.ts` lo crea.
- `scripts/importar-revisiones.ts` exige el padrón, cambia cada código por su alias y descarta los
  envíos con códigos que no están en él. Los issues solo muestran alias.
- Actualización 2026-10-19 (#257): el padrón ya no es `pipeline/revisores.local.json` ni lo crea
  `scripts/crear-revisores.ts` (se retiraron). La única fuente es la pestaña `Padrón` de la hoja del
  canal: los códigos nuevos los crea el menú "Maysa Brain" de esa hoja y el importador lee su copia en
  CSV con `--padron`. El resto de esta decisión (alias públicos, códigos aleatorios, issues solo con
  alias) sigue igual.
- Antes de marcar una ficha como verificada con el nombre de un docente, el editor se lo confirma
  por un canal propio.

Se descartó el formulario con inicio de sesión de Google: obliga a tener cuenta y guarda correos
(más datos personales). Costo de la solución elegida: cero.

## Puesta en marcha 2026-10-12

Los dos formularios ("Registro de revisores del atlas Maysa Brain" y "Revisión del atlas Maysa
Brain") están en el Drive de Maysa Digital, sin recopilar correos; el de revisión está conectado en
`src/config/revision.ts`. Hay 10 códigos (D01 a D10) cuyo padrón y enlaces están en la carpeta
privada "Maysa Brain (privado)" de ese Drive. Guía para los docentes: `docs/guia-docentes.md`.

## Actualización 2026-10-13: un solo envío (#58)

Abrir un formulario por ficha era lento para quien revisa varias, y la ficha quedaba "enviada" apenas
se abría el formulario, aunque el docente nunca lo enviara. Ahora:

- "Enviar todo" arma una sola carga `v:2` con todas las respuestas pendientes: `{"v":2,"r":<código>,
  "e":{<id>:[{...}]}}`, agrupada por estructura (en orden de primera aparición) y con claves cortas
  (`CLAVES_V2` en `src/lib/revision.ts`). No lleva `fecha` por respuesta: el importador nunca la usa.
  El campo Estructura del formulario recibe los ids separados por coma.
- Solo se envían respuestas completas: un "Corregir" sin texto, posición ni ramo no viaja.
- La carga se parte solo si la URL pasaría de 7000 caracteres. Cada parte muestra si está sin abrir,
  abierta o confirmada. Una respuesta cuenta como enviada solo cuando el docente pulsa "Sí, lo envié"
  en su parte (se guarda en IndexedDB por clave de respuesta y fecha), y si la edita después vuelve a
  quedar pendiente. Abrir el formulario no la marca.
- `scripts/lib/revisiones.ts` lee `v:1` y `v:2` con las mismas validaciones. En `v:2`, cada clave de
  `e` se trata como un id que se convierte en nombre de archivo, así que pasa por la misma lista de
  ids conocidos y la misma forma de slug que en `v:1`.
- Se mantiene el mismo formulario de Google y no hay host nuevo. Un Apps Script que reciba el envío
  y evite la confirmación manual queda como decisión aparte (#67).

## Actualización 2026-10-14: canal por Apps Script (#67)

El canal de retorno pasa a un Apps Script en la cuenta del editor que guarda cada respuesta sola en
su hoja, con la autorización de tratamiento de datos dentro de la app y sin mostrar datos
personales de los revisores. El formulario de revisión queda como respaldo y el de registro se
retira. Ver el ADR 0012 y `docs/specs/03-review-return-channel/`.
