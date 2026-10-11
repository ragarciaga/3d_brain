"""Genera pipeline/mapeo.csv (una fila por objeto exportado), src/data/arbol.json (jerarquía) y
siembra src/data/estructuras.json con los nombres de cada estructura y grupo.

Los nombres en latín y español salen de Terminologia Anatomica 2 (TA2.csv de Z-Anatomy) por
coincidencia exacta del nombre inglés. Lo que no coincide queda PENDIENTE: nunca se inventa.
La jerarquía sale de los grupos padre (.g) del propio modelo.

estructuras.json es contenido editable: este script solo agrega entradas que no existen y nunca
modifica las existentes, para no pisar correcciones de los revisores."""
import csv
import json

import bpy

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import (EXTRAS_ESTUDIO, RAICES_REFERENCIA, RAIZ, RAIZ_ENCEFALO, VAGO, abrir_blend, ancestros,
                   es_geometria, leer_ta2, nombre_base, nombre_grupo, slug)

PENDIENTE = "PENDIENTE"
FUENTE_TA2 = "TA2 (Z-Anatomy)"
RAIZ_VAGO = "g-vagus-nerve-x"
RAIZ_REFERENCIA = "g-organos-referencia"


def nombres(ta2, en):
    hit = ta2.get(en.lower())
    if hit and hit[0] and hit[1]:
        return {"en": en, "es": hit[1], "latin": hit[0], "fuente": FUENTE_TA2}
    return {"en": en, "es": PENDIENTE, "latin": PENDIENTE, "fuente": PENDIENTE}


def id_grupo(obj_grupo):
    return "g-" + slug(nombre_grupo(obj_grupo.name))


def sembrar_estructuras(ruta, nodos):
    existentes = {}
    if ruta.exists():
        with open(ruta, encoding="utf-8") as f:
            existentes = json.load(f)
    entradas = existentes.get("estructuras", {})
    usados = {"es": set(), "en": set()}
    for e in entradas.values():
        for idioma in ("es", "en"):
            usados[idioma].add(e["slug"][idioma])

    def slug_unico(texto, idioma):
        base = slug(texto) or "estructura"
        cand, i = base, 2
        while cand in usados[idioma]:
            cand, i = f"{base}-{i}", i + 1
        usados[idioma].add(cand)
        return cand

    nuevas = 0
    # Estructuras antes que grupos: si comparten nombre (el vago), la estructura recibe el slug limpio.
    for n in sorted(nodos.values(), key=lambda x: x["tipo"] == "grupo"):
        eid = n["estructura"] if n["tipo"] == "pieza" else n["id"]
        if eid in entradas:
            continue
        en = n["en"]
        es = n["es"]
        entradas[eid] = {
            "id": eid,
            "tipo": "estructura" if n["tipo"] == "pieza" else "grupo",
            "nombre": {"es": es, "en": en},
            "latin": n["latin"],
            "fuente_nombre": n["fuente"],
            "slug": {"es": slug_unico(es if es != PENDIENTE else en, "es"), "en": slug_unico(en, "en")},
            "sinonimos": {"es": [], "en": []},
            "ficha": None,
        }
        nuevas += 1
    salida = {"version": existentes.get("version", "0.1.0"),
              "licencia": "CC BY-SA 4.0",
              "estructuras": dict(sorted(entradas.items()))}
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"estructuras.json: {nuevas} entradas nuevas, {len(entradas)} en total")


