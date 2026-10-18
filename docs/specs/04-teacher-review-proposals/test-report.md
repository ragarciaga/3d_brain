<!-- rockbuilt:test-report -->
# Informe de pruebas: Propuestas para la sesión docente (marcadores y trazos del vago)

Plan: [test-plan.md](test-plan.md)  |  Comando: `npm run test:e2e` (esta corrida: `npx playwright test e2e/propuestas-docentes.spec.ts --workers=1`)  |  Estado: GREEN

## Corrida 1: 2026-10-18 06:15
- Commit: ddf52cb (el spec se subió sin cambios en 3143d04)  |  Rama: `rb/verify-teacher-review-proposals`
- Resultado: 8 de 9 pasaron, 0 fallaron, 0 intermitentes, 1 omitida con motivo. Salida: "1 skipped / 8 passed (1.7m)".
- Entorno: la app respondió (el `webServer` de Playwright arrancó vite). Credenciales: ninguna. Datos: los de `src/data/*.json`. Canal de retorno simulado con `page.route` y códigos de prueba PROPU001 a PROPU005. Chromium en `/opt/pw-browsers/chromium`.

| Caso | Archivo:prueba | Resultado | Clase | Criterio |
|---|---|---|---|---|
| F1-H | e2e/propuestas-docentes.spec.ts:204 | pasa (10,4 s) | | R3.1, R3.2 |
| F1-E1 | e2e/propuestas-docentes.spec.ts:235 | omitida | | comportamiento a preservar (centro de la pieza) |
| F1-E2 | e2e/propuestas-docentes.spec.ts:264 | pasa (8,0 s) | | R3.3, R3.1 |
| F2-H | e2e/propuestas-docentes.spec.ts:335 | pasa (33,4 s) | | R5.1, R5.3 |
| F2-E1 | e2e/propuestas-docentes.spec.ts:383 | pasa (5,5 s) | | R5.1 |
| F2-E2 | e2e/propuestas-docentes.spec.ts:409 | pasa (5,8 s) | | R5.1 |
| F3-H | e2e/propuestas-docentes.spec.ts:452 | pasa (16,4 s) | | R5.2, R5.3 |
| F3-E1 | e2e/propuestas-docentes.spec.ts:489 | pasa (12,1 s) | | R5.3 |
| F3-E2 | e2e/propuestas-docentes.spec.ts:536 | pasa (8,6 s) | | R5.2, R5.3 |

### Fallas
Ninguna.

### Aserciones débiles y desvíos del plan
- **F1-E1 omitida.** La prueba tiene un `test.skip` condicional: hoy ningún marcador de `src/data/marcadores.json` tiene ancla con `posicion: null`, y el plan dice que no se inventa uno. La prueba vuelve a correr sola si aparece un marcador así. El caso queda sin cobertura E2E mientras tanto. No es un pase.
- **F3-H, segundo toque.** El plan pedía que el canal recibiera el retiro. La app no manda ningún retiro: deshacer solo borra la respuesta en el equipo. La prueba comprueba lo que se puede observar, y fallaría si se quitara el deshacer: `aria-pressed` vuelve a falso, la respuesta sale del estado y el contador dice "0 respuestas". El primer toque sí se comprueba contra el canal: `guardar` con `c: 'posicion'`, `d: 'correcto'`, sin coordenadas, y "Guardado ✓". El hueco del canal es de la spec 03 y queda para tu decisión en #217.
- **F2.** El trazo se abre por "Qué revisar" y "Siguiente trazo" (F2-H) o con el mismo evento de selección que dispara un toque (F2-E1, F2-E2 y la reapertura tras recargar). No se probó un toque real sobre el nervio en 3D.
- Los `waitForTimeout(300)` de F1-H y F3-E1 son intervalos de muestreo dentro de `expect.poll`; no tapan un elemento ausente.

### Cambios desde la corrida anterior
Primera corrida.
