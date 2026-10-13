# Requirements: Planos de corte (F8)

Status: approved  |  Date: 2026-10-13  |  Spec: docs/specs/01-cutting-planes/
Brief: docs/brief.md  |  ADRs: docs/adr/0011-relleno-corte-caras-traseras.md  |  Issue: #9

## Context
Un estudiante de psicología entiende la relación entre estructuras profundas (tálamo, ventrículos, núcleos de la base) cuando ve el cerebro cortado, como en las láminas y las imágenes de resonancia que usa en clase. Hoy el atlas solo se desarma hacia afuera. F8 agrega tres planos (sagital, coronal y axial), combinables, que cortan el cerebro armado y muestran la cara del corte con el color de cada pieza. Es del hito 2 y refuerza el diferencial de circuitos funcionales: los circuitos se recorren por dentro.

## Users
- Estudiante: mover un plano por el cerebro, ver qué estructura queda en cada punto del corte y su nombre.
- Docente: preparar un corte y compartirlo por enlace con la clase.
- Docente revisor (F24): ninguno nuevo; el modo revisión sigue igual con o sin cortes.

## Out of scope
- Planos en cualquier ángulo (oblicuos): más difíciles de usar y de medir; el piloto pide los tres anatómicos (docs/v2.md).
- Cortar el vago y los órganos de referencia: un corte axial a la altura del tórax deja el cerebro intacto y el deslizador tendría que recorrer 1,5 m de cuerpo en vez del cerebro (decisión 3). Siguen enteros.
- Cortes con explosión: cortar piezas separadas no corresponde a ningún corte anatómico (decisión 1). Cortar arma el cerebro.
- Relleno de la corteza con bordes abiertos: los giros corticales tienen de 2 a 11 bordes abiertos (fase 0) y el relleno se filtra; se muestra el contorno (decisión 2).
- Etiquetas 3D permanentes sobre el corte: son F18, fase 2.

## Existing behavior to preserve
- La posición de cada pieza en el mundo nunca cambia: verificado por `tests/explosion.test.ts` y `npm run check:modelo` `[unit]`
- Fragmentar y reensamblar devuelven cada pieza a su sitio: verificado por `e2e/atlas.spec.ts` ("fragmentar y reensamblar") `[e2e]`
- El recorrido del vago revela el nervio parada por parada con su propio plano de recorte: verificado por `tests/recorrido.test.ts` y `e2e/atlas.spec.ts` ("el vago no se separa...") `[e2e]`
- El acabado punteado de la geometría aproximada se descarta después del recorte: verificado por `tests/origen.test.ts` `[unit]`
- Los enlaces sin `corte` se leen y se generan igual que hoy: verificado por `tests/enlaces.test.ts` `[unit]`
- Tocar una pieza la selecciona y abre su ficha: verificado por `e2e/atlas.spec.ts` ("modo estudio...") `[e2e]`
- Paneles, explosión y brújula no se tapan entre sí en escritorio y en celular: verificado por `e2e/atlas.spec.ts` ("modo estudio..." y "celular (390 x 844)") `[e2e]`
- Si el modelo o WebGL fallan, el árbol, la búsqueda y las fichas siguen: verificado por `e2e/atlas.spec.ts` ("si el modelo no carga...", "si WebGL falla...") `[e2e]`

## R1: Planos combinables
Como estudiante, quiero mover un plano sagital, uno coronal y uno axial por el cerebro, juntos o por separado, para verlo por dentro desde los ejes con que se estudia.

- R1.1 El sistema deberá ofrecer exactamente tres planos, sagital, coronal y axial, cada uno con su propio interruptor y su propio deslizador. `[e2e]`
- R1.2 El sistema deberá tomar el rango de cada deslizador de la caja del cerebro medida en el modelo cargado, de un borde al otro en ese eje, con pasos de 1 mm. `[unit]`
- R1.3 Cuando la persona activa un plano, el sistema deberá ponerlo en el centro de la caja del cerebro (0 mm). `[unit]`
- R1.4 Mientras dos o tres planos estén activos, el sistema deberá esconder lo que quede del lado oculto de cualquiera de ellos. `[unit]`
- R1.5 El sistema deberá mostrar la posición de cada plano activo en milímetros con su dirección anatómica, por ejemplo "12 mm anterior" o "8 mm inferior". `[unit]`
- R1.6 Cuando la persona usa "Invertir" en un plano, el sistema deberá esconder el lado contrario de ese plano sin moverlo. `[unit]`
- R1.7 El sistema deberá esconder por defecto el lado positivo de cada plano: izquierdo (sagital), anterior (coronal) y superior (axial). `[unit]`
- R1.8 Cuando la persona usa "Quitar cortes", el sistema deberá desactivar los tres planos y mostrar el cerebro entero. `[e2e]`
- R1.9 El sistema deberá permitir mover cada deslizador con el teclado (flechas de 1 mm) y anunciar su valor a lectores de pantalla. `[e2e]`

