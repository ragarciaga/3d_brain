# Spec: Atlas 3D de cerebro y nervio vago

Nombre: Maysa Brain (decidido por el editor el 12 de octubre de 2026). Versión 0.3, 11 de octubre de 2026.

**Cambios frente a la versión 0.2**

- Fase 0 verificada sobre Z-Anatomy (inventario completo en `docs/research/fase-0/REPORT.md`). El vago existe, pero sus ramos vienen sin nombre dentro de una sola curva por lado y los plexos no existen. Se decide: vago como una pieza por lado más marcadores, y los ramos se nombran con revisión docente.
- La fase 1 se divide en **hito 1 (piloto con docentes)** y **hito 2 (lanzamiento público)**.
- Función nueva **F24, modo revisión docente**, en el hito 1.
- F9 (recursos por pieza) entra al hito 1. F8 (cortes) y F12 (reportar error) pasan al hito 2.
- Pipeline corregido (sección 9): los nervios son curvas, hay modificadores que aplicar, los objetos tienen padres y la invariante de posición se verifica automáticamente.
- Regla 1 reformulada: lo que nunca cambia es la posición de cada pieza en el mundo.
- Decisiones cerradas: lateralidad (separadas), licencia del contenido (CC BY-SA 4.0), hosting (GitHub Pages).
- Inventario (sección 8) anotado con lo que existe en el modelo y cómo se completa lo que falta. Los cuerpos mamilares sí están (Z-Anatomy los escribe "Mamillary body").

## 1. Propósito

Herramienta web pública y gratuita para estudiar en 3D el cerebro y el nervio vago, en español y en inglés. Permite desarmar las estructuras en piezas, cortarlas en planos, leer qué es y para qué sirve cada una, seguir circuitos funcionales, consultar recursos propios de cada pieza y autoevaluarse.

Uso educativo, no clínico. Ningún contenido se publica sin fuente y sin revisión.

## 2. Diferencial

Ya existen atlas 3D abiertos y gratuitos, como Z-Anatomy y los atlas de Open Anatomy. Esta app se diferencia en cuatro puntos:

- Circuitos funcionales pensados para psicología (Papez, vías del miedo, ganglios basales, eje vago-cerebro), además de la anatomía.
- El nervio vago integrado con el cerebro en un mismo modelo, con recorrido guiado.
- Bilingüe completo: búsqueda cruzada entre idiomas y un modo que muestra los términos en español e inglés al tiempo.
- Fichas con fuente, nivel de evidencia y revisor visible.

## 3. Usuarios y escenarios de uso

**Usuarios**

- Estudiantes de psicología, neurociencias y ciencias de la salud, en español o en inglés. Es el grupo principal.
- Docentes que quieren mostrar una estructura o un circuito en clase.
- Docentes revisores, que validan el contenido pieza por pieza (F24).
- Público general con curiosidad por el cerebro.
- Andrés, como creador y editor del contenido.

**Primeros usuarios:** un piloto con los docentes revisores y sus estudiantes (hito 1), antes de abrir al público (hito 2).

**Equipos de referencia para pruebas:** portátil HP Pavilion x360 (Iris Xe, 12 GB RAM, táctil), iPhone 12 Pro Max y al menos un Android de gama baja, porque buena parte del público estudia desde celulares económicos.

**Escenarios que la app debe resolver**

1. **Repaso del sistema límbico antes de un parcial.** Filtra el grupo, separa hipocampo, amígdala y giro cingulado, y lee la ficha de cada uno.
2. **Estudio con cortes.** Activa el corte coronal, mueve el plano y ve qué estructuras aparecen en esa altura, como en una lámina de atlas.
3. **Circuito de Papez.** Elige el circuito y la app resalta sus estructuras en orden, con la explicación de cada paso.
4. **Clase con proyector.** Una profesora comparte un enlace que abre la ínsula aislada en vista lateral.
5. **Lectura de un paper en inglés.** Una estudiante hispanohablante busca "insular cortex", la encuentra y activa el modo ambos idiomas para aprender el término en los dos.
6. **Repaso diario.** La app propone las piezas que a esa persona más le cuestan, según sus errores anteriores.
7. **Seguir el vago desde el bulbo hasta el estómago** con el recorrido guiado (por el vago derecho; ver sección 8).
8. **Revisión docente.** Un profesor abre su enlace de revisión, recorre la ficha del hipocampo campo por campo, marca lo correcto, propone cambios en lo demás y envía todo de una vez.

## 4. Alcance por fases

**Fase 0, datos.** Obtener el modelo, confirmar qué estructuras trae (en especial el vago), extraer solo cerebro, vago y órganos de referencia, y exportar los GLB. Compuerta superada el 11 de octubre de 2026: el modelo trae el vago (una curva por lado, con ramos sin nombre) y casi todo el inventario del cerebro. El resultado está en `docs/research/fase-0/REPORT.md`.

**Fase 1, hito 1: piloto con docentes.** F1 a F7, F9, F10, F11 y F24, más el aviso educativo y la pantalla de fuentes y licencia. Geometría completa del inventario de la sección 8 y 10 fichas en borrador, incluido el nervio vago.

- **Señal de éxito:** en el Android de gama baja, un estudiante fragmenta, abre fichas de 10 piezas (incluido el vago) y reensambla, a 30 cuadros por segundo o más.
- **Orden de construcción:** esqueleto, pipeline de la fase 0, F1 + F2, F4 + F5 + F9 + marcadores, F24, F6 + F7, F3 + F10 + F11.

**Fase 1, hito 2: lanzamiento público.** F8 (con prototipo de relleno por stencil primero) y F12. Meta de contenido: 40 fichas verificadas en ambos idiomas, empezando por sistema límbico, ganglios basales, diencéfalo, tronco encefálico y nervio vago. El resto de estructuras se ve y se puede buscar, pero su ficha dice "En preparación". Antes de lanzar se deciden nombre, dominio y analítica (sección 15).

**Fase 2, estudio activo.** F13 a F20: notas personales, circuitos y recorridos, quiz con repaso espaciado, rompecabezas, casos clásicos, etiquetas 3D, modo liviano e indexación en buscadores. Incluye las tareas para completar geometría faltante (sección 8).

**Fase 3, docentes y comunidad.** F21 a F23: colecciones para docentes, uso sin internet y exportar imagen. Apertura a contribuciones externas de contenido y traducción (sección 7).

**Fuera de alcance:** cuentas de usuario, backend, datos personales de usuarios en servidor, resto del cuerpo, histología, contenido clínico o diagnóstico, y geometría inventada: una estructura que no viene de una fuente abierta con licencia compatible se muestra como marcador, no como malla.

## 5. Funcionalidades

Cada función tiene un ID para referenciarla en commits, issues y prompts a Claude Code.

### Núcleo 3D (fase 1, hito 1)

#### F1. Visor 3D

- Rotar arrastrando, zoom con rueda o pellizco, desplazar con clic derecho o dos dedos.
- Botones de vista anatómica: anterior, posterior, lateral izquierda, lateral derecha, superior, inferior.
- Doble clic sobre una pieza encuadra la cámara en ella, salvo sobre una pieza separada, que la devuelve (F7).

