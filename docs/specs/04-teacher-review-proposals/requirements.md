# Requirements: Propuestas para la sesión docente (marcadores y trazos del vago)

Status: approved  |  Date: 2026-10-14  |  Spec: docs/specs/04-teacher-review-proposals/
Línea base: desconocida
Aprobación: el editor delegó las decisiones y la aprobación de requisitos y diseño ("Revisa todo y valida que sea coherente con fuentes confiables y adelante, lo reviso implementado", 2026-10-14). Todo cambio en `src/data/` sigue siendo de nivel C y lo fusiona el editor.
Brief: docs/brief.md  |  ADRs: docs/adr/0006-vago-y-faltantes.md, docs/adr/0009-vago-fijo-recorrido-y-trazado-selectivo.md, docs/adr/0013-posiciones-propuestas-por-regla-anatomica.md  |  Fuentes: docs/research/marcadores/fuentes.md

## Context
Cada docente revisa una sola vez. Hoy 19 de los 26 marcadores no tienen posición y los otros 7 son un punto en el centro de la pieza que los contiene; de los 28 trazos del vago solo 4 llevan un nombre propuesto, y la evidencia de la auditoría no se le muestra al docente. Este spec hace que el docente confirme o corrija propuestas en vez de ubicar desde cero: cada marcador recibe una posición calculada con una regla anatómica sobre piezas medidas del modelo y una fuente verificada, y cada trazo recibe evidencia escrita y, cuando la regla lo distingue, un nombre propuesto con su nivel de confianza. Nada pasa a "validada" sin un docente.

## Users
- Docente revisor: confirmar con un toque una propuesta razonada, o corregirla, sin ubicar desde cero.
- Editor: aprobar en un PR las posiciones y evidencias propuestas antes de que lleguen a los docentes, sabiendo de dónde sale cada una.
- Estudiante: ver los marcadores en su sitio aproximado, con el aviso de que son aproximados.

## Out of scope
- Mallas para núcleos (accumbens, locus coeruleus, rafe): la única fuente buena prohíbe redistribuir y un punto bien ubicado enseña lo mismo (tracked in docs/v2.md).
- Registro de un atlas estereotáctico (MNI) sobre el cerebro de Z-Anatomy: error de alineación del mismo orden que el tamaño de los núcleos; se prefieren reglas sobre piezas vecinas del propio modelo (tracked in docs/v2.md).
- Wernicke como región resaltada: hace falta una función nueva y la definición está en discusión; queda como punto con la definición clásica y la discusión citada (tracked in docs/v2.md).
- Geometría de plexos: siguen como marcadores (ADR 0009).
- Regenerar `public/modelos/atlas.glb`: no se mueve ni se agrega ninguna malla.
- Nombrar trazos con certeza: solo se proponen; deciden los docentes.

## Existing behavior to preserve
- La posición de cada pieza nunca cambia: verificado por `npm run check:modelo` `[integration]`
- Un marcador con ancla y sin posición se dibuja en el centro de su pieza y sigue la fragmentación: verificado por la prueba nueva de R3 sobre el comportamiento actual `[e2e]`
- "Proponer posición" guarda la propuesta del docente en el navegador y nunca toca `src/data/`: verificado por `tests/revision.test.ts` `[unit]`
- `aproximada` exige `fuente_ubicacion` en es y en, y un marcador ubicado exige posición o ancla: verificado por `tests/datos.test.ts` `[unit]`
- Un trazo solo lleva `propuesta` si es una opción de la lista de ramos o `no_es_ramo`: verificado por `tests/trazos.test.ts` `[unit]`

## R1: Posición propuesta para cada marcador
Como docente, quiero ver cada marcador en un sitio razonado, para confirmarlo o moverlo en vez de buscarlo desde cero.

- R1.1 Cuando se corre el script de ubicación sobre el modelo completo de Z-Anatomy (commit fijado), el sistema deberá escribir para cada uno de los 26 marcadores una posición en coordenadas glTF calculada con la regla de ese marcador, o dejarlo `sin_ubicar` con el motivo. `[integration]`
- R1.2 El sistema deberá definir cada regla en un archivo de reglas versionado que nombra solo piezas del modelo y operaciones geométricas, sin coordenadas escritas a mano. `[unit]`
- R1.3 Si una regla nombra una pieza que no existe en el modelo, entonces el sistema deberá detenerse nombrando el marcador y la pieza, y no deberá escribir ninguna posición. `[unit]`
- R1.4 El sistema deberá dejar cada posición propuesta a 5 mm o menos de la superficie de al menos una de las piezas que su regla nombra. `[integration]`
- R1.5 Cuando la estructura existe en los dos lados, el sistema deberá proponer una posición por lado. `[unit]`
- R1.6 El sistema deberá marcar toda posición propuesta como `aproximada` y nunca como `validada`. `[unit]`
- R1.7 Correr el script dos veces sobre el mismo modelo deberá producir el mismo archivo, byte a byte. `[integration]`

