<!-- rockbuilt:test-plan. Derivado solo del spec, nunca del código. -->
# Plan de pruebas: Planos de corte (F8)

Spec: [requirements.md](requirements.md), [design.md](design.md)  |  Fecha: 2026-10-17  |  Se corre con: `npm run test:e2e`

## Entorno
- URL de la app: http://localhost:3000 (la levanta el `webServer` de Playwright con `npm run dev`).
- Datos: el modelo y los datos del repositorio (`public/modelos/atlas.glb`, `src/data/*.json`); no hay base de datos ni semilla.
- Usuarios y credenciales: ninguno (la app es pública; los cortes no piden sesión).
- Autenticación: no aplica. El aviso de primera visita se da por visto con `localStorage` (`atlas:aviso-visto`).
- Las pruebas que solo necesitan los controles (no la imagen) pueden abortar el modelo; las que miran el corte necesitan el modelo cargado.

Cobertura previa: cada tarea dejó su E2E (`cortes-visor`, `cortes-enlace`, `cortes-relleno`, `cortes-panel`, `cortes-movil`, `cortes-marcadores`). Este plan es por flujo de usuario, de punta a punta; el escritor de E2E reutiliza lo existente donde ya cubre el caso y escribe solo lo que falte, en `e2e/cortes-flujos.spec.ts`.

## Flujo F1: cortar el cerebro desde el panel (escritorio)
Archivo: `e2e/cortes-flujos.spec.ts`

### F1-H (camino feliz)
- Cubre: R1.1, R1.5, R1.8, R1.9, R6.1, R6.4
- Precondiciones: escritorio (1280 x 800), modelo cargado, sin cortes.
- Pasos:
  1. Abrir `/es` y pulsar "Cortes" en el riel.
  2. Activar el plano coronal y el axial.
  3. Con el foco en el deslizador coronal, pulsar dos veces flecha derecha.
  4. Pulsar "Quitar cortes".
- Condición de paso (observable): el panel muestra exactamente tres filas (sagital, coronal y axial), cada una con interruptor y deslizador, más "Invertir", "Fantasma" y "Quitar cortes"; con el panel abierto se ve el aviso de que el modelo viene de un solo cuerpo y no reemplaza un atlas de neuroimagen; tras las dos flechas el valor del deslizador sube 2 mm y su etiqueta y su `aria-valuetext` dicen la posición en mm con dirección anatómica; después de "Quitar cortes" los tres interruptores quedan apagados y el cerebro se ve entero.

### F1-E1 (Escape cierra el panel y no quita los cortes)
- Cubre: R6.5
- Precondiciones: panel abierto con un plano activo.
- Pasos:
  1. Pulsar Escape.
- Condición de paso (observable): el panel se cierra y el plano sigue activo (el corte se sigue viendo y, al reabrir el panel, su interruptor está encendido).

### F1-E2 (sin modelo, el botón está deshabilitado)
- Cubre: R6.6
- Precondiciones: el modelo no carga (petición del GLB abortada).
- Pasos:
  1. Abrir `/es`.
- Condición de paso (observable): el botón "Cortes" del riel está deshabilitado; el árbol, la búsqueda y las fichas siguen funcionando.

## Flujo F2: el corte se hace sobre el cerebro armado
Archivo: `e2e/cortes-flujos.spec.ts`

### F2-H (camino feliz)
- Cubre: R2.2, R2.3
- Precondiciones: escritorio, modelo cargado, piezas separadas con la explosión.
- Pasos:
  1. Mover la explosión para separar las piezas.
  2. Activar un plano.
- Condición de paso (observable): el cerebro vuelve a quedar armado (explosión en 0 %); el deslizador de explosión, "Reensamblar" y "Separar" están deshabilitados y se ve "Se desactivan mientras haya cortes".

### F2-E1 (al quitar el último plano todo vuelve a habilitarse)
- Cubre: R2.4, R1.8
- Precondiciones: un plano activo.
- Pasos:
  1. Desactivar el plano.
- Condición de paso (observable): la explosión, "Reensamblar" y "Separar" quedan habilitados y el texto desaparece.

### F2-E2 (el vago no se corta y su recorrido sigue con cortes)
- Cubre: R9.1
- Precondiciones: un corte axial activo.
- Pasos:
  1. Iniciar el recorrido del vago y avanzar dos paradas.
- Condición de paso (observable): el vago se revela parada por parada como sin cortes, y el corte del cerebro sigue activo durante todo el recorrido.

## Flujo F3: reconocer las estructuras en la cara del corte
Archivo: `e2e/cortes-flujos.spec.ts`

