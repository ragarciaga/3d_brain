# Tasks: Vago torácico trazado (ADR 0010)
Spec: docs/specs/02-thoracic-vagus-tracing/  |  Status: approved  |  Converged: 2026-10-13, 2 rounds

## T1: Agregar las rutas torácicas y los pasos de empalme al generador
- Purpose: que el pipeline trace los tramos torácicos por anclajes, haga salir de ellos los recurrentes y el distal izquierdo, y publique la banda de alturas que cada tramo reemplaza, sin dejar el CI en rojo.
- Covers: R1.1, R1.2, R1.3, R1.4, R1.5, R2.4
- Size: M
- Depends on: none
- Files: pipeline/rutas-vago.yaml, pipeline/generar-ramas-vago.py, pipeline/pruebas/probar_generar.py, pipeline/pruebas/vago_sintetico.py, tests/fixtures/vago-sintetico/anclajes.json, tests/fixtures/vago-sintetico/puntos.json, tests/rutas-vago-pipeline.test.ts, tests/rutas.test.ts, e2e/atlas.spec.ts
- Verify: `.venv-pipeline/bin/python pipeline/pruebas/probar_generar.py` (pasos `desde_ruta` y `hasta_vago`; falla nombrando el anclaje o la ruta que falta y no escribe nada; acepta `entrada: vagus-nerve-x`); `npm test -- tests/rutas-vago-pipeline.test.ts` sobre el fixture sintético regenerado (5 rutas; empalmes de 2,5 mm o menos en los dos extremos de cada tramo torácico y al inicio del distal izquierdo; cada recurrente sale a 2,5 mm o menos de su tramo torácico; las bandas coinciden con las alturas de los anclajes del fixture; el YAML no trae listas de tres números); `npm test` completo en verde (incluye `tests/asimetrias.test.ts` y los conteos de rutas de `tests/rutas.test.ts` llevados a 5); `npm run test:e2e -- e2e/atlas.spec.ts -g "rutas trazadas"` con el conteo llevado a 5
- Issue: #46
- Status: done

### Decision log
- Ronda 1: keep. El orquestador suma los conteos de `tests/rutas.test.ts` y `e2e/atlas.spec.ts` para que el PR no deje el CI en rojo (nota de los revisores de T3 y T6). El comentario de cabecera del YAML pasa a hablar de revisión por ruta.
- Ronda 2: keep.
- 2026-10-14: pasos torácicos por defecto del ADVISORY; `reemplaza.hasta: null` explícito; rutas torácicas al principio del YAML. Tier C. Outcome: reviews pass after 0 kickbacks, PR #112.

## T2: Medir las asimetrías sobre el tronco publicado
- Purpose: que la prueba de asimetrías mida lo que el estudiante ve, escaneado fuera de la banda más lo trazado, y falle nombrando lado y altura si queda escaneado dentro de la banda.
- Covers: R3.1, R3.3
- Size: M
- Depends on: T1
- Files: scripts/lib/asimetrias.ts, tests/asimetrias.test.ts
- Verify: `npm test -- tests/asimetrias.test.ts` con el fixture sintético de T1: (a) `troncoPublicado` del derecho conserva el escaneado por encima de `y_max` y por debajo de `y_min`, no deja ningún punto escaneado entre ambos e incluye la ruta torácica; el del izquierdo (`y_min` nulo) conserva solo lo de arriba, más la ruta torácica y el distal, ordenado de arriba abajo; un segmento escaneado que cruza la banda queda recortado con puntos de borde en `y_max` y `y_min`; (b) `asimetria3` usa el tronco publicado izquierdo y `asimetria4(d, r)` el derecho; las cuatro pasan; `comprobar(d, null)` sigue devolviendo solo `asimetria4`; (c) `comprobarBanda(puntos, banda, lado)` con un punto escaneado inyectado dentro de la banda lanza un error que nombra el lado y la altura, y sin ese punto pasa; (d) `comprobar` lanza nombrando la ruta si una ruta torácica no trae `reemplaza`; (e) `bandas(r)` se exporta para que la use `check:modelo`; (f) los casos sintéticos existentes siguen en verde
- Issue: #47
- Status: in-review

### Decision log
- Ronda 1: rewrite. La comprobación de R3.3 se separa del recorte para que pueda fallar; `asimetria4` recibe las rutas; `bandas()` queda exportada para T4.
- Ronda 2: keep.