## R2: Solo se corta el cerebro, siempre armado
Como estudiante, quiero que el corte se haga sobre el cerebro armado, para que lo que veo corresponda a un corte anatómico real.

- R2.1 El sistema deberá aplicar los planos solo a las piezas del encéfalo; el vago y los órganos de referencia deberán verse enteros con cualquier corte activo. `[unit]`
- R2.2 Cuando la persona activa el primer plano con piezas separadas, el sistema deberá reensamblar todas las piezas antes de mostrar el corte. `[unit]`
- R2.3 Mientras haya al menos un plano activo, el sistema deberá deshabilitar la explosión, el inventario y "Separar", con un texto que diga que se desactivan mientras haya cortes. `[e2e]`
- R2.4 Cuando la persona desactiva el último plano, el sistema deberá habilitar de nuevo la explosión, el inventario y "Separar". `[unit]`
- R2.5 El sistema deberá cortar sin cambiar la posición ni la geometría de ninguna pieza: al quitar los cortes, cada pieza deberá quedar en la misma posición que antes de activarlos. `[unit]`
- R2.6 Mientras haya cortes activos, el sistema deberá respetar las piezas ocultas, el aislamiento y el grupo activo: lo oculto sigue oculto y lo aislado sigue aislado. `[unit]`

## R3: Cara del corte
Como estudiante, quiero que el corte se vea sólido y con el color de cada estructura, para reconocer qué hay en cada punto.

- R3.1 Donde la pieza cortada sea una malla cerrada (núcleos subcorticales, ventrículos y demás piezas sin bordes abiertos), el sistema deberá rellenar la cara del corte con el color de esa pieza. `[manual]` (reason: el relleno se ve en la GPU; se revisa en los equipos de referencia y con capturas del prototipo)
- R3.2 El sistema deberá decidir qué piezas se rellenan a partir de una lista de mallas cerradas medida en el modelo, y esa lista deberá coincidir con las mallas del GLB que no tienen bordes abiertos. `[integration]`
- R3.3 Donde la pieza cortada tenga bordes abiertos (giros corticales), el sistema deberá mostrar el contorno del corte resaltado con el color de la pieza, sin relleno. `[manual]` (reason: resultado visual en la GPU, sin oráculo automático fiable)
- R3.4 Si el relleno se apaga (R8.2) o sus materiales no compilan en el equipo, entonces el sistema deberá mostrar el contorno resaltado en todas las piezas cortadas, sin relleno y sin errores en consola. `[unit]`
- R3.5 Cuando se hace un corte coronal a la altura del tálamo, el sistema deberá mostrar el tálamo, los ventrículos laterales y el núcleo caudado cortados, con relleno y su nombre al pasar el cursor (criterio de F8 en SPEC.md). `[e2e]`

## R4: Nombre al tocar el corte
Como estudiante, quiero pasar el cursor o tocar la cara del corte y ver el nombre de la estructura, para aprender qué estoy viendo.

- R4.1 Cuando el cursor pasa sobre la cara del corte de una pieza, el sistema deberá mostrar el nombre de esa pieza en el idioma de la interfaz. `[e2e]`
- R4.2 Cuando la persona toca la cara del corte de una pieza, el sistema deberá seleccionarla y abrir su ficha, igual que al tocar su superficie. `[e2e]`
- R4.3 Si la persona toca un punto que solo tiene geometría del lado oculto, entonces el sistema no deberá seleccionar ninguna pieza de ese lado. `[unit]`

