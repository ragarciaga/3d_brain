# Tasks: Reportar un error desde la ficha (F12)
Spec: docs/specs/05-error-report/  |  Status: approved  |  Converged: 2026-10-19, 2 rounds

## T1: Calcular las partes de una ficha y validar la descripción
- Purpose: tener la configuración del reporte y las funciones puras que dicen qué partes puede señalar el visitante en cada ficha y si su descripción es válida, con el mismo vocabulario de campos de F24.
- Covers: R2.2, R2.3, R7.1
- Size: S
- Depends on: none
- Files: src/config/reporte.ts, src/lib/reporte.ts, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts`: `partesDeFicha` da `general` primero y luego los campos únicos de `camposDeFicha` sin idioma (sin `duda.N`, `posicion` ni `trazo:*`), más `recursos` si la ficha tiene recursos; para una entrada sin ficha da `['general', 'nombre']`; cada parte distinta de `general` y `recursos` es un campo que `camposDeFicha` produce para esa ficha; `descripcionValida` rechaza vacío y solo espacios, acepta 1 y 1500 caracteres y rechaza 1501; `MAX_DESCRIPCION` es 1500 y `MAX_URL` 8000; `npm run typecheck`
- Issue: #231
- Status: done

### Decision log
- 2026-10-19 construcción: PR #243 fusionado.

## T2: Armar el enlace al formulario de issue de GitHub y los textos del reporte
- Purpose: que el reporte abra el formulario del tipo elegido ya lleno, solo con datos de la ficha, codificado sin pérdidas y sin pasar de 8000 caracteres, y que todos los textos del reporte (botón, diálogo, tipos, título, correo y motivos) existan en es y en.
- Covers: R3.1, R3.2, R3.3, R3.4
- Size: M
- Depends on: T1
- Files: src/lib/reporte.ts, src/config/reporte.ts, src/i18n/es.json, src/i18n/en.json, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts` (usa un `t` de i18next con `src/i18n/es.json` y `en.json` reales): `enlaceGithub` empieza por `https://github.com/ragarciaga/3d_brain/issues/new?`, trae `template=<PLANTILLA[tipo]>` para los cuatro tipos, y los parámetros `estructura`, `idioma`, `version`, `parte` y `descripcion` con los valores exactos (ida y vuelta con `URLSearchParams` de un texto con `#`, `&`, salto de línea, comillas y tildes); el `title` es exactamente `[<reporte.tipo.X en es>] <nombre> (<id>)` con idioma es y `[<reporte.tipo.X en en>] <nombre> (<id>)` con idioma en, para los cuatro tipos; con un `location` falso que trae `?r=PRUEBA01` ni el enlace contiene `PRUEBA01` ni `r=` (la función no lee `window`); 1500 caracteres ASCII con espacios dan un enlace de 8000 o menos y `cabeEnGithub` verdadero; 1500 emojis dan `cabeEnGithub` falso; un tipo fuera de `TIPOS` lanza; una aserción lee `es.json` y `en.json` y exige en los dos un texto no vacío, sin guion largo, para cada clave de esta lista: `reporte.boton`, `reporte.titulo`, `reporte.tipo.contenido`, `reporte.tipo.traduccion`, `reporte.tipo.enlace-roto`, `reporte.tipo.pieza`, `reporte.tipoAyuda.*` (los cuatro), `reporte.parte`, `reporte.parteGeneral`, `reporte.parteRecursos`, `reporte.descripcion`, `reporte.contador`, `reporte.aviso`, `reporte.abrirGithub`, `reporte.enviarCorreo`, `reporte.correoTexto`, `reporte.falta.tipo`, `reporte.falta.descripcion`, `reporte.muyLargo`, `reporte.correo.asunto`, `reporte.correo.cuerpo`, `reporte.cerrar` (las demás partes usan las etiquetas que ya existen en `ficha.*`); `npm run check:i18n`; `npm run typecheck`
- Issue: #232
- Status: done

