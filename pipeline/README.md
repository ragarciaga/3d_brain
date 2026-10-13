# Pipeline de la fase 0

Genera la geometría y los datos base del atlas desde Z-Anatomy, sin mover ninguna pieza
(docs/adr/0004-pipeline-geometria.md). Corre sin la interfaz de Blender.

Requisitos: Python 3.13 y Node.js 22.18 o superior. Blender se instala como módulo de Python:

```bash
python3.13 -m venv .venv-pipeline
.venv-pipeline/bin/pip install -r pipeline/requirements.txt
```

## Pasos

```bash
python pipeline/descargar.py          # Z-Anatomy (commit fijado) y TA2.csv en pipeline/.cache/, con SHA-256 verificado
python pipeline/listar.py             # inventario completo: pipeline/salida/estructuras.txt
python pipeline/mapear.py             # pipeline/mapeo.csv, src/data/arbol.json, siembra estructuras.json
python pipeline/extraer.py            # pipeline/salida/atlas-crudo.glb y pipeline/cajas.json
node scripts/comprimir-modelo.ts      # public/modelos/atlas.glb (meshopt, sin simplificar)
npm run check:modelo                  # 0,1 mm de tolerancia por pieza y presupuesto de 15 MB
```

Con `.venv-pipeline/bin/python` en lugar de `python` si usas el entorno de arriba.

## En Windows (PowerShell)

```powershell
cd C:\Users\TU_USUARIO\proyectos\3d_brain
py -3.13 -m venv .venv-pipeline
.\.venv-pipeline\Scripts\pip install -r pipeline\requirements.txt
.\.venv-pipeline\Scripts\python pipeline\descargar.py
.\.venv-pipeline\Scripts\python pipeline\listar.py
.\.venv-pipeline\Scripts\python pipeline\mapear.py
.\.venv-pipeline\Scripts\python pipeline\extraer.py
node scripts\comprimir-modelo.ts
npm run check:modelo
```

Alternativa con Blender instalado (sin pip), desde la carpeta del repositorio:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python pipeline\extraer.py
```

## Qué hace cada paso y por qué

- `mapear.py` toma el encéfalo completo (`Brain.g`), los dos vagos y los órganos de referencia, más la
  glándula pineal y los plexos coroideos, que Z-Anatomy cuelga de otros grupos (lista
  `EXTRAS_ESTUDIO` en `comun.py`, con el grupo que reciben en nuestro árbol).
  Nombres en latín y español desde TA2 por coincidencia exacta; lo que no coincide queda
  `PENDIENTE`. Nunca sobrescribe entradas existentes de `src/data/estructuras.json`.
- `extraer.py` evalúa cada pieza con sus modificadores, convierte curvas (nervios) a malla, hornea
  la matriz de mundo en los vértices y exporta. El vago sale trazo por trazo (`#tNN`) para la
  revisión docente, y cada nervio lleva una malla de toque invisible (`#toque`).
- `cajas.json` guarda la caja de cada malla medida en Blender; `check:modelo` la compara con el GLB
  en cada CI. Si alguien mueve una pieza, CI falla.

Los cambios a `mapeo.csv`, `cajas.json` y `public/modelos/` son de nivel C: los aprueba el editor.

## Vago: auditoría, rutas trazadas y asimetrías (ADR 0009)

El modelo trae el vago como 28 trazos sin nombre y no trae el laríngeo recurrente ni el vago izquierdo
por debajo del tórax. Se nombra primero lo que existe y solo se trazan tres piezas, con estas reglas:
la ruta se escribe en texto por anclajes, la revisa un docente antes de generar nada y una prueba
comprueba las cuatro asimetrías del vago en cada CI.

```bash
python pipeline/auditar-vago.py                 # Blender: mide anclajes y trazos -> pipeline/anclajes-vago.json
                                                #          y pipeline/salida/auditoria-vago.md (nombre propuesto por trazo)
python pipeline/generar-ramas-vago.py --borrador  # sin Blender: rutas de rutas-vago.yaml -> pipeline/salida/rutas-vago-borrador.json
python pipeline/generar-ramas-vago.py           # solo con revision_docente.estado: aprobada -> pipeline/rutas-vago-puntos.json
npm test                                        # tests/asimetrias.test.ts: las cuatro asimetrías sobre lo medido y lo trazado
```

- `rutas-vago.yaml` es lo que revisa el docente: nombres anatómicos, comentarios y ninguna coordenada.
- `generar-ramas-vago.py` no usa Blender; se prueba con un modelo sintético:
  `python pipeline/pruebas/probar_generar.py` y `python pipeline/pruebas/vago_sintetico.py` (este
  último regenera `tests/fixtures/vago-sintetico/`, que usan las pruebas de asimetrías).
- Falta un paso, que necesita Blender y se hace al aprobar las rutas: que `mapear.py` y `extraer.py`
  conviertan `rutas-vago-puntos.json` en tubos con nombre propio, marcados `"origen": "aproximada"`
  en `src/data/arbol.json`. La app ya los dibuja punteados, con aviso, leyenda y filtro (SPEC F25).

En Windows (PowerShell), desde la carpeta del repositorio:

```powershell
.\.venv-pipeline\Scripts\python pipeline\auditar-vago.py
.\.venv-pipeline\Scripts\python pipeline\generar-ramas-vago.py --borrador
```
