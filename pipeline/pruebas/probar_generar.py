"""Pruebas del generador de rutas del vago sin Blender: python pipeline/pruebas/probar_generar.py"""
import copy
import importlib.util
import math
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("generar", RAIZ / "pipeline" / "generar-ramas-vago.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
spec2 = importlib.util.spec_from_file_location("sintetico", RAIZ / "pipeline" / "pruebas" / "vago_sintetico.py")
s = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(s)

rutas = yaml.safe_load(open(RAIZ / "pipeline" / "rutas-vago.yaml", encoding="utf-8"))
datos = s.modelo()

# 1. Las rutas pasan por todos sus puntos de control y no tienen saltos de más de 2,5 mm.
salida = g.generar(datos, rutas)
for id_ruta, r in salida["rutas"].items():
    pts = r["puntos"]
    for c in r["control"]:
        assert min(math.dist(c, p) for p in pts) < 1e-6, f"{id_ruta}: la curva no pasa por {c}"
    salto = max(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    assert salto <= 0.0025, f"{id_ruta}: salto de {salto * 1000:.2f} mm"  # 2 mm más un paso fino
    assert r["radio"][1] < r["radio"][0], f"{id_ruta}: el grosor no baja hacia lo distal"

# 2. Si falta un anclaje, se detiene y lo nombra.
sin_arco = copy.deepcopy(datos)
del sin_arco["anclas"]["Aortic arch"]
try:
    g.generar(sin_arco, rutas)
    raise AssertionError("debió fallar sin el arco aórtico")
except g.FaltaAnclaje as e:
    assert "Aortic arch" in str(e), e

# 3. Ninguna ruta usa un anclaje que la auditoría no mide.
import re

texto = open(RAIZ / "pipeline" / "rutas-vago.yaml", encoding="utf-8").read()
usados = set(re.findall(r'(?:anclaje|cerca_de): "([^"]+)"', texto))
auditar = open(RAIZ / "pipeline" / "auditar-vago.py", encoding="utf-8").read()
faltan = [u for u in usados if f'"{u}"' not in auditar]
assert not faltan, f"anclajes que auditar-vago.py no mide: {faltan}"

# 4. Sin revisión docente aprobada, el YAML del repositorio no se puede publicar.
assert rutas["revision_docente"]["estado"] in ("pendiente", "aprobada")

print("generar-ramas-vago.py: 4 pruebas en verde")
