"""Pruebas del generador de rutas del vago sin Blender: python pipeline/pruebas/probar_generar.py"""
import copy
import importlib.util
import json
import math
import tempfile
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
assert len(salida["rutas"]) == 5, list(salida["rutas"])
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

# 4. Cada ruta dice qué ficha abre y en qué estado de revisión está; un estado raro se rechaza.
estructuras = json.load(open(RAIZ / "src" / "data" / "estructuras.json", encoding="utf-8"))["estructuras"]
for id_ruta, r in salida["rutas"].items():
    assert r["entrada"] in estructuras, f"{id_ruta}: la entrada {r['entrada']!r} no es una ficha de src/data/estructuras.json"
    assert r["revision"]["estado"] in g.ESTADOS, id_ruta
assert "vagus-nerve-x" in estructuras and salida["rutas"]["vago_toracico_derecho"]["entrada"] == "vagus-nerve-x"
assert "no-existe" not in estructuras
raro = copy.deepcopy(rutas)
raro["rutas"]["laringeo_recurrente_derecho"]["revision"]["estado"] = "listo"
try:
    g.generar(datos, raro)
    raise AssertionError("debió rechazar un estado de revisión desconocido")
except ValueError as e:
    assert "estado de revisión" in str(e), e



def dist_a_polilinea(p, pts):
    mejor = math.inf
    for a, b in zip(pts, pts[1:]):
        ab = [b[i] - a[i] for i in range(3)]
        largo2 = sum(v * v for v in ab)
        t = 0.0 if largo2 == 0 else max(0.0, min(1.0, sum((p[i] - a[i]) * ab[i] for i in range(3)) / largo2))
        mejor = min(mejor, math.dist(p, [a[i] + ab[i] * t for i in range(3)]))
    return mejor


def altura(nombre, cual):
    return g.Modelo(datos).punto(nombre, cual)[1]


modelo = g.Modelo(datos)
R = salida["rutas"]
alto_rsa = altura("Right subclavian artery", "mas_alto")
bajo_rmb = altura("Right main bronchus", "mas_bajo")
alto_lsa = altura("Left subclavian artery", "mas_alto")
alto_arco = altura("Aortic arch", "mas_alto")

# 5. Los pasos nuevos: hasta_vago cierra en el tronco, desde_ruta arranca sobre otra ruta.
ctrl_der = R["vago_toracico_derecho"]["control"]
esperado = g.en_polilinea_a_altura(modelo.tronco("derecho"), bajo_rmb)
assert math.dist(ctrl_der[-1], esperado) < 1e-6, "hasta_vago: el último control no está en el tronco a la altura del bronquio"
assert abs(ctrl_der[0][1] - alto_rsa) < 1e-6
assert math.dist(R["vago_izquierdo_distal"]["control"][0], R["vago_toracico_izquierdo"]["puntos"][-1]) < 1e-6, \
    "desde_ruta punto final: el distal no arranca donde termina el torácico izquierdo"
for id_rec, id_tor, y in (("laringeo_recurrente_derecho", "vago_toracico_derecho", alto_rsa),
                          ("laringeo_recurrente_izquierdo", "vago_toracico_izquierdo", alto_arco)):
    primero = R[id_rec]["control"][0]
    assert abs(primero[1] - y) < 1e-6, f"{id_rec}: no sale a la altura pedida"
    assert dist_a_polilinea(primero, R[id_tor]["puntos"]) < 1e-6, f"{id_rec}: no sale de {id_tor}"

# 6. Bandas del tronco escaneado que reemplazan las rutas torácicas.
assert R["vago_toracico_derecho"]["reemplaza"] == {"lado": "derecho", "y_max": round(alto_rsa, 6), "y_min": round(bajo_rmb, 6)}
assert R["vago_toracico_izquierdo"]["reemplaza"] == {"lado": "izquierdo", "y_max": round(alto_lsa, 6), "y_min": None}
for otra in ("laringeo_recurrente_derecho", "laringeo_recurrente_izquierdo", "vago_izquierdo_distal"):
    assert "reemplaza" not in R[otra], f"{otra} no reemplaza nada"
sin_desde = copy.deepcopy(rutas)
sin_desde["rutas"]["vago_toracico_derecho"]["reemplaza"] = {"hasta": {"anclaje": "Right main bronchus", "punto": "mas_bajo"}}
try:
    g.generar(datos, sin_desde)
    raise AssertionError("debió fallar un reemplaza sin desde")
except ValueError as e:
    assert "vago_toracico_derecho" in str(e), e

