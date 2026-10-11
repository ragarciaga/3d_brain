# 0002. Sin IA en el producto: flujo fijo

Status: accepted
Date: 2026-10-11
Related: docs/brief.md
Approved by: kickoff synthesis

## Context
Revisado paso a paso: cargar el modelo, seleccionar, fragmentar, buscar, mostrar fichas y recibir revisiones. La búsqueda tolerante a errores la resuelve fuse.js; el contenido lo redactan y revisan personas. Ningún paso interpreta entradas no estructuradas en tiempo de uso.

## Decision
El producto no usa modelos de IA. La arquitectura es un flujo fijo: pipeline offline que produce la geometría y una SPA que la muestra. Claude Code puede ayudar a redactar borradores de fichas, pero eso ocurre en el repositorio y pasa por revisión docente y aprobación del editor; nunca en la app.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Asistente conversacional en la app | Riesgo de afirmaciones anatómicas sin fuente; contradice la regla de contenido revisado; cuesta dinero |
| Búsqueda semántica con embeddings | fuse.js más sinónimos curados cubre el criterio de F3 sin costo |

## Consequences
- Positive: costo de operación cero, comportamiento predecible, sin evals.
- Negative: la búsqueda depende de sinónimos curados.
- Revisit when: los datos del piloto muestren búsquedas frecuentes que fuse.js no resuelve.
