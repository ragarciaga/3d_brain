# 0011. Relleno del corte con caras traseras y contorno con BVH

Status: accepted
Date: 2026-10-13
Related: docs/specs/01-cutting-planes/design.md, SPEC.md F8 y sección 10, issue #9
Approved by: el editor, con design.md el 2026-10-13

## Context
F8 rellena la cara del corte con el color de cada pieza para que el cerebro no se vea hueco. SPEC.md (sección 10) proponía el relleno por stencil buffer. Medido sobre `public/modelos/atlas.glb` el 13 de octubre de 2026 (vértices soldados por posición):

- Hay 191 mallas cerradas en el encéfalo (510.094 triángulos) y 62 abiertas (185.398), entre ellas giros corticales, el acueducto, la comisura anterior y la base del pedúnculo.
- El stencil necesita, por cada malla cerrada y por cada plano, dos pasadas de stencil y una tapa: estimado unas 360 dibujos extra con 3 planos, solo contando las piezas que cada plano cruza. Además exige `stencil: true` en el contexto WebGL, que hoy no lo pide.
- En una malla abierta el stencil se filtra por los bordes.

## Decision
Rellenaremos la cara del corte de las mallas cerradas dibujando sus caras traseras en el color plano de la pieza (una malla hermana con la misma geometría, `side: BackSide`, sin luz, recortada por los mismos planos). Las mallas abiertas llevarán un contorno con los segmentos de intersección plano-malla, calculados con el BVH (three-mesh-bvh) que el visor ya construye para el toque. Si el relleno se apaga por rendimiento o porque no compila, el contorno cubre todas las piezas cortadas.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Stencil buffer (decisión 2 del brainstorm) | Unas 3,6 veces más dibujos y un cambio del contexto WebGL; se filtra en las mallas abiertas igual |
| Tapas geométricas exactas (triangular cada sección en cada movimiento) | Demasiado cálculo por cuadro con 191 piezas; falla con mallas abiertas |
| Solo contorno, sin relleno | El corte se lee como cáscara hueca; el editor eligió relleno en las cerradas (decisión 2) |

## Consequences
- Positive:
  - Un dibujo extra por pieza cortada.
  - Sin cambio del contexto WebGL.
  - La cara del corte se puede tocar: el rayo que entra por el corte pega en la cara trasera, que es visible.
- Negative:
  - El color no está exactamente en el plano sino en la pared del fondo; sin luz se ve igual.
  - Una pieza anidada dentro de otra (por ejemplo, el plexo coroideo en el ventrículo) aparece dentro del relleno, como en un corte real.
  - La lista de mallas cerradas se genera del GLB y debe regenerarse si el GLB cambia (lo vigila `check:modelo`).
- Revisit when:
  - las capturas del prototipo (#9) muestren artefactos que confundan;
  - o el relleno no alcance 30 cuadros por segundo en los equipos de referencia y el contorno solo no baste.
