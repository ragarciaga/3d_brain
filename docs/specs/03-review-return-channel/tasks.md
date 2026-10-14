# Tasks: Canal de retorno de la revisión docente por Apps Script
Spec: docs/specs/03-review-return-channel/  |  Status: approved  |  Converged: 2026-10-14, 3 rounds, not converged

## T1: Probar el canal real desde GitHub Pages con un script mínimo
- Purpose: comprobar, antes de construir lo demás, que una página publicada en GitHub Pages puede guardar en un Apps Script del editor y leer su respuesta (riesgo principal del diseño); la nube no alcanza `script.google.com`, así que la prueba la hace el editor en su navegador con pasos guiados, después de que la página esté publicada.
- Covers: R10.2
- Size: S
- Depends on: none
- Files: apps-script/prueba-canal.js, public/probar-canal.html, docs/revision-docente.md, tests/apps-script-prueba.test.ts
- Verify: `npm test -- tests/apps-script-prueba.test.ts` (el script mínimo, cargado en Node con dobles de `ContentService` y `SpreadsheetApp`, responde JSON a `doGet` y a `doPost` con cuerpo `text/plain`; `public/probar-canal.html` existe y distingue "Escritura: ok", "Escritura: falla", "Lectura: ok" y "Lectura: falla"); `[manual]` el editor, con la página ya publicada, sigue los pasos de `docs/revision-docente.md`, abre `https://ragarciaga.github.io/3d_brain/probar-canal.html` con la URL de su script y ve "Escritura: ok" y "Lectura: ok" con la fila escrita en su hoja (razón: la nube no alcanza `script.google.com`, proxy 403)
- Issue: #87
- Status: done

### Decision log
- Ronda 1: keep. El orquestador agrega los mensajes de falla explícitos (el plan B del diseño depende de distinguir escritura de lectura) y que la prueba manual va después del despliegue.
- Ronda 2: keep. El script lleva `/* global ... */` y `/* exported doGet, doPost */` (o una entrada en `eslint.config.js`) para que `npm run lint` pase.
- 2026-10-14: script mínimo y página de prueba; T2 y T4 se construyen sin esperar la prueba manual (pedido del editor); si sale plan B se reabren. Tier C. Outcome: reviews pass after 1 kickback, PR #111.

## T2: Escribir el Apps Script completo con validación, padrón, ritmo y bloqueo
- Purpose: que el canal solo acepte revisiones válidas de códigos del padrón, escriba cada respuesta en el formato que el importador ya lee, guarde la autorización y devuelva a cada código solo lo suyo.
- Covers: R2.3, R4.3, R6.1, R6.2, R6.3, R6.4, R6.5
- Size: M
- Depends on: T1, T3
- Files: apps-script/Codigo.js, tests/apps-script.test.ts, tests/fixtures/apps-script/dobles.ts
- Verify: `npm test -- tests/apps-script.test.ts` con `apps-script/Codigo.js` cargado en Node y dobles de `SpreadsheetApp` (hoja con las pestañas `Respuestas`, `Autorizaciones` y `Padrón`), `CacheService`, `LockService` y `ContentService`: (a) `guardar`, `autorizar` y `leer` con un código fuera del padrón o inactivo responden `{ok:false,error:'codigo_no_activo'}` y no escriben ninguna fila; (b) un cuerpo de más de 64 KB responde `demasiado_grande` y una carga que no cumple `v:2` responde `formato`, ambos sin filas; los casos de `respuestaValida` y `fechaValida` (`src/lib/revision.ts`) y los hostiles de `tests/revisiones.test.ts` se pasan por `it.each` al script y a las funciones de la app y los dos dan el mismo veredicto; `autorizar` con `version` o `vago` malformados responde `formato`; (c) la petición 121 de un código en un minuto responde `demasiadas_peticiones` (en `guardar`, `autorizar` y `leer`) y la primera del minuto siguiente, con el reloj del doble avanzado, vuelve a pasar; (d) la pestaña `Respuestas` tiene una fila de cabecera y `guardar` escribe la fecha de recepción en la columna A, el código en B, los ids en C y la carga en D con formato `@` (`setNumberFormat('@')`), y responde las claves `estructura|campo|idioma|fecha` recibidas; un código que empieza con `-` y una carga cuyo texto empieza con `=` quedan como texto y nunca como fórmula; (e) `autorizar` escribe código, fecha, versión y vago (sí/no) en `Autorizaciones`; (f) `leer` devuelve solo las respuestas de ese código (la última por clave) y su última autorización, nunca filas de otro código; (g) cada escritura toma `LockService` (espera hasta 10 s) y lo libera aunque falle, y si no obtiene el bloqueo responde `interno` sin filas; (h) el archivo no tiene coincidencias con `/[\w.+-]+@[\w-]+\.[\w.]+/`, con `/\bD\d{2}\b/` ni con ningún código del padrón de prueba del fixture
- Issue: #88
- Status: done