**Criterio de aceptación:** con todas las piezas visibles, la rotación se siente fluida en los equipos de referencia y cada botón de vista lleva a la orientación correcta.

#### F2. Árbol de estructuras y grupos de estudio

Jerarquía anatómica navegable, por ejemplo: Encéfalo, Prosencéfalo, Telencéfalo, Hemisferio, Lóbulo, Giro. La jerarquía sale del modelo: Z-Anatomy ya organiza las piezas en grupos padre (por ejemplo Brain > Cerebrum > Telencephalon > Limbic lobe > Hippocampus), y `pipeline/` la exporta. El vago tiene su propia rama: ganglios, porción cervical, torácica y abdominal, con sus ramos (como marcadores mientras no se identifiquen como piezas).

- Cada nodo tiene casilla de mostrar u ocultar, contador de piezas y selección con clic.
- Marcar un nodo padre afecta a todas sus hijas.
- **Grupos de estudio** como filtros rápidos transversales a la jerarquía: Sistema límbico, Ganglios basales, Diencéfalo, Tronco encefálico, Corteza motora y sensitiva, Nervio vago. Un grupo es una etiqueta, así que una pieza puede estar en varios.

**Criterio:** ocultar "Lóbulo temporal" oculta todos sus giros; elegir "Sistema límbico" deja visibles solo sus piezas.

#### F3. Búsqueda bilingüe

- Campo siempre visible, atajo Ctrl+K.
- Busca al mismo tiempo en español, inglés, latín y sinónimos, sin importar el idioma de la interfaz.
- Tolera errores de digitación y falta de tildes.
- Cada resultado muestra su ubicación en la jerarquía ("Hipocampo, en Lóbulo límbico").
- Enter o clic sobre un resultado: resalta la pieza, encuadra la cámara y abre la ficha.

**Criterio:** con la interfaz en español, "amygdala" encuentra Amígdala; "neumogastrico" y "cranial nerve X" encuentran el nervio vago; los resultados aparecen mientras se escribe.

#### F4. Selección y ficha de pieza

Clic sobre una pieza (en el visor o en el árbol) la resalta y abre su ficha. Pasar el cursor muestra el nombre. Los marcadores (sección 6) también se seleccionan y tienen ficha.

Contenido de la ficha:

- Nombre en el idioma activo, nombre latino y, en modo ambos idiomas, el nombre en el otro idioma.
- Ubicación: dónde está y con qué limita.
- Qué es.
- Para qué sirve.
- Relaciones: estructuras conectadas, cada una clicable.
- Relevancia en psicología, con nivel de evidencia por afirmación (sección 7).
- Circuitos en los que participa (fase 2) y casos clásicos (fase 2).
- Recursos de la pieza (F9), búsquedas de artículos científicos (F9) y notas personales (F13).
- Fuentes, revisor, fecha de revisión y estado en ese idioma.
- Botón "Reportar un error" (F12, hito 2).

Acciones: Aislar, Aislar con contexto, Separar, Ocultar, Encuadrar, Compartir. Aislar, Aislar con contexto y Separar se activan con un toque y se desactivan con otro, y muestran si están activos para las piezas de la ficha (parcial si solo lo están algunas).

**Criterio:** los nervios delgados se pueden seleccionar en el celular sin atinarles con precisión (riesgo 3).

#### F5. Aislar

- **Solo esta pieza:** el resto se oculta.
- **Con contexto:** el resto queda como fantasma (transparencia alta, no seleccionable) para no perder la ubicación.

Shift+clic aísla varias piezas a la vez. Aislar un nodo del árbol aísla todas sus hijas. Esc o "Mostrar todo" sale del modo. El botón de aislar de la ficha y del árbol se alterna: un segundo toque sale del modo.

#### F6. Fragmentar

- **Explosión global:** un deslizador de 0 a 100 %. Hasta el 70 % aleja cada pieza visible del centro del conjunto (se ve de dónde sale cada una). Del 70 al 100 %, si hay 8 bloques visibles o más (con menos, la radial sigue hasta el 100 %), cada bloque viaja a su lugar en un **inventario**: repisas sobre el plano frontal, con las piezas derechas a un lado, las izquierdas en espejo al otro y las de la línea media al centro; los lóbulos quedan juntos y de arriba abajo según su altura en el encéfalo. Al entrar al inventario la cámara pasa a la vista anterior y los órganos de referencia, que no se desarman, se ocultan hasta volver por debajo del 70 %.
- **Separar por nivel:** un selector define qué tan fino se desarma: hemisferios, lóbulos o giros. Con "lóbulos", cada lóbulo se aleja como un bloque con sus giros juntos; con "giros", se separan uno por uno.
- **Separar una pieza:** desde la ficha, la pieza sale de su sitio y queda resaltada, mientras el resto sigue armado; el mismo botón, pulsado otra vez, la devuelve.

Límite real: solo se puede fragmentar hasta el nivel de detalle que trae el modelo.

**Regla técnica:** la posición original de cada pieza nunca se modifica. Fragmentar aplica un desplazamiento que se guarda aparte (sección 10).

#### F7. Reensamblar

- **Reensamblar todo:** animación corta que devuelve todas las piezas a su sitio.
- **Devolver una pieza:** con un segundo toque en Separar de la ficha, o con doble clic sobre una pieza separada.
- "Armar pieza por pieza" (tocar y reto) salió del alcance el 12 de octubre de 2026: no aportaba al estudio. Vuelve con la evaluación (F15, F16); ver `docs/v2.md`.

**Criterio:** después de reensamblar, cada pieza queda en su posición exacta original, sin error acumulado.

#### F8. Planos de corte (hito 2)

- Tres planos: axial, coronal y sagital. Cada uno tiene un deslizador para moverlo a lo largo del cerebro, y se pueden combinar.
- La superficie cortada se rellena con el color de cada pieza, para que el corte se vea sólido y no hueco.
- Pasar el cursor o tocar sobre la superficie cortada muestra el nombre de la estructura.
- Opción para ver el lado cortado como fantasma o esconderlo.
- Aviso visible: el modelo viene de un solo cuerpo y no de resonancias; los cortes orientan, pero no reemplazan un atlas de neuroimagen.

**Criterio:** un corte coronal a la altura del tálamo muestra rellenos y con nombre el tálamo, los ventrículos laterales y el núcleo caudado.

**Dato de la fase 0:** las piezas subcorticales y los ventrículos son mallas cerradas, aptas para el relleno por stencil. Los giros corticales tienen entre 2 y 11 bordes abiertos, así que el relleno puede filtrarse en la corteza. El prototipo inicial decide si se corrige o se lanza sin relleno.

### Idioma, compartir y confianza (fase 1)

#### F9. Recursos por pieza (hito 1)

Cada pieza tiene su propia lista de recursos: título, enlace, tipo (video, artículo, paper, libro, imagen), idioma y una nota corta de por qué sirve.

