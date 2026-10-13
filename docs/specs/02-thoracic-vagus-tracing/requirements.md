# Requirements: Vago torácico trazado (ADR 0010)

Status: approved  |  Date: 2026-10-13  |  Spec: docs/specs/02-thoracic-vagus-tracing/
Brief: docs/brief.md  |  ADRs: docs/adr/0009-vago-fijo-recorrido-y-trazado-selectivo.md, docs/adr/0010-vago-toracico-trazado.md  |  Auditoría: docs/research/vago/auditoria-vago.md

## Context
La auditoría del 13 de octubre de 2026 midió que el vago del tórax de Z-Anatomy es un espejo izquierda-derecha. El izquierdo atraviesa el arco aórtico y el derecho pasa por delante del bronquio principal derecho, así que el atlas enseña hoy dos relaciones falsas justo donde un docente mira. El ADR 0010 decide trazar ese tramo en los dos lados por anclajes del modelo y dejar de publicar el escaneado que reemplaza. Este spec lo implementa con las condiciones de F25 (ruta por anclaje, prueba de asimetrías, acabado `aproximada`, revisión docente).

## Users
- Estudiante: ver el vago del tórax con las relaciones correctas, sabiendo que es un trazado aproximado.
- Docente revisor: juzgar cada ruta trazada por separado en la app (F24).
- Editor: regenerar el modelo con el pipeline y aprobar las rutas que los docentes validen.

## Out of scope
- Plexos pulmonar, esofágico y cardíaco, y ramos cardíacos como tubos: un plexo es una red; siguen como marcadores (ADR 0009 punto 5).
- El tramo del cuello: también viene en espejo, pero el vago del cuello es casi simétrico y no contradice ninguna asimetría probada; se revisa si un docente lo pide.
- Nombrar los trazos escaneados (raicillas, ramo faríngeo, ramos abdominales): lo hacen los docentes con F24 sobre la auditoría.
- Reportar el espejo a Z-Anatomy: el editor decidió no hacerlo.

## Existing behavior to preserve
- La posición de cada pieza nunca cambia; lo que queda del tronco recortado no se mueve: verificado por `npm run check:modelo` `[integration]`
- Las llaves de malla `Vagus nerve (X).l/.r#tNN` y `#toque` y `pipeline/mapeo.csv` no cambian de forma: verificado por `tests/datos.test.ts` y `npm run check:modelo` `[integration]`
- El vago no se fragmenta; el recorrido F14 revela el vago parada por parada: verificado por `tests/recorrido.test.ts` y `e2e/atlas.spec.ts` ("el vago no se separa...") `[e2e]`
- Las asimetrías se comprueban sobre el modelo sintético y fallan con mensaje si falta un anclaje: verificado por `tests/asimetrias.test.ts` (bloque sintético) `[unit]`
- El generador falla nombrando el anclaje que falta y valida el estado de revisión: verificado por `pipeline/pruebas/probar_generar.py` `[unit]`
- Las rutas trazadas se publican con su estado y se ven con acabado aproximado, aviso y leyenda: verificado por `tests/rutas.test.ts` y `e2e/atlas.spec.ts` (rutas trazadas) `[e2e]`

## R1: Tramo torácico trazado por anclajes
Como estudiante, quiero ver el vago del tórax pasar por donde dicen las fuentes, para no aprender una relación falsa.

- R1.1 El sistema deberá describir los tramos torácicos derecho e izquierdo en `pipeline/rutas-vago.yaml` como pasos que nombran anclajes del modelo, sin ninguna coordenada escrita a mano, con fuentes y estado de revisión `en_revision`. `[unit]`
- R1.2 Cuando se generan las rutas, el sistema deberá empezar el tramo torácico derecho en el tronco escaneado a la altura de lo más alto de la subclavia derecha y terminarlo en el tronco escaneado a la altura de lo más bajo del bronquio principal derecho, con un salto de 2,5 mm o menos en cada empalme. `[unit]`
- R1.3 Cuando se generan las rutas, el sistema deberá empezar el tramo torácico izquierdo en el tronco escaneado a la altura de lo más alto de la subclavia izquierda y terminarlo donde empieza el vago izquierdo distal, con un salto de 2,5 mm o menos en cada empalme. `[unit]`
- R1.4 Cuando se generan las rutas, el sistema deberá hacer salir cada laríngeo recurrente de un punto del tramo torácico de su lado, a 2,5 mm o menos de él. `[unit]`
- R1.5 Si un paso nombra un anclaje que no existe en el modelo, entonces el sistema deberá detenerse nombrando el anclaje y no deberá escribir ninguna ruta. `[unit]`
- R1.6 Cuando se generan las rutas con el modelo real, el sistema deberá publicar en `public/modelos/rutas-vago.json` las cinco rutas: los dos recurrentes, los dos tramos torácicos y el vago izquierdo distal. `[integration]`

