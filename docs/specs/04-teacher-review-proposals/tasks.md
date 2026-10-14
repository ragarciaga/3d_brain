# Tasks: Propuestas para la sesión docente (marcadores y trazos del vago)
Spec: docs/specs/04-teacher-review-proposals/  |  Status: draft  |  Converged: 2026-10-14, 1 rounds

## T1: Permitir una posición por lado y que el marcador siga a su ancla
- Purpose: que un marcador par se dibuje con un punto en cada lado y que, al separar las piezas, cada marcador con ancla se mueva con su pieza y vuelva exacto al armar.
- Covers: R3.1, R3.2, R3.3
- Size: M
- Depends on: none
- Files: src/data/tipos.ts, src/data/atlas.ts, src/components/Visor.tsx, src/main.tsx, tests/datos.test.ts, e2e/marcadores.spec.ts
- Verify: `npm test -- tests/datos.test.ts`: la función `posicionValida` (nueva, en `src/data/atlas.ts`) acepta `[x,y,z]` finito, `{ l }`, `{ r }`, `{ l, r }` y `null`, y rechaza `[1,2]`, `[1,2,null]`, `{}`, `{ l: [1,2] }`, un texto y una clave distinta de `l` o `r`; todos los marcadores actuales de `marcadores.json` la cumplen. `npm run test:e2e -- e2e/marcadores.spec.ts` con un marcador de prueba inyectado por un gancho solo de desarrollo en `src/main.tsx` (`import.meta.env.DEV`, como `__atlas`), que además expone la posición mundial dibujada de cada punto: (a) con `posicion: { l, r }` y ancla par se ven dos puntos, el izquierdo sobre la pieza de `nodos[p].lado === 'l'` y el derecho sobre la de `'r'`; (b) al separar al 60 % cada punto se desplaza lo mismo que su pieza ancla (`objetivo`), con diferencia de 0,1 mm o menos; con `posicion` única y ancla de varias piezas el desplazamiento es el promedio de las piezas del ancla; (c) al reensamblar cada punto queda exactamente en su `posicion` (diferencia 0); (d) un marcador con ancla y sin posición sigue en el centro de su pieza como hoy; (e) un marcador con `posicion` y sin ancla se queda fijo al separar; `npm run typecheck`
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: `posicionValida` en `src/data/atlas.ts` y gancho de desarrollo en `src/main.tsx` para que el e2e pueda leer posiciones dibujadas; casos (b) con ancla de varias piezas y (e) sin ancla agregados.

## T2: Escribir las reglas y el ubicador de marcadores con su modelo sintético
- Purpose: tener las 26 reglas versionadas, cada una con su fuente verificada, y un ubicador que las aplica sobre mallas con nombre, probado sin Blender sobre un modelo sintético, incluida la comprobación de 5 mm y la salida idéntica byte a byte.
- Covers: R1.2, R1.3, R1.5, R1.6, R2.1, R2.2
- Size: M
- Depends on: none
- Files: pipeline/reglas-marcadores.yaml, pipeline/ubicar-marcadores.py, pipeline/geometria.py, pipeline/pruebas/probar_ubicar.py, pipeline/pruebas/probar_reglas.py, pipeline/pruebas/modelo_sintetico_marcadores.py
- Verify: `python3 pipeline/pruebas/probar_ubicar.py` (sin Blender: la geometría vive en `pipeline/geometria.py` sobre listas de vértices y `bpy` solo se usa para leer el modelo real): cada operación (`extremo`, `centro`, `polo`, `en_curva`, `superficie`, `plano_medio`, `entre`) da el punto esperado sobre el modelo sintético; `geometria.py` también expone distancia a la superficie, punto más cercano y largo de una polilínea, cada una con su caso; `lado: ambos` da un punto por lado; una malla inexistente detiene nombrando marcador y malla sin escribir nada; una regla cuya fuente no está en `docs/research/marcadores/fuentes.md` deja el marcador `sin_ubicar` con motivo; una regla cuyo punto queda a más de 5 mm de toda malla que nombra detiene con marcador y distancia; una regla con `desacuerdo: { es, en }` lo copia a su propuesta; dos corridas sobre el modelo sintético dan archivos idénticos byte a byte; toda salida es `aproximada`. `python3 pipeline/pruebas/probar_reglas.py` (usa `pyyaml` de `pipeline/requirements.txt`, sin dependencias nuevas de la app): hay 26 reglas, una por marcador de `src/data/marcadores.json`; ninguna trae listas de tres números; cada clave de `fuentes` aparece en la bibliografía de `fuentes.md`; cada `metodo` trae es y en sin guion largo; `operacion` y `lado` son de las listas del diseño; la regla de Wernicke trae `desacuerdo` en es y en
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: la prueba de reglas pasa a Python (`probar_reglas.py`) porque la app no tiene lector de YAML y agregar uno sería una dependencia nueva; se prueban aquí la comprobación de 5 mm y el determinismo; `geometria.py` expone lo que necesita T5; `desacuerdo` lo define T3 y lo emite T2.

