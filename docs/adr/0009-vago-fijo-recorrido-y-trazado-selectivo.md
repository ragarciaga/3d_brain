# 0009. Vago fijo, recorrido guiado y trazado aproximado selectivo

Status: accepted
Date: 2026-10-13
Related: 0006 (la reemplaza en lo que dice de dibujar ramos), 0010 (la amplía: tramo torácico trazado y ligamento arterioso ausente), SPEC.md F6, F14, F25 y sección 8
Approved by: el editor (13 de octubre de 2026), sujeto a la revisión del PR

## Context
El editor trajo una propuesta para completar el vago (spec v0.3 y un prompt de trabajo). Partía de que el modelo solo trae dos troncos. Medido sobre `atlas.glb` el 13 de octubre de 2026, no es así:

- El vago derecho tiene 21 trazos y el izquierdo 7, todos geometría de Z-Anatomy sin nombre.
- Arriba, 4 trazos cortos por lado a la altura del bulbo (raicillas). En el cuello, 2 trazos por lado, simétricos.
- El tronco derecho baja hasta el estómago y tiene unos 14 trazos alrededor de él. El izquierdo termina justo debajo de la bifurcación de la tráquea.
- No hay ningún trazo que rodee la subclavia derecha ni el arco aórtico: el laríngeo recurrente no existe. Tampoco ramos cardíacos, pulmonares ni esofágicos, ni el vago izquierdo por debajo del tórax.

El modelo fuente sí trae los anclajes que esos recorridos necesitan: `Aortic arch`, `Right subclavian artery`, `Ligamentum arteriosum`, `Left main bronchus` y `Right main bronchus`, `Larynx.j`, `Laryngopharynx`, `Internal jugular vein.l/.r`, además del esófago y el estómago que ya se exportan (`docs/research/fase-0/inventario-z-anatomy.tsv`).

AGENTS.md dejaba fuera de alcance toda geometría que no venga de una fuente abierta, y el ADR 0006 rechazó dibujar ramos a mano por riesgo anatómico.

## Decision
1. **El vago no se fragmenta.** Lleva `fragmentable: false`: no entra en la explosión, en el inventario ni en "Separar". Un nervio se recorre, no se separa.
2. **Recorrido guiado del vago (F14) en el hito 2.** Revelado progresivo: un plano de recorte baja parada por parada y el nervio se va dibujando hasta ese nivel. Los niveles salen de las cajas reales de los órganos de referencia, nunca de coordenadas escritas a mano. Cada parada usa el texto de fichas que ya tienen fuente.
3. **Primero se nombra lo que existe.** Una auditoría (`pipeline/auditar-vago.py`) mide cada trazo frente a los anclajes y propone su nombre con la evidencia geométrica. Un docente lo confirma con F24 antes de que el pipeline lo separe como pieza.
4. **Trazado aproximado, solo en tres piezas:** laríngeo recurrente derecho, laríngeo recurrente izquierdo y vago izquierdo desde la bifurcación de la tráquea hasta el estómago. Son recorridos con consenso en los textos de anatomía y con anclajes en el modelo.
5. **Los plexos no se dibujan como tubos.** Un plexo es una red; un tubo enseña algo falso. Siguen como marcadores o regiones.
6. **Condiciones para publicar geometría trazada (F25), sin excepción:**
   - La ruta se escribe por nombre de anclaje en `pipeline/rutas-vago.yaml` (sin coordenadas); la app la dibuja con su estado de revisión y un docente la aprueba viéndola, con F24 (ver la actualización del 13 de octubre).
   - Una prueba automática verifica las cuatro asimetrías del vago contra los anclajes y falla con mensaje explícito si falta uno.
   - La pieza lleva `origen_geometria: "aproximada"`, se dibuja con un acabado visiblemente distinto, la ficha muestra el aviso y hay una leyenda y un filtro "solo geometría escaneada".

## Actualización (13 de octubre de 2026): la ruta se revisa viéndola en la app
El editor observó que un docente no va a revisar un archivo YAML: tiene que ver la ruta en 3D y
responder como con el resto del atlas. Cambia el punto 6:

- `generar-ramas-vago.py` publica las rutas en `public/modelos/rutas-vago.json`, cada una con su estado
  (`en_revision` o `aprobada`). La app las dibuja como tubos punteados en tiempo de ejecución; no van
  al GLB.
- Mientras no haya lanzamiento público, todos las ven tal como se verían al lanzar, con la etiqueta
  "Pendiente de revisión docente" en la ficha (el mismo criterio de las fichas en borrador). Así el
  docente juzga el atlas completo. Solo el campo para responder es exclusivo del modo revisión.
- Antes del lanzamiento público (hito 2), toda ruta que siga en `en_revision` se aprueba o se retira
  del archivo publicado (SPEC sección 4).
- La ficha de la estructura (laríngeo recurrente, tronco vagal anterior) trae el campo "Recorrido
  trazado" por lado (`trazado_derecho`, `trazado_izquierdo`) con Correcto, Corregir o No es mi área.
  La respuesta llega por el formulario de siempre; una corrección se vuelve un cambio en el YAML y la
  ruta vuelve a revisión.
- Se mantienen la prueba de las cuatro asimetrías (ahora sobre lo publicado) y la distinción de F25.
  La prueba de bloqueo exige anclajes medidos si hay una sola ruta publicada.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Generar los 10 ramos de la propuesta | Los plexos como tubos enseñan algo falso, y varios ramos ya existen como trazos reales que solo hay que nombrar |
| No dibujar nada (ADR 0006 tal cual) | El laríngeo recurrente es lo más didáctico del vago y no existe; sin él el recorrido queda incompleto justo donde un docente mira |
| Explosión por territorio (separar los órganos que inerva el vago) | Aporta poco frente al recorrido; se deja para después si los docentes lo piden |
| Ramos dibujados a mano en Blender | Coordenadas a mano, imposibles de revisar por un docente; las rutas por anclaje en texto sí se revisan |

## Consequences
- Positive: el vago se recorre de arriba abajo y en los dos lados; lo trazado se distingue de lo medido; cada ruta es un texto que un docente corrige sin tocar código.
- Negative: cambia la regla de geometría de AGENTS.md (ahora admite geometría trazada con las condiciones del punto 6). La auditoría y el trazado necesitan el `.blend` de Z-Anatomy, que exige acceso a GitHub en el entorno donde corre el pipeline.
- Revisit when: un docente rechace una ruta, aparezca una fuente abierta con los ramos medidos (SPARC, por ejemplo), o se quiera trazar algo más allá de las tres piezas.
