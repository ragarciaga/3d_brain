# Progress

Updated: 2026-10-11 (hito 1.2 fusionado y publicado)

## Current objective
Piloto con docentes: configurar el formulario de revisión (#5), medir en los equipos (#6) y
recoger la opinión del editor sobre el hito 1.2 (explosión, botones que se alternan, armar en dos
modos).

## Current state
- Publicado: https://ragarciaga.github.io/3d_brain/ (español en `/es`, inglés en `/en`). Cada merge
  a `main` se publica solo con el workflow `pages`.
- Works: main en verde (f563ffd): typecheck, lint, 253 pruebas unitarias, check:i18n, check:modelo
  (341 mallas, 287 piezas, 6,53 MB) y build; 30 E2E en CI. F1 a F7, F9, F10, F11 y F24. Hito 1.1
  (PR #14) y hito 1.2 (PR #18) pasaron verificador y auditor ciego sobre el commit final; el 1.1
  también revisión de seguridad.
- Hito 1.2: la explosión separa también las piezas profundas (mínimo 5 cm, pares al menos 4 veces
  más lejos) y la cámara se aleja sola; Aislar, Aislar con contexto y Separar se alternan;
  "Armar pieza por pieza" tiene modo tocar y modo reto (arrastrar y encajar).
- Broken: "Reintentar" tras una falla de carga deja un error de React en consola, aunque la app se
  recupera (#16). "Separar" desde la ficha deja la estructura fuera de cuadro si la cámara está muy
  cerca (#19).
- Pending (editor):
  - formulario de revisión (#5);
  - decidir cómo mostrar el código del revisor en los issues (#15);
  - medir en los equipos (#6);
  - verificar fuentes (#7);
  - nombres PENDIENTE (#8);
  - probar el arrastre del modo reto en iPhone y Android;
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
- 2026-10-11: "Armar pieza por pieza" con modo tocar y modo reto (arrastrar); aprobado por el editor,
  en SPEC F7 (#17, PR #18)
- 2026-10-11: explosión con distancia base y término radial con tope, y reencuadre automático, see
  SPEC.md sección 10

## Next steps
1. Corregir #19 (encuadre al separar) y #16 (error de consola al reintentar).
2. Configurar el formulario de revisión (#5) y repartir enlaces a los docentes.
3. Medir en los equipos de referencia (#6); si el Android baja de 30 cuadros/s, abrir el issue de F19.
4. Hito 2: prototipo de F8 (stencil), F12 y fichas verificadas. Issue de control: #1.

## Timing
<!-- rb:timing:start -->
<!-- rb:timing:end -->