## T3: Revisión docente por ruta trazada
- Purpose: que el docente juzgue cada ruta por separado y que las respuestas viejas por lado salgan marcadas como desactualizadas y no se apliquen a ninguna ruta.
- Covers: R5.1, R5.2, R5.3
- Size: S
- Depends on: T1
- Files: src/lib/rutas.ts, src/components/Ficha.tsx, scripts/lib/revisiones.ts, tests/rutas.test.ts, tests/revisiones.test.ts, e2e/atlas.spec.ts
- Verify: `npm test -- tests/rutas.test.ts tests/revisiones.test.ts` con el fixture de T1: `campoTrazado` devuelve `trazado_<id>` y los cinco campos son distintos; `leerRutas` conserva `reemplaza` válido (`lado`, `y_max` número, `y_min` número o nulo) y descarta, sin romper las demás, una ruta con `reemplaza` mal formado; `resumenMarkdown` de una respuesta `trazado_vago_toracico_derecho` con la versión vigente sale sin "(desactualizada)" y con ese campo en su fila; una `trazado_derecho` o `trazado_izquierdo` con la versión vigente sale "(desactualizada)" con la nota de que no se aplica a ninguna ruta. `npm run test:e2e -- e2e/atlas.spec.ts -g "rutas trazadas"`: `data-testid` y `data-campo` `trazado_<id>`, un bloque por ruta en la ficha
- Issue: #48
- Status: todo

### Decision log
- Ronda 1: rewrite. Se nombran las salidas observables del importador, la validación real de `reemplaza` y el E2E existente que cambia de campo.
- Ronda 2: keep.

## T4: Cortar el tronco escaneado en el pipeline y vigilarlo en check:modelo
- Purpose: que el tramo en espejo no llegue al GLB, sin mover lo que queda, y que check:modelo falle si vuelve a aparecer.
- Covers: R2.1, R2.2, R2.3, R2.5, R2.6
- Size: M
- Depends on: T1, T2
- Files: pipeline/extraer.py, pipeline/pruebas/probar_recorte.py, scripts/check-modelo.ts, scripts/lib/modelo.ts, scripts/lib/glb.ts, tests/modelo.test.ts
- Verify: `npm test -- tests/modelo.test.ts` (con una banda y una malla sintética del tronco, usando `bandas()` de T2: falla nombrando malla y altura si un vértice cae dentro de la banda, también en el `#toque`; pasa si no hay ninguno; un vértice sobre `y_max` o `y_min` con 0,1 mm de tolerancia cuenta como fuera; la banda del izquierdo con `y_min` nulo vigila desde `y_max` hacia abajo; los casos de cajas existentes siguen en verde); `npm run check:modelo` sigue en verde con el `public/modelos/rutas-vago.json` y el GLB actuales; `.venv-pipeline/bin/python pipeline/pruebas/probar_recorte.py` en Blender, con la función de corte recibiendo la banda por parámetro: cada vértice original conservado del tronco y de su `#toque` queda a 0,1 mm o menos de su posición fuente, los vértices nuevos del corte quedan en `y_max` o `y_min` sobre la superficie original, ninguno queda dentro de la banda, el derecho conserva arriba y abajo y el izquierdo solo arriba; con banda o `rutas-vago.json` faltante `extraer.py` se detiene antes de exportar y no escribe `cajas.json`. No se regeneran `public/modelos/**` ni `pipeline/cajas.json` en esta tarea (eso es T5)
- Issue: #49
- Status: todo

### Decision log
- Ronda 1: rewrite. Se separan vértices originales y nuevos del corte, se agregan los casos de error, la tolerancia en el borde y el lector de vértices del GLB; usa `bandas()` de T2 para no duplicar.
- Ronda 2: keep.

## T5: Regenerar y publicar el vago torácico
- Purpose: publicar las cinco rutas, el GLB con los troncos cortados y las medidas de anclajes, con las cuatro asimetrías en verde sobre el modelo real.
- Covers: R1.6, R2.7, R3.2, R3.4
- Size: M
- Depends on: T4
- Files: pipeline/anclajes-vago.json, pipeline/rutas-vago.yaml, public/modelos/rutas-vago.json, public/modelos/atlas.glb, pipeline/cajas.json, docs/research/vago/auditoria-vago.md, tests/rutas-vago-pipeline.test.ts, tests/asimetrias.test.ts
- Verify: regeneración en orden con `.venv-pipeline` (bpy): `auditar-vago.py`, `generar-ramas-vago.py`, `extraer.py`, `node scripts/comprimir-modelo.ts`. Luego `npm test` en verde, con el bloque del modelo real que deja de saltarse y falla si no se cumple cada punto: `public/modelos/rutas-vago.json` trae exactamente las 5 rutas en estado `en_revision`; empalmes de 2,5 mm o menos y recurrentes a 2,5 mm o menos de su tramo torácico, medidos sobre los archivos reales; `reemplaza` coincide con las alturas de `anclajes-vago.json`; las cuatro asimetrías pasan. Luego `npm run check:modelo` en verde (cajas a 0,1 mm, ningún vértice en banda, `atlas.glb` de 15 MB o menos). Si una asimetría no pasa, solo se ajustan pasos del YAML por nombre de anclaje, nunca la prueba
- Issue: #50
- Status: todo

