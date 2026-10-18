<!-- rockbuilt:test-plan. Derivado solo del spec, nunca del código. -->
# Plan de pruebas: Propuestas para la sesión docente (marcadores y trazos del vago)

Spec: [requirements.md](requirements.md), [design.md](design.md)  |  Fecha: 2026-10-18  |  Se corre con: `npm run test:e2e`

## Entorno
- URL de la app: la del servidor de desarrollo que levanta `playwright.config.ts` (`webServer`, `npm run dev`).
- Datos: el modelo y los datos del repositorio (`public/modelos/atlas.glb`, `src/data/marcadores.json`, `src/data/trazos-vago.json`); no hay base de datos ni semilla. Las pruebas leen del propio archivo de datos qué marcador es par, cuál tiene ancla y qué trazo trae propuesta, en vez de fijar coordenadas.
- Modo revisión: se entra con `/es/revision?r=<código>` o `/en/revision?r=<código>`, con un código de prueba inventado (8 caracteres válidos), nunca uno del padrón.
- Canal de retorno: **simulado siempre** con una ruta de Playwright que habla el protocolo del Apps Script (como en el plan de la spec 03). El canal real del editor nunca se llama (`protegerCanalReal()` de `e2e/canal-real.ts`).
- Credenciales: ninguna. El aviso de primera visita se da por visto antes de cada prueba.

Cobertura previa: cada tarea dejó su E2E (`marcadores.spec.ts` para R3, `trazos-vago.spec.ts` y las pruebas del modo revisión para R5). Este plan es por flujo de usuario, de punta a punta; el escritor de E2E reutiliza lo existente donde ya cubre el caso y escribe solo lo que falte, en `e2e/propuestas-docentes.spec.ts`.

## Flujo F1: los marcadores siguen a su pieza al separar y armar
Archivo: `e2e/propuestas-docentes.spec.ts`

### F1-H (camino feliz)
- Cubre: R3.1, R3.2
- Precondiciones: escritorio, modelo cargado, piezas armadas; un marcador con `ancla` y posición propia (tomado de `src/data/marcadores.json`).
- Pasos:
  1. Anotar dónde se dibuja el marcador.
  2. Separar las piezas (explosión al máximo).
  3. Volver a armar ("Reensamblar").
- Condición de paso (observable): con las piezas separadas, el marcador se desplazó exactamente lo mismo que su pieza ancla (diferencia de 0,1 mm o menos entre los dos desplazamientos) y no quedó en su sitio original; al armar, el marcador vuelve exactamente (0,1 mm o menos) a la posición escrita en `marcadores.json`.

### F1-E1 (marcador sin posición propia: se conserva lo de antes)
- Cubre: comportamiento a preservar ("un marcador con ancla y sin posición se dibuja en el centro de su pieza y sigue la fragmentación")
- Precondiciones: un marcador con `ancla` y `posicion: null` en los datos; si ya no queda ninguno, la prueba lo dice con `test.skip` y el motivo (no se inventa uno).
- Pasos:
  1. Separar las piezas.
  2. Volver a armar.
- Condición de paso (observable): armado, el punto está en el centro de su pieza ancla; separado, se mueve con ella; al armar vuelve al centro.

### F1-E2 (marcador par: un punto por lado y cada uno sigue a su lado)
- Cubre: R3.3, R3.1
- Precondiciones: un marcador con una posición por lado (`{ l, r }`) y ancla.
- Pasos:
  1. Mirar el modelo armado.
  2. Separar las piezas.
- Condición de paso (observable): se dibujan exactamente dos puntos para ese marcador, uno a cada lado de la línea media (coordenada lateral de signo opuesto), cada uno en la posición escrita para su lado; separado, ninguno de los dos queda en su posición original y ninguno cruza la línea media.

## Flujo F2: el docente revisa un trazo del vago con su propuesta
Archivo: `e2e/propuestas-docentes.spec.ts`