### Decision log
- Ronda 1: rewrite. Errores fijados por caso, padrón y ritmo en las tres acciones, bloqueo, cabecera de `Respuestas`, paridad con `fechaValida` de T3 (por eso depende de T3). `REVISOR_VALIDO` admite `-` inicial: se resuelve en el script escribiendo como texto, sin cambiar la regla del código.
- Ronda 2: keep. Para el implementador: globales de Apps Script declarados para `npm run lint`; la paridad usa solo la forma del id (`ID_VALIDO`), porque el script no puede conocer los ids reales (R6.5); los casos hostiles se sacan a un fixture compartido sin alterar los de T3.
- Ronda 3: keep.

## T3: Llevar la fecha en la carga v:2 y leer la hoja en el importador
- Purpose: que cada respuesta viaje con su fecha (`f`, validada como entrada externa) para confirmar por versión y quedarse con la más reciente, y que el importador lea la pestaña Respuestas exportada sin tocar su salida y sin contar como inválidas las filas de Autorizaciones y Padrón.
- Covers: R3.6, R8.1, R8.2
- Size: S
- Depends on: none
- Files: src/lib/revision.ts, scripts/lib/revisiones.ts, tests/revision.test.ts, tests/revisiones.test.ts, tests/fixtures/revisiones/hoja-respuestas.csv
- Verify: `npm test -- tests/revision.test.ts tests/revisiones.test.ts`: (a) `CLAVES_V2` gana `fecha: 'f'` y `cargaRevisionV2` emite `f` por respuesta solo si `fecha` no está vacía (una respuesta con `fecha: ''` sale sin `f`); se reescriben las aserciones que dejan de valer: la lista exacta de claves de `tests/revisiones.test.ts` ("CLAVES_V2 cubre todos los campos..."), el `toEqual` de las claves cortas de `tests/revision.test.ts` ("las claves cortas llevan cada campo opcional...") y el comentario de `CLAVES_V2`; los fixtures con `fecha: 'x'` (`base` y `marcadorCriterio` de `tests/revisiones.test.ts`) pasan a fechas ISO y la ida y vuelta de todos los campos usa fechas ISO para comprobar que la `fecha` original vuelve; (b) el importador acepta `v:2` con `f` (la ida y vuelta devuelve la `fecha` original) y sin `f` (queda `fecha: ''`, como hoy); (c) `fechaValida` (nueva, exportada de `src/lib/revision.ts`: texto de hasta 40 caracteres con `Date.parse` finito) se aplica a `f` dentro de `expandirV2`, y una fila con `f` de 41 caracteres, con `f` que no es texto o con `f` no parseable cuenta como inválida; (d) un CSV con cabecera y las columnas de la pestaña Respuestas (A fecha de recepción, B código, C ids, D carga) produce los mismos archivos de `importar` que el CSV equivalente del formulario (`tests/fixtures/revisiones/hoja-respuestas.csv`); (e) dos filas con la misma clave y la misma fecha cuentan una sola respuesta en `resumen.md`, y con fechas distintas queda la última fila; (f) filas con la forma de Autorizaciones (4 columnas: A cumple `REVISOR_VALIDO`, B fecha con `Date.parse` finito, C versión no vacía, D `sí` o `no`) y de Padrón (3 columnas: A cumple `REVISOR_VALIDO`, B alias que cumple `ALIAS_VALIDO`, C `sí` o `no`) mezcladas con las de Respuestas no suman a `envios` ni a `invalidas` y no aparecen en la salida, mientras una fila basura sin esa forma (4 columnas con D distinto de `sí`/`no`, o una fila sin celda `{"v":`) sigue contando como inválida; (g) los demás casos hostiles de `v:2` y `v:1` siguen en verde sin cambios
- Issue: #89
- Status: done

