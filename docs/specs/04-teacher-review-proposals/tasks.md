# Tasks: Propuestas para la sesión docente (marcadores y trazos del vago)
Spec: docs/specs/04-teacher-review-proposals/  |  Status: draft  |  Converged: 2026-10-14, 0 rounds

## T1: Permitir una posición por lado y que el marcador siga a su ancla
- Purpose: que un marcador par se dibuje con un punto en cada lado y que, al separar las piezas, cada marcador con ancla se mueva con su pieza y vuelva exacto al armar.
- Covers: R3.1, R3.2, R3.3
- Size: M
- Depends on: none
- Files: src/data/tipos.ts, src/components/Visor.tsx, tests/datos.test.ts, e2e/marcadores.spec.ts
- Verify: `npm test -- tests/datos.test.ts` (el esquema acepta `posicion` como punto, como `{ l, r }` o `null`, y rechaza otra forma); `npm run test:e2e -- e2e/marcadores.spec.ts` con un marcador de prueba inyectado en desarrollo: (a) con `posicion: { l, r }` y ancla par se ven dos puntos, uno sobre cada pieza; (b) al separar al 60 % cada punto se desplaza lo mismo que su pieza ancla (diferencia de 0,1 mm o menos); (c) al reensamblar cada punto queda exactamente en su posición; (d) un marcador con ancla y sin posición sigue en el centro de su pieza como hoy; `npm run typecheck`
- Issue:
- Status: todo

### Decision log

## T2: Escribir las reglas y el ubicador de marcadores con su modelo sintético
- Purpose: tener las 26 reglas versionadas, cada una con su fuente verificada, y un ubicador que las aplica sobre mallas con nombre, probado sin Blender sobre un modelo sintético.
- Covers: R1.2, R1.3, R1.5, R1.6, R2.1, R2.2
- Size: M
- Depends on: none
- Files: pipeline/reglas-marcadores.yaml, pipeline/ubicar-marcadores.py, pipeline/geometria.py, pipeline/pruebas/probar_ubicar.py, pipeline/pruebas/modelo_sintetico_marcadores.py, tests/reglas-marcadores.test.ts
- Verify: `python3 pipeline/pruebas/probar_ubicar.py` (sin Blender: la geometría vive en `pipeline/geometria.py` sobre listas de vértices y `bpy` solo se usa para leer el modelo real): cada operación (`extremo`, `centro`, `polo`, `en_curva`, `superficie`, `plano_medio`, `entre`) da el punto esperado sobre el modelo sintético; `lado: ambos` da un punto por lado; una malla inexistente detiene nombrando marcador y malla sin escribir nada; una regla cuya fuente no está en `docs/research/marcadores/fuentes.md` deja el marcador `sin_ubicar` con motivo; toda salida es `aproximada`. `npm test -- tests/reglas-marcadores.test.ts`: las 26 reglas existen, una por marcador de `src/data/marcadores.json`, ninguna trae listas de tres números, cada clave de fuente aparece en la bibliografía de `fuentes.md` y cada `metodo` trae es y en sin guion largo
- Issue:
- Status: todo

### Decision log

## T3: Aplicar las propuestas a los datos de marcadores sin tocar nada más
- Purpose: que un script lleve las posiciones propuestas a `src/data/marcadores.json` con el método y la cita en es y en, deje constancia de los desacuerdos de fuentes y produzca el resumen antes y después para el PR.
- Covers: R2.3, R2.4, R6.2
- Size: S
- Depends on: none
- Files: scripts/aplicar-marcadores.ts, scripts/lib/marcadores.ts, tests/aplicar-marcadores.test.ts
- Verify: `npm test -- tests/aplicar-marcadores.test.ts` con propuestas de prueba: solo cambian `posicion`, `estado` (a `aproximada`), `fuente_ubicacion` y `ancla` cuando la propuesta la trae; `id`, `padre`, nombres y cualquier `validada` existente quedan iguales; `fuente_ubicacion` es y en tienen el método y la cita (autores, año, PMID o DOI); una propuesta marcada con desacuerdo cita las dos posturas; un `id` desconocido detiene sin escribir; un marcador sin propuesta queda como estaba con su motivo en el resumen; el resumen lista por marcador antes, después, regla y fuente
- Issue:
- Status: todo

### Decision log