## T3: Aplicar las propuestas a los datos de marcadores sin tocar nada más
- Purpose: que un script lleve las posiciones propuestas a `src/data/marcadores.json` con el método y la cita en es y en, deje constancia de los desacuerdos de fuentes y produzca el resumen antes y después para el PR.
- Covers: R2.3, R2.4, R6.2
- Size: S
- Depends on: T1
- Files: scripts/aplicar-marcadores.ts, scripts/lib/marcadores.ts, tests/aplicar-marcadores.test.ts
- Verify: `npm test -- tests/aplicar-marcadores.test.ts` con propuestas de prueba (posición como punto, como `{ l, r }` y `null` con `motivo`): solo cambian `posicion`, `estado` (a `aproximada`), `fuente_ubicacion` y `ancla` cuando la propuesta la trae; `id`, `padre`, `unir`, nombres y cualquier marcador `validada` existente quedan iguales (un marcador `validada` con propuesta conserva su posición y su estado, y el resumen dice que se omitió); `fuente_ubicacion` es y en tienen el método y la cita (autores, año, PMID o DOI); una propuesta con el campo opcional `desacuerdo: { es, en }` (texto que nombra las dos posturas con su cita, como Wernicke) lo añade a `fuente_ubicacion` en los dos idiomas y la prueba comprueba que aparecen las dos citas; una propuesta con `posicion: null` y `motivo` deja el marcador `sin_ubicar` con el motivo en el resumen; un `id` desconocido detiene sin escribir ningún archivo; un marcador sin propuesta queda como estaba con su motivo en el resumen; el resumen lista por marcador antes, después, regla y fuente; el CLI lee `pipeline/salida/marcadores-propuestos.json` y escribe `src/data/marcadores.json` y `docs/research/marcadores/resumen-propuestas.md` (rutas cambiables por argumento, la prueba usa una carpeta temporal); dos ejecuciones con las mismas entradas dan el mismo `marcadores.json` y el mismo resumen byte a byte; `npm run typecheck`
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: depende de T1 por el tipo de `posicion`; campo `desacuerdo` definido aquí; el CLI fija sus rutas de entrada y salida para que T4 solo lo ejecute.

## T4: Medir las posiciones reales y escribirlas en los marcadores
- Purpose: correr el ubicador sobre el modelo completo de Z-Anatomy en la nube y dejar los 26 marcadores con su propuesta, listos para que el editor los apruebe.
- Covers: R1.1, R1.4, R1.7, R6.1
- Size: M
- Depends on: T1, T2, T3
- Files: src/data/marcadores.json, tests/datos.test.ts, docs/research/marcadores/resumen-propuestas.md
- Verify: corrida real (`pip install -r pipeline/requirements.txt`, `python pipeline/descargar.py`, `python pipeline/ubicar-marcadores.py`; la salida intermedia `pipeline/salida/marcadores-propuestos.json` queda en una carpeta ignorada por git); se copia la salida a `pipeline/salida/marcadores-propuestos.1.json`, se corre el ubicador otra vez y `cmp pipeline/salida/marcadores-propuestos.json pipeline/salida/marcadores-propuestos.1.json` no da diferencias; la corrida falla si alguna posición queda a más de 5 mm de todas las mallas de su regla; `node scripts/aplicar-marcadores.ts` actualiza `src/data/marcadores.json` y escribe `docs/research/marcadores/resumen-propuestas.md`; `npm test -- tests/datos.test.ts` en verde con pruebas ajustadas que fallan si no se cumple: (a) Wernicke ya no exige `posicion: null`, tiene posición y su `fuente_ubicacion` (es y en) cita la discusión de la definición con Binder 2015, Matchin 2022 y Tremblay y Dick 2016; (b) cada uno de los 26 marcadores tiene `posicion` o es `sin_ubicar` con motivo escrito en `fuente_ubicacion`; (c) ninguno quedó `validada` que no lo fuera antes; (d) toda `aproximada` trae fuente es y en; `npm test` y `npm run check:modelo` en verde; `[manual]` el editor revisa en el PR `docs/research/marcadores/resumen-propuestas.md` (antes y después, regla y fuente por marcador) y aprueba (razón: contenido anatómico, AGENTS.md)
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: la salida del pipeline no entra al PR (`.gitignore`); el determinismo se prueba con `cmp` explícito; pruebas de datos (a) a (d) concretas.

