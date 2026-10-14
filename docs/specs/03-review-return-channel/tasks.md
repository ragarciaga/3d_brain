# Tasks: Canal de retorno de la revisión docente por Apps Script
Spec: docs/specs/03-review-return-channel/  |  Status: draft  |  Converged: 2026-10-14, 0 rounds

## T1: Probar el canal real desde GitHub Pages con un script mínimo
- Purpose: comprobar, antes de construir lo demás, que una página publicada en GitHub Pages puede guardar en un Apps Script del editor y leer su respuesta (riesgo principal del diseño); la nube no alcanza `script.google.com`, así que la prueba la hace el editor en su navegador con pasos guiados.
- Covers: R10.2
- Size: S
- Depends on: none
- Files: apps-script/prueba-canal.js, public/probar-canal.html, docs/revision-docente.md, tests/apps-script-prueba.test.ts
- Verify: `npm test -- tests/apps-script-prueba.test.ts` (el script mínimo, cargado en Node con dobles de `ContentService` y `SpreadsheetApp`, responde JSON a `doGet` y a `doPost` con cuerpo `text/plain`); `[manual]` el editor sigue los pasos de `docs/revision-docente.md`, abre `https://ragarciaga.github.io/3d_brain/probar-canal.html` con la URL de su script y ve "Escritura: ok" y "Lectura: ok" con la fila escrita en su hoja (razón: la nube no alcanza `script.google.com`, proxy 403)
- Issue:
- Status: todo

### Decision log

## T2: Escribir el Apps Script completo con validación, padrón, ritmo y bloqueo
- Purpose: que el canal solo acepte revisiones válidas de códigos del padrón, escriba cada respuesta en el formato que el importador ya lee, guarde la autorización y devuelva a cada código solo lo suyo.
- Covers: R2.3, R4.3, R6.1, R6.2, R6.3, R6.4, R6.5
- Size: M
- Depends on: T1
- Files: apps-script/Codigo.js, tests/apps-script.test.ts, tests/fixtures/apps-script/dobles.ts
- Verify: `npm test -- tests/apps-script.test.ts` con `apps-script/Codigo.js` cargado en Node y dobles de `SpreadsheetApp`, `CacheService`, `LockService` y `ContentService`: (a) código fuera del padrón o inactivo: `codigo_no_activo` y ninguna fila; (b) cuerpo de más de 64 KB o carga que no cumple `v:2`: rechazo sin filas, con los mismos casos hostiles de `tests/revisiones.test.ts`; (c) la petición 121 de un código en un minuto: `demasiadas_peticiones`; (d) `guardar` escribe en `Respuestas` la fecha de recepción en la columna A, el código en B, los ids en C y la carga como texto en D, y responde las claves `estructura|campo|idioma|fecha` recibidas; (e) `autorizar` escribe código, fecha, versión y vago en `Autorizaciones`; (f) `leer` devuelve solo las respuestas de ese código (la última por clave) y su última autorización; (g) el archivo no contiene códigos con el formato del padrón, nombres ni correos
- Issue:
- Status: todo

### Decision log

## T3: Llevar la fecha en la carga v:2 y leer la hoja en el importador
- Purpose: que cada respuesta viaje con su fecha para confirmar por versión y quedarse con la más reciente, y que el importador lea la pestaña Respuestas exportada sin tocar su salida.
- Covers: R3.6, R8.1, R8.2
- Size: S
- Depends on: none
- Files: src/lib/revision.ts, scripts/lib/revisiones.ts, scripts/importar-revisiones.ts, tests/revision.test.ts, tests/revisiones.test.ts, tests/fixtures/revisiones/hoja-respuestas.csv
- Verify: `npm test -- tests/revision.test.ts tests/revisiones.test.ts`: `cargaRevisionV2` incluye `f` por respuesta; el importador acepta `v:2` con y sin `f`; un CSV con las columnas de la pestaña Respuestas produce los mismos resúmenes que el CSV equivalente del formulario; dos filas con la misma versión de una respuesta cuentan una sola; filas con la forma de Autorizaciones o Padrón se ignoran sin error; los casos hostiles existentes siguen en verde
- Issue:
- Status: todo

### Decision log

