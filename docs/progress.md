# Progress

Updated: 2026-10-11 (hito 1)

## Current objective
Hito 1 (piloto con docentes) construido y en revisión en el PR del kickoff. Siguiente: medir en los
equipos de referencia y arrancar el piloto con los revisores.

## Current state
- Works: pipeline de la fase 0 reproducible (338 mallas, 6,49 MB, posiciones verificadas al 0,1 mm);
  F1 a F7, F9, F10, F11 y F24; aviso educativo y pantalla de licencia; 59 pruebas unitarias y
  9 E2E en verde; build para GitHub Pages.
- Broken: nada conocido. Rendimiento real sin medir: en la nube solo hay WebGL por software.
- Pending (editor): fusionar el PR; activar GitHub Pages (Settings, Pages, Source: GitHub Actions);
  crear el formulario de Google de revisión (docs/revision-docente.md); conseguir revisores;
  medir cuadros por segundo en el portátil, el iPhone y el Android.
- Pending (contenido): las fuentes de las 10 fichas están "por verificar" (la red de la sesión
  bloqueó NCBI); 54 piezas con nombre en español PENDIENTE.

## Key decisions
- 2026-10-11: stack SPA con Vite, React y R3F, see docs/adr/0001-stack.md
- 2026-10-11: sin IA en el producto, see docs/adr/0002-sin-ia-flujo-fijo.md
- 2026-10-11: geometría y contenido separados, sin backend, see docs/adr/0003-datos-sin-backend.md
- 2026-10-11: pipeline con fuente fijada e invariante de posición, see docs/adr/0004-pipeline-geometria.md
- 2026-10-11: hosting en GitHub Pages, see docs/adr/0005-hosting-github-pages.md
- 2026-10-11: vago como pieza más marcadores, see docs/adr/0006-vago-y-faltantes.md
- 2026-10-11: licencias MIT y CC BY-SA 4.0, see docs/adr/0007-licencias.md
- 2026-10-11: revisión docente por formulario de Google, see docs/adr/0008-revision-docente.md

## Next steps
1. Fusionar el PR #3 y activar GitHub Pages.
2. Configurar el formulario de revisión y repartir enlaces a los docentes.
3. Medir en los equipos de referencia; si el Android baja de 30 cuadros/s, abrir el issue de F19.
4. Hito 2: prototipo de F8 (stencil), F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
