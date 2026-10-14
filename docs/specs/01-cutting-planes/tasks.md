# Tasks: Planos de corte (F8)
Spec: docs/specs/01-cutting-planes/  |  Status: approved  |  Converged: 2026-10-13, 3 rounds

## T1: Crear la lógica pura de los cortes
- Purpose: tener en un solo módulo probado el rango del cerebro, la geometría de cada plano, el lado oculto, las etiquetas en mm y el vigilante de cuadros, para que el visor y el panel solo los usen.
- Covers: R1.2, R1.4, R1.5, R1.6, R1.7, R2.1, R4.3, R8.2
- Size: M
- Depends on: none
- Files: src/lib/cortes.ts, tests/cortes.test.ts, src/i18n/es.json, src/i18n/en.json
- Verify: `npm test -- tests/cortes.test.ts`; `npm run check:i18n`
- Issue: #33
- Status: done

### Decision log
- Ronda 1: keep. Nota del revisor: las cajas del GLB están en metros y el rango del deslizador en mm enteros; las pruebas fijan la conversión.
- 2026-10-13: etiqueta sagital "12 mm a la izquierda", rango con piso simétrico desde el centro y cruce estricto en piezasCruzadas (RESOLVED), because son los valores por defecto del plan y ningún requisito pide otra cosa. Tier B. Outcome: reviews pass after 0 kickbacks, PR #54.

## T2: Agregar el estado de cortes al store
- Purpose: que el store guarde los tres planos, el fantasma y el relleno apagado; que activar el primer corte arme el cerebro y bloquee explosión, inventario y Separar (solo la guarda del store; los controles deshabilitados con texto son de T9); y que quitar los cortes lo rehabilite, sin mover ninguna pieza.
- Covers: R1.3, R1.6, R1.8, R2.2, R2.4, R2.5, R2.6, R5.1
- Size: M
- Depends on: T1
- Files: src/store/useAtlas.ts, tests/store.test.ts
- Verify: `npm test -- tests/store.test.ts` con casos nuevos que fallan antes del cambio: estado inicial con tres planos inactivos y `fantasmaCorte` y `rellenoApagado` en false (R5.1); `setCorte` activa un plano en 0 mm (R1.3) y respeta `invertido` (R1.6); `mm` fuera del rango de `rangoCerebro` se ajusta al borde; activar el primer plano con explosión y piezas separadas deja `explosion=0`, `separadas={}` e `inventario=false` en una sola actualización (R2.2); con un corte activo `setExplosion` y `separar` no cambian nada, y tras `quitarCortes()` o desactivar el último plano vuelven a funcionar (R1.8, R2.4); el objetivo de cada pieza es igual antes de activar y después de quitar los cortes (R2.5); `ocultas` y `aislar` no cambian al activar ni al quitar cortes (R2.6); `setFantasmaCorte` y `apagarRelleno` cambian sus campos y `apagarRelleno` es idempotente
- Issue: #34
- Status: done

### Decision log
- Ronda 1: rewrite. Se nombran `fantasmaCorte`, `rellenoApagado` y sus acciones (los usan T4, T7 y T8) y los casos de prueba.
- Ronda 2: keep.
- 2026-10-13: al reactivar un plano se conserva invertido, quitarCortes() no apaga el fantasma y Mostrar todo no quita los cortes (RESOLVED), because son los valores por defecto del plan y R2.6 trata los cortes como independientes. Tier B. Outcome: reviews pass after 1 kickback, PR #70.

## T3: Generar y verificar la lista de mallas cerradas
- Purpose: saber qué piezas del encéfalo se pueden rellenar, medido en el GLB, y que `check:modelo` falle si la lista deja de coincidir con las mallas sin bordes abiertos.
- Covers: R3.2
- Size: M
- Depends on: none
- Files: scripts/lib/mallas.ts, scripts/mallas-cerradas.ts, scripts/check-modelo.ts, src/config/mallas-cerradas.json, tests/mallas-cerradas.test.ts
- Verify: `npm test -- tests/mallas-cerradas.test.ts` (malla sintética cerrada da cerrada; una con un hueco o un triángulo suelto da abierta; vértices con la misma posición a 6 decimales se sueldan; la comparación reporta una malla que falta, una que sobra y una listada que no existe en el GLB); `node scripts/mallas-cerradas.ts` escribe `src/config/mallas-cerradas.json` ordenado, con 191 nombres sobre 253 mallas medidas (piezas de estudio bajo `g-brain` en `src/data/arbol.json`, leído con readFileSync, sin `#toque` ni vago); `npm run check:modelo` pasa con la lista generada y sale con código 1, nombrando la malla, si recibe por argumento una lista a la que se le quitó o se le agregó una malla
- Issue: #35
- Status: done

