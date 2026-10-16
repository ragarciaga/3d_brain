<!-- rockbuilt:test-plan -->
# Plan de pruebas: canal de retorno de la revisión docente

Spec: [requirements.md](requirements.md), [design.md](design.md)  |  Fecha: 2026-10-15  |  Se corre con: `npm run test:e2e`

## Entorno
- URL de la app: la del servidor de desarrollo que levanta `playwright.config.ts` (`webServer`, `npm run dev`).
- Datos: los de `src/data/` del repositorio; el avance del docente vive en IndexedDB y `localStorage` de cada contexto nuevo.
- Canal de retorno: **simulado siempre** con una ruta de Playwright que habla el protocolo del Apps Script (`leer`, `autorizar`, `guardar`, errores `codigo_no_activo`, `demasiadas_peticiones`). El canal real del editor nunca se llama: cada spec del modo revisión usa `protegerCanalReal()` (`e2e/canal-real.ts`). Ningún criterio de este plan trata de la integración real (eso es la prueba manual D5 de #99).
- Códigos de prueba: inventados por cada prueba (8 caracteres válidos); nunca un código del padrón.
- Credenciales: ninguna.

## Flujo F1: entrar con el enlace personal
Archivo: `e2e/revision-canal.spec.ts` (o uno nuevo `e2e/verificar-canal.spec.ts` si el existente no cubre el caso)

### F1-H (camino feliz)
- Cubre: R1.1
- Precondiciones: contexto nuevo, sin código recordado; canal simulado que responde `leer` sin respuestas.
- Pasos:
  1. Abrir `/es/revision?r=<código válido>`.
  2. Repetir en otro contexto con `/en/revision?r=<código válido>`.
- Condición observable: el panel de revisión está visible con el código, sin ningún campo para escribirlo, y el código queda recordado (al recargar `/es` sigue en modo revisión).

### F1-E1 (falla)
- Cubre: R1.2
- Precondiciones: contexto nuevo.
- Pasos:
  1. Abrir `/es/revision?r=` con un código fuera de formato (por ejemplo con espacios o de 41 caracteres).
- Condición observable: se ve "Este enlace no es válido; pide uno nuevo al editor", no aparece el panel de revisión y no queda código recordado (al recargar `/es` no hay modo revisión).

### F1-E2 (falla)
- Cubre: R1.3
- Precondiciones: canal simulado que responde `codigo_no_activo` a `leer` y a `guardar`.
- Pasos:
  1. Abrir `/es/revision?r=<código válido>`.
  2. Marcar "Correcto" en un campo de una ficha.
- Condición observable: se ve "Tu código no está activo; escribe al editor" y el simulador no registra ningún `guardar` aceptado.

## Flujo F2: autorizar una sola vez
Archivo: el mismo del flujo F1.

### F2-H (camino feliz)
- Cubre: R2.1, R2.4, R2.6
- Precondiciones: canal simulado sin autorización registrada para el código.
- Pasos:
  1. Entrar con el enlace y marcar "Correcto" en un campo.
  2. En el diálogo, marcar la autorización y continuar.
  3. Abrir el mismo enlace en un contexto nuevo (otro equipo) con el canal simulado que ya devuelve esa autorización, y marcar otro campo.
- Condición observable: en el paso 1 aparece el diálogo con la casilla obligatoria (Ley 1581) y la casilla opcional del vago; el simulador recibe `autorizar` con la versión vigente; en el paso 3 el diálogo no aparece. En ningún paso hay campos de nombre, correo, profesión ni universidad.

### F2-E1 (falla)
- Cubre: R2.2
- Precondiciones: como F2-H.
- Pasos:
  1. Entrar, marcar un campo y, con el diálogo abierto, no marcar la autorización.
- Condición observable: el botón para continuar está deshabilitado y el simulador no recibió ninguna petición `autorizar` ni `guardar`.

### F2-E2 (falla)
- Cubre: R2.2
- Precondiciones: como F2-H.
- Pasos:
  1. Entrar, marcar un campo y cerrar el diálogo sin aceptar (Escape o "Cerrar").
- Condición observable: la respuesta queda solo en el equipo (pendiente), no hay "Guardado ✓" y el simulador no recibió `guardar`.

## Flujo F3: guardado automático
Archivo: el mismo del flujo F1.

### F3-H (camino feliz)
- Cubre: R3.1, R3.2, R3.7
- Precondiciones: código con autorización vigente en el simulador.
- Pasos:
  1. Entrar con el enlace y marcar "Correcto" en un campo.
- Condición observable: el simulador recibe `guardar` con esa respuesta a más tardar 3 s después del cambio; el panel muestra "Guardando..." y luego "Guardado ✓"; en ningún momento aparecen "Enviar", "Abrir formulario" ni "Sí, lo envié".

### F3-E1 (falla)
- Cubre: R3.5
- Precondiciones: simulador que falla (red) en `guardar`.
- Pasos:
  1. Marcar un campo; ver que queda pendiente.
  2. Recargar la página con el simulador ya sano.
- Condición observable: tras recargar, la respuesta pendiente se envía sola y el panel muestra "Guardado ✓".

### F3-E2 (falla)
- Cubre: R3.4 (visible), R3.7
- Precondiciones: simulador sin conexión.
- Pasos:
  1. Marcar un campo y esperar el primer intento.
- Condición observable: el panel muestra "Sin conexión: se guardará cuando vuelva", la respuesta sigue pendiente y no aparece ningún paso de envío.

## Flujo F4: seguir en otro equipo
Archivo: el mismo del flujo F1.

### F4-H (camino feliz)
- Cubre: R4.1, R4.4
- Precondiciones: simulador que devuelve en `leer` dos respuestas guardadas del código.
- Pasos:
  1. Abrir el enlace en un contexto nuevo.
- Condición observable: en menos de 5 s las dos respuestas aparecen marcadas en sus campos; no existen los botones "Descargar respaldo" ni "Cargar respaldo".

### F4-E1 (falla)
- Cubre: R4.1 (validación de entrada externa, R6.6)
- Precondiciones: simulador que devuelve en `leer` una respuesta válida y otra malformada (clave inexistente o veredicto inventado).
- Pasos:
  1. Abrir el enlace.
- Condición observable: solo la respuesta válida aparece; la malformada no se muestra ni rompe la página.

### F4-E2 (falla)
- Cubre: R4.1
- Precondiciones: el equipo ya tiene una respuesta local más reciente que la del canal para el mismo campo.
- Pasos:
  1. Abrir el enlace.
- Condición observable: el campo muestra la versión local (la más reciente) y no se pisa con la del canal.

## Flujo F5: qué revisar según la casilla del vago
Archivo: `e2e/revision-canal.spec.ts` o `e2e/trazos-vago.spec.ts`.

### F5-H (camino feliz)
- Cubre: R5.2, R5.3
- Precondiciones: código con autorización sin la casilla del vago.
- Pasos:
  1. Abrir "Qué revisar": no hay trazos del vago.
  2. Marcar la casilla del vago en el menú de acciones del modo revisión.
- Condición observable: el simulador recibe `autorizar` con `vago: true` y "Qué revisar" ahora incluye los trazos y las rutas del vago.

### F5-E1 (falla)
- Cubre: R5.1
- Precondiciones: código sin la casilla del vago.
- Pasos:
  1. Abrir "Qué revisar" y buscar los trazos del vago.
- Condición observable: no aparecen trazos ni rutas trazadas del vago.

### F5-E2 (falla)
- Cubre: R5.3
- Precondiciones: simulador que falla en `autorizar`.
- Pasos:
  1. Intentar marcar la casilla del vago.
- Condición observable: la casilla vuelve a su estado anterior y "Qué revisar" no cambia.

## Flujo F6: respaldo si el canal falla
Archivo: `e2e/revision-canal.spec.ts` o `e2e/respaldo.spec.ts`.

### F6-H (camino feliz)
- Cubre: R7.1
- Precondiciones: simulador sin conexión; reloj de Playwright controlado.
- Pasos:
  1. Marcar un campo y avanzar el reloj 10 min sin confirmaciones.
- Condición observable: aparece "Enviar por formulario" (no antes de los 10 min) y abre el formulario de revisión con la carga `v:2`.

### F6-E1 (falla)
- Cubre: R7.2
- Precondiciones: canal no configurado (URL del canal vacía).
- Pasos:
  1. Entrar con el enlace y marcar un campo.
- Condición observable: no aparece el diálogo de autorización ni ninguna petición al canal; el envío usa el formulario como hoy.

### F6-E2 (falla)
- Cubre: R7.1
- Precondiciones: simulador sano que confirma todo.
- Pasos:
  1. Marcar campos y avanzar el reloj más de 10 min.
- Condición observable: "Enviar por formulario" no aparece.

## Flujo F7: revisión visible sin datos personales
Archivo: `e2e/atlas.spec.ts` o uno nuevo.

### F7-H (camino feliz)
- Cubre: R9.1, R9.2
- Precondiciones: una ficha marcada como verificada en `src/data/` (si no hay ninguna en los datos actuales, el caso se reporta como no ejecutable y no se inventa contenido).
- Pasos:
  1. Abrir esa ficha fuera del modo revisión, en es y en en.
- Condición observable: se ve "Revisado por un docente universitario" con la fecha, y ningún nombre, código ni alias de revisor en la página.

### F7-E1 (falla)
- Cubre: R9.2
- Precondiciones: ninguna.
- Pasos:
  1. Recorrer las vistas públicas (inicio, una ficha sin verificar, licencia) en es y en.
- Condición observable: el texto de la página no contiene alias del padrón (formato `D` más dos cifras) ni la palabra "revisor" seguida de un nombre.

### F7-E2 (falla)
- Cubre: R9.1
- Precondiciones: una ficha verificada solo en un idioma (si existe en los datos).
- Pasos:
  1. Abrirla en el otro idioma.
- Condición observable: en el idioma sin verificar no aparece "Revisado por un docente universitario".

## Cobertura
| Criterio | Casos |
|---|---|
| R1.1 | F1-H |
| R1.2 | F1-E1 |
| R1.3 | F1-E2 |
| R2.1 | F2-H |
| R2.2 | F2-E1, F2-E2 |
| R2.4 | F2-H |
| R2.6 | F2-H |
| R3.1 | F3-H |
| R3.2 | F3-H |
| R3.5 | F3-E1 |
| R3.7 | F3-H, F3-E2 |
| R4.1 | F4-H, F4-E1, F4-E2 |
| R4.4 | F4-H |
| R5.1 | F5-E1 |
| R5.2 | F5-H |
| R5.3 | F5-H, F5-E2 |
| R7.1 | F6-H, F6-E2 |
| R7.2 | F6-E1 |
| R9.1 | F7-H, F7-E2 |
| R9.2 | F7-H, F7-E1 |

Criterios [e2e] sin cubrir: ninguno. Los casos que ya existen en la suite cuentan si su condición observable es la de este plan; solo se escriben los que falten.
