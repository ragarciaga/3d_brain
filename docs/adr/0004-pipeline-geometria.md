# 0004. Pipeline de geometría con fuente fijada e invariante de posición

Status: accepted
Date: 2026-10-11
Related: docs/research/fase-0/REPORT.md, SPEC.md sección 9
Approved by: kickoff synthesis

## Context
La fase 0 mostró que los nervios son curvas, que 100 objetos del sistema nervioso dependen de modificadores y que todas las piezas cuelgan de grupos padre. Borrar padres o exportar sin aplicar modificadores desplaza o deforma piezas sin que nadie lo note. Que todo encaje depende de no mover nada.

## Decision
La fuente será `Startup.blend` de `Z-Anatomy.zip` en el commit `9de5d6912a1b0df9cab739d57f00e036b0496ddc` de `Z-Anatomy/Models-of-human-anatomy`. El pipeline (`pipeline/`, Python 3.13 con bpy 5.2.2, sin ventana) lista todos los objetos con su tipo, mapea nombres con `TA2.csv`, mide cajas envolventes en el mundo (`pipeline/cajas.json`), conserva `matrix_world` al borrar padres, convierte curvas a malla, aplica modificadores y exporta `atlas.glb`. `npm run check:modelo` corre en cada CI y falla si una pieza falta o se corre más de 0,1 mm (descontando el giro global de Z arriba a Y arriba). El pipeline corre a pedido, no en CI; el GLB resultante se versiona.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Versión de Google Drive | No se descarga de forma reproducible por URL |
| Correr Blender en cada CI | Descarga de 87 MB más 400 MB de bpy por corrida, sin necesidad |
| Confiar en la regla sin verificarla | El fallo es silencioso; la fase 0 mostró dos formas de romperla sin querer |

## Consequences
- Positive: reproducible, la regla de posición se cumple por máquina, corre en la nube o en el portátil.
- Negative: cada regeneración agrega el GLB al historial de git (vigilar el tamaño del repositorio).
- Revisit when: el repositorio pase de 500 MB o Z-Anatomy publique una versión con ramos del vago.