### Decision log
- Ronda 1: rewrite. Pasa a M, con módulo puro y prueba propia. Sin script nuevo en package.json, para no tocar ese archivo; se corre con `node`, como los demás scripts.
- Ronda 2: keep.
- 2026-10-13: lista como arreglo plano ordenado, solo las aristas de exactamente un triángulo son borde y una primitiva que no es TRIANGLES deja la malla abierta (RESOLVED), because son los valores conservadores del plan y dan las 191 de 253 del ADR 0011. Tier B. Outcome: reviews pass after 1 kickback, PR #57.

## T4: Recortar el encéfalo en el visor
- Purpose: que los planos del store corten solo las piezas del encéfalo (el vago y los órganos de referencia quedan enteros), con fantasma opcional del lado oculto y sin poder tocar lo oculto, junto al recorrido del vago. La lógica que se prueba (planos por pieza, fantasma, descarte de impactos del lado oculto) vive en `src/components/recorte.ts`, para probarla sin montar el Canvas. Helpers DEV en `src/main.tsx`: `window.__cortes.planosDe(pieza)` (cuántos `clippingPlanes` tiene el material visible de la pieza, 0 si ninguno), `window.__cortes.fantasmas()` (ids de piezas con malla de fantasma visible) y `window.__puntoCorte(pieza)` (punto de pantalla sobre la cara del corte de la pieza).
- Covers: R1.4, R2.1, R2.5, R2.6, R4.3, R5.2, R5.3, R8.3, R9.1
- Size: M
- Depends on: T1, T2
- Files: src/components/recorte.ts, src/components/Visor.tsx, src/main.tsx, tests/cortes-visor.test.ts, e2e/cortes-visor.spec.ts
- Verify: `npm test -- tests/cortes-visor.test.ts` con casos que fallan antes de la tarea: (a) los planos por pieza son `PLANOS_CORTE` solo para piezas del encéfalo con cortes activos, nunca para el vago ni los órganos (R2.1); (b) sin planos activos son `null` y no se monta ninguna malla extra (R8.3); (c) la opacidad del fantasma es 0,25 o menos y, con un solo plano activo, el fantasma muestra solo el lado oculto de ese plano (R5.2); (d) el fantasma usa `raycast` nulo (R5.3); (e) `raycastCorte` descarta un impacto del lado oculto de cualquier plano activo y conserva uno del lado visible, con uno, dos y tres planos (R4.3). `npm run test:e2e -- e2e/cortes-visor.spec.ts`: (1) con un plano activo, `__cortes.planosDe` da 3 para una pieza visible del encéfalo, 1 para el vago (el plano del recorrido) y 0 para un órgano de referencia; sin cortes, 0 para la pieza del encéfalo (R1.4, R2.1, R8.3); (2) con el fantasma activo, `__cortes.fantasmas()` incluye una pieza cruzada visible y no incluye una oculta ni una fuera del aislamiento (R2.6); (3) con cortes activos se inicia el recorrido del vago y los cortes siguen mientras el nervio se revela parada por parada (R9.1); (4) al quitar los cortes cada pieza queda en la posición de antes (R2.5); `npm run test:e2e -- e2e/atlas.spec.ts` sigue en verde
- Issue: #36
- Status: in-review

### Decision log
- Ronda 1: rewrite. La lógica probada sale de `Visor.tsx` a `recorte.ts`; se nombran los casos; se depende de T1 de forma explícita. Nota: el fantasma de aislar con contexto ya existe; el nuevo se llama `fantasmaCorte` en el código.
- Ronda 2: rewrite. Contrato de los helpers DEV y casos E2E que verifican el cableado en `Visor.tsx` (R1.4, R2.1, R8.3) y el fantasma con ocultas y aislamiento (R2.6).

