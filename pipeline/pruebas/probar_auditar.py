"""Pruebas de las reglas de la auditoría del vago (pipeline/reglas_vago.py) sin Blender, sobre el vago sintético:
python pipeline/pruebas/probar_auditar.py
"""
import copy
import importlib.util
import json
import math
import re
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "pipeline"))
sys.path.insert(0, str(RAIZ / "pipeline" / "pruebas"))


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


import reglas_vago as r  # noqa: E402
import geometria as g  # noqa: E402
import vago_sintetico as s  # noqa: E402

# 1. Pureza: las reglas no importan bpy, ni en memoria ni en el texto del archivo.
assert "bpy" not in sys.modules, "importar reglas_vago.py no debe cargar bpy"
texto_reglas = open(RAIZ / "pipeline" / "reglas_vago.py", encoding="utf-8").read()
assert not re.search(r"^\s*(import|from)\s+bpy\b", texto_reglas, re.M), "reglas_vago.py importa bpy"
assert re.search(r"^\s*(import|from)\s+bpy\b", "import bpy\n", re.M), "el detector de bpy no detecta un import"

u = cargar("ubicar", RAIZ / "pipeline" / "ubicar-marcadores.py")  # solo para leer_bibliografia
BIB = u.leer_bibliografia()
MARCADORES = {m["id"] for m in json.load(open(RAIZ / "src" / "data" / "marcadores.json", encoding="utf-8"))}

MODELO = s.modelo()
ANCLAS, TRAZOS = MODELO["anclas"], MODELO["trazos"]
SUP = s.superficies()
CTX = r.Contexto(ANCLAS, SUP, TRAZOS)
DF, DL = r.DISTANCIA_FARINGEO_MM, r.DISTANCIA_LARINGEO_SUPERIOR_MM

# 2. Los umbrales son constantes con nombre, números o pares de números.
for nombre in ("LARGO_TRONCO_MM", "LARGO_RAICILLA_MAX_MM", "CERCA_BULBO_MM", "CERCA_CUELLO_MM", "CERCA_ABDOMEN_MM",
               "MARGEN_BAJA_MM", "FACTOR_ALTA"):
    assert isinstance(getattr(r, nombre), (int, float)), nombre
for nombre in ("DISTANCIA_FARINGEO_MM", "DISTANCIA_LARINGEO_SUPERIOR_MM"):
    par = getattr(r, nombre)
    assert len(par) == 2 and all(isinstance(v, (int, float)) for v in par) and par[0] < par[1], nombre
assert r.LARGO_TRONCO_MM == 200.0 and r.MARGEN_BAJA_MM == 3.0 and r.FACTOR_ALTA == 2.0


# Ayudas para armar ramos de prueba.
def desde_foramen(lado, d_mm):
    """Punto del tronco a d_mm bajo el foramen yugular de ese lado."""
    p = g.punto_a_distancia(CTX.troncos[lado], CTX.foramen[lado][1] + d_mm / 1000)
    assert p is not None
    return p


def trazo(*control):
    return {"puntos": [[round(v, 6) for v in p] for p in s.polilinea(list(control))], "radio": 0.0005}


def uno(nombre, control):
    """Registro de un ramo de prueba ('Vagus nerve (X).<lado>#t9N' y sus puntos de control), medido junto al fixture."""
    return r.medir_trazos(ANCLAS, {**TRAZOS, nombre: trazo(*control)}, SUP)[nombre]


# 3. El foramen es el punto del tronco más cercano al extremo superior de la vena yugular.
for lado_ in ("l", "r"):
    tronco = CTX.troncos[lado_]
    arriba = max(ANCLAS[f"Internal jugular vein.{lado_}"]["puntos"], key=lambda p: p[1])
    mejor = None
    acumulado = 0.0
    for a, b in zip(tronco, tronco[1:]):  # por fuerza bruta, con otra fórmula que la de geometria.py
        ab = [b[i] - a[i] for i in range(3)]
        largo2 = sum(v * v for v in ab)
        t = min(1.0, max(0.0, sum((arriba[i] - a[i]) * ab[i] for i in range(3)) / largo2))
        q = [a[i] + ab[i] * t for i in range(3)]
        d = math.dist(arriba, q)
        if mejor is None or d < mejor[0]:
            mejor = (d, q, acumulado + t * math.sqrt(largo2))
        acumulado += math.sqrt(largo2)
    punto, arco = r.foramen(tronco, ANCLAS[f"Internal jugular vein.{lado_}"]["puntos"])
    assert math.dist(punto, mejor[1]) < 1e-9 and abs(arco - mejor[2]) < 1e-9, lado_
