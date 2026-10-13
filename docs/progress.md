# Progress

Updated: 2026-10-13 (revisión docente dentro de la web, PR #31; vago, PR #30 y auditoría PR #32; spec de F8, PR #43)

Todos los enlaces del proyecto (sitio, formularios, marca, GitHub): [docs/enlaces.md](enlaces.md).

## Current objective
Arrancar la revisión docente: mandar el mensaje de `docs/guia-docentes.md` a cada docente. En
paralelo: construir F8 (#33 a #42), implementar el ADR 0010 (trazar el vago torácico) y medir la
carga en los equipos de referencia (#6).

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
- Works: typecheck, lint, 300 pruebas unitarias, check:i18n, check:modelo (341 mallas, 287 piezas,
  6,53 MB) y build; 39 E2E. F1 a F7, F9, F10, F11, F24, el recorrido del vago (F14) y F25 sin
  geometría trazada todavía. Sin "Ambos idiomas" (quitado el 2026-10-13); selector ES | EN claro. Bugs #16 (Reintentar) y #19 (Separar)
  cerrados.
- Medición: `?medir=1` abre un panel con tiempos de código, descarga y preparación del modelo,
  primer cuadro, cuadros por segundo y GPU, con botón para copiar (docs/operacion.md). Medido en el
  entorno de Claude: código 1,1 s, descarga del modelo 2,4 s, preparación 1 s, cerebro a los 4,5 s;
  la descarga del modelo empieza cuando termina el código.
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
  - medir en iPad, celular y PC con `?medir=1` y pegar los resultados en #6;
  - mandar a cada docente el mensaje de docs/guia-docentes.md con su enlace (el registro está dentro
    de la web) y anotar su nombre junto al alias en el documento de enlaces del Drive;
  - importar las revisiones con `scripts/importar-revisiones.ts` (CSV desde la pestaña Respuestas
    del formulario de revisión).
- Pending (hito 2): F8 cortes (spec aprobado, tareas #33 a #42), F12 reportar error (#10), trazos del
  vago con docentes (#11).

## Key decisions
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
1. Revisión docente: mandar el mensaje a los 10 docentes e importar las primeras respuestas con
   `scripts/importar-revisiones.ts`.
2. Vago (ADR 0010): agregar a `rutas-vago.yaml` los tramos torácicos de los dos lados, recortar del
   GLB el tramo escaneado que reemplazan (pipeline con Blender, sin mover lo demás), subir
   `anclajes-vago.json` y generar las rutas; la prueba de asimetrías tiene que pasar con el modelo
   real. Los docentes las juzgan en la app con "Recorrido trazado" y los nombres propuestos de los
   trazos con F24.
3. Medir en los equipos de referencia (#6). Si la descarga del modelo pesa más, adelantarla para que
   empiece junto con el código (cerca de 1 s menos); si el Android baja de 30 cuadros/s, abrir el
   issue de F19.
4. Hito 2: F8 con spec aprobado (`docs/specs/01-cutting-planes/`, ADR 0011) y 10 tareas (#33 a #42; T1 a T9 tier B, T10 medición manual del editor). El spec ya está en main (PR #43): el ciclo construye las tareas; las capturas del relleno (prototipo de #9) salen de T6 y T7. Después F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