- Primero aparecen los recursos de la pieza y, aparte, los heredados de su nodo padre o grupo ("del grupo").
- Se filtran por idioma; los del otro idioma aparecen marcados.
- Los recursos públicos se curan en el repositorio y pasan por revisión. Los personales son parte de F13.
- **Artículos científicos:** toda estructura, grupo y marcador con nombre en inglés trae búsquedas listas por su nombre: revisiones en PubMed, acceso abierto en Europe PMC, Google Académico (inglés y español) y SciELO (español). Salen aunque la ficha esté en preparación. Son búsquedas, no contenido: la ficha avisa que el atlas no revisa los resultados. Los términos salen del nombre TA2 (más el nombre alterno del paréntesis cuando es otro nombre, no un calificativo); la lógica vive en `src/lib/articulos.ts`.

#### F10. Idiomas (hito 1)

- Interfaz completa en español e inglés. Al entrar se elige según el idioma del navegador y se puede cambiar en cualquier momento.
- Fichas, grupos, circuitos, casos y recorridos en ambos idiomas.
- **Modo ambos idiomas:** nombres y términos clave aparecen en los dos idiomas ("Amígdala / Amygdala") en árbol, ficha, etiquetas y quiz.
- El nombre latino (Terminologia Anatomica) queda siempre visible como referencia común.
- Si una ficha no está verificada en el idioma activo, la app lo avisa y ofrece la versión verificada del otro idioma.

**Criterio:** ningún texto de interfaz queda sin traducir. Una prueba automática compara las claves de los archivos `es` y `en` y falla si falta alguna.

#### F11. Enlaces compartibles y URL por estructura (hito 1)

- Cada estructura tiene URL propia por idioma: `/es/amigdala` y `/en/amygdala`.
- "Compartir esta vista" genera un enlace con el estado completo: estructura seleccionada, vista de cámara, modo aislar, cortes y nivel de explosión.
- Ejemplo: `/es/insula?vista=lateral-izq&aislar=contexto&corte=coronal:42`

**Criterio:** el enlace reproduce la misma vista en otro dispositivo, y cambiar `/es/insula` por `/en/insula` muestra la misma vista en inglés.

#### F12. Reportar un error (hito 2)

- Cada ficha tiene "Reportar un error". Abre un formulario corto con tipo (contenido, traducción, enlace roto, pieza mal ubicada) y descripción.
- Al enviarlo se abre un issue prellenado en GitHub con el ID de la estructura, el idioma y la versión del contenido.
- Alternativa para quien no tiene cuenta de GitHub: correo del proyecto con asunto prellenado.
- La app no guarda datos de quien reporta.
- Comparte con F24 el formato de cada reporte (estructura, campo, idioma, versión).

### Revisión docente (fase 1, hito 1)

#### F24. Modo revisión docente

Mecanismo para que cada docente diga, en cada parte específica, si es correcta o qué cambio propone.

- **Acceso:** cada revisor recibe un enlace personal, por ejemplo `/es/revision?r=<código>`. El código solo identifica al revisor para atribuir la revisión; no es una contraseña. El registro de revisores (nombre, rol, consentimiento) lo lleva el editor.
- **Unidades revisables**, cada una con tres botones (**Correcto**, **Corregir** con texto propuesto, **No es mi área**) y un comentario:
  - La pieza: si la malla corresponde a la estructura y si está bien ubicada.
  - Los nombres, por separado: español, inglés y latín.
  - Cada campo de la ficha en cada idioma: ubicación, qué es, para qué sirve y relaciones; además, cada afirmación de relevancia con su nivel de evidencia y cada fuente.
  - Marcadores: "Proponer posición". El revisor toca el punto correcto en el modelo y se envían las coordenadas.
  - Trazos del vago: el revisor toca un trazo y elige de una lista qué ramo es, "no es un ramo" o "no sé".
  - Pasos de circuitos y casos clásicos, cuando existan (fase 2).
- **Envío:** las respuestas se acumulan en el navegador del revisor mientras trabaja. "Enviar revisión" abre, por cada estructura revisada, un formulario de Google del editor ya lleno con sus respuestas (código, estructura y revisión), y el revisor solo confirma. Nombre, rol y consentimiento se dan una sola vez, en un formulario de registro del revisor. Si la revisión no cabe en un enlace, se envía en partes. Cada respuesta lleva estructura, campo, idioma, versión del contenido, revisor, veredicto y propuesta.
- **Procesamiento:** las respuestas llegan al formulario del editor, de donde se descargan en CSV (o a una hoja de cálculo vinculada). `scripts/importar-revisiones.ts` las convierte en un resumen por ficha y un resumen de toda la importación, que se vuelve issue. Descarta envíos con ids que no existen y con códigos que no están en el padrón privado de revisores (`pipeline/revisores.local.json`, fuera de git). Los issues muestran el alias del revisor (D01, D02...), nunca su código ni su nombre. Configuración paso a paso: `docs/revision-docente.md`. Claude prepara el cambio y **el editor lo aprueba**; ninguna corrección se aplica sola.
- **Estado:** una respuesta sobre una versión vieja del contenido queda marcada como desactualizada. Cuando una ficha tiene el visto bueno de los tres roles (anatomía, psicología, traducción) en un idioma, pasa a "verificada" con revisor y fecha.
- **Vista del revisor:** lista de lo que le falta por revisar y de lo que ya revisó.
- **Privacidad:** el formulario pide consentimiento explícito para mostrar el nombre del revisor en las fichas (Ley 1581 de 2012). La app no guarda datos de revisores en un servidor propio.

**Criterio:** un revisor marca tres campos como correctos, propone un cambio en un cuarto y ubica un marcador; tras enviar, las respuestas del formulario del editor tienen las cinco respuestas con estructura, campo, idioma, versión y coordenadas (en dos envíos, porque el marcador es su propia entrada), y el script genera un resumen de la importación con las cinco, que es el cuerpo de un solo issue.

### Estudio activo (fase 2)

#### F13. Notas y recursos personales

Texto libre y enlaces propios por pieza. Se guardan solo en el navegador de cada persona y se pueden exportar e importar como JSON para pasarlos a otro equipo.

#### F14. Circuitos y recorridos

Un solo motor para dos usos. Un circuito es una secuencia de pasos; cada paso resalta una o varias estructuras o marcadores, mueve la cámara y muestra un texto corto. Flechas animadas entre pasos indican la dirección de la vía.

Circuitos iniciales (cada uno necesita fuente antes de publicarse):

- **Circuito de Papez:** hipocampo, fórnix, cuerpos mamilares, núcleo anterior del tálamo, giro cingulado, giro parahipocampal y de vuelta al hipocampo. Primer circuito propuesto. Todo existe como malla salvo el núcleo anterior del tálamo (marcador).
- **Vías del miedo:** del tálamo a la amígdala (vía corta) y del tálamo a la corteza y luego a la amígdala (vía larga).
- **Ganglios basales:** corteza, estriado (caudado y putamen), globo pálido, tálamo y de vuelta a la corteza.
- **Eje vago-cerebro:** de las vísceras al nervio vago, al núcleo del tracto solitario, y desde ahí hacia hipotálamo, amígdala e ínsula. Todas sus estructuras centrales existen como mallas en el modelo.
- **Recorrido anatómico del vago:** las paradas de la tabla siguiente.

