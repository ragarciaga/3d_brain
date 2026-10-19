# Tasks: Propuestas para la sesión docente (marcadores y trazos del vago)
Spec: docs/specs/04-teacher-review-proposals/  |  Status: approved  |  Converged: 2026-10-14, 3 rounds

## T1: Permitir una posición por lado y que el marcador siga a su ancla
- Purpose: que un marcador par se dibuje con un punto en cada lado y que, al separar las piezas, cada marcador con ancla se mueva con su pieza y vuelva exacto al armar.
- Covers: R3.1, R3.2, R3.3
- Size: M
- Depends on: none
- Files: src/data/tipos.ts, src/data/atlas.ts, src/components/Visor.tsx, src/main.tsx, tests/datos.test.ts, e2e/marcadores.spec.ts
- Verify: `npm test -- tests/datos.test.ts`: la función `posicionValida` (nueva, en `src/data/atlas.ts`) acepta `[x,y,z]` finito, `{ l }`, `{ r }`, `{ l, r }` y `null`, y rechaza `[1,2]`, `[1,2,null]`, `{}`, `{ l: [1,2] }`, un texto y una clave distinta de `l` o `r`; todos los marcadores actuales de `marcadores.json` la cumplen. `npm run test:e2e -- e2e/marcadores.spec.ts` con un marcador de prueba inyectado por un gancho solo de desarrollo en `src/main.tsx` (`import.meta.env.DEV`, como `__atlas`), que además expone la posición mundial dibujada de cada punto: (a) con `posicion: { l, r }` y ancla par se ven dos puntos, el izquierdo sobre la pieza de `nodos[p].lado === 'l'` y el derecho sobre la de `'r'`; (b) al separar al 60 % cada punto se desplaza lo mismo que su pieza ancla (`objetivo`), con diferencia de 0,1 mm o menos; con `posicion` única y ancla de varias piezas el desplazamiento es el promedio de las piezas del ancla; (c) al reensamblar cada punto queda exactamente en su `posicion` (diferencia 0); (d) un marcador con ancla y sin posición sigue en el centro de su pieza como hoy; (e) un marcador con `posicion` y sin ancla se queda fijo al separar; `npm run typecheck`
- Issue: #101
- Status: done

### Decision log
- 2026-10-14 ronda 1: `posicionValida` en `src/data/atlas.ts` y gancho de desarrollo en `src/main.tsx` para que el e2e pueda leer posiciones dibujadas; casos (b) con ancla de varias piezas y (e) sin ancla agregados.
- 2026-10-14: con `{ l, r }` y un ancla sin piezas de ese lado se sigue el promedio de todas; se dibuja aunque el ancla esté oculta. Tier C. Outcome: reviews pass after 0 kickbacks, PR #113.

