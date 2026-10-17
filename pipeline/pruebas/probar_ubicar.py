"""Pruebas de geometria.py y ubicar-marcadores.py sin Blender, sobre un modelo sintético:
python pipeline/pruebas/probar_ubicar.py            (todas)
python pipeline/pruebas/probar_ubicar.py <nombre>   (una sola)
"""
import contextlib
import copy
import importlib.util
import io
import json
import math
import random
import sys
import tempfile
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "pipeline"))


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


u = cargar("ubicar", RAIZ / "pipeline" / "ubicar-marcadores.py")
assert "bpy" not in sys.modules, "cargar ubicar-marcadores.py no debe importar bpy"
import geometria as g  # noqa: E402  (el mismo módulo que usa el ubicador)

s = cargar("sintetico", RAIZ / "pipeline" / "pruebas" / "modelo_sintetico_marcadores.py")
SINT = s.modelo()
BIB = u.leer_bibliografia()
REGLAS_REALES = yaml.safe_load(open(RAIZ / "pipeline" / "reglas-marcadores.yaml", encoding="utf-8"))

PRUEBAS = []


def prueba(f):
    PRUEBAS.append(f)
    return f


def cerca(a, b, tol=1e-9):
    assert len(a) == len(b) and all(abs(x - y) <= tol for x, y in zip(a, b)), f"{a} != {b}"


def regla(lado="medio", fuentes=("Lee2017",), **kw):
    r = {"lado": lado, "fuentes": list(fuentes), "metodo": {"es": "regla de prueba", "en": "test rule"}}
    r.update(kw)
    return r


def correr(reglas, modelo=SINT, bib=BIB):
    """{id: propuesta} de ubicar() sobre reglas escritas aquí."""
    resueltas = u.validar_reglas({"marcadores": reglas})
    return {p["id"]: p for p in u.ubicar(resueltas, modelo, bib)}


def uno(r, modelo=SINT, bib=BIB):
    return correr({"m-prueba": r}, modelo, bib)["m-prueba"]


IJV = {"operacion": "extremo", "malla": "Internal jugular vein.{lado}", "hacia": "superior", "de": "linea"}


def en_vago(distancia_mm, **extra):
    return regla("ambos", operacion="en_curva", curva="Vagus nerve (X).{lado}", desde=IJV,
                 distancia_mm=distancia_mm, **extra)


def sub_reglas(*ids):
    """Reglas reales del YAML, solo las pedidas, ya expandidas."""
    return {i: copy.deepcopy(REGLAS_REALES["marcadores"][i]) for i in ids}


# Rutas trazadas sintéticas: "x" baja de y = 0,060 a 0,004 cada 8 mm y se acerca al vago izquierdo (x = 0,03).
RUTA_X = [[round(0.08 - (0.06 - y) * 1.0, 6), y, 0.0] for y in (0.060, 0.052, 0.044, 0.036, 0.028, 0.020, 0.012, 0.004)]
# Banda que no toca el modelo sintético (todo está en y >= 0): las dos rutas reales de las reglas existen.
RUTAS_INOCUAS = {
    "bandas": {"izquierdo": (0.0, None), "derecho": (0.0, None)},
    "rutas": {"x": RUTA_X, "vago_toracico_izquierdo": RUTA_X, "vago_toracico_derecho": RUTA_X},
}


def rutas_con(izquierdo=(0.0, None), derecho=(0.0, None)):
    return {**RUTAS_INOCUAS, "bandas": {"izquierdo": izquierdo, "derecho": derecho}}


def archivo_rutas(carpeta, rutas=RUTAS_INOCUAS, nombre="rutas-vago.json"):
    """Escribe un rutas-vago.json mínimo (el formato que lee leer_rutas) con las bandas y rutas dadas."""
    lados = {"izquierdo": "vago_toracico_izquierdo", "derecho": "vago_toracico_derecho"}
    salida = {}
    for id_, puntos in rutas["rutas"].items():
        salida[id_] = {"puntos": puntos}
    for lado, (y_max, y_min) in rutas["bandas"].items():
        salida[lados[lado]] = {"puntos": rutas["rutas"][lados[lado]], "lado": lado,
                               "reemplaza": {"lado": lado, "y_max": y_max, "y_min": y_min}}
    ruta = Path(carpeta) / nombre
    ruta.write_text(json.dumps({"rutas": salida}), encoding="utf-8")
    return ruta


def ErrorUbicacion_con(f, *textos):
    try:
        f()
    except u.ErrorUbicacion as e:
        for t in textos:
            assert t in str(e), f"{t!r} no está en {e}"
        return str(e)
    raise AssertionError("debió lanzar ErrorUbicacion")


# --------------------------------------------------------------------------------------------------
# geometria.py
# --------------------------------------------------------------------------------------------------

@prueba
def geometria_a_gltf():
    assert g.a_gltf((1.0, 2.0, 3.0)) == [1.0, 3.0, -2.0]
    r = g.a_gltf((0.1234567, -1e-7, 2.0000049))
    assert r == [0.12346, 2.0, 0.0], r
    assert math.copysign(1, r[2]) == 1, "el tercer componente no debe ser -0.0"
    ceros = g.a_gltf((0.0, 0.0, 0.0))
    assert all(math.copysign(1, v) == 1 for v in ceros), ceros
    assert all(math.copysign(1, v) == 1 for v in g.redondear([-0.0, -1e-9, 0.0]))


@prueba
def geometria_direcciones():
    assert g.direccion("superior") == (0.0, 1.0, 0.0)
    assert g.direccion("ventral") == g.direccion("anterior") == (0.0, 0.0, 1.0)
    assert g.direccion("dorsal") == g.direccion("posterior") == (0.0, 0.0, -1.0)
    assert g.direccion("lateral", "l") == (1.0, 0.0, 0.0) and g.direccion("lateral", "r") == (-1.0, 0.0, 0.0)
    assert g.direccion("medial", "l") == (-1.0, 0.0, 0.0) and g.direccion("medial", "r") == (1.0, 0.0, 0.0)
    for malo in (("lateral", None), ("medial", "medio"), ("arriba", "l")):
        try:
            g.direccion(*malo)
            raise AssertionError(f"debió rechazar {malo}")
        except ValueError:
            pass


@prueba
def geometria_largo_caja_centro():
    cerca([g.largo([[0, 0, 0], [0.003, 0.004, 0], [0.003, 0.004, 0.012]])], [0.017])
    assert g.largo([[1, 2, 3]]) == 0 and g.largo([]) == 0
    assert g.caja([[0, 1, 2], [3, 0, 5]]) == [[0, 0, 2], [3, 1, 5]]
    cerca(g.centro([[0, 0, 0], [2, 4, 6]]), [1, 2, 3])
    cerca(g.centro(SINT["Prisma"]["vertices"]), [0, 0, 0])


@prueba
def geometria_punto_mas_cercano_y_distancia():
    vs = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
    p, d = g.punto_mas_cercano([0.9, 0.1, 0], vs)
    assert p == [1, 0, 0] and abs(d - math.sqrt(0.02)) < 1e-12
    assert abs(g.distancia_a_superficie([0.9, 0.1, 0], vs) - math.sqrt(0.02)) < 1e-12
    # Empate: gana el menor índice.
    p, d = g.punto_mas_cercano([0.5, 0, 0], [[0, 0, 0], [1, 0, 0]])
    assert p == [0, 0, 0] and d == 0.5
    p, _ = g.punto_mas_cercano([0.5, 0, 0], [[1, 0, 0], [0, 0, 0]])
    assert p == [1, 0, 0]
    try:
        g.punto_mas_cercano([0, 0, 0], [])
        raise AssertionError("debió fallar con lista vacía")
    except ValueError:
        pass


def _bruto(p, vs):
    return g.punto_mas_cercano(p, vs)


