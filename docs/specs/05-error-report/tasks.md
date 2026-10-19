# Tasks: Reportar un error desde la ficha (F12)
Spec: docs/specs/05-error-report/  |  Status: draft  |  Converged: 2026-10-19, 0 rounds

## T1: Calcular las partes de una ficha y validar la descripción
- Purpose: tener la configuración del reporte y las funciones puras que dicen qué partes puede señalar el visitante en cada ficha y si su descripción es válida, con el mismo vocabulario de campos de F24.
- Covers: R2.2, R2.3, R7.1
- Size: S
- Depends on: none
- Files: src/config/reporte.ts, src/lib/reporte.ts, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts`: `partesDeFicha` da `general` primero y luego los campos únicos de `camposDeFicha` sin idioma (sin `duda.N`, `posicion` ni `trazo:*`), más `recursos` si la ficha tiene recursos; para una entrada sin ficha da `['general', 'nombre']`; cada parte distinta de `general` y `recursos` es un campo que `camposDeFicha` produce para esa ficha; `descripcionValida` rechaza vacío y solo espacios, acepta 1 y 1500 caracteres y rechaza 1501; `MAX_DESCRIPCION` es 1500 y `MAX_URL` 8000; `npm run typecheck`
- Issue:
- Status: todo

### Decision log

## T2: Armar el enlace al formulario de issue de GitHub y los textos del reporte
- Purpose: que el reporte abra el formulario del tipo elegido ya lleno, solo con datos de la ficha, codificado sin pérdidas y sin pasar de 8000 caracteres, y que todos los textos del reporte existan en es y en.
- Covers: R3.1, R3.2, R3.3, R3.4
- Size: M
- Depends on: T1
- Files: src/lib/reporte.ts, src/config/reporte.ts, src/i18n/es.json, src/i18n/en.json, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts`: `enlaceGithub` empieza por `https://github.com/ragarciaga/3d_brain/issues/new?`, trae `template=<PLANTILLA[tipo]>` para los cuatro tipos, el título `[<tipo traducido>] <nombre> (<id>)` y los parámetros `estructura`, `idioma`, `version`, `parte` y `descripcion` con los valores exactos (ida y vuelta con `URLSearchParams` de un texto con `#`, `&`, salto de línea, comillas y tildes); con un `location` falso que trae `?r=PRUEBA01` ni el enlace contiene `PRUEBA01` ni `r=` (la función no lee `window`); 1500 caracteres ASCII con espacios dan un enlace de 8000 o menos y `cabeEnGithub` verdadero; 1500 emojis dan `cabeEnGithub` falso; un tipo fuera de `TIPOS` lanza; `npm run check:i18n` (sección `reporte` en es y en con todos los textos del diálogo, del título y del correo); `npm run typecheck`
- Issue:
- Status: todo

### Decision log

## T3: Armar el correo de reporte
- Purpose: que quien no tiene cuenta de GitHub envíe el mismo reporte por correo a info@maysasp.com con asunto y cuerpo ya escritos.
- Covers: R4.1, R4.2
- Size: S
- Depends on: T2
- Files: src/lib/reporte.ts, tests/reporte.test.ts
- Verify: `npm test -- tests/reporte.test.ts`: `enlaceCorreo` empieza por `mailto:info@maysasp.com?`, el asunto decodificado es `[Maysa Brain] <tipo traducido>: <id> (<idioma>, versión <versión>)` en es y su par en en, el cuerpo decodificado trae estructura, idioma, versión, parte y la descripción completa; los espacios van como `%20` y no `+`; un texto con `#`, `&`, salto de línea y tildes llega intacto; con un `location` falso que trae `?r=PRUEBA01` el enlace no contiene `PRUEBA01` ni `r=`; `npm run typecheck`
- Issue:
- Status: todo

### Decision log

## T4: Agregar los cuatro formularios de issue con su etiqueta
- Purpose: que cada reporte llegue a GitHub con su formulario, sus campos llenos desde la URL y su etiqueta, en español y en inglés.
- Covers: R6.1, R6.2, R6.3, R8.3
- Size: S
- Depends on: T1
- Files: .github/ISSUE_TEMPLATE/contenido.yml, .github/ISSUE_TEMPLATE/traduccion.yml, .github/ISSUE_TEMPLATE/enlace-roto.yml, .github/ISSUE_TEMPLATE/pieza-mal-ubicada.yml, tests/plantillas-issue.test.ts, docs/revision-docente.md
- Verify: `npm test -- tests/plantillas-issue.test.ts` (lee los `.yml` como texto, sin dependencias nuevas): existen los cuatro archivos de `PLANTILLA`; cada uno trae `name`, `description`, `labels: [reporte:<tipo>]` con la etiqueta de su tipo, y los campos con `id` `estructura`, `idioma`, `version`, `parte` (input) y `descripcion` (textarea con `required: true`), los mismos nombres que los parámetros de `enlaceGithub`; cada `label` y `description` trae texto en español y en inglés y ninguno tiene guion largo. R6.3 `[manual]` (se crean en GitHub una vez y no hay prueba automática contra la API desde el CI): los pasos para crear las cuatro etiquetas quedan en la guía del editor, y el PR lo pide en su lista para el humano
- Issue:
- Status: todo

