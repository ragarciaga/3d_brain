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



# ---------------------------------------------------------------------------------------------------------
# Despeje (kickback de T5): ningún punto de una ruta dentro de un órgano.
# ---------------------------------------------------------------------------------------------------------
H = modelo.radio_nervio * g.HOLGURA

# 12. corte() y punto() ignoran las franjas de menos de 1 mm de alto (láminas sueltas).
con_lamina = copy.deepcopy(datos)
traquea = con_lamina["anclas"]["Trachea"]
buena_alta = traquea["cortes"][-1]["caja"]
lamina = [[-0.05, buena_alta[1][1] + 0.0002, -0.05], [0.05, buena_alta[1][1] + 0.00023, 0.05]]
traquea["cortes"].append({"y": round(buena_alta[1][1] + 0.0025, 4), "caja": lamina})
m_lamina = g.Modelo(con_lamina)
assert m_lamina.corte("Trachea", lamina[0][1]) != lamina, "corte() eligió una lámina de 0,03 mm"
assert abs(m_lamina.punto("Trachea", "mas_alto")[1] - modelo.punto("Trachea", "mas_alto")[1]) < 1e-12, \
    "mas_alto de una malla sin puntos tomó la lámina"
solo_laminas = copy.deepcopy(datos)
solo_laminas["anclas"]["Trachea"]["cortes"] = [{"y": 1.4, "caja": lamina}]
try:
    g.Modelo(solo_laminas).corte("Trachea", 1.4)
    raise AssertionError("debió fallar si todas las franjas son láminas")
except g.FaltaAnclaje as e:
    assert "Trachea" in str(e), e

# 13. surco recorre el tramo: un punto cada 5 mm en el orden del nervio, sin alturas a menos de 2,5 mm de los extremos.
subida = modelo.surco_tramo("derecho", 1.40, 1.46)
alturas = [p[1] for p in subida]
assert len(alturas) == 11 and all(abs(a - (1.40 + 0.005 * (i + 1))) < 1e-9 for i, a in enumerate(alturas)), alturas
assert all(abs(a - 1.40) >= 0.0025 and abs(a - 1.46) >= 0.0025 for a in alturas), alturas
bajada = modelo.surco_tramo("izquierdo", 1.46, 1.40)
assert [p[1] for p in bajada] == sorted([p[1] for p in bajada], reverse=True) and len(bajada) == 11, "debe ir del paso anterior al siguiente"
assert modelo.surco_tramo("derecho", 1.40, 1.4074) == [] and len(modelo.surco_tramo("derecho", 1.40, 1.41)) == 1
for p in subida + bajada:
    assert modelo.exceso(p) <= 0, f"un punto del surco queda dentro de un órgano: {p}"
assert all(p[0] < 0 for p in subida) and all(p[0] > 0 for p in bajada), "el surco derecho va en x negativa, el izquierdo en positiva"
# surco con a_la_altura_de se rechaza; y un surco sin vecino fijo, también.
con_altura = copy.deepcopy(rutas)
con_altura["rutas"]["laringeo_recurrente_derecho"]["pasos"][2]["a_la_altura_de"] = {"anclaje": "Trachea", "punto": "mas_alto"}
try:
    g.generar(datos, con_altura)
    raise AssertionError("debió rechazar surco con a_la_altura_de")
except ValueError as e:
    assert "surco recorre el tramo" in str(e), e
sin_vecino = copy.deepcopy(rutas)
sin_vecino["rutas"]["laringeo_recurrente_derecho"]["pasos"].pop()
try:
    g.generar(datos, sin_vecino)
    raise AssertionError("debió rechazar un surco sin paso fijo después")
except ValueError as e:
    assert "surco" in str(e), e

# 14. rodear anterior sobre un doble corte (una franja que abarca las dos ramas del tubo) parte de la línea central;
# sobre un corte simple da lo mismo que antes.
def con_arco(z0, z1):
    c = copy.deepcopy(datos)
    c["anclas"]["Aortic arch"] = {
        "tipo": "CURVE", "radio": 0.01,
        "puntos": [[-0.03, 1.0, 0.0], [-0.01, 1.01, 0.0], [0.0, 1.012, 0.0], [0.01, 1.01, 0.0], [0.03, 1.0, 0.0]],
        "caja": [[-0.03, 1.0, z0], [0.03, 1.012, z1]],
        "cortes": [{"y": 1.0125, "caja": [[-0.03, 1.0, z0], [0.03, 1.012, z1]]}],
    }
    return g.Modelo(c)


