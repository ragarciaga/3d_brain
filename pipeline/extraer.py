"""Extrae las piezas de mapeo.csv y exporta pipeline/salida/atlas-crudo.glb y pipeline/cajas.json.

Invariante (AGENTS.md): la posición de cada pieza en el mundo nunca cambia.
- Cada pieza se evalúa con sus modificadores aplicados (subdivisión, espejo, skin, solidify) y las
  curvas se convierten a malla. Sin esto, el núcleo del tracto solitario son 5 puntos.
- La matriz de mundo de cada objeto se hornea en sus vértices (matrix_world). La pieza queda con
  transformación identidad y sin padre, en exactamente el mismo lugar. Así borrar los grupos padre
  no desplaza nada.
- El único cambio global es el giro Z arriba (Blender) a Y arriba (glTF) del exportador.
- La caja envolvente de cada malla, en coordenadas de mundo de Blender, se guarda en cajas.json
  para que `npm run check:modelo` verifique el GLB final.

Mallas derivadas:
- Vago: cada trazo (spline) sale como malla propia `<objeto>#tNN`, para que en modo revisión (F24)
  un docente identifique el ramo. En modo normal la app los trata como una sola pieza.
- Nervios (curvas de estudio): malla de toque `<malla>#toque`, un tubo de 3 mm de radio, invisible
  en la app, para poder seleccionarlos en el celular.
- Corte del tronco del vago (ADR 0010): del trazo más largo de cada lado (`#t02`) y de su `#toque`
  se borra el tramo que reemplaza la ruta torácica, con las bandas `reemplaza` de
  public/modelos/rutas-vago.json (las escribe generar-ramas-vago.py, que necesita auditar-vago.py).
  Dos planos horizontales parten las aristas que cruzan cada borde; después se borran los vértices
  de dentro. Ningún vértice conservado se mueve y los extremos quedan abiertos, sin tapa. Sin ese
  archivo, o sin la banda de algún lado, se detiene antes de abrir el .blend y de exportar nada."""
import json
import math

import bpy
import bmesh  # después de bpy: con Blender como módulo de Python, bmesh solo se encuentra tras importar bpy

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import RAIZ, abrir_blend, asegurar_carpeta, leer_mapeo

RADIO_TOQUE = 0.003
RUTAS_PUBLICADAS = RAIZ.parent / "public" / "modelos" / "rutas-vago.json"  # igual que PUBLICADO en generar-ramas-vago.py
# Tronco escaneado de cada lado: el trazo más largo (docs/research/vago/auditoria-vago.md). Es el mismo
# nombre que TRONCO_VAGO en scripts/lib/modelo.ts, que check:modelo vigila.
TRONCO = {"Vagus nerve (X).r#t02": "derecho", "Vagus nerve (X).l#t02": "izquierdo"}
EPS_PLANO = 1e-6  # un vértice a menos de 1 µm de un plano de corte es del borde, no de la banda


def malla_horneada(obj, dg, nombre):
    """Copia evaluada del objeto con matrix_world aplicada a los vértices."""
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
    me.transform(obj.matrix_world)
    if obj.matrix_world.determinant() < 0:
        me.flip_normals()
    me.name = nombre
    return me


def copia_temporal(obj, coleccion):
    tmp = obj.copy()
    tmp.data = obj.data.copy()
    coleccion.objects.link(tmp)
    tmp.parent = None
    tmp.matrix_world = obj.matrix_world.copy()
    return tmp


def caja(me):
    """Caja de los vértices que forman caras. Los vértices y aristas sueltos (hay en el hipotálamo
    y la estría terminal de Z-Anatomy, uno a la altura del tórax) no se ven ni los exporta glTF."""
    usados = {i for p in me.polygons for i in p.vertices}
    vs = [me.vertices[i].co for i in usados]
    xs = [v.x for v in vs]
    ys = [v.y for v in vs]
    zs = [v.z for v in vs]
    return [round(min(xs), 6), round(min(ys), 6), round(min(zs), 6),
            round(max(xs), 6), round(max(ys), 6), round(max(zs), 6)]