## T4: Crear la cola de guardado y el cliente del canal
- Purpose: tener la lógica de guardado automático probada sin red: espera de 3 s, reintentos crecientes, confirmación por versión, aviso de 10 min, fusión por fecha y validación de lo que vuelve del canal.
- Covers: R2.5, R3.3, R3.4, R4.2, R6.6
- Size: M
- Depends on: T3
- Files: src/lib/colaGuardado.ts, src/lib/canal.ts, src/lib/respaldo.ts, tests/colaGuardado.test.ts, tests/canal.test.ts
- Verify: `npm test -- tests/colaGuardado.test.ts tests/canal.test.ts`: `siguienteEspera` da 2000, 4000, 8000 y topa en 300000; una respuesta queda guardada solo si el canal devolvió su clave con la misma fecha, y una editada después vuelve a pendiente; `ofrecerRespaldo` es verdadero a los 10 min sin confirmación con pendientes y falso sin pendientes; la fusión local y canal se queda con la fecha más reciente; `leer` descarta respuestas que no pasan `respuestaValida` y conserva las demás; una autorización con versión distinta de `VERSION_AUTORIZACION` cuenta como faltante; `canal.ts` con `fetch` simulado manda `text/plain` y traduce cada error del contrato
- Issue:
- Status: todo

### Decision log

## T5: Validar el código del enlace al entrar
- Purpose: que un enlace mal formado no active el modo revisión ni quede guardado como código.
- Covers: R1.1, R1.2
- Size: S
- Depends on: none
- Files: src/components/Pagina.tsx, src/lib/persistencia.ts, src/i18n/es.json, src/i18n/en.json, tests/persistencia.test.ts, e2e/revision-canal.spec.ts
- Verify: `npm test -- tests/persistencia.test.ts` (un código que no cumple `REVISOR_VALIDO` no se recuerda); `npm run test:e2e -- e2e/revision-canal.spec.ts -g "enlace"`: `/es/revision?r=D03-ok` activa el modo sin pedir código; `/es/revision?r=<script>` muestra "Este enlace no es válido; pide uno nuevo al editor", no activa el modo y no deja nada en `localStorage['atlas:revisor']`; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T6: Conectar el canal y pedir la autorización una sola vez
- Purpose: que antes del primer guardado el docente autorice una sola vez, en cualquier equipo, sin dar nombre ni correo, y marque si puede revisar el vago.
- Covers: R2.1, R2.2, R2.4, R2.6
- Size: M
- Depends on: T2, T4
- Files: src/config/revision.ts, src/components/DialogoAutorizacion.tsx, src/components/PanelRevision.tsx, src/store/useAtlas.ts, src/i18n/es.json, src/i18n/en.json, e2e/revision-canal.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "autorización"` con el canal simulado por `page.route` sobre `urlCanal`: al marcar la primera respuesta aparece el diálogo con la casilla obligatoria y la del vago; "Continuar" está deshabilitado y no sale ninguna petición `autorizar` ni `guardar` hasta marcar la obligatoria; con una autorización vigente devuelta por `leer`, en un contexto de navegador nuevo, el diálogo no aparece; el diálogo no tiene campos de nombre, correo, profesión ni universidad; foco y Escape como los demás diálogos; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T7: Guardar solo, mostrar "Guardado ✓" y retirar los pasos de envío
- Purpose: que cada respuesta llegue sola al canal, que el docente vea cuándo quedó guardada, que nada se pierda al recargar y que desaparezcan los pasos de envío.
- Covers: R1.3, R3.1, R3.2, R3.5, R3.7
- Size: M
- Depends on: T6
- Files: src/components/PanelRevision.tsx, src/store/useAtlas.ts, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts, e2e/revision-canal.spec.ts, e2e/revision-dialogos.spec.ts, e2e/atlas.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "guardado"` con el canal simulado: una respuesta completa sale en menos de 3 s después del último cambio y, con la confirmación, el panel dice "Guardado ✓"; con el canal caído dice "Sin conexión: se guardará cuando vuelva" y, al recargar con el canal arriba, la pendiente se guarda sin tocar nada; `codigo_no_activo` muestra "Tu código no está activo; escribe al editor" y no se reintenta; no existen "Enviar revisión", "Enviar todo", "Abrir formulario" ni "Sí, lo envié" con el canal funcionando; las pruebas de `e2e/revision-dialogos.spec.ts` y `e2e/atlas.spec.ts` que fijaban el envío por formulario se reescriben para el canal y pasan; `npm test -- tests/i18n.test.ts`
- Issue:
- Status: todo

### Decision log

