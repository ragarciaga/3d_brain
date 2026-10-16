"""Pruebas de pipeline/reglas-marcadores.yaml (las reglas reales) sin Blender: python pipeline/pruebas/probar_reglas.py
Lee el YAML tal como está, src/data/marcadores.json, src/data/arbol.json, fuentes.md y el inventario de Z-Anatomy.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "pipeline"))
spec = importlib.util.spec_from_file_location("ubicar", RAIZ / "pipeline" / "ubicar-marcadores.py")
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)

DISENO_OPERACIONES = {"extremo", "centro", "polo", "en_curva", "superficie", "plano_medio", "entre"}
DISENO_LADOS = {"medio", "ambos", "l", "r"}
GUION_LARGO = chr(0x2014)

datos = yaml.safe_load(open(RAIZ / "pipeline" / "reglas-marcadores.yaml", encoding="utf-8"))
reglas = datos["marcadores"]
marcadores = json.load(open(RAIZ / "src" / "data" / "marcadores.json", encoding="utf-8"))
arbol = json.load(open(RAIZ / "src" / "data" / "arbol.json", encoding="utf-8"))
fuentes_md = open(RAIZ / "docs" / "research" / "marcadores" / "fuentes.md", encoding="utf-8").read()

# Bibliografía y tabla, con regex propios (no los del ubicador).
cabeza, _, referencias = fuentes_md.partition("\n## Referencias\n")
assert referencias, "fuentes.md no tiene la sección '## Referencias'"
entradas = {m.group(1): m.group(2) for m in re.finditer(r"^- \[([^\]]+)\] (.+)$", referencias, re.M)}
filas = {m.group(1): m.group(0) for m in re.finditer(r"^\| (m-[a-z0-9-]+) \|.*$", cabeza, re.M)}

# Inventario de Z-Anatomy: nombre (primera columna) y tipo (segunda).
inventario = {}
for linea in open(RAIZ / "docs" / "research" / "fase-0" / "inventario-z-anatomy.tsv", encoding="utf-8").read().splitlines()[1:]:
    columnas = linea.split("\t")
    inventario[columnas[0].strip()] = columnas[1].strip()

resueltas = u.validar_reglas(datos)
PRUEBAS = []


def prueba(f):
    PRUEBAS.append(f)
    return f


def recorrer(valor, ruta=""):
    """(ruta, valor) de cada nodo del YAML, en cualquier nivel."""
    yield ruta, valor
    if isinstance(valor, dict):
        for k, v in valor.items():
            yield from recorrer(v, f"{ruta}.{k}")
    elif isinstance(valor, list):
        for i, v in enumerate(valor):
            yield from recorrer(v, f"{ruta}[{i}]")


def es_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


@prueba
def hay_una_regla_por_marcador():
    ids = [m["id"] for m in marcadores]
    assert len(ids) == 26, len(ids)
    assert set(reglas) == set(ids), (set(reglas) ^ set(ids))
    assert set(datos) <= {"referencias", "marcadores"}


@prueba
def sin_coordenadas_escritas_a_mano():
    for ruta, v in recorrer(datos):
        if isinstance(v, list) and len(v) == 3:
            assert not all(es_numero(x) for x in v), f"{ruta}: lista de tres números {v}"


@prueba
def operaciones_y_lados_son_los_del_diseno():
    for ruta, v in recorrer(datos):
        if isinstance(v, dict) and "operacion" in v:
            assert v["operacion"] in DISENO_OPERACIONES, f"{ruta}: {v['operacion']}"
    for id_, r in reglas.items():
        assert r["lado"] in DISENO_LADOS, f"{id_}: lado {r['lado']}"
        assert r["operacion"] in DISENO_OPERACIONES, id_
    # Cada una de las 7 operaciones se usa al menos una vez: si no, la lista del diseño sobra.
    usadas = {v["operacion"] for _, v in recorrer(datos) if isinstance(v, dict) and "operacion" in v}
    assert usadas == DISENO_OPERACIONES, DISENO_OPERACIONES ^ usadas


def tiene_anio_de_publicacion(entrada):
    """Año suelto ("Rev. 2020. PMID ..." o "Título. 2022. https://...") una vez quitados los identificadores
    enteros: el año dentro de un PMID, PMCID, DOI o URL (ruta, consulta o fragmento) no cuenta."""
    sin_identificadores = re.sub(r"PMID \d+|PMCID \S+|DOI \S+|https?://\S+", " ", entrada)
    return bool(re.search(r"(?<![\w/.\-])(?:19|20)\d{2}[.;,]", sin_identificadores))


@prueba
def anio_de_publicacion_no_sale_de_un_identificador():
    # Año solo dentro de una URL (consulta, fragmento, puerto o ruta), un DOI o un PMID: no cuenta.
    for solo_id in ("Autor A. Título. https://ejemplo.org/buscar?anio=2022. Página completa.",
                    "Autor A. Título. https://ejemplo.org/pagina#2022. Página completa.",
                    "Autor A. Título. https://ejemplo.org:2022/pagina. Página completa.",
                    "Autor A. Título. https://ejemplo.org/a/2022/b. Página completa.",
                    "Autor A. Título. DOI 10.2020/2021.2022. PMID 20202020. PMCID PMC2022. Texto completo.",
                    "Autor A. Título. PMID 1999. Texto completo.",
                    "Autor A. Título. DOI 10.1234/abc:2020. Texto completo."):
        assert not tiene_anio_de_publicacion(solo_id), solo_id
    # Control positivo: el año de publicación fuera del identificador sí cuenta, aunque la URL traiga otro.
    for con_anio in ("Autor A. Título. Rev. 2020. PMID 1. Texto completo.",
                     "Autor A. Título. 2022. https://ejemplo.org/buscar?anio=2019. Página completa.",
                     "Autor A. Título. Rev 1999; PMID 5. Texto completo."):
        assert tiene_anio_de_publicacion(con_anio), con_anio


@prueba
def fuentes_registradas_con_identificador_y_en_su_fila():
    for id_, r in reglas.items():
        assert id_ in filas, f"{id_} no tiene fila en la tabla de fuentes.md"
        en_fila = set(re.findall(r"\[([^\]]+)\]", filas[id_].split("|")[5]))
        assert set(r["fuentes"]) == en_fila, f"{id_}: {r['fuentes']} no coincide con la fila {sorted(en_fila)}"
        for clave in r["fuentes"]:
            assert clave in entradas, f"{id_}: [{clave}] no está en ## Referencias"
            assert re.search(r"PMID \d+|DOI 10\.|https?://", entradas[clave]), f"{clave}: sin PMID, DOI ni URL"
            assert tiene_anio_de_publicacion(entradas[clave]), f"{clave}: sin año de publicación"
            assert f"[{clave}]" in filas[id_], f"{id_}: [{clave}] no está en su fila"


@prueba
def textos_bilingues_sin_guion_largo():
    for id_, r in reglas.items():
        for campo in ("metodo", "desacuerdo"):
            if campo in r:
                for idioma in ("es", "en"):
                    t = r[campo][idioma]
                    assert isinstance(t, str) and t.strip(), f"{id_}.{campo}.{idioma} vacío"
                    assert GUION_LARGO not in t, f"{id_}.{campo}.{idioma} tiene guion largo"
    texto = open(RAIZ / "pipeline" / "reglas-marcadores.yaml", encoding="utf-8").read()
    assert GUION_LARGO not in texto
    assert not re.search(r"\bvos\b", texto, re.I), "español de Bogotá: tú, nunca vos"


def parametros_elegidos(regla):
    """Parámetros que eligió quien escribió la regla y que la fuente no da tal cual: milímetros, fracciones,
    umbrales y puntos medios. Cada uno debe quedar marcado "(derivado)" en metodo."""
    for ruta, v in recorrer(regla):
        if isinstance(v, dict):
            if v.get("distancia_mm", 0) != 0:
                yield f"{ruta}.distancia_mm"
            for k in ("mm", "hasta", "fraccion", "max_mm"):
                if k in v:
                    yield f"{ruta}.{k}"
            if v.get("operacion") == "entre":
                yield f"{ruta} (punto medio)"


@prueba
def parametros_elegidos_se_marcan_derivado():
    con_parametros = 0
    for id_, r in reglas.items():
        elegidos = list(parametros_elegidos({k: v for k, v in r.items() if k not in ("metodo", "desacuerdo")}))
        if elegidos:
            con_parametros += 1
            assert "(derivado" in r["metodo"]["es"], f"{id_}: {elegidos} sin '(derivado' en metodo.es"
            assert "(derived" in r["metodo"]["en"], f"{id_}: {elegidos} sin '(derived' en metodo.en"
    assert con_parametros >= 10, con_parametros  # la comprobación no puede quedar vacía
    # Lo contrario no se exige: una regla sin parámetros elegidos puede igual avisar de otra deducción.
    assert list(parametros_elegidos({"operacion": "entre"})) and not list(parametros_elegidos({"operacion": "centro"}))


@prueba
def cautelas_obligatorias():
    def es(i):
        return " ".join(reglas[i]["metodo"]["es"].split())

    def en(i):
        return " ".join(reglas[i]["metodo"]["en"].split())
    assert "no hay malla de oído" in es("m-auricular-branch-of-vagus-nerve")
    assert "el ganglio superior" in es("m-auricular-branch-of-vagus-nerve")
    assert "la fuente no da altura; mismo punto que el asa del recurrente" in es(
        "m-inferior-cervical-cardiac-branches-of-vagus-nerve")
    assert "Node of ligamentum arteriosum" in es("m-recurrent-laryngeal-nerve")
    assert "sustituto del ligamento arterioso" in es("m-recurrent-laryngeal-nerve")
    assert "Ninguna fuente leída usa el término ramos bronquiales; se ubica como el plexo pulmonar" in es(
        "m-bronchial-branches-of-vagus-nerve")
    assert "sobre el tronco del vago escaneado del modelo" in es("m-thoracic-cardiac-branches-of-vagus-nerve").lower()
    assert "Regla aproximada" in es("m-coeliac-branches-of-posterior-vagal-trunk")
    assert "Approximate rule" in en("m-coeliac-branches-of-posterior-vagal-trunk")


@prueba
def deducciones_propias_no_se_atribuyen_a_la_fuente():
    """Lo que fuentes.md marca (derivado) o RIC sigue dicho así en metodo, en español y en inglés. Cada
    entrada: (marcador, fragmento es, fragmento en). Quitar una marca o volver a atribuir a la fuente rompe aquí."""
    def texto(i, idioma):
        return " ".join(reglas[i]["metodo"][idioma].split())
    exigidas = [
        ("m-pharyngeal-branch-of-vagus-nerve", "rango intercuartílico de 2,0 a 3,5 cm", "interquartile range 2.0 to 3.5 cm"),
        ("m-superior-laryngeal-nerve", "rango intercuartílico de 3,3 a 4,8 cm", "interquartile range 3.3 to 4.8 cm"),
        ("m-caerulean-nucleus", "(derivado: la fuente solo dice que el núcleo queda justo debajo del piso",
         "(derived: the source only says the nucleus lies just below the floor"),
        ("m-caerulean-nucleus", "son deducción propia y no una medida de la fuente",
         "are our own deduction and not a measurement from the source"),
        ("m-periaqueductal-grey", "(derivado: la fuente solo dice que la sustancia gris rodea el acueducto",
         "(derived: the source only says the grey matter surrounds the aqueduct"),
        ("m-periaqueductal-grey", "sería deducción propia", "would be our own deduction"),
        ("m-recurrent-laryngeal-nerve", "(derivado: el punto más bajo del asa se calcula como",
         "(derived: the lowest point of the loop is computed as"),
        ("m-recurrent-laryngeal-nerve", "vértice más bajo sobre un rayo hacia abajo", "lowest vertex along a downward ray"),
        ("m-recurrent-laryngeal-nerve", 'esta regla no aplica ese "lateral"', 'this rule does not apply that "lateral"'),
        ("m-superior-cervical-cardiac-branches-of-vagus-nerve", "son deducción propia", "are our own deduction"),
        ("m-thoracic-cardiac-branches-of-vagus-nerve", "son elección de la regla", "are choices of the rule"),
    ]
    for id_, frag_es, frag_en in exigidas:
        assert frag_es in texto(id_, "es"), f"{id_}: metodo.es perdió {frag_es!r}"
        assert frag_en in texto(id_, "en"), f"{id_}: metodo.en perdió {frag_en!r}"
    # Los rangos de Bahadir 2026 son intercuartílicos: nunca un "rango de a a b" sin ese apellido.
    for id_ in ("m-pharyngeal-branch-of-vagus-nerve", "m-superior-laryngeal-nerve"):
        assert not re.search(r"rango de \d", texto(id_, "es")), id_
        assert not re.search(r"(?<!interquartile )range \d", texto(id_, "en")), id_
    # Ninguna regla atribuye a la fuente los milímetros ni el desplazamiento que fuentes.md marca derivados.
    for id_ in ("m-caerulean-nucleus", "m-periaqueductal-grey"):
        for idioma, prohibidos in (("es", ("la fuente dice de 1 a 2 mm", "la fuente admite")),
                                   ("en", ("the source says 1 to 2 mm", "the source also allows"))):
            for p in prohibidos:
                assert p not in texto(id_, idioma), f"{id_}.{idioma}: atribuye a la fuente {p!r}"
    # fuentes.md sigue marcando derivado lo que las reglas dicen derivado.
    assert "(los milímetros son derivados)" in filas["m-caerulean-nucleus"]
    assert "(desplazamiento derivado)" in filas["m-periaqueductal-grey"]
    assert "RIC 2,0 a 3,5" in filas["m-pharyngeal-branch-of-vagus-nerve"]
    assert "RIC 3,3 a 4,8" in filas["m-superior-laryngeal-nerve"]


@prueba
def wernicke_cita_el_desacuerdo():
    d = reglas["m-wernicke-area"]["desacuerdo"]
    for idioma in ("es", "en"):
        for autor in ("Binder", "Matchin", "Tremblay"):
            assert autor in d[idioma], f"{autor} no está en desacuerdo.{idioma}"
    assert reglas["m-wernicke-area"]["lado"] == "l"
    assert "Triantafyllou" in reglas["m-oesophageal-plexus"]["desacuerdo"]["es"]
    assert "McMahon" in reglas["m-coeliac-branches-of-posterior-vagal-trunk"]["desacuerdo"]["en"]


def piezas_de_ancla(ancla):
    """La lógica de piezasDeAncla de src/data/atlas.ts."""
    nodos = arbol["nodos"]

    def bajo(i):
        n = nodos[i]
        return [i] if n["tipo"] == "pieza" else [p for h in n["hijos"] for p in bajo(h)]
    if nodos.get(ancla, {}).get("tipo") == "pieza":
        return [ancla]
    if nodos.get(ancla, {}).get("tipo") == "grupo":
        return bajo(ancla)
    return [i for i, n in nodos.items() if n["tipo"] == "pieza" and n.get("estructura") == ancla]


@prueba
def anclas_tienen_piezas():
    con_ancla = {i: r["ancla"] for i, r in reglas.items() if "ancla" in r}
    for id_, ancla in con_ancla.items():
        assert piezas_de_ancla(ancla), f"{id_}: el ancla {ancla} no tiene piezas en arbol.json"
    # Las anclas que marcadores.json ya tiene no cambian; la única nueva es la del accumbens (design.md:
    # "se agrega donde la regla tiene una pieza principal").
    actuales = {m["id"]: m["ancla"] for m in marcadores if m.get("ancla")}
    assert {i: a for i, a in con_ancla.items() if i in actuales} == actuales, (con_ancla, actuales)
    assert set(con_ancla) - set(actuales) == {"m-nucleus-accumbens"}, set(con_ancla) - set(actuales)
    # Los marcadores del vago no llevan ancla: el vago no se fragmenta.
    assert not [i for i in ("m-jugular-foramen", "m-recurrent-laryngeal-nerve") if "ancla" in reglas[i]]


@prueba
def el_validador_acepta_el_yaml_real():
    assert set(resueltas) == set(reglas)
    for id_, por_lado in resueltas.items():
        esperado = {"ambos": {"l", "r"}}.get(reglas[id_]["lado"], {reglas[id_]["lado"]})
        assert set(por_lado) == esperado, id_


def mallas_en(valor, claves=("malla", "mallas", "curva")):
    nombres = []
    for _, v in recorrer(valor):
        if isinstance(v, dict):
            for k in claves:
                if k in v:
                    nombres += [v[k]] if isinstance(v[k], str) else list(v[k])
    return nombres


def curvas_en(valor):
    """Mallas usadas como `curva` o con `de: linea`."""
    nombres = []
    for _, v in recorrer(valor):
        if isinstance(v, dict):
            if isinstance(v.get("curva"), str):
                nombres.append(v["curva"])
            if v.get("de") == "linea":
                nombres += [v["malla"]] if isinstance(v["malla"], str) else list(v["malla"])
    return nombres


@prueba
def mallas_existen_en_el_inventario():
    total = 0
    for id_, por_lado in resueltas.items():
        for lado, r in por_lado.items():
            for nombre in mallas_en(r):
                assert nombre in inventario, f"{id_} ({lado}): '{nombre}' no está en el inventario de Z-Anatomy"
                total += 1
            for nombre in curvas_en(r):
                assert inventario[nombre] == "CURVE", f"{id_} ({lado}): '{nombre}' se usa como línea pero es {inventario[nombre]}"
            # El ubicador y esta prueba ven las mismas mallas.
            assert sorted(set(mallas_en(r))) == sorted(u.mallas_de_regla(r)), id_
            assert sorted(set(curvas_en(r))) == sorted(u.mallas_con_linea(r)), id_
    assert total > 60, total


@prueba
def lados_resueltos_sin_mezclar():
    for id_, por_lado in resueltas.items():
        for lado, r in por_lado.items():
            sin_textos = {k: v for k, v in r.items() if k not in ("metodo", "desacuerdo")}
            for ruta, v in recorrer(sin_textos):
                if isinstance(v, str):
                    assert "{" not in v and "}" not in v, f"{id_} ({lado}) {ruta}: marca sin resolver en {v!r}"
            if reglas[id_]["lado"] == "ambos":
                otro = "r" if lado == "l" else "l"
                for nombre in mallas_en(r):
                    assert not nombre.endswith(f".{otro}"), f"{id_}: el lado {lado} usa la malla {nombre}"
                    assert not nombre.startswith("Right" if lado == "l" else "Left"), f"{id_}: {nombre} en el lado {lado}"
            assert r["lado"] == lado


def main():
    for f in PRUEBAS:
        f()
        print(f"  ok {f.__name__}")
    print(f"reglas-marcadores.yaml: {len(PRUEBAS)} pruebas en verde")


if __name__ == "__main__":
    main()