def _numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def leer_bandas(ruta=RUTAS_PUBLICADAS):
    """Bandas `reemplaza` de las rutas publicadas: lado -> (y_max, y_min o None), en metros glTF.
    Y glTF es Z de Blender (a_gltf en auditar-vago.py). Se detiene si falta el archivo o la banda de un lado."""
    ruta = Path(ruta)
    if not ruta.exists():
        raise SystemExit(f"No existe {ruta}: sin las bandas del vago no se sabe qué tramo del tronco cortar. "
                         "Corre antes pipeline/auditar-vago.py y pipeline/generar-ramas-vago.py")
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError as e:
        raise SystemExit(f"{ruta} no es JSON válido: {e}")
    rutas = datos.get("rutas") if isinstance(datos, dict) else None
    if not isinstance(rutas, dict):
        raise SystemExit(f"{ruta} no trae el objeto 'rutas'")
    bandas = {}
    for id_ruta, r in rutas.items():
        rem = r.get("reemplaza") if isinstance(r, dict) else None
        if rem is None:
            continue
        lado = rem.get("lado") if isinstance(rem, dict) else None
        if lado not in ("derecho", "izquierdo"):
            raise SystemExit(f"{ruta}: la ruta {id_ruta} trae un lado inválido en 'reemplaza': {lado!r}")
        if lado in bandas:
            raise SystemExit(f"{ruta}: hay dos bandas del vago {lado}")
        y_max, y_min = rem.get("y_max"), rem.get("y_min")
        if not _numero(y_max):
            raise SystemExit(f"{ruta}: la banda del vago {lado} trae un y_max inválido: {y_max!r}")
        if y_min is not None and not (_numero(y_min) and y_min < y_max):
            raise SystemExit(f"{ruta}: la banda del vago {lado} trae un y_min inválido (debe ser nulo o menor que y_max): {y_min!r}")
        bandas[lado] = (float(y_max), None if y_min is None else float(y_min))
    for lado in ("derecho", "izquierdo"):
        if lado not in bandas:
            raise SystemExit(f"{ruta}: falta la banda del vago {lado} ('reemplaza' de la ruta torácica). "
                             "Corre pipeline/generar-ramas-vago.py")
    return bandas


