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
python pipeline/auditar-vago.py       # pipeline/anclajes-vago.json (ver "Vago", más abajo)
python pipeline/generar-ramas-vago.py # public/modelos/rutas-vago.json, con las bandas que extraer.py corta
python pipeline/extraer.py            # pipeline/salida/atlas-crudo.glb y pipeline/cajas.json
node scripts/comprimir-modelo.ts      # public/modelos/atlas.glb (meshopt, sin simplificar)
node scripts/mallas-cerradas.ts       # src/config/mallas-cerradas.json (mallas del encéfalo sin bordes abiertos, F8)
npm run check:modelo                  # 0,1 mm por pieza, lista de mallas cerradas, bandas del vago y 15 MB
```

Con `.venv-pipeline/bin/python` en lugar de `python` si usas el entorno de arriba.

`extraer.py` se detiene, antes de abrir el .blend y sin exportar nada, si falta
`public/modelos/rutas-vago.json` o la banda `reemplaza` de algún lado del vago (ADR 0010). Por eso
`auditar-vago.py` y `generar-ramas-vago.py` van antes.

## En Windows (PowerShell)

```powershell
cd C:\Users\TU_USUARIO\proyectos\3d_brain
py -3.13 -m venv .venv-pipeline
.\.venv-pipeline\Scripts\pip install -r pipeline\requirements.txt
.\.venv-pipeline\Scripts\python pipeline\descargar.py
.\.venv-pipeline\Scripts\python pipeline\listar.py
.\.venv-pipeline\Scripts\python pipeline\mapear.py
.\.venv-pipeline\Scripts\python pipeline\auditar-vago.py
.\.venv-pipeline\Scripts\python pipeline\generar-ramas-vago.py
.\.venv-pipeline\Scripts\python pipeline\extraer.py
node scripts\comprimir-modelo.ts
node scripts\mallas-cerradas.ts
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
  revisión docente, y cada nervio lleva una malla de toque invisible (`#toque`). Del tronco de cada
  vago (`#t02`) y de su `#toque` corta el tramo que reemplaza la ruta torácica, con las bandas de
  `public/modelos/rutas-vago.json`: parte las aristas que cruzan cada borde y borra lo de dentro, sin
  mover ningún vértice que queda ni cerrar los extremos.
- `cajas.json` guarda la caja de cada malla medida en Blender; `check:modelo` la compara con el GLB
  en cada CI. Si alguien mueve una pieza, CI falla. `check:modelo` también lee los vértices del tronco
  del vago y falla, nombrando la malla y la altura, si alguno cae dentro de la banda de su lado.
- `mallas-cerradas.ts` mide en el GLB qué mallas del encéfalo no tienen bordes abiertos (ADR 0011) y
  escribe `src/config/mallas-cerradas.json`, que `check:modelo` también verifica. Si regeneras el GLB
  y no regeneras la lista, `check:modelo` y CI fallan con "Falta en mallas-cerradas.json" o
  "Sobra en mallas-cerradas.json".

Los cambios a `mapeo.csv`, `cajas.json` y `public/modelos/` son de nivel C: los aprueba el editor.

## Vago: auditoría, rutas trazadas y asimetrías (ADR 0009 y 0010)

El modelo trae el vago como 28 trazos sin nombre y no trae el laríngeo recurrente ni el vago izquierdo
por debajo del tórax. Además, la auditoría (`docs/research/vago/auditoria-vago.md`) encontró que el
tramo torácico es un espejo izquierda-derecha que atraviesa la aorta y el bronquio derecho (ADR 0010).
Se nombra primero lo que existe y se trazan solo los recurrentes, el vago izquierdo distal y el tramo
torácico de los dos lados (el escaneado de ese tramo no se publica), con estas reglas:
la ruta se escribe en texto por anclajes, la app la dibuja con su estado de revisión, un docente la
juzga en la ficha (F24) y una prueba comprueba las cuatro asimetrías del vago en cada CI. Antes del
lanzamiento público, toda ruta que siga en revisión se aprueba o se retira.