## T8: Traer lo guardado al abrir y retirar los botones de respaldo
- Purpose: que el docente siga en otro equipo y encuentre lo que ya respondió, sin archivos de respaldo.
- Covers: R4.1, R4.4
- Size: S
- Depends on: T7
- Files: src/components/PanelRevision.tsx, src/lib/respaldo.ts, src/i18n/es.json, src/i18n/en.json, e2e/revision-canal.spec.ts, e2e/respaldo.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "otro equipo"`: en un contexto nuevo con el mismo enlace y `leer` simulado con respuestas guardadas, se ven respondidas en menos de 5 s con la red limitada a 4G (`page.route` con demora de 1,5 s); no existen "Descargar respaldo" ni "Cargar respaldo"; `e2e/respaldo.spec.ts` conserva solo el caso del código recordado y pasa; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T9: Ofrecer el formulario de respaldo cuando el canal falla
- Purpose: que el docente tenga una salida si el canal no responde, y que sin canal configurado la revisión funcione como hoy.
- Covers: R7.1, R7.2
- Size: S
- Depends on: T7
- Files: src/components/PanelRevision.tsx, src/i18n/es.json, src/i18n/en.json, e2e/revision-canal.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "respaldo"`: con el canal caído y el reloj simulado (`page.clock`) adelantado 10 min con pendientes aparece "Enviar por formulario" y abre el flujo de partes de hoy; con `urlCanal` vacía el panel muestra "Enviar revisión" y "Enviar todo" como antes y no sale ninguna petición al canal
- Issue:
- Status: todo

### Decision log

## T10: Filtrar los trazos y las rutas del vago según la casilla
- Purpose: que cada docente vea solo lo que se siente capaz de revisar y pueda cambiarlo después.
- Covers: R5.1, R5.2, R5.3
- Size: S
- Depends on: T6
- Files: src/lib/prioridad.ts, src/components/PanelRevision.tsx, src/components/SeccionTrazos.tsx, src/components/Ficha.tsx, tests/prioridad.test.ts, e2e/revision-canal.spec.ts
- Verify: `npm test -- tests/prioridad.test.ts`: sin la casilla, `ordenDeRevision` no trae la sección `vago` ni los campos de rutas trazadas, y `avanceDeFicha` no los cuenta; con la casilla los trae. `npm run test:e2e -- e2e/revision-canal.spec.ts -g "vago"`: sin la casilla no aparecen "Trazos del vago" ni los recorridos trazados en "Qué revisar"; al marcarla en el menú Acciones sale una petición `autorizar` con `vago: true` y aparecen
- Issue:
- Status: todo

### Decision log

## T11: Mostrar "Revisado por un docente universitario" sin datos personales
- Purpose: que el estudiante sepa que una ficha fue revisada por un docente sin ver datos del revisor, y que el repositorio nunca guarde nombres.
- Covers: R9.1, R9.2, R9.3
- Size: S
- Depends on: none
- Files: src/components/Ficha.tsx, src/i18n/es.json, src/i18n/en.json, tests/datos.test.ts, e2e/atlas.spec.ts
- Verify: `npm test -- tests/datos.test.ts`: todo `revisado_por` de `src/data/estructuras.json` y de las rutas es `null` o un alias `D\d{2}`; `npm run test:e2e -- e2e/atlas.spec.ts -g "revisado por"` con una ficha verificada inyectada en la prueba: muestra "Revisado por un docente universitario" y la fecha, y el texto de la ficha no contiene el valor de `revisado_por`; `npm run check:i18n`
- Issue:
- Status: todo

### Decision log

## T12: Poner al día las guías del docente y del editor
- Purpose: que el docente no vea pasos de registro ni de envío y que el editor sepa montar el script, cuidar el padrón y atender una solicitud de supresión de datos.
- Covers: R10.1, R10.2, R10.3
- Size: S
- Depends on: T7, T8
- Files: src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts, docs/guia-docentes.md, docs/revision-docente.md
- Verify: `npm test -- tests/i18n.test.ts`: la guía "Cómo revisar" (es y en) no menciona registro, "Enviar todo" ni "Sí, lo envié" y sí "Guardado"; `docs/guia-docentes.md` no contiene "Registrarme" ni enlaces a formularios; `[manual]` el editor confirma que `docs/revision-docente.md` trae los pasos de montaje para Windows, las tres pestañas de la hoja y la supresión de datos, y que AGENTS.md, SPEC.md y el ADR 0012 del PR del spec dicen lo que se hace (razón: texto de contrato y montaje en la cuenta del editor, sin oráculo automático)
- Issue:
- Status: todo

### Decision log