## R2: Fuente verificada para cada propuesta
Como editor, quiero que cada propuesta diga de dónde sale, para no publicar anatomía inventada.

- R2.1 El sistema deberá registrar para cada regla la fuente que la respalda (autores, título, año e identificador PMID, DOI o URL) y la frase de la fuente parafraseada, en `docs/research/marcadores/fuentes.md`. `[unit]`
- R2.2 Si una regla no tiene fuente verificada registrada, entonces el script deberá dejar el marcador `sin_ubicar` y no deberá escribir posición. `[unit]`
- R2.3 El sistema deberá escribir en `fuente_ubicacion` (es y en) el método (la regla en palabras) y la cita de la fuente. `[unit]`
- R2.4 Donde las fuentes confiables no coinciden en la definición de una estructura, el sistema deberá decirlo en `fuente_ubicacion` y citar las dos posturas. `[unit]`

## R3: Los marcadores siguen a su pieza
Como estudiante, quiero que al separar las piezas cada marcador se mueva con la pieza que lo contiene, para no ver puntos flotando solos.

- R3.1 Mientras las piezas están separadas, el sistema deberá desplazar un marcador con `ancla` y posición propia lo mismo que se desplaza su pieza ancla. `[e2e]`
- R3.2 Cuando las piezas se vuelven a armar, el sistema deberá dejar cada marcador exactamente en su posición propuesta. `[e2e]`
- R3.3 Donde un marcador tiene una posición por lado, el sistema deberá dibujar un punto por lado. `[e2e]`

## R4: Evidencia y propuesta para cada trazo del vago
Como docente, quiero ver por qué se propone un nombre para cada trazo, para decidir en segundos.

- R4.1 El sistema deberá dar a cada uno de los 28 trazos una evidencia escrita (es y en) con su altura, su largo y las piezas más cercanas a sus extremos, tomadas de la medición del modelo. `[unit]`
- R4.2 Cuando la regla del trazo distingue un ramo de la lista (por ejemplo, ramos abdominales que terminan junto al hígado o a la cara anterior o posterior del estómago), el sistema deberá proponer ese ramo con confianza `alta`, `media` o `baja` y la razón. `[unit]`
- R4.3 Cuando un trazo es una raicilla a la altura del bulbo, el sistema deberá proponer `no_es_ramo` con la evidencia "raicilla". `[unit]`
- R4.4 Si la regla no distingue entre ramos, entonces el sistema deberá dejar `propuesta` vacía y decirlo en la evidencia. `[unit]`
- R4.5 El sistema deberá citar en cada trazo la fuente de su regla. `[unit]`

## R5: El docente ve la evidencia y confirma con un toque
Como docente, quiero ver la propuesta, la evidencia y la fuente junto al control, para confirmar o corregir sin buscar en otro lado.

- R5.1 Cuando el docente abre un trazo en modo revisión, el sistema deberá mostrar la propuesta, la confianza, la evidencia y la fuente en el idioma activo. `[e2e]`
- R5.2 Cuando el docente abre la ficha de un marcador en modo revisión, el sistema deberá mostrar el método y la fuente de la posición junto al botón "Proponer posición". `[e2e]`
- R5.3 Cuando el docente pulsa "Correcto" en un marcador o un trazo con propuesta, el sistema deberá guardar la confirmación de esa propuesta con un solo toque. `[e2e]`

## R6: El editor aprueba antes que los docentes
Como editor, quiero revisar las propuestas en un PR antes de que lleguen a los docentes, para que nada anatómico se publique sin mí.

- R6.1 El sistema deberá entregar las posiciones y evidencias generadas como un cambio en `src/data/` en un PR de nivel C, con un resumen por marcador y por trazo (antes y después, regla y fuente). `[manual]` (razón: aprobación humana de contenido anatómico, AGENTS.md)
- R6.2 El sistema no deberá cambiar ningún nombre, texto de ficha ni estado `validada` existente al escribir las propuestas. `[unit]`

## Verification summary
| Tag | Count |
|---|---|
| unit | 14 |
| integration | 3 |
| e2e | 6 |
| eval | 0 |
| manual | 1 |