```bash
python pipeline/auditar-vago.py                 # Blender: mide anclajes y trazos -> pipeline/anclajes-vago.json,
                                                #          pipeline/salida/trazos-medidos.json (regla, ramo propuesto y confianza por trazo)
                                                #          y pipeline/salida/auditoria-vago.md (la tabla para revisar)
python pipeline/generar-ramas-vago.py --borrador  # sin Blender: rutas de rutas-vago.yaml -> pipeline/salida/rutas-vago-borrador.json
python pipeline/generar-ramas-vago.py           # -> public/modelos/rutas-vago.json (cada ruta con su estado de revisión)
npm test                                        # tests/asimetrias.test.ts: las cuatro asimetrías sobre lo medido y lo trazado
```

- `rutas-vago.yaml` es el registro de cada ruta: anclajes, comentarios, ficha y estado de revisión.
  El docente no lo lee: revisa la ruta dibujada en la app. Al aplicar una aprobación, el editor
  cambia `revision.estado` a `aprobada` y se vuelve a generar.
- `generar-ramas-vago.py` no usa Blender; se prueba con un modelo sintético:
  `python pipeline/pruebas/probar_generar.py` y `python pipeline/pruebas/vago_sintetico.py` (este
  último regenera `tests/fixtures/vago-sintetico/`, que usan las pruebas de asimetrías).
- Las reglas de la auditoría (raicilla detrás de la oliva, faríngeo frente a laríngeo superior, ramos
  abdominales según su destino, tronco) están en `reglas_vago.py`, que no usa Blender y cita
  `docs/research/marcadores/fuentes.md`. `auditar-vago.py` solo lee el modelo y se las pasa. Cada umbral es
  una constante con nombre, y lo que no sale de una cifra de la fuente está marcado "(derivado)". Cada
  trazo sale con `regla`, `propuesta`, `confianza` (`alta`, `media` o `baja`, o `null` sin regla) y `fuente`;
  lo lee `scripts/aplicar-trazos.ts` (spec 04, T6), que además lee `public/modelos/rutas-vago.json` (`--rutas`)
  para agregar a la evidencia de `l#t02` y `r#t02` qué parte del trazo se publica (ADR 0010). Se prueban con el mismo vago sintético:
  `python pipeline/pruebas/probar_auditar.py`.
- `extraer.py` corta el tronco con las bandas de `rutas-vago.json`; se prueba en Blender con
  `python pipeline/pruebas/probar_recorte.py` (curva sintética, troncos reales y los casos en que
  `extraer.py` se detiene). Necesita bpy y el .blend de `descargar.py`; no corre en el CI.
- La app dibuja las rutas como tubos punteados en tiempo de ejecución (no van al GLB), con aviso,
  leyenda y filtro (SPEC F25). Lo que sí toca el GLB es el recorte del tramo torácico escaneado
  (ADR 0010), con el pipeline y `check:modelo`.
- `pipeline/anclajes-vago.json` ya está en el repositorio, generado por `auditar-vago.py` desde el
  commit fijado de Z-Anatomy (idéntico byte a byte en dos corridas). Con el tronco recortado y las
  cinco rutas publicadas, las cuatro asimetrías pasan en `npm test`; sobre el escaneado solo, la 4 falla
  (el espejo).

En Windows (PowerShell), desde la carpeta del repositorio:

```powershell
.\.venv-pipeline\Scripts\python pipeline\auditar-vago.py
.\.venv-pipeline\Scripts\python pipeline\generar-ramas-vago.py --borrador
.\.venv-pipeline\Scripts\python pipeline\pruebas\probar_auditar.py
.\.venv-pipeline\Scripts\python pipeline\pruebas\probar_recorte.py
```

## Marcadores: posiciones propuestas por regla (spec 04, ADR 0013)

`ubicar-marcadores.py` pone cada marcador del atlas con una regla anatómica de `reglas-marcadores.yaml`
(una por marcador, sin coordenadas escritas a mano), y no con una coordenada tomada a ojo. Lee las mallas
con nombre del modelo en caché (el mismo `.blend` de `descargar.py`) y la bibliografía de
`docs/research/marcadores/fuentes.md`. Cada regla nombra sus fuentes por clave: si una clave no está en la
sección "Referencias" de `fuentes.md`, el marcador queda `sin_ubicar` con el motivo. Si falta una malla, o un
punto queda a más de 5 mm de las mallas de su regla, el script se detiene y no escribe nada. Lo que es
deducción propia (milímetros, fracciones, puntos medios, caras) va marcado "(derivado)" en el `metodo` de la
regla, y lo aprueba el editor en el PR de datos.

