# Maysa Brain: atlas 3D del cerebro y el nervio vago

Atlas 3D web, público, gratuito y bilingüe (español e inglés) del cerebro y el nervio vago, para
estudiantes de psicología y ciencias de la salud. Se desarma en piezas, cada pieza tiene ficha con
fuente, nivel de evidencia y revisor visible, y se vuelve a armar sin perder la posición exacta.

**Uso educativo. No es una herramienta clínica ni de diagnóstico.**

Estado: hito 1, piloto con docentes. Las 236 fichas están escritas con fuentes verificadas y
siguen en borrador hasta que las revisen docentes.

**Sitio:** https://ragarciaga.github.io/3d_brain/ · **Todos los enlaces del proyecto:**
[docs/enlaces.md](docs/enlaces.md)

## Correrlo en local

```bash
npm ci
npm run dev
```

Abre http://localhost:3000. Requiere Node.js 22.18 o superior (recomendado 24 LTS).

## Qué trae

- Modo estudio: el cerebro a pantalla completa; un riel abre el árbol, los grupos de estudio y la
  búsqueda (Ctrl+K) solo cuando se piden.
- Búsqueda bilingüe (español, inglés, latín y sinónimos, tolerante a tildes y errores).
- Ficha por estructura a la izquierda: qué es, función, ubicación, relaciones, relevancia en
  psicología con nivel de evidencia, recursos, búsquedas de artículos científicos y fuentes.
- Fragmentar por hemisferios, lóbulos o piezas con el deslizador vertical (separado e inventario),
  separar y devolver piezas, y vistas con una brújula anatómica.
- Tema claro u oscuro y logo propio (`public/marca/`).
- Enlaces por estructura e idioma (`/es/hipocampo`, `/en/hippocampus`) y "Compartir esta vista".
- Modo revisión docente por campo (`/es/revision?r=CODIGO`): ver docs/revision-docente.md.
- Medición de carga para los equipos de referencia (`?medir=1`): ver docs/operacion.md.

## Verificación

```bash
npm run typecheck
npm run lint
npm test
npm run check:i18n
npm run check:modelo
npm run build
npm run test:e2e
```

## Documentos

- docs/enlaces.md: **todos los enlaces del proyecto** (sitio, formularios, logos, GitHub).
- SPEC.md: alcance y funciones (F1 a F24).
- AGENTS.md: reglas del proyecto para agentes y personas.
- docs/brief.md y docs/adr/: decisiones.
- pipeline/README.md: cómo se genera el modelo desde Z-Anatomy.
- docs/research/fase-0/REPORT.md: qué trae y qué no trae el modelo.
- docs/operacion.md: guía del editor (publicar, revisar, regenerar, trabajar con el harness).
- docs/revision-docente.md: revisión docente, guía del editor (formularios, códigos, importación).
- docs/guia-docentes.md: mensaje para cada docente revisor (la guía está dentro de la web).
- docs/fichas-dudas.md: registro de las dudas abiertas; los docentes las ven en cada ficha.
- docs/progress.md: estado actual y siguiente paso.

## Créditos y licencias

- Modelo 3D: obra derivada de [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
  (CC BY-SA 4.0), construido sobre BodyParts3D, © The Database Center for Life Science (CC BY-SA
  2.1 Japón). Nombres: Terminologia Anatomica 2, incluida en Z-Anatomy.
- Modelo y contenido de este atlas: CC BY-SA 4.0 (LICENSE-CONTENT).
- Código: MIT (LICENSE).