### Decision log
- Ronda 1: rewrite. `f` es entrada externa (regla `fechaValida`, la misma de `respaldo.ts`), regla explícita para no contar como inválidas las filas de otras pestañas y aserciones viejas que se reescriben.
- Ronda 2: rewrite. `f` solo si la fecha no está vacía, aserciones y fixtures concretos que se ajustan, forma exacta de las filas de Autorizaciones y Padrón; sale `scripts/importar-revisiones.ts` de `Files` (no cambia).
- Ronda 3: keep. El orquestador alinea el alias del Padrón con `ALIAS_VALIDO` del importador (`D` y 2 o 3 dígitos).
- 2026-10-14: fecha `f` validada con `fechaValida`; T2 escribe ISO en Autorizaciones; gana la última fila en orden de la hoja; solo `sí`/`no` exactos, porque así lo fija la tarea. Tier B. Outcome: reviews pass after 0 kickbacks, PR #110.

## T4: Crear la cola de guardado y el cliente del canal
- Purpose: tener la lógica de guardado automático probada sin red: espera de 3 s, reintentos crecientes, partición de lotes, confirmación por versión, aviso de 10 min, fusión por fecha y validación de lo que vuelve del canal; incluye las constantes `urlCanal` (vacía) y `VERSION_AUTORIZACION`.
- Covers: R2.5, R3.3, R3.4, R4.2, R6.6
- Size: M
- Depends on: T1, T3
- Files: src/config/revision.ts, src/lib/colaGuardado.ts, src/lib/canal.ts, src/lib/respaldo.ts, tests/colaGuardado.test.ts, tests/canal.test.ts
- Verify: `npm test -- tests/colaGuardado.test.ts tests/canal.test.ts`: `ESPERA_CANAL_MS` es 3000 (distinta de `ESPERA_GUARDADO_MS`); `siguienteEspera` da 2000, 4000, 8000 y topa en 300000, y tras `demasiadas_peticiones` la espera es 60000; una respuesta queda guardada solo si el canal devolvió su clave con la misma fecha, y una editada después vuelve a pendiente; `ofrecerRespaldo` es verdadero a los 10 min sin confirmación con pendientes y falso sin pendientes o antes de 10 min; el armado de lotes corta en 50 respuestas o 60 KB, y ante `formato` o `demasiado_grande` parte el lote y la respuesta que falla sola queda pendiente sin reintento; la fusión local y canal se queda con la fecha más reciente (en `respaldo.ts` solo se agrega o reusa la fusión; borrar `crearRespaldo` y `leerRespaldo` es de T8); `leer(codigo, idOk)` descarta respuestas que no pasan `respuestaValida` o `fechaValida` (ids inválidos, textos sobre el tope, campos extra) y conserva las demás; una autorización con versión distinta de `VERSION_AUTORIZACION`, o ausente, cuenta como faltante; `canal.ts` con `fetch` simulado manda el POST con `Content-Type: text/plain`, usa GET `?accion=leer&r=` para leer, traduce cada error del contrato (`codigo_no_activo`, `demasiado_grande`, `formato`, `demasiadas_peticiones`, `interno`) y trata red caída o tiempo agotado (10 s) como pendiente; el valor inicial de `urlCanal` en `src/config/revision.ts` es vacío (sin prueba que fije ese valor, porque T13 lo cambia)
- Issue: #90
- Status: done

### Decision log
- Ronda 1: rewrite. Constantes de configuración aquí (T6 solo agrega la costura de prueba), comportamientos de la tabla de errores del diseño, `leer` recibe `idOk`, y depende de T1 porque si la prueba real falla el diseño cambia.
- Ronda 2: keep. El orquestador quita la aserción permanente de `urlCanal` vacía, que chocaba con T13.
- Ronda 3: keep.