### Decision log
- 2026-10-19 ronda 1: el título se prueba en es y en con las traducciones reales y la lista de claves es explícita (`check:i18n` no detecta claves que falten si nadie las usa); los textos del diálogo se quedan aquí porque T5 ya llega a 8 archivos.
- 2026-10-19 construcción: el verificador pidió probar el parámetro idioma en en (62c8b70); PR #244 fusionado.

## T3: Armar el correo de reporte
- Purpose: que quien no tiene cuenta de GitHub envíe el mismo reporte por correo a info@maysasp.com con asunto y cuerpo ya escritos.
- Covers: R4.1, R4.2
- Size: S
- Depends on: T2
- Files: src/lib/reporte.ts, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts`: `enlaceCorreo` empieza por `mailto:info@maysasp.com?`; con idioma es el asunto decodificado es exactamente el texto de `reporte.correo.asunto` de `es.json` con sus valores (`[Maysa Brain] <tipo en es>: <id> (es, versión <versión>)`), y con idioma en el de `en.json` (`[Maysa Brain] <tipo en en>: <id> (en, version <versión>)`); el cuerpo decodificado contiene la estructura (id), el idioma, la versión, la parte y la descripción completa con sus valores exactos, y sus etiquetas salen de `reporte.correo.cuerpo` del idioma; los espacios van como `%20` y no `+`; un texto con `#`, `&`, salto de línea, comillas y tildes llega intacto tras `decodeURIComponent`; con un `location` falso que trae `?r=PRUEBA01` el enlace no contiene `PRUEBA01` ni `r=` (la función no lee `window`); un tipo fuera de `TIPOS` lanza; `npm run typecheck`
- Issue: #233
- Status: done

### Decision log
- 2026-10-19 ronda 1: asunto exacto en los dos idiomas, valores exactos del cuerpo y caso de tipo inválido.
- 2026-10-19 construcción: una devolución del verificador (f6a74e9); PR #246 fusionado. Nota de seguridad: un surrogate suelto hace lanzar a encodeURIComponent, se resuelve en T6.

## T4: Agregar los cuatro formularios de issue con su etiqueta
- Purpose: que cada reporte llegue a GitHub con su formulario, sus campos llenos desde la URL y su etiqueta, en español y en inglés.
- Covers: R6.1, R6.2, R6.3, R8.3
- Size: S
- Depends on: T2
- Files: .github/ISSUE_TEMPLATE/contenido.yml, .github/ISSUE_TEMPLATE/traduccion.yml, .github/ISSUE_TEMPLATE/enlace-roto.yml, .github/ISSUE_TEMPLATE/pieza-mal-ubicada.yml, tests/plantillas-issue.test.ts, docs/operacion.md
- Verify: `npm test -- tests/plantillas-issue.test.ts` (lee los `.yml` y `docs/operacion.md` como texto, sin dependencias nuevas): los nombres de archivo de `.github/ISSUE_TEMPLATE/` son exactamente los valores de `PLANTILLA`, uno por cada tipo de `TIPOS`; cada archivo trae `name`, `description` y `labels: [reporte:<tipo>]` con la etiqueta de su tipo (`reporte:contenido`, `reporte:traduccion`, `reporte:enlace-roto`, `reporte:pieza`, todas distintas); trae los campos con `id` `estructura`, `idioma`, `version`, `parte` (input) y `descripcion` (textarea con `validations: required: true`), y esos ids son exactamente los parámetros `estructura`, `idioma`, `version`, `parte` y `descripcion` (más `template` y `title`) que produce `enlaceGithub` al leer su URL con `URLSearchParams`; `name`, `description` y cada `attributes.label` y `attributes.description` usan el formato `Español / English` (dos segmentos no vacíos separados por ` / `); ninguno tiene guion largo; `docs/operacion.md` tiene una sección con las cuatro etiquetas por nombre y sus pasos. R6.3 `[manual]` (se crean en GitHub una vez y no hay prueba automática contra la API desde el CI): los pasos para crear las cuatro etiquetas quedan en `docs/operacion.md` y el PR los pide en su lista para el humano
- Issue: #234
- Status: done