assert r.troncos(TRAZOS)["r"][0][1] > r.troncos(TRAZOS)["r"][-1][1], "el tronco debe quedar de arriba abajo"
assert abs(CTX.hiato - 1.24) < 0.002, CTX.hiato  # el hiato está en la lámina del diafragma (y = 1,24)

# 4. Raicilla, positivo: la del fixture y una izquierda construida detrás de Olive.l.
fixture = r.medir_trazos(ANCLAS, TRAZOS, SUP)
assert fixture["Vagus nerve (X).r#t01"]["regla"] == "raicilla"
assert fixture["Vagus nerve (X).r#t01"]["propuesta"] == "no_es_ramo"
izq = uno("Vagus nerve (X).l#t91", [[0.006, 1.576, -0.017], [0.016, 1.571, -0.015]])
assert izq["regla"] == "raicilla" and izq["propuesta"] == "no_es_ramo", izq

# 5. Raicilla, negativo por largo: el mismo extremo superior, pero de 30 mm (sigue en la altura del bulbo).
sup_raicilla = [-0.006, 1.576, -0.017]
largo = r.LARGO_RAICILLA_MAX_MM + 10
largo_30 = uno("Vagus nerve (X).r#t92", [sup_raicilla, [sup_raicilla[0] - 0.316 * largo / 1000,
                                                       sup_raicilla[1] - 0.949 * largo / 1000, sup_raicilla[2]]])
assert abs(largo_30["largo_mm"] - largo) < 0.2, largo_30["largo_mm"]
assert largo_30["regla"] == "sin_regla", largo_30["regla"]
assert largo_30["fallas"] == [{"regla": "raicilla", "no_cumple": [{"condicion": "largo", "mm": -10.0}]}], largo_30["fallas"]

# 6. Raicilla, negativo por oliva: el mismo trazo corto con el extremo superior delante del centro z de la oliva.
delante = uno("Vagus nerve (X).r#t93", [[-0.006, 1.576, 0.005], [-0.016, 1.571, 0.007]])
assert delante["largo_mm"] < r.LARGO_RAICILLA_MAX_MM and delante["regla"] == "sin_regla", delante
assert delante["fallas"] == [{"regla": "raicilla", "no_cumple": [{"condicion": "detras_oliva", "mm": -8.0}]}], delante["fallas"]

# 7. Faríngeo, positivo: origen a DF[0] + 6 mm del foramen y extremo 2 mm detrás de la cara posterior de Laryngopharynx.
fin_faringe = [-0.005, 1.49, ANCLAS["Laryngopharynx"]["caja"][0][2] - 0.002]


def faringeo(d_mm, nombre="Vagus nerve (X).r#t94"):
    return uno(nombre, [desde_foramen("r", d_mm), fin_faringe])


assert desde_foramen("r", DF[0] + 6)[1] > fin_faringe[1]  # el origen está arriba del extremo
f = faringeo(DF[0] + 6)
assert f["regla"] == "faringeo" and f["propuesta"] == "m-pharyngeal-branch-of-vagus-nerve", f

# 7b. El sentido en que viene la línea no cambia el resultado: se orienta de arriba abajo.
al_reves = uno("Vagus nerve (X).r#t89", [fin_faringe, desde_foramen("r", DF[0] + 6)])
assert al_reves["regla"] == "faringeo" and al_reves["cerca_extremos"] == f["cerca_extremos"], al_reves

# 8. Faríngeo, negativos: el único cambio es la distancia al foramen.
for d_mm in (DF[0] - 5, DF[1] + 5):
    otro = faringeo(d_mm)
    assert otro["regla"] != "faringeo" and otro["propuesta"] != "m-pharyngeal-branch-of-vagus-nerve", (d_mm, otro)

# 9. Laríngeo superior: origen dentro de su rango y extremo junto al tiroides, detrás.
fin_tiroides = [-0.005, 1.503, ANCLAS["Thyroid cartilage"]["caja"][0][2] - 0.001]
origen_ls = desde_foramen("r", DL[0] + 5)
assert origen_ls[1] > fin_tiroides[1]
ls = uno("Vagus nerve (X).r#t95", [origen_ls, fin_tiroides])
assert ls["regla"] == "laringeo_superior" and ls["propuesta"] == "m-superior-laryngeal-nerve", ls

