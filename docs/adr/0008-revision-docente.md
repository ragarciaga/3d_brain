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
- Negative: depende de Google; las URL prellenadas tienen límite de largo (se envía una revisión por ficha); el código del enlace atribuye pero no autentica, así que el editor valida cada respuesta.
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
- Antes de marcar una ficha como verificada con el nombre de un docente, el editor se lo confirma
  por un canal propio.

Se descartó el formulario con inicio de sesión de Google: obliga a tener cuenta y guarda correos
(más datos personales). Costo de la solución elegida: cero.

## Puesta en marcha 2026-10-12

Los dos formularios ("Registro de revisores del atlas Maysa Brain" y "Revisión del atlas Maysa
Brain") están en el Drive de Maysa Digital, sin recopilar correos; el de revisión está conectado en
`src/config/revision.ts`. Hay 10 códigos (D01 a D10) cuyo padrón y enlaces están en la carpeta
privada "Maysa Brain (privado)" de ese Drive. Guía para los docentes: `docs/guia-docentes.md`.