## T2: Escribir las reglas y el ubicador de marcadores con su modelo sintético
- Purpose: tener las 26 reglas versionadas, cada una con su fuente verificada, y un ubicador que las aplica sobre mallas con nombre y escribe `pipeline/salida/marcadores-propuestos.json` con la forma que lee T3, probado sin Blender sobre un modelo sintético, incluida la conversión a glTF, la comprobación de 5 mm y la salida idéntica byte a byte.
- Covers: R1.2, R1.3, R1.5, R1.6, R2.1, R2.2
- Size: M
- Depends on: none
- Files: pipeline/reglas-marcadores.yaml, pipeline/ubicar-marcadores.py, pipeline/geometria.py, pipeline/pruebas/probar_ubicar.py, pipeline/pruebas/probar_reglas.py, pipeline/pruebas/modelo_sintetico_marcadores.py
- Verify: `python3 pipeline/pruebas/probar_ubicar.py` (sin Blender: la geometría vive en `pipeline/geometria.py` sobre listas de vértices y `bpy` solo se usa para leer el modelo real; `ubicar-marcadores.py` no importa `bpy` en el nivel superior): `geometria.a_gltf` convierte un punto de Blender (x,y,z) en (x,z,-y) redondeado a 5 decimales, con un punto conocido; cada operación (`extremo`, `centro`, `polo`, `en_curva`, `superficie`, `plano_medio`, `entre`) da el punto esperado sobre el modelo sintético; `geometria.py` también expone distancia a la superficie, punto más cercano y largo de una polilínea, cada una con su caso; `lado: ambos` da un punto por lado (`{ l, r }`); una malla inexistente detiene nombrando marcador y malla sin escribir nada; una regla cuya fuente no está en `docs/research/marcadores/fuentes.md` deja el marcador `sin_ubicar` con motivo; una regla cuyo punto queda a más de 5 mm de toda malla que nombra detiene con marcador y distancia; una regla con `desacuerdo: { es, en }` lo copia a su propuesta; el ubicador escribe en la ruta `pipeline/salida/marcadores-propuestos.json` (cambiable por argumento; la prueba usa una carpeta temporal) una lista donde cada propuesta trae `id`, `posicion` (punto, `{ l, r }` o `null`), `ancla` cuando la regla la trae, `metodo` y `cita` con `es` y `en` (la `cita` nombra autores, año y PMID, DOI o URL de cada clave de `fuentes`), `motivo` si `posicion` es `null`, y `estado: 'aproximada'` en toda propuesta con posición (ninguna trae `validada`); dos corridas sobre el modelo sintético dan archivos idénticos byte a byte. `python3 pipeline/pruebas/probar_reglas.py` (usa `pyyaml` de `pipeline/requirements.txt`, sin dependencias nuevas de la app): hay 26 reglas, una por marcador de `src/data/marcadores.json`; ninguna trae listas de tres números; cada clave de `fuentes` aparece en la bibliografía de `fuentes.md` y su entrada trae PMID, DOI o URL; cada `metodo` trae es y en sin guion largo; `operacion` y `lado` son de las listas del diseño; la regla de Wernicke trae `desacuerdo` en es y en y nombra a Binder, Matchin y Tremblay; cada `ancla` es un id que existe en los datos de la app (la misma comprobación de `tests/datos.test.ts`)
- Issue: #102
- Status: done