@prueba
def geometria_indice_igual_a_fuerza_bruta():
    # Empate exacto entre dos vértices: gana el menor índice, como en la fuerza bruta.
    nube = [[0, 0, 0], [0.002, 0, 0], [0.001, 0.01, 0]]
    i, d = g.Indice(nube).mas_cercano([0.001, 0, 0])
    assert i == 0 and d == 0.001, (i, d)
    al_reves = list(reversed(nube))  # ahora el empate es entre los índices 1 y 2
    i, _ = g.Indice(al_reves).mas_cercano([0.001, 0, 0])
    assert i == 1 and al_reves[i] == [0.002, 0, 0], i
    rng = random.Random(42)
    pts = [[round(rng.uniform(0, 0.05), 6) for _ in range(3)] for _ in range(1500)]
    consultas = [[rng.uniform(-0.02, 0.07) for _ in range(3)] for _ in range(200)]
    consultas += [[1.0, 1.0, 1.0], [-0.5, 0.2, 0.0], [0.025, 0.025, 0.025]]
    prisma = SINT["Prisma"]["vertices"]
    consultas_prisma = [[0.0005, 0.02, 0.0], [0.0, 0.0, 0.0], [0.5, 0.0, 0.0], [0.0215, 0.0, 0.0],
                        [0.02, 0.0205, 0.0205], [-0.0085, 0.0, 0.02]]
    for vs, qs in ((pts, consultas), (prisma, consultas_prisma)):
        idx = g.Indice(vs)
        for q in qs:
            i, d = idx.mas_cercano(q)
            p, db = _bruto(q, vs)
            assert vs[i] == p and d == db, (q, vs[i], p, d, db)
    # La equidistante de dos vértices de la caja gana por índice.
    q = [0.0005, 0.02, 0.0]
    i, d = g.Indice(prisma).mas_cercano(q)
    empatados = [k for k, v in enumerate(prisma) if math.dist(q, v) == d]
    assert len(empatados) >= 2 and i == min(empatados), (i, empatados)
    # Lejos de la malla: sigue siendo exacto.
    lejos = [5.0, 5.0, 5.0]
    assert prisma[g.Indice(prisma).mas_cercano(lejos)[0]] == _bruto(lejos, prisma)[0]


@prueba
def geometria_indice_empate_entre_celdas():
    # Todo en potencias de dos para que el empate sea exacto. Con celdas de 0,5: la consulta está en la celda 0,
    # el índice 1 en la celda -2 (anillo 2) y el índice 0 en la celda 3 (anillo 3). Los dos están a 1,25.
    vs = [[1.5, 0, 0], [-1.0, 0, 0]]
    q = [0.25, 0, 0]
    assert math.dist(q, vs[0]) == math.dist(q, vs[1]) == 1.25
    i, d = g.Indice(vs, celda=0.5).mas_cercano(q)
    assert i == 0 and d == 1.25, (i, d)  # gana el menor índice aunque el otro se vea antes
    assert vs[i] == _bruto(q, vs)[0]


@prueba
def geometria_par_mas_cercano():
    pa, pb, d = g.par_mas_cercano([[0, 0, 0], [0.01, 0, 0]], [[0.012, 0, 0], [0.1, 0, 0]])
    assert pa == [0.01, 0, 0] and pb == [0.012, 0, 0] and abs(d - 0.002) < 1e-12
    # Empate: gana el primero de a.
    pa, pb, d = g.par_mas_cercano([[0, 0, 0], [0.004, 0, 0]], [[0.002, 0, 0]])
    assert pa == [0, 0, 0] and pb == [0.002, 0, 0] and d == 0.002


@prueba
def geometria_extremo_polo_centro():
    cara = s.caja((0, 0, 0), (0.004, 0.002, 0.004))
    cerca(g.extremo(cara, g.direccion("superior")), [0.002, 0.002, 0.002])  # centro de la cara plana
    assert g.extremo([[0, 0, 0], [0, 3, 0], [1, 2, 0]], g.direccion("superior")) == [0, 3, 0]
    assert g.extremo([[0, 1, 0], [2, 1, 0]], g.direccion("superior")) == [0, 1, 0]  # empate: menor índice
    nube = SINT["Nube"]["vertices"]
    assert g.extremo(nube, g.direccion("superior")) == [0, 0.01, 0]
    assert g.extremo(nube, g.direccion("anterior")) == [0, 0, 0.01]
    assert g.polo(nube, [g.direccion("anterior"), g.direccion("superior")]) == [0, 0.008, 0.008]
    try:
        g.polo(nube, [g.direccion("superior"), g.direccion("inferior")])
        raise AssertionError("debió rechazar direcciones que se anulan")
    except ValueError:
        pass


@prueba
def geometria_filtros():
    linea = [[0, y, 0] for y in (0, 1, 2, 3, 4)]
    arriba = g.direccion("superior")
    assert [v[1] for v in g.filtrar_tramo(linea, arriba, 0, 0.5)] == [2, 3, 4]
    assert [v[1] for v in g.filtrar_tramo(linea, arriba, 0.5, 1)] == [0, 1, 2]
    assert len(g.filtrar_tramo([[0, 1, 0], [5, 1, 0]], arriba, 0, 0.1)) == 2  # rango 0: se conservan todos
    assert [v[1] for v in g.filtrar_limite(linea, arriba, [0, 2, 0])] == [2, 3, 4]
    assert [v[1] for v in g.filtrar_limite(linea, g.direccion("inferior"), [0, 2, 0])] == [0, 1, 2]


@prueba
def geometria_curvas():
    linea = [[0, 2, 0], [0, 1, 0], [0, 0, 0]]
    assert g.orientar_de_arriba_abajo(linea) == linea
    assert g.orientar_de_arriba_abajo(list(reversed(linea))) == linea
    assert g.orientar_de_arriba_abajo([[0, 0, 0]]) == [[0, 0, 0]]
    q, sa = g.proyectar_en_polilinea(linea, [1, 0.5, 0])
    cerca(q, [0, 0.5, 0])
    assert abs(sa - 1.5) < 1e-12
    q, sa = g.proyectar_en_polilinea(linea, [0, 5, 0])  # fuera: se acota al extremo
    cerca(q, [0, 2, 0])
    assert sa == 0
    cerca(g.punto_a_distancia(linea, 1.25), [0, 0.75, 0])
    cerca(g.punto_a_distancia(linea, 2.0), [0, 0, 0])
    assert g.punto_a_distancia(linea, -0.1) is None and g.punto_a_distancia(linea, 2.1) is None
    cerca(g.en_curva(linea, [0.1, 1.5, 0], 0.25), [0, 1.25, 0])
    cerca(g.en_curva(linea, [0.1, 1.5, 0], -0.25), [0, 1.75, 0])
    assert g.en_curva(linea, [0.1, 1.5, 0], 5) is None
    cerca(g.en_curva_a_altura(linea, 0.5), [0, 0.5, 0])
    assert g.en_curva_a_altura(linea, 5) is None
    cerca(g.en_curva_a_altura([[0, 2, 0], [1, 0, 0], [2, 2, 0]], 1), [0.5, 1, 0])  # el primer cruce
    cerca(g.en_curva_cerca_de(linea, [[1, 1, 0]]), [0, 1, 0])
    cerca(g.en_curva_cerca_de(linea, [[1, 0.5, 0]]), [0, 1, 0])  # empate con y = 0: gana el primero


@prueba
def geometria_superficie_plano_entre_desplazar():
    vs = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0.01, 0, 3], [0.5, 0, 4]]
    atras, adelante = (0, 0, 1), (0, 0, -1)
    assert g.superficie(vs, [0, 0, 0], atras, 0.003) == [0, 0, 2]  # el más lejano sobre el rayo
    assert g.superficie(vs, [0, 0, 0], atras, 0.02) == [0.01, 0, 3]
    assert g.superficie(vs, [0, 0, 0], adelante, 0.003) == [0, 0, 0]  # solo t >= 0
    assert g.superficie([[0, 0, 1]], [0, 0, 0], adelante) is None
    assert g.superficie([[0.002, 0, 5], [0.001, 0, 5]], [0, 0, 0], atras) == [0.001, 0, 5]  # menor perpendicular
    assert g.superficie([[0.001, 0, 5], [-0.001, 0, 5]], [0, 0, 0], atras) == [0.001, 0, 5]  # menor índice
    assert g.superficie(vs, [0, 0, 1.2]) == [0, 0, 1]  # sin cara: el vértice más cercano
    izq = s.caja((0.001, 0, -0.02), (0.003, 0.004, 0))
    # Dos vértices fuera de la banda (uno lejos del plano medio, otro a otra altura) no deben mover el resultado.
    izq += [[0.01, 0.002, 0.05], [0.002, 0.03, 0.05]]
    der = s.espejo({"vertices": izq})["vertices"]
    cerca(g.plano_medio(izq, der, 0.002, "medio"), [0, 0.002, -0.01])
    cerca(g.plano_medio(izq, der, 0.002, "dorsal"), [0, 0.002, -0.02])
    cerca(g.plano_medio(izq, der, 0.002, "anterior"), [0, 0.002, 0.0])
    assert g.plano_medio(izq, der, 0.5, "medio") is None
    try:
        g.plano_medio(izq, der, 0.002, "superior")
        raise AssertionError("debió rechazar una profundidad que no es anteroposterior")
    except ValueError:
        pass
    cerca(g.entre([1, 1, 1], [3, 5, 7]), [2, 3, 4])
    cerca(g.entre([1, 1, 1], [3, 5, 7], 0.25), [1.5, 2, 2.5])
    cerca(g.desplazar([1, 1, 1], g.direccion("superior"), 0.004), [1, 1.004, 1])


# --------------------------------------------------------------------------------------------------
# Operaciones, por reglas, sobre el modelo sintético
# --------------------------------------------------------------------------------------------------

