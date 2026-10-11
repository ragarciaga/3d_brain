# 0006. Vago como pieza por lado más marcadores; cómo se completa lo faltante

Status: accepted
Date: 2026-10-11
Related: docs/research/fase-0/REPORT.md, SPEC.md sección 8
Approved by: kickoff synthesis

## Context
El vago existe como una curva por lado, con sus ramos como trazos sin nombre (21 en el derecho, 7 en el izquierdo). No hay plexos ni ganglios. El izquierdo termina a la altura del final de la tráquea. Faltan también varias estructuras del cerebro (periacueductal, locus coeruleus, rafe, accumbens, área postrema, mamilares, núcleo anterior del tálamo). Nombrar un trazo sin certeza es inventar anatomía.

## Decision
En el hito 1 cada vago es una pieza por lado y todo lo que no tiene malla se muestra como marcador (`src/data/marcadores.json`), con estado "posición aproximada" hasta que un revisor lo valide con F24. Los trazos del vago se exportan seleccionables por separado solo en modo revisión; cuando un revisor identifica un trazo y el editor lo aprueba, el pipeline lo separa como pieza con nombre sin moverlo. Completar con otras fuentes (atlas SPL/NAC, BodyParts3D, SPARC) queda para la fase 2, cada fuente con su ADR de licencia.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Separar y nombrar los trazos ya, sin revisor | Sería inventar anatomía |
| Dibujar ramos y plexos a mano en Blender | Días de trabajo por plexo y riesgo anatómico alto para el piloto |
| Brainstem Navigator para núcleos del tronco | Su licencia prohíbe redistribuir |

## Consequences
- Positive: el piloto arranca sin inventar nada; los revisores completan el vago desde la app.
- Negative: el recorrido del vago (F14) hasta el estómago sigue el lado derecho; el izquierdo depende de marcadores.
- Revisit when: los revisores identifiquen los trazos, o se confirme una fuente abierta compatible.