## T5: Agregar a la auditoría del vago las reglas de raicillas, cuello y abdomen
- Purpose: que la auditoría deje para cada trazo su evidencia medida y, cuando la regla lo distingue, un ramo propuesto con confianza: raicillas detrás de la oliva, faríngeo frente a laríngeo superior, y ramos abdominales por su destino (hígado, cara anterior o posterior del estómago, aorta bajo el hiato). Las reglas viven en un módulo sin `bpy` para probarlas sin Blender.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5
- Size: M
- Depends on: T2
- Files: pipeline/reglas_vago.py, pipeline/auditar-vago.py, pipeline/pruebas/probar_auditar.py, pipeline/pruebas/vago_sintetico.py
- Verify: `python3 pipeline/pruebas/probar_auditar.py` sin Blender sobre el vago sintético (importa `pipeline/reglas_vago.py`, que usa `pipeline/geometria.py` de T2; `auditar-vago.py` solo agrega `bpy` para leer el modelo real): un trazo corto que toca el bulbo detrás de `Olive` sale `no_es_ramo` con evidencia "raicilla", y uno largo en el bulbo no sale raicilla; uno que sale a 2 a 3,5 cm del foramen y termina en la cara posterior de `Laryngopharynx` sale ramo faríngeo, y el mismo trazo a menos de 2 cm o a más de 3,5 cm no; uno que termina junto a `Thyroid cartilage` sale laríngeo superior; abdominales: junto a `Liver` hepático, sobre la cara anterior de `Stomach` desde el vago izquierdo gástrico anterior, sobre la cara posterior desde el derecho gástrico posterior, hacia la aorta bajo el hiato (`Thoracic aorta`, `Diaphragm`) celíaco; uno ambiguo queda sin propuesta, con `confianza: null`, y lo dice en la evidencia; cada trazo trae altura, largo, piezas cercanas a sus extremos, confianza (`alta`, `media`, `baja` o `null`) y clave de fuente que aparece en la bibliografía de `docs/research/marcadores/fuentes.md`; la salida `pipeline/salida/trazos-medidos.json` es idéntica byte a byte en dos corridas (`cmp`); `python3 pipeline/pruebas/probar_generar.py` sigue en verde tras ampliar `vago_sintetico.py`
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: reglas en `pipeline/reglas_vago.py` sin `bpy`; casos negativos de umbral; la tabla de `docs/` pasa a T7, único dueño.

## T6: Escribir el aplicador de evidencia y propuestas de trazos sin tocar nada más
- Purpose: que un script lleve la medición de la auditoría a la forma de `src/data/trazos-vago.json` (evidencia es y en, confianza, fuente y propuesta) sin cambiar nada más, y produzca el resumen antes y después de los trazos para el PR.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5, R6.2
- Size: S
- Depends on: T1, T5
- Files: src/data/tipos.ts, scripts/aplicar-trazos.ts, scripts/lib/trazos.ts, tests/aplicar-trazos.test.ts
- Verify: `npm test -- tests/aplicar-trazos.test.ts` con mediciones de prueba (mismo formato de `trazos-medidos.json` de T5): cada trazo gana `evidencia` es y en con altura, largo y piezas cercanas a sus extremos, `confianza` (`alta`, `media`, `baja` o `null` sin propuesta) y `fuente` con la clave de la regla; una raicilla sale `no_es_ramo` con la evidencia "raicilla"; un trazo ambiguo sale con `propuesta: null`, `confianza: null` y la evidencia dice que la regla no distingue; `propuesta` solo es un id de la lista de ramos o `no_es_ramo`, y cualquier otro valor detiene sin escribir; una malla desconocida detiene sin escribir; solo cambian `evidencia`, `confianza`, `fuente`, `propuesta` y `auditoria`, y `malla` y el orden quedan iguales; el resumen lista por trazo antes, después, regla y fuente; el CLI lee `pipeline/salida/trazos-medidos.json` y escribe `src/data/trazos-vago.json` y `docs/research/vago/resumen-trazos.md` (rutas cambiables por argumento, la prueba usa una carpeta temporal); el JSON de salida no contiene guion largo; `npm run typecheck`
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: partida de la antigua T6 (código aparte de los datos, como T3 y T4); depende de T1 porque las dos editan `src/data/tipos.ts`.