| Paso | Estructura | En el modelo |
|---|---|---|
| 1 | Núcleos en el bulbo raquídeo (motor dorsal, ambiguo, del tracto solitario) | Mallas |
| 2 | Salida del cráneo por el agujero yugular | Marcador |
| 3 | Ganglios superior e inferior | Marcadores |
| 4 | Ramo auricular y ramo faríngeo | Trazos sin nombre; marcadores hasta que un revisor los identifique (F24) |
| 5 | Nervio laríngeo superior | Igual que el paso 4 |
| 6 | Ramos cardíacos cervicales | Igual que el paso 4 |
| 7 | Nervio laríngeo recurrente: el derecho rodea la arteria subclavia y el izquierdo, el arco aórtico | Igual que el paso 4 |
| 8 | Plexo pulmonar | Marcador |
| 9 | Plexo esofágico | Marcador |
| 10 | Troncos vagales anterior y posterior | Marcadores |
| 11 | Ramos gástricos, hepáticos y celíacos | Marcadores |

En el recorrido del vago, corazón, pulmones, laringe, esófago y estómago aparecen translúcidos como referencia. Las estructuras sin malla van como marcadores con etiqueta. El recorrido hasta el estómago sigue el vago derecho: el izquierdo del modelo termina a la altura del final de la tráquea.

**Regla:** cada circuito muestra que es un modelo simplificado de la vía y cita su fuente.

#### F15. Quiz con repaso espaciado

Tipos de pregunta:

- **Nombrar:** la app resalta una pieza y la persona escribe o elige el nombre.
- **Señalar:** "Señala el tálamo" y la persona hace clic sobre la pieza.
- **Relacionar:** unir una función o un caso con su estructura.
- **Corte:** identificar una estructura dentro de un plano de corte.

Repaso espaciado: cada pieza tiene un intervalo de repaso que crece con los aciertos y se reinicia con los errores (algoritmo tipo SM-2 o cajas de Leitner). La pantalla "Repaso de hoy" muestra las piezas vencidas.

- Se puede hacer quiz por grupo, por circuito o por colección docente.
- En modo ambos idiomas acepta la respuesta en cualquiera de los dos.
- El progreso se guarda en el navegador y se puede exportar.
- Solo usa fichas verificadas.

#### F16. Modo rompecabezas

Se elige un grupo (por ejemplo, Ganglios basales). Sus piezas salen a una bandeja alrededor del conjunto. La persona arrastra cada pieza hacia su lugar y, si queda cerca de la posición original, encaja sola con una confirmación visual. Hay botón de pista que muestra la silueta del lugar correcto.

#### F17. Casos clásicos

Sección de la ficha con casos que ayudaron a entender la función de una estructura. Casos iniciales:

- **H.M. (Henry Molaison):** extirpación bilateral del lóbulo temporal medial, que incluyó buena parte del hipocampo, seguida de amnesia anterógrada.
- **Phineas Gage:** lesión del lóbulo frontal por una barra de hierro y cambios en su conducta.
- **Paul Broca y el paciente Leborgne:** lesión en el giro frontal inferior izquierdo y pérdida de la producción del lenguaje.
- **Carl Wernicke:** lesión en la parte posterior del giro temporal superior izquierdo y alteración de la comprensión.

Áreas funcionales como Broca y Wernicke no coinciden siempre con los bordes de las piezas del modelo. El modelo trae la parte opercular y la parte triangular del giro frontal inferior, así que Broca puede mostrarse con esas piezas (sujeto a revisión docente); Wernicke va como región marcada. Cada caso lleva fuente y una nota sobre cómo se interpreta hoy, porque varios se han reanalizado con neuroimagen (el cerebro de Leborgne y el cráneo de Gage, por ejemplo).

#### F18. Etiquetas 3D

Nombres flotantes sobre las piezas visibles, sin superponerse, en el idioma activo o en ambos. Se activan y desactivan con un botón.

#### F19. Modo liviano

Dos versiones del modelo: completa (15 MB o menos) y liviana (5 MB o menos, con mallas más simplificadas). La app sugiere la liviana si el equipo reporta poca memoria o si la animación va lenta; la persona siempre puede cambiar a mano. Se construye solo si la medición del hito 1 lo justifica: las piezas del cerebro son livianas (el hipocampo tiene unos 1.000 triángulos) y el peso está en los nervios.

#### F20. Indexación en buscadores

El proceso de build genera una página estática por estructura e idioma, con título, descripción, etiquetas `hreflang` entre `es` y `en` e imagen de vista previa. La app 3D se monta sobre esa página. Así una búsqueda como "amígdala 3D" o "amygdala 3D model" puede llevar directo a la ficha.

### Docentes y comunidad (fase 3)

#### F21. Colecciones para docentes

Un docente arma una lista ordenada de estructuras y circuitos, con notas propias, y obtiene un enlace. La colección viaja codificada dentro del enlace, sin servidor. Los estudiantes la abren en modo estudio o en modo quiz.

#### F22. Uso sin internet

La app se instala como PWA y funciona sin conexión después de la primera carga, con modelo y contenido incluidos.

#### F23. Exportar imagen para apuntes

Descarga un PNG de la vista actual con etiquetas y con el crédito de licencia incluido en la imagen.

## 6. Modelo de datos

La app separa geometría y contenido:

- `atlas.glb` y `atlas-liviano.glb`: las mallas, con su posición original y el nombre que traen del modelo fuente.
- `estructuras.json`: el contenido de estudio en ambos idiomas. Se enlaza con la geometría por el nombre de la malla.
- `i18n/es.json` y `i18n/en.json`: textos de la interfaz.

### Ejemplo de entrada en `estructuras.json`

