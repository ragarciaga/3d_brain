# Progress

Updated: 2026-10-11 (hito 1 fusionado)

## Current objective
Hito 1 fusionado en main (PR #3, commit b69afdf). Siguiente: publicar en GitHub Pages, configurar
la revisión docente y arrancar el piloto.

## Current state
- Works: main en verde (typecheck, lint, 63 pruebas unitarias, check:i18n, check:modelo, build) y
  10 E2E en CI. Pipeline fase 0 reproducible; F1 a F7, F9, F10, F11 y F24. Revisado por verificador,
  auditor ciego y revisión de seguridad sobre el commit final.
- Broken: nada conocido.
- Pending (editor): activar Pages (#4), formulario de revisión (#5), medir en los equipos (#6),
  verificar fuentes (#7), nombres PENDIENTE (#8), endurecimiento (#12), conseguir revisores.
- Pending (hito 2): F8 cortes (#9), F12 reportar error (#10), trazos del vago con docentes (#11).

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
1. Activar GitHub Pages (#4) y lanzar el workflow "pages".
2. Configurar el formulario de revisión (#5) y repartir enlaces a los docentes.
3. Medir en los equipos de referencia; si el Android baja de 30 cuadros/s, abrir el issue de F19.
4. Hito 2: prototipo de F8 (stencil), F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