# 10. Abdominal: cinco casos, bajo el hiato.
assert CTX.hiato - 1.232 > r.MARGEN_BAJA_MM / 1000
hepatico = uno("Vagus nerve (X).r#t81", [[-0.010, 1.230, -0.010], [-0.0165, 1.19, 0.0]])
assert hepatico["regla"] == "abdominal_hepatico" and hepatico["propuesta"] == "m-hepatic-branches-of-anterior-vagal-trunk", hepatico
anterior_l = uno("Vagus nerve (X).l#t82", [[0.03, 1.230, 0.02], [0.05, 1.17, 0.043]])
assert anterior_l["regla"] == "abdominal_gastrico_anterior", anterior_l
assert anterior_l["propuesta"] == "m-anterior-gastric-branches-of-anterior-vagal-trunk", anterior_l
posterior_r = uno("Vagus nerve (X).r#t83", [[0.03, 1.230, -0.02], [0.05, 1.17, -0.043]])
assert posterior_r["regla"] == "abdominal_gastrico_posterior", posterior_r
assert posterior_r["propuesta"] == "m-posterior-gastric-branches-of-posterior-vagal-trunk", posterior_r
celiaco = uno("Vagus nerve (X).r#t84", [[0.0137, 1.232, -0.045], [0.0137, 1.226, -0.038]])
assert celiaco["regla"] == "abdominal_celiaco" and celiaco["propuesta"] == "m-coeliac-branches-of-posterior-vagal-trunk", celiaco
assert celiaco["cerca_extremos"]["inferior"][0]["pieza"] == "Thoracic aorta"
contrario = uno("Vagus nerve (X).r#t85", [[0.03, 1.230, 0.02], [0.05, 1.17, 0.043]])  # solo cambia el lado
assert contrario["regla"] == "sin_regla" and contrario["propuesta"] is None, contrario
assert contrario["cerca_extremos"]["inferior"][0]["pieza"] == "Stomach"
# Cara y lado no encajan: la regla que se evalúa es la del lado (derecho: posterior) y falla solo por la cara.
assert contrario["fallas"] == [{"regla": "abdominal_gastrico_posterior",
                                "no_cumple": [{"condicion": "cara_estomago", "mm": -43.0}]}], contrario["fallas"]
contrario_p = uno("Vagus nerve (X).l#t87", [[0.03, 1.230, -0.02], [0.05, 1.17, -0.043]])  # cara posterior desde el izquierdo
assert contrario_p["regla"] == "sin_regla" and contrario_p["cerca_extremos"]["inferior"][0]["pieza"] == "Stomach", contrario_p
assert contrario_p["fallas"] == [{"regla": "abdominal_gastrico_anterior",
                                  "no_cumple": [{"condicion": "cara_estomago", "mm": -43.0}]}], contrario_p["fallas"]
# Entre el hígado y el estómago a la misma distancia: sale hepático (empate por nombre) pero con confianza baja.
empate = uno("Vagus nerve (X).r#t88", [[-0.005, 1.230, -0.010], [-0.0075, 1.19, 0.0]])
assert empate["regla"] == "abdominal_hepatico" and empate["confianza"] == "baja", empate
assert [c["pieza"] for c in empate["cerca_extremos"]["inferior"]] == ["Liver", "Stomach"], empate

# 11. Ambiguo: el ramo del cuello que termina lejos de la faringe y del tiroides, cerca de la carótida.
ambiguo = uno("Vagus nerve (X).l#t96", [desde_foramen("l", DF[0] + 6), [0.05, 1.50, 0.02]])
assert ambiguo["regla"] == "sin_regla" and ambiguo["propuesta"] is None and ambiguo["confianza"] is None, ambiguo
assert ambiguo["auditoria"] == "sin candidato", ambiguo
# Una región (el cuello) con dos reglas cercanas: cada una trae sus condiciones que fallan, en el orden de clasificar.
assert [f["regla"] for f in ambiguo["fallas"]] == ["faringeo", "laringeo_superior"], ambiguo["fallas"]
assert [c["condicion"] for c in ambiguo["fallas"][0]["no_cumple"]] == ["mas_cerca_faringe", "cerca_faringe", "cara_posterior_faringe"]
assert [c["condicion"] for c in ambiguo["fallas"][1]["no_cumple"]] == ["bajo_foramen_min", "cerca_tiroides"]
assert all(c["mm"] < 0 for f in ambiguo["fallas"] for c in f["no_cumple"]), ambiguo["fallas"]

# 12. Tronco: más de 200 mm. El faríngeo, corto, no.
assert fixture["Vagus nerve (X).r#t00"]["regla"] == "tronco" and fixture["Vagus nerve (X).r#t00"]["propuesta"] == "no_es_ramo"
assert fixture["Vagus nerve (X).l#t00"]["regla"] == "tronco"
assert fixture["Vagus nerve (X).r#t00"]["largo_mm"] > r.LARGO_TRONCO_MM and f["largo_mm"] < r.LARGO_TRONCO_MM
assert f["regla"] != "tronco" and fixture["Vagus nerve (X).r#t01"]["regla"] != "tronco"