```json
{
  "id": "nervio-vago-izquierdo",
  "mallas": ["Vagus nerve (X).l"],
  "slug": { "es": "nervio-vago-izquierdo", "en": "left-vagus-nerve" },
  "nombre": { "es": "Nervio vago izquierdo", "en": "Left vagus nerve" },
  "nombre_latino": "Nervus vagus sinister",
  "sinonimos": {
    "es": ["neumogástrico", "par craneal X", "décimo par"],
    "en": ["cranial nerve X", "CN X", "pneumogastric nerve"]
  },
  "padre": "nervio-vago",
  "grupos": ["nervio-vago"],
  "lado": "izquierdo",
  "ubicacion": {
    "es": "Sale del bulbo raquídeo, deja el cráneo por el agujero yugular y desciende por el cuello dentro de la vaina carotídea hacia el tórax y el abdomen.",
    "en": "Arises from the medulla oblongata, leaves the skull through the jugular foramen and descends in the neck within the carotid sheath toward the thorax and abdomen."
  },
  "que_es": {
    "es": "Décimo par craneal. Nervio mixto con fibras motoras, sensitivas y parasimpáticas.",
    "en": "The tenth cranial nerve. A mixed nerve with motor, sensory and parasympathetic fibers."
  },
  "para_que_sirve": {
    "es": "Participa en la regulación involuntaria de la frecuencia cardíaca, la respiración y la digestión. Inerva los músculos de la faringe y la laringe que intervienen en la deglución y la fonación.",
    "en": "Takes part in the involuntary regulation of heart rate, breathing and digestion. Supplies the pharyngeal and laryngeal muscles involved in swallowing and phonation."
  },
  "relaciones": ["bulbo-raquideo", "nucleo-motor-dorsal-vago", "nucleo-ambiguo", "nucleo-tracto-solitario"],
  "circuitos": ["eje-vago-cerebro", "recorrido-vago"],
  "relevancia_psicologia": [
    {
      "texto": {
        "es": "La variabilidad de la frecuencia cardíaca se usa en investigación como indicador de la actividad vagal cardíaca y se estudia en relación con la regulación emocional.",
        "en": "Heart rate variability is used in research as an index of cardiac vagal activity and is studied in relation to emotion regulation."
      },
      "evidencia": "moderada",
      "fuente": "PENDIENTE"
    },
    {
      "texto": {
        "es": "Teoría polivagal: muy difundida en psicoterapia, con críticas publicadas sobre sus bases anatómicas y evolutivas.",
        "en": "Polyvagal theory: widely used in psychotherapy, with published critiques of its anatomical and evolutionary claims."
      },
      "evidencia": "debatida",
      "fuente": "PENDIENTE: una fuente a favor y una crítica"
    }
  ],
  "casos": [],
  "recursos": [
    {
      "titulo": "Neuroanatomy, Cranial Nerve 10 (Vagus Nerve)",
      "url": "https://www.ncbi.nlm.nih.gov/books/NBK537171/",
      "tipo": "artículo",
      "idioma": "en",
      "nota": {
        "es": "Recorrido, núcleos y ganglios, con correlación clínica.",
        "en": "Course, nuclei and ganglia, with clinical correlation."
      }
    },
    {
      "titulo": "Vagus nerve: Anatomy, function and branches",
      "url": "https://www.kenhub.com/en/library/anatomy/the-vagus-nerve",
      "tipo": "artículo",
      "idioma": "en",
      "nota": {
        "es": "Buena descripción de los ramos por región.",
        "en": "Clear description of branches by region."
      }
    }
  ],
  "fuentes_contenido": ["StatPearls NBK537171", "Kenhub, The vagus nerve"],
  "revision": {
    "es": { "estado": "borrador", "revisado_por": null, "fecha": null },
    "en": { "estado": "borrador", "revisado_por": null, "fecha": null }
  },
  "version_contenido": "0.1.0"
}
```

El ejemplo es ilustrativo: su texto no está revisado. El esquema vigente está en `src/data/tipos.ts` (por ejemplo, `ficha.version`, `ficha.relevancia` y `ficha.fuentes` con `verificada`); las respuestas de revisión por campo (F24) están en `src/lib/revision.ts`.

### Otros archivos de datos

- `grupos.json`: grupos de estudio con nombre, descripción corta y recursos del grupo, en ambos idiomas.
- `circuitos.json`: circuitos y recorridos de F14, con pasos, posiciones de cámara, textos y fuentes.
- `casos.json`: casos clásicos de F17, con estructuras relacionadas y fuentes.
- `marcadores.json`: puntos y regiones con etiqueta para lo que no tiene malla (sección 8). Cada marcador lleva su posición, la fuente o el revisor que la propuso, y su estado de revisión. Mientras nadie haya validado la posición, el marcador se muestra como "posición aproximada".

## 7. Gobernanza del contenido

Al ser pública y bilingüe, el contenido es la parte más delicada del proyecto. Un error en una ficha llega a muchas personas en dos idiomas.

### Flujo de publicación (por idioma)

1. **Borrador:** lo redacta el autor, con o sin ayuda de IA, y siempre con fuentes.
2. **Revisión anatómica:** un docente de neuroanatomía o neurociencias revisa ubicación, relaciones y función (F24).
3. **Revisión de psicología:** un docente de psicología revisa la relevancia psicológica y los niveles de evidencia (F24).
4. **Revisión de traducción:** alguien con dominio del inglés técnico (o del español, en el caso inverso) revisa la otra versión (F24).
5. **Verificado:** la ficha muestra revisor y fecha.

### Reglas

- **Fuente obligatoria** en cada ficha, circuito y caso.
- **Nivel de evidencia** en cada afirmación de relevancia psicológica: `consenso`, `moderada` o `debatida`. Los temas debatidos presentan las dos posturas.
- **Nada de "una región, una función".** La amígdala participa en mucho más que el miedo y el hipocampo en mucho más que la memoria. Las fichas describen participación en procesos, no centros exclusivos.
- **Recursos externos solo como enlace.** No se copia contenido de terceros: Kenhub tiene todos los derechos reservados y StatPearls está bajo CC BY-NC-ND 4.0, que no permite obras derivadas. Las fichas se redactan propias y citan.
- **Nombres:** latín, inglés y español salen de Terminologia Anatomica 2 (`TA2.csv` de Z-Anatomy) cuando existen. Lo que no está ahí va `PENDIENTE` hasta que un revisor lo confirme.
- **Versionado:** cada ficha tiene versión y el repositorio lleva un registro de cambios del contenido.
- **Ningún cambio anatómico se fusiona sin aprobación del editor**, venga de un revisor, de un reporte o de Claude.
- **Reportes de error:** se revisan cada semana. Un error de contenido confirmado pasa la ficha a `borrador` hasta corregirlo.

### Carga de trabajo estimada

Cerca de 100 estructuras por 2 idiomas da unas 200 fichas, más circuitos y casos. Por eso el lanzamiento se hace con 40 fichas verificadas y el resto marcado "En preparación".

### Contribuciones externas (fase 3)

Repositorio público en GitHub con `CONTRIBUTING.md` y plantillas de issue para error de contenido, traducción, recurso nuevo y pieza mal ubicada. Toda contribución pasa por el mismo flujo de revisión.

## 8. Inventario inicial de estructuras

Confirmado contra Z-Anatomy el 11 de octubre de 2026 (detalle en `docs/research/fase-0/REPORT.md`). Columna "Estado": **malla** (existe en el modelo), **marcador** (no existe; se muestra como punto o región con etiqueta) o **por completar** (ver "Cómo se completa lo que falta").

**Cerebro**

