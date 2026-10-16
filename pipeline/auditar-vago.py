"""Auditoría del vago (ADR 0009, fase A). Mide en el .blend los anclajes que necesitan las rutas y los
28 trazos del vago, y propone un nombre para cada trazo con la evidencia geométrica. No escribe
geometría ni toca src/data: los nombres son propuestas que un docente confirma con F24.

Las reglas de cada trazo (raicilla, faríngeo, laríngeo superior, ramos abdominales, tronco) y la escritura de
trazos-medidos.json viven en pipeline/reglas_vago.py, que no usa bpy y se prueba sin Blender
(pipeline/pruebas/probar_auditar.py). Aquí solo se lee el modelo.

Salidas:
- pipeline/anclajes-vago.json: anclajes y trazos medidos, en coordenadas glTF (Y arriba, metros).
  Lo leen pipeline/generar-ramas-vago.py y la prueba de asimetrías (tests/asimetrias.test.ts).
- pipeline/salida/trazos-medidos.json: por trazo, su altura, largo, las dos piezas más cercanas a cada extremo,
  la regla que se cumple, el ramo propuesto con su confianza y la fuente. Lo leerá scripts/aplicar-trazos.ts (spec 04, T6).
- pipeline/salida/auditoria-vago.md: tabla para revisar (anclaje presente o ausente, y cada trazo).

Uso: python pipeline/auditar-vago.py  (o blender -b --python pipeline/auditar-vago.py)
"""
import json
import math
import sys
from pathlib import Path

import bpy  # noqa: F401  (Blender como módulo)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import RAIZ, abrir_blend, asegurar_carpeta  # noqa: E402
import reglas_vago  # noqa: E402

# Anclajes de las rutas de pipeline/rutas-vago.yaml y piezas que exigen las reglas de reglas_vago.py
# (PIEZAS_SUPERFICIE y PIEZAS_LINEA), con el nombre exacto de Z-Anatomy.
ANCLAJES = [
    "Medulla oblongata.l",
    "Medulla oblongata.r",
    "Olive.l",
    "Olive.r",
    "Internal jugular vein.l",
    "Internal jugular vein.r",
    "Laryngopharynx",
    "Thyroid cartilage",
    "Cricoid cartilage",
    "Trachea",
    "Oesophagus",
    "Right subclavian artery",
    "Left subclavian artery",
    "Right common carotid artery",
    "Left common carotid artery",
    "Brachiocephalic trunk",
    "Aortic arch",
    "Thoracic aorta",
    # Z-Anatomy no trae el ligamento arterioso como objeto (ni en docs/research/fase-0/inventario-z-anatomy.tsv).
    # Lo más cercano es su ganglio (Nodus ligamenti arteriosi, "Mediastinal lymph nodes"), que en el modelo
    # queda entre la concavidad del arco y la bifurcación del tronco pulmonar, donde va el ligamento.
    # Es un sustituto topográfico pendiente de revisión docente, no el ligamento.
    "Node of ligamentum arteriosum",
    "Left main bronchus",
    "Right main bronchus",
    "Diaphragm",
    "Stomach",
    "Liver",
]
VAGO = ("Vagus nerve (X).l", "Vagus nerve (X).r")
GROSOR_CORTE = 0.005  # cortes horizontales de 5 mm para las mallas (perfil de tráquea, esófago, etc.)


def a_gltf(v):
    """Blender (Z arriba) a glTF (Y arriba): el mismo giro global del exportador, nada más."""
    return [round(v[0], 6), round(v[2], 6), round(-v[1], 6)]


def escala_media(o):
    s = o.matrix_world.to_scale()
    return (abs(s.x) + abs(s.y) + abs(s.z)) / 3


def linea_central(o, dg, coleccion, spline=None):
    """Puntos de la línea central de una curva (sin bisel), en orden, en coordenadas del mundo."""
    tmp = o.copy()
    tmp.data = o.data.copy()
    coleccion.objects.link(tmp)
    tmp.data.bevel_depth = 0
    tmp.data.bevel_object = None
    tmp.data.extrude = 0
    if spline is not None:
        for j in reversed(range(len(tmp.data.splines))):
            if j != spline:
                tmp.data.splines.remove(tmp.data.splines[j])
    dg.update()
    ev = tmp.evaluated_get(dg)
    me = ev.to_mesh()
    puntos = [a_gltf(tmp.matrix_world @ v.co) for v in me.vertices]
    ev.to_mesh_clear()
    bpy.data.objects.remove(tmp)
    return puntos