@prueba
def operaciones_extremo_centro_polo():
    r = correr({
        "e1": regla(operacion="extremo", malla="Nube", hacia="superior"),
        "e2": regla(operacion="extremo", malla="Nube", hacia="anterior"),
        "e3": regla(operacion="extremo", malla="Laryngopharynx", hacia="superior"),  # cara plana: su centro
        "e4": regla("l", operacion="extremo", malla="Internal jugular vein.l", hacia="superior", **{"de": "linea"}),
        "c1": regla(operacion="centro", malla="Fourth ventricle"),
        "p1": regla(operacion="polo", malla="Nube", hacia=["anterior", "superior"]),
    })
    cerca(r["e1"]["posicion"], [0, 0.01, 0])
    cerca(r["e2"]["posicion"], [0, 0, 0.01])
    cerca(r["e3"]["posicion"], [0, 0.06, 0])
    cerca(r["e4"]["posicion"], [0.04, 0.08, 0])  # la línea central de la vena, no su superficie
    cerca(r["c1"]["posicion"], [0, 0.04, -0.008])
    cerca(r["p1"]["posicion"], [0, 0.008, 0.008])


@prueba
def operaciones_tramo_limite_desplazar():
    sin = uno(regla(operacion="centro", malla="Fourth ventricle"))
    tramo = uno(regla(operacion="centro", malla="Fourth ventricle",
                      tramo={"hacia": "superior", "desde": 0, "hasta": 0.5}))
    limite = uno(regla(operacion="centro", malla="Fourth ventricle",
                       limite={"hacia": "izquierda", "de": {"operacion": "centro", "malla": "Fourth ventricle"}}))
    cerca(sin["posicion"], [0, 0.04, -0.008])
    cerca(tramo["posicion"], [0, 0.045, -0.008])  # solo cambió por el tramo
    cerca(limite["posicion"], [0.0025, 0.04, -0.008])  # solo cambió por el límite
    lateral = correr({"m-lat": regla("ambos", operacion="centro", malla="Fourth ventricle",
                                     tramo={"hacia": "lateral", "desde": 0, "hasta": 0.5})})["m-lat"]
    cerca(lateral["posicion"]["l"], [0.0025, 0.04, -0.008])
    cerca(lateral["posicion"]["r"], [-0.0025, 0.04, -0.008])
    base = dict(operacion="extremo", malla="Nube", hacia="superior")
    cerca(uno(regla(**base))["posicion"], [0, 0.01, 0])
    cerca(uno(regla(desplazar={"hacia": "superior", "mm": 4}, **base))["posicion"], [0, 0.014, 0])


@prueba
def operaciones_en_curva_desde_y_orientacion():
    # El vago izquierdo del modelo guarda su línea de abajo arriba: sin orientar, 12,5 mm caería hacia arriba.
    linea_l = SINT["Vagus nerve (X).l"]["linea"]
    assert linea_l[0][1] < linea_l[-1][1], "el modelo debe empezar con la línea izquierda al revés"
    for d, y in ((0, 0.08), (-2.5, 0.0825), (12.5, 0.0675), (26, 0.054)):
        p = uno(en_vago(d))["posicion"]
        assert set(p) == {"l", "r"}, p
        cerca(p["l"], [0.03, y, 0])
        cerca(p["r"], [-0.03, y, 0])  # la derecha va de arriba abajo: el mismo resultado espejado
    assert SINT["Vagus nerve (X).l"]["linea"][0][1] < SINT["Vagus nerve (X).l"]["linea"][-1][1], \
        "ubicar() no debe cambiar el modelo que recibe"


@prueba
def operaciones_en_curva_altura_cerca_de_y_destino():
    altura = {"operacion": "entre",
              "a": {"operacion": "extremo", "malla": "Nube", "hacia": "superior"},
              "b": {"operacion": "extremo", "malla": "Laryngopharynx", "hacia": "superior"}}
    p = uno(regla("ambos", operacion="en_curva", curva="Vagus nerve (X).{lado}", altura=altura))["posicion"]
    cerca(p["l"], [0.03, 0.035, 0])
    cerca(p["r"], [-0.03, 0.035, 0])
    hiato = uno(regla(operacion="en_curva", curva="Oesophagus", cerca_de={"malla": "Diaphragm"}))["posicion"]
    cerca(hiato, [0, 0.03, -0.01])  # empate entre y = 0,03 y 0,02: gana el de arriba
    cerca(uno(regla("ambos", operacion="en_curva", curva="Vagus nerve (X).{lado}",
                    cerca_de={"malla": "Laryngopharynx"}))["posicion"]["r"], [-0.03, 0.06, 0])
    cerca_dest = {"malla": "Laryngopharynx", "max_mm": 5}
    p = uno(en_vago(26, destino=cerca_dest))["posicion"]
    cerca(p["l"], [0.027, 0.054, 0])  # el destino está a 3 mm: el marcador se mueve a él
    cerca(p["r"], [-0.027, 0.054, 0])
    p = uno(en_vago(26, destino={"malla": "Laryngopharynx", "max_mm": 2}))["posicion"]
    cerca(p["l"], [0.03, 0.054, 0])  # a 3 mm y el máximo es 2: se queda en la curva
    p = uno(en_vago(38, destino={"malla": "Thyroid cartilage", "max_mm": 5}))["posicion"]
    cerca(p["l"], [0.03, 0.042, 0])  # destino lejos: se queda en la curva
    cerca(p["r"], [-0.03, 0.042, 0])


@prueba
def operaciones_superficie():
    # Sin cara: el vértice más cercano al punto de referencia.
    ref = {"operacion": "entre", "fraccion": 0.2,
           "a": {"operacion": "extremo", "malla": "Laryngopharynx", "hacia": "superior"},
           "b": {"operacion": "extremo", "malla": "Laryngopharynx", "hacia": "inferior"}}
    cerca(uno(regla(operacion="superficie", malla="Laryngopharynx", cerca_de=ref))["posicion"], [0, 0.06, 0])
    # Con cara, desde dentro de un tubo: la pared anterior (o posterior) del esófago a la altura del hiato.
    hiato = {"operacion": "en_curva", "curva": "Oesophagus", "cerca_de": {"malla": "Diaphragm"}}
    r = correr({
        "m-ant": regla(operacion="superficie", malla="Oesophagus", cerca_de=hiato, cara="anterior"),
        "m-post": regla(operacion="superficie", malla="Oesophagus", cerca_de=hiato, cara="posterior"),
    })
    cerca(r["m-ant"]["posicion"], [0, 0.03, -0.002])
    cerca(r["m-post"]["posicion"], [0, 0.03, -0.018])
    # cerca_de {malla}: el vértice de la malla más cercano a la otra malla.
    cerca(uno(regla(operacion="superficie", malla="Caudate nucleus.l", cerca_de={"malla": "Putamen.l"}))["posicion"],
          [0.01, 0.01, -0.02])
    # Con cara, el rayo sale del vértice de la malla (no del de la otra): desde el caudado posterior baja a sí mismo.
    r = uno(regla(operacion="superficie", malla="Caudate nucleus.l", cerca_de={"malla": "Putamen.l"},
                  cara="inferior", tolerancia_mm=4))
    cerca(r["posicion"], [0.01, 0.01, -0.02])
    # tramo: filtra los vértices candidatos, y el resultado cambia solo por eso.
    por_arriba = {"operacion": "extremo", "malla": "Putamen.l", "hacia": "superior"}
    sin = uno(regla(operacion="superficie", malla="Caudate nucleus.l", cerca_de=por_arriba))
    con = uno(regla(operacion="superficie", malla="Caudate nucleus.l", cerca_de=por_arriba,
                    tramo={"hacia": "inferior", "desde": 0, "hasta": 0.5}))
    cerca(sin["posicion"], [0.01, 0.01, 0.02])
    cerca(con["posicion"], [0.01, 0.003, 0.02])


@prueba
def operaciones_plano_medio_y_entre():
    olivas = {"operacion": "centro", "malla": ["Olive.l", "Olive.r"]}
    mallas = ["Medulla oblongata.l", "Medulla oblongata.r"]
    r = correr({
        "m-medio": regla(operacion="plano_medio", mallas=mallas, altura=olivas, profundidad="medio"),
        "m-dorsal": regla(operacion="plano_medio", mallas=mallas, altura=olivas, profundidad="dorsal"),
    })
    cerca(r["m-medio"]["posicion"], [0, 0.015, -0.01])
    cerca(r["m-dorsal"]["posicion"], [0, 0.015, -0.02])
    ext = lambda h: {"operacion": "extremo", "malla": "Fourth ventricle", "hacia": h}  # noqa: E731
    r = correr({
        "e-medio": regla(operacion="entre", a=ext("izquierda"), b=ext("derecha")),
        "e-cuarto": regla(operacion="entre", a=ext("izquierda"), b=ext("derecha"), fraccion=0.25),
        "e-par": regla("l", operacion="entre", mallas=["Caudate nucleus.l", "Putamen.l"]),
        "e-limite": regla("l", operacion="entre", mallas=["Caudate nucleus.l", "Putamen.l"],
                          limite={"hacia": "anterior",
                                  "de": {"operacion": "extremo", "malla": "Anterior commissure", "hacia": "posterior"}}),
    })
    cerca(r["e-medio"]["posicion"], [0, 0.04, -0.008])
    cerca(r["e-cuarto"]["posicion"], [0.0025, 0.04, -0.008])
    cerca(r["e-par"]["posicion"], [0.01225, 0.009, -0.02])  # el par más cercano es el posterior
    cerca(r["e-limite"]["posicion"], [0.0125, 0.01, 0.02])  # con el límite, el anterior