Mide contra lo que el atlas publica del vago (ADR 0010, actualización del ADR 0013 del 2026-10-17): lee
`public/modelos/rutas-vago.json` (`--rutas`), quita de `Vagus nerve (X).l` y `.r` los vértices de la banda
`reemplaza` de su lado y ofrece cada ruta trazada como la malla `ruta:<id>`, que una regla puede usar como
`curva` o dentro de `cerca_de.malla`. Un `en_curva` sobre el vago escaneado cuyo punto caiga dentro de la banda
detiene la corrida. Si falta el archivo o la banda de un lado, se detiene con un mensaje de una línea. Por eso
`generar-ramas-vago.py` va antes. El orden de las corridas que mueven datos del vago:

```bash
python pipeline/auditar-vago.py                             # Blender: anclajes y trazos medidos
python pipeline/generar-ramas-vago.py                       # public/modelos/rutas-vago.json (las bandas y las rutas)
node scripts/aplicar-trazos.ts                              # mediciones + rutas -> src/data/trazos-vago.json
python pipeline/ubicar-marcadores.py                        # Blender + rutas -> pipeline/salida/marcadores-propuestos.json
node scripts/aplicar-marcadores.ts                          # propuestas -> src/data/marcadores.json
```

```bash
python pipeline/ubicar-marcadores.py                        # Blender: -> pipeline/salida/marcadores-propuestos.json
python pipeline/ubicar-marcadores.py --salida otra/ruta.json
python pipeline/ubicar-marcadores.py --rutas otra/rutas-vago.json
python pipeline/pruebas/probar_ubicar.py                    # sin Blender: geometría y ubicador sobre un modelo sintético
python pipeline/pruebas/probar_reglas.py                    # sin Blender: el YAML real contra fuentes, árbol e inventario
node scripts/aplicar-marcadores.ts                          # propuestas -> src/data/marcadores.json y el resumen
```

- La salida (`pipeline/salida/`, ignorada por git) es una lista ordenada por `id`: `posicion` (un punto, o
  `{ l, r }` si la estructura es par, o `null`), `estado` (`aproximada` o `sin_ubicar`), `metodo` y `cita`
  en es y en, y, solo si aplican, `ancla`, `motivo` y `desacuerdo`. Nunca dice `validada`: eso lo decide un
  docente. Llevarla a `src/data/marcadores.json` es otro paso: `node scripts/aplicar-marcadores.ts` (spec 04,
  T3) la lee, y con `--propuestas`, `--marcadores` y `--resumen` se cambian las rutas de entrada y de salida.
  Solo cambian `posicion`, `estado` (siempre `aproximada`), `fuente_ubicacion` (método, cita y, si lo hay,
  el desacuerdo de fuentes, en es y en) y `ancla` si la propuesta la trae. Un marcador `validada` no se toca,
  y una propuesta sin posición no le quita nada a un marcador. Si algo no valida, no escribe ningún archivo.
  Escribe también `docs/research/marcadores/resumen-propuestas.md`, con antes, después, regla y fuente por marcador.
- Dos corridas sobre el mismo modelo dan el mismo archivo, byte a byte (5 decimales, claves ordenadas).
- `geometria.py` reúne las funciones puras (solo biblioteca estándar) que también usan las reglas del vago (`reglas_vago.py`).
- `bpy` se importa solo dentro de `leer_modelo_blender`, así que las pruebas y la validación corren sin Blender.
- El CI no corre Python: estas pruebas se corren a mano.

En Windows (PowerShell), desde la carpeta del repositorio:

```powershell
.\.venv-pipeline\Scripts\python pipeline\ubicar-marcadores.py
.\.venv-pipeline\Scripts\python pipeline\pruebas\probar_ubicar.py
.\.venv-pipeline\Scripts\python pipeline\pruebas\probar_reglas.py
node scripts\aplicar-marcadores.ts
```
