# Tasks: Planos de corte (F8)
Spec: docs/specs/01-cutting-planes/  |  Status: draft  |  Converged: 2026-10-13, 0 rounds

## T1: Crear la lógica pura de los cortes
- Purpose: tener en un solo módulo probado el rango del cerebro, la geometría de cada plano, el lado oculto, las etiquetas en mm y el vigilante de cuadros, para que el visor y el panel solo los usen.
- Covers: R1.2, R1.4, R1.5, R1.6, R1.7, R2.1, R4.3, R8.2
- Size: M
- Depends on: none
- Files: src/lib/cortes.ts, tests/cortes.test.ts, src/i18n/es.json, src/i18n/en.json
- Verify: `npm test -- tests/cortes.test.ts`; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T2: Agregar el estado de cortes al store
- Purpose: que activar un corte arme el cerebro, bloquee explosión e inventario y se pueda quitar, sin mover ninguna pieza.
- Covers: R1.3, R1.8, R2.2, R2.4, R2.5, R2.6, R5.1
- Size: M
- Depends on: T1
- Files: src/store/useAtlas.ts, tests/store.test.ts
- Verify: `npm test -- tests/store.test.ts`
- Issue:
- Status: todo

### Decision log

## T3: Generar y verificar la lista de mallas cerradas
- Purpose: saber qué piezas del encéfalo se pueden rellenar, medido en el GLB y vigilado por check:modelo.
- Covers: R3.2
- Size: S
- Depends on: none
- Files: scripts/mallas-cerradas.ts, src/config/mallas-cerradas.json, scripts/check-modelo.ts, package.json
- Verify: `npm run check:modelo` falla si se quita una malla de la lista y pasa con la lista generada
- Issue:
- Status: todo

### Decision log

## T4: Recortar el encéfalo en el visor
- Purpose: que los planos del store corten solo el cerebro, con fantasma opcional y sin poder tocar lo oculto, junto al recorrido del vago.
- Covers: R1.4, R2.1, R2.5, R2.6, R4.3, R5.2, R5.3, R8.3, R9.1
- Size: M
- Depends on: T2
- Files: src/components/recorte.ts, src/components/Visor.tsx, src/main.tsx, tests/cortes-visor.test.ts, e2e/cortes-visor.spec.ts
- Verify: `npm test -- tests/cortes-visor.test.ts`; `npm run test:e2e -- e2e/cortes-visor.spec.ts` (recorrido del vago con cortes activos)
- Issue:
- Status: todo

### Decision log

## T5: Compartir y abrir cortes por enlace
- Purpose: que un docente mande un corte por enlace y la clase lo vea igual.
- Covers: R7.1, R7.2, R7.3, R7.4
- Size: S
- Depends on: T4
- Files: src/lib/enlaces.ts, tests/enlaces.test.ts, src/components/Pagina.tsx, e2e/cortes-enlace.spec.ts
- Verify: `npm test -- tests/enlaces.test.ts`; `npm run test:e2e -- e2e/cortes-enlace.spec.ts`
- Issue:
- Status: todo

### Decision log

## T6: Rellenar la cara del corte con caras traseras
- Purpose: que el corte de las piezas cerradas se vea sólido con su color y que tocarlo muestre el nombre y abra la ficha.
- Covers: R3.1, R3.5, R4.1, R4.2
- Size: M
- Depends on: T3, T4
- Files: src/components/Visor.tsx, e2e/cortes-relleno.spec.ts
- Verify: `npm run test:e2e -- e2e/cortes-relleno.spec.ts` (corte coronal en el tálamo con nombres, tocar la cara abre la ficha); R3.1 `[manual]` (reason: el relleno se ve en la GPU; se revisa en los equipos de referencia y con capturas del prototipo) con capturas en #9
- Issue:
- Status: todo

### Decision log

## T7: Dibujar el contorno y apagar el relleno cuando no da
- Purpose: que las piezas abiertas muestren el contorno del corte y que un equipo lento o sin soporte pase a contorno en todo sin errores.
- Covers: R3.3, R3.4, R8.2
- Size: M
- Depends on: T6
- Files: src/components/ContornoCorte.tsx, src/components/Visor.tsx, tests/cortes-visor.test.ts
- Verify: `npm test -- tests/cortes-visor.test.ts`; R3.3 `[manual]` (reason: resultado visual en la GPU, sin oráculo automático fiable) con capturas en #9
- Issue:
- Status: todo

### Decision log

## T8: Panel de cortes en escritorio
- Purpose: abrir los cortes desde el riel, mover los planos con mouse o teclado, leer el aviso del cuerpo único y quitarlos.
- Covers: R1.1, R1.5, R1.8, R1.9, R6.1, R6.4, R6.5, R6.6, R6.7
- Size: M
- Depends on: T4
- Files: src/components/PanelCortes.tsx, src/components/Pagina.tsx, src/components/Iconos.tsx, src/estilos.css, src/i18n/es.json, src/i18n/en.json, e2e/cortes-panel.spec.ts
- Verify: `npm run test:e2e -- e2e/cortes-panel.spec.ts`; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T9: Cortes en celular y controles bloqueados mientras hay cortes
- Purpose: usar los cortes en el celular sin tapar nada y ver por qué explosión y Separar no están disponibles.
- Covers: R2.3, R6.2, R6.3
- Size: M
- Depends on: T8
- Files: src/components/PanelCortes.tsx, src/components/Pagina.tsx, src/components/BarraFragmentar.tsx, src/components/Ficha.tsx, src/estilos.css, src/i18n/es.json, src/i18n/en.json, e2e/cortes-movil.spec.ts
- Verify: `npm run test:e2e -- e2e/cortes-movil.spec.ts` (celular 390 x 844, colisiones con explosión, brújula y ficha, controles deshabilitados con texto)
- Issue:
- Status: todo

### Decision log

## T10: Medir los cortes en los equipos de referencia
- Purpose: confirmar con datos que tres planos con relleno van a 30 cuadros por segundo o más donde estudian los estudiantes.
- Covers: R8.1
- Size: S
- Depends on: T7, T9
- Files: docs/progress.md
- Verify: R8.1 `[manual]` (reason: requiere los equipos físicos de referencia; los resultados se pegan en #6), con tres planos activos y `?medir=1`, resultados de los tres equipos pegados en #6 con 30 cuadros por segundo o más
- Issue:
- Status: todo

### Decision log