## T4: Medir las posiciones reales y escribirlas en los marcadores
- Purpose: correr el ubicador sobre el modelo completo de Z-Anatomy en la nube y dejar los 26 marcadores con su propuesta, listos para que el editor los apruebe.
- Covers: R1.1, R1.4, R1.7, R6.1
- Size: M
- Depends on: T1, T2, T3
- Files: pipeline/salida/marcadores-propuestos.json, src/data/marcadores.json, tests/datos.test.ts, docs/research/marcadores/resumen-propuestas.md
- Verify: corrida real (`pip install -r pipeline/requirements.txt`, `python pipeline/descargar.py`, `python pipeline/ubicar-marcadores.py`) dos veces con salida idéntica (`cmp`); cada uno de los 26 marcadores tiene posición o motivo de `sin_ubicar`; cada posición queda a 5 mm o menos de una malla de su regla (lo comprueba el ubicador y falla si no); `node scripts/aplicar-marcadores.ts` actualiza `src/data/marcadores.json`; `npm test` en verde con `tests/datos.test.ts` ajustado (Wernicke ya no exige `posicion: null`; toda `aproximada` trae fuente es y en); `npm run check:modelo` en verde; `[manual]` el editor revisa en el PR `docs/research/marcadores/resumen-propuestas.md` (antes y después, regla y fuente por marcador) y aprueba (razón: contenido anatómico, AGENTS.md)
- Issue:
- Status: todo

### Decision log

## T5: Agregar a la auditoría del vago las reglas de raicillas, cuello y abdomen
- Purpose: que la auditoría deje para cada trazo su evidencia medida y, cuando la regla lo distingue, un ramo propuesto con confianza: raicillas detrás de la oliva, faríngeo frente a laríngeo superior, y ramos abdominales por su destino (hígado, cara anterior o posterior del estómago, aorta bajo el hiato).
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5
- Size: M
- Depends on: T2
- Files: pipeline/auditar-vago.py, pipeline/pruebas/probar_auditar.py, pipeline/pruebas/vago_sintetico.py, docs/research/vago/auditoria-vago.md
- Verify: `python3 pipeline/pruebas/probar_auditar.py` sin Blender sobre el vago sintético (usa `pipeline/geometria.py` de T2): un trazo corto que toca el bulbo detrás de `Olive` sale `no_es_ramo` con evidencia "raicilla"; uno que sale a 2 a 3,5 cm del foramen y termina en la cara posterior de `Laryngopharynx` sale ramo faríngeo; uno que termina junto a `Thyroid cartilage` sale laríngeo superior; abdominales: junto a `Liver` hepático, sobre la cara anterior de `Stomach` desde el vago izquierdo gástrico anterior, sobre la cara posterior desde el derecho gástrico posterior, hacia la aorta bajo el hiato celíaco; uno ambiguo queda sin propuesta y lo dice; cada trazo trae altura, largo, piezas cercanas a sus extremos, confianza y clave de fuente de `fuentes.md`; la salida `pipeline/salida/trazos-medidos.json` es determinista
- Issue:
- Status: todo

### Decision log

## T6: Escribir la evidencia y las propuestas en los trazos del vago
- Purpose: correr la auditoría con las reglas nuevas sobre el modelo real y llevar a `src/data/trazos-vago.json` la evidencia, la confianza, la fuente y la propuesta de cada uno de los 28 trazos.
- Covers: R4.1, R4.2, R4.3, R4.4, R4.5, R6.2
- Size: M
- Depends on: T5
- Files: src/data/tipos.ts, src/data/trazos-vago.json, scripts/aplicar-trazos.ts, tests/aplicar-trazos.test.ts, tests/trazos.test.ts, docs/research/vago/auditoria-vago.md
- Verify: `npm test -- tests/aplicar-trazos.test.ts tests/trazos.test.ts`: los 28 trazos tienen `evidencia` es y en, `confianza` (`alta`, `media`, `baja` o `null` sin propuesta) y `fuente`; `propuesta` solo es una opción de la lista de ramos o `no_es_ramo`; la tabla de la auditoría y el JSON coinciden trazo por trazo; ningún otro campo cambia; corrida real de `pipeline/auditar-vago.py` sobre Z-Anatomy reproducible (`cmp` en dos corridas); `npm test` y `npm run check:modelo` en verde; `[manual]` el editor aprueba en el PR la tabla nueva de la auditoría (razón: contenido anatómico, AGENTS.md)
- Issue:
- Status: todo

### Decision log

## T7: Mostrar la evidencia al docente y dejarlo confirmar con un toque
- Purpose: que en modo revisión el docente vea, junto a cada trazo y cada marcador, la propuesta, la confianza, la evidencia o el método, y la fuente, y confirme con "Correcto".
- Covers: R5.1, R5.2, R5.3
- Size: M
- Depends on: T4, T6
- Files: src/components/RevisionTrazo.tsx, src/components/Ficha.tsx, src/i18n/es.json, src/i18n/en.json, e2e/trazos-vago.spec.ts, e2e/marcadores.spec.ts
- Verify: `npm run test:e2e -- e2e/trazos-vago.spec.ts e2e/marcadores.spec.ts`: al abrir un trazo con propuesta se ven la propuesta, la confianza, la evidencia y la fuente en es, y en en al cambiar de idioma; uno sin propuesta muestra la evidencia y "sin propuesta"; la ficha de un marcador en modo revisión muestra el método y la fuente junto a "Proponer posición"; "Correcto" en un trazo con propuesta y en la posición de un marcador guarda una respuesta `correcto` con un solo toque (sin abrir ningún otro paso); los casos actuales de `e2e/trazos-vago.spec.ts` siguen en verde; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log