### F3-H (camino feliz)
- Cubre: R3.5, R4.1, R4.2
- Precondiciones: escritorio, modelo cargado, corte coronal a la altura del tálamo.
- Pasos:
  1. Pasar el cursor por la cara del corte del tálamo, de un ventrículo lateral y del núcleo caudado.
  2. Tocar la cara del corte del tálamo.
- Condición de paso (observable): al pasar el cursor aparece el nombre de cada una de las tres estructuras en español; al tocar, el tálamo queda seleccionado y se abre su ficha.

### F3-E1 (tocar del lado oculto no selecciona)
- Cubre: R4.3
- Precondiciones: corte coronal activo, sin fantasma.
- Pasos:
  1. Tocar un punto de la pantalla donde solo hay geometría del lado oculto del plano.
- Condición de paso (observable): no se selecciona ninguna pieza y no se abre ficha.

### F3-E2 (el fantasma se ve pero no se toca)
- Cubre: R5.2, R5.3
- Precondiciones: corte coronal activo.
- Pasos:
  1. Activar "Fantasma".
  2. Tocar el lado cortado.
- Condición de paso (observable): el lado cortado se dibuja translúcido; el toque no selecciona ninguna pieza de ese lado.

## Flujo F4: compartir un corte por enlace
Archivo: `e2e/cortes-flujos.spec.ts`

### F4-H (camino feliz)
- Cubre: R7.1, R7.2
- Precondiciones: modelo cargado.
- Pasos:
  1. Abrir `/es?corte=coronal:12,axial:-8:inv`.
  2. Pulsar "Compartir".
- Condición de paso (observable): una vez cargado el modelo, el coronal está activo en 12 mm y el axial en -8 mm invertido (lo dice el panel); el enlace que da "Compartir" trae `corte=` con esos mismos planos.

### F4-E1 (una entrada mal escrita se ignora sola)
- Cubre: R7.3
- Precondiciones: ninguna.
- Pasos:
  1. Abrir `/es?corte=coronal:12,oblicuo:3,axial:9999`.
- Condición de paso (observable): solo el coronal queda activo, en 12 mm; no hay mensaje de error ni errores en consola.

### F4-E2 (con explosión en el enlace, el cerebro queda armado)
- Cubre: R7.4
- Precondiciones: ninguna.
- Pasos:
  1. Abrir un enlace con `corte=coronal:0` y un nivel de explosión.
- Condición de paso (observable): el coronal está activo y el cerebro está armado (explosión en 0 %).

## Flujo F5: cortes en el celular
Archivo: `e2e/cortes-flujos.spec.ts`

### F5-H (camino feliz)
- Cubre: R6.2, R6.3
- Precondiciones: celular 390 x 844, modelo cargado.
- Pasos:
  1. Abrir `/es` y pulsar el botón de cortes del encabezado.
  2. Activar un plano y abrir la ficha de una pieza.
- Condición de paso (observable): los cortes se abren como un cajón inferior que cabe en la pantalla; el cajón, el panel de fragmentar, la brújula y la ficha no se tapan entre sí.

### F5-E1 (Escape cierra el cajón y conserva los cortes)
- Cubre: R6.5 (celular)
- Precondiciones: cajón abierto con un plano activo.
- Pasos:
  1. Pulsar Escape.
- Condición de paso (observable): el cajón se cierra y el plano sigue activo.

### F5-E2 (sin modelo, el botón está deshabilitado)
- Cubre: R6.6 (celular)
- Precondiciones: celular 390 x 844, el modelo no carga.
- Pasos:
  1. Abrir `/es`.
- Condición de paso (observable): el botón de cortes del encabezado está deshabilitado.

## Cobertura
| Criterio | Caso(s) |
|---|---|
| R1.1 | F1-H |
| R1.8 | F1-H, F2-E1 |
| R1.9 | F1-H |
| R2.3 | F2-H |
| R3.5 | F3-H |
| R4.1 | F3-H |
| R4.2 | F3-H |
| R6.1 | F1-H |
| R6.2 | F5-H |
| R6.3 | F5-H |
| R6.4 | F1-H |
| R6.5 | F1-E1, F5-E1 |
| R6.6 | F1-E2, F5-E2 |
| R7.2 | F4-H |
| R9.1 | F2-E2 |

Además se observan de punta a punta criterios marcados `[unit]`: R1.5 (F1-H), R2.2 y R2.4 (F2), R4.3 (F3-E1), R5.2 y R5.3 (F3-E2), R7.1, R7.3 y R7.4 (F4).

Criterios `[e2e]` sin cubrir: ninguno. Los `[manual]` (R3.1 y R3.3, relleno y contorno en la GPU; R8.1, 30 cuadros por segundo en los equipos de referencia) quedan fuera de E2E; R8.1 se midió en #42 y el rendimiento en gama baja se cerró como está (decisión del editor del 2026-10-16).
