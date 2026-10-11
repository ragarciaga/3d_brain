"""Inventario completo del .blend: todos los objetos (mallas, curvas, textos), no solo mallas,
porque los nervios de Z-Anatomy son curvas. Salida: pipeline/salida/estructuras.txt (TSV)."""
import bpy

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import RAIZ, abrir_blend, asegurar_carpeta


def main():
    abrir_blend(bpy)
    salida = RAIZ / "salida"
    asegurar_carpeta(salida)
    ruta = salida / "estructuras.txt"
    with open(ruta, "w", encoding="utf-8") as f:
        f.write("nombre\ttipo\tcolecciones\tpadre\tvertices\tmodificadores\n")
        for o in sorted(bpy.data.objects, key=lambda x: x.name):
            if o.type == "MESH":
                v = len(o.data.vertices)
            elif o.type == "CURVE":
                v = sum(len(s.points) + len(s.bezier_points) for s in o.data.splines)
            else:
                v = 0
            cols = "|".join(c.name for c in o.users_collection)
            mods = ",".join(m.type for m in getattr(o, "modifiers", []))
            padre = o.parent.name if o.parent else ""
            f.write(f"{o.name}\t{o.type}\t{cols}\t{padre}\t{v}\t{mods}\n")
    print(f"{len(bpy.data.objects)} objetos en {ruta}")


if __name__ == "__main__":
    main()
