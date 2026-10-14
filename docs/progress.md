# Progress

Updated: 2026-10-14 (revisión docente dentro de la web, PR #31; vago, PR #30 y auditoría PR #32; spec de F8, PR #43; F8: T1, T2 y T3 fusionados en PR #54, #70 y #57; corrida cycle-d6a8417-qmvt; mejoras de la revisión docente #58 a #66, PR #72 a #81, "Enviar todo" fusionado en PR #78 el 2026-10-13; medición en equipos de referencia #6; canal de retorno #67 decidido; harness Rockbuilt 0.4.0 fusionado en PR #86; spec 03 del canal de retorno fusionado en PR #100, tareas #87 a #99; spec 04 de propuestas para la sesión docente; corridas nocturnas cycle-79c539f-qbnz y cycle-d52a895-vxmo: fusionados #110 a #113, #115 y #121; corrida cycle-97d0089-tqje: fusionados #114, #116, #117, #119 y #123; corrida cycle-026d53f-mxwp: fusionados #124, #126, #128 y #129)

Todos los enlaces del proyecto (sitio, formularios, marca, GitHub): [docs/enlaces.md](enlaces.md).

## Current objective
Preparar la única sesión de cada docente: construir el canal de retorno con Apps Script (spec 03,
#87 a #99) y las propuestas razonadas para marcadores y trazos del vago (spec 04), para que el
docente confirme o corrija en vez de ubicar desde cero. En paralelo: F8 (#33 a #42), el ADR 0010
(trazar el vago torácico) y los cambios baratos de carga (#83 a #85).

## Current state
- Revisión docente dentro de la web (PR #31): todo se ve como lo verá el público y el docente suma
  los botones. Guía ("Cómo revisar", se abre sola la primera vez, con el botón de registro), "Qué
  revisar" con prioridad (24 dudas abiertas en 31 fichas, vago, grupos del lanzamiento, resto),
  dudas dentro de cada ficha con su campo `duda.N`, sinónimos visibles y revisables, nombres con su
  etiqueta, descripción de los grupos sin pasar el mouse y 5 marcadores del encéfalo con posición
  aproximada para corregir (locus coeruleus, rafe del bulbo, área postrema, núcleos anteriores del
  tálamo, Wernicke).
- Vago (ADR 0009, PR #30 y #31): no se fragmenta; su ficha ofrece "Recorrer el vago" (4 paradas,
  revelado progresivo, textos tomados de fichas con fuente). F25 lista en la app (punteado, aviso,
  leyenda, filtro). Las rutas trazadas se publican en `public/modelos/rutas-vago.json` (hoy vacío) y
  se ven para todos con "Pendiente de revisión docente"; antes del lanzamiento, lo que siga en
  revisión se aprueba o se retira. Pipeline listo: `auditar-vago.py`, `rutas-vago.yaml`,
  `generar-ramas-vago.py` y la prueba de las cuatro asimetrías.
- Auditoría del vago hecha (PR #32, `docs/research/vago/auditoria-vago.md`): los 21 anclajes medidos
  (el ligamento arterioso no existe; se usa su ganglio como sustituto) y un nombre propuesto por
  trazo. Hallazgo: el vago del tórax de Z-Anatomy es un espejo izquierda-derecha que atraviesa el
  arco aórtico y el bronquio derecho, así que el ADR 0010 decide trazar también el tramo torácico de
  los dos lados y no publicar el escaneado de ese tramo. `pipeline/anclajes-vago.json` entra con esa
  implementación (con el modelo actual, la prueba de asimetrías falla, como debe).
- Publicado: https://ragarciaga.github.io/3d_brain/ (español en `/es`, inglés en `/en`). Cada merge
  a `main` se publica solo con el workflow `pages`.
- Nombre y marca: **Maysa Brain**, con logo propio (`public/marca/`) y paleta de Maysa; modo claro y
  oscuro con botón.
- Interfaz: modo estudio (PR #25): cerebro a pantalla completa, riel de herramientas, ficha a la
  izquierda con descripción y "Recursos y artículos de referencia", explosión vertical a la derecha
  (al 100 % las piezas quedan en inventario, mínimo 8 bloques), brújula de vistas y búsqueda con
  Ctrl+K. Paneles laterales plegables. Se quitó "Armar pieza por pieza".
- F8 (planos de corte) en construcción: listas la lógica pura (`src/lib/cortes.ts`, PR #54), el
  estado en el store con las guardas de explosión y Separar (PR #70) y la lista medida de mallas
  cerradas, 191 de 253, que `check:modelo` verifica (PR #57). El visor ya recorta el encéfalo,
  con fantasma y toque recortado (PR #123), y los cortes viajan en el enlace (PR #128); todavía no hay
  panel de cortes (T8 y T9).
- Works: typecheck, lint, más de 400 pruebas unitarias, check:i18n, check:modelo (341 mallas, 287
  piezas, 6,53 MB) y build; unas 60 E2E. F1 a F7, F9, F10, F11, F24, el recorrido del vago (F14) y F25 sin
  geometría trazada todavía. Sin "Ambos idiomas" (quitado el 2026-10-13); selector ES | EN claro. Bugs #16 (Reintentar) y #19 (Separar)
  cerrados.
- Medición: `?medir=1` abre un panel con tiempos de código, descarga y preparación del modelo,
  primer cuadro, cuadros por segundo y GPU, con botón para copiar (docs/operacion.md). Medido en el
  entorno de Claude: código 1,1 s, descarga del modelo 2,4 s, preparación 1 s, cerebro a los 4,5 s;
  la descarga del modelo empezaba cuando terminaba el código; desde #117 (#83) el modelo se pide con el
  HTML, en paralelo con el código. En los equipos de referencia (#6, editor,
  2026-10-13): iPhone y PC cumplen; el Android de gama baja (Tecno Spark 8C, PowerVR GE8300) da 21 a
  23 cuadros/s con el cerebro armado girando y 8,9 s hasta ver el cerebro.
- Content: 236 de 236 fichas en borrador con fuentes verificadas (#7, PR #22; el lóbulo grácil se
  agregó el 2026-10-13). Ningún latín queda PENDIENTE: 13 parcelas de Destrieux muestran "sin
  término oficial" (TA2 y Terminologia Neuroanatomica, vía ten Donkelaar 2018) y 16 nombres en
  español quedan como propuesta para los docentes (#8). Los nombres, las fichas, las posiciones de
  marcadores y los trazos del vago los validan docentes, no el editor.
- Revisión docente lista: formularios de revisión y de registro conectados (#5); 10 códigos de
  revisor (D01 a D10) con padrón y enlaces en la carpeta privada "Maysa Brain (privado)" del Drive
  de Maysa Digital, nunca en el repositorio (#15); mensaje para cada docente en
  docs/guia-docentes.md, guía del editor en docs/revision-docente.md, 16 propuestas de nombre
  visibles (#8).
  Todo lo anatómico (nombres, fichas, posiciones, trazos) lo validan docentes, no el editor.
- Pending (editor):
  - fusionar el PR de la spec 04 y, después, los PR de nivel C que traen las posiciones y la
    evidencia propuestas (resumen antes y después en cada PR);
  - mandar a cada docente el mensaje de docs/guia-docentes.md con su enlace (el registro está dentro
    de la web) y anotar su nombre junto al alias en el documento de enlaces del Drive;
  - importar las revisiones con `scripts/importar-revisiones.ts` (CSV desde la pestaña Respuestas
    del formulario de revisión).
- Mejoras de la revisión docente (auditoría UX, `docs/research/revision-docente/auditoria-ux.md`), en
  main: textos claros (#65), diálogos accesibles y propuestas guardadas mientras se escribe (#64),
  avance por ficha y "x de y fichas completas" (#59), botones de 44 px y "Marcar todo como
  correcto" (#66), Deshacer al proponer posición (#61), barra compacta en celular con menú
  "Acciones" y salir con confirmación (#63), respaldo descargable y código recordado (#60), trazos
  del vago en "Qué revisar" con "Siguiente trazo" y propuesta de la auditoría (#62), y "Enviar todo"
  en un solo formulario con "Sí, lo envié" (#58, PR #78, fusionado el 2026-10-13).
- Corrida nocturna cycle-79c539f-qbnz (2026-10-14, merges de nivel C autorizados por el editor solo
  esa noche): fusionados #110 (03-T3, fecha en la carga e importador), #111 (03-T1, página y script
  para probar el canal) y #112 (02-T1, rutas torácicas del vago en el generador). Abiertos con
  revisiones aprobadas: #113 (04-T1), #114 (03-T4), #115 (03-T5), #116 (03-T2, Apps Script completo)
  y #117 (#83, precarga del modelo). 04-T2 (#102) quedó bloqueada tras 2 devoluciones y espera tu
  respuesta. Segunda corrida (cycle-d52a895-vxmo): fusionados #113 (04-T1), #115 (03-T5) y #121 (e2e
  con 2 workers en CI); abiertos #114, #116, #117, #119 (02-T2); 01-T4 (cortes en el visor) en
  revisión. El e2e de CI quedó al borde de su tope de 30 min (escalado en #1). Tercera corrida
  (cycle-97d0089-tqje): fusionados #114 (03-T4), #117 (#83), #123 (01-T4, cortes en el visor),
  #116 (03-T2, Apps Script completo) y #119 (02-T2); 03-T6 (#92, autorización en la app) en revisión
  tras una devolución. Cuarta corrida (cycle-026d53f-mxwp): fusionados #124 (02-T3, revisión por
  ruta), #126 (03-T6, autorización Ley 1581 en la app), #128 (01-T5, cortes por enlace) y #129 (#84,
  densidad de píxeles adaptativa); #127 (02-T4, corte del tronco en el pipeline) espera la prueba de
  Blender del editor (#49); 03-T7 (guardado automático) en revisión. Quinta corrida
  (cycle-197b7e3-pqzw): #131 (03-T7) con las tres revisiones aprobadas, frenado solo por el tope de
  30 min del e2e de CI; 03-T8 (traer lo guardado al abrir y retirar el respaldo por archivo)
  implementado sobre #131 y en revisión. El e2e de CI ya no cabe en su tope
  de 30 min (main en rojo desde #124 por tiempo, no por fallas): el arreglo va en el harness.
- Pending (hito 2): F8 cortes (spec aprobado, tareas #33 a #42), F12 reportar error (#10), trazos del
  vago con docentes (#11).

## Key decisions
- 2026-10-14: posiciones de marcadores propuestas por regla anatómica sobre piezas vecinas del
  modelo, cada una con fuente verificada, como `aproximada`; trazos del vago con evidencia medida y
  propuesta con confianza (spec 04 por delegación del editor), see
  docs/adr/0013-posiciones-propuestas-por-regla-anatomica.md y docs/research/marcadores/fuentes.md
- 2026-10-14: el canal de retorno de la revisión docente pasa a un Apps Script del editor, en un solo
  momento dentro del navegador, con el código en la URL y sin créditos públicos ("Revisado por un
  docente universitario"), see docs/adr/0012-apps-script-canal-revision.md y
  docs/specs/03-review-return-channel/
- 2026-10-14: medición en los equipos de referencia hecha (#6): iPhone y PC cumplen; el Android de
  gama baja (Tecno Spark 8C, PowerVR GE8300) da 21 a 23 cuadros/s con el cerebro armado girando y
  8,9 s hasta ver el cerebro. Se hacen dos cambios baratos (pedir el modelo desde el inicio y
  densidad de píxeles adaptativa) sin F19
- 2026-10-13: vago torácico: corte del tronco en el pipeline entre subclavia y bronquio, filtro de solo escaneada con hueco, revisión por ruta, see docs/specs/02-thoracic-vagus-tracing/design.md y docs/adr/0010-vago-toracico-trazado.md
- 2026-10-13: el vago del tórax se traza en los dos lados porque el escaneado es un espejo, see docs/adr/0010-vago-toracico-trazado.md
- 2026-10-13: F8 cortes: cortar arma el cerebro, solo se corta el encéfalo, relleno por caras traseras en mallas cerradas y contorno en las abiertas, see docs/adr/0011-relleno-corte-caras-traseras.md
- 2026-10-13: vago fijo, recorrido guiado y trazado solo de tres piezas con F25, see docs/adr/0009-vago-fijo-recorrido-y-trazado-selectivo.md
- 2026-10-13: los docentes revisan solo la web: todo visible como lo verá el público (también las
  rutas trazadas, con su estado), guía, prioridades y dudas dentro de la app; antes del lanzamiento,
  lo trazado que siga en revisión se aprueba o se retira. See docs/adr/0009 (actualización) y SPEC F24
- 2026-10-13: sin "Ambos idiomas"; lo bilingüe queda en la búsqueda cruzada y el latín visible (SPEC §15)
- 2026-10-11: stack SPA con Vite, React y R3F, see docs/adr/0001-stack.md
- 2026-10-11: sin IA en el producto, see docs/adr/0002-sin-ia-flujo-fijo.md
- 2026-10-11: geometría y contenido separados, sin backend, see docs/adr/0003-datos-sin-backend.md
- 2026-10-11: pipeline con fuente fijada e invariante de posición, see docs/adr/0004-pipeline-geometria.md
- 2026-10-11: hosting en GitHub Pages, see docs/adr/0005-hosting-github-pages.md
- 2026-10-11: vago como pieza más marcadores, see docs/adr/0006-vago-y-faltantes.md
- 2026-10-11: licencias MIT y CC BY-SA 4.0, see docs/adr/0007-licencias.md
- 2026-10-11: revisión docente por formulario de Google, see docs/adr/0008-revision-docente.md
- 2026-10-11: el importador de revisiones trata el formulario como entrada no confiable (todo texto
  como código en línea, validación estricta), see docs/revision-docente.md sección 4
- 2026-10-12: el producto se llama Maysa Brain; se quita "Armar pieza por pieza" (lo importante son
  las fichas); explosión radial hasta 70 % y luego inventario; modo estudio para no parecerse a
  otros atlas. Ver SPEC.md F6, F7, F9 y §15.
- 2026-10-12: un código privado por docente (10 creados); los códigos nunca van al repositorio: el
  padrón vive en el Drive privado de Maysa Digital (#15), see docs/adr/0008-revision-docente.md
- 2026-10-12: medir antes de optimizar la carga; `?medir=1` da los datos.
- 2026-10-12: el contenido anatómico (nombres, fichas, posiciones, trazos) lo validan docentes, no
  el editor; las propuestas sin término en TA2 se muestran en la ficha y siguen PENDIENTE hasta esa
  revisión (#8)

## Next steps
1. Canal de retorno (spec 03): T1 a T6 en main; T7 en PR #131 (espera el arreglo del tope del e2e); T8 en revisión. Falta que el editor corra la
   prueba de `probar-canal.html` (T1, #87) con su Apps Script, revise el texto legal de la
   autorización (plan en #92) y monte `Codigo.js`; después siguen T8 a T13 (T13 necesita la URL del
   script).
2. Propuestas para la sesión docente (spec 04, `docs/specs/04-teacher-review-proposals/`): reglas y
   ubicador de marcadores, corrida real sobre Z-Anatomy, evidencia de los 28 trazos y "Correcto" con
   un toque. Los datos llegan en PR de nivel C que fusiona el editor. T1 en main; T2 bloqueada
   (#102, una devolución más recomendada).
3. Revisión docente: cuando 1 y 2 estén en main, mandar el mensaje a los 10 docentes.
4. Vago (ADR 0010): spec aprobado en `docs/specs/02-thoracic-vagus-tracing/`. T1, T2 y T3 en main (PR #112, #119 y #124); T4 en PR #127, espera la prueba de Blender del editor (#49). Se trazan los tramos torácicos, el pipeline corta el tronco escaneado en espejo, la prueba de asimetrías mide lo publicado y la revisión docente pasa a ser por ruta. Auditoría hecha (`docs/research/vago/auditoria-vago.md`); los nombres propuestos de los trazos van a los docentes con F24.
5. Carga (#6, medición hecha; tareas #83 a #85): pedir el modelo desde el inicio, junto con el
   código, y bajar la densidad de píxeles solo cuando el equipo va lento, más un desglose de
   "preparar el modelo" en el panel de medición. No se abre F19. #83 en PR #117; siguen #84 y #85.
6. Hito 2: F8 con spec aprobado (`docs/specs/01-cutting-planes/`, ADR 0011) y 10 tareas (#33 a #42; T1 a T9 tier B, T10 medición manual del editor). El spec ya está en main (PR #43). Hechas T1, T2 y T3; la próxima corrida sigue con T4 (visor) y después T5 y T6; las capturas del relleno (prototipo de #9) salen de T6 y T7. Después F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
| Task | plan | implement | Total |
|---|---:|---:|---:|
| i83 |  |  | 0.0 |
| i120 |  |  | 0.0 |
| T6 |  |  | 0.0 |
| T4 | 7.2 |  | 7.2 |
| T1 | 5.8 |  | 5.8 |
| T3 | 5.8 | 5.1 | 10.9 |
| T5 | 2.8 | 14.2 | 17.0 |
| T11 | 4.9 |  | 4.9 |
| T2 | 17.1 |  | 17.1 |
| i84 |  |  | 0.0 |
| T7 |  |  | 0.0 |
| T8 |  |  | 0.0 |

Minutes per phase.
Open (started, not ended): T5/implement, T4/implement, i84/implement, T7/implement, T8/implement.
<!-- rb:timing:end -->