### F2-H (camino feliz)
- Cubre: R5.1, R5.3
- Precondiciones: modo revisión en español con canal simulado que responde `leer` sin respuestas; un trazo cuya `propuesta` no está vacía en `trazos-vago.json`.
- Pasos:
  1. Abrir ese trazo desde "Qué revisar" (sección de trazos del vago) o tocándolo.
  2. Leer el bloque de propuesta.
  3. Pulsar "Correcto, es lo propuesto" una sola vez.
  4. Recargar la página.
- Condición de paso (observable): junto al control se ven el nombre del ramo propuesto, la confianza (alta, media o baja), la evidencia y la fuente de ese trazo, en español y tal como están en los datos; un solo toque deja la respuesta marcada como confirmación de la propuesta (el canal simulado recibe un `guardar` con esa respuesta y la app muestra "Guardado"); tras recargar, la respuesta sigue marcada.

### F2-E1 (trazo sin propuesta: no hay nada que confirmar)
- Cubre: R5.1 (y R4.4 como lo ve el docente)
- Precondiciones: modo revisión; un trazo con `propuesta` vacía.
- Pasos:
  1. Abrir ese trazo.
- Condición de paso (observable): se ve "Sin propuesta de la auditoría" junto con la evidencia del trazo, y no aparece el botón "Correcto, es lo propuesto"; el docente puede igual elegir un ramo de la lista, "no es un ramo" o "no sé".

### F2-E2 (en inglés, todo en el idioma activo)
- Cubre: R5.1
- Precondiciones: modo revisión en `/en/revision`, el mismo trazo con propuesta de F2-H.
- Pasos:
  1. Abrir el trazo.
- Condición de paso (observable): la propuesta, la confianza, la evidencia y el botón de confirmar están en inglés (la evidencia completa es la de `evidencia.en`) y no aparece ningún texto de la versión en español.

## Flujo F3: el docente revisa la posición de un marcador
Archivo: `e2e/propuestas-docentes.spec.ts`

### F3-H (camino feliz)
- Cubre: R5.2, R5.3
- Precondiciones: modo revisión en español con canal simulado; un marcador `aproximada` con `fuente_ubicacion`.
- Pasos:
  1. Abrir la ficha del marcador (árbol o búsqueda).
  2. Pulsar "Correcto, la posición propuesta está bien".
  3. Pulsarlo otra vez.
- Condición de paso (observable): junto a "Proponer posición" se ven el método y la fuente de la posición (el texto de `fuente_ubicacion.es`); el primer toque deja la confirmación guardada (el canal simulado la recibe) sin pedir coordenadas; el segundo toque la deshace (el canal simulado recibe el retiro y el botón vuelve a su estado inicial).

### F3-E1 (con una posición ya propuesta, "Correcto" no aparece)
- Cubre: R5.3 (regla de SPEC.md F24: "Correcto" no aparece cuando ya propuso una posición)
- Precondiciones: modo revisión; el mismo marcador.
- Pasos:
  1. Pulsar "Proponer posición" y tocar un punto del modelo.
- Condición de paso (observable): la propuesta del docente queda registrada y el botón "Correcto, la posición propuesta está bien" ya no está; los datos de `src/data/` no cambian (la posición dibujada del marcador sigue siendo la de los datos).

### F3-E2 (fuera del modo revisión no hay confirmación)
- Cubre: R5.2, R5.3 (límite: solo el docente confirma)
- Precondiciones: visitante normal en `/es`, sin código.
- Pasos:
  1. Abrir la ficha del mismo marcador.
- Condición de paso (observable): la ficha no muestra "Correcto, la posición propuesta está bien" ni "Proponer posición"; el marcador se sigue viendo con su aviso de posición aproximada.

## Cobertura
| Criterio | Caso(s) |
|---|---|
| R3.1 | F1-H, F1-E2 |
| R3.2 | F1-H |
| R3.3 | F1-E2 |
| R5.1 | F2-H, F2-E1, F2-E2 |
| R5.2 | F3-H, F3-E2 |
| R5.3 | F2-H, F3-H, F3-E1 |
| Comportamiento a preservar (centro de la pieza) | F1-E1 |

Criterios [e2e] sin cubrir: ninguno.