@prueba
def lados_ambos_medio_l_r():
    modelo = dict(SINT)
    modelo["Left main bronchus"] = s.nube([[0.02, 0, 0], [0.03, 0, 0]])
    modelo["Right main bronchus"] = s.nube([[-0.02, 0, 0], [-0.03, 0, 0]])
    p = uno(regla("ambos", operacion="extremo", malla="{Lado} main bronchus", hacia="lateral"), modelo)["posicion"]
    assert p == {"l": [0.03, 0.0, 0.0], "r": [-0.03, 0.0, 0.0]}, p  # {Lado} da Left y Right
    base = dict(operacion="extremo", malla="Nube", hacia="superior")
    for lado in ("medio", "l", "r"):
        pos = uno(regla(lado, **base))["posicion"]
        assert isinstance(pos, list) and len(pos) == 3, (lado, pos)
    amb = uno(regla("ambos", operacion="extremo", malla="Thalamus.{lado}", hacia="superior"))["posicion"]
    assert set(amb) == {"l", "r"} and all(len(v) == 3 for v in amb.values())
    cerca(amb["l"], [0.015, 0.015, 0])
    cerca(amb["r"], [-0.015, 0.015, 0])


@prueba
def por_lado_mallas_distintas():
    r = regla("ambos", operacion="extremo", malla="Nube", hacia="superior",
              por_lado={"l": {"hacia": "anterior"}, "r": {"malla": "Prisma"}})
    p = uno(r)["posicion"]
    cerca(p["l"], [0, 0, 0.01])  # la izquierda cambia la dirección
    cerca(p["r"], [0, 0.02, 0])  # la derecha cambia la malla


# --------------------------------------------------------------------------------------------------
# Lo que el atlas publica del vago: bandas y rutas (ADR 0010)
# --------------------------------------------------------------------------------------------------

ALTURA_NUBE = {"operacion": "extremo", "malla": "Nube", "hacia": "superior"}  # y = 0,01 m


def en_vago_a_nube(lado, curva):
    return regla(lado, operacion="en_curva", curva=curva, altura=ALTURA_NUBE)


@prueba
def publicar_quita_los_vertices_de_la_banda_de_su_lado():
    original = copy.deepcopy(SINT)
    # Banda de una parte (y_min nulo) en el izquierdo; de dos partes en el derecho.
    pub = u.publicar(SINT, rutas_con(izquierdo=(0.05, None), derecho=(0.07, 0.03)))
    izq = [v[1] for v in pub["Vagus nerve (X).l"]["vertices"]]
    assert izq and min(izq) == 0.05 and max(izq) == 0.1, (min(izq), max(izq))  # el borde exacto se queda
    assert all(v[1] >= 0.05 for v in pub["Vagus nerve (X).l"]["vertices"])
    der = sorted({v[1] for v in pub["Vagus nerve (X).r"]["vertices"]})
    assert 0.07 in der and 0.03 in der, "los bordes de la banda se quedan"
    assert not [y for y in der if 0.03 < y < 0.07], "lo de adentro se quita"
    assert 0.0 in der and 0.1 in der and 0.02 in der and 0.08 in der, "lo de afuera se queda"
    assert pub["Vagus nerve (X).l"]["banda"] == {"lado": "izquierdo", "y_max": 0.05, "y_min": None}
    assert pub["Vagus nerve (X).r"]["banda"] == {"lado": "derecho", "y_max": 0.07, "y_min": 0.03}
    # La línea no cambia, ni las demás mallas, y el modelo de entrada tampoco.
    for n in ("Vagus nerve (X).l", "Vagus nerve (X).r"):
        assert pub[n]["linea"] == SINT[n]["linea"]
    for n in SINT:
        if n not in ("Vagus nerve (X).l", "Vagus nerve (X).r"):
            assert pub[n] is SINT[n], n
    assert SINT == original, "publicar no modifica el modelo de entrada"
    # A 0,5 µm del borde ya es del borde (se queda); a 2 µm de adentro, se quita.
    cerca_borde = {"Vagus nerve (X).l": {"vertices": [[0, 0.05 - 5e-7, 0], [0, 0.05 - 2e-6, 0], [0, 0.06, 0]],
                                          "linea": [[0, 0.06, 0], [0, 0.0, 0]]}}
    assert [v[1] for v in u.publicar(cerca_borde, rutas_con(izquierdo=(0.05, None)))
            ["Vagus nerve (X).l"]["vertices"]] == [0.05 - 5e-7, 0.06]


@prueba
def publicar_agrega_cada_ruta_como_malla_con_linea():
    pub = u.publicar(SINT, RUTAS_INOCUAS)
    assert pub["ruta:x"]["vertices"] == RUTA_X and pub["ruta:x"]["linea"] == RUTA_X
    assert set(pub) - set(SINT) == {"ruta:x", "ruta:vago_toracico_izquierdo", "ruta:vago_toracico_derecho"}
    pub["ruta:x"]["linea"][0][1] = 9.0
    assert RUTA_X[0][1] == 0.06, "la ruta publicada es una copia"


@prueba
def en_curva_sobre_una_ruta_interpola_su_punto():
    pub = u.publicar(SINT, RUTAS_INOCUAS)
    # y = 0,01 queda entre los puntos y = 0,012 y 0,004, a un cuarto del primero.
    p = uno(en_vago_a_nube("l", "ruta:x"), pub)["posicion"]
    cerca(p, [0.03, 0.01, 0.0])
    # Una ruta que no cruza esa altura deja el marcador sin ubicar, con motivo.
    r = uno(regla("l", operacion="en_curva", curva="ruta:x", altura={**ALTURA_NUBE, "hacia": "inferior"}), pub)
    assert r["posicion"] is None and "ruta:x" in r["motivo"], r


@prueba
def cerca_de_con_vago_y_ruta_mide_contra_lo_publicado():
    regla_l = regla("l", operacion="en_curva", curva="ruta:x", cerca_de={"malla": ["Vagus nerve (X).l"]})
    # Sin banda, el punto de la ruta más cercano al vago izquierdo está a y = 0,012; con la banda se quitan sus
    # vértices bajos y el más cercano pasa a y = 0,028.
    cerca(uno(regla_l, u.publicar(SINT, RUTAS_INOCUAS))["posicion"], [0.032, 0.012, 0.0])
    cerca(uno(regla_l, u.publicar(SINT, rutas_con(izquierdo=(0.05, None))))["posicion"], [0.048, 0.028, 0.0])
    # La lista suma los vértices de la ruta: ahora el más cercano es el primero de la propia ruta.
    mixta = regla("l", operacion="en_curva", curva="ruta:x",
                  cerca_de={"malla": ["Vagus nerve (X).l", "ruta:x"]})
    cerca(uno(mixta, u.publicar(SINT, rutas_con(izquierdo=(0.05, None))))["posicion"], RUTA_X[0])


@prueba
def los_vertices_quitados_no_cuentan_para_el_control_de_cinco_milimetros():
    # La línea del vago llega a y = 0 (no se corta), pero su malla publicada empieza en y = 0,05.
    r = regla("l", operacion="extremo", malla="Vagus nerve (X).l", hacia="inferior", de="linea")
    assert uno(r, u.publicar(SINT, RUTAS_INOCUAS))["estado"] == "aproximada"
    ErrorUbicacion_con(lambda: uno(r, u.publicar(SINT, rutas_con(izquierdo=(0.05, None)))),
                       "m-prueba", "50.0 mm", "Vagus nerve (X).l")