## T5: Compartir y abrir cortes por enlace
- Purpose: que un docente mande un corte por enlace y la clase lo vea igual. `serializar` y `leer` entienden `corte=`, las entradas se validan contra el rango del cerebro, "Compartir" incluye los planos activos del store y `aplicarCortesEnlace(entradas)` (en `enlaces.ts`) los aplica con `setCorte` una sola vez al cargar el modelo, con el cerebro armado.
- Covers: R7.1, R7.2, R7.3, R7.4
- Size: S
- Depends on: T4
- Files: src/lib/enlaces.ts, tests/enlaces.test.ts, src/components/Pagina.tsx, e2e/cortes-enlace.spec.ts
- Verify: `npm test -- tests/enlaces.test.ts`: `serializar` emite `corte=coronal:12,axial:-8:inv` en orden sagital, coronal, axial y no emite `corte` sin planos activos (R7.1); `entradasDeCortes(cortes)` convierte el estado del store en entradas solo de planos activos (R7.1); `leer` y `validarCortes(entradas, rango)` ignoran solo la entrada mal escrita, la repetida (gana la primera) y la de fuera de rango (R7.3); un enlace sin `corte` se lee y se genera igual que hoy; con el store real, `aplicarCortesEnlace(entradas)` con `explosion=40` previa deja `explosion=0`, `separadas={}` y los planos en sus posiciones, y aplicarla dos veces deja el mismo estado (R7.4). `npm run test:e2e -- e2e/cortes-enlace.spec.ts`: abrir `?corte=coronal:12,axial:-8:inv` deja coronal y axial activos en 12 y -8 (axial invertido) según `window.__atlas.getState().cortes` una vez cargado el modelo (R7.2); un enlace con una entrada inválida y otra válida aplica solo la válida; con `corte=` y `explosion=40` la explosión queda en 0; con cortes activos, "Compartir" produce una URL con `corte=` y los mismos planos (R7.1)
- Issue: #37
- Status: todo

### Decision log
- Ronda 1: rewrite. `validarCortes` queda en `enlaces.ts`; R7.4 se prueba con el store real; se nombran los casos.
- Ronda 2: rewrite. Se cablea "Compartir" con los cortes (R7.1 de punta a punta) y se nombra `aplicarCortesEnlace` para probar R7.4 y la idempotencia.

## T6: Rellenar la cara del corte con caras traseras
- Purpose: que el corte de las piezas cerradas se vea sólido con su color, que tocarlo muestre el nombre y abra la ficha, y que no haya mallas de relleno sin cortes. La malla de relleno usa `raycastCorte` (de T4) y lleva `userData.relleno = true` y el `nombreMalla` de su pieza, para que el cursor y el toque la resuelvan como a la pieza. Amplía los helpers DEV: `window.__cortes.rellenos()` (cuántas mallas de relleno hay en la escena) y `window.__puntoCorte(pieza, 'oculto')` (punto de pantalla del lado oculto).
- Covers: R3.1, R3.5, R4.1, R4.2, R2.6, R8.3
- Size: M
- Depends on: T3, T4
- Files: src/components/recorte.ts, src/components/Visor.tsx, src/main.tsx, tests/cortes-visor.test.ts, e2e/cortes-relleno.spec.ts
- Verify: `npm test -- tests/cortes-visor.test.ts` con casos que fallan antes de la tarea: la función pura de `recorte.ts` que decide qué mallas se rellenan devuelve vacío sin planos activos (R8.3) y excluye piezas ocultas, fuera del aislamiento, mallas abiertas (fuera de `src/config/mallas-cerradas.json`), `#toque`, vago y órganos (R2.6). `npm run test:e2e -- e2e/cortes-relleno.spec.ts`: con un corte coronal en el tálamo, `__cortes.rellenos()` es mayor que 0; el tálamo, los ventrículos laterales y el núcleo caudado muestran su nombre al pasar el cursor en `__puntoCorte(pieza)` (R3.5, R4.1); tocar la cara abre la ficha de esa pieza (R4.2); tocar `__puntoCorte(pieza, 'oculto')` no selecciona nada; al quitar los cortes `__cortes.rellenos()` es 0 (R8.3); `npm run test:e2e -- e2e/atlas.spec.ts` sigue en verde; R3.1 `[manual]` (reason: el relleno se ve en la GPU; se revisa en los equipos de referencia y con capturas del prototipo) con capturas en #9
- Issue: #38
- Status: todo

