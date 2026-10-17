<!-- rockbuilt:test-report. Write in the project's docs language. Append a new Run section per run; never delete previous runs. -->
# Informe de pruebas: Planos de corte (F8)

Plan: [test-plan.md](test-plan.md)  |  Comando: `npm run test:e2e`  |  Estado: GREEN

## Corrida 1: 2026-10-17
- Commit: eb1054d  |  Rama: rb/verify-cutting-planes
- Resultado: 28/28 pasan, 0 fallan, 0 intermitentes (`28 passed (12.0m)`, 1 worker, en la nube con el Chromium de `/opt/pw-browsers`).
- Entorno: la app respondía (servidor de desarrollo del worktree), credenciales no aplica (app pública), datos del repositorio (`public/modelos/atlas.glb` y `src/data/*.json`, 287 piezas cargadas).
- Archivos: `e2e/cortes-flujos.spec.ts` (los 15 casos del plan) más las pruebas de cada tarea (`cortes-enlace`, `cortes-marcadores`, `cortes-movil`, `cortes-panel`, `cortes-relleno`, `cortes-visor`).

| Caso | Prueba | Resultado | Clase | Criterio |
|---|---|---|---|---|
| F1-H | e2e/cortes-flujos.spec.ts:170 | pasa | | R1.1, R1.5, R1.8, R1.9, R6.1, R6.4 |
| F1-E1 | e2e/cortes-flujos.spec.ts:227 | pasa | | R6.5 |
| F1-E2 | e2e/cortes-flujos.spec.ts:252 | pasa | | R6.6 |
| F2-H | e2e/cortes-flujos.spec.ts:282 | pasa | | R2.2, R2.3 |
| F2-E1 | e2e/cortes-flujos.spec.ts:314 | pasa | | R2.4, R1.8 |
| F2-E2 | e2e/cortes-flujos.spec.ts:336 | pasa | | R9.1 |
| F3-H | e2e/cortes-flujos.spec.ts:403 | pasa | | R3.5, R4.1, R4.2 |
| F3-E1 | e2e/cortes-flujos.spec.ts:425 | pasa | | R4.3 |
| F3-E2 | e2e/cortes-flujos.spec.ts:447 | pasa | | R5.2, R5.3 |
| F4-H | e2e/cortes-flujos.spec.ts:478 | pasa | | R7.1, R7.2 |
| F4-E1 | e2e/cortes-flujos.spec.ts:509 | pasa | | R7.3 |
| F4-E2 | e2e/cortes-flujos.spec.ts:534 | pasa | | R7.4 |
| F5-H | e2e/cortes-flujos.spec.ts:556 | pasa | | R6.2, R6.3 |
| F5-E1 | e2e/cortes-flujos.spec.ts:600 | pasa | | R6.5 (celular) |
| F5-E2 | e2e/cortes-flujos.spec.ts:624 | pasa | | R6.6 (celular) |
| Por tarea | cortes-enlace, cortes-marcadores, cortes-movil, cortes-panel, cortes-relleno, cortes-visor (13 pruebas) | pasan | | R2, R3.5, R4, R5.2, R6, R7, R9.1 |

### Fallos
Ninguno.

### Aserciones débiles encontradas
Ninguna prueba pasa sin poder fallar. Tres puntos menores para endurecer más adelante (no bloquean):
- F3-E2 (cortes-flujos.spec.ts:447): "se dibuja translúcido" se comprueba con la lista de piezas fantasma del visor, no con la opacidad del material. Endurecer: afirmar opacidad menor que 1 y `depthWrite` falso en las piezas fantasma del cerebro, como ya hace `cortes-marcadores.spec.ts`.
- F1-H y F1-E1: "se ve entero" y "el corte se sigue viendo" se comprueban por los planos de recorte de la pieza (0 o 3), no por píxeles. Es determinista y cubre los dos extremos; el dibujo en la GPU (R3.1, R3.3) es manual por el plan.
- Esperas fijas antes de afirmar que algo no pasó en `cortes-panel.spec.ts:150`, `cortes-movil.spec.ts:163`, `cortes-marcadores.spec.ts:151` y `:180` y `cortes-relleno.spec.ts:123`. Endurecer: cambiarlas por el ayudante `cuadros()` con control positivo, como en F3-E1.

### Cambios desde la corrida anterior
- Primera corrida.
