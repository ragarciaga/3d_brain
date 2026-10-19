<!-- rockbuilt:test-plan. Derivado solo del spec, nunca del código. -->
# Plan de pruebas: Reportar un error desde la ficha (F12)

Spec: [requirements.md](requirements.md), [design.md](design.md)  |  Fecha: 2026-10-19  |  Se corre con: `npm run test:e2e`

## Entorno
- URL de la app: la del servidor de desarrollo que levanta `playwright.config.ts` (`webServer`, `npm run dev`).
- Datos: los del repositorio (`src/data/estructuras.json`, `src/i18n/es.json` y `en.json`). Las pruebas leen de esos archivos el nombre, la versión y las partes de la ficha que usan, en vez de fijarlos.
- Modo revisión: se entra con `/es/revision?r=<código>` con un código de prueba inventado (8 caracteres válidos), nunca uno del padrón. El canal real del editor nunca se llama (`protegerCanalReal()` de `e2e/canal-real.ts`).
- Salidas: toda navegación a `github.com` se intercepta y se aborta; el `mailto:` no debe salir a la red. Nada de lo que escribe la prueba llega a GitHub ni a un correo real.
- Credenciales: ninguna. El aviso de primera visita se da por visto antes de cada prueba.

Cobertura previa: cada tarea dejó sus pruebas en `e2e/reportar-error.spec.ts` (botón, diálogo, formulario, almacenes, red y estado de revisión bloqueada). Este plan es por flujo de usuario, de punta a punta; el escritor de E2E reutiliza lo existente donde ya cubre el caso y escribe solo lo que falte, en `e2e/reportar-error-flujos.spec.ts`.

## Flujo F1: el estudiante encuentra el botón y abre el reporte
Archivo: `e2e/reportar-error-flujos.spec.ts`

### F1-H (camino feliz)
- Cubre: R1.1, R1.3
- Precondiciones: escritorio, sin modo revisión, una estructura con ficha abierta en español.
- Pasos:
  1. Abrir la ficha de una estructura desde la búsqueda.
  2. Pulsar "Reportar un error" en el pie de la ficha.
  3. Cerrar con Escape; volver a abrir y cerrar con "Cerrar".
- Condición de paso (observable): el botón está en el pie de la ficha, visible sin abrir el bloque de fuentes; el diálogo aparece con el foco en su título, que nombra la estructura; tras Escape y tras "Cerrar" el diálogo ya no existe y el foco vuelve al botón.

### F1-E1 (modo revisión: no hay segunda vía)
- Cubre: R1.2
- Precondiciones: modo revisión con un código de prueba en la URL; después, el mismo código recordado y la URL sin código.
- Pasos:
  1. Entrar con `/es/revision?r=<código>` y abrir una ficha.
  2. Recargar la app sin el código en la URL y abrir otra ficha.
- Condición de paso (observable): en los dos casos, con los controles de revisión ya visibles en la ficha, no existe ningún botón "Reportar un error".

### F1-E2 (celular y en inglés)
- Cubre: R1.1, R1.4
- Precondiciones: pantalla de 390 x 568, idioma inglés.
- Pasos:
  1. Abrir una ficha en `/en/...` y pulsar "Report an error".
  2. Desplazar el diálogo hasta el final.
- Condición de paso (observable): el botón dice "Report an error"; el diálogo cabe en la pantalla o se desplaza, y su último botón ("Close") se ve completo y no lo tapa ningún elemento fijo (el elemento en su centro es el propio botón).

## Flujo F2: el estudiante llena el reporte y lo abre por GitHub o por correo
Archivo: `e2e/reportar-error-flujos.spec.ts`

### F2-H (camino feliz)
- Cubre: R2.1, R2.5, R4.3, y de paso lo visible de R3.1 y R4.1
- Precondiciones: escritorio, español, ficha con varias partes.
- Pasos:
  1. Abrir el reporte.
  2. Elegir el tipo "Contenido", la parte "Qué es" y escribir una descripción con `#`, `&`, un salto de línea, comillas y tildes.
  3. Leer el aviso y los dos botones de envío.
  4. Pulsar "Abrir en GitHub" (la pestaña nueva se intercepta y se aborta).