## T5: Validar el código del enlace al entrar
- Purpose: que un enlace mal formado, o un valor inválido ya guardado, no active el modo revisión ni quede guardado como código, en español y en inglés.
- Covers: R1.1, R1.2
- Size: S
- Depends on: none
- Files: src/components/Pagina.tsx, src/lib/persistencia.ts, src/i18n/es.json, src/i18n/en.json, tests/persistencia.test.ts, e2e/revision-canal.spec.ts
- Verify: `npm test -- tests/persistencia.test.ts`: `recordarRevisor` no guarda un código que no cumple `REVISOR_VALIDO` (vacío, 41 caracteres, `<script>`, con espacio) y sí guarda uno válido; `revisorRecordado` devuelve `null` si el valor guardado no cumple `REVISOR_VALIDO`. `npm run test:e2e -- e2e/revision-canal.spec.ts -g "enlace"`: `/es/revision?r=D03-ok` y `/en/revision?r=D03-ok` activan el modo sin pedir código; `/es/revision?r=<script>` muestra "Este enlace no es válido; pide uno nuevo al editor" y `/en/revision?r=<script>` su texto en inglés, y en ambos casos no se activa el modo y `localStorage['atlas:revisor']` queda vacío; con un código válido ya recordado, un `?r=` inválido muestra el mensaje, no activa el modo y no borra ni cambia el código recordado; `npm run check:i18n`
- Issue: #91
- Status: done

### Decision log
- Ronda 1: rewrite. Inglés, valor inválido ya guardado y enlace inválido con un código recordado. Crea `e2e/revision-canal.spec.ts`, que las demás tareas extienden.
- Ronda 2: keep.

## T6: Conectar el canal y pedir la autorización una sola vez
- Purpose: que antes del primer guardado el docente autorice una sola vez, en cualquier equipo, sin dar nombre ni correo, y marque si puede revisar el vago; el store queda con la autorización (incluido `vago`) y una acción para cambiarla; sin `urlCanal` configurada no aparece el diálogo.
- Covers: R2.1, R2.2, R2.4, R2.5, R2.6
- Size: M
- Depends on: T4, T5
- Files: src/config/revision.ts, src/components/DialogoAutorizacion.tsx, src/components/PanelRevision.tsx, src/store/useAtlas.ts, src/main.tsx, src/i18n/es.json, src/i18n/en.json, e2e/revision-canal.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "autorización"`. La prueba fija `urlCanal` con un gancho que solo existe en desarrollo (`import.meta.env.DEV`, como `window.__atlas` en `src/main.tsx`; fija o anula la URL, también antes de la primera carga con `addInitScript`; no entra en `npm run build` ni se activa por un parámetro de la URL) y simula el canal con `page.route` sobre esa URL: (a) al marcar la primera respuesta completa con `leer` sin autorización aparece el diálogo con la casilla obligatoria y la del vago; "Continuar" está deshabilitado y no sale ninguna petición `autorizar` ni `guardar` hasta marcar la obligatoria; (b) con la obligatoria y la del vago marcadas, "Continuar" manda `autorizar` con `r` igual al código, `version` igual a `VERSION_AUTORIZACION` y `vago: true`, y sin la del vago `vago: false`; (c) Escape cierra el diálogo sin aceptar y sin enviar nada, el foco entra al diálogo y vuelve al elemento que lo abrió; (d) con una autorización vigente devuelta por `leer`, en un contexto de navegador nuevo, el diálogo no aparece, y con una autorización de otra versión aparece otra vez; (e) el diálogo no tiene campos de nombre, correo, profesión ni universidad (ningún `input` de texto ni `type=email`); (f) con `urlCanal` vacía el diálogo no aparece y no sale ninguna petición; (g) si `autorizar` falla (red caída o error del canal), el diálogo sigue abierto con "Sin conexión", la autorización no queda registrada y no sale ninguna petición `guardar`; `npm run check:i18n`
- Issue: #92
- Status: done

### Decision log
- Ronda 1: rewrite. Costura de prueba solo en desarrollo (la usan T7 a T10), casos de envío de `autorizar`, Escape y versión distinta; ya no depende de T2 (el e2e simula el canal) y sí de T5 (archivo e2e compartido). Llenar la URL real queda en T13.
- Ronda 2: keep. El orquestador agrega el caso (g) (falla de `autorizar` desde el diálogo, protege R2.3) y que la costura fija o anula la URL (la necesita T13). La lectura inicial (`leer`) se construye aquí; T8 usa sus respuestas.
- Ronda 3: keep. El orquestador precisa que la costura sirve antes de la primera carga (la necesita T13).

## T7: Guardar solo, mostrar "Guardado ✓" y retirar los pasos de envío cuando hay canal
- Purpose: que, con el canal configurado, cada respuesta llegue sola al canal, que el docente vea cuándo quedó guardada, que nada se pierda al recargar y que no aparezcan los pasos de envío por formulario; con `urlCanal` vacía el flujo de formulario de hoy queda intacto, incluido el enlace al registro y las claves de i18n del envío.
- Covers: R1.3, R3.1, R3.2, R3.5, R3.7
- Size: M
- Depends on: T6
- Files: src/components/PanelRevision.tsx, src/store/useAtlas.ts, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts, e2e/revision-canal.spec.ts, e2e/revision-dialogos.spec.ts, e2e/atlas.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "guardado"` con el canal simulado por `page.route` sobre `urlCanal` (costura de T6): una respuesta completa sale en menos de 3 s después del último cambio, el panel dice "Guardando..." mientras espera y "Guardado ✓" con la confirmación de la misma clave y fecha; con el canal caído dice "Sin conexión: se guardará cuando vuelva" y, al recargar con el canal arriba, la pendiente se guarda sin tocar nada; con `codigo_no_activo` muestra "Tu código no está activo; escribe al editor", no sale ninguna petición `guardar` posterior y la respuesta sigue en IndexedDB; con el canal configurado no existen "Enviar revisión", "Enviar todo", "Abrir formulario" ni "Sí, lo envié". `npm run test:e2e -- e2e/revision-dialogos.spec.ts e2e/atlas.spec.ts` pasan: las pruebas del envío por formulario siguen verdes con `urlCanal` vacía y solo se reescriben las que mezclan formulario y canal. `npm test -- tests/i18n.test.ts`; `npm run check:i18n`
- Issue: #93
- Status: done