| Estructura | Estado |
|---|---|
| Hemisferios y lóbulos: frontal, parietal, temporal, occipital, ínsula, lóbulo límbico | Grupos del árbol, formados por sus giros |
| Giros: precentral, postcentral, frontal superior, medio e inferior (partes opercular, triangular y orbitaria), temporal superior, medio e inferior, angular, supramarginal, fusiforme (occipitotemporal lateral), cingulado (por partes), parahipocampal, giro recto y orbitales | Mallas, por lado |
| Núcleo caudado, putamen, globo pálido, amígdala, hipocampo | Mallas, por lado |
| Tálamo; hipotálamo | Mallas (tálamo por lado; hipotálamo una sola pieza) |
| Epitálamo: habénula, glándula pineal | Mallas |
| Cuerpos mamilares | Mallas, por lado ("Mamillary body" en Z-Anatomy) |
| Metatálamo: cuerpos geniculados lateral y medial | Mallas, por lado |
| Cuerpo calloso, fórnix, comisura del hipocampo | Mallas |
| Mesencéfalo, puente, bulbo raquídeo | Mallas, por lado |
| Cerebelo | Mallas |
| Ventrículos laterales, tercero y cuarto, acueducto cerebral, plexos coroideos | Mallas (pineal y plexos coroideos vienen fuera del grupo Brain de Z-Anatomy y el pipeline los agrega) |
| Núcleo accumbens | Marcador sin ubicar; por completar con el atlas SPL/NAC |
| Sustancia gris periacueductal, locus coeruleus, núcleos del rafe, área postrema, núcleo anterior del tálamo | Marcadores |

**Nervio vago (ambos lados)**

| Estructura | Estado |
|---|---|
| Tronco del vago | Malla por lado (`Vagus nerve (X).l`, `Vagus nerve (X).r`). Es una curva de 1 mm de grosor; el izquierdo termina a la altura del final de la tráquea |
| Núcleo motor dorsal (posterior), núcleo ambiguo, núcleo del tracto solitario | Mallas, por lado |
| Ganglios superior e inferior | Marcadores |
| Ramo auricular, faríngeo, laríngeo superior, cardíacos cervicales, laríngeo recurrente | Trazos sin nombre dentro de la curva del vago (21 en el derecho, 7 en el izquierdo). Marcadores hasta que un revisor identifique cada trazo con F24; luego el pipeline los separa como piezas |
| Plexos pulmonar y esofágico | Marcadores |
| Troncos vagales anterior y posterior, ramos gástricos, hepáticos y celíacos | Marcadores |
| Agujero yugular | Marcador |

**Áreas funcionales:** Broca con las piezas de la parte opercular y triangular del giro frontal inferior (sujeto a revisión); Wernicke como marcador sin ubicar (`m-wernicke-area`) hasta que un revisor proponga su posición.

**Órganos de referencia (translúcidos, sin ficha de estudio):** corazón (cavidades y paredes), pulmones (lóbulos), laringe (cartílagos), tráquea, esófago y estómago. Vienen por partes y se agrupan.

### Cómo se completa lo que falta

