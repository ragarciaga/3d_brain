# 0007. Licencias: código MIT, modelo y contenido CC BY-SA 4.0

Status: accepted
Date: 2026-10-11
Related: SPEC.md sección 13
Approved by: kickoff synthesis

## Context
El modelo deriva de Z-Anatomy (CC BY-SA 4.0), que deriva de BodyParts3D (CC BY-SA 2.1 Japón, adaptable a versiones posteriores). ShareAlike obliga a que los derivados del modelo mantengan la licencia. Las fichas citan fuentes con licencias restrictivas (Kenhub con derechos reservados, StatPearls CC BY-NC-ND 4.0).

## Decision
El código se publica bajo MIT (`LICENSE`); el modelo, sus derivados y el contenido (fichas, circuitos, casos, marcadores) bajo CC BY-SA 4.0 (`LICENSE-CONTENT`), con crédito a Z-Anatomy y a BodyParts3D (DBCLS) en la pantalla "Fuentes y licencia". El contenido se redacta propio y cita; nunca se copia texto de terceros. Geometría de otras fuentes entra solo con un ADR que confirme compatibilidad.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Contenido CC BY 4.0 | Menos coherente con el modelo; permite cerrar derivados del contenido |
| Todo bajo CC BY-SA, incluido el código | CC no es adecuada para software |

## Consequences
- Positive: coherencia legal con la fuente y apertura a contribuciones.
- Negative: quien reutilice el contenido debe compartir bajo la misma licencia.
- Revisit when: entre geometría de una fuente con otra licencia.