### Decision log
- Ronda 1: rewrite. Se agregan la prueba unitaria de qué se rellena (R2.6, R8.3) y las tres piezas del criterio de F8 en el E2E.
- Ronda 2: rewrite. Helpers DEV para contar el relleno y apuntar al lado oculto; `src/main.tsx` entra en Files.

## T7: Dibujar el contorno y apagar el relleno cuando no da
- Purpose: que las piezas abiertas muestren el contorno del corte y que, si el relleno se apaga (promedio bajo 30 cuadros por segundo durante 5 s o un material que no compila), todas las piezas cortadas pasen a contorno sin errores en consola. La lógica que se prueba vive en `src/components/recorte.ts` (`segmentosDeCorte`, `piezasConContorno`, `alErrorShaderRelleno`, `alMuestraFps`); `ContornoCorte.tsx` y `Visor.tsx` solo la usan.
- Covers: R3.3, R3.4, R8.2
- Size: M
- Depends on: T6
- Files: src/components/recorte.ts, src/components/ContornoCorte.tsx, src/components/Visor.tsx, tests/cortes-visor.test.ts
- Verify: `npm test -- tests/cortes-visor.test.ts` con casos nuevos que fallan antes de la tarea: (a) `segmentosDeCorte` da los segmentos plano-malla correctos sobre una geometría abierta mínima con el BVH; (b) con relleno encendido, `piezasConContorno` cubre solo las piezas abiertas cruzadas; (c) con `rellenoApagado`, cubre todas las piezas cruzadas y la función de T6 que decide qué se rellena devuelve vacío; (d) `alErrorShaderRelleno` llama `apagarRelleno` y deja el resultado de (c), sin llamadas a `console.error`; (e) `alMuestraFps` con 10 muestras seguidas bajo 30 y cortes activos llama `apagarRelleno` una sola vez, y sin cortes no lo llama; (f) sin cortes no se monta `ContornoCorte` y al quitarlos se llama `dispose` en sus geometrías. `Visor.tsx` conecta `renderer.debug.onShaderError` y `MedidorCuadros` con esas funciones. R3.3 `[manual]` (reason: resultado visual en la GPU, sin oráculo automático fiable) con capturas en #9
- Issue: #39
- Status: todo

### Decision log
- Ronda 1: rewrite. Se nombran los dos disparadores del apagado, el cableado del vigilante y la limpieza. El aviso en el panel (R8.2) queda en T8.
- Ronda 2: rewrite. La lógica probada vive en `recorte.ts` con funciones nombradas, para probar el cableado sin montar el Canvas.

## T8: Panel de cortes en escritorio
- Purpose: abrir los cortes desde el riel, mover los planos con mouse o teclado, leer el aviso del cuerpo único, ver si el relleno se apagó y quitar los cortes, con un Escape que cierra solo el panel.
- Covers: R1.1, R1.5, R1.8, R1.9, R6.1, R6.4, R6.5, R6.6, R6.7, R8.2
- Size: M
- Depends on: T4, T5
- Files: src/components/PanelCortes.tsx, src/components/Pagina.tsx, src/components/Iconos.tsx, src/estilos.css, src/lib/teclado.ts, tests/teclado.test.ts, src/i18n/es.json, src/i18n/en.json, e2e/cortes-panel.spec.ts
- Verify: `npm test -- tests/teclado.test.ts` (con el panel de cortes abierto, Escape cierra el panel antes de salir del aislamiento, también con el foco en un deslizador); `npm run test:e2e -- e2e/cortes-panel.spec.ts`: (1) el botón "Cortes" del riel abre y cierra el panel, con tres filas (interruptor y deslizador en cada una), "Invertir", "Fantasma" y "Quitar cortes" (R1.1, R6.1); (2) la etiqueta en mm con dirección cambia al mover el deslizador (R1.5); (3) las flechas mueven 1 mm y `aria-valuetext` anuncia el valor (R1.9); (4) "Quitar cortes" apaga los tres interruptores y deja el cerebro entero (R1.8); (5) el aviso del cuerpo único se ve con el panel abierto (R6.4); (6) Escape cierra el panel, los cortes siguen y una pieza aislada sigue aislada (R6.5); (7) con el modelo sin cargar o WebGL fallido, el botón "Cortes" queda deshabilitado (R6.6); (8) con `rellenoApagado` en true (vía `window.__atlas`), el panel muestra una vez el aviso de relleno apagado (R8.2); (9) siguen en verde los E2E existentes de Escape en la paleta y "si el modelo no carga..."; `npm run check:i18n` (R6.7)
- Issue: #40
- Status: todo

