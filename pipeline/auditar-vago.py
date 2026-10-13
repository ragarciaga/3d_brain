"""Auditoría del vago (ADR 0009, fase A). Mide en el .blend los anclajes que necesitan las rutas y los
28 trazos del vago, y propone un nombre para cada trazo con la evidencia geométrica. No escribe
geometría ni toca src/data: los nombres son propuestas que un docente confirma con F24.

Salidas:
- pipeline/anclajes-vago.json: anclajes y trazos medidos, en coordenadas glTF (Y arriba, metros).
  Lo leen pipeline/generar-ramas-vago.py y la prueba de asimetrías (tests/asimetrias.test.ts).
- pipeline/salida/auditoria-vago.md: tabla para revisar (anclaje presente o ausente, y cada trazo).

Uso: python pipeline/auditar-vago.py  (o blender -b --python pipeline/auditar-vago.py)
"""
import json
import math

import bpy  # noqa: F401  (Blender como módulo)

from comun import RAIZ, abrir_blend, asegurar_carpeta

# Anclajes que nombran las rutas de pipeline/rutas-vago.yaml, con el nombre exacto de Z-Anatomy.
ANCLAJES = [
    "Medulla oblongata.l",
    "Medulla oblongata.r",
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


def extremo_inferior(pts):
    return min(pts, key=lambda p: p[1])


def caja(pts):
    return [[min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]]


def cortes(pts):
    """Perfil por altura: la caja de los vértices en cada franja horizontal de 5 mm."""
    por_franja = {}
    for p in pts:
        k = math.floor(p[1] / GROSOR_CORTE)
        por_franja.setdefault(k, []).append(p)
    return [{"y": round((k + 0.5) * GROSOR_CORTE, 4), "caja": caja(v)} for k, v in sorted(por_franja.items())]


def distancia(a, b):
    return math.dist(a, b)


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
        superficies[nombre] = arbol_kd(superficie)
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
    cercanos = {n: sorted((arbol.find(extremo_inferior(t["puntos"]))[2], k) for k, arbol in superficies.items())
                for n, t in trazos.items()}
    escribir_informe(anclas, ausentes, trazos, cercanos)
    print(f"{len(anclas)} anclajes medidos, {len(ausentes)} ausentes, {len(trazos)} trazos del vago")
    if ausentes:
        raise SystemExit(f"Faltan anclajes (las rutas que los usan no se pueden trazar): {ausentes}")


def centro_caja(c):
    return [(c[0][i] + c[1][i]) / 2 for i in range(3)]


CERCA_ESTOMAGO = 0.015  # extremo a menos de 15 mm de la superficie del estómago


def candidato(nombre, t, anclas, cercanos):
    """Propuesta de nombre para un trazo, con la regla que la produjo. Nunca es definitiva.
    cercanos: (distancia del extremo inferior a la superficie de cada anclaje, anclaje), de menor a mayor.
    Se mide contra la superficie y no contra el centro de la caja: con órganos grandes (diafragma,
    estómago) el centro de la caja no dice qué toca el trazo."""
    pts = t["puntos"]
    largo = sum(distancia(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    alto = max(p[1] for p in pts)
    bulbo = [a for k, a in anclas.items() if k.startswith("Medulla oblongata")]
    if bulbo and largo < 0.02 and alto >= min(a["caja"][0][1] for a in bulbo):
        return "raicilla (sale del bulbo)", "corto y a la altura del bulbo"
    if largo > 0.2:
        return "tronco del vago", "el trazo más largo del lado"
    extremo = extremo_inferior(pts)
    d = {k: v for v, k in cercanos}
    esofago = anclas.get("Oesophagus", {}).get("puntos")
    if esofago and "Stomach" in d:
        cardias = min(p[1] for p in esofago)  # final de la línea central del esófago
        if extremo[1] < cardias and d["Stomach"] < CERCA_ESTOMAGO:
            return ("candidato: ramo abdominal (gástrico, hepático o celíaco)",
                    f"termina {(cardias - extremo[1]) * 1000:.0f} mm debajo del final del esófago, "
                    f"a {d['Stomach'] * 1000:.0f} mm de la superficie del estómago")
    k = cercanos[0][1]
    regla = f"extremo inferior a {cercanos[0][0] * 1000:.0f} mm de la superficie de {k}"
    if k in ("Laryngopharynx",):
        return "candidato: ramo faríngeo", regla
    if k in ("Thyroid cartilage", "Cricoid cartilage"):
        return "candidato: nervio laríngeo superior", regla
    if k == "Stomach":
        return "candidato: ramo abdominal (gástrico, hepático o celíaco)", regla
    return "sin candidato", regla


def escribir_informe(anclas, ausentes, trazos, cercanos):
    asegurar_carpeta(RAIZ / "salida")
    lineas = ["# Auditoría del vago (ADR 0009)", "", "Propuestas para revisión docente: ningún nombre es definitivo.", "",
              "## Anclajes", "", "| Anclaje | Estado | Tipo |", "|---|---|---|"]
    for n in ANCLAJES:
        lineas.append(f"| {n} | {'presente' if n in anclas else 'AUSENTE'} | {anclas.get(n, {}).get('tipo', '')} |")
    lineas += ["", "## Trazos", "",
               "Altura en mm sobre el origen del modelo (Y arriba). Cercanos: distancia del extremo inferior a la "
               "superficie de los dos anclajes más próximos.", "",
               "| Trazo | Altura (mm) | Largo (mm) | Cercanos | Propuesta | Por qué |", "|---|---|---|---|---|---|"]
    for n, t in trazos.items():
        pts = t["puntos"]
        largo = sum(distancia(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        prop, regla = candidato(n, t, anclas, cercanos[n])
        cerca = ", ".join(f"{k} {v * 1000:.0f} mm" for v, k in cercanos[n][:2])
        lineas.append(f"| {n} | {max(p[1] for p in pts) * 1000:.0f} a {min(p[1] for p in pts) * 1000:.0f} "
                      f"| {largo * 1000:.0f} | {cerca} | {prop} | {regla} |")
    with open(RAIZ / "salida" / "auditoria-vago.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")


if __name__ == "__main__":
    main()
