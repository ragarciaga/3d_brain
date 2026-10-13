# Tasks: Vago torácico trazado (ADR 0010)
Spec: docs/specs/02-thoracic-vagus-tracing/  |  Status: draft  |  Converged: 2026-10-13, 0 rounds

## T1: Agregar las rutas torácicas y los pasos de empalme al generador
- Purpose: que el pipeline trace los tramos torácicos por anclajes, haga salir de ellos los recurrentes y el distal izquierdo, y publique la banda de alturas que cada tramo reemplaza.
- Covers: R1.1, R1.2, R1.3, R1.4, R1.5, R2.4
- Size: M
- Depends on: none
- Files: pipeline/rutas-vago.yaml, pipeline/generar-ramas-vago.py, pipeline/pruebas/probar_generar.py, pipeline/pruebas/vago_sintetico.py, tests/fixtures/vago-sintetico/anclajes.json, tests/fixtures/vago-sintetico/puntos.json, tests/rutas-vago-pipeline.test.ts
- Verify: `.venv-pipeline/bin/python pipeline/pruebas/probar_generar.py` (pasos `desde_ruta` y `hasta_vago`; falla nombrando el anclaje o la ruta que falta y no escribe nada); `npm test -- tests/rutas-vago-pipeline.test.ts` sobre el fixture sintético regenerado (5 rutas; empalmes de 2,5 mm o menos en los dos extremos de cada tramo torácico y al inicio del distal izquierdo; cada recurrente sale a 2,5 mm o menos de su tramo torácico; las bandas coinciden con las alturas de los anclajes del fixture; el YAML no trae coordenadas)
- Issue:
- Status: todo

### Decision log

## T2: Medir las asimetrías sobre el tronco publicado
- Purpose: que la prueba de asimetrías mida lo que el estudiante ve, escaneado fuera de la banda más lo trazado, y falle si queda escaneado en la banda.
- Covers: R3.1, R3.3
- Size: M
- Depends on: T1
- Files: scripts/lib/asimetrias.ts, tests/asimetrias.test.ts
- Verify: `npm test -- tests/asimetrias.test.ts` con el fixture sintético: `troncoPublicado` excluye los puntos escaneados de la banda e incluye los tramos trazados; las cuatro asimetrías pasan; un punto escaneado agregado dentro de la banda hace fallar la prueba nombrando el lado y la altura; los casos sintéticos existentes siguen en verde
- Issue:
- Status: todo

### Decision log

## T3: Revisión docente por ruta trazada
- Purpose: que el docente juzgue cada ruta por separado y que las respuestas viejas por lado no se apliquen a ninguna.
- Covers: R5.1, R5.2, R5.3
- Size: S
- Depends on: T1
- Files: src/lib/rutas.ts, src/components/Ficha.tsx, scripts/lib/revisiones.ts, tests/rutas.test.ts, tests/revisiones.test.ts
- Verify: `npm test -- tests/rutas.test.ts tests/revisiones.test.ts` (`campoTrazado` devuelve `trazado_<id>` por ruta; `leerRutas` acepta `reemplaza` opcional; una respuesta a `trazado_vago_toracico_derecho` se aplica solo a esa ruta; una a `trazado_derecho` sale como desactualizada y no se aplica)
- Issue:
- Status: todo

### Decision log

## T4: Cortar el tronco escaneado en el pipeline y vigilarlo en check:modelo
- Purpose: que el tramo en espejo no llegue al GLB, sin mover lo que queda, y que check:modelo falle si vuelve a aparecer.
- Covers: R2.1, R2.2, R2.3, R2.5, R2.6
- Size: M
- Depends on: T1
- Files: pipeline/extraer.py, pipeline/pruebas/probar_recorte.py, scripts/check-modelo.ts, scripts/lib/modelo.ts, tests/modelo.test.ts
- Verify: `npm test -- tests/modelo.test.ts` (con una banda y una malla sintética del tronco, la comprobación falla nombrando malla y altura si un vértice cae dentro, y pasa si no); `.venv-pipeline/bin/python pipeline/pruebas/probar_recorte.py` en Blender (tras el corte, cada vértice conservado del tronco y de su `#toque` es idéntico al original y ninguno queda en la banda; el derecho conserva arriba y abajo, el izquierdo solo arriba)
- Issue:
- Status: todo

### Decision log

## T5: Regenerar y publicar el vago torácico
- Purpose: publicar las cinco rutas, el GLB con los troncos cortados y las medidas de anclajes, con las cuatro asimetrías en verde sobre el modelo real.
- Covers: R1.6, R2.7, R3.2, R3.4
- Size: M
- Depends on: T2, T4
- Files: pipeline/anclajes-vago.json, pipeline/rutas-vago.yaml, public/modelos/rutas-vago.json, public/modelos/atlas.glb, pipeline/cajas.json, docs/research/vago/auditoria-vago.md
- Verify: `npm test` en verde con `pipeline/anclajes-vago.json` y `public/modelos/rutas-vago.json` reales (5 rutas, cuatro asimetrías); `npm run check:modelo` en verde (cajas, bandas sin vértices, 15 MB o menos); si una asimetría no pasa, solo se ajustan pasos del YAML por nombre de anclaje
- Issue:
- Status: todo

### Decision log

## T6: Mostrar el vago torácico en la app
- Purpose: que el estudiante vea los tramos torácicos como trazados, entienda el hueco del filtro y los siga en el recorrido.
- Covers: R4.1, R4.2, R4.3, R4.4
- Size: M
- Depends on: T3, T5
- Files: src/components/LeyendaOrigen.tsx, src/i18n/es.json, src/i18n/en.json, e2e/vago-toracico.spec.ts
- Verify: `npm run test:e2e -- e2e/vago-toracico.spec.ts` (los tramos torácicos se dibujan punteados; con "Solo geometría escaneada" desaparecen y la leyenda muestra la línea del tramo trazado; en el recorrido aparecen parada por parada; tocar un tramo abre la ficha del vago con el aviso y el estado de esa ruta); `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T7: Documentar la aprobación docente de cada ruta
- Purpose: que el editor sepa cómo pasar cada ruta a aprobada solo con la revisión de un docente.
- Covers: R5.4
- Size: S
- Depends on: T6
- Files: docs/revision-docente.md, docs/guia-docentes.md
- Verify: R5.4 `[manual]` (reason: solo un humano aprueba anatomía, AGENTS.md); la guía explica el campo por ruta y el paso del editor para cambiar `revision.estado` a `aprobada` en el YAML y regenerar
- Issue:
- Status: todo

### Decision log