| Faltante | Vía | Requiere |
|---|---|---|
| Ramos del vago | Ya están dibujados; un revisor identifica cada trazo (F24) y el pipeline lo separa sin moverlo | Solo revisión docente |
| Núcleo accumbens (y tracto mamilotalámico) | Atlas SPL/NAC de Harvard (Open Anatomy, licencia de 3D Slicer). Viene de otro cerebro: se alinea al de Z-Anatomy con estructuras comunes (tálamo, caudado, putamen, ventrículos). Piezas nuevas, posición aproximada | Investigación de licencia, alineación y revisión docente. Fase 2, antes de Papez |
| Vago izquierdo por debajo de la tráquea | BodyParts3D tendría el tronco del vago izquierdo y comparte origen con Z-Anatomy | Investigación (servidor de BodyParts3D no verificado aún) |
| Periacueductal, locus coeruleus, rafe, área postrema, núcleo anterior del tálamo | Sin fuente abierta usable (Brainstem Navigator prohíbe redistribuir) | Marcador ubicado por revisor |
| Ganglios, plexos, troncos y ramos abdominales del vago | Marcador ubicado por revisor. Alternativa costosa: curvas dibujadas en Blender sobre láminas de dominio público (Gray's Anatomy, 1918) con validación docente. Pista sin verificar: modelo del vago humano de SPARC (NIH) | Revisión docente |

## 9. Pipeline de datos (fase 0)

Fuente: Z-Anatomy, atlas en Blender construido sobre BodyParts3D, licencia CC BY-SA 4.0. Se usa `Startup.blend` dentro de `Z-Anatomy.zip` del repositorio `Z-Anatomy/Models-of-human-anatomy`, fijado por commit, porque se descarga por URL y es reproducible.

1. **Descargar** `Z-Anatomy.zip` del commit fijado y extraer `Startup.blend` (307 MB, 7.184 objetos).
2. **Listar** con `listar.py` (Blender sin ventana, `bpy` 5.2.2): todos los objetos, no solo mallas, con tipo (malla o curva), colecciones, padre, número de vértices y modificadores. Salida: `estructuras.txt`.
3. **Confirmar** el inventario de la sección 8 contra la lista.
4. **Mapear** en `mapeo.csv` cada objeto a un `id` de la app, con nombre en español, inglés y latín tomados de `TA2.csv` (293 de 322 estructuras del sistema nervioso casan exacto). Lo que no casa va `PENDIENTE`. Columnas: `nombre_malla, pieza, estructura, lado, en, es, latin, padre, tipo, fuente_nombre`. `mapear.py` también escribe la jerarquía del árbol (`src/data/arbol.json`) y siembra `src/data/estructuras.json` sin tocar entradas existentes.
5. **Medir** en Blender la caja envolvente en coordenadas del mundo de cada objeto mapeado y guardarla en `pipeline/cajas.json`.
6. **Extraer** con `extraer.py`:
   - conserva `matrix_world` de cada pieza antes de borrar sus padres (los rótulos de grupo), para que ninguna se desplace;
   - convierte las curvas (nervios) en mallas;
   - aplica los modificadores (subdivisión, espejo, skin, solidify); sin esto, el núcleo del tracto solitario sale como 5 puntos;
   - exporta `atlas.glb`.
7. **Comprimir** con gltf-transform. Los nervios no se simplifican en la versión completa, porque son delgados y se deforman.
8. **Generar la versión liviana** solo si la medición lo pide (F19).
9. **Validar** (`npm run check:modelo`, corre en cada CI): cada malla del GLB, incluidos los trazos del vago y las mallas de toque, coincide con su caja en `cajas.json` con tolerancia de 0,1 mm (descontando el giro global de ejes), no falta ni sobra ninguna, y el peso está dentro del presupuesto. Que cada fila de `mapeo.csv` tenga su pieza en el árbol lo prueba `tests/datos.test.ts`.

El pipeline corre en la nube (sesión de Claude Code) o en el portátil, con `pip install bpy` o con `blender -b --python`. No necesita abrir la interfaz de Blender.

Compresión y validación desde el repositorio (Node, sin la CLI de gltf-transform, que arrastra una dependencia con una vulnerabilidad conocida; ver docs/adr/0001-stack.md):

```powershell
node scripts\comprimir-modelo.ts
npm run check:modelo
```

**Regla que no se negocia:** la posición de cada pieza en el mundo nunca cambia, en ningún paso. El único cambio permitido es el giro global de Z arriba (Blender) a Y arriba (glTF), igual para todas las piezas. Por eso encajan solas en el visor. La validación del paso 9 lo comprueba en cada cambio.

## 10. Arquitectura técnica

| Capa | Herramienta | Versión | Uso |
|---|---|---|---|
| Base | Vite, React, TypeScript | 8.3.4, 19.3.0, 6.0.3 | Estructura de la app |
| Rutas | react-router | 8.4.0 | URL por idioma y estructura, estado en el enlace |
| Idiomas | i18next y react-i18next | 26.4.3, 17.0.16 | Textos de interfaz en `es` y `en` |
| 3D | three, @react-three/fiber, @react-three/drei | 0.186.1, 9.8.1, 10.7.9 | Visor, cámara, selección, etiquetas |
| Estado | zustand | 5.0.15 | Selección, visibilidad, desplazamientos, cortes, modo activo |
| Búsqueda | fuse.js | 7.5.0 | Búsqueda tolerante a errores y tildes en todos los idiomas |
| Datos locales | IndexedDB (idb-keyval) | 6.3.0 | Notas, progreso del quiz, revisión en curso (F24) |
| Pruebas | Vitest, Playwright | 5.0.3, 1.64.0 | Unitarias y de navegador |
| Pipeline | Python, bpy, gltf-transform | 3.13, 5.2.2, 4.5.1 | Fase 0 |
| Offline | vite-plugin-pwa | Se fija en fase 3 | Fase 3 |
| Hosting | GitHub Pages | | Gratis, sin backend; `404.html` para las rutas por idioma |

TypeScript se fija en 6.0.3 porque typescript-eslint aún no soporta la 7. Decisiones y alternativas: `docs/adr/`.

### Fragmentar y reensamblar

- Al cargar, la app calcula y guarda el centro original de cada pieza y de cada nodo del árbol. Estos valores no cambian nunca.
- Cada pieza tiene un `desplazamiento` (vector) en el estado. Posición en pantalla = posición original + desplazamiento.
- Explosión global: cada bloque se aleja del centro del conjunto visible (en X se mide desde el plano medio, x = 0, con el signo de su lado, para que izquierda y derecha no cambien de lado) una distancia igual al factor del deslizador por (distancia base más factor radial por su distancia al centro, con tope). Así también salen las piezas profundas. Las constantes viven en `src/lib/explosion.ts`.
- Inventario (70 a 100 % del deslizador): solo con `MINIMO_BLOQUES_INVENTARIO` (8) bloques visibles o más; con menos (por ejemplo, por hemisferios o con pocas piezas aisladas) las piezas se acercarían, así que la explosión radial ocupa todo el deslizador. Cada bloque se mueve de su posición radial (la del factor 1) a su lugar en repisas sobre el plano frontal que pasa por el origen de la explosión, con una curva suave. Las repisas se arman con el ancho y el alto real de cada bloque. Los bloques derechos van a -X y los izquierdos a +X en espejo exacto (un solo acomodo para los dos lados, con el tamaño mayor de cada par); los de la línea media, en una columna central. Cada lóbulo empieza fila nueva si la fila actual ya va por la mitad. Sigue siendo solo un desplazamiento: reensamblar lo vuelve a cero. Las constantes viven en `src/lib/inventario.ts`.
- Separar una pieza: sale en esa misma dirección hasta quedar fuera del conjunto armado, y nunca se mueve menos de `DISTANCIA_SEPARAR`.
- Al soltar el deslizador, al cambiar el nivel con la explosión activa y al reensamblar, la cámara encuadra el conjunto visible sin cambiar la dirección desde la que se mira. En el inventario (más del 70 %) mira desde la vista anterior y encuadra todas las piezas de estudio visibles, vago incluido.
- Separar por nivel: se usa el centro del nodo del nivel elegido para que sus piezas se muevan como un bloque.
- Reensamblar: el desplazamiento vuelve a cero con una animación. Como la posición original nunca se tocó, no hay error acumulado.

### Planos de corte

- Recorte con los planos de corte nativos de three.js (`clippingPlanes`).
- Relleno de la superficie cortada con la técnica de stencil buffer, porque las mallas son cáscaras huecas y sin relleno el corte se ve vacío por dentro.
- Es la parte técnicamente más difícil. Empieza con un prototipo de una sola malla con relleno; si no funciona bien en 30 minutos de trabajo, se publica primero el corte sin relleno con bordes resaltados, y el relleno llega en una actualización.

### Selección de piezas delgadas

Cada nervio (en el modelo actual, los dos vagos) tiene una versión invisible y más gruesa que solo sirve para detectar el clic o el toque. El árbol y la búsqueda son siempre una alternativa para seleccionar. En modo revisión (F24), los trazos del vago se seleccionan uno por uno.

### Páginas para buscadores (F20)

Un script de build lee `estructuras.json` y genera un HTML estático por estructura e idioma, con título, descripción, `hreflang` e imagen de vista previa. Las imágenes de vista previa se generan automáticamente abriendo la app en un navegador sin ventana.

### Estructura de carpetas

Se crea a medida que cada función la necesita, no por adelantado.

```
3d_brain/
  SPEC.md
  AGENTS.md
  CLAUDE.md
  LICENSE (código, MIT)
  LICENSE-CONTENT (modelo y contenido, CC BY-SA 4.0)
  docs/brief.md, docs/adr/, docs/v2.md, docs/research/
  pipeline/
    listar.py
    extraer.py
    mapeo.csv
    cajas.json
  scripts/
    check-modelo.ts
    check-i18n.ts
    importar-revisiones.ts
  public/
    modelos/atlas.glb
  src/
    i18n/es.json, i18n/en.json
    data/estructuras.json, grupos.json, marcadores.json, arbol.json
    store/
    lib/
    components/
```

## 11. Interfaz

Modo estudio (decidido por el editor el 12 de octubre de 2026): el cerebro es el protagonista y los
paneles salen solo cuando se piden. La disposición se aparta a propósito de los atlas de tres
paneles fijos con barra inferior.

### Escritorio

```
+----+------------------------------------------------------------+
| MAYSA BRAIN                                     ES  EN  (tema)  |
+----+------------------------------------------------------------+
| ⌥  |                                          métricas          |
|Est.|                                                  +------+  |
| ◎  |                Visor 3D a pantalla completa      |nivel |  |
|Grup|                                                  |  ▲   |  |
| ⌕  |                                                  |  |   |  |
|Busc|                                                  |  ●   |  |
|    |                                                  |  ⟲   |  |
|    |                                        brújula   +------+  |
+----+------------------------------------------------------------+
```

- **Riel** a la izquierda: Estructuras, Grupos y Buscar. Estructuras y Grupos abren un cajón sobre el
  visor (árbol y grupos de estudio); el mismo botón, tocar el modelo o Escape lo cierran.
- **Buscar** abre una paleta flotante (también con Ctrl+K). Escape la cierra sin tocar el resto.
- **Ficha como página de lectura a la izquierda:** aparece solo al elegir una estructura, ocupa unos
  400 px y el visor se reencuadra en el espacio que queda. Cerrarla devuelve la pantalla completa.
  Orden: cabecera (lóbulo con el color de la pieza, nombre, latín, estado), acciones, descripción
  destacada (qué es, función, ubicación), relaciones, relevancia en psicología, recursos y artículos
  de referencia, y fuentes plegadas.
- **Explosión vertical** a la derecha del visor: nivel (hemisferios, lóbulos, piezas), deslizador
  con las marcas Armado, Separado e Inventario, y Reensamblar.
- **Brújula de vistas** en la esquina inferior derecha: superior, inferior, izquierda, derecha y
  posterior alrededor de la vista anterior.

En modo revisión (F24), la ficha muestra junto a cada campo los botones Correcto, Corregir y No es mi área, y una barra arriba muestra cuántas respuestas lleva el revisor y el botón "Enviar revisión".

### Celular

El visor ocupa toda la pantalla. Arriba: botón "Estructuras" (abre el cajón), lupa (abre la paleta),
idioma y tema. La ficha es una hoja inferior. La explosión y la brújula van arriba, sobre el visor,
para que la hoja no las tape. No hay riel.

### Dirección visual

- **Paleta Maysa** con tema oscuro y claro; el tema lo elige la persona y, si no elige, sigue al sistema.
- **Color con lógica de atlas anatómico:** nervios en amarillo, como en los atlas impresos; cada lóbulo con su color fijo en visor y ficha para que funcione como pista de memoria.
- **El color nunca es la única pista:** todo lo que se distingue por color también tiene nombre o etiqueta, para personas con daltonismo.
- Animación solo cuando responde a una acción: separar, devolver, encuadrar, abrir un panel.

## 12. Requisitos no funcionales

- **Peso:** `atlas.glb` comprimido de 15 MB o menos; `atlas-liviano.glb` de 5 MB o menos.
- **Rendimiento:** 30 cuadros por segundo o más en los tres equipos de referencia (sección 3), medido con el modelo real desde el esqueleto.
- **Navegadores:** Chrome, Edge, Safari y Firefox actuales, con WebGL2.
- **Idiomas:** español e inglés completos; latín como referencia común.
- **Accesibilidad:** árbol, búsqueda, ficha y quiz navegables con teclado; lectores de pantalla leen fichas y resultados; contraste suficiente; animaciones desactivadas si el sistema pide reducir movimiento.
- **Privacidad:** sin cookies de rastreo ni datos personales de usuarios en servidor (sección 13).

## 13. Privacidad, licencias y avisos

**Privacidad**

- Sin cuentas de usuario. Notas, recursos personales, progreso del quiz y revisiones en curso viven solo en el navegador de cada persona.
- Así el proyecto no almacena datos personales de usuarios, lo que simplifica mucho frente a la Ley 1581 de 2012. Antes de agregar cuentas, formularios propios o analítica con datos personales, se revisa con asesoría legal.
- **Revisores docentes (F24):** sus revisiones llegan por un formulario de Google del editor. El formulario pide consentimiento explícito para tratar su nombre y mostrarlo como revisor en las fichas.
- Si se quiere saber qué estructuras se usan más, la analítica debe ser sin cookies y sin datos personales.

**Licencias**

- Modelo 3D y sus derivados: CC BY-SA 4.0, con crédito a Z-Anatomy y a BodyParts3D (Database Center for Life Science).
- Contenido de fichas, circuitos y casos: CC BY-SA 4.0, coherente con el modelo.
- Código: MIT.
- Geometría de otras fuentes (por ejemplo el atlas SPL/NAC) solo entra si su licencia es compatible y con su crédito.
- Pantalla "Fuentes y licencia" visible desde cualquier parte de la app.

**Avisos**

- "Uso educativo. No es una herramienta clínica ni de diagnóstico", visible en la primera visita y en el pie de la app.
- Aviso de que el modelo representa un solo cuerpo adulto masculino y que la anatomía varía entre personas.
- Los marcadores sin validar se muestran como "posición aproximada".

## 14. Riesgos y mitigación

1. **Z-Anatomy no trae el vago completo o sus ramos vienen fusionados.** Ocurrió: los ramos vienen sin nombre en una sola curva y los plexos no existen. Mitigación aplicada: vago como pieza más marcadores, identificación de trazos por revisores (F24) y tareas de investigación para completar (sección 8).
2. **Contenido incorrecto publicado en dos idiomas.** Flujo de revisión de la sección 7 con F24, estado visible, reporte de errores y aprobación del editor para todo cambio anatómico.
3. **Nervios difíciles de seleccionar.** Zona de toque invisible más gruesa, más selección por árbol y búsqueda.
4. **Blender se pone lento o se cierra con el atlas completo en 12 GB de RAM.** Resuelto: el pipeline corre sin ventana y puede correr en la nube.
5. **Celulares de gama baja no mueven el modelo.** Medición desde el esqueleto, presupuesto de peso y pruebas con un Android económico; modo liviano si hace falta.
6. **Relleno de cortes más difícil de lo previsto.** Prototipo primero; lanzar con corte sin relleno y bordes resaltados si no funciona, y agregar el relleno después. Los giros corticales tienen bordes abiertos que pueden filtrar el relleno.
7. **Volumen de contenido.** Unas 200 fichas más circuitos y casos. Lanzar con 40 verificadas, revisión eficiente con F24 y contribuciones en la fase 3.
8. **Traducción al inglés con errores de terminología.** Revisión por alguien con dominio del inglés técnico y nombres tomados de Terminologia Anatomica 2.
9. **Enlaces de recursos que se caen.** Script `revisar-enlaces.ts` que corre cada mes.
10. **Terceros que copian el proyecto sin dar crédito.** La licencia CC BY-SA exige crédito y misma licencia; la pantalla de licencia y el crédito en las imágenes exportadas lo hacen visible.
11. **Pocos revisores o poca respuesta.** F24 reduce la revisión a botones por campo; el piloto mide cuánto tarda una ficha.
12. **Geometría de otra fuente mal alineada.** Toda pieza alineada desde otro atlas entra marcada como aproximada hasta que un revisor la valide.

## 15. Decisiones

**Cerradas**

1. Lateralidad: estructuras separadas por hemisferio, como vienen en el modelo. Fusionarlas exigiría modificar geometría. El hipotálamo viene como una sola pieza.
6. Licencia del contenido: CC BY-SA 4.0.
8. Hosting: GitHub Pages.
9. Canal de revisión docente: formulario de Google del editor (F24).
3. Nombre: **Maysa Brain**, igual en español y en inglés (12 de octubre de 2026). Logo propio en `public/marca/`: cerebro cuya mitad posterior es un circuito, con el vago que baja, en los verdes de Maysa.

**Abiertas**

2. ¿Qué docentes pueden revisar neuroanatomía, psicología y traducción? Sin revisores no hay fichas verificadas ni lanzamiento. Se necesitan para el piloto (hito 1).
4. Dominio propio. Antes del hito 2.
5. ¿Analítica sin cookies, sí o no? Antes del hito 2.
7. ¿Qué circuito se construye primero en la fase 2? Propuesto: Papez, por su peso en psicología.

## 16. Cómo se trabaja con este spec

- Las reglas para agentes están en `AGENTS.md`; las decisiones en `docs/adr/`.
- El trabajo se pide por ID de función: "/rb-spec F1 y F2". Cada función pasa por spec, tareas, construcción en rama, pruebas y PR.
- Cualquier cambio de alcance se escribe primero aquí y después se programa.