# 7. Si falta un anclaje o una ruta, se detiene nombrándolo y no escribe nada.
with tempfile.TemporaryDirectory() as tmp:
    destino = Path(tmp) / "rutas-vago.json"
    for faltante in ("Right main bronchus", "Left subclavian artery"):
        incompleto = copy.deepcopy(datos)
        del incompleto["anclas"][faltante]
        try:
            g.generar_y_escribir(incompleto, rutas, destino)
            raise AssertionError(f"debió fallar sin {faltante}")
        except g.FaltaAnclaje as e:
            assert faltante in str(e), e
        assert not destino.exists(), f"escribió el archivo aunque faltaba {faltante}"
    sin_ruta = copy.deepcopy(rutas)
    sin_ruta["rutas"]["vago_izquierdo_distal"]["pasos"][0]["desde_ruta"]["ruta"] = "vago_toracico_inexistente"
    try:
        g.generar_y_escribir(datos, sin_ruta, destino)
        raise AssertionError("debió fallar con una ruta inexistente")
    except g.FaltaRuta as e:
        assert "vago_toracico_inexistente" in str(e), e
    assert not destino.exists(), "escribió el archivo aunque faltaba una ruta"
    # Control positivo: con entradas válidas sí escribe, así el "no escribe" no pasa por construcción.
    g.generar_y_escribir(datos, rutas, destino)
    assert destino.exists() and len(json.load(open(destino, encoding="utf-8"))["rutas"]) == 5

# 8. El resultado no depende del orden de las rutas en el YAML, y la salida conserva ese orden.
inverso = copy.deepcopy(rutas)
inverso["rutas"] = dict(reversed(list(rutas["rutas"].items())))
salida_inversa = g.generar(datos, inverso)
assert list(salida_inversa["rutas"]) == list(inverso["rutas"]) and list(inverso["rutas"]) != list(rutas["rutas"])
for id_ruta, r in R.items():
    for campo in ("control", "puntos", "reemplaza"):
        assert salida_inversa["rutas"][id_ruta].get(campo) == r.get(campo), f"{id_ruta}: {campo} cambia con el orden"

# 9. Una dependencia circular falla nombrando las rutas.
ciclo = copy.deepcopy(rutas)
ciclo["rutas"]["vago_toracico_izquierdo"]["pasos"][0] = {"desde_ruta": {"ruta": "vago_izquierdo_distal", "punto": "final"}}
try:
    g.generar(datos, ciclo)
    raise AssertionError("debió fallar una dependencia circular")
except ValueError as e:
    assert "vago_toracico_izquierdo" in str(e) and "vago_izquierdo_distal" in str(e), e


# 10. Ni los pasos ni reemplaza llevan números: todo sale de medir los anclajes.
def numeros(x):
    if isinstance(x, bool):
        return []
    if isinstance(x, (int, float)):
        return [x]
    if isinstance(x, dict):
        return [n for v in x.values() for n in numeros(v)]
    if isinstance(x, list):
        return [n for v in x for n in numeros(v)]
    return []


for id_ruta, r in rutas["rutas"].items():
    hallados = numeros(r["pasos"]) + numeros(r.get("reemplaza"))
    assert not hallados, f"{id_ruta}: coordenadas escritas a mano {hallados}"
inyectada = copy.deepcopy(rutas["rutas"]["vago_toracico_derecho"])
inyectada["pasos"].append({"anclaje": "Trachea", "punto": [0.1, 1.2, 0.3]})
assert numeros(inyectada["pasos"]) == [0.1, 1.2, 0.3], "el detector de números no detecta una coordenada inyectada"

# 11. punto_en_ruta perdona el redondeo de la curva (0,01 mm) en los extremos, y solo ahí.
tramo = [[0.0, 1.0, 0.0], [0.0, 0.5, 0.1]]
assert g.punto_en_ruta(tramo, 1.0 + 5e-6, "x") == [0.0, 1.0, 0.0]
assert g.punto_en_ruta(tramo, 0.5 - 5e-6, "x") == [0.0, 0.5, 0.1]
assert abs(g.punto_en_ruta(tramo, 0.75, "x")[2] - 0.05) < 1e-9
for fuera in (1.0 + 1e-3, 0.5 - 1e-3):
    try:
        g.punto_en_ruta(tramo, fuera, "ruta_x")
        raise AssertionError("debió fallar fuera de la tolerancia")
    except g.FaltaAnclaje as e:
        assert "ruta_x" in str(e), e

print("generar-ramas-vago.py: 11 pruebas en verde")