## R2: Lo escaneado reemplazado no se publica
Como estudiante, quiero que el tramo falso desaparezca del modelo, para no ver dos vagos en el mismo sitio.

- R2.1 Cuando se regenera el modelo, el sistema deberá conservar del tronco derecho escaneado solo lo que está por encima de lo más alto de la subclavia derecha y por debajo de lo más bajo del bronquio principal derecho. `[integration]`
- R2.2 Cuando se regenera el modelo, el sistema deberá conservar del tronco izquierdo escaneado solo lo que está por encima de lo más alto de la subclavia izquierda. `[integration]`
- R2.3 El sistema deberá recortar las mallas de toque (`#toque`) de cada tronco en las mismas alturas que la malla visible. `[integration]`
- R2.4 El sistema deberá calcular las alturas de corte de las mismas medidas de anclajes que usan las rutas (`pipeline/anclajes-vago.json`), sin números escritos a mano. `[unit]`
- R2.5 El sistema deberá recortar sin mover lo que queda: cada vértice conservado del tronco deberá quedar a 0,1 mm o menos de su posición en el modelo fuente. `[integration]`
- R2.6 Si una malla publicada del tronco del vago tiene algún vértice dentro del tramo reemplazado de su lado, entonces `npm run check:modelo` deberá fallar nombrando la malla y la altura. `[integration]`
- R2.7 El sistema deberá mantener `public/modelos/atlas.glb` en 15 MB o menos. `[integration]`

## R3: Asimetrías sobre lo publicado
Como editor, quiero que la prueba mida lo que el estudiante ve, para que un tramo falso no pueda volver a publicarse.

- R3.1 El sistema deberá comprobar las cuatro asimetrías sobre el tronco publicado de cada lado: lo escaneado que queda más los tramos trazados. `[unit]`
- R3.2 Con el modelo real, las cuatro asimetrías deberán pasar. `[integration]`
- R3.3 Si algún punto del tronco publicado de un lado queda dentro del tramo reemplazado de ese lado, entonces la prueba deberá fallar nombrando el lado y la altura. `[unit]`
- R3.4 El sistema deberá guardar `pipeline/anclajes-vago.json` en el repositorio, generado por `pipeline/auditar-vago.py` desde el commit fijado de Z-Anatomy, para que la prueba corra en cada CI. `[integration]`

## R4: En la app
Como estudiante, quiero distinguir lo trazado de lo medido y seguir el vago completo en el recorrido.

- R4.1 El sistema deberá dibujar los tramos torácicos con el acabado de geometría aproximada (mate y punteado), igual que las demás rutas trazadas. `[e2e]`
- R4.2 Mientras el filtro "Solo geometría escaneada" esté activo, el sistema deberá esconder los tramos torácicos y mostrar el hueco del tórax, y la leyenda deberá decir en una línea que ese tramo del vago es trazado. `[e2e]`
- R4.3 Mientras el recorrido del vago esté activo, el sistema deberá revelar los tramos torácicos parada por parada, igual que el tronco escaneado. `[e2e]`
- R4.4 Cuando la persona toca un tramo torácico, el sistema deberá abrir la ficha de su entrada con el aviso de trazado aproximado y el estado de revisión de esa ruta. `[e2e]`

## R5: Revisión docente por ruta
Como docente revisor, quiero juzgar cada ruta trazada por separado, para aprobar una y corregir otra.

- R5.1 En modo revisión, el sistema deberá ofrecer un campo de revisión propio para cada ruta trazada (`trazado_<id de la ruta>`). `[unit]`
- R5.2 Cuando el editor importa las revisiones, el sistema deberá aplicar la respuesta de `trazado_<id>` solo a esa ruta. `[unit]`
- R5.3 Si una respuesta importada usa un campo por lado (`trazado_derecho` o `trazado_izquierdo`), entonces el sistema deberá marcarla como desactualizada y no aplicarla a ninguna ruta. `[unit]`
- R5.4 Cada ruta trazada deberá pasar a `aprobada` solo con la aprobación de un docente aplicada por el editor. `[manual]` (reason: solo un humano aprueba anatomía, AGENTS.md)

## Verification summary
| Tag | Count |
|---|---|
| unit | 11 |
| integration | 9 |
| e2e | 4 |
| eval | 0 |
| manual | 1 |
