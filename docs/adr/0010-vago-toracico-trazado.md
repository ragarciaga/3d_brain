# 0010. El vago del tórax se traza: el tramo escaneado es un espejo

Status: accepted
Date: 2026-10-13
Related: 0009 (la amplía), SPEC.md F25 y sección 8, docs/research/vago/auditoria-vago.md
Approved by: el editor (13 de octubre de 2026), sujeto a la revisión del PR

## Context
La auditoría de la fase A del ADR 0009 (13 de octubre de 2026, `docs/research/vago/auditoria-vago.md`) midió en Z-Anatomy los dos troncos del vago contra sus anclajes. Encontró dos cosas que el ADR 0009 no sabía:

- **El vago del tórax es un espejo.** Entre y = 1572 mm (bulbo) y y = 1347 mm (donde termina el izquierdo), el tronco izquierdo y el derecho son el reflejo uno del otro en x: desvío medio 0,05 mm, máximo 3,3 mm, en 226 alturas. El modelo fuente dibujó un vago y lo reflejó. Por eso:
  - el vago izquierdo pasa a 0,7 mm del eje del arco aórtico (radio 12,5 mm), es decir, por dentro de la aorta (asimetría 3);
  - el vago derecho pasa 4 a 7 mm por delante del bronquio principal derecho y lo atraviesa para quedar detrás (asimetría 4).
- **El ligamento arterioso no existe en el modelo.** El ADR 0009 lo daba por presente. Solo está su ganglio (`Node of ligamentum arteriosum`), que queda en el sitio del ligamento: 7,8 mm bajo el arco y 8,5 mm sobre la bifurcación del tronco pulmonar. Se usa como sustituto topográfico, pendiente de revisión docente.

La prueba de asimetrías (`tests/asimetrias.test.ts`) falla con el modelo real, como debe. Ningún cambio en `pipeline/rutas-vago.yaml` la arregla, porque el YAML solo gobierna lo trazado y lo que falla es lo escaneado.

## Decision
1. **El tramo torácico de los dos troncos se traza** (`aproximada`), con las mismas condiciones del ADR 0009 punto 6: ruta por nombre de anclaje en `pipeline/rutas-vago.yaml`, revisión docente antes de generar, prueba de asimetrías y acabado visible de F25.
   - **Vago derecho:** desde la altura de la arteria subclavia derecha (donde sale el recurrente derecho) hasta debajo del bronquio principal derecho. Pasa por detrás del bronquio y llega al esófago, donde se une al tronco escaneado, que desde ahí ya va por detrás del esófago y sigue hasta el estómago.
   - **Vago izquierdo:** desde la altura de la arteria subclavia izquierda, entre ella y la carótida común izquierda. Cruza la cara anterolateral izquierda del arco aórtico (donde sale el recurrente izquierdo) y pasa por detrás del bronquio principal izquierdo. Ahí empalma con la ruta `vago_izquierdo_distal`, que ya baja hasta el estómago.
   - Los dos puntos de empalme y los de corte se nombran por anclaje (altura de un punto de un anclaje), nunca con coordenadas.
2. **El tramo escaneado que se reemplaza no se publica.** El pipeline lo recorta del tronco escaneado entre las mismas alturas de anclaje, sin mover nada de lo que queda (regla 1 de AGENTS.md). Lo escaneado por encima (cuello) y por debajo (esófago y ramos abdominales del derecho) se conserva tal cual. Así no conviven el espejo y el trazado.
3. **La prueba de asimetrías no se relaja.** Las asimetrías 3 y 4 pasan a comprobarse sobre el tronco publicado de cada lado: escaneado conservado más tramo trazado. Además, una prueba nueva falla si en lo publicado queda algún punto del tramo escaneado reemplazado.
4. **Los recurrentes salen del tramo trazado** de su lado, no del espejo.
5. Sigue vigente lo demás del ADR 0009: el vago no se fragmenta, se recorre; los plexos no se dibujan como tubos.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Dejar lo escaneado y aceptar que falle la prueba (o relajarla) | El atlas mostraría un vago que atraviesa la aorta y el bronquio, justo lo que un docente revisa; debilitar la prueba va contra la regla de no inventar ni enseñar algo falso |
| Marcar el tramo escaneado como `aproximada` sin cambiar su geometría | El acabado avisa que es aproximado, pero la relación con la aorta y el bronquio sigue siendo falsa, no aproximada |
| Quitar el vago del tórax y dejar solo marcadores | Rompe el recorrido guiado (F14) justo en el tramo más didáctico |
| Esperar una fuente con el vago torácico medido (BodyParts3D, SPARC) | Sin fecha ni licencia verificada; se revisa si aparece (ver Revisit when) |

## Consequences
- Positive: el vago del tórax respeta las cuatro asimetrías; lo que se ve falso hoy deja de verse; cada tramo nuevo es texto que un docente corrige.
- Negative: crece la geometría trazada (de tres piezas a cinco: los dos recurrentes, el vago izquierdo distal y los dos tramos torácicos). El pipeline tiene que recortar el tronco escaneado, lo que regenera el GLB (tier C). Con el modelo actual, `npm test` falla si `pipeline/anclajes-vago.json` está en el repo; por eso ese archivo entra junto con la implementación de esta decisión, no antes (se regenera con `pipeline/auditar-vago.py`). Con el Plan B (nota al final) el archivo entra sin rutas publicadas y `npm test` pasa.
- Revisit when: un docente rechace una ruta torácica, aparezca una fuente abierta con el vago torácico medido, o el recorte del tronco escaneado no se pueda hacer sin mover lo que queda.

## Update 2026-10-18 (Plan B): el tramo torácico queda como hueco en el lanzamiento docente
Status de esta decisión: parcialmente en vigor. El editor decidió el 18 de octubre de 2026 que para el lanzamiento docente no se publica ninguna ruta trazada (los dos recurrentes, el vago izquierdo distal y los dos tramos torácicos), porque la ruta torácica del borrador todavía atraviesa órganos y ninguna ruta tiene revisión docente.
- Sigue vigente el punto 2: el tramo escaneado que es un espejo no se publica. El GLB y `pipeline/cajas.json` traen el tronco cortado (los de la rama del recorte).
- El punto 1 (trazar el tramo) queda pendiente: `public/modelos/rutas-vago.json` trae `rutas: {}` y las bandas como `huecos`. La app lo dice en la leyenda, en la ficha del vago y en el recorrido; `check:modelo` vigila una banda por lado.
- El punto 3 se cumple sin rutas: la prueba de asimetrías comprueba que ninguna relación falsa queda a la vista (la cima del arco y el centro del bronquio derecho caen dentro del hueco y nada escaneado conservado llega a esas alturas).
- El punto 4 (recurrentes que salen del tramo trazado) queda pendiente con el trazado.
- El marcador `m-thoracic-cardiac-branches-of-vagus-nerve` pasa a `sin_ubicar`, porque su regla lo puso sobre el tronco espejo.
- Retomar el trazado: cuando se retome, la evidencia de los troncos (`fraseBanda`) tendría que volver a decir "trazado" si la banda viene de `reemplaza`; hoy siempre dice hueco.
- Alcance: SPEC.md (cambios del 18 de octubre de 2026), `docs/v2.md` (las cinco rutas, después del lanzamiento) y `docs/specs/02-thoracic-vagus-tracing/`.