### Decision log
- 2026-10-19 ronda 1: depende de T2 (compara con `enlaceGithub`); la guía de las etiquetas va en `docs/operacion.md` (guía del editor), no en la guía de la revisión docente; formato bilingüe comprobable `Español / English`. Tier C por `.github/`.
- 2026-10-19 construcción: los cuatro `.yml` los escribió el orquestador (el guard no deja a los subagentes escribir en `.github/`); verificador y auditor en pass; PR #247 para el editor (nivel C).

## T5: Mostrar el botón en la ficha y abrir el diálogo accesible
- Purpose: que el visitante encuentre "Reportar un error" en el pie de cada ficha (no en modo revisión) y que el diálogo se use con teclado y tenga un contenedor desplazable que quepa en un celular.
- Covers: R1.1, R1.2, R1.3, R1.4
- Size: M
- Depends on: T2
- Files: src/components/ReportarError.tsx, src/components/Ficha.tsx, src/lib/teclado.ts, tests/teclado.test.ts, src/components/Pagina.tsx, src/store/useAtlas.ts, src/estilos.css, e2e/reportar-error.spec.ts
- Verify: `npm test -- tests/teclado.test.ts` (`cerrar-reporte` va después de `cancelar-salida` y antes de las demás); `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) en `/es/hipocampo` y en `/en/...` el pie de la ficha muestra el botón fuera del bloque de fuentes (no dentro de `details.ficha-fuentes`), y también en una entrada sin ficha; (b) en `/es/revision?r=PRUEBA01` (con `protegerCanalReal`) la ficha no tiene el botón; (c) al pulsarlo el foco va al título del diálogo, Escape y "Cerrar" lo cierran (el diálogo se desmonta, no se oculta) y el foco vuelve al botón, y Escape no saca del aislamiento mientras el diálogo está abierto; (d) en 390 x 844 y 390 x 568 el diálogo (`.aviso-caja`) tiene por estilo calculado `max-height` menor o igual al alto de la pantalla y `overflow-y` en `auto` o `scroll`, y su último botón se ve sin tapar (mismo método que `e2e/revision-dialogos.spec.ts`); el chequeo con el formulario completo se repite en T6; `npm run typecheck`
- Issue: #235
- Status: done

### Decision log
- 2026-10-19 ronda 1: depende solo de T2; (d) comprueba el contenedor por estilo calculado porque el cascarón cabe sin desplazar; el diálogo se desmonta al cerrar (lo necesita T7).
- 2026-10-19 construcción: PR #248 fusionado; hubo que revisar de nuevo tras traer main por un texto de en.json de T2.

## T6: Llenar el formulario y enviar por GitHub o por correo
- Purpose: que el visitante elija tipo y parte, escriba la descripción, vea el aviso de privacidad y abra el reporte por cualquiera de las dos vías, con el diálogo completo usable en un celular.
- Covers: R2.1, R2.4, R2.5, R4.3
- Size: M
- Depends on: T3, T5
- Files: src/components/ReportarError.tsx, src/estilos.css, e2e/reportar-error.spec.ts
- Verify: `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) feliz, en `/es/...` y en `/en/...`: el diálogo trae los cuatro tipos sin ninguno marcado, el select de parte con "General" elegido primero y las demás opciones de `partesDeFicha` para esa ficha, el contador "n / 1500", el aviso de que el reporte por GitHub es público con el enlace a Privacidad del idioma activo, y la dirección info@maysasp.com como texto; tras elegir tipo y escribir, "Abrir en GitHub" es un `<a>` con `target="_blank"`, `rel` con `noopener` y `noreferrer` y el `href` que da `enlaceGithub` para esa ficha, y "Enviar por correo" un `<a>` con el `href` de `enlaceCorreo`; (b) sin tipo, o con la descripción vacía o solo con espacios, los dos quedan sin `href` con `aria-disabled="true"` y debajo se dice qué falta; (c) con una descripción que no cabe en GitHub (`cabeEnGithub` falso) solo "Abrir en GitHub" queda desactivado con su motivo y el correo sigue activo; (d) al pegar 1501 caracteres en la descripción el campo queda con 1500 y el contador dice "1500 / 1500"; (e) con el formulario completo y un texto largo, en 390 x 844 y 390 x 568 la dirección y el último botón del diálogo se alcanzan y se ven sin tapar (mismo método que `e2e/revision-dialogos.spec.ts`); (f) con el foco en la descripción o en el select, Escape cierra el diálogo; `npm run typecheck`
- Issue: #236
- Status: done