@prueba
def en_curva_sobre_el_vago_escaneado_dentro_de_la_banda_detiene():
    curva_l, curva_r = "Vagus nerve (X).l", "Vagus nerve (X).r"
    # Una parte: el punto está en y = 0,01 y la banda llega a 0,05.
    msg = ErrorUbicacion_con(lambda: uno(en_vago_a_nube("l", curva_l), u.publicar(SINT, rutas_con(izquierdo=(0.05, None)))),
                             "m-prueba", "(l)", "izquierdo", "10.0 mm", "ruta:")
    assert "\n" not in msg
    # Dos partes: dentro de (0,005, 0,02) detiene; justo en el borde no.
    ErrorUbicacion_con(lambda: uno(en_vago_a_nube("r", curva_r), u.publicar(SINT, rutas_con(derecho=(0.02, 0.005)))),
                       "m-prueba", "(r)", "derecho", "ruta:")
    for borde in ((0.02, 0.01), (0.01, 0.005)):
        assert uno(en_vago_a_nube("r", curva_r), u.publicar(SINT, rutas_con(derecho=borde)))["estado"] == "aproximada"
    # Fuera de la banda pasa, y la misma regla sobre la ruta del lado nunca pasa por el control.
    assert uno(en_vago_a_nube("l", curva_l), u.publicar(SINT, rutas_con(izquierdo=(0.005, None))))["estado"] == "aproximada"
    assert uno(en_vago_a_nube("l", "ruta:x"), u.publicar(SINT, rutas_con(izquierdo=(0.05, None))))["estado"] == "aproximada"
    # El control mira el punto que da la curva, antes de acercarlo a un destino.
    ErrorUbicacion_con(lambda: uno(regla("l", operacion="en_curva", curva=curva_l, altura=ALTURA_NUBE,
                                         destino={"malla": "Nube", "max_mm": 50}),
                                   u.publicar(SINT, rutas_con(izquierdo=(0.05, None)))), "m-prueba")
    # Las curvas que no son el vago escaneado no llevan control (no tienen banda).
    assert uno(regla("l", operacion="en_curva", curva="Internal jugular vein.l", altura=ALTURA_NUBE),
               u.publicar(SINT, rutas_con(izquierdo=(0.05, None))))["estado"] == "aproximada"


@prueba
def ruta_inexistente_detiene_con_su_nombre():
    pub = u.publicar(SINT, RUTAS_INOCUAS)
    ErrorUbicacion_con(lambda: uno(en_vago_a_nube("l", "ruta:nope"), pub), "m-prueba", "falta la malla 'ruta:nope'")
    ErrorUbicacion_con(lambda: uno(regla("l", operacion="en_curva", curva="ruta:x",
                                         cerca_de={"malla": ["Vagus nerve (X).l", "ruta:nope"]}), pub),
                       "falta la malla 'ruta:nope'")


@prueba
def leer_rutas_lee_bandas_y_rutas_con_el_formato_real():
    real = u.leer_rutas(u.RUTAS)
    assert set(real["bandas"]) == {"izquierdo", "derecho"}
    assert real["bandas"]["izquierdo"][1] is None and real["bandas"]["derecho"][1] is not None
    assert real["bandas"]["derecho"][1] < real["bandas"]["derecho"][0]
    assert {"vago_toracico_izquierdo", "vago_toracico_derecho"} <= set(real["rutas"])
    assert all(len(p) == 3 for p in real["rutas"]["vago_toracico_derecho"])
    with tempfile.TemporaryDirectory() as tmp:
        leida = u.leer_rutas(archivo_rutas(tmp, rutas_con(izquierdo=(0.5, None), derecho=(0.4, 0.2))))
    assert leida["bandas"] == {"izquierdo": (0.5, None), "derecho": (0.4, 0.2)}
    assert leida["rutas"]["x"] == RUTA_X


def _rutas_rechaza(texto, *esperados, contenido=None):
    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(tmp) / "rutas-vago.json"
        if contenido is not None:
            ruta.write_text(contenido if isinstance(contenido, str) else json.dumps(contenido), encoding="utf-8")
        msg = ErrorUbicacion_con(lambda: u.leer_rutas(ruta), *esperados)
        assert "\n" not in msg, "el mensaje es de una línea"
        return msg


@prueba
def leer_rutas_se_detiene_con_un_mensaje_de_una_linea():
    ok = {"puntos": RUTA_X}
    banda = lambda lado, y_max, y_min=None: {**ok, "reemplaza": {"lado": lado, "y_max": y_max, "y_min": y_min}}  # noqa: E731
    _rutas_rechaza("falta", "No existe", "generar-ramas-vago.py")
    _rutas_rechaza("no es json", "no es JSON válido", contenido="{no es json")
    _rutas_rechaza("sin rutas", "no trae el objeto 'rutas'", contenido=[1, 2])
    _rutas_rechaza("sin rutas", "no trae el objeto 'rutas'", contenido={"otra": 1})
    _rutas_rechaza("falta un lado", "falta la banda del vago derecho",
                   contenido={"rutas": {"a": banda("izquierdo", 1.4)}})
    _rutas_rechaza("falta un lado", "falta la banda del vago izquierdo",
                   contenido={"rutas": {"a": banda("derecho", 1.4, 1.3)}})
    _rutas_rechaza("dos del mismo lado", "hay dos bandas del vago izquierdo",
                   contenido={"rutas": {"a": banda("izquierdo", 1.4), "b": banda("izquierdo", 1.3),
                                        "c": banda("derecho", 1.4)}})
    _rutas_rechaza("lado malo", "lado inválido", contenido={"rutas": {"a": banda("medio", 1.4)}})
    _rutas_rechaza("y_max", "y_max inválido", contenido={"rutas": {"a": banda("izquierdo", None)}})
    _rutas_rechaza("y_min", "y_min inválido", contenido={"rutas": {"a": banda("derecho", 1.3, 1.4)}})
    _rutas_rechaza("puntos", "'puntos'", contenido={"rutas": {"a": {"reemplaza": None}}})
    _rutas_rechaza("puntos", "'puntos'", contenido={"rutas": {"a": {"puntos": [[0, 1]]}}})


@prueba
def la_corrida_sin_rutas_se_detiene_con_un_mensaje_de_una_linea():
    import subprocess
    with tempfile.TemporaryDirectory() as tmp:
        reglas = _yaml_reglas(tmp, {"m-bueno": regla(operacion="extremo", malla="Nube", hacia="superior")})
        salida = Path(tmp) / "x" / "y.json"
        r = subprocess.run([sys.executable, "-B", str(RAIZ / "pipeline" / "ubicar-marcadores.py"),
                            "--reglas", str(reglas), "--salida", str(salida), "--rutas", str(Path(tmp) / "no-existe.json")],
                           capture_output=True, text=True)
        assert r.returncode != 0 and "No existe" in r.stderr and "generar-ramas-vago.py" in r.stderr, r.stderr
        assert "Traceback" not in r.stderr and len(r.stderr.strip().splitlines()) == 1, r.stderr
        assert not salida.exists() and not salida.parent.exists()
        # Reglas malas se dicen antes que las rutas: con las dos cosas mal, el error es el de las reglas.
        mala = _yaml_reglas(tmp, {"m-mala": regla(operacion="girar", malla="Nube", hacia="superior")}, "mala.yaml")
        r = subprocess.run([sys.executable, "-B", str(RAIZ / "pipeline" / "ubicar-marcadores.py"),
                            "--reglas", str(mala), "--salida", str(salida), "--rutas", str(Path(tmp) / "no-existe.json")],
                           capture_output=True, text=True)
        assert "m-mala" in r.stderr and "No existe" not in r.stderr, r.stderr


@prueba
def main_aplica_la_banda_y_las_rutas_del_archivo():
    with tempfile.TemporaryDirectory() as tmp:
        pedidos = []

        def leer(nombres):
            pedidos.append(list(nombres))
            return SINT
        reglas = _yaml_reglas(tmp, {"m-ruta": en_vago_a_nube("l", "ruta:x"),
                                    "m-vago": en_vago_a_nube("l", "Vagus nerve (X).l")})
        # Con una banda que no toca el punto, las dos reglas se ubican y a leer_modelo no llega 'ruta:...'.
        sana = archivo_rutas(tmp, rutas_con(izquierdo=(0.005, None)), "sana.json")
        salida = Path(tmp) / "ok.json"
        with contextlib.redirect_stdout(io.StringIO()):
            u.main(["--reglas", str(reglas), "--salida", str(salida), "--rutas", str(sana)], leer_modelo=leer)
        assert len(pedidos) == 1 and set(pedidos[0]) == {"Nube", "Vagus nerve (X).l"}, pedidos  # sin 'ruta:...'
        assert {p["id"]: p["estado"] for p in json.loads(salida.read_text(encoding="utf-8"))} == {
            "m-ruta": "aproximada", "m-vago": "aproximada"}
        # Con la banda sobre el punto, la regla del vago escaneado detiene la corrida y no escribe nada.
        mala = archivo_rutas(tmp, rutas_con(izquierdo=(0.05, None)), "mala.json")
        salida2 = Path(tmp) / "n" / "no.json"
        ErrorUbicacion_con(lambda: u.main(["--reglas", str(reglas), "--salida", str(salida2), "--rutas", str(mala)],
                                          leer_modelo=lambda n: SINT), "m-vago", "(l)", "ruta:")
        assert not salida2.exists() and not salida2.parent.exists()


# --------------------------------------------------------------------------------------------------
# Fallas
# --------------------------------------------------------------------------------------------------

