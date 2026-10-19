<!-- rockbuilt:test-report -->
# Informe de pruebas: Propuestas para la sesión docente (marcadores y trazos del vago)

Plan: [test-plan.md](test-plan.md)  |  Comando: `npm run test:e2e` (esta corrida: `npx playwright test e2e/propuestas-docentes.spec.ts --workers=1`)  |  Estado: GREEN (E2E); objetivo parcial, ver Goal

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
- **F3-H, segundo toque.** El plan pedía que el canal recibiera el retiro. La app no manda ningún retiro: deshacer solo borra la respuesta en el equipo. La prueba comprueba lo que se puede observar, y fallaría si se quitara el deshacer: `aria-pressed` vuelve a falso, la respuesta sale del estado y el contador dice "0 respuestas". El primer toque sí se comprueba contra el canal: `guardar` con `c: 'posicion'`, `d: 'correcto'`, sin coordenadas, y "Guardado ✓". El hueco del canal era de la spec 03 y se cerró en #217: desde entonces la app manda el retiro cuando el script declara `canal` 2 o más (spec 03, R3.8 y R3.9), y lo cubre `e2e/revision-canal.spec.ts`; la descripción de arriba es la de esta verificación.
- **F2.** El trazo se abre por "Qué revisar" y "Siguiente trazo" (F2-H) o con el mismo evento de selección que dispara un toque (F2-E1, F2-E2 y la reapertura tras recargar). No se probó un toque real sobre el nervio en 3D.
- Los `waitForTimeout(300)` de F1-H y F3-E1 son intervalos de muestreo dentro de `expect.poll`; no tapan un elemento ausente.

### Cambios desde la corrida anterior
Primera corrida.

## Goal
Auditoría de objetivo, ciega y sobre la app en marcha, 2026-10-18 (head de la app 1a06f45). El canal real nunca se llamó.

| Resultado esperado | Veredicto | Evidencia |
|---|---|---|
| G1. El docente abre la ficha de un marcador, encuentra un punto razonado y lo confirma con un toque | cumple | "Locus caeruleo" en `/es/revision`: método y fuente con cita completa junto a "Correcto, la posición propuesta está bien". Un toque pasa de 0 a 1 respuesta y se conserva al recargar. Los 26 marcadores tienen posición (41 puntos dibujados) |
| G2. Método y fuente de la posición en el idioma activo | cumple | En español e inglés, incluida la nota de desacuerdo de Wernicke ("Sources disagree: ...") |
| G3. El docente revisa los 28 trazos confirmando o corrigiendo propuestas | parcial | 11 de 28 traen propuesta y se confirman con un toque (el contador baja de 28 a 27). 17 dicen "Sin propuesta de la auditoría", entre ellos los trazos 03 a 05 de cada vago a la altura del bulbo, con extremos a 2,4 a 5,5 mm de la oliva. Si son raicillas es anatomía: escalado en #219 |
| G4. Propuesta, confianza, evidencia y fuente del trazo en el idioma activo | parcial | Propuesta y confianza están traducidas. (1) La evidencia en español nombra las piezas con el nombre de malla en inglés ("Internal jugular vein.l", "Olive.l", "Stomach"). Es un hueco del spec, escalado en #219. (2) La fuente se ve solo como clave ("Bahadir2026"). R4.5 y R5.1 ya lo cubren, así que pasa a tarea T9 (#218) |
| G5. El estudiante ve los marcadores en su sitio aproximado, con el aviso | cumple | `/es/locus-caeruleo`: "El punto marca una posición aproximada, pendiente de validación docente", con método y fuente |
| G6. Al desarmar, cada marcador sigue a su pieza (un punto por lado) y vuelve exacto | cumple | Con la explosión al 100 %, el desplazamiento de cada marcador es igual al de su ancla (locus izquierdo = pons-l, accumbens derecho = caudate-nucleus-r). Los de línea media se quedan en x = 0. Tras "Reensamblar", los 41 puntos vuelven con diferencia [0,0,0] |

Otras notas de la auditoría (sin tarea):
- Con el locus caeruleo seleccionado y el cerebro armado, las dos etiquetas (una por lado) se montan una sobre otra.
- En la sesión de estudiante, la consola mostró 2 veces "Attempted to synchronously unmount a root while React was already rendering". La auditoría no pudo decir si es nuevo.
- Deshacer un veredicto no llega al canal (vale para todo el modo revisión, spec 03): escalado en #217 (cerrado en #217).