cima = [0.0, 1.012, 0.0]
doble = con_arco(-0.04, 0.04)
q = doble.rodear("Aortic arch", cima, "anterior")
assert abs(q[2] - (0.01 + H)) < 1e-9 and abs(q[0]) < 1e-9 and abs(q[1] - 1.012) < 1e-9, f"doble corte: {q}"
q = doble.rodear("Aortic arch", cima, "posterior")
assert abs(q[2] + (0.01 + H)) < 1e-9, f"doble corte posterior: {q}"
simple = con_arco(-0.0105, 0.0105)
assert simple.rodear("Aortic arch", cima, "anterior")[2] == 0.0105 + H, "corte simple: debe seguir la regla de la caja"
assert simple.rodear("Aortic arch", cima, "posterior")[2] == -0.0105 - H
# Si la dirección casi coincide con el eje del tubo, se detiene en lugar de inventar un lado.
eje_z = copy.deepcopy(datos)
eje_z["anclas"]["Aortic arch"] = {"tipo": "CURVE", "radio": 0.01, "puntos": [[0.0, 1.012, -0.03], [0.0, 1.012, 0.0], [0.0, 1.012, 0.03]],
                                  "caja": [[-0.01, 1.0, -0.04], [0.01, 1.012, 0.04]], "cortes": [{"y": 1.0125, "caja": [[-0.01, 1.0, -0.04], [0.01, 1.012, 0.04]]}]}
try:
    g.Modelo(eje_z).rodear("Aortic arch", cima, "anterior")
    raise AssertionError("debió fallar con la dirección sobre el eje")
except ValueError as e:
    assert "Aortic arch" in str(e), e
# Los órganos medidos por cajas (esófago, tráquea) no usan la línea central aunque su franja sea ancha.
ancho = copy.deepcopy(datos)
ancho["anclas"]["Oesophagus"]["cortes"] = [{"y": 1.3, "caja": [[-0.05, 1.29, -0.05], [0.05, 1.31, 0.05]]}]
m_ancho = g.Modelo(ancho)
assert m_ancho._por_linea_central("Oesophagus", [0.0, 1.3, 0.0], 1, None) is None
assert m_ancho.rodear("Oesophagus", [0.0, 1.3, 0.0], "anterior")[2] == 0.05 + H

# 15. Profundidad: caja por franja con pared común, tubo con eje y radio, y una tolerancia propia por órgano.
def libre_de_otros(c):
    """Franja de la tráquea sintética cuyo centro y cuya cara lateral no tocan ningún otro órgano."""
    y = (c["caja"][0][1] + c["caja"][1][1]) / 2
    z = (c["caja"][0][2] + c["caja"][1][2]) / 2
    pts = [[(c["caja"][0][0] + c["caja"][1][0]) / 2, y, z], [c["caja"][1][0] - 0.0008, y, z]]
    return all(modelo.profundidad(n, p) < -0.002 for p in pts for n in g.OBSTACULOS_CAJA + g.OBSTACULOS_TUBO if n != "Trachea")


cj = next(c for c in datos["anclas"]["Trachea"]["cortes"] if c["caja"][1][1] - c["caja"][0][1] >= g.CORTE_MINIMO and libre_de_otros(c))
y_c = (cj["caja"][0][1] + cj["caja"][1][1]) / 2
x_c = (cj["caja"][0][0] + cj["caja"][1][0]) / 2
z_c = (cj["caja"][0][2] + cj["caja"][1][2]) / 2
assert modelo.profundidad("Trachea", [x_c, y_c, z_c]) > 0.004
assert modelo.profundidad("Trachea", [x_c + 1.0, y_c, z_c]) < 0
assert modelo.profundidad("Trachea", [x_c, 5.0, z_c]) == -math.inf, "sin franja a esa altura no hay órgano"
eje_arco = datos["anclas"]["Aortic arch"]["puntos"][3]
assert abs(modelo.profundidad("Aortic arch", eje_arco) - datos["anclas"]["Aortic arch"]["radio"]) < 1e-9
assert g.tolerancia_de("Trachea") == g.tolerancia_de("Oesophagus") == 0.001
for otro in ("Cricoid cartilage", "Thyroid cartilage", "Aortic arch", "Left main bronchus", "Right subclavian artery"):
    assert g.tolerancia_de(otro) == 0.0005, otro
