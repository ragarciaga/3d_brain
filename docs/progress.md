# Progress

Updated: 2026-10-11 (hito 1.1 fusionado, sitio publicado)

## Current objective
Hito 1.2 (#17): explosión más amplia, botones de aislar y separar que se alternan, y "Armar pieza
por pieza" en dos modos (tocar para devolver y reto de arrastrar). Viene de lo que el editor vio al
probar el sitio publicado.

## Current state
- Publicado: https://ragarciaga.github.io/3d_brain/ (español en `/es`, inglés en `/en`). Cada merge
  a `main` se publica solo con el workflow `pages`.
- Works: main en verde (02a1848): typecheck, lint, 172 pruebas unitarias, check:i18n, check:modelo
  (341 mallas, 287 piezas, 6,53 MB) y build; 25 E2E en CI. F1 a F7, F9, F10, F11 y F24. El hito
  1.1 (PR #14) pasó verificador, auditor ciego y revisión de seguridad sobre el commit final.
- Broken: "Reintentar" tras una falla de carga deja un error de React en consola, aunque la app se
  recupera (#16).
- Pending (editor):
  - formulario de revisión (#5);
  - decidir cómo mostrar el código del revisor en los issues (#15);
  - medir en los equipos (#6);
  - verificar fuentes (#7);
  - nombres PENDIENTE (#8);
  - conseguir revisores.
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
- 2026-10-11: el importador de revisiones trata el formulario como entrada no confiable (todo texto
  como código en línea, validación estricta), see docs/revision-docente.md sección 4
- 2026-10-11: "Armar pieza por pieza" tendrá modo normal (tocar) y modo reto (arrastrar); el editor
  lo aprobó, va a SPEC F7 en #17

## Next steps
1. Hito 1.2 (#17): plan, SPEC F7, implementación, verificación y merge.
2. Configurar el formulario de revisión (#5) y repartir enlaces a los docentes.
3. Medir en los equipos de referencia (#6); si el Android baja de 30 cuadros/s, abrir el issue de F19.
4. Hito 2: prototipo de F8 (stencil), F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
