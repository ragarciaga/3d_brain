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
  en la app, para poder seleccionarlos en el celular."""
import json

import bpy

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import RAIZ, abrir_blend, asegurar_carpeta, leer_mapeo

RADIO_TOQUE = 0.003


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


def main():
    abrir_blend(bpy)
    filas = leer_mapeo()
    escena = bpy.context.scene
    tmp_col = bpy.data.collections.new("_tmp")
    escena.collection.children.link(tmp_col)

    mallas = []  # (nombre, mesh)
    for fila in filas:
        obj = bpy.data.objects[fila["nombre_malla"]]
        estudio_curva = obj.type == "CURVE" and fila["tipo"] == "estudio"
        es_vago = fila["nombre_malla"].startswith("Vagus nerve (X)")
        if es_vago:
            for i in range(len(obj.data.splines)):
                tmp = copia_temporal(obj, tmp_col)
                for j in reversed(range(len(tmp.data.splines))):
                    if j != i:
                        tmp.data.splines.remove(tmp.data.splines[j])
                dg = bpy.context.evaluated_depsgraph_get()
                dg.update()
                nombre = f"{obj.name}#t{i:02d}"
                mallas.append((nombre, malla_horneada(tmp, dg, nombre)))
                tmp.data.bevel_depth = RADIO_TOQUE
                tmp.data.bevel_resolution = 1
                dg.update()
                mallas.append((nombre + "#toque", malla_horneada(tmp, dg, nombre + "#toque")))
        else:
            dg = bpy.context.evaluated_depsgraph_get()
            mallas.append((obj.name, malla_horneada(obj, dg, obj.name)))
            if estudio_curva:
                tmp = copia_temporal(obj, tmp_col)
                tmp.data.bevel_depth = RADIO_TOQUE
                tmp.data.bevel_resolution = 1
                dg.update()
                mallas.append((obj.name + "#toque", malla_horneada(tmp, dg, obj.name + "#toque")))

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
    salida = RAIZ / "salida"
    asegurar_carpeta(salida)
    with open(RAIZ / "cajas.json", "w", encoding="utf-8") as f:
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