### Decision log
- 2026-10-19 ronda 1: suma el corte en 1500 de la interfaz (R2.3), el último botón con el formulario completo (R1.4) y Escape con el foco en un campo; las opciones del select salen de `partesDeFicha`; depende también de T3 porque usa `enlaceCorreo`.
- 2026-10-19 construcción: el verificador pidió probar también el surrogate bajo suelto (3b95b7b); PR #249 fusionado.

## T7: Comprobar que el reporte no se guarda ni sale por la red
- Purpose: asegurar con pruebas e2e que la app no se queda con nada de lo que escribe el visitante (ni en almacenes ni por la red) y que el borrador se pierde al cerrar el diálogo, sea con Escape o con "Cerrar".
- Covers: R5.1, R5.2
- Size: S
- Depends on: T6
- Files: e2e/reportar-error.spec.ts
- Verify: `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) con una foto de localStorage, sessionStorage, IndexedDB (`keyval-store`, como en `e2e/revision-privacidad.spec.ts`) y `document.cookie` tomada después de cargar la ficha y antes de abrir el diálogo, y repetida mientras se escribe y después de pulsar "Abrir en GitHub" y "Enviar por correo", las fotos son idénticas; las peticiones se cuentan con `page.on('request')` y `context.on('page')` solo desde que se abre el diálogo, y no hay ninguna petición nueva de la página (la pestaña de GitHub se intercepta con `context.route` y se aborta, y el `mailto:` no sale a la red); un control en la misma prueba escribe una llave en localStorage y comprueba que la foto la detecta; (b) con tipo, parte y descripción llenos, al cerrar con Escape y reabrir, y otra vez al cerrar con "Cerrar" y reabrir, ningún tipo está marcado, la parte es "General" y la descripción y el contador están en vacío ("0 / 1500"); `npm run typecheck`
- Issue: #237
- Status: done

### Decision log
- 2026-10-19 ronda 1: solo pruebas (tier A); peticiones contadas desde que se abre el diálogo, control de la foto y las dos vías de cierre.
- 2026-10-19 construcción: Chromium registra la navegación `mailto:` como evento de petición; se admite exactamente esa entrada y cualquier otra falla. Se sumó la prueba del estado de revisión bloqueada (recomendación de seguridad de T6). PR #251 fusionado.

## T8: Decir en Privacidad qué pasa con un reporte
- Purpose: que la página de Privacidad diga, en los dos idiomas, que un reporte por GitHub es público, que uno por correo llega a info@maysasp.com y que la app no guarda ninguno, y que ningún texto visible del botón y del diálogo de reporte quede en duro.
- Covers: R8.1, R8.2
- Size: S
- Depends on: T2, T6
- Files: src/components/Privacidad.tsx, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts
- Verify: `npm test -- tests/i18n.test.ts`: `CLAVES` de "página Privacidad" incluye `reportes` y `Privacidad.tsx` pinta `t('privacidad.reportes')`; `privacidad.reportes` en es contiene `GitHub`, `público`, `info@maysasp.com` y `la app no guarda`, y en en contiene `GitHub`, `public`, `info@maysasp.com` y `the app does not save`; sin guion largo (lo cubre la prueba existente); `src/components/ReportarError.tsx` no tiene texto suelto entre etiquetas JSX ni literales en `aria-label`, `placeholder`, `title` o `alt` (todo pasa por `t()`), y la prueba falla si el archivo no existe; `npm run check:i18n`; `npm run typecheck`
- Issue: #238
- Status: done

### Decision log
- 2026-10-19 ronda 1: clave `privacidad.reportes` fijada en `CLAVES`, frases exactas por idioma, comprobación ejecutable de literales y dependencia de T6. Tier C (texto legal).
- 2026-10-19 construcción: el verificador pidió fijar frases que cargan la afirmación; la frase de GitHub se reescribió (GitHub abre su formulario y el issue existe solo cuando se envía). PR #250 para el editor (nivel C).