## T7: Medir los trazos reales y escribir la evidencia y las propuestas en los 28 trazos
- Purpose: correr la auditoría con las reglas nuevas sobre el modelo completo de Z-Anatomy y dejar en `src/data/trazos-vago.json` la evidencia, la confianza, la fuente y la propuesta de cada uno de los 28 trazos, listos para que el editor los apruebe.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5, R6.1
- Size: M
- Depends on: T6
- Files: src/data/trazos-vago.json, docs/research/vago/auditoria-vago.md, docs/research/vago/resumen-trazos.md, tests/trazos.test.ts
- Verify: corrida real de `pipeline/auditar-vago.py` sobre Z-Anatomy dos veces con `pipeline/salida/trazos-medidos.json` idéntico (`cmp`); la tabla `pipeline/salida/auditoria-vago.md` se copia a `docs/research/vago/auditoria-vago.md`; `node scripts/aplicar-trazos.ts` actualiza `src/data/trazos-vago.json` y escribe `docs/research/vago/resumen-trazos.md` (antes y después, regla y fuente por trazo); `npm test` en verde con `tests/trazos.test.ts` ajustado (ya no fija exactamente 4 propuestas ni el mapa de textos de `auditoria`; exige que los 28 trazos tengan `evidencia` es y en, `confianza` y `fuente`, que `propuesta` sea de la lista o `no_es_ramo` y que la tabla de la auditoría y el JSON coincidan trazo por trazo, columna `auditoria` incluida); `npm run check:modelo` en verde; `[manual]` el editor revisa en el PR la tabla nueva de la auditoría y `docs/research/vago/resumen-trazos.md` y aprueba (razón: contenido anatómico, AGENTS.md)
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: partida de la antigua T6; cubre R6.1 para trazos con `resumen-trazos.md`; único dueño de `docs/research/vago/auditoria-vago.md`.

## T8: Mostrar la evidencia al docente y dejarlo confirmar con un toque
- Purpose: que en modo revisión el docente vea, junto a cada trazo, la propuesta, la confianza, la evidencia y la fuente, y junto a cada marcador ubicado el método y la fuente de su posición (con el desacuerdo de fuentes si lo hay), y confirme con un solo toque ("Correcto" en el trazo ya existe y se conserva; se agrega "Correcto" para la posición de un marcador).
- Covers: R5.1, R5.2, R5.3
- Size: M
- Depends on: T4, T7
- Files: src/lib/trazos.ts, src/components/RevisionTrazo.tsx, src/components/Ficha.tsx, src/i18n/es.json, src/i18n/en.json, tests/trazos.test.ts, tests/revision.test.ts, e2e/trazos-vago.spec.ts, e2e/marcadores.spec.ts
- Verify: `npm test -- tests/trazos.test.ts tests/revision.test.ts` (un lector nuevo en `src/lib/trazos.ts` devuelve `evidencia`, `confianza` y `fuente` de un trazo, y `null` o vacío para uno sin propuesta; una respuesta `{ campo: 'posicion', veredicto: 'correcto' }` sin `posicion` pasa `respuestaValida` y `propuestaDePosicion` sigue devolviendo null para ella). `npm run test:e2e -- e2e/trazos-vago.spec.ts e2e/marcadores.spec.ts`: (a) al abrir un trazo con propuesta se ven propuesta, confianza, evidencia y fuente en es, y en en al cambiar de idioma; (b) uno sin propuesta muestra la evidencia y "sin propuesta"; (c) en modo revisión, la ficha de un marcador `aproximada` con posición muestra en un bloque propio (`data-testid`) el método y la fuente de la posición en el idioma activo, junto al botón "Proponer posición", y el de Wernicke muestra la nota de desacuerdo; (d) "Correcto" en ese marcador guarda una respuesta `correcto` de campo `posicion` con un solo toque (sin abrir otro paso), y volver a pulsarlo la borra; (e) con una posición ya propuesta por el docente, "Correcto" no aparece y la propuesta no se pierde; (f) un marcador `sin_ubicar` sin posición no muestra "Correcto"; (g) "Correcto" en un trazo con propuesta sigue guardando `correcto` con un toque; los casos actuales de `e2e/trazos-vago.spec.ts` siguen en verde; `npm run check:i18n`; `npm run typecheck`
- Issue:
- Status: todo

### Decision log
- 2026-10-14 ronda 1: lector nuevo en `src/lib/trazos.ts`; "Correcto" de marcador con forma definida (clave compartida con "Proponer posición", no pisa una propuesta, se deshace); se aclara qué ya existe para no rehacerlo; no cambia `camposDeFicha`.