### Decision log

## T5: Mostrar el botón en la ficha y abrir el diálogo accesible
- Purpose: que el visitante encuentre "Reportar un error" en el pie de cada ficha (no en modo revisión) y que el diálogo se use con teclado y quepa en un celular.
- Covers: R1.1, R1.2, R1.3, R1.4
- Size: M
- Depends on: T2, T3
- Files: src/components/ReportarError.tsx, src/components/Ficha.tsx, src/lib/teclado.ts, tests/teclado.test.ts, src/components/Pagina.tsx, src/store/useAtlas.ts, src/estilos.css, e2e/reportar-error.spec.ts
- Verify: `npm test -- tests/teclado.test.ts` (`cerrar-reporte` va después de `cancelar-salida` y antes de las demás); `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) en `/es/hipocampo` y en `/en/...` el pie de la ficha muestra el botón fuera del bloque de fuentes, y también en una entrada sin ficha; (b) en `/es/revision?r=PRUEBA01` (con `protegerCanalReal`) la ficha no tiene el botón; (c) al pulsarlo el foco va al título del diálogo, Escape y "Cerrar" lo cierran y el foco vuelve al botón, y Escape no saca del aislamiento mientras el diálogo está abierto; (d) en 390 x 844 y 390 x 568 el último botón del diálogo se ve sin tapar (mismo método que `e2e/revision-dialogos.spec.ts`); `npm run typecheck`
- Issue:
- Status: todo

### Decision log

## T6: Llenar el formulario y enviar por GitHub o por correo
- Purpose: que el visitante elija tipo y parte, escriba la descripción, vea el aviso de privacidad y abra el reporte por cualquiera de las dos vías.
- Covers: R2.1, R2.4, R2.5, R4.3
- Size: M
- Depends on: T5
- Files: src/components/ReportarError.tsx, src/estilos.css, e2e/reportar-error.spec.ts
- Verify: `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) feliz: el diálogo trae los cuatro tipos sin ninguno marcado, el select de parte con "General" elegido, el contador "n / 1500", el aviso de que el reporte por GitHub es público con el enlace a Privacidad del idioma activo, y la dirección info@maysasp.com como texto; tras elegir tipo y escribir, "Abrir en GitHub" es un `<a>` con `target="_blank"`, `rel` con `noopener` y `noreferrer` y el `href` que da `enlaceGithub` para esa ficha, y "Enviar por correo" un `<a>` con el `href` de `enlaceCorreo`; (b) sin tipo, o con la descripción vacía o solo con espacios, los dos quedan sin `href` con `aria-disabled="true"` y debajo se dice qué falta; (c) con una descripción que no cabe en GitHub (`cabeEnGithub` falso) solo "Abrir en GitHub" queda desactivado con su motivo y el correo sigue activo
- Issue:
- Status: todo

### Decision log

## T7: Comprobar que el reporte no se guarda ni sale por la red
- Purpose: asegurar que la app no se quede con nada de lo que escribe el visitante y que el borrador se pierda al cerrar.
- Covers: R5.1, R5.2
- Size: S
- Depends on: T6
- Files: e2e/reportar-error.spec.ts, src/components/ReportarError.tsx
- Verify: `npm run test:e2e -- e2e/reportar-error.spec.ts`: (a) con `page.on('request')` y una foto de localStorage, sessionStorage, IndexedDB (`keyval-store`) y `document.cookie` antes de abrir, mientras se escribe y después de pulsar los dos enlaces (interceptando la pestaña nueva y el `mailto:` sin salir a la red), no hay peticiones propias nuevas ni cambios en ningún almacén; (b) al cerrar y reabrir el diálogo, tipo, parte y descripción vuelven vacíos
- Issue:
- Status: todo

### Decision log

## T8: Decir en Privacidad qué pasa con un reporte
- Purpose: que la página de Privacidad diga, en los dos idiomas, que un reporte por GitHub es público, que uno por correo llega a info@maysasp.com y que la app no guarda ninguno, y que todos los textos del reporte salgan de i18next.
- Covers: R8.1, R8.2
- Size: S
- Depends on: T2
- Files: src/components/Privacidad.tsx, src/i18n/es.json, src/i18n/en.json, tests/i18n.test.ts
- Verify: `npm test -- tests/i18n.test.ts`: la página de Privacidad trae en es y en la línea de reportes con GitHub público, info@maysasp.com y "la app no guarda"; ningún texto de `ReportarError.tsx` ni de `src/lib/reporte.ts` es un literal visible (todos pasan por `t()`); `npm run check:i18n`
- Issue:
- Status: todo

### Decision log
