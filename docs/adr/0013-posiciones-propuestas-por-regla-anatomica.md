# 0013. Posiciones de marcadores propuestas por regla anatómica sobre piezas del modelo

Status: accepted
Date: 2026-10-14
Related: docs/specs/04-teacher-review-proposals/design.md, docs/research/marcadores/fuentes.md, docs/adr/0006-vago-y-faltantes.md
Approved by: el editor, por delegación explícita el 2026-10-14 ("valida que sea coherente con fuentes confiables y adelante, lo reviso implementado"); cada cambio de datos lo fusiona el editor

## Context
26 estructuras no tienen malla en Z-Anatomy y se muestran como marcadores. Hoy 19 no tienen posición y 7 son el centro de una pieza. Cada docente revisa una sola vez, así que debe llegar a confirmar o corregir, no a ubicar. AGENTS.md prohíbe inventar anatomía: una posición necesita fuente. Los núcleos del tronco miden pocos milímetros, y el cerebro de Z-Anatomy no está en un espacio estereotáctico estándar.

## Decision
Cada marcador recibe una posición calculada por una regla geométrica sobre piezas del modelo completo de Z-Anatomy (commit fijado), medida en Blender sin ventana, y cada regla se apoya en una fuente verificada que describe la estructura respecto de esas piezas (por ejemplo, "el ganglio superior está en el foramen yugular, donde empieza la vena yugular interna"). Las reglas viven en un archivo versionado sin coordenadas escritas a mano; las posiciones salen como `aproximada` con el método y la cita en `fuente_ubicacion`, una por lado cuando la estructura es par, y solo un docente las vuelve `validada`.

## Alternatives considered
| Opción | Por qué se descartó |
|---|---|
| Coordenadas MNI de atlas publicados llevadas al modelo con un registro por referencias (comisuras, caja del encéfalo) | El cerebro de Z-Anatomy no está en espacio MNI; el error de alineación es del orden del tamaño del núcleo, y depende de más supuestos que una regla sobre las piezas vecinas |
| Dejar los marcadores sin ubicar para que el docente los ubique | Gasta la única sesión del docente en buscar, y la evidencia dice que confirmar es más rápido y más fiable que crear |
| Punto en el centro de la pieza que contiene la estructura (lo de hoy) | Queda lejos de la estructura real en piezas grandes (puente, tálamo, giro temporal) |
| Dibujar mallas a mano | Prohibido por AGENTS.md y el ADR 0006 |

## Consequences
- Positive: cada propuesta es reproducible, trazable a una fuente y fácil de corregir; el docente confirma con un toque.
- Negative: la precisión depende de la forma de las piezas vecinas de Z-Anatomy; medir exige bajar el modelo completo y Blender como módulo (unos 400 MB); las reglas hay que mantenerlas si cambia el commit de Z-Anatomy.
- Revisit when: los docentes corrijan más de un tercio de las posiciones, o aparezca una fuente abierta con la estructura medida (por ejemplo, un atlas con licencia compatible).

## Actualización 2026-10-17: marcadores sobre las rutas trazadas del vago (#216)

Pendiente de aprobación del editor en el PR.

La Decisión habla de "piezas del modelo completo de Z-Anatomy". Se acota para el vago torácico: desde el ADR 0010 el atlas ya no publica el tramo del tronco escaneado `Vagus nerve (X).l#t02` y `.r#t02` que cae dentro de la banda `reemplaza` de `public/modelos/rutas-vago.json`, y publica en su lugar las rutas trazadas `vago_toracico_izquierdo` y `vago_toracico_derecho` (estado `en_revision`). Un marcador no puede quedar flotando donde el atlas no muestra vago.

- Una regla puede medir sobre una ruta trazada con la malla `ruta:<id>` (`curva` o `cerca_de.malla`). Los marcadores que se calculan sobre el tronco del vago en ese tramo van sobre la ruta de su lado: el cardíaco torácico, los dos lados, y el cardíaco cervical superior, el izquierdo.
- `pipeline/ubicar-marcadores.py` mide contra lo que el atlas publica: quita de `Vagus nerve (X).l` y `.r` los vértices que caen dentro de la banda de su lado (el mismo predicado que `extraer.py`), así que el asa del recurrente derecho se mide contra el vago publicado. Un `en_curva` sobre el vago escaneado cuyo punto caiga dentro de la banda detiene la corrida y pide la ruta del lado.
- Las dos aproximaciones se encadenan: la posición del marcador es `aproximada` y la ruta está `en_revision`. Si un docente corrige una ruta, hay que volver a correr el ubicador; si una ruta se retira, el ubicador falla, que es lo que debe pasar. El `metodo` de cada marcador lo dice.
- La evidencia de `Vagus nerve (X).l#t02` y `.r#t02` en `src/data/trazos-vago.json` conserva las medidas del trazo sin cortar y agrega qué parte se publica.
- Descartado: dejar esos marcadores `sin_ubicar`. Hoy `aplicarPropuestas` conserva la posición `aproximada` cuando la propuesta no trae punto, así que exigiría un modo "retirar", y dejaría al docente sin un punto que confirmar.
