# Progress

Updated: 2026-10-12 (revisión docente en marcha: formularios, códigos y guía listos)

## Current objective
Revisión docente (F24) de las fichas, los nombres pendientes, las posiciones de marcadores y los
trazos del vago. Todo lo anatómico lo validan docentes; el editor solo reparte enlaces y aprueba
los cambios que salgan de sus revisiones.

## Current state
- Publicado: https://ragarciaga.github.io/3d_brain/ (español en `/es`, inglés en `/en`) con la marca
  Maysa Brain. Cada merge a `main` se publica solo con el workflow `pages`.
- Works: main en verde (778b3fc): typecheck, lint, 262 pruebas unitarias, check:i18n, check:modelo
  (341 mallas, 287 piezas, 6,53 MB), build y 34 E2E. F1 a F6, F9, F10, F11 y F24, más modo estudio,
  paneles plegables y tema claro u oscuro. "Armar pieza por pieza" (F7) salió del alcance.
- Content: 235 de 236 fichas en borrador, con fuentes abiertas y contrastadas con PubMed (#7,
  PR #22). Falta solo el lóbulo grácil. 18 nombres en español y latín siguen PENDIENTE, con
  propuesta visible en la ficha para los docentes (#8). Dudas para docentes en docs/fichas-dudas.md.
- Revisión docente lista (PR #23 y #24):
  - formularios de registro y de revisión en el Drive de Maysa Digital; la app abre el de revisión
    ya lleno;
  - 10 códigos de revisor (D01 a D10); padrón y enlaces en la carpeta privada "Maysa Brain
    (privado)" del Drive de Maysa Digital, nunca en el repositorio;
  - guía para docentes en docs/guia-docentes.md; guía del editor en docs/revision-docente.md.
- Broken: nada conocido.
- Pending (editor):
  - enviar a cada docente su enlace, el formulario de registro y la guía; anotar su nombre junto al
    alias en el documento de enlaces del Drive;
  - cuando lleguen revisiones: descargar el CSV de respuestas y pedir la importación (#8, #11);
  - medir en los equipos de referencia (#6).
- Pending (hito 2): F8 cortes (#9), F12 reportar error (#10).

## Key decisions
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
- 2026-10-12: los issues muestran el alias del revisor (D01...), nunca su código; el padrón vive
  fuera del repositorio (#15), see docs/adr/0008-revision-docente.md
- 2026-10-12: el contenido anatómico (nombres, fichas, posiciones, trazos) lo validan docentes, no
  el editor; las propuestas sin término en TA2 se muestran en la ficha y siguen PENDIENTE hasta esa
  revisión (#8)
- 2026-10-12: "Armar pieza por pieza" sale del alcance; cada ficha trae búsquedas de artículos
  científicos (PR #21)

## Next steps
1. Repartir los 10 enlaces de docentes (empezar por las 40 fichas del lanzamiento: sistema
   límbico, ganglios basales, diencéfalo, tronco encefálico y vago).
2. Importar las primeras revisiones y preparar los cambios (`scripts/importar-revisiones.ts`).
3. Medir en los equipos de referencia (#6); si el Android baja de 30 cuadros/s, abrir el issue de F19.
4. Hito 2: prototipo de F8 (stencil) y F12. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