def medir_malla(o, dg):
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [a_gltf(o.matrix_world @ v.co) for v in me.vertices]
    ev.to_mesh_clear()
    return pts


def radio_medido(centro, superficie):
    """Radio de un vaso o conducto: la mediana de la distancia de cada punto de la línea central a
    la superficie más cercana. Sirve aunque la curva use un perfil de bisel en vez de bevel_depth."""
    arbol = arbol_kd(superficie)
    d = sorted(arbol.find(p)[2] for p in centro)
    return round(d[len(d) // 2], 6) if d else 0.0


def arbol_kd(puntos):
    from mathutils import kdtree

    arbol = kdtree.KDTree(len(puntos))
    for i, p in enumerate(puntos):
        arbol.insert(p, i)
    arbol.balance()
    return arbol


def caja(pts):
    return [[min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]]


def cortes(pts):
    """Perfil por altura: la caja de los vértices en cada franja horizontal de 5 mm."""
    por_franja = {}
    for p in pts:
        k = math.floor(p[1] / GROSOR_CORTE)
        por_franja.setdefault(k, []).append(p)
    return [{"y": round((k + 0.5) * GROSOR_CORTE, 4), "caja": caja(v)} for k, v in sorted(por_franja.items())]


def main():
    abrir_blend(bpy)
    dg = bpy.context.evaluated_depsgraph_get()
    col = bpy.data.collections.new("_auditoria")
    bpy.context.scene.collection.children.link(col)

    anclas, ausentes, superficies = {}, [], {}
    for nombre in ANCLAJES:
        o = bpy.data.objects.get(nombre)
        if o is None:
            ausentes.append(nombre)
            continue
        superficie = medir_malla(o, dg)  # con bisel y modificadores: la superficie real
        superficies[nombre] = superficie  # lista de vértices: las reglas miden contra ella
        datos = {"tipo": o.type, "caja": caja(superficie), "cortes": cortes(superficie)}
        if o.type == "CURVE":
            centro = linea_central(o, dg, col)
            datos["puntos"] = centro
            datos["radio"] = radio_medido(centro, superficie)
        anclas[nombre] = datos

    trazos = {}
    for nombre in VAGO:
        o = bpy.data.objects[nombre]
        for i in range(len(o.data.splines)):
            pts = linea_central(o, dg, col, spline=i)
            trazos[f"{nombre}#t{i:02d}"] = {"puntos": pts, "caja": caja(pts),
                                           "radio": round(o.data.bevel_depth * escala_media(o), 6)}

    salida = {"unidad": "metro", "ejes": "glTF (Y arriba, +X izquierda del cuerpo)",
              "anclas": anclas, "ausentes": ausentes, "trazos": trazos}
    with open(RAIZ / "anclajes-vago.json", "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write("\n")
    print(f"{len(anclas)} anclajes medidos, {len(ausentes)} ausentes, {len(trazos)} trazos del vago")
    asegurar_carpeta(RAIZ / "salida")
    if ausentes:
        # Sin todos los anclajes no se pueden aplicar las reglas: se deja el informe de anclajes y se detiene.
        escribir_informe(reglas_vago.informe(ANCLAJES, anclas, ausentes, None))
        raise SystemExit(f"Faltan anclajes (las rutas y las reglas de los trazos que los usan no se pueden aplicar): {ausentes}")
    medidos = reglas_vago.medir_trazos(anclas, trazos, superficies)
    reglas_vago.escribir_trazos_medidos(medidos, RAIZ / "salida" / "trazos-medidos.json")
    escribir_informe(reglas_vago.informe(ANCLAJES, anclas, ausentes, medidos))


def escribir_informe(texto):
    with open(RAIZ / "salida" / "auditoria-vago.md", "w", encoding="utf-8") as f:
        f.write(texto)


if __name__ == "__main__":
    main()
