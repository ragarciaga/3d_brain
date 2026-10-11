# Atlas 3D de cerebro y nervio vago

Atlas 3D web, público, gratuito y bilingüe (español e inglés) del cerebro y el nervio vago, para
estudiantes de psicología y ciencias de la salud. Se desarma en piezas, cada pieza tiene ficha con
fuente, nivel de evidencia y revisor visible, y se vuelve a armar sin perder la posición exacta.

**Uso educativo. No es una herramienta clínica ni de diagnóstico.**

Estado: hito 1, piloto con docentes. Las fichas están en borrador hasta que las revisen docentes.

## Correrlo en local

```bash
npm ci
npm run dev
```

Abre http://localhost:3000. Requiere Node.js 22.18 o superior (recomendado 24 LTS).

## Qué trae

- Visor 3D con vistas anatómicas, árbol de estructuras, grupos de estudio y búsqueda bilingüe
  (español, inglés, latín y sinónimos, tolerante a tildes y errores).
- Ficha por estructura con fuentes, nivel de evidencia y estado de revisión por idioma.
- Fragmentar por hemisferios, lóbulos o piezas, separar, devolver y armar pieza por pieza.
- Enlaces por estructura e idioma (`/es/hipocampo`, `/en/hippocampus`) y "Compartir esta vista".
- Modo revisión docente por campo (`/es/revision?r=CODIGO`): ver docs/revision-docente.md.

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

- SPEC.md: alcance y funciones (F1 a F24).
- AGENTS.md: reglas del proyecto para agentes y personas.
- docs/brief.md y docs/adr/: decisiones.
- pipeline/README.md: cómo se genera el modelo desde Z-Anatomy.
- docs/research/fase-0/REPORT.md: qué trae y qué no trae el modelo.

## Créditos y licencias

- Modelo 3D: obra derivada de [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
  (CC BY-SA 4.0), construido sobre BodyParts3D, © The Database Center for Life Science (CC BY-SA
  2.1 Japón). Nombres: Terminologia Anatomica 2, incluida en Z-Anatomy.
- Modelo y contenido de este atlas: CC BY-SA 4.0 (LICENSE-CONTENT).
- Código: MIT (LICENSE).
