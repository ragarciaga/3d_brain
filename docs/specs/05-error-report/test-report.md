<!-- rockbuilt:test-report -->
# Informe de pruebas: Reportar un error desde la ficha (F12)

Plan: [test-plan.md](test-plan.md)  |  Comando: `npm run test:e2e` (estas corridas: `npx playwright test e2e/reportar-error-flujos.spec.ts e2e/reportar-error.spec.ts`)  |  Estado: GREEN (E2E); objetivo cumple en todo lo observable, con una comprobación local pendiente (#254)

## Corrida 1: 2026-10-19 15:22
- Commit: 86a66d3  |  Rama: `rb/verify-error-report`
- Resultado: 24 de 24 pasaron, 0 fallaron, 0 intermitentes. Salida: "24 passed (7.7m)".
- Entorno: el `webServer` de Playwright levantó vite en el puerto 5342. Credenciales: ninguna. Datos: `src/data/estructuras.json` e i18n. Canal real protegido con `protegerCanalReal()`, código de prueba PRUEBA01. Toda navegación a github.com interceptada y abortada. Chromium en `/opt/pw-browsers/chromium`.

| Caso | Archivo:prueba | Resultado | Clase | Criterio |
|---|---|---|---|---|
| F1-H | e2e/reportar-error-flujos.spec.ts:138 | pasa (34,6 s) | | R1.1, R1.3 |
| F1-E1 | e2e/reportar-error-flujos.spec.ts:174 | pasa (23,0 s) | | R1.2 |
| F1-E2 | e2e/reportar-error-flujos.spec.ts:202 | pasa (15,8 s) | | R1.1, R1.4 |
| F2-H | e2e/reportar-error-flujos.spec.ts:247 | pasa (20,4 s) | | R2.1, R2.5, R4.3 |
| F2-E1 | e2e/reportar-error-flujos.spec.ts:311 | pasa (15,3 s) | | R2.4, R2.1 |
| F2-E2 | e2e/reportar-error-flujos.spec.ts:363 | pasa (16,2 s) | | R2.4, R4.3, R2.3 |
| F3-H | e2e/reportar-error-flujos.spec.ts:485 | pasa (6,0 s) | | R5.1 |
| F3-E1 | e2e/reportar-error-flujos.spec.ts:606 | pasa (41,5 s) | | R5.2 |
| F3-E2 | e2e/reportar-error-flujos.spec.ts:647 | pasa (19,8 s) | | R5.1, comportamiento a preservar (sin `r`) |
| 15 pruebas de las tareas | e2e/reportar-error.spec.ts | pasan (5,8 s a 25,8 s) | | R1.1 a R1.4, R2.x, R3.3, R4.2, R5.x |

### Fallas
Ninguna.

### Aserciones débiles y desvíos del plan
- F3-H tenía una espera fija de 1 s después de pulsar el correo, y ninguna prueba comprobaba que el botón quedara después del bloque de fuentes y la versión (R1.1). Se corrigieron antes de la corrida 2.
- F2-E2 no distingue si el tope de 1500 lo aplica `maxLength` o el corte en `onChange`; los dos cumplen R2.3.
- F2-H no comprueba `rel="noopener noreferrer"` del enlace de GitHub; es R3.1, `[unit]`, cubierto por las pruebas de T2.
- Desvíos del escritor, aceptados (más estrictos que el plan): F2-H no pulsa el correo (lo pulsa F3-H); F1-E2 llena el formulario antes de desplazar y exige que el diálogo de verdad se desplace; F2-E2 usa "€" x1500 con un control de 1500 "a" que sí cabe; F3-E2 logra `?r=` en la URL sin modo revisión abriendo la ficha fuera de `/revision`.
- Riesgo conocido: F3-H espera que Chromium informe la navegación `mailto:` como `GET <mailto> document`. Si el Chromium del CI no lo hace, falla con un mensaje claro y no por la app.

### Cambios desde la corrida anterior
Primera corrida.

## Corrida 2: 2026-10-19 15:35
- Commit: 9543dab  |  Rama: `rb/verify-error-report`
- Resultado: 24 de 24 pasaron, 0 fallaron, 0 intermitentes. Salida: "24 passed (6.4m)". La más lenta tardó 29,3 s (tope en CI: 180 s); cada prueba hace una carga en frío, salvo F1-E1, que hace dos.
- Entorno: el mismo de la corrida 1.

| Caso | Archivo:prueba | Resultado | Clase | Criterio |
|---|---|---|---|---|
| F1-H | e2e/reportar-error-flujos.spec.ts:138 | pasa (20,3 s) | | R1.1, R1.3 |
| F1-E1 | e2e/reportar-error-flujos.spec.ts:181 | pasa (14,6 s) | | R1.2 |
| F1-E2 | e2e/reportar-error-flujos.spec.ts:209 | pasa | | R1.1, R1.4 |
| F2-H | e2e/reportar-error-flujos.spec.ts:254 | pasa (18,8 s) | | R2.1, R2.5, R4.3 |
| F2-E1 | e2e/reportar-error-flujos.spec.ts:318 | pasa (15,9 s) | | R2.4, R2.1 |
| F2-E2 | e2e/reportar-error-flujos.spec.ts:370 | pasa (15,1 s) | | R2.4, R4.3, R2.3 |
| F3-H | e2e/reportar-error-flujos.spec.ts:492 | pasa (6,7 s) | | R5.1 |
| F3-E1 | e2e/reportar-error-flujos.spec.ts:617 | pasa (25,7 s) | | R5.2 |
| F3-E2 | e2e/reportar-error-flujos.spec.ts:658 | pasa (16,4 s) | | R5.1, comportamiento a preservar |
| 15 pruebas de las tareas | e2e/reportar-error.spec.ts | pasan (4,9 s a 29,3 s) | | R1.1 a R1.4, R2.x, R5.x, D1 |

### Fallas
Ninguna.

### Aserciones débiles y desvíos del plan
Ninguna nueva. Siguen las dos limitaciones menores de la corrida 1 (F2-E2 y `rel` en F2-H).

### Cambios desde la corrida anterior
- F3-H: la espera fija pasó a `expect.poll` sobre la petición `mailto:` más una ventana de silencio; la aserción estricta de que sea la única petición propia sigue igual. El archivo ya no tiene ningún `waitForTimeout`.
- F1-H: exige que el botón venga después de `details.ficha-fuentes` en el documento.
- Las dos correcciones se probaron fallando a propósito antes de restaurarlas.

## Goal
Auditoría de objetivo, ciega y sobre la app en marcha, 2026-10-19 (head de la app eb7f55f). Ninguna navegación a github.com ni a script.google.com llegó a su destino, no se creó ningún issue ni se envió ningún correo, y solo se usó un código de revisor inventado.

| Resultado esperado | Veredicto | Evidencia |
|---|---|---|
| G1. Una estudiante en el celular (390 px), en es y en en, encuentra "Reportar un error" al pie de la ficha y lo deja listo en menos de un minuto, sin que nada fijo tape el formulario | cumple | En 390 x 844 con toques: el botón está al pie, debajo de "Fuentes (4)"; el diálogo se desplaza y "Abrir en GitHub", "Enviar por correo" y "Cerrar" quedan visibles y sin tapar; sin desborde horizontal |
| G2. Con cuenta de GitHub llega al formulario de issue ya lleno, del tipo correcto, en una pestaña nueva y sin datos de más | cumple en la app; GitHub, comprobación local (#254) | `target=_blank`, `rel="noopener noreferrer"`, `window.opener` nulo; cada tipo abre su plantilla; con `?zzsecreto=...&vista=lateral#fraghash` en la URL de la página, nada de eso aparece en el enlace; `# & " ' % + = ? \n áéíóú ñ <b>` y un emoji llegan intactos al decodificar |
| G3. Sin cuenta de GitHub reporta por correo: asunto y cuerpo llevan todo y la dirección se ve como texto | cumple | Asunto `[Maysa Brain] Enlace roto: hippocampus (es, versión 0.2.0)` y su par en inglés; el cuerpo trae estructura, idioma, versión, parte y la descripción intacta; "o escribe a info@maysasp.com" como texto |
| G4. Un texto con muchos emojis no rompe el reporte: GitHub se desactiva con un aviso y queda el correo | cumple | Con 650 emojis o más, "Abrir en GitHub" queda desactivado con "El texto es muy largo para abrirlo en GitHub. Acórtalo o envíalo por correo."; el correo sigue activo; el enlace más largo que aún se activó mide 7653 |
| G5. El formulario evita reportes vacíos y dice qué falta; tipo, parte con las opciones de la ficha y General por omisión, descripción de hasta 1500 con contador | cumple | Los dos botones desactivados con el motivo exacto en cada combinación; 1600 caracteres pegados quedan en 1500 ("1500 / 1500"); las partes cambian según la ficha (el hipocampo sin sinónimos, la sustancia gris periacueductal con "Otros nombres" y tres relevancias) |
| G6. La app no guarda ni envía nada, y al cerrar el borrador se pierde | cumple | Almacenes iguales antes y después (solo `atlas:aviso-visto`); ninguna petición HTTP propia con el diálogo abierto; al reabrir, todo vacío y en General; foco al título al abrir y de vuelta al botón al cerrar |
| G7. El docente revisor no ve una segunda vía de reporte | cumple | Con `/es/revision?r=<código inventado>` y con el código recordado, 0 botones; en un contexto nuevo sin código, 1 |
| G8. Todo el flujo es bilingüe y Privacidad explica el reporte | cumple | En inglés todos los textos del botón, el diálogo, el asunto, el cuerpo y el título salen en inglés; /es/privacidad y /en/privacy dicen que el reporte por GitHub es público, que el correo llega a info@maysasp.com y que la app no guarda ninguno |
| G9. El editor recibe cada reporte clasificado por tipo, con estructura, idioma, versión y parte | cumple en lo observable; comprobación local (#254) | Las cuatro plantillas son bilingües, sus ids coinciden con los parámetros del enlace y cada una trae su etiqueta; las cuatro etiquetas `reporte:*` existen en el repositorio (comprobado por la API el 2026-10-19). Falta ver que GitHub prellene el formulario con la etiqueta, que pide una sesión de GitHub |

Otras notas de la auditoría (sin tarea):
- R1.1 dice "junto a la versión": en una ficha normal la versión está dentro del bloque "Fuentes", que viene cerrado, justo encima del botón; con el bloque cerrado no se ve. La versión sí viaja en el enlace y en el correo. Lo decide el editor.
- Ninguna de las 236 entradas carece de ficha, así que el caso `sin-ficha` no lo puede ver un usuario hoy (lo cubre una prueba de T5 alterando los datos).
- En el correo la parte va con índice desde 0 (`fuente.1` es "Fuente 2" en la app), igual que en F24.
- En el celular, el anillo de foco del texto tapa un poco el contador.