# 12b. Negativos de una sola condición: cada uno cumple todo lo de su regla salvo una cosa y sale sin_regla.
origen_fa = desde_foramen("r", DF[0] + 6)
fin_tiroides_bajo = [-0.005, 1.488, ANCLAS["Thyroid cartilage"]["caja"][0][2] - 0.002]  # debajo de los orígenes de la prueba
atras = ANCLAS["Laryngopharynx"]["caja"][0][2]  # cara posterior de la faringe
tiroides_ant = ANCLAS["Thyroid cartilage"]["caja"][1][2]  # cara anterior del tiroides
SOLO_UNA = {
    "raicilla bajo el foramen": ("Vagus nerve (X).r#t71", [[-0.006, 1.535, -0.017], [-0.016, 1.531, -0.015]]),
    "faríngeo que termina en la cara anterior de la faringe": ("Vagus nerve (X).r#t72", [origen_fa, [-0.005, 1.495, 0.002]]),
    "faríngeo que termina lejos de la faringe": (
        "Vagus nerve (X).r#t73", [origen_fa, [-0.005, 1.49, atras - (r.CERCA_CUELLO_MM + 5) / 1000]]),
    # Atrás del centro de la faringe (z) y a menos de CERCA_CUELLO_MM de ella, pero más cerca del tiroides.
    "faríngeo que termina más cerca del tiroides": (
        "Vagus nerve (X).r#t74", [desde_foramen("r", DF[0] + 1), [0.0, 1.521, -0.0105]]),
    # A menos de CERCA_CUELLO_MM del tiroides, pero más cerca de la faringe.
    "laríngeo superior que termina más cerca de la faringe": (
        "Vagus nerve (X).r#t75", [desde_foramen("r", DL[0] + 5), [-0.005, 1.49, -0.0105]]),
    "raicilla lejos del bulbo": (
        "Vagus nerve (X).r#t70", [[-0.006, 1.58 + (r.CERCA_BULBO_MM + 5) / 1000, -0.017],
                                  [-0.016, 1.58 + (r.CERCA_BULBO_MM + 5) / 1000 - 0.005, -0.015]]),
    "laríngeo superior que termina lejos del tiroides": (
        "Vagus nerve (X).r#t76", [desde_foramen("r", DL[0] + 5),
                                  [-0.005, 1.503, tiroides_ant + (r.CERCA_CUELLO_MM + 5) / 1000]]),
    "laríngeo superior bajo el rango": ("Vagus nerve (X).r#t77", [desde_foramen("r", DL[0] - 5), fin_tiroides_bajo]),
    "laríngeo superior sobre el rango": ("Vagus nerve (X).r#t78", [desde_foramen("r", DL[1] + 5), fin_tiroides_bajo]),
    "hepático que empieza sobre el hiato": ("Vagus nerve (X).r#t79", [[-0.010, CTX.hiato + 0.006, -0.010], [-0.0165, 1.19, 0.0]]),
    "hepático lejos del hígado": (
        "Vagus nerve (X).r#t80", [[-0.045, 1.230, -0.010], [-0.015 - (r.CERCA_ABDOMEN_MM + 5) / 1000, 1.19, 0.0]]),
}
# Lo que reporta `fallas` de cada caso: (regla que lo rompe, condición, margen en mm). La primera fila es de frontera
# de región: el trazo entero queda bajo el foramen (altura media) y no bajo el hiato, así que la raicilla no es la
# más cercana y se reportan las dos del cuello (FRONTERA guarda la condición de la regla rota). El hepático que empieza
# sobre el hiato tiene su altura media bajo el hiato: es abdominal y falla solo por `bajo_hiato`.
ESPERADO = {
    "raicilla bajo el foramen": None,
    "hepático que empieza sobre el hiato": ("abdominal_hepatico", "bajo_hiato", -6.0),
    "faríngeo que termina en la cara anterior de la faringe": ("faringeo", "cara_posterior_faringe", -12.0),
    "faríngeo que termina lejos de la faringe": ("faringeo", "cerca_faringe", -5.0),
    "faríngeo que termina más cerca del tiroides": ("faringeo", "mas_cerca_faringe", -5.5),
    "laríngeo superior que termina más cerca de la faringe": ("laringeo_superior", "mas_cerca_tiroides", -6.0),
    "raicilla lejos del bulbo": ("raicilla", "cerca_bulbo", -5.0),
    "laríngeo superior que termina lejos del tiroides": ("laringeo_superior", "cerca_tiroides", -5.0),
    "laríngeo superior bajo el rango": ("laringeo_superior", "bajo_foramen_min", -5.0),
    "laríngeo superior sobre el rango": ("laringeo_superior", "bajo_foramen_max", -5.0),
    "hepático lejos del hígado": ("abdominal_hepatico", "cerca_destino", -5.0),
}
FRONTERA = {"raicilla bajo el foramen": "sobre_foramen"}
assert set(ESPERADO) == set(SOLO_UNA) and set(FRONTERA) == {d for d, v in ESPERADO.items() if v is None}
for descripcion, (nombre_, control) in SOLO_UNA.items():
    reg = uno(nombre_, control)
    assert reg["regla"] == "sin_regla" and reg["propuesta"] is None, (descripcion, reg["regla"])
    esperado = ESPERADO[descripcion]
    if esperado is None:
        # El trazo cae en la región del cuello: las dos reglas del cuello, sin la condición de frontera de la otra.
        assert [f["regla"] for f in reg["fallas"]] == ["faringeo", "laringeo_superior"], (descripcion, reg["fallas"])
        linea_ = g.orientar_de_arriba_abajo(trazo(*control)["puntos"])
        lado_ = r.lado_de(nombre_)
        conds = r._condiciones_raicilla(lado_, linea_, g.largo(linea_) * 1000, CTX)
        # Aparte, la regla rota falla exactamente por la condición de frontera.
        assert [k for k, _, ok in conds if not ok] == [FRONTERA[descripcion]], (descripcion, conds)
        continue
    regla_, condicion_, mm_ = esperado
    assert [f["regla"] for f in reg["fallas"] if f["regla"] == regla_] == [regla_], (descripcion, reg["fallas"])
    propia = next(f for f in reg["fallas"] if f["regla"] == regla_)
    assert [c["condicion"] for c in propia["no_cumple"]] == [condicion_], (descripcion, propia)
    assert abs(propia["no_cumple"][0]["mm"] - mm_) <= 0.1, (descripcion, propia)
