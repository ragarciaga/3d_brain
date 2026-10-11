# 0003. Geometría y contenido separados, sin backend

Status: accepted
Date: 2026-10-11
Related: SPEC.md secciones 6 y 13
Approved by: kickoff synthesis

## Context
Corregir una ficha no debe exigir volver a Blender. El proyecto no debe almacenar datos personales de usuarios (Ley 1581 de 2012). El contenido cambia mucho más que la geometría.

## Decision
La geometría vive en `public/modelos/*.glb`; el contenido en `src/data/*.json`, versionado en el repositorio; la llave es el nombre de la malla. No habrá backend ni cuentas: notas, progreso y revisiones en curso se guardan en IndexedDB del navegador. `src/data/**` es ruta sensible: todo cambio lo aprueba el editor.

## Alternatives considered
| Option | Why rejected |
|---|---|
| CMS o base de datos alojada | Agrega backend, costo y datos personales; el volumen (unas 200 fichas) cabe en JSON |
| Contenido dentro del GLB (extras) | Ata cada corrección de texto a regenerar la geometría |

## Consequences
- Positive: historial de cambios del contenido en git, despliegue estático, cero datos de usuarios.
- Negative: los datos locales se pierden si el usuario borra el navegador (mitigado con exportar e importar en F13).
- Revisit when: se pidan cuentas o sincronización entre dispositivos (requiere asesoría legal).