## R5: Lado cortado como fantasma
Como estudiante, quiero ver el lado que quitó el corte de forma tenue, para no perder la orientación.

- R5.1 El sistema deberá esconder por defecto el lado cortado. `[unit]`
- R5.2 Mientras el interruptor "Fantasma" esté activo, el sistema deberá dibujar el lado cortado translúcido, con opacidad de 0,25 o menos. `[unit]`
- R5.3 Mientras el fantasma esté activo, el sistema no deberá seleccionar piezas al tocar el lado cortado. `[unit]`

## R6: Panel de cortes
Como estudiante, quiero abrir los cortes desde el mismo sitio que los demás paneles, para encontrarlos sin buscar.

- R6.1 En escritorio, el sistema deberá mostrar un botón "Cortes" en el riel que abre y cierra un panel flotante con los tres planos, "Invertir", "Fantasma" y "Quitar cortes". `[e2e]`
- R6.2 En celular (390 x 844), el sistema deberá abrir los cortes como un cajón inferior desde el encabezado. `[e2e]`
- R6.3 El sistema deberá mostrar el panel de cortes sin tapar la explosión, la brújula ni la ficha, en escritorio y en celular. `[e2e]`
- R6.4 Mientras el panel de cortes esté abierto, el sistema deberá mostrar el aviso: el modelo viene de un solo cuerpo y no de resonancias; los cortes orientan, pero no reemplazan un atlas de neuroimagen. `[e2e]`
- R6.5 Cuando el panel está abierto, si la persona pulsa Escape, entonces el sistema deberá cerrar el panel y conservar los cortes activos. `[e2e]`
- R6.6 Si el modelo no cargó o WebGL falló, entonces el sistema deberá mostrar el botón "Cortes" deshabilitado. `[e2e]`
- R6.7 El sistema deberá mostrar todos los textos nuevos en español y en inglés. `[unit]`

## R7: Compartir un corte
Como docente, quiero compartir un enlace con mis cortes, para que la clase vea exactamente el mismo.

- R7.1 Cuando la persona comparte la vista con cortes activos, el sistema deberá incluir en el enlace `corte=` con cada plano activo como `plano:mm` (mm enteros desde el centro de la caja del cerebro, con signo) y `:inv` si está invertido, separados por comas. Ejemplo: `corte=coronal:12,axial:-8:inv`. `[unit]`
- R7.2 Cuando se abre un enlace con `corte=`, el sistema deberá activar esos planos en esas posiciones una vez cargado el modelo. `[e2e]`
- R7.3 Si una entrada de `corte=` está mal escrita, repite un plano o queda fuera del rango del cerebro, entonces el sistema deberá ignorar solo esa entrada y aplicar las demás, sin mensaje de error. `[unit]`
- R7.4 Si un enlace trae `corte=` y además un nivel de explosión, entonces el sistema deberá aplicar los cortes y dejar el cerebro armado. `[unit]`

## R8: Rendimiento medido
Como estudiante con un equipo modesto, quiero que el corte se mueva fluido, o al menos que no se trabe.

- R8.1 Con tres planos activos y relleno, el sistema deberá mantener 30 cuadros por segundo o más en los tres equipos de referencia, medidos con `?medir=1`. `[manual]` (reason: requiere los equipos físicos de referencia; los resultados se pegan en #6)
- R8.2 Si con cortes activos el promedio cae por debajo de 30 cuadros por segundo durante 5 segundos seguidos, entonces el sistema deberá apagar el relleno en ese equipo, dejar el contorno y avisarlo una vez en el panel. `[unit]`
- R8.3 Mientras no haya ningún plano activo, el sistema no deberá agregar trabajo de dibujo por los cortes (sin pasadas de relleno ni planos en los materiales). `[unit]`

## R9: Convivencia con el recorrido del vago
Como estudiante, quiero seguir el recorrido del vago aunque tenga el cerebro cortado.

- R9.1 Mientras haya cortes activos, cuando la persona inicia el recorrido del vago, el sistema deberá mantener los cortes del cerebro y revelar el vago parada por parada como hoy. `[e2e]`

## Verification summary
| Tag | Count |
|---|---|
| unit | 22 |
| integration | 1 |
| e2e | 15 |
| eval | 0 |
| manual | 3 |