# 12c. La región de `fallas` la decide la altura media del trazo, no un extremo: un trazo que cruza una frontera por menos de
# un milímetro sigue siendo de su región y lista la condición de frontera entre sus fallas.
y_foramen, y_hiato = CTX.foramen["r"][0][1], CTX.hiato
# Raicilla que baja 0,3 mm del foramen (la altura media queda sobre él): es la raicilla y falla también por `sobre_foramen`.
cruza_foramen = uno("Vagus nerve (X).r#t60", [[-0.006, y_foramen + 0.0030, -0.017], [-0.016, y_foramen - 0.0003, -0.015]])
assert cruza_foramen["regla"] == "sin_regla", cruza_foramen
assert [f["regla"] for f in cruza_foramen["fallas"]] == ["raicilla"], cruza_foramen["fallas"]
sobre = [c["mm"] for c in cruza_foramen["fallas"][0]["no_cumple"] if c["condicion"] == "sobre_foramen"]
assert len(sobre) == 1 and -1.0 < sobre[0] < 0, cruza_foramen["fallas"]
# Al revés: casi todo el trazo bajo el foramen y solo la punta 0,3 mm arriba (altura media bajo él): son las del cuello.
punta_foramen = uno("Vagus nerve (X).r#t61", [[-0.006, y_foramen + 0.0003, -0.017], [-0.016, y_foramen - 0.0030, -0.015]])
assert [f["regla"] for f in punta_foramen["fallas"]] == ["faringeo", "laringeo_superior"], punta_foramen["fallas"]
# Hepático que empieza 0,5 mm sobre el hiato (altura media bajo él): es abdominal y falla solo por `bajo_hiato`.
cruza_hiato = uno("Vagus nerve (X).r#t62", [[-0.010, y_hiato + 0.0005, -0.010], [-0.0165, 1.19, 0.0]])
assert cruza_hiato["regla"] == "sin_regla" and cruza_hiato["fallas"] == [
    {"regla": "abdominal_hepatico", "no_cumple": [{"condicion": "bajo_hiato", "mm": -0.5}]}], cruza_hiato["fallas"]
# Casi todo el trazo sobre el hiato y la punta 0,5 mm abajo (altura media sobre él): son las del cuello, no las abdominales.
punta_hiato = uno("Vagus nerve (X).r#t63", [[-0.010, y_hiato + 0.0300, -0.010], [-0.0165, y_hiato - 0.0005, 0.0]])
assert [f["regla"] for f in punta_hiato["fallas"]] == ["faringeo", "laringeo_superior"], punta_hiato["fallas"]

# Control: el hepático de ese tipo, sin el cambio, sí sale hepático.
control_ = uno("Vagus nerve (X).r#t86", [[-0.045, 1.230, -0.010], [-0.0165, 1.19, 0.0]])
assert control_["regla"] == "abdominal_hepatico" and control_["fallas"] is None, control_

