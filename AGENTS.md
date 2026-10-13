# Atlas 3D de cerebro y nervio vago

Docs language: es
Project type: web
Default branch: main
Autonomy: auto
Parallel: auto
Max parallel: 3
Max tasks per run: 6

This file is the project contract. Every coding agent (Claude Code, Cursor, Codex) reads it, and
the Rockbuilt harness (`node tools/rockbuilt/rb.mjs`) parses its header lines and sections. Keep
the headings exactly as written.

## Goal
Atlas 3D web, público, gratuito y bilingüe (es, en) del cerebro y el nervio vago, para estudiantes
de psicología y ciencias de la salud. Se desarma en piezas, cada pieza tiene ficha con fuente,
nivel de evidencia y revisor visible, y se vuelve a armar sin perder la posición exacta.

Diferenciales que toda decisión debe proteger: circuitos funcionales para psicología; cerebro y
vago integrados en el mismo espacio; bilingüe real (búsqueda cruzada en los dos idiomas y en latín);
contenido con fuente y revisión docente. Si una función no refuerza alguno, no va.

Alcance y funciones (F1 a F24): SPEC.md. Producto y decisiones: docs/brief.md y docs/adr/.

## Stack
- Node.js 24 LTS (`engines` admite 22.18 o superior por el CI del harness), TypeScript 6.0.3 estricto (https://www.typescriptlang.org/docs/)
- Vite 8.3.4 + React 19.3.0 (https://vite.dev, https://react.dev)
- three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, three-mesh-bvh 0.8.3 (https://threejs.org/docs/, https://r3f.docs.pmnd.rs)
- zustand 5.0.15, react-router 8.4.0, i18next 26.4.3 + react-i18next 17.0.16, fuse.js 7.5.0, idb-keyval 6.3.0
- Vitest 5.0.3, Playwright 1.64.0 (https://vitest.dev, https://playwright.dev)
- Pipeline: Python 3.13 + bpy 5.2.2 (Blender sin ventana, https://docs.blender.org/api/current/), @gltf-transform/core, /extensions y /functions 4.5.1 con meshoptimizer 1.3.0
- Hosting: GitHub Pages, sin backend

## Conventions
- **La posición de cada pieza en el mundo nunca cambia.** Ni en el pipeline ni en el visor. El
  único cambio permitido es el giro global Z arriba a Y arriba del exportador glTF, igual para
  todas. Fragmentar es un `desplazamiento` en el estado (zustand) sumado a la posición original;
  reensamblar lo vuelve a cero. `npm run check:modelo` compara la caja de cada malla del GLB con
  `pipeline/cajas.json` (medida en Blender) y falla si alguna se corre más de 0,1 mm.
- **Geometría y contenido separados.** `public/modelos/*.glb` solo tiene mallas; todo texto vive
  en `src/data/*.json`. La llave entre ambos es el nombre de la malla tal como sale de
  `pipeline/mapeo.csv`. Corregir contenido nunca exige regenerar el GLB.
- **El GLB no se edita a mano.** Se regenera con `pipeline/` desde Z-Anatomy fijado por commit
  (ver docs/adr/). Al borrar objetos en Blender se conserva `matrix_world` de cada pieza; se
  aplican modificadores y las curvas se convierten a malla.
- **Nunca se inventa contenido anatómico.** Si no hay fuente o no hay certeza (nombre, recorrido
  de un ramo, posición de un marcador), el campo va `PENDIENTE`. Ningún dato llega a
  `src/data/` sin fuente escrita en el mismo registro. Los nombres en latín, inglés y español
  salen de Terminologia Anatomica 2 (`TA2.csv` de Z-Anatomy) cuando existen.
- **Solo un humano aprueba anatomía.** Cambios en `src/data/**`, `pipeline/mapeo.csv`,
  `pipeline/cajas.json` y `public/modelos/**` son tier C (ver Autonomy). Una revisión docente
  (F24) nunca se aplica sola: se convierte en un cambio propuesto que el editor aprueba.
- **Recursos externos solo como enlace.** No se copia texto de StatPearls, Kenhub ni ninguna
  otra fuente; las fichas se redactan propias y citan.
- **Cero textos en duro.** Todo texto visible pasa por i18next (`src/i18n/es.json`,
  `src/i18n/en.json`). Un test compara las claves de ambos archivos y falla si falta una.
- **Sin backend ni datos personales de usuarios.** Notas y progreso solo en IndexedDB. Nada de
  cookies de rastreo. Única excepción: los revisores docentes (F24) envían sus revisiones por
  un formulario de Google del editor, con consentimiento explícito para mostrar su nombre
  (Ley 1581 de 2012). La app no guarda nada de ellos en un servidor propio.
- **Licencias visibles.** Modelo y derivados CC BY-SA 4.0 con crédito a Z-Anatomy y
  BodyParts3D (DBCLS); código MIT. Aviso "Uso educativo, no clínico" en la primera visita y en
  el pie.
- **Nervios delgados:** cada nervio (hoy, los dos vagos) tiene una malla invisible más gruesa solo
  para el toque (`#toque`, generada por `pipeline/extraer.py`).
- **Medir antes de optimizar.** Nada de instancing, LOD ni simplificación sin una medición en
  los equipos de referencia (HP Iris Xe, iPhone 12 Pro Max, Android de gama baja) que lo pida.
  Presupuesto: `atlas.glb` 15 MB o menos, `atlas-liviano.glb` 5 MB o menos.
- **Cambio de alcance:** primero en SPEC.md, después en código.
- **Comandos para el portátil del editor** (Windows, PowerShell): listos para pegar, con rutas
  de Windows de ejemplo.
- Textos para humanos en español de Bogotá (tú, nunca vos). Nunca el guion largo.

## Verification
```bash
npm run typecheck
npm run lint
npm test
npm run check:i18n
npm run check:modelo
npm run build
```

## E2E
```bash
npm run test:e2e
```

## Run
```bash
npm run dev
```

## Setup
```bash
npm ci
```

## Autonomy
Sensitive paths: src/data/**, pipeline/mapeo.csv, pipeline/cajas.json, public/modelos/**, SPEC.md
Tier A paths: none
Paid services: none

How the harness decides (computed by `rb risk` from the real diff; the highest tier wins):

- **Tier A** (tests, docs, styles, copy, plus `Tier A paths`): planned, built, verified and
  merged without the human.
- **Tier B** (normal production code from an approved spec or an `rb:task` / `rb:bug` issue):
  also verified by a blind auditor, then merged without the human when CI is green.
- **Tier C** (architecture or design decisions, anything that can cost money, dependencies,
  data and schema, auth, permissions, payments, CI and deploy, harness files, secrets, large
  deletions, `Sensitive paths`): the harness stops on that item, labels the issue
  `rb:needs-human`, posts the question with options, a recommendation and a cost estimate, and
  moves on to other work. Tier C pull requests are merged by the human.

How to answer an escalation: reply on the issue (an answer, or "approved") and remove the
`rb:needs-human` label, or add the `rb:approved` label. The next run continues from there.
Approval covers the plan as posted; a revised plan asks again. Items labelled `rb:needs-local`
need your machine (for example a browser or local credentials) and include exact steps.

To stop all autonomous work, add the `rb:stop` label to any open issue (or to the
`Rockbuilt control` issue); remove it to resume. `Autonomy: supervised` in the header makes every
pull request wait for the human.

## Out of scope
Deferred scope with reasons: docs/v2.md.
- Cuentas de usuario, backend propio o datos personales de usuarios en servidor.
- Resto del cuerpo (fuera de vago y órganos de referencia), histología.
- Contenido clínico o diagnóstico.
- Geometría inventada: una estructura que no viene de una fuente abierta con licencia
  compatible se muestra como marcador, no como malla. Única excepción (ADR 0009): los laríngeos
  recurrentes y el vago izquierdo distal, trazados por anclajes del modelo con ruta revisada por
  un docente, prueba de asimetrías y acabado `aproximada` visible (SPEC F25).