def main():
    abrir_blend(bpy)
    ta2 = leer_ta2()
    objs = bpy.data.objects

    seleccion = []  # (objeto, tipo, raiz_sintetica_o_None, nombre_raiz_real)
    for o in objs:
        if not es_geometria(o):
            continue
        anc = [a.name for a in ancestros(o)]
        if RAIZ_ENCEFALO in anc:
            seleccion.append((o, "estudio", None, RAIZ_ENCEFALO))
        elif o.name in EXTRAS_ESTUDIO:
            seleccion.append((o, "estudio", EXTRAS_ESTUDIO[o.name], None))
        elif o.name in VAGO:
            seleccion.append((o, "estudio", RAIZ_VAGO, None))
        else:
            for r in RAICES_REFERENCIA:
                if o.name == r or r in anc:
                    if o.name.endswith("-profile"):
                        break  # perfil de bisel de la curva del esófago, no es anatomía
                    seleccion.append((o, "referencia", RAIZ_REFERENCIA, r))
                    break

    nodos = {}

    def agregar_grupo(gid, en, padre, es=None, latin=None, fuente=None):
        if gid in nodos:
            return
        n = nombres(ta2, en)
        if es is not None:
            n.update({"es": es, "latin": latin or "", "fuente": fuente})
        nodos[gid] = {"id": gid, "tipo": "grupo", **n, "padre": padre, "hijos": []}

    agregar_grupo(RAIZ_VAGO, "Vagus nerve (X)", None)
    agregar_grupo(RAIZ_REFERENCIA, "Reference organs", None, es="Órganos de referencia",
                  latin="", fuente="interfaz")

    filas = []
    for o, tipo, raiz_sint, raiz_real in sorted(seleccion, key=lambda s: s[0].name):
        base, lado = nombre_base(o.name)
        pieza = slug(base) + (f"-{lado}" if lado else "")
        estructura = slug(base)
        # Cadena de grupos .g desde la raíz real hasta el objeto (sin pasar por encima de la raíz).
        cadena = []
        for a in ancestros(o):
            if a.name.endswith(".g"):
                cadena.append(a)
            if a.name == raiz_real:
                break
        cadena.reverse()
        padre = raiz_sint
        if raiz_real == RAIZ_ENCEFALO or (raiz_real and raiz_real.endswith(".g")):
            for g in cadena:
                gid = id_grupo(g)
                agregar_grupo(gid, nombre_grupo(g.name), padre)
                padre = gid
        n = nombres(ta2, base)
        nodos[pieza] = {"id": pieza, "tipo": "pieza", **n, "padre": padre, "hijos": [],
                        "lado": lado, "malla": o.name, "estructura": estructura,
                        "clase": tipo, "curva": o.type == "CURVE"}
        filas.append({"nombre_malla": o.name, "pieza": pieza, "estructura": estructura, "lado": lado,
                      "en": base, "es": n["es"], "latin": n["latin"], "padre": padre or "",
                      "tipo": tipo, "fuente_nombre": n["fuente"]})

    for n in nodos.values():
        if n["padre"]:
            nodos[n["padre"]]["hijos"].append(n["id"])
    for n in nodos.values():
        n["hijos"].sort(key=lambda h: (nodos[h]["tipo"] != "grupo", nodos[h]["en"].lower(), h))

    raices = [n["id"] for n in nodos.values() if n["padre"] is None]
    orden = {id_grupo(objs[RAIZ_ENCEFALO]): 0, RAIZ_VAGO: 1, RAIZ_REFERENCIA: 2}
    raices.sort(key=lambda r: orden.get(r, 9))

    with open(RAIZ / "mapeo.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(filas)
    datos = RAIZ.parent / "src" / "data"
    datos.mkdir(parents=True, exist_ok=True)
    sembrar_estructuras(datos / "estructuras.json", nodos)
    arbol = {k: {c: v for c, v in n.items() if c not in ("es", "latin", "fuente")}
             for k, n in nodos.items()}
    with open(datos / "arbol.json", "w", encoding="utf-8") as f:
        json.dump({"fuente": "Z-Anatomy (CC BY-SA 4.0), jerarquía de grupos del modelo",
                   "raices": raices, "nodos": arbol}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    pend = sum(1 for r in filas if r["es"] == PENDIENTE)
    print(f"{len(filas)} objetos en mapeo.csv ({pend} con nombre PENDIENTE); "
          f"{sum(1 for n in nodos.values() if n['tipo'] == 'grupo')} grupos en arbol.json")


if __name__ == "__main__":
    main()
