# Progress

Updated: 2026-10-11

## Current objective
Construir el esqueleto (issue del walking skeleton) y luego el pipeline de la fase 0, primeras tareas del hito 1 (piloto con docentes).

## Current state
- Works: kickoff aprobado. AGENTS.md, SPEC.md 0.3, docs/brief.md, ADRs 0001 a 0008, docs/v2.md y el reporte de la fase 0 (docs/research/fase-0/REPORT.md).
- Broken: nada; todavía no hay código, así que los comandos de Verification no existen aún (los crea el esqueleto).
- Pending: el editor revisa y fusiona el PR del kickoff. El editor consigue los docentes revisores (SPEC 15.2) antes del piloto.

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
1. Fusionar el PR del kickoff.
2. `/rb-build #2` (esqueleto). Issue de control: #1.
3. `/rb-spec` del pipeline de la fase 0, luego F1 + F2, F4 + F5 + F9 + marcadores, F24, F6 + F7, F3 + F10 + F11.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
