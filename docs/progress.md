# Progress

Updated: 2026-10-18 (corrida cycle-381f1ba-vgto: fusionados #212 (SPEC F24), #214 (brújula, #213), #222 (vago torácico, plan B: se retira el tramo en espejo y queda un hueco explicado; cierra #50 y #51) y la guía del revisor sin recorridos trazados; cerrados #215 y #216 sin fusionar; corrida cycle-4889aa8-pwzk, segunda parte: spec 04 completa con #203 (04-T6), #204 (04-T4), #206 (04-T7) y #209 (04-T8); fusionados también #198 (Rockbuilt 0.9.0), #202 (cámara quieta en e2e, #201), #207 (bookkeeping) y #210 (ficha de destino en e2e, #208); abierto para el editor #205 (verificación de F8); antes: fusionados #189 (bookkeeping), #191 (importador aparta las respuestas sin autorización, #190), #192 (SPEC paso 9, #56), #193 (seguridad del modo revisión, #149), #196 (controles en celular, #194) y #199 (panel de fragmentar y brújula en escritorio, #197); primera parte: fusionados #172 (04-T3), #173 (Rockbuilt 0.7.0), #174 (privacidad, autorización v3), #175 (04-T5), #179 (script cerrado antes del despliegue), #180 (medición de cortes, #42), #181 (importador), #182 (marcadores con cortes), #183 (índice de toque después del primer cuadro), #184 (pausa del reloj en e2e), #186 (seguimientos), #187 (recorte por caja en los cortes) y #188 (SPEC y diseño de cortes al día); corrida cycle-c2c1f9f-hbrq: fusionados #161, #165 (analítica), #164 (04-T2), #167 (importador y casilla del vago) y #170 (autorización v2, Padrón en caché, leer por POST); prueba de Blender de #49 corrida en la nube; revisión docente dentro de la web, PR #31; vago, PR #30 y auditoría PR #32; spec de F8, PR #43; F8: T1, T2 y T3 fusionados en PR #54, #70 y #57; corrida cycle-d6a8417-qmvt; mejoras de la revisión docente #58 a #66, PR #72 a #81, "Enviar todo" fusionado en PR #78 el 2026-10-13; medición en equipos de referencia #6; canal de retorno #67 decidido; harness Rockbuilt 0.4.0 fusionado en PR #86; spec 03 del canal de retorno fusionado en PR #100, tareas #87 a #99; spec 04 de propuestas para la sesión docente; corridas nocturnas cycle-79c539f-qbnz y cycle-d52a895-vxmo: fusionados #110 a #113, #115 y #121; corrida cycle-97d0089-tqje: fusionados #114, #116, #117, #119 y #123; corrida cycle-026d53f-mxwp: fusionados #124, #126, #128 y #129; corridas cycle-197b7e3-hjkt y cycle-032bd1e-wqnz: fusionados #131, #134, #135, #137 y #138; corrida cycle-75748b5-tfkd: fusionado #140; corrida cycle-3f9c2e1-mzkb: fusionados #141, #143, #144 y #146, dominio brain.maysasp.com; corrida cycle-7ff7fd1-qvrn: fusionados #147, #148, #152, #153 y #154; corrida cycle-39630e3-nwpb: fusionados #145, #155, #156, #159 y #160)

Todos los enlaces del proyecto (sitio, formularios, marca, GitHub): [docs/enlaces.md](enlaces.md).

## Current objective
Preparar la única sesión de cada docente: construir el canal de retorno con Apps Script (spec 03,
#87 a #99) y las propuestas razonadas para marcadores y trazos del vago (spec 04), para que el
docente confirme o corrija en vez de ubicar desde cero. En paralelo: F8 (#33 a #42), el ADR 0010
(trazar el vago torácico) y los cambios baratos de carga (#83 a #85).

## Current state
- Revisión docente dentro de la web (PR #31): todo se ve como lo verá el público y el docente suma
  los botones. Guía ("Cómo revisar", se abre sola la primera vez), "Qué
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
- Publicado: https://brain.maysasp.com/ (español en `/es`, inglés en `/en`). Cada merge
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
  con fantasma y toque recortado (PR #123), y los cortes viajan en el enlace (PR #128). Panel,
  cajón en celular, marcadores con cortes y recorte por caja en main; verificación de F8 (2026-10-17,
  #205): seguridad sin hallazgos y E2E 28 de 28.
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
  implementado sobre #131 y en revisión. Sexta corrida (cycle-197b7e3-hjkt): Rockbuilt 0.5.0 con el e2e en 3
  shards (#134, el CI vuelve a caber); fusionados #131 (03-T7, guardado automático) y #135 (03-T8, traer lo
  guardado al abrir y retirar el respaldo por archivo). Séptima corrida (cycle-032bd1e-wqnz):
  fusionados #137 (03-T9, formulario de respaldo cuando el canal falla) y #138 (03-T11, "Revisado
  por un docente universitario" sin datos personales); 03-T10 (filtrar trazos según la casilla)
  planificado en #96. Octava corrida (cycle-75748b5-tfkd): fusionado #140 (03-T10, filtro del vago
  según la casilla); #141 (03-T12, guías del docente y del editor) con las revisiones aprobadas y en
  espera de tu prueba local del montaje del Apps Script (#98, R10.2); 01-T6 (relleno del corte,
  #38) en revisión.
- Pending (hito 2): F8 cortes (spec aprobado, tareas #33 a #42), F12 reportar error (#10), trazos del
  vago con docentes (#11).

## Key decisions
- 2026-10-16: rendimiento en gama baja cerrado como está (decisión del editor): en el Tecno el cerebro aparece a los 5,3 a 6,2 s (antes 7,8 a 11,3 s); los cuadros/s de `?medir=1` caen mientras se arma el índice de toque (10 sin cortes, 12 con el sagital, 6 con tres cortes). Se ajusta solo si llega retroalimentación; mejora conocida: que el índice ceda un cuadro entre tandas (ver #178)
- 2026-10-16: el Android de gama baja con cortes iba a 3 cuadros/s porque todas las mallas del encéfalo usaban `discard` con cualquier corte; se arregla con recorte por caja (#177, PR #187): las piezas enteras del lado oculto no se dibujan y las enteras del lado visible van sin planos. F19 (modelo liviano) queda diferido hasta medir de nuevo (decisión del editor), see docs/v2.md
- 2026-10-16: el índice de toque (árboles BVH) se arma después del primer cuadro, por tandas de 12 ms (#178, PR #183)
- 2026-10-16: `Codigo.js` se despliega una sola vez con #162, #168 y #169 (GET sin lectura, versión 3 exacta en `autorizar`, casilla del vago al guardar)
- 2026-10-16: la regla de no escribir la URL `/exec` aplica a issues, PR y documentos; en `src/config/revision.ts` se queda porque la app la necesita en el bundle (decisión del editor).
- 2026-10-16: aviso de privacidad sin banner (analítica sin cookies): página "Privacidad" en es y en con responsable Maysa Strategy Partners y contacto info@maysasp.com; la transferencia a EE. UU. va en la página, no en el diálogo (#168, texto pendiente de aprobación).
- 2026-10-16: analítica de Cloudflare publicada en un solo commit con `gitleaks:allow` en las dos líneas del token público (#150, opción 1; PR #165); el editor confirmó que cuenta visitas.
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

- 2026-10-16: importador (#190, opción A del editor): con `--autorizaciones`, las respuestas de alias sin ninguna autorización van solo a "Descartadas: sin autorización" (alias, campo, idioma, estructura), sin texto libre, porque `resumen.md` se vuelve issue público.
- 2026-10-16: modo revisión (#149): las llaves locales llevan una huella SHA-256 del código (no es secreta, solo evita el código en claro), sin migración; "Borrar también de este equipo" desmarcada por defecto; una página con el beacon recarga una vez antes de adoptar un código y, si sigue con beacon, no lo adopta; el aviso de privacidad dice lo que pasa por página (texto aprobado por el editor). El código recordado solo se escribe al abrir un enlace con `?r=`.
- 2026-10-18: vago torácico, plan B (decisión del editor): no se publican rutas trazadas en el lanzamiento; se retira el tramo en espejo de Z-Anatomy y queda un hueco explicado en la leyenda, la ficha y el recorrido (`huecos` en `rutas-vago.json`, ADR 0010 actualizado). Razón: el generador no logró rutas fuera de los órganos (pulmón izquierdo y arco solapados cerca de 1 mm). Antes, el editor fijó la tolerancia de contacto en 1 mm con tráquea y esófago y 0,5 mm con lo demás.
- 2026-10-17: datos de la spec 04 aprobados por el editor (#203, #204, #206): 26 posiciones `aproximada` con método y fuente, y en los trazos 7 gástricos posteriores, 2 tronco, 2 raicillas y 17 sin propuesta; los umbrales "(derivado)" de `pipeline/reglas_vago.py` quedan aprobados con #206.
- 2026-10-17: el lanzamiento a docentes espera las propuestas de la spec 04 (T4, T6, T7 y T8 en main), para que cada docente confirme o corrija en vez de ubicar desde cero (decisión del editor).
- 2026-10-17: controles (#194, #197): en celular el panel de fragmentar toma el ancho de su contenido y la brújula tiene más relleno para que Post quepa; en escritorio la brújula conserva su tamaño con celdas de 2rem, y con cortes o con poca altura el deslizador se acorta para no cruzarse con la brújula en modo revisión.

## Next steps
1. Revisión docente: todo listo en main (spec 04 completa; el vago torácico en espejo retirado con el hueco explicado). Falta mandar el mensaje a los 10 docentes (`docs/guia-docentes.md`).
2. Spec 04: sin `/rb-verify` todavía (las puertas de la función completa).
3. Rendimiento en gama baja: cerrado como está; si llega retroalimentación, primero que el índice de toque ceda un cuadro entre tandas, después recorte por hardware de las piezas cruzadas y F19.
4. Vago torácico trazado: después del lanzamiento (docs/v2.md). El trabajo del generador está en las ramas `rb/02-T5`, `rb/02-T6` y `rb/i216`; #52 (T7) queda diferido.

## Pendientes del editor (al 2026-10-18)
Hecho el 2026-10-16: #168 aprobado, privacidad publicada, #49 resuelto, medición de cortes en los tres equipos (#42), texto legal de #149 revisado y aprobado. Hecho el 2026-10-17: controles revisados en el iPhone (#194), Rockbuilt 0.9.0 aprobado (#198). Hecho el 2026-10-18: #205 fusionado, SPEC F24 autorizado (#212), plan B del vago torácico aprobado y fusionado (#222).

Sigue, en este orden:
1. Abrir https://brain.maysasp.com/es/revision con un código de prueba y mirar un trazo del vago, un marcador y el hueco del tórax (leyenda y ficha del vago), antes de mandar el mensaje.
2. Mandar el mensaje a los docentes (`docs/guia-docentes.md`): el script versión 3 está desplegado y probado y la hoja quedó limpia.

## Seguimientos abiertos (sin decisión pendiente)
- Modo revisión (#149): no hay prueba e2e de dos pestañas con el modelo cargado (el CI no tiene CPU para dibujarlo dos veces por software); el nombre del archivo de descarga ya no lleva el código, pero el contenido y las URL prellenadas del formulario de respaldo sí (por diseño; la ayuda y la guía lo advierten).
- Celular: botones de la brújula de 28 px, por debajo de los 44 px recomendados (#66).
- Sitio: GitHub Pages sirve `/es` y `/en` con estado 404 (por `404.html`); funciona para el usuario, pero los buscadores pueden no indexar esas rutas.
- Canal: `public/probar-canal.html` con `apps-script/prueba-canal.js` todavía lee por GET con una marca de prueba (no con un código); design.md de spec 03 dice que un código no puede empezar con `-` y `REVISOR_VALIDO` lo permite (la defensa real es el formato `@`).
- Visor: con cortes, al tocar una pieza no aparece su etiqueta 3D flotante (sin cortes sí); no se comparó con el comportamiento anterior. Los marcadores de la línea media (x = 0) se esconden con el sagital en 0 por quedar unas centésimas de micra del lado oculto.
- Índice de toque: árboles en modo `indirect` para evitar el pico de memoria de GPU al clonar índices, o un worker propio, solo si el editor nota trabas.
- Pruebas: F7-E1 de `e2e/verificar-canal.spec.ts` no revisa el `<head>`; `e2e/revision-canal.spec.ts` usa esperas fijas negativas.
- Cortes: el encuadre en celular no descuenta el cajón de cortes; el recorrido del vago puede tapar el cajón.
- Pruebas de F8 (informe de #205, no bloquean): F3-E2 comprueba "translúcido" por la lista de fantasmas y no por la opacidad del material; cinco esperas fijas negativas en `cortes-panel`, `cortes-movil`, `cortes-marcadores` y `cortes-relleno` se pueden cambiar por `cuadros()` con control positivo.
- Vago torácico (plan B, #222): los marcadores torácicos que quedaron (recurrente, plexo pulmonar, ramos bronquiales, cardíacos cervicales inferiores) están dentro del hueco, sin nervio al lado; `recorrido.notaToracico` y `notaIzquierdo` no dependen de `huecos` y habrá que condicionarlas cuando se publiquen rutas; `revision.seccion_vago` y SPEC.md F24 (recorridos trazados) hablan de rutas que hoy no se publican; ninguna prueba fija el cableado de `comprobarBandas` en `check-modelo.ts`; si se vuelve a correr `ubicar-marcadores.py`, el marcador cardíaco torácico vuelve al tronco en espejo.
- Pruebas: `e2e/revision-canal.spec.ts:382` falló una vez en CI y pasó al relanzar (#223, causa por encontrar).
- Spec 04: `evidencia` y `confianza` de `PropuestaTrazo` siguen opcionales en `src/data/tipos.ts` aunque los 28 trazos ya las traen; el docstring de `pipeline/auditar-vago.py` y `pipeline/README.md` todavía dicen que la medición "la leerá" `scripts/aplicar-trazos.ts`; 17 de los 28 trazos quedan sin propuesta y los nombra el docente; la fuente de un trazo se muestra como clave de bibliografía.
- Harness: actualizar una rama con un commit de main que solo cambia documentación obliga a correr todo el CI otra vez; Rockbuilt 0.9.0 (#198) trae la cola de fusiones para eso. `rb vendor` crea `e2e/smoke.spec.ts` en proyectos que ya tienen suite (ragarciaga/rockbuilt#22).

## Timing
<!-- rb:timing:start -->
| Task | plan | implement | audit | security | Total |
|---|---:|---:|---:|---:|---:|
| T3 | 5.8 | 5.1 |  |  | 10.9 |
| T1 |  |  |  |  | 0.0 |
| T1 |  |  |  |  | 0.0 |
| T1 |  |  |  |  | 0.0 |
| T4 |  |  |  |  | 0.0 |
| T5 |  |  |  |  | 0.0 |
| T2 |  |  |  |  | 0.0 |
| i83 |  |  |  |  | 0.0 |
| T2 |  |  |  |  | 0.0 |
| i120 |  |  |  |  | 0.0 |
| T4 |  |  |  |  | 0.0 |
| T3 |  |  |  |  | 0.0 |
| T6 |  |  |  |  | 0.0 |
| T4 |  |  |  |  | 0.0 |
| T5 |  |  |  |  | 0.0 |
| i84 |  |  |  |  | 0.0 |
| T7 |  |  |  |  | 0.0 |
| T8 |  |  |  |  | 0.0 |
| T9 |  |  |  |  | 0.0 |
| T11 |  |  |  |  | 0.0 |
| T10 |  |  |  |  | 0.0 |
| T12 |  |  |  |  | 0.0 |
| T6 |  |  |  |  | 0.0 |
| T8 |  |  |  |  | 0.0 |
| T7 |  |  |  |  | 0.0 |
| T2 |  |  |  |  | 0.0 |
| analitica |  |  |  |  | 0.0 |
| i163 | 9.4 |  | 3.3 | 2.2 | 14.9 |
| i162 | 10.1 |  |  |  | 10.1 |
| i149 |  |  |  |  | 0.0 |

Minutes per phase.
Open (started, not ended): i149/plan, T2/fix, i163/implement, i162/implement.
<!-- rb:timing:end -->