def cortar_banda(me, y_max, y_min):
    """Quita de la malla (ya horneada, coordenadas de mundo de Blender) el tramo entre y_max y y_min
    (y_min None = hasta el final). Parte las aristas que cruzan cada borde y borra los vértices de dentro.
    No mueve ningún vértice existente y no cierra los extremos. Devuelve cuántos vértices borró."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bordes = [y_max] if y_min is None else [y_max, y_min]
    for z in bordes:
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0.0, 0.0, z), plane_no=(0.0, 0.0, 1.0),
                               use_snap_center=False, clear_inner=False, clear_outer=False)
    dentro = [v for v in bm.verts
              if v.co.z < y_max - EPS_PLANO and (y_min is None or v.co.z > y_min + EPS_PLANO)]
    bmesh.ops.delete(bm, geom=dentro, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(dentro)


def mallas_de_trazo(obj, i, tmp_col):
    """Trazo `i` del vago como (nombre, malla, malla de toque), horneadas en coordenadas de mundo."""
    tmp = copia_temporal(obj, tmp_col)
    for j in reversed(range(len(tmp.data.splines))):
        if j != i:
            tmp.data.splines.remove(tmp.data.splines[j])
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    nombre = f"{obj.name}#t{i:02d}"
    me = malla_horneada(tmp, dg, nombre)
    tmp.data.bevel_depth = RADIO_TOQUE
    tmp.data.bevel_resolution = 1
    dg.update()
    return nombre, me, malla_horneada(tmp, dg, nombre + "#toque")


def main(ruta_rutas=RUTAS_PUBLICADAS, destino_cajas=RAIZ / "cajas.json", salida=RAIZ / "salida"):
    bandas = leer_bandas(ruta_rutas)  # antes de abrir el .blend: sin bandas no se exporta nada
    abrir_blend(bpy)
    filas = leer_mapeo()
    escena = bpy.context.scene
    tmp_col = bpy.data.collections.new("_tmp")
    escena.collection.children.link(tmp_col)

    mallas = []  # (nombre, mesh)
    cortados = set()
    for fila in filas:
        obj = bpy.data.objects[fila["nombre_malla"]]
        estudio_curva = obj.type == "CURVE" and fila["tipo"] == "estudio"
        es_vago = fila["nombre_malla"].startswith("Vagus nerve (X)")
        if es_vago:
            for i in range(len(obj.data.splines)):
                nombre, me, me_toque = mallas_de_trazo(obj, i, tmp_col)
                if nombre in TRONCO:
                    y_max, y_min = bandas[TRONCO[nombre]]
                    for malla in (me, me_toque):
                        if cortar_banda(malla, y_max, y_min) == 0:
                            raise SystemExit(f"La banda del vago {TRONCO[nombre]} no corta {malla.name}: "
                                             "revisa que el trazo #t02 siga siendo el tronco")
                    cortados.add(nombre)
                mallas.append((nombre, me))
                mallas.append((nombre + "#toque", me_toque))
        else:
            dg = bpy.context.evaluated_depsgraph_get()
            mallas.append((obj.name, malla_horneada(obj, dg, obj.name)))
            if estudio_curva:
                tmp = copia_temporal(obj, tmp_col)
                tmp.data.bevel_depth = RADIO_TOQUE
                tmp.data.bevel_resolution = 1
                dg.update()
                mallas.append((obj.name + "#toque", malla_horneada(tmp, dg, obj.name + "#toque")))

    if cortados != set(TRONCO):
        raise SystemExit(f"No se cortó el tronco del vago: faltan {sorted(set(TRONCO) - cortados)} en mapeo.csv o en el modelo")
    vacias = [n for n, me in mallas if len(me.vertices) == 0]
    repetidas = {n for n, _ in mallas if sum(1 for m, _ in mallas if m == n) > 1}
    if repetidas:
        raise SystemExit(f"Nombres repetidos: {sorted(repetidas)}")
    if vacias:
        raise SystemExit(f"Mallas vacías tras evaluar: {vacias}")

    # Los nombres de objeto son únicos en Blender: se apartan los originales para que cada pieza
    # nueva conserve el nombre exacto de mapeo.csv (la llave con src/data).
    for o in list(bpy.data.objects):
        o.name = "__original__" + o.name
    # Escena nueva solo con las piezas horneadas (transformación identidad, sin padres).
    nueva = bpy.data.scenes.new("atlas")
    for nombre, me in mallas:
        o = bpy.data.objects.new(nombre, me)
        nueva.collection.objects.link(o)

    nombres_finales = sorted(o.name for o in nueva.objects)
    if nombres_finales != sorted(n for n, _ in mallas):
        raise SystemExit("Blender cambió nombres de piezas al crearlas; revisa colisiones")
    cajas = {nombre: caja(me) for nombre, me in mallas}
    asegurar_carpeta(salida)
    with open(destino_cajas, "w", encoding="utf-8") as f:
        json.dump({"unidad": "metro", "ejes": "Blender (Z arriba)", "cajas": cajas}, f,
                  ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")

    with bpy.context.temp_override(scene=nueva):
        for o in nueva.objects:
            o.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(salida / "atlas-crudo.glb"),
            export_format="GLB",
            use_selection=False,
            use_active_scene=True,
            export_yup=True,
            export_apply=False,
            export_materials="NONE",
            export_normals=True,
            export_texcoords=False,
            export_animations=False,
            export_extras=False,
        )
    tris = sum(sum(len(p.vertices) - 2 for p in me.polygons) for _, me in mallas)
    print(f"{len(mallas)} mallas, {tris} triángulos -> {salida / 'atlas-crudo.glb'}")


if __name__ == "__main__":
    main()