### Decision log
- Ronda 1: rewrite. Las pruebas del modelo real exigen las 5 rutas y miden empalmes sobre los archivos reales, para que el Verify pueda fallar; se nombra el orden de regeneración.
- Ronda 2: keep.

## T6: Mostrar el vago torácico en la app
- Purpose: que el estudiante vea los tramos torácicos como trazados, entienda el hueco del filtro y los siga en el recorrido, y que el E2E pueda comprobar qué rutas se dibujan y con qué acabado.
- Covers: R4.1, R4.2, R4.3, R4.4
- Size: M
- Depends on: T3, T5
- Files: src/components/LeyendaOrigen.tsx, src/components/RutasTrazadas.tsx, src/main.tsx, src/i18n/es.json, src/i18n/en.json, e2e/vago-toracico.spec.ts
- Verify: `npm run test:e2e -- e2e/vago-toracico.spec.ts` contra el `rutas-vago.json` y el GLB reales, con un gancho solo de desarrollo `window.__rutasDibujadas()` (en `main.tsx`, alimentado por `RutasTrazadas.tsx`) que lista por ruta dibujada `{id, punteado, cortadaPorRecorrido, enPantalla}`: (1) las dos rutas torácicas aparecen con `punteado` y `cortadaPorRecorrido` verdaderos (R4.1); (2) con "Solo geometría escaneada" no aparece ninguna ruta torácica y `data-testid="leyenda-toracico"` se ve con su texto; al apagar el filtro vuelven (R4.2); (3) en el recorrido, en cada parada, los puntos de cada ruta torácica con `y` mayor o igual a `__recorte()` son 0 en la primera parada, todos en la última y nunca bajan entre paradas (R4.3); (4) un clic en `enPantalla` de cada ruta torácica abre la ficha de `vagus-nerve-x` con `aviso-aproximada` y el bloque `ruta-trazado_<id>` en "Pendiente de revisión docente" (R4.4); `npm run check:i18n`; el texto `recorrido.notaIzquierdo` (es y en) deja de decir que el izquierdo termina en el tórax
- Issue: #51
- Status: todo

### Decision log
- Ronda 1: rewrite. Gancho DEV para observar las rutas dibujadas y su posición en pantalla; casos binarios del recorrido y del clic; se corrige el texto del recorrido que queda falso.
- Ronda 2: keep.

## T7: Documentar la aprobación docente de cada ruta
- Purpose: que el editor sepa cómo pasar cada ruta trazada a aprobada solo con la revisión de un docente: qué campo mira, cómo aplica la aprobación en el YAML y cómo regenera el JSON de rutas desde su portátil.
- Covers: R5.4
- Size: S
- Depends on: T6
- Files: docs/revision-docente.md, docs/guia-docentes.md
- Verify: R5.4 `[manual]` (reason: solo un humano aprueba anatomía, AGENTS.md). Revisión del texto, que falla si falta algo: `docs/revision-docente.md` tiene una sección que (a) dice que la revisión llega por ruta en `trazado_<id de la ruta>`; (b) dice que `trazado_derecho` y `trazado_izquierdo` salen desactualizadas y no se aplican; (c) dice que solo el editor, con la aprobación de un docente, cambia `revision.estado` a `aprobada` y llena `revisado_por` y `fecha` en `pipeline/rutas-vago.yaml`; (d) trae el comando en PowerShell con ruta de Windows (`.\.venv-pipeline\Scripts\python pipeline\generar-ramas-vago.py`) y dice que el cambio sube como PR tier C; (e) sin guion largo; `npm run lint` y `npm test` en verde
- Issue: #52
- Status: todo

### Decision log
- Ronda 1: rewrite. El Verify nombra el contenido exigido y los comandos de PowerShell.
- Ronda 2: keep.