- Condición de paso (observable): hay cuatro tipos y ninguno viene marcado; se ve el aviso de que el reporte por GitHub queda público y de no poner datos personales, con un enlace a `/es/privacidad`; la dirección info@maysasp.com aparece como texto y no es un enlace; tras llenar, "Abrir en GitHub" abre una pestaña nueva cuyo destino es el formulario de issue del tipo elegido en `github.com/ragarciaga/3d_brain` con estructura, idioma `es`, versión, parte `que_es` y la descripción intacta al decodificarla; "Enviar por correo" apunta a `mailto:info@maysasp.com` con el asunto y el cuerpo del idioma activo y la misma descripción intacta.

### F2-E1 (falta el tipo o la descripción)
- Cubre: R2.4, R2.1
- Precondiciones: el reporte recién abierto.
- Pasos:
  1. Sin elegir tipo ni escribir, mirar los botones de envío.
  2. Escribir una descripción sin elegir tipo.
  3. Elegir un tipo y dejar la descripción solo con espacios.
- Condición de paso (observable): en los tres momentos los dos botones de envío están desactivados (no se pueden seguir y lo anuncian como desactivados) y debajo se dice qué falta: el tipo, la descripción, o los dos; en ningún momento se abre una pestaña nueva.

### F2-E2 (texto demasiado largo para GitHub)
- Cubre: R2.4, R4.3 (la vía por correo sigue disponible), R2.3 en la interfaz
- Precondiciones: el reporte abierto con un tipo elegido.
- Pasos:
  1. Pegar 1501 caracteres.
  2. Reemplazar por 1500 caracteres que ocupan mucho al codificarse (por ejemplo emojis o "€").
- Condición de paso (observable): el campo se queda en 1500 y el contador dice "1500 / 1500"; con el texto que no cabe en GitHub, "Abrir en GitHub" queda desactivado con un mensaje que pide acortar o usar el correo, y "Enviar por correo" sigue activo con su enlace.

## Flujo F3: el reporte no se queda en la app
Archivo: `e2e/reportar-error-flujos.spec.ts`

### F3-H (camino feliz)
- Cubre: R5.1
- Precondiciones: ficha abierta, sin modelo 3D si hace falta para que no haya peticiones de fondo; se toma una foto de localStorage, sessionStorage, IndexedDB y cookies antes de abrir el reporte, y se empiezan a contar las peticiones desde que se abre.
- Pasos:
  1. Abrir el reporte, llenarlo y pulsar los dos botones de envío.
  2. Cerrar el diálogo.
- Condición de paso (observable): las fotos de los almacenes son idénticas antes, mientras se escribe y después de enviar; la página no hizo ninguna petición propia (lo único es la pestaña de GitHub, abortada, y la navegación `mailto:` que el navegador entrega al programa de correo). Un control dentro de la prueba confirma que la foto sí detecta una escritura.

### F3-E1 (el borrador se pierde al cerrar)
- Cubre: R5.2
- Precondiciones: el reporte abierto.
- Pasos:
  1. Elegir tipo y parte, y escribir una descripción.
  2. Cerrar con Escape y volver a abrir.
  3. Repetir y cerrar con "Cerrar".
- Condición de paso (observable): al reabrir, ningún tipo está marcado, la parte es "General", la descripción está vacía y el contador dice "0 / 1500".

### F3-E2 (el código del revisor nunca llega a un reporte)
- Cubre: R5.1, comportamiento a preservar ("ningún enlace que arma la app lleva el código del revisor")
- Precondiciones: la URL lleva `?r=<código de prueba>` pero el modo revisión no se activó (por ejemplo, cuando la app no puede entrar al modo revisión y sigue como visitante), así que el botón se ve.
- Pasos:
  1. Abrir el reporte desde esa página, llenarlo y leer los dos enlaces.
- Condición de paso (observable): ni el enlace de GitHub ni el del correo contienen el código ni `r=`, ni codificados ni decodificados; la URL de la página sí los contiene (control).

## Cobertura
| Criterio | Caso(s) |
|---|---|
| R1.1 | F1-H, F1-E2 |
| R1.2 | F1-E1 |
| R1.3 | F1-H |
| R1.4 | F1-E2 |
| R2.1 | F2-H, F2-E1 |
| R2.4 | F2-E1, F2-E2 |
| R2.5 | F2-H |
| R4.3 | F2-H, F2-E2 |
| R5.1 | F3-H, F3-E2 |
| R5.2 | F3-E1 |

Los criterios `[unit]` (R2.2, R2.3, R3.1 a R3.4, R4.1, R4.2, R6.1, R6.2, R7.1, R8.1 a R8.3) los cubren las pruebas unitarias de cada tarea; R6.3 `[manual]` se comprobó en GitHub (las cuatro etiquetas existen).