### Decision log
- Ronda 1: rewrite. Escape pasa por `teclado.ts`; se nombran los casos; el aviso de relleno apagado (R8.2) entra aquí; depende de T5 para no chocar en `Pagina.tsx`.
- Ronda 2: keep (el revisor pedía agregar R6.7 a Covers, pero ya estaba).

## T9: Cortes en celular y controles bloqueados mientras hay cortes
- Purpose: usar los cortes en el celular sin tapar nada, y ver en escritorio y en celular por qué la explosión, el inventario y Separar no están disponibles mientras haya cortes.
- Covers: R2.3, R6.2, R6.3, R6.6
- Size: M
- Depends on: T8
- Files: src/components/PanelCortes.tsx, src/components/Pagina.tsx, src/components/BarraFragmentar.tsx, src/components/Ficha.tsx, src/estilos.css, src/i18n/es.json, src/i18n/en.json, e2e/cortes-movil.spec.ts
- Verify: `npm run test:e2e -- e2e/cortes-movil.spec.ts`; `npm run check:i18n`. Casos: (1) en celular (390 x 844), sin riel, el botón de cortes del encabezado, junto a la lupa, abre un cajón inferior; cerrado está `inert`; abierto recibe el foco; Escape lo cierra conservando los cortes; con el cajón y la ficha abiertos, las cajas del cajón, `.dock`, la brújula y la ficha no se intersecan y el cajón cabe en la pantalla (R6.2, R6.3); (2) en celular, con el modelo sin cargar, el botón de cortes está deshabilitado (R6.6); (3) en escritorio, con el panel abierto, su caja no se interseca con `.dock`, la brújula ni la ficha (R6.3); (4) en escritorio y en celular, con un plano activo, el deslizador de explosión, "Reensamblar" y "Separar" están `disabled` y se ve "Se desactivan mientras haya cortes"; con "Quitar cortes" se habilitan de nuevo y el texto desaparece (R2.3)
- Issue: #41
- Status: todo

### Decision log
- Ronda 1: rewrite. Se agregan el caso de escritorio de R6.3, la reactivación de R2.3, check:i18n y el botón deshabilitado en celular (R6.6).
- Ronda 2: keep.

## T10: Medir los cortes en los equipos de referencia
- Purpose: confirmar con datos que tres planos con relleno van a 30 cuadros por segundo o más donde estudian los estudiantes, con un procedimiento escrito para el editor que no dependa de activar los planos a mano dentro de la ventana de 10 s del panel de medición.
- Covers: R8.1
- Size: S
- Depends on: T5, T7, T9
- Files: docs/operacion.md, docs/progress.md
- Verify: R8.1 `[manual]` (reason: requiere los equipos físicos de referencia; los resultados se pegan en #6). Procedimiento en docs/operacion.md: en cada equipo (HP Iris Xe, iPhone 12 Pro Max, Android de gama baja), abrir `https://ragarciaga.github.io/3d_brain/es?medir=1&corte=sagital:0,coronal:0,axial:0`, copiar los resultados con "Copiar resultados" y pegarlos en #6 con una captura del panel de cortes. Se cumple si los tres equipos dan 30 cuadros por segundo o más de promedio y el panel no muestra el aviso de relleno apagado; si no, se anota en docs/progress.md y se abre el issue de F19
- Issue: #42
- Status: todo

### Decision log
- Ronda 1: rewrite. Procedimiento por enlace (depende de T5) y verificación de que el relleno no se apagó durante la medición.
- Ronda 2: keep.