# 13. confianza(): el procedimiento de tasks.md, con sus bordes.
dos = [(0.5, "A"), (1.0, "B")]
assert r.confianza("faringeo", [5.0, 9.0], [(0.5, "A"), (1.2, "B")]) == "alta"
assert r.confianza("faringeo", [5.0, 9.0], dos) == "media", "el doble exacto no es más del doble"
assert r.confianza("faringeo", [2.9, 9.0], [(0.5, "A"), (1.2, "B")]) == "baja"
assert r.confianza("faringeo", [3.0, 9.0], [(0.5, "A"), (1.2, "B")]) == "alta", "3,0 mm no es menos de 3 mm"
assert r.confianza("faringeo", [2.9, 9.0], dos) == "baja", "baja gana sobre media"
assert r.confianza("sin_regla", [], dos) is None
assert r.confianza("tronco", [], [(0.5, "A"), (1.2, "B")]) == "alta"

# 14. Un caso de punta a punta por nivel, con medir_trazos.
assert f["confianza"] == "alta", f
plano_medio = [0.0005, 1.575, -0.017]
media = uno("Vagus nerve (X).r#t97", [plano_medio, [plano_medio[0] - 0.0066, plano_medio[1] - 0.0088, plano_medio[2]]])
assert media["regla"] == "raicilla" and media["confianza"] == "media", media
sup_cerca = media["cerca_extremos"]["superior"]
assert {c["pieza"] for c in sup_cerca} == set(r.BULBO) and sup_cerca[0]["mm"] == sup_cerca[1]["mm"], sup_cerca
baja = faringeo(DF[0] + 1.5)
assert baja["regla"] == "faringeo" and baja["confianza"] == "baja", baja
n = r.LARGO_RAICILLA_MAX_MM - 1.5
corta = uno("Vagus nerve (X).r#t98", [plano_medio, [plano_medio[0] - 0.6 * n / 1000, plano_medio[1] - 0.8 * n / 1000,
                                                    plano_medio[2]]])
assert corta["regla"] == "raicilla" and corta["confianza"] == "baja", corta
assert corta["cerca_extremos"]["superior"] == sup_cerca, "mismo extremo superior que el caso media: solo cambia el largo"
# La confianza de la raicilla sale de SU extremo superior (R4.2), no del inferior: el mismo extremo superior que
# el caso media (equidistante de las dos mitades del bulbo) y un extremo inferior que, medido solo, daría alta
# (la oliva está a más del doble de la mitad derecha del bulbo). El nivel que vale es el del superior: media.
dos_extremos = uno("Vagus nerve (X).r#t99", [plano_medio, [-0.0115, 1.570, -0.017]])
assert dos_extremos["regla"] == "raicilla", dos_extremos
inf_cerca = dos_extremos["cerca_extremos"]["inferior"]
assert inf_cerca[1]["mm"] > r.FACTOR_ALTA * inf_cerca[0]["mm"], "el extremo inferior solo daría alta: " + str(inf_cerca)
assert dos_extremos["cerca_extremos"]["superior"] == sup_cerca
assert dos_extremos["confianza"] == "media", dos_extremos

# 15. Esquema del archivo escrito: los trazos del fixture y los de prueba.
casos = {"Vagus nerve (X).l#t91": trazo([0.006, 1.576, -0.017], [0.016, 1.571, -0.015]),
         "Vagus nerve (X).r#t94": trazo(desde_foramen("r", DF[0] + 6), fin_faringe),
         "Vagus nerve (X).r#t81": trazo([-0.010, 1.230, -0.010], [-0.0165, 1.19, 0.0]),
         "Vagus nerve (X).l#t96": trazo(desde_foramen("l", DF[0] + 6), [0.05, 1.50, 0.02])}
todos = {**TRAZOS, **casos}
medidos = r.medir_trazos(ANCLAS, todos, SUP)
CLAVES = ["altura_mm", "auditoria", "cerca_extremos", "confianza", "fallas", "fuente", "largo_mm", "propuesta", "regla"]
with tempfile.TemporaryDirectory() as tmp:
    destino = Path(tmp) / "salida" / "trazos-medidos.json"
    r.escribir_trazos_medidos(medidos, destino)
    leido = json.load(open(destino, encoding="utf-8"))