### Decision log
- Ronda 1: rewrite. Los pasos de envío se retiran solo con canal (R3.7 y R7.2), "Guardando...", `codigo_no_activo` sin reintento y las pruebas del formulario se conservan para el modo sin canal.
- Ronda 2: keep. El e2e simula `leer` con una autorización vigente para que el diálogo de T6 no bloquee el primer guardado.

## T8: Traer lo guardado al abrir y retirar los botones de respaldo
- Purpose: que el docente siga en otro equipo y encuentre lo que ya respondió, sin archivos de respaldo: las respuestas que devuelve la lectura al abrir (la misma de T6) se fusionan con las locales por fecha más reciente y quedan marcadas como guardadas, así que no se reenvían; se retiran "Descargar respaldo" y "Cargar respaldo", sus claves de i18n, `crearRespaldo`, `leerRespaldo` y el aviso que manda a descargar respaldos.
- Covers: R4.1, R4.4
- Size: M
- Depends on: T7
- Files: src/components/PanelRevision.tsx, src/store/useAtlas.ts, src/lib/respaldo.ts, src/i18n/es.json, src/i18n/en.json, tests/respaldo.test.ts, tests/i18n.test.ts, e2e/revision-canal.spec.ts, e2e/respaldo.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "otro equipo"`: en un contexto nuevo con el mismo enlace y `leer` simulado con respuestas guardadas, se ven respondidas en menos de 5 s con la red limitada a 4G (`page.route` con demora de 1,5 s); una respuesta local más reciente que la del canal se conserva; lo traído del canal no genera ninguna petición `guardar`; no existen "Descargar respaldo" ni "Cargar respaldo". `npm test -- tests/respaldo.test.ts tests/i18n.test.ts`: `tests/respaldo.test.ts` queda solo con la fusión y `piezasQueSiguen` (la usa `importarRespuestas`) y `tests/i18n.test.ts` ya no exige las claves de respaldo ni que `guia.responder` las nombre (solo se tocan esas aserciones), y `revision.soloEsteNavegador` ya no invita a descargar. `e2e/respaldo.spec.ts` conserva solo el caso del código recordado y pasa. `npm run check:i18n`
- Issue: #94
- Status: done

### Decision log
- Ronda 1: rewrite. Lo traído queda marcado como guardado, fusión con lo local, limpieza de funciones, claves y pruebas de respaldo.
- Ronda 2: keep. Talla M; se conservan `piezasQueSiguen` y la firma de `importarRespuestas` (la prueba `tests/store.test.ts`).
- Ronda 3: keep.

## T9: Ofrecer el formulario de respaldo cuando el canal falla
- Purpose: que el docente tenga una salida si el canal no responde, y que sin canal configurado la revisión funcione como hoy; el texto de consentimiento del diálogo de envío deja de prometer mostrar el nombre.
- Covers: R7.1, R7.2
- Size: S
- Depends on: T8
- Files: src/components/PanelRevision.tsx, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts, e2e/revision-canal.spec.ts, e2e/atlas.spec.ts
- Verify: `npm run test:e2e -- e2e/revision-canal.spec.ts -g "formulario de respaldo"` (los títulos de estos casos empiezan así, para no tomar casos de T8), con el canal simulado por `page.route`, la costura de T6 y el reloj simulado con `page.clock`: (a) canal caído con pendientes, a los 9 min no aparece "Enviar por formulario"; (b) a los 10 min aparece y al pulsarlo se abre el diálogo de partes con "Abrir formulario" cuyo `href` empieza con `configRevision.urlFormulario` y lleva la carga `v:2`; (c) con el canal confirmando cada envío, a los 10 min no aparece; (d) con `urlCanal` vacía el panel muestra "Enviar revisión" y "Enviar todo" como hoy, no sale ninguna petición al canal y no aparece el diálogo de autorización. `npm test -- tests/i18n.test.ts`: `revision.consentimiento` (es y en) no dice que el nombre aparece en las fichas, y la aserción vieja que lo fijaba se reescribe. `npm run test:e2e -- e2e/atlas.spec.ts -g "textos de la revisión docente"` pasa con las aserciones del consentimiento (es y en) reescritas al texto nuevo; el resto del caso, incluido el enlace "Registrarme" y "en un solo formulario", no cambia. `npm run check:i18n`
- Issue: #95
- Status: done

### Decision log
- Ronda 1: rewrite. Casos negativos (9 min y canal sano), qué se ve al abrir el respaldo, `urlCanal` vacía sin autorización, la costura viene de T6, y el texto de consentimiento del diálogo de envío pasa a esta tarea (contradecía R9.2). Depende de T8 para serializar los cambios en `PanelRevision.tsx`.
- Ronda 2: rewrite. Filtro `-g` propio y el caso de textos de `e2e/atlas.spec.ts` dentro de la verificación.
- Ronda 3: keep.

## T10: Filtrar los trazos y las rutas del vago según la casilla
- Purpose: que cada docente vea en "Qué revisar", en la ficha y al tocar un trazo en el modelo solo lo que se siente capaz de revisar (trazos y rutas trazadas del vago) y pueda cambiarlo después desde Acciones sin repetir la autorización; sin `urlCanal` (flujo de formulario de hoy, R7.2) el filtro no actúa y todo se ve como hoy.
- Covers: R5.1, R5.2, R5.3
- Size: M
- Depends on: T9
- Files: src/lib/prioridad.ts, src/components/PanelRevision.tsx, src/components/SeccionTrazos.tsx, src/components/Ficha.tsx, src/components/RevisionTrazo.tsx, src/store/useAtlas.ts, src/i18n/es.json, src/i18n/en.json, tests/prioridad.test.ts, e2e/revision-canal.spec.ts
- Verify: `npm test -- tests/prioridad.test.ts`: con el filtro activo (canal configurado y `vago` apagado), `ordenDeRevision` no trae la sección `vago` ni la de trazos, las fichas de ramos del vago pueden salir en `resto` pero sin campos de rutas trazadas, y `camposDeFicha` y `avanceDeFicha` no cuentan los campos de rutas trazadas; con `vago` encendido, o con el filtro inactivo (sin canal), los traen igual que hoy (los casos actuales de rutas siguen pasando sin cambios; ninguna prueba nueva fija el nombre `trazado_derecho`). `npm run test:e2e -- e2e/revision-canal.spec.ts -g "vago"` con el canal simulado por `page.route` y la costura de T6: (a) sin la casilla no aparecen "Trazos del vago" ni los recorridos trazados en "Qué revisar", la ficha de una entrada con ruta trazada no muestra su control de recorrido en modo revisión (sí conserva "Pendiente de revisión docente") y tocar un trazo del vago en el modelo no muestra su control de revisión; (b) con una autorización registrada, el menú Acciones muestra la casilla "También puedo revisar el recorrido del nervio vago en cuello y tórax"; al marcarla sale `autorizar` con `vago: true` y la versión vigente y aparecen los trazos, las rutas y los controles; al desmarcarla sale `autorizar` con `vago: false` y desaparecen; (c) en un contexto nuevo, con `leer` devolviendo `vago: true`, aparecen sin tocar nada; (d) sin autorización registrada la casilla de Acciones no está disponible y no sale ninguna petición `autorizar`; (e) si `autorizar` falla, la casilla vuelve a su valor anterior, "Qué revisar" no cambia y el panel muestra "Sin conexión"; (f) con `urlCanal` vacía, "Trazos del vago" y los recorridos trazados aparecen en "Qué revisar" y en la ficha como hoy, y la casilla no existe. `npm run test:e2e -- e2e/trazos-vago.spec.ts e2e/atlas.spec.ts` pasan sin cambios (corren con `urlCanal` vacía); `npm run check:i18n`
- Issue: #96
- Status: todo

### Decision log
- Ronda 1: rewrite. Pruebas existentes que asumen los trazos visibles, store e i18n en `Files`, ficha filtrada, desmarcar, otro equipo, casilla sin autorización y falla de `autorizar`. Sin la casilla, las fichas de ramos del vago quedan en `resto` (R5.1 solo excluye trazos y rutas trazadas). Depende de T9 para serializar los cambios en `PanelRevision.tsx`.
- Ronda 2: rewrite. Sin canal el filtro no actúa (R7.2), así que `trazos-vago.spec.ts` y `atlas.spec.ts` no cambian. El orquestador suma el control que abre tocar un trazo en el modelo (`RevisionTrazo.tsx`): sin él, el docente podría revisar por el modelo lo que la lista le oculta.
- Ronda 3: keep.

## T11: Mostrar "Revisado por un docente universitario" sin datos personales
- Purpose: que el estudiante sepa que una ficha fue revisada por un docente sin ver datos del revisor, y que el repositorio nunca guarde nombres.
- Covers: R9.1, R9.2, R9.3
- Size: S
- Depends on: none
- Files: src/components/Ficha.tsx, src/i18n/es.json, src/i18n/en.json, tests/datos.test.ts, e2e/atlas.spec.ts
- Verify: `npm test -- tests/datos.test.ts`: todo `revisado_por` de `src/data/estructuras.json` y de las rutas es `null` o un alias `D\d{2}`; `npm run test:e2e -- e2e/atlas.spec.ts -g "revisado por"` con una ficha verificada inyectada en la prueba: muestra "Revisado por un docente universitario" y la fecha cuando el idioma visible está verificado, y el texto de la ficha no contiene el valor de `revisado_por`; `npm run check:i18n`
- Issue: #97
- Status: in-progress

### Decision log
- Ronda 1: keep.
- Ronda 2: no se revisó (sin cambios).

## T12: Poner al día las guías del docente y del editor
- Purpose: que el docente no vea pasos de registro, de envío ni de respaldo, que la guía diga que todo se guarda solo y sigue en otro equipo, y que el editor sepa montar el script, cuidar el padrón, importar la pestaña Respuestas, usar solo alias en `revisado_por` y atender una solicitud de supresión de datos.
- Covers: R10.1, R10.2, R10.3
- Size: M
- Depends on: T1, T2, T3, T9, T10, T11
- Files: src/components/PanelRevision.tsx, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts, tests/guias-docs.test.ts, e2e/atlas.spec.ts, docs/guia-docentes.md, docs/revision-docente.md
- Verify: `npm test -- tests/i18n.test.ts tests/guias-docs.test.ts`: (a) en `revision.guia` (es y en) ninguna clave contiene registro (`registr`, `Register`), "Enviar revisión"/"Send review", "Enviar todo"/"Send all", "Sí, lo envié"/"Yes, I sent it", la palabra completa "formulario" o `\bform\b` (sin contar "información", "formato" ni "information") ni "respaldo"/"backup"; la clave `revision.guia.registrarme` ya no existe (el diálogo de envío sin canal usa su propia clave fuera de `guia`, con el mismo texto "Registrarme (una sola vez)") y `PanelRevision.tsx` ya no muestra ese enlace dentro de la guía (`como-revisar`); la guía dice "Guardado" (es) y "Saved" (en) y que se sigue en otro equipo con el mismo enlace; (b) se reescriben las aserciones viejas de `tests/i18n.test.ts` sobre `guia.enviar` para afirmar lo contrario; (c) `docs/guia-docentes.md` no contiene "Registrarme", "docs.google.com/forms" ni "a tu nombre"; (d) `docs/revision-docente.md` contiene las pestañas `Respuestas`, `Autorizaciones` y `Padrón`, un bloque `powershell`, un apartado de supresión (Ley 1581), dice que `revisado_por` es solo un alias del padrón y no contiene "el nombre del registro". `npm run test:e2e -- e2e/atlas.spec.ts` pasa con `urlCanal` vacía: la aserción del enlace "Registrarme (una sola vez)" dentro de la guía se reescribe para afirmar que la guía no tiene ese enlace ni enlaces a `docs.google.com/forms`, y el enlace sigue en el diálogo "Enviar revisión". `npm run check:i18n`; `[manual]` el editor confirma que `docs/revision-docente.md` trae los pasos de montaje para Windows y que AGENTS.md, SPEC.md y el ADR 0012 del PR del spec dicen lo que se hace (sin cambios esperados en esos tres archivos; si hay diferencias, van en un PR aparte porque SPEC.md es ruta sensible) (razón: texto de contrato y montaje en la cuenta del editor, sin oráculo automático)
- Issue: #98
- Status: todo

### Decision log
- Ronda 1: rewrite. Todas las claves de la guía, inglés, pruebas viejas, "a tu nombre", `revisado_por` como alias y dependencias con las tareas que documenta. R10.1 ya está en el PR del spec y aquí solo se confirma.
- Ronda 2: rewrite. Palabra completa para "form" y el caso de `e2e/atlas.spec.ts` que fijaba el enlace de registro en la guía.
- Ronda 3: keep.

## T13: Poner la URL real del canal después del montaje
- Purpose: que la app de producción use el Apps Script del editor una vez montado, para que la primera sesión docente guarde de verdad; el valor lo da el editor (es público por diseño) y pasar `urlCanal` de vacía a la URL real es de nivel C (host nuevo). Los specs e2e del modo sin canal (R7.2) anulan la URL con la costura de T6 antes de cargar la página, para seguir probando ese modo sin salir a `script.google.com`.
- Covers: R3.1
- Size: S
- Depends on: T2, T12
- Files: src/config/revision.ts, tests/config-revision.test.ts, e2e/atlas.spec.ts, e2e/revision-dialogos.spec.ts, e2e/trazos-vago.spec.ts, e2e/respaldo.spec.ts, e2e/marcar-todo.spec.ts
- Verify: `npm test -- tests/config-revision.test.ts`: `urlCanal` cumple `/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/` (falla mientras esté vacía, que es como la deja T4); `npm run typecheck` y `npm test` en verde; `npm run test:e2e -- e2e/revision-canal.spec.ts e2e/revision-dialogos.spec.ts e2e/atlas.spec.ts e2e/trazos-vago.spec.ts e2e/respaldo.spec.ts e2e/marcar-todo.spec.ts` en verde con la URL real puesta: cada spec del modo sin canal anula `urlCanal` con la costura de T6 antes de la primera carga (`addInitScript` en un `beforeEach`), los de `revision-canal.spec.ts` la fijan y simulan con `page.route`, y todos llevan un `page.route('https://script.google.com/**')` que hace fallar la prueba si sale alguna petición real; `[manual]` el editor, ya publicado el cambio y en una ventana de incógnito con un código de prueba del padrón, marca una respuesta, ve "Guardado ✓" y encuentra la fila en la pestaña Respuestas, y abre el mismo enlace en otro equipo y la ve respondida (razón: la nube no alcanza `script.google.com`, proxy 403)
- Issue: #99
- Status: todo

### Decision log
- Ronda 1: nueva, por la nota de los revisores de T4 y T6: nadie llenaba la URL real, y es un cambio de nivel C (host nuevo) que necesita al editor.
- Ronda 2: rewrite. Prueba que falla mientras la URL esté vacía, e2e en verde con la URL real gracias a la costura, y la comprobación manual va después de publicar.
- Ronda 3: rewrite, resuelto por el orquestador (tope de rondas). Los specs que hoy corren sin canal no tienen ninguna costura: T13 es la tarea que les agrega la anulación de la URL y una guarda contra peticiones reales.