def _yaml_reglas(carpeta, reglas, nombre="reglas.yaml"):
    ruta = Path(carpeta) / nombre
    ruta.write_text(yaml.safe_dump({"marcadores": reglas}, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return ruta


@prueba
def malla_que_falta_detiene_sin_escribir():
    sin_laringo = {k: v for k, v in SINT.items() if k != "Laryngopharynx"}
    with tempfile.TemporaryDirectory() as tmp:
        reglas = _yaml_reglas(tmp, {"m-faringeo": en_vago(26, destino={"malla": "Laryngopharynx", "max_mm": 5})})
        salida = Path(tmp) / "carpeta" / "x.json"
        ErrorUbicacion_con(lambda: u.main(["--reglas", str(reglas), "--salida", str(salida), "--rutas", str(archivo_rutas(tmp))],
                                          leer_modelo=lambda n: sin_laringo), "m-faringeo", "Laryngopharynx")
        assert not salida.exists() and not salida.parent.exists(), "no debe crearse nada"
    # Una curva sin línea central también detiene, con id y malla.
    sin_linea = dict(SINT)
    sin_linea["Vagus nerve (X).l"] = {"vertices": SINT["Vagus nerve (X).l"]["vertices"]}
    ErrorUbicacion_con(lambda: uno(en_vago(0), sin_linea), "m-prueba", "Vagus nerve (X).l")
    # Las reglas reales sobre un modelo sin estómago ni hígado detienen nombrando la malla que falta.
    with tempfile.TemporaryDirectory() as tmp:
        msg = ErrorUbicacion_con(lambda: u.main(["--salida", str(Path(tmp) / "y.json"), "--rutas", str(archivo_rutas(tmp))],
                                                leer_modelo=lambda n: SINT),
                                 "falta la malla")
        assert not (Path(tmp) / "y.json").exists()
        faltante = msg.split("'")[1]
        assert faltante not in SINT, msg


@prueba
def fuente_sin_registrar_deja_sin_ubicar():
    # La regla daría error de 5 mm si se calculara: el marcador debe quedar sin ubicar sin tocar la geometría.
    r = uno(regla(fuentes=("Lee2017", "Inventada2099"), operacion="centro", malla="Prisma"))
    assert r["posicion"] is None and r["estado"] == "sin_ubicar"
    assert "Inventada2099" in r["motivo"] and "Lee2017" not in r["motivo"], r["motivo"]
    assert r["cita"] == {"es": "", "en": ""}
    # Una entrada sin PMID, DOI ni URL tampoco vale.
    bib = {"Sinid2020": "Autor A. Un título sin identificadores. Rev. 2020. Texto completo.", **BIB}
    r = uno(regla(fuentes=("Sinid2020",), operacion="extremo", malla="Nube", hacia="superior"), bib=bib)
    assert r["posicion"] is None and r["estado"] == "sin_ubicar" and "Sinid2020" in r["motivo"], r
    # Una entrada sin año de publicación tampoco vale (R2.1: autores, título, año e identificador).
    bib = {"Sinanio": "Autor A. Un título sin año. https://ejemplo.org/a. Página completa.",
           "Soloid": "Autor A. Un título con DOI 10.2020/2021.2022 y PMID 20202020. Texto completo.", **BIB}
    for clave in ("Sinanio", "Soloid"):
        r = uno(regla(fuentes=(clave,), operacion="extremo", malla="Nube", hacia="superior"), bib=bib)
        assert r["posicion"] is None and r["estado"] == "sin_ubicar" and clave in r["motivo"], r
    assert [u.tiene_anio(e) for e in ("Autor. Rev. 2020. PMID 1.", "Título. 2022. https://x.org/2022/a-2021.",
                                      "Autor. Título. Rev 1999; PMID 5.",
                                      "Autor. Título. 2022. https://x.org/buscar?anio=2019.")] == [True] * 4
    # El año solo en la consulta, el fragmento, el puerto o la ruta de una URL (o en un DOI o PMID) no es el de publicación.
    for solo_id in ("Autor A. Título. https://ejemplo.org/buscar?anio=2022. Página completa.",
                    "Autor A. Título. https://ejemplo.org/pagina#2022. Página completa.",
                    "Autor A. Título. https://ejemplo.org:2022/pagina. Página completa.",
                    "Autor A. Título. https://ejemplo.org/a/2022/b. Página completa.",
                    "Autor A. Título. DOI 10.2020/2021.2022. PMID 20202020. PMCID PMC2022. Texto completo.",
                    "Autor A. Título. PMID 1999. Texto completo.",
                    "Autor A. Título. DOI 10.1234/abc:2020. Texto completo."):
        assert not u.tiene_anio(solo_id), solo_id
        bib = {"Soloquery": solo_id, **BIB}
        r = uno(regla(fuentes=("Soloquery",), operacion="extremo", malla="Nube", hacia="superior"), bib=bib)
        assert r["posicion"] is None and r["estado"] == "sin_ubicar" and "Soloquery" in r["motivo"], r
    # Los demás marcadores de la misma corrida se ubican.
    r = correr({"m-a": regla(fuentes=("Nada1999",), operacion="extremo", malla="Nube", hacia="superior"),
                "m-b": regla(operacion="extremo", malla="Nube", hacia="superior")})
    assert r["m-a"]["posicion"] is None and r["m-b"]["estado"] == "aproximada"


@prueba
def mas_de_cinco_milimetros_detiene():
    msg = ErrorUbicacion_con(lambda: uno(regla(operacion="centro", malla="Prisma")), "m-prueba", " mm", "20.0")
    assert "Prisma" in msg
    base = dict(operacion="extremo", malla="Nube", hacia="superior")
    assert uno(regla(desplazar={"hacia": "superior", "mm": 4}, **base))["estado"] == "aproximada"  # a 4 mm pasa
    ErrorUbicacion_con(lambda: uno(regla(desplazar={"hacia": "superior", "mm": 8}, **base)), "m-prueba", "8.0 mm")
    # El umbral es de 5 mm: 4,95 pasa y 5,05 detiene (el mensaje redondea a un decimal, por eso no se mira la cifra).
    assert uno(regla(desplazar={"hacia": "superior", "mm": 4.95}, **base))["estado"] == "aproximada"
    ErrorUbicacion_con(lambda: uno(regla(desplazar={"hacia": "superior", "mm": 5.05}, **base)), "m-prueba", " mm", "más de 5 mm")
    # Detiene toda la corrida y no escribe nada.
    with tempfile.TemporaryDirectory() as tmp:
        reglas = _yaml_reglas(tmp, {"m-bueno": regla(**base), "m-malo": regla(operacion="centro", malla="Prisma")})
        salida = Path(tmp) / "x" / "y.json"
        ErrorUbicacion_con(lambda: u.main(["--reglas", str(reglas), "--salida", str(salida),
                                           "--rutas", str(archivo_rutas(tmp))],
                                          leer_modelo=lambda n: SINT), "m-malo", " mm")
        assert not salida.exists() and not salida.parent.exists()


@prueba
def sin_punto_queda_sin_ubicar_con_motivo():
    r = uno(en_vago(90))  # más allá del fin de la curva (0,02 + 0,09 > 0,10)
    assert r["posicion"] is None and r["estado"] == "sin_ubicar" and r["motivo"], r
    assert r["cita"]["es"], "con fuente registrada, la cita sí va"
    # Con ambos, si falla un solo lado, el marcador entero queda sin ubicar y el motivo dice cuál.
    parcial = regla("ambos", operacion="en_curva", curva="Vagus nerve (X).{lado}", desde=IJV,
                    distancia_mm=0, por_lado={"r": {"distancia_mm": 90}})
    r = uno(parcial)
    assert r["posicion"] is None and r["estado"] == "sin_ubicar" and "lado r" in r["motivo"], r
    assert "lado l" not in r["motivo"]
    # Un filtro que deja la malla vacía también es sin punto, no un error.
    r = uno(regla(operacion="centro", malla="Nube",
                  limite={"hacia": "superior", "de": {"operacion": "extremo", "malla": "Nube", "hacia": "superior"}}))
    assert r["estado"] == "aproximada"  # el propio extremo queda (>= 0)
    r = uno(regla(operacion="centro", malla="Nube", limite={"hacia": "superior", "de": {
        "operacion": "extremo", "malla": "Prisma", "hacia": "superior"}}))
    assert r["posicion"] is None and r["estado"] == "sin_ubicar", r


@prueba
def campos_de_la_propuesta():
    base = dict(operacion="extremo", malla="Nube", hacia="superior")
    des = {"es": "Hay desacuerdo entre autores.", "en": "Authors disagree."}
    con = uno(regla(ancla="thalamus", desacuerdo=des, **base))
    sin = uno(regla(**base))
    assert con["desacuerdo"] == des and con["ancla"] == "thalamus"
    assert "ancla" not in sin and "desacuerdo" not in sin and "motivo" not in sin
    assert set(sin) == {"id", "posicion", "metodo", "cita", "estado"}, set(sin)
    assert set(con) == {"id", "posicion", "metodo", "cita", "estado", "ancla", "desacuerdo"}
    assert con["metodo"] == {"es": "regla de prueba", "en": "test rule"}
    nula = uno(en_vago(90, ancla="thalamus"))
    assert set(nula) == {"id", "posicion", "metodo", "cita", "estado", "ancla", "motivo"}, set(nula)
    assert nula["posicion"] is None and sin["posicion"] is not None


@prueba
def cita_trae_la_entrada_bibliografica():
    r = uno(regla(fuentes=("Lee2017", "OpenStax20.5"), operacion="extremo", malla="Nube", hacia="superior"))
    for idioma in ("es", "en"):
        c = r["cita"][idioma]
        for t in ("Lee JH", "2017", "PMID 28096728", "DOI 10.3348/kjr.2017.18.1.180", "https://openstax.org/",
                  "Anatomy and Physiology 2e"):
            assert t in c, (t, c)
        for nota in ("Texto completo", "Página completa"):
            assert nota not in c, c
    assert r["cita"]["es"].index("Lee JH") < r["cita"]["es"].index("OpenStax"), "el orden es el de fuentes"


@prueba
def bibliografia_y_notas_de_acceso():
    texto = "\n".join([
        "# Fuentes", "", "| Marcador | Fuente(s) |", "| m-x | [Falsa2000] |", "",
        "- [Fuera2001] Esta línea está antes de la sección. PMID 1. Texto completo.", "",
        "## Referencias", "",
        "- [A2020] Autor A. Título uno. Rev. 2020. PMID 111. Texto completo.",
        "- [B2021.5] Autor B. Título dos. https://ejemplo.org/b. Página completa.",
        "- [C2022] Autor C. Título tres. DOI 10.1000/x. Solo resumen.",
        "- [D2023] Autor D. Título cuatro. Sin identificador. Resumen.",
        "- [E2024] Autor E. Termina distinto. PMID 5.", ""])
    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(tmp) / "fuentes.md"
        ruta.write_text(texto, encoding="utf-8")
        b = u.leer_bibliografia(ruta)
    assert set(b) == {"A2020", "B2021.5", "C2022", "D2023", "E2024"}, set(b)
    assert [u.tiene_identificador(b[k]) for k in sorted(b)] == [True, True, True, False, True]
    assert u.cita_de(b["A2020"]) == "Autor A. Título uno. Rev. 2020. PMID 111."
    assert u.cita_de(b["B2021.5"]).endswith("https://ejemplo.org/b.")
    assert u.cita_de(b["C2022"]).endswith("DOI 10.1000/x.")
    assert u.cita_de(b["D2023"]).endswith("Sin identificador.")
    assert u.cita_de(b["E2024"]) == b["E2024"]
    assert {"Lee2017", "OpenStax20.5", "Galgani2025"} <= set(BIB), "la bibliografía real se lee entera"


@prueba
def mallas_de_regla_en_orden_y_sin_repetir():
    resueltas = u.validar_reglas({"marcadores": {"m-prueba": regla(
        "ambos", operacion="superficie", malla=["Caudate nucleus.{lado}", "Putamen.{lado}"],
        cerca_de={"operacion": "entre", "mallas": ["Caudate nucleus.{lado}", "Putamen.{lado}"],
                  "limite": {"hacia": "anterior",
                             "de": {"operacion": "extremo", "malla": "Anterior commissure", "hacia": "posterior"}}},
        cara="inferior")}})
    assert u.mallas_de_regla(resueltas["m-prueba"]["r"]) == ["Caudate nucleus.r", "Putamen.r", "Anterior commissure"]
    assert u.mallas_con_linea(resueltas["m-prueba"]["l"]) == []
    curva = u.validar_reglas({"marcadores": {"m-c": en_vago(0)}})["m-c"]["l"]
    assert u.mallas_de_regla(curva) == ["Vagus nerve (X).l", "Internal jugular vein.l"]
    assert u.mallas_con_linea(curva) == ["Vagus nerve (X).l", "Internal jugular vein.l"]


# --------------------------------------------------------------------------------------------------
# Archivo de salida
# --------------------------------------------------------------------------------------------------

def _correr_main(carpeta, ids, nombre="salida.json"):
    reglas = _yaml_reglas(carpeta, sub_reglas(*ids))
    salida = Path(carpeta) / nombre
    with contextlib.redirect_stdout(io.StringIO()) as out:
        u.main(["--reglas", str(reglas), "--salida", str(salida), "--rutas", str(archivo_rutas(carpeta))],
               leer_modelo=lambda n: SINT)
    return salida, out.getvalue()


IDS_REALES = ["m-wernicke-area", "m-jugular-foramen", "m-caerulean-nucleus", "m-area-postrema",
              "m-anterior-vagal-trunk", "m-superior-laryngeal-nerve"]


@prueba
def salida_ordenada_y_siempre_aproximada():
    with tempfile.TemporaryDirectory() as tmp:
        salida, texto_consola = _correr_main(tmp, IDS_REALES)
        texto = salida.read_text(encoding="utf-8")
    datos = json.loads(texto)
    assert [p["id"] for p in datos] == sorted(IDS_REALES), "la lista va ordenada por id"
    for p in datos:
        assert p["posicion"] is not None and p["estado"] == "aproximada", p["id"]
        assert set(p["metodo"]) == {"es", "en"} and set(p["cita"]) == {"es", "en"} and p["cita"]["es"]
    assert "validada" not in texto
    assert texto.startswith("[") and texto.endswith("]\n")
    assert "6 marcadores ubicados, 0 sin ubicar" in texto_consola, texto_consola
    por_id = {p["id"]: p for p in datos}
    assert por_id["m-wernicke-area"]["desacuerdo"]["es"] and por_id["m-wernicke-area"]["ancla"]
    assert "ancla" not in por_id["m-jugular-foramen"]


@prueba
def salida_por_defecto_y_opcion_salida():
    assert u.SALIDA_POR_DEFECTO == RAIZ / "pipeline" / "salida" / "marcadores-propuestos.json"
    assert u.REGLAS == RAIZ / "pipeline" / "reglas-marcadores.yaml"
    assert u.FUENTES == RAIZ / "docs" / "research" / "marcadores" / "fuentes.md"
    with tempfile.TemporaryDirectory() as tmp:
        existia = u.SALIDA_POR_DEFECTO.exists()
        salida, _ = _correr_main(tmp, IDS_REALES[:2], "carpeta/nueva.json")
        assert salida.exists() and len(json.loads(salida.read_text(encoding="utf-8"))) == 2
        assert u.SALIDA_POR_DEFECTO.exists() == existia, "con --salida no se toca la ruta por defecto"
    # Sin --salida, main() escribe en SALIDA_POR_DEFECTO: se cambia la constante a una carpeta temporal y se
    # comprueba que el archivo aparece ahí (lo que main() hace de verdad, no solo el valor de la constante).
    original = u.SALIDA_POR_DEFECTO
    with tempfile.TemporaryDirectory() as tmp:
        try:
            u.SALIDA_POR_DEFECTO = Path(tmp) / "defecto" / "propuestos.json"
            reglas = _yaml_reglas(tmp, sub_reglas(*IDS_REALES[:2]))
            with contextlib.redirect_stdout(io.StringIO()) as out:
                u.main(["--reglas", str(reglas), "--rutas", str(archivo_rutas(tmp))], leer_modelo=lambda n: SINT)
            assert u.SALIDA_POR_DEFECTO.exists(), "sin --salida el archivo va a SALIDA_POR_DEFECTO"
            assert len(json.loads(u.SALIDA_POR_DEFECTO.read_text(encoding="utf-8"))) == 2
            assert str(u.SALIDA_POR_DEFECTO) in out.getvalue()
        finally:
            u.SALIDA_POR_DEFECTO = original
    assert u.SALIDA_POR_DEFECTO == original


@prueba
def dos_corridas_dan_los_mismos_bytes():
    with tempfile.TemporaryDirectory() as tmp:
        a, _ = _correr_main(tmp, IDS_REALES, "a.json")
        b, _ = _correr_main(tmp, IDS_REALES, "b.json")
        assert a.read_bytes() == b.read_bytes()
        assert b"\r" not in a.read_bytes(), "saltos de línea \\n también en Windows"


@prueba
def cargar_el_ubicador_no_importa_bpy():
    assert "bpy" not in sys.modules
    nueva = cargar("ubicar2", RAIZ / "pipeline" / "ubicar-marcadores.py")
    assert "bpy" not in sys.modules and hasattr(nueva, "leer_modelo_blender")
    assert "import bpy" not in "".join(
        linea for linea in (RAIZ / "pipeline" / "ubicar-marcadores.py").read_text(encoding="utf-8").splitlines(True)
        if not linea.startswith(" ")), "bpy solo se importa dentro de una función"


# --------------------------------------------------------------------------------------------------
# Esquema
# --------------------------------------------------------------------------------------------------

def _rechaza(reglas, texto=None, crudo=False):
    try:
        u.validar_reglas(reglas if crudo else {"marcadores": reglas})
    except u.ErrorRegla as e:
        if texto is not None:
            assert texto in str(e), f"{texto!r} no está en {e}"
        return str(e)
    raise AssertionError(f"debió rechazar {reglas}")


@prueba
def validar_reglas_rechaza():
    base = dict(operacion="extremo", malla="Nube", hacia="superior")
    u.validar_reglas({"marcadores": {"m-ok": regla(**base)}})
    assert "m-x" in _rechaza({"m-x": regla(**{**base, "operacion": "girar"})}, "operación")
    assert "m-x" in _rechaza({"m-x": regla("centro", **base)}, "lado")
    assert "tres números" in _rechaza({"m-x": regla(punto=[0.1, 0.2, 0.3], **base)})
    assert "tres números" in _rechaza({"m-x": regla(**{**base, "malla": [1, 2, 3]})})
    assert "tres números" in _rechaza({"m-x": regla(**base, desplazar={"hacia": "superior", "mm": [1, 2, 3]})})
    assert "m-x" in _rechaza({"m-x": regla(**base, foo=1)}, "foo")
    assert "m-x" in _rechaza({"m-x": regla("medio", **{**base, "malla": "Thalamus.{lado}"})}, "lado")
    _rechaza({"m-x": regla(**{k: v for k, v in base.items() if k != "hacia"})}, "hacia")
    _rechaza({"m-x": regla("medio", **{**base, "hacia": "lateral"})}, "lateral")
    _rechaza({"m-x": regla("medio", **base, por_lado={"l": {}})}, "por_lado")
    _rechaza({"m-x": regla("ambos", **base, por_lado={"x": {}})}, "por_lado")
    _rechaza({"m-x": {k: v for k, v in regla(**base).items() if k != "fuentes"}}, "fuentes")
    _rechaza({"m-x": {**regla(**base), "metodo": {"es": "solo español"}}}, "metodo")
    _rechaza({"m-x": {**regla(**base), "fuentes": []}}, "fuentes")
    _rechaza({"m-x": regla("l", operacion="en_curva", curva="C", desde=IJV, altura=IJV)}, "exactamente uno")
    _rechaza({"m-x": regla("l", operacion="en_curva", curva="C", altura=IJV, distancia_mm=1)}, "distancia_mm")
    _rechaza({"m-x": regla("l", operacion="entre", a=IJV, b=IJV, fraccion=1.5)}, "fraccion")
    _rechaza({"m-x": regla("l", operacion="entre", a=IJV, b=IJV, mallas=["A", "B"])}, "una de las dos formas")
    _rechaza({"m-x": regla("l", operacion="entre", a=IJV, b=IJV, limite={"hacia": "superior", "de": IJV})}, "limite")
    _rechaza({"m-x": regla(**base, tramo={"hacia": "superior", "desde": 0.8, "hasta": 0.2})}, "tramo")
    _rechaza({"m-x": regla(**base, desplazar={"hacia": "superior", "mm": 500})}, "desplazar")
    _rechaza({"m-x": regla(operacion="superficie", malla="A", cerca_de={"malla": "B", "otra": 1})}, "cerca_de")
    _rechaza({"m-x": regla("l", operacion="plano_medio", mallas=["A"], altura=IJV, profundidad="medio")}, "mallas")
    _rechaza({"m-x": regla("l", operacion="plano_medio", mallas=["A", "B"], altura=IJV, profundidad="superior")},
             "profundidad")
    _rechaza({"marcadores": {}, "extra": 1}, "extra", crudo=True)
    _rechaza({"referencias": {}}, "marcadores", crudo=True)
    # Una referencia anidada no admite claves de regla.
    _rechaza({"m-x": regla("l", operacion="en_curva", curva="C", desde={**IJV, "fuentes": ["Lee2017"]})}, "fuentes")


@prueba
def linea_de_comandos_con_reglas_malas_sale_con_mensaje():
    import subprocess
    with tempfile.TemporaryDirectory() as tmp:
        mala = _yaml_reglas(tmp, {"m-mala": regla(operacion="girar", malla="Nube", hacia="superior")})
        salida = Path(tmp) / "x" / "y.json"
        r = subprocess.run([sys.executable, "-B", str(RAIZ / "pipeline" / "ubicar-marcadores.py"),
                            "--reglas", str(mala), "--salida", str(salida)], capture_output=True, text=True)
        assert r.returncode != 0 and "m-mala" in r.stderr and "operación" in r.stderr, (r.returncode, r.stderr)
        assert "Traceback" not in r.stderr, "el error de reglas se dice en una línea, sin traza"
        assert not salida.exists() and not salida.parent.exists()


@prueba
def validar_reglas_resuelve_lados():
    r = u.validar_reglas({"marcadores": {
        "m-a": regla("ambos", operacion="extremo", malla="Thalamus.{lado}", hacia="superior"),
        "m-b": regla("l", operacion="extremo", malla="Thalamus.{lado}", hacia="lateral"),
        "m-c": regla("medio", operacion="extremo", malla="Nube", hacia="superior"),
    }})
    assert set(r["m-a"]) == {"l", "r"} and r["m-a"]["r"]["malla"] == "Thalamus.r"
    assert set(r["m-b"]) == {"l"} and set(r["m-c"]) == {"medio"}
    assert "{lado}" not in json.dumps(r["m-a"]) and "{Lado}" not in json.dumps(r["m-a"])


# --------------------------------------------------------------------------------------------------
# Las reglas reales sobre el modelo sintético
# --------------------------------------------------------------------------------------------------

@prueba
def reglas_reales_sobre_el_sintetico():
    esperado = {
        "m-jugular-foramen": {"l": [0.03, 0.08, 0], "r": [-0.03, 0.08, 0]},
        "m-superior-ganglion-of-vagus-nerve": {"l": [0.03, 0.0825, 0], "r": [-0.03, 0.0825, 0]},
        "m-auricular-branch-of-vagus-nerve": {"l": [0.03, 0.0825, 0], "r": [-0.03, 0.0825, 0]},
        "m-inferior-ganglion-of-vagus-nerve": {"l": [0.03, 0.0675, 0], "r": [-0.03, 0.0675, 0]},
        "m-pharyngeal-branch-of-vagus-nerve": {"l": [0.027, 0.054, 0], "r": [-0.027, 0.054, 0]},
        "m-superior-laryngeal-nerve": {"l": [0.03, 0.042, 0], "r": [-0.03, 0.042, 0]},
        "m-caerulean-nucleus": {"l": [0.005, 0.045, -0.0065], "r": [-0.005, 0.045, -0.0065]},
        "m-anterior-nuclei-of-thalamus": {"l": [0.015, 0.012, 0.012], "r": [-0.015, 0.012, 0.012]},
        "m-nucleus-accumbens": {"l": [0.01, 0.003, 0.02], "r": [-0.01, 0.003, 0.02]},
        "m-raphe-nuclei-of-medulla-oblongata": [0, 0.015, -0.01],
        "m-area-postrema": [0, 0.03, -0.02],
        "m-periaqueductal-grey": [0, 0.065, -0.01],
        "m-anterior-vagal-trunk": [0, 0.03, -0.002],
        "m-posterior-vagal-trunk": [0, 0.03, -0.018],
        "m-wernicke-area": [0.045, 0.002, 0.0],
    }
    resueltas = u.validar_reglas({"marcadores": sub_reglas(*esperado)})
    props = {p["id"]: p for p in u.ubicar(resueltas, SINT, BIB)}
    assert set(props) == set(esperado)
    for id_, pos in esperado.items():
        p = props[id_]["posicion"]
        assert props[id_]["estado"] == "aproximada", id_
        if isinstance(pos, dict):
            assert set(p) == {"l", "r"}, id_
            for lado in ("l", "r"):
                cerca(p[lado], pos[lado])
        else:
            cerca(p, pos)
    # Los marcadores de lado no se mezclan: cada lado cae del suyo del cuerpo.
    for id_ in ("m-jugular-foramen", "m-caerulean-nucleus", "m-anterior-nuclei-of-thalamus"):
        assert props[id_]["posicion"]["l"][0] > 0 > props[id_]["posicion"]["r"][0], id_


# --------------------------------------------------------------------------------------------------

def main():
    elegidas = sys.argv[1:]
    for f in PRUEBAS:
        if elegidas and f.__name__ not in elegidas:
            continue
        f()
        print(f"  ok {f.__name__}")
    if elegidas:
        return
    print(f"ubicar-marcadores.py: {len(PRUEBAS)} pruebas en verde")


if __name__ == "__main__":
    main()