assert list(leido) == sorted(todos) and len(leido) == len(todos)
for nombre, m in leido.items():
    assert list(m) == CLAVES, (nombre, list(m))
    assert list(m["altura_mm"]) == ["max", "min"] and m["altura_mm"]["max"] >= m["altura_mm"]["min"], nombre
    assert list(m["cerca_extremos"]) == ["inferior", "superior"], nombre
    for extremo, piezas in m["cerca_extremos"].items():
        assert len(piezas) == 2 and all(list(p) == ["mm", "pieza"] for p in piezas), (nombre, extremo)
        assert piezas[0]["mm"] <= piezas[1]["mm"] and all(p["pieza"] in SUP for p in piezas), (nombre, extremo)
    assert m["regla"] in r.REGLAS and m["auditoria"] == r.TEXTO_AUDITORIA[m["regla"]], nombre
    assert m["propuesta"] is None or m["propuesta"] == "no_es_ramo" or m["propuesta"] in MARCADORES, (nombre, m["propuesta"])
    assert (m["confianza"] is None) == (m["propuesta"] is None), nombre
    assert m["confianza"] in (None, "alta", "media", "baja"), nombre
    assert isinstance(m["largo_mm"], float), nombre
    # fallas: null con regla; sin regla, de 1 a 2 reglas con sus condiciones que no se cumplen (mm a 0,1, cero o menos).
    assert (m["fallas"] is None) == (m["regla"] != "sin_regla"), nombre
    for f in m["fallas"] or []:
        assert list(f) == ["no_cumple", "regla"] and f["regla"] in r.REGLAS and f["regla"] not in ("tronco", "sin_regla"), nombre
        assert len(f["no_cumple"]) >= 1, (nombre, f)
        for c in f["no_cumple"]:
            assert list(c) == ["condicion", "mm"] and c["mm"] <= 0 and c["mm"] == round(c["mm"], 1), (nombre, c)
    assert m["fallas"] is None or 1 <= len(m["fallas"]) <= 2, nombre
    mm = [m["largo_mm"], m["altura_mm"]["max"], m["altura_mm"]["min"]] + \
        [p["mm"] for v in m["cerca_extremos"].values() for p in v]
    assert all(v == round(v, 1) for v in mm), (nombre, "las distancias van a 0,1 mm")
assert {m["regla"] for m in leido.values()} >= {"tronco", "raicilla", "faringeo", "abdominal_hepatico", "sin_regla"}
assert any(m["fallas"] for m in leido.values()), "ningún trazo sin regla trae fallas"
assert set(r.PROPUESTA) == set(r.FUENTE) == set(r.TEXTO_AUDITORIA) == set(r.REGLAS)
# Los textos de la columna Propuesta son los que src/data/trazos-vago.json y tests/trazos.test.ts ya usan.
assert r.TEXTO_AUDITORIA == {
    "raicilla": "raicilla (sale del bulbo)", "tronco": "tronco del vago", "faringeo": "candidato: ramo faríngeo",
    "laringeo_superior": "candidato: nervio laríngeo superior", "abdominal_hepatico": "candidato: ramo hepático",
    "abdominal_gastrico_anterior": "candidato: ramo gástrico anterior",
    "abdominal_gastrico_posterior": "candidato: ramo gástrico posterior",
    "abdominal_celiaco": "candidato: ramo celíaco", "sin_regla": "sin candidato"}
assert {v for v in r.PROPUESTA.values() if v not in (None, "no_es_ramo")} <= MARCADORES

# 15b. Las condiciones de cada regla: la misma decisión que antes, partida. `se cumple` es el signo del margen (la cara
# del estómago lo decide por el lado y el signo de dz: su margen es la distancia al centro z, con el signo de si encaja;
# solo un dz exactamente 0 en el lado derecho da margen -0,0 y no se cumple, y los datos de prueba no lo tocan).
claves_vistas = set()
for nombre, datos_ in todos.items():
    linea_ = g.orientar_de_arriba_abajo(datos_["puntos"])
    lado_ = r.lado_de(nombre)
    por_regla = [("raicilla", r._condiciones_raicilla(lado_, linea_, g.largo(linea_) * 1000, CTX)),
                 ("faringeo", r._condiciones_faringeo(lado_, linea_, CTX)),
                 ("laringeo_superior", r._condiciones_laringeo_superior(lado_, linea_, CTX)),
                 r._condiciones_abdominal(lado_, linea_, CTX)]
    for regla_, conds in por_regla:
        for clave_, margen_, ok_ in conds:
            claves_vistas.add(clave_)
            assert ok_ == (margen_ >= 0), (nombre, regla_, clave_, margen_, ok_)
    # Las funciones de siempre dan lo que dan las condiciones.
    assert (r._raicilla(lado_, linea_, g.largo(linea_) * 1000, CTX) is None) == (not all(ok for _, _, ok in por_regla[0][1]))
assert claves_vistas == {"largo", "cerca_bulbo", "detras_oliva", "sobre_foramen", "bajo_foramen_min", "bajo_foramen_max",
                         "mas_cerca_faringe", "cerca_faringe", "cara_posterior_faringe", "mas_cerca_tiroides",
                         "cerca_tiroides", "bajo_hiato", "destino_mas_cercano", "cerca_destino", "cara_estomago"}, claves_vistas