# 0,8 mm adentro de la cara lateral de la tráquea se tolera (límite de 1 mm); 0,8 mm adentro de la superficie de una arteria, no.
p_traquea = [cj["caja"][1][0] - 0.0008, y_c, z_c]
assert modelo.profundidad("Trachea", p_traquea) > 0 and modelo.excede(p_traquea) is None
arteria = datos["anclas"]["Right subclavian artery"]
e0 = arteria["puntos"][len(arteria["puntos"]) // 2]
p_arteria = [e0[0], e0[1], e0[2] + arteria["radio"] - 0.0008]
n_arteria, d_arteria = modelo.excede(p_arteria)
assert n_arteria == "Right subclavian artery" and d_arteria > 0.0005

# 16. _empujar saca un punto de un tubo (radial hasta radio + h) y de una caja (por la cara más cercana hasta cara + h).
dentro_tubo = [eje_arco[0], eje_arco[1], eje_arco[2] + 0.003]
fuera = g._empujar(modelo, dentro_tubo)
assert abs(modelo.profundidad("Aortic arch", fuera) + H) < 1e-9, modelo.profundidad("Aortic arch", fuera)
dentro_caja = [x_c, y_c, z_c]
fuera = g._empujar(modelo, dentro_caja)
assert modelo.profundidad("Trachea", fuera) <= -H + 1e-9 or modelo.exceso(fuera) <= 0
# El control que sale de rodear queda fuera de un órgano vecino: el resolver lo empuja (aquí, la cara anterior de
# la tráquea cae dentro del arco).
paso_dentro = {"lado": "derecho", "pasos": [{"anclaje": "Trachea", "punto": "mas_bajo", "rodear": "anterior"}]}
cr = modelo.punto("Trachea", "mas_bajo")
crudo = modelo.rodear("Trachea", cr, "anterior")
assert modelo.exceso(crudo) > 0, "el caso de prueba ya no cae dentro de otro órgano"
assert modelo.exceso(g.resolver(modelo, paso_dentro, {})[0]) <= 0, "resolver no sacó el control rodeado del órgano vecino"

# 18. Una ruta forzada a pasar por el centro de la tráquea se rechaza nombrando ruta, órgano y altura, y no escribe nada.
forzada = copy.deepcopy(rutas)
forzada["rutas"]["laringeo_recurrente_derecho"]["pasos"].insert(2, {"anclaje": "Trachea", "punto": "centro"})
with tempfile.TemporaryDirectory() as tmp:
    destino = Path(tmp) / "rutas-vago.json"
    try:
        g.generar_y_escribir(datos, forzada, destino)
        raise AssertionError("debió fallar una ruta que atraviesa la tráquea")
    except g.Atraviesa as e:
        texto_e = str(e)
        assert "laringeo_recurrente_derecho" in texto_e and "Trachea" in texto_e and re.search(r"y = \d+\.\d mm", texto_e), texto_e
        assert re.search(r"pasa \d+\.\d\d mm dentro de", texto_e), texto_e
    assert not destino.exists(), "escribió el archivo aunque la ruta atravesaba la tráquea"
    g.generar_y_escribir(datos, rutas, destino)
    assert destino.exists(), "control positivo: con las rutas buenas sí escribe"

# 19. Las rutas buenas no pasan de la tolerancia de ningún órgano ni dejan saltos de más de 2,5 mm.
for id_ruta, r in salida["rutas"].items():
    for p in r["puntos"]:
        assert modelo.excede(p) is None, f"{id_ruta}: {p} dentro de {modelo.excede(p)}"
    assert max(math.dist(a, b) for a, b in zip(r["puntos"], r["puntos"][1:])) <= g.SALTO_MAXIMO + 1e-12, id_ruta

print("generar-ramas-vago.py: pruebas en verde")