### Decision log
- 2026-10-14 ronda 1: la prueba de reglas pasa a Python (`probar_reglas.py`) porque la app no tiene lector de YAML y agregar uno sería una dependencia nueva; se prueban aquí la comprobación de 5 mm y el determinismo; `geometria.py` expone lo que necesita T5; `desacuerdo` lo define T3 y lo emite T2.
- 2026-10-14 ronda 2: se fija la ruta y la forma de la salida (contrato con T3 y T4), se prueba `a_gltf` (hoy solo existe en `auditar-vago.py`, que importa `bpy`) y se exige identificador en la entrada bibliográfica (R2.1).
- 2026-10-14 corrida cycle-79c539f-qbnz: bloqueada tras 2 devoluciones; el verificador marca que el regex del año acepta un año dentro de la consulta de una URL (ver #102, rama `rb/T2-reglas-y-ubicador-de-marcadores`).
- 2026-10-16: tercera devolución aprobada por el editor (dos casos negativos de PMID y DOI en las pruebas), rama nueva `rb/T2-reglas-ubicador-v3` sobre main sin push forzado, because el verificador mostró que esos casos no podían fallar. Tier C. Outcome: reviews pass after 3 kickbacks, PR #164.
- 2026-10-16: merged as PR #164 (fusionado por el editor).

## T3: Aplicar las propuestas a los datos de marcadores sin tocar nada más
- Purpose: que un script lleve las posiciones propuestas a `src/data/marcadores.json` con el método y la cita en es y en, deje constancia de los desacuerdos de fuentes y produzca el resumen antes y después para el PR, sin alterar el formato del archivo ni nada que la propuesta no traiga.
- Covers: R2.3, R2.4, R6.2
- Size: S
- Depends on: T1
- Files: scripts/aplicar-marcadores.ts, scripts/lib/marcadores.ts, tests/aplicar-marcadores.test.ts
- Verify: `npm test -- tests/aplicar-marcadores.test.ts` con propuestas de prueba (posición como punto, como `{ l, r }` y `null` con `motivo`): aplicar una lista vacía de propuestas al `src/data/marcadores.json` real y serializar deja el texto idéntico byte a byte al archivo actual (misma sangría y salto final); solo cambian `posicion`, `estado` (a `aproximada`), `fuente_ubicacion` y `ancla` cuando la propuesta la trae; `id`, `padre`, `unir`, nombres y cualquier marcador `validada` existente quedan iguales (un marcador `validada` con propuesta conserva su posición y su estado, y el resumen dice que se omitió); `fuente_ubicacion` es y en tienen el método y la cita (autores, año, PMID o DOI); una propuesta con el campo opcional `desacuerdo: { es, en }` (texto que nombra las dos posturas con su cita, como Wernicke) lo añade a `fuente_ubicacion` en los dos idiomas y la prueba comprueba que aparecen las dos citas; una propuesta con `posicion: null` y `motivo` deja el marcador `sin_ubicar` con el motivo en el resumen; un `id` desconocido detiene sin escribir ningún archivo; una `posicion` que no sea un punto de tres números finitos, `{ l, r }` con puntos válidos o `null` (por ejemplo `[1,2]`, `[1,2,null]`, `{}`, `{ x: [1,2,3] }`) detiene sin escribir ningún archivo; un marcador sin propuesta queda como estaba con su motivo en el resumen; una propuesta con `posicion: null` para un marcador que hoy es `aproximada` con `ancla` no lo baja a `sin_ubicar`: queda como estaba y el resumen dice por qué no hubo posición; el resumen lista por marcador antes, después, regla y fuente; el CLI lee `pipeline/salida/marcadores-propuestos.json` y escribe `src/data/marcadores.json` y `docs/research/marcadores/resumen-propuestas.md` (rutas cambiables por argumento, la prueba usa una carpeta temporal); dos ejecuciones con las mismas entradas dan el mismo `marcadores.json` y el mismo resumen byte a byte; `npm run typecheck`
- Issue: #103
- Status: done

### Decision log
- 2026-10-14 ronda 1: depende de T1 por el tipo de `posicion`; campo `desacuerdo` definido aquí; el CLI fija sus rutas de entrada y salida para que T4 solo lo ejecute.
- 2026-10-14 ronda 2: se exige conservar el formato actual del JSON (diff revisable en el PR de nivel C) y detener ante una `posicion` mal formada; una propuesta sin posición no le quita a un marcador `aproximada` el punto en su ancla que ya tiene.
- 2026-10-16: merged as PR #172 (squash, rb merge-gate).

## T4: Medir las posiciones reales y escribirlas en los marcadores
- Purpose: correr el ubicador sobre el modelo completo de Z-Anatomy en la nube y dejar los 26 marcadores con su propuesta, listos para que el editor los apruebe.
- Covers: R1.1, R1.4, R1.7, R6.1
- Size: M
- Depends on: T1, T2, T3
- Files: src/data/marcadores.json, tests/datos.test.ts, e2e/atlas.spec.ts, docs/research/marcadores/resumen-propuestas.md, pipeline/reglas-marcadores.yaml
- Verify: corrida real (`pip install -r pipeline/requirements.txt`, `python pipeline/descargar.py`, `python pipeline/ubicar-marcadores.py`; la salida intermedia `pipeline/salida/marcadores-propuestos.json` queda en una carpeta ignorada por git); se copia la salida a `pipeline/salida/marcadores-propuestos.1.json`, se corre el ubicador otra vez y `cmp pipeline/salida/marcadores-propuestos.json pipeline/salida/marcadores-propuestos.1.json` no da diferencias; la corrida falla si alguna posición queda a más de 5 mm de todas las mallas de su regla; `pipeline/reglas-marcadores.yaml` solo cambia para corregir una regla que la corrida real deje a más de 5 mm o sin punto, con la misma fuente y `python3 pipeline/pruebas/probar_reglas.py` en verde; `node scripts/aplicar-marcadores.ts` actualiza `src/data/marcadores.json` y escribe `docs/research/marcadores/resumen-propuestas.md`; `npm test -- tests/datos.test.ts` en verde con pruebas ajustadas que fallan si no se cumple: (a) Wernicke ya no exige `posicion: null`, tiene posición y su `fuente_ubicacion` (es y en) cita la discusión de la definición con Binder 2015, Matchin 2022 y Tremblay y Dick 2016; (b) cada uno de los 26 marcadores tiene `posicion`, o es `sin_ubicar`, o es `aproximada` con `ancla` y sin posición (lo que T3 deja si la propuesta no trae punto); el id de cada `sin_ubicar` y de cada `aproximada` sin posición aparece con su motivo en `docs/research/marcadores/resumen-propuestas.md` (que es donde T3 escribe el motivo); (c) ningún marcador es `validada` (hoy ninguno lo es y el aplicador no crea ninguno); (d) toda `aproximada` trae fuente es y en; (e) la prueba 'la fuente de ubicación de un marcador es bilingüe...' de `tests/datos.test.ts` (línea 79) y el caso 'marcadores: la fuente de ubicación sale en el idioma de la interfaz...' de `e2e/atlas.spec.ts` (líneas 596 a 603) dejan de exigir el texto anterior de `m-periaqueductal-grey` y comprueban, en cada idioma, un fragmento de su `fuente_ubicacion` leído de `src/data/marcadores.json` y que en `en` no aparece texto en español; `npm run test:e2e -- e2e/atlas.spec.ts -g "marcadores: la fuente de ubicación"` en verde; `npm test` y `npm run check:modelo` en verde; `[manual]` el editor revisa en el PR `docs/research/marcadores/resumen-propuestas.md` (antes y después, regla y fuente por marcador) y aprueba (razón: contenido anatómico, AGENTS.md)
- Issue: #104
- Status: done

### Decision log
- 2026-10-14 ronda 1: la salida del pipeline no entra al PR (`.gitignore`); el determinismo se prueba con `cmp` explícito; pruebas de datos (a) a (d) concretas.
- 2026-10-14 ronda 2: (b) comprueba el motivo de los `sin_ubicar` en el resumen, que es donde lo escribe T3 (antes pedía `fuente_ubicacion`, que T3 no toca para esos casos); (c) se formula sobre el estado real de hoy.
- 2026-10-14 ronda 3: se agregan `e2e/atlas.spec.ts` y la aserción de PAG (rompían con el nuevo `fuente_ubicacion`), el YAML como archivo corregible tras la corrida real, y (b) admite la `aproximada` sin posición que T3 conserva.
- 2026-10-17: PR #204 con verificador y auditor en verde (una devolución por afirmaciones viejas en SPEC.md y docs/v2.md); espera la aprobación del editor.
- 2026-10-17: fusionada como PR #204 (aprobada por el editor).

## T5: Agregar a la auditoría del vago las reglas de raicillas, cuello y abdomen
- Purpose: que la auditoría deje para cada trazo su evidencia medida y, cuando la regla lo distingue, un ramo propuesto con confianza: raicillas detrás de la oliva, faríngeo frente a laríngeo superior, y ramos abdominales por su destino (hígado, cara anterior o posterior del estómago, aorta bajo el hiato). Las reglas y la escritura de `trazos-medidos.json` viven en un módulo sin `bpy` para probarlas sin Blender.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5
- Size: M
- Depends on: T2
- Files: pipeline/reglas_vago.py, pipeline/auditar-vago.py, pipeline/pruebas/probar_auditar.py, pipeline/pruebas/vago_sintetico.py, tests/fixtures/vago-sintetico/anclajes.json, tests/fixtures/vago-sintetico/puntos.json
- Verify: `python3 pipeline/pruebas/probar_auditar.py` sin Blender sobre el vago sintético (importa `pipeline/reglas_vago.py`, que usa `pipeline/geometria.py` de T2; `auditar-vago.py` solo agrega `bpy` para leer el modelo real, suma `Olive.l`, `Olive.r` y `Liver` a `ANCLAJES` con esos nombres exactos y pasa los vértices de superficie a las reglas). Los vértices de superficie del sintético no entran en `anclajes.json`. Casos: un trazo corto que toca el bulbo detrás de `Olive.l` o `Olive.r` sale `no_es_ramo` con `regla: raicilla`, y uno largo en el bulbo no sale raicilla; uno que sale a 2 a 3,5 cm del foramen y termina en la cara posterior de `Laryngopharynx` sale `m-pharyngeal-branch-of-vagus-nerve`, y el mismo trazo a menos de 2 cm o a más de 3,5 cm no; uno que termina junto a `Thyroid cartilage` sale `m-superior-laryngeal-nerve`; abdominales: junto a `Liver` sale `m-hepatic-branches-of-anterior-vagal-trunk`, sobre la cara anterior de `Stomach` desde el vago izquierdo sale `m-anterior-gastric-branches-of-anterior-vagal-trunk`, sobre la cara posterior desde el derecho sale `m-posterior-gastric-branches-of-posterior-vagal-trunk`, hacia la aorta bajo el hiato (`Thoracic aorta`, `Diaphragm`) sale `m-coeliac-branches-of-posterior-vagal-trunk`; uno ambiguo queda con `propuesta: null` y `confianza: null`, y su `regla` es `sin_regla`; uno de más de 20 cm de largo (como `Vagus nerve (X).r#t00` del sintético) sale `no_es_ramo` con `regla: tronco`, y uno corto del cuello no sale `tronco`. Confianza: `alta` si se cumplen todas las condiciones de la regla y la segunda pieza más cercana al extremo está a más del doble de distancia que la primera; `media` si se cumplen pero la segunda está a menos del doble; `baja` si se cumplen pero algún umbral queda a menos de 3 mm del límite; si se da `baja` junto con `media`, el resultado es `baja`; hay un caso de prueba por cada nivel. Esquema de `trazos-medidos.json`, objeto por nombre de malla con claves ordenadas: `altura_mm: { max, min }`, `largo_mm`, `cerca_extremos: { superior: [{ pieza, mm }], inferior: [{ pieza, mm }] }` (las dos piezas más próximas a cada extremo, de menor a mayor `mm`), `regla` (código: `raicilla`, `faringeo`, `laringeo_superior`, `abdominal_hepatico`, `abdominal_gastrico_anterior`, `abdominal_gastrico_posterior`, `abdominal_celiaco`, `tronco`, `sin_regla`), `auditoria` (texto de la columna "Propuesta" de la tabla), `propuesta` (id de ramo, `no_es_ramo` o `null`), `confianza` (`alta`, `media`, `baja` o `null`) y `fuente` (clave que aparece en la bibliografía de `docs/research/marcadores/fuentes.md`); el texto es y en de la evidencia lo redacta T6 a partir de `regla` y estas medidas. La prueba comprueba el esquema y que cada `fuente` está en la bibliografía. Los umbrales de cercanía son constantes con nombre en `reglas_vago.py`. La función que escribe `trazos-medidos.json` vive en `reglas_vago.py`; la prueba la llama dos veces sobre el sintético y los dos archivos son idénticos byte a byte. `python3 pipeline/pruebas/probar_generar.py` sigue en verde y `npm test -- tests/asimetrias.test.ts tests/rutas.test.ts` sigue en verde con los fixtures regenerados.
- Issue: #105
- Status: done

### Decision log
- 2026-10-14 ronda 1: reglas en `pipeline/reglas_vago.py` sin `bpy`; casos negativos de umbral; la tabla de `docs/` pasa a T7, único dueño.
- 2026-10-14 ronda 2: se agregan `Olive.l`, `Olive.r` y `Liver` a los anclajes; se listan los fixtures regenerados y sus pruebas consumidoras; se fija el esquema de `trazos-medidos.json` (lo consume T6); el determinismo se prueba sobre el sintético; criterio de confianza (procedimiento, decidido por delegación del editor) e ids de ramo explícitos.
- 2026-10-14 ronda 3: caso `tronco` (hoy `no_es_ramo` para más de 20 cm), dos piezas por extremo, precedencia de `baja` y umbrales como constantes con nombre en `reglas_vago.py` (visibles en el PR de T7).
- 2026-10-16: fusionada como PR #175 (nivel C por tamaño; una devolución por marcas "(derivado)", el comentario de `ANCLAJES` y un mutante del extremo de la raicilla).

## T6: Escribir el aplicador de evidencia y propuestas de trazos sin tocar nada más
- Purpose: que un script lleve la medición de la auditoría a la forma de `src/data/trazos-vago.json` (evidencia es y en, confianza, fuente y propuesta) sin cambiar nada más, y produzca el resumen antes y después de los trazos para el PR.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5, R6.2
- Size: S
- Depends on: T1, T5
- Files: src/data/tipos.ts, scripts/aplicar-trazos.ts, scripts/lib/trazos.ts, tests/aplicar-trazos.test.ts
- Verify: `npm test -- tests/aplicar-trazos.test.ts` con mediciones de prueba (mismo formato de `trazos-medidos.json` de T5): cada trazo gana `evidencia` es y en con altura, largo y piezas cercanas a sus extremos, `confianza` (`alta`, `media`, `baja` o `null` sin propuesta) y `fuente` copiada tal cual de la medición (clave de la bibliografía de `fuentes.md`, no el código `regla`); una raicilla sale `no_es_ramo` con la evidencia "raicilla"; un trazo ambiguo sale con `propuesta: null`, `confianza: null` y la evidencia dice que ninguna regla se cumple y queda sin propuesta; `propuesta` solo es un id de la lista de ramos o `no_es_ramo`, y cualquier otro valor detiene sin escribir; una malla desconocida detiene sin escribir; solo cambian `evidencia`, `confianza`, `fuente`, `propuesta` y `auditoria`, y `malla` y el orden quedan iguales; el resumen lista por trazo antes, después, regla y fuente; el CLI lee `pipeline/salida/trazos-medidos.json` y escribe `src/data/trazos-vago.json` y `docs/research/vago/resumen-trazos.md` (rutas cambiables por argumento, la prueba usa una carpeta temporal); el JSON de salida no contiene guion largo; `npm run typecheck`
- Issue: #106
- Status: done

### Decision log
- 2026-10-14 ronda 1: partida de la antigua T6 (código aparte de los datos, como T3 y T4); depende de T1 porque las dos editan `src/data/tipos.ts`.
- 2026-10-17: PR #203 con verificador y auditor en verde (una devolución: la evidencia dice exactamente lo que mide la regla); espera al editor.
- 2026-10-17: fusionada como PR #203 (aprobada por el editor).

## T7: Medir los trazos reales y escribir la evidencia y las propuestas en los 28 trazos
- Purpose: correr la auditoría con las reglas nuevas sobre el modelo completo de Z-Anatomy y dejar en `src/data/trazos-vago.json` la evidencia, la confianza, la fuente y la propuesta de cada uno de los 28 trazos, listos para que el editor los apruebe.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5, R6.1
- Size: M
- Depends on: T6
- Files: src/data/trazos-vago.json, docs/research/vago/auditoria-vago.md, docs/research/vago/resumen-trazos.md, tests/trazos.test.ts, e2e/trazos-vago.spec.ts, pipeline/reglas_vago.py, pipeline/auditar-vago.py
- Verify: corrida real de `pipeline/auditar-vago.py` sobre Z-Anatomy dos veces con `pipeline/salida/trazos-medidos.json` idéntico (`cmp`); las secciones `## Anclajes` y `## Trazos` de `pipeline/salida/auditoria-vago.md` reemplazan las del mismo nombre en `docs/research/vago/auditoria-vago.md`; el resto del documento (Cómo se generó, Anclaje sustituido, Asimetrías, Propuestas de `candidato()`) queda igual y se le agrega una nota breve de las reglas nuevas de la spec 04; `pipeline/reglas_vago.py` y `pipeline/auditar-vago.py` solo cambian para corregir lo que la corrida real revele, con `python3 pipeline/pruebas/probar_auditar.py` en verde; `pipeline/anclajes-vago.json`, que escribe la misma corrida, no entra al PR y se borra antes de `npm test` (con el modelo actual la prueba de asimetrías sobre anclajes reales falla, como debe según el ADR 0010; eso es de la spec 02, no de esta tarea); `node scripts/aplicar-trazos.ts` actualiza `src/data/trazos-vago.json` y escribe `docs/research/vago/resumen-trazos.md` (antes y después, regla y fuente por trazo); `npm test` en verde con `tests/trazos.test.ts` ajustado: ya no fija exactamente 4 propuestas, ni el mapa de textos de `auditoria`, ni las propuestas de `r#t01`, `l#t02` y `r#t03` (las aserciones de `propuestaDeTrazo` leen de `trazosAuditados`); exige que los 28 trazos tengan `evidencia` es y en no vacía y `fuente`, y que `confianza` sea `alta`, `media` o `baja` exactamente cuando hay `propuesta` y `null` cuando no, que cada `fuente` aparezca en la bibliografía de `docs/research/marcadores/fuentes.md`, que `propuesta` sea de la lista o `no_es_ramo`, y que la tabla de la auditoría y el JSON coincidan trazo por trazo, columna `auditoria` incluida; `npm run test:e2e -- e2e/trazos-vago.spec.ts` en verde con el spec ajustado para tomar de `src/data/trazos-vago.json` qué trazo trae propuesta y cuál no, en vez de fijar `l#t00`, `l#t01` y `l#t02`; `npm run check:modelo` en verde; `[manual]` el editor revisa en el PR la tabla nueva de la auditoría y `docs/research/vago/resumen-trazos.md` y aprueba (razón: contenido anatómico, AGENTS.md)
- Issue: #107
- Status: done

### Decision log
- 2026-10-14 ronda 1: partida de la antigua T6; cubre R6.1 para trazos con `resumen-trazos.md`; único dueño de `docs/research/vago/auditoria-vago.md`.
- 2026-10-14 ronda 2: se agrega el e2e de trazos (fija propuestas de `l#t00` a `l#t02`), las aserciones de `propuestaDeTrazo` por malla, la comprobación de `fuente` contra la bibliografía y el manejo de `pipeline/anclajes-vago.json` (no entra al PR y se borra antes de las pruebas).
- 2026-10-14 ronda 3: no se pisa el resto de `auditoria-vago.md` (spec 02), se permite corregir las reglas tras la corrida real y se fija `confianza` frente a `propuesta`.
- 2026-10-17: corrida real de Blender dos veces con `trazos-medidos.json` idéntico; PR #206 encima de #203, con verificador y auditor en verde (una devolución: una prueba ata cada propuesta a su regla); espera al editor. Resultado: 17 de 28 sin propuesta, 7 gástricos posteriores, 2 tronco y 2 raicillas.
- 2026-10-17: fusionada como PR #206 (aprobada por el editor).

## T8: Mostrar la evidencia al docente y dejarlo confirmar con un toque
- Purpose: que en modo revisión el docente vea, junto a cada trazo, la propuesta, la confianza, la evidencia y la fuente, y junto a cada marcador ubicado el método y la fuente de su posición (con el desacuerdo de fuentes si lo hay), y confirme con un solo toque ("Correcto" en el trazo ya existe y se conserva; se agrega "Correcto" para la posición de un marcador).
- Covers: R5.1, R5.2, R5.3
- Size: M
- Depends on: T4, T7
- Files: src/lib/trazos.ts, src/components/RevisionTrazo.tsx, src/components/Ficha.tsx, src/i18n/es.json, src/i18n/en.json, tests/trazos.test.ts, tests/revision.test.ts, e2e/trazos-vago.spec.ts, e2e/marcadores.spec.ts
- Verify: `npm test -- tests/trazos.test.ts tests/revision.test.ts` (un lector nuevo en `src/lib/trazos.ts` devuelve `evidencia`, `confianza` y `fuente` de un trazo, y `null` o vacío para uno sin propuesta; una respuesta `{ campo: 'posicion', veredicto: 'correcto' }` sin `posicion` pasa `respuestaValida` y `propuestaDePosicion` sigue devolviendo null para ella). `npm run test:e2e -- e2e/trazos-vago.spec.ts e2e/marcadores.spec.ts`: (a) al abrir un trazo con propuesta se ven propuesta, confianza, evidencia y fuente en es, y en en al cambiar de idioma; (b) uno sin propuesta muestra la evidencia y "sin propuesta"; (c) en modo revisión, la ficha de un marcador `aproximada` con posición muestra en un bloque propio (`data-testid`) el método y la fuente de la posición en el idioma activo, junto al botón "Proponer posición", y el de Wernicke muestra la nota de desacuerdo; (d) "Correcto" en ese marcador guarda una respuesta `correcto` de campo `posicion` con un solo toque (sin abrir otro paso), y volver a pulsarlo la borra; (e) con una posición ya propuesta por el docente, "Correcto" no aparece y la propuesta no se pierde; (f) un marcador `sin_ubicar` sin posición no muestra "Correcto"; (g) "Correcto" en un trazo con propuesta sigue guardando `correcto` con un toque; los casos actuales de `e2e/trazos-vago.spec.ts` siguen en verde; `npm run check:i18n`; `npm run typecheck`
- Issue: #108
- Status: done

### Decision log
- 2026-10-14 ronda 1: lector nuevo en `src/lib/trazos.ts`; "Correcto" de marcador con forma definida (clave compartida con "Proponer posición", no pisa una propuesta, se deshace); se aclara qué ya existe para no rehacerlo; no cambia `camposDeFicha`.
- 2026-10-17: plan publicado en #108 (nivel B); se implementa sobre T4 y T7 y se fusiona después de ellos.
- 2026-10-17: fusionada como PR #209 (nivel B; una devolución: la prueba en inglés comparaba solo el comienzo de la propuesta).

## T9: Citar completa la fuente de la regla de cada trazo
- Purpose: que el docente vea junto a cada trazo la fuente de su regla como cita (autores, título, año e identificador PMID, DOI o URL) y no solo la clave interna (hoy "Fuente de la regla: Bahadir2026"), para verificarla sin buscar fuera de la app. Lo encontró la auditoría de objetivo de la verificación (test-report.md, Goal G4).
- Covers: R4.5, R5.1
- Size: S
- Depends on: T8
- Files: src/lib/trazos.ts, src/components/RevisionTrazo.tsx, tests/trazos.test.ts, e2e/trazos-vago.spec.ts
- Verify: `npm test -- tests/trazos.test.ts` (cada clave `fuente` de `src/data/trazos-vago.json` se resuelve a una cita con autores, título, año e identificador tomada de la bibliografía registrada en `docs/research/marcadores/fuentes.md`, sin texto inventado; una clave sin entrada no muestra una cita vacía); `npm run test:e2e -- e2e/trazos-vago.spec.ts` (al abrir un trazo con propuesta en es y en, el bloque de la fuente muestra la cita completa y no la clave sola); `npm run check:i18n`; `npm run typecheck`. Si la cita tiene que vivir en `src/data/`, el plan lo declara nivel C.
- Issue: #218
- Status: todo

### Decision log
- 2026-10-18: creada por la verificación de la feature (auditoría de objetivo, G4 parcial): R4.5 y R5.1 piden la fuente y hoy se ve solo la clave.