# 16. Cada fuente está en la bibliografía de fuentes.md. Control negativo: una clave inventada no.
assert set(r.FUENTE.values()) <= set(BIB), set(r.FUENTE.values()) - set(BIB)
assert all(m["fuente"] in BIB for m in leido.values())
assert "NoExiste2099" not in BIB

# 17. Determinismo: dos escrituras, los mismos bytes, y el archivo termina en salto de línea.
with tempfile.TemporaryDirectory() as tmp:
    a, b = Path(tmp) / "a" / "uno.json", Path(tmp) / "b" / "dos.json"
    r.escribir_trazos_medidos(r.medir_trazos(ANCLAS, TRAZOS, SUP), a)
    r.escribir_trazos_medidos(r.medir_trazos(ANCLAS, dict(reversed(list(TRAZOS.items()))), SUP), b)
    assert a.read_bytes() == b.read_bytes(), "el archivo cambia con el orden de los trazos"
    assert a.read_bytes().endswith(b"}\n") and b"\r" not in a.read_bytes()

# 18. Si falta una pieza que exigen las reglas, se detiene nombrándola y no escribe nada.
with tempfile.TemporaryDirectory() as tmp:
    destino = Path(tmp) / "trazos-medidos.json"
    for faltante in ("Liver", "Olive.r"):
        incompleto = {k: v for k, v in SUP.items() if k != faltante}
        try:
            r.escribir_trazos_medidos(r.medir_trazos(ANCLAS, TRAZOS, incompleto), destino)
            raise AssertionError(f"debió fallar sin {faltante}")
        except r.FaltaPieza as e:
            assert faltante in str(e), e
        assert not destino.exists(), f"escribió el archivo aunque faltaba {faltante}"
    sin_linea = copy.deepcopy(ANCLAS)
    del sin_linea["Internal jugular vein.r"]["puntos"]
    try:
        r.medir_trazos(sin_linea, TRAZOS, SUP)
        raise AssertionError("debió fallar sin la línea de la yugular")
    except r.FaltaPieza as e:
        assert "Internal jugular vein.r" in str(e), e
    # Control positivo: con todo sí escribe, así el "no escribe" no pasa por construcción.
    r.escribir_trazos_medidos(r.medir_trazos(ANCLAS, TRAZOS, SUP), destino)
    assert destino.exists()

# 19. Informe: la columna Propuesta de cada fila es el auditoria de su registro.
nombres = list(ANCLAS)
md = r.informe(nombres, ANCLAS, [], medidos)
filas = [l for l in md.splitlines() if l.startswith("| Vagus nerve (X).")]
assert [l.split("|")[1].strip() for l in filas] == sorted(medidos)
assert [l.split("|")[5].strip() for l in filas] == [medidos[k]["auditoria"] for k in sorted(medidos)]
assert [l.split("|")[6].strip() for l in filas] == [medidos[k]["regla"] for k in sorted(medidos)]
assert "## Trazos" in md and "| Medulla oblongata.l | presente |" in md
parcial = r.informe(nombres + ["Liver"], {k: v for k, v in ANCLAS.items()}, ["Liver"], None)
assert "| Liver | AUSENTE |" in parcial and "## Trazos" not in parcial
GUION_LARGO = chr(0x2014)
assert GUION_LARGO not in md and GUION_LARGO not in parcial and GUION_LARGO not in texto_reglas

# 20. El fixture de las pruebas de TypeScript es el modelo() de ahora, con las tres anclas nuevas y sin superficies.
fijo = json.load(open(RAIZ / "tests" / "fixtures" / "vago-sintetico" / "anclajes.json", encoding="utf-8"))
assert fijo == json.loads(json.dumps(s.modelo())), "tests/fixtures/vago-sintetico/anclajes.json no se regeneró: python pipeline/pruebas/vago_sintetico.py"
assert {"Olive.l", "Olive.r", "Liver"} <= set(fijo["anclas"])
assert not any("vertices" in a or "superficie" in a for a in fijo["anclas"].values())

# 21. auditar-vago.py mide cada pieza que las reglas exigen (la técnica de probar_generar.py #3, sin importar bpy).
auditar = open(RAIZ / "pipeline" / "auditar-vago.py", encoding="utf-8").read()
faltan = [n for n in r.PIEZAS_SUPERFICIE + r.PIEZAS_LINEA if f'"{n}"' not in auditar]
assert not faltan, f"piezas que las reglas exigen y auditar-vago.py no mide: {faltan}"
assert re.search(r"reglas_vago\.medir_trazos\(", auditar), "auditar-vago.py no llama a las reglas"
assert re.search(r"reglas_vago\.escribir_trazos_medidos\(.*trazos-medidos\.json", auditar), "auditar-vago.py no escribe trazos-medidos.json"

print("reglas_vago.py: pruebas en verde")
