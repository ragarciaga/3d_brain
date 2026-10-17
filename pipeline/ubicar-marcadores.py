"""Ubica los marcadores del atlas con reglas anatómicas (spec 04, ADR 0013).

Lee pipeline/reglas-marcadores.yaml (una regla por marcador, sin coordenadas escritas a mano), las mallas
con nombre del modelo de Z-Anatomy y la bibliografía de docs/research/marcadores/fuentes.md. Escribe la
posición propuesta de cada marcador en pipeline/salida/marcadores-propuestos.json (glTF: Y arriba, +X a la
izquierda, +Z anterior, metros). No toca src/data: aplicar las propuestas es otro paso (scripts/aplicar-marcadores.ts).

Uso: python pipeline/ubicar-marcadores.py [--salida RUTA] [--reglas RUTA] [--fuentes RUTA] [--rutas RUTA]
     (o blender -b --python pipeline/ubicar-marcadores.py -- --salida RUTA)

Mide contra lo que el atlas publica del vago (ADR 0010, ADR 0013): lee public/modelos/rutas-vago.json, quita de
`Vagus nerve (X).l/.r` los vértices que caen en la banda `reemplaza` de su lado y ofrece cada ruta trazada como
la curva `ruta:<id>`. Un `en_curva` sobre el vago escaneado cuyo punto cae dentro de la banda detiene la corrida.
Corre después de pipeline/generar-ramas-vago.py, que escribe ese archivo.

`bpy` solo se importa dentro de leer_modelo_blender: las pruebas corren sin Blender con un modelo sintético.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geometria as g  # noqa: E402
from comun import RAIZ, abrir_blend, argumentos  # noqa: E402

REGLAS = RAIZ / "reglas-marcadores.yaml"
FUENTES = RAIZ.parent / "docs/research/marcadores/fuentes.md"
SALIDA_POR_DEFECTO = RAIZ / "salida" / "marcadores-propuestos.json"
RUTAS = RAIZ.parent / "public" / "modelos" / "rutas-vago.json"  # igual que RUTAS_PUBLICADAS en extraer.py
PREFIJO_RUTA = "ruta:"  # una malla `ruta:<id>` es la ruta trazada <id> de rutas-vago.json
VAGO_LADO = {"Vagus nerve (X).l": "izquierdo", "Vagus nerve (X).r": "derecho"}  # vago escaneado y lado de su banda
EPS_PLANO = 1e-6  # el mismo borde que extraer.cortar_banda: a menos de 1 µm de un plano de corte es del borde
MAX_DISTANCIA = 0.005  # 5 mm: un punto más lejos de todas las mallas de su regla detiene la corrida
OPERACIONES = ("extremo", "centro", "polo", "en_curva", "superficie", "plano_medio", "entre")
LADOS = ("medio", "ambos", "l", "r")
NOTAS_ACCESO = ("Texto completo.", "Solo resumen.", "Página completa.", "Resumen.")

CLAVES_REGLA = {"lado", "operacion", "fuentes", "metodo", "ancla", "desacuerdo", "por_lado", "desplazar"}
# Parámetros por operación: (obligatorios, opcionales).
PARAMETROS = {
    "extremo": ({"malla", "hacia"}, {"de", "tramo", "limite"}),
    "centro": ({"malla"}, {"tramo", "limite"}),
    "polo": ({"malla", "hacia"}, {"tramo", "limite"}),
    "en_curva": ({"curva"}, {"desde", "altura", "cerca_de", "distancia_mm", "destino"}),
    "superficie": ({"malla", "cerca_de"}, {"cara", "tolerancia_mm", "tramo", "limite"}),
    "plano_medio": ({"mallas", "altura", "profundidad"}, set()),
    "entre": (set(), {"a", "b", "mallas", "fraccion", "limite"}),
}
PROFUNDIDADES = ("medio", "anterior", "posterior", "ventral", "dorsal")
MARCA_LADO = re.compile(r"\{[Ll]ado\}")
LLAVES = re.compile(r"[{}]")
BIBLIOGRAFIA = re.compile(r"^- \[([^\]]+)\] (.+)$")
IDENTIFICADOR = re.compile(r"PMID \d+|DOI 10\.|https?://")
# Identificadores de la entrada, enteros: el año que lleven dentro (PMID, PMCID, DOI, ruta, consulta o
# fragmento de una URL) no es el de publicación. tiene_anio busca el año después de quitarlos.
TOKENS_IDENTIFICADOR = re.compile(r"PMID \d+|PMCID \S+|DOI \S+|https?://\S+")
# Año de publicación: cuatro cifras sueltas en lo que queda de la entrada.
ANIO = re.compile(r"(?<![\w/.\-])(?:19|20)\d{2}(?![\w/\-])")


class ErrorRegla(Exception):
    """El YAML no cumple el esquema."""


class ErrorUbicacion(Exception):
    """Falta una malla del modelo, o un punto queda a más de 5 mm de las mallas de su regla."""


class _SinPunto(Exception):
    """La geometría no da punto: el marcador queda sin_ubicar con motivo."""


# --------------------------------------------------------------------------------------------------
# Esquema del YAML
# --------------------------------------------------------------------------------------------------

def _es_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def _sin_coordenadas(id_, valor, donde="regla"):
    """Ninguna lista de tres números en ningún nivel: las posiciones salen de las mallas, no del YAML."""
    if isinstance(valor, dict):
        for k, v in valor.items():
            _sin_coordenadas(id_, v, f"{donde}.{k}")
    elif isinstance(valor, list):
        if len(valor) == 3 and all(_es_numero(v) for v in valor):
            raise ErrorRegla(f"{id_}: {donde} es una lista de tres números (una coordenada escrita a mano)")
        for v in valor:
            _sin_coordenadas(id_, v, donde)


def _texto(id_, v, donde):
    if not isinstance(v, str) or not v.strip():
        raise ErrorRegla(f"{id_}: {donde} debe ser un texto no vacío")
    return v


def _nombres(id_, v, donde, cantidad=None):
    nombres = [v] if isinstance(v, str) else v
    if not isinstance(nombres, list) or not nombres:
        raise ErrorRegla(f"{id_}: {donde} debe ser un nombre de malla o una lista de nombres")
    for n in nombres:
        _texto(id_, n, donde)
    if cantidad is not None and (isinstance(v, str) or len(nombres) != cantidad):
        raise ErrorRegla(f"{id_}: {donde} debe ser una lista de {cantidad} mallas")
    return nombres


def _numero(id_, v, donde, minimo, maximo):
    if not _es_numero(v) or not minimo <= v <= maximo:
        raise ErrorRegla(f"{id_}: {donde} debe ser un número entre {minimo} y {maximo}")


def _direccion(id_, v, lado, donde):
    try:
        g.direccion(v, lado if lado in ("l", "r") else None)
    except (ValueError, TypeError) as e:
        raise ErrorRegla(f"{id_}: {donde}: {e}") from None


def _exacto(id_, d, obligatorias, opcionales, donde):
    if not isinstance(d, dict):
        raise ErrorRegla(f"{id_}: {donde} debe ser un mapa")
    falta = set(obligatorias) - set(d)
    sobra = set(d) - set(obligatorias) - set(opcionales)
    if falta:
        raise ErrorRegla(f"{id_}: {donde} no trae {sorted(falta)}")
    if sobra:
        raise ErrorRegla(f"{id_}: {donde} trae claves desconocidas {sorted(sobra)}")


def _validar_filtros(id_, s, lado, donde):
    if "tramo" in s:
        t = s["tramo"]
        _exacto(id_, t, {"hacia", "desde", "hasta"}, set(), f"{donde}.tramo")
        _direccion(id_, t["hacia"], lado, f"{donde}.tramo.hacia")
        _numero(id_, t["desde"], f"{donde}.tramo.desde", 0, 1)
        _numero(id_, t["hasta"], f"{donde}.tramo.hasta", 0, 1)
        if t["desde"] > t["hasta"]:
            raise ErrorRegla(f"{id_}: {donde}.tramo: desde es mayor que hasta")
    if "limite" in s:
        lim = s["limite"]
        _exacto(id_, lim, {"hacia", "de"}, set(), f"{donde}.limite")
        _direccion(id_, lim["hacia"], lado, f"{donde}.limite.hacia")
        _validar_operacion(id_, lim["de"], lado, f"{donde}.limite.de")


def _validar_operacion(id_, s, lado, donde):
    """Valida una operación (el cuerpo de una regla sin sus claves de regla, o una referencia anidada)."""
    if not isinstance(s, dict):
        raise ErrorRegla(f"{id_}: {donde} debe ser un mapa con 'operacion'")
    op = s.get("operacion")
    if op not in OPERACIONES:
        raise ErrorRegla(f"{id_}: {donde}: operación desconocida {op!r}; las válidas son {list(OPERACIONES)}")
    obligatorias, opcionales = PARAMETROS[op]
    _exacto(id_, {k: v for k, v in s.items() if k != "operacion"}, obligatorias, opcionales, f"{donde} ({op})")
    if "malla" in s:
        _nombres(id_, s["malla"], f"{donde}.malla")
    _validar_filtros(id_, s, lado, donde)
    if op == "extremo":
        _direccion(id_, s["hacia"], lado, f"{donde}.hacia")
        if "de" in s and s["de"] != "linea":
            raise ErrorRegla(f"{id_}: {donde}.de solo puede ser 'linea'")
    elif op == "polo":
        hacia = s["hacia"]
        if not isinstance(hacia, list) or not hacia:
            raise ErrorRegla(f"{id_}: {donde}.hacia debe ser una lista de direcciones")
        for h in hacia:
            _direccion(id_, h, lado, f"{donde}.hacia")
    elif op == "en_curva":
        _texto(id_, s["curva"], f"{donde}.curva")
        modos = [k for k in ("desde", "altura", "cerca_de") if k in s]
        if len(modos) != 1:
            raise ErrorRegla(f"{id_}: {donde} necesita exactamente uno de desde, altura o cerca_de, trae {modos}")
        if "distancia_mm" in s:
            if modos[0] != "desde":
                raise ErrorRegla(f"{id_}: {donde}.distancia_mm solo va con 'desde'")
            _numero(id_, s["distancia_mm"], f"{donde}.distancia_mm", -1000, 1000)
        if "desde" in s:
            _validar_operacion(id_, s["desde"], lado, f"{donde}.desde")
        if "altura" in s:
            _validar_operacion(id_, s["altura"], lado, f"{donde}.altura")
        if "cerca_de" in s:
            _exacto(id_, s["cerca_de"], {"malla"}, set(), f"{donde}.cerca_de")
            _nombres(id_, s["cerca_de"]["malla"], f"{donde}.cerca_de.malla")
        if "destino" in s:
            _exacto(id_, s["destino"], {"malla", "max_mm"}, set(), f"{donde}.destino")
            _nombres(id_, s["destino"]["malla"], f"{donde}.destino.malla")
            _numero(id_, s["destino"]["max_mm"], f"{donde}.destino.max_mm", 0, 50)
    elif op == "superficie":
        cerca = s["cerca_de"]
        if isinstance(cerca, dict) and "operacion" not in cerca:
            _exacto(id_, cerca, {"malla"}, set(), f"{donde}.cerca_de")
            _nombres(id_, cerca["malla"], f"{donde}.cerca_de.malla")
        else:
            _validar_operacion(id_, cerca, lado, f"{donde}.cerca_de")
        if "cara" in s:
            _direccion(id_, s["cara"], lado, f"{donde}.cara")
        if "tolerancia_mm" in s:
            _numero(id_, s["tolerancia_mm"], f"{donde}.tolerancia_mm", 0.001, 50)
    elif op == "plano_medio":
        _nombres(id_, s["mallas"], f"{donde}.mallas", 2)
        _validar_operacion(id_, s["altura"], lado, f"{donde}.altura")
        if s["profundidad"] not in PROFUNDIDADES:
            raise ErrorRegla(f"{id_}: {donde}.profundidad debe ser una de {list(PROFUNDIDADES)}")
    elif op == "entre":
        por_ab = "a" in s or "b" in s
        if por_ab == ("mallas" in s):
            raise ErrorRegla(f"{id_}: {donde} necesita a y b, o mallas (una de las dos formas)")
        if por_ab:
            if not ("a" in s and "b" in s):
                raise ErrorRegla(f"{id_}: {donde} necesita a y b juntos")
            if "limite" in s:
                raise ErrorRegla(f"{id_}: {donde}.limite solo va con mallas")
            _validar_operacion(id_, s["a"], lado, f"{donde}.a")
            _validar_operacion(id_, s["b"], lado, f"{donde}.b")
        else:
            _nombres(id_, s["mallas"], f"{donde}.mallas", 2)
        if "fraccion" in s:
            _numero(id_, s["fraccion"], f"{donde}.fraccion", 0, 1)


def _sustituir(valor, lado):
    """Copia profunda cambiando {lado} por l/r y {Lado} por Left/Right en los textos."""
    if isinstance(valor, str):
        return valor.replace("{lado}", lado).replace("{Lado}", "Left" if lado == "l" else "Right")
    if isinstance(valor, dict):
        return {k: _sustituir(v, lado) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_sustituir(v, lado) for v in valor]
    return valor


def _hay_texto(valor, patron):
    if isinstance(valor, str):
        return bool(patron.search(valor))
    if isinstance(valor, dict):
        return any(_hay_texto(v, patron) for v in valor.values())
    if isinstance(valor, list):
        return any(_hay_texto(v, patron) for v in valor)
    return False


def _texto_es_en(id_, v, donde):
    _exacto(id_, v, {"es", "en"}, set(), donde)
    _texto(id_, v["es"], f"{donde}.es")
    _texto(id_, v["en"], f"{donde}.en")


def _validar_regla(id_, regla):
    """Devuelve {lado: regla resuelta} de una regla ya leída."""
    if not isinstance(id_, str) or not isinstance(regla, dict):
        raise ErrorRegla(f"{id_}: la regla debe ser un mapa")
    _sin_coordenadas(id_, regla)
    for k in ("lado", "operacion", "fuentes", "metodo"):
        if k not in regla:
            raise ErrorRegla(f"{id_}: la regla no trae '{k}'")
    lado = regla["lado"]
    if lado not in LADOS:
        raise ErrorRegla(f"{id_}: lado {lado!r} no es uno de {list(LADOS)}")
    fuentes = regla["fuentes"]
    if not isinstance(fuentes, list) or not fuentes:
        raise ErrorRegla(f"{id_}: fuentes debe ser una lista no vacía")
    for f in fuentes:
        _texto(id_, f, "fuentes")
    _texto_es_en(id_, regla["metodo"], "metodo")
    if "desacuerdo" in regla:
        _texto_es_en(id_, regla["desacuerdo"], "desacuerdo")
    if "ancla" in regla:
        _texto(id_, regla["ancla"], "ancla")
    if "desplazar" in regla:
        d = regla["desplazar"]
        _exacto(id_, d, {"hacia", "mm"}, set(), "desplazar")
        _numero(id_, d["mm"], "desplazar.mm", -50, 50)
    por_lado = regla.get("por_lado")
    if por_lado is not None:
        if lado != "ambos":
            raise ErrorRegla(f"{id_}: por_lado solo se usa con lado: ambos")
        if not isinstance(por_lado, dict) or not set(por_lado) <= {"l", "r"}:
            raise ErrorRegla(f"{id_}: por_lado solo admite las claves l y r")
    lados = ("l", "r") if lado == "ambos" else (lado,)
    if lado == "medio" and _hay_texto({k: v for k, v in regla.items() if k not in ("metodo", "desacuerdo")}, MARCA_LADO):
        raise ErrorRegla(f"{id_}: {{lado}} o {{Lado}} en una regla con lado: medio")
    resueltas = {}
    for lg in lados:
        base = {k: v for k, v in regla.items() if k != "por_lado"}
        if por_lado and lg in por_lado:
            if not isinstance(por_lado[lg], dict):
                raise ErrorRegla(f"{id_}: por_lado.{lg} debe ser un mapa")
            base.update(por_lado[lg])
        base["lado"] = lg
        textos = {k: base.pop(k) for k in ("metodo", "desacuerdo", "fuentes", "ancla") if k in base}
        desplazar = base.pop("desplazar", None)
        base = _sustituir(base, lg)
        if _hay_texto(base, LLAVES):
            raise ErrorRegla(f"{id_}: queda una marca {{...}} sin resolver")
        cuerpo = {k: v for k, v in base.items() if k != "lado"}
        _validar_operacion(id_, cuerpo, lg, "regla")
        if desplazar is not None:
            _direccion(id_, desplazar["hacia"], lg, "desplazar.hacia")
            base["desplazar"] = desplazar
        base.update(textos)
        resueltas[lg] = base
    return resueltas


def validar_reglas(datos):
    """Valida el YAML y devuelve {id: {lado: regla resuelta}}. Con lado medio, l o r la clave es ese valor."""
    if not isinstance(datos, dict):
        raise ErrorRegla("el YAML debe ser un mapa con 'marcadores'")
    sobra = set(datos) - {"referencias", "marcadores"}
    if sobra:
        raise ErrorRegla(f"claves desconocidas en el primer nivel: {sorted(sobra)}")
    marcadores = datos.get("marcadores")
    if not isinstance(marcadores, dict) or not marcadores:
        raise ErrorRegla("falta 'marcadores' (un mapa de id a regla)")
    return {id_: _validar_regla(id_, regla) for id_, regla in marcadores.items()}


def cargar_reglas(ruta=REGLAS):
    with open(ruta, encoding="utf-8") as f:
        return validar_reglas(yaml.safe_load(f))


def _recorrer(valor, claves, destino):
    if isinstance(valor, dict):
        for k, v in valor.items():
            if k in claves:
                for n in ([v] if isinstance(v, str) else v if isinstance(v, list) else []):
                    if isinstance(n, str) and n not in destino:
                        destino.append(n)
            _recorrer(v, claves, destino)
    elif isinstance(valor, list):
        for v in valor:
            _recorrer(v, claves, destino)


def mallas_de_regla(regla):
    """Todos los nombres de malla que nombra una regla resuelta, en cualquier nivel, en orden y sin repetir."""
    nombres = []
    _recorrer(regla, ("malla", "mallas", "curva"), nombres)
    return nombres


def _con_linea(valor, destino):
    """Mallas que se usan como curva o con `de: linea`: necesitan la línea central."""
    if isinstance(valor, dict):
        if isinstance(valor.get("curva"), str) and valor["curva"] not in destino:
            destino.append(valor["curva"])
        if valor.get("de") == "linea":
            m = valor.get("malla")
            for n in ([m] if isinstance(m, str) else m or []):
                if n not in destino:
                    destino.append(n)
        for v in valor.values():
            _con_linea(v, destino)
    elif isinstance(valor, list):
        for v in valor:
            _con_linea(v, destino)


def mallas_con_linea(regla):
    nombres = []
    _con_linea(regla, nombres)
    return nombres


# --------------------------------------------------------------------------------------------------
# Lo que el atlas publica del vago (public/modelos/rutas-vago.json)
# --------------------------------------------------------------------------------------------------

def _dentro_de_banda(y, banda):
    """Mismo predicado que extraer.cortar_banda: dentro del tramo que el atlas ya no publica."""
    return y < banda["y_max"] - EPS_PLANO and (banda["y_min"] is None or y > banda["y_min"] + EPS_PLANO)


def _puntos_ok(puntos):
    return (isinstance(puntos, list) and len(puntos) >= 2
            and all(isinstance(p, list) and len(p) == 3 and all(_es_numero(v) for v in p) for p in puntos))


def leer_rutas(ruta=RUTAS):
    """{"bandas": {lado: (y_max, y_min o None)}, "rutas": {id: puntos}} de rutas-vago.json, en metros glTF.
    Las mismas validaciones que extraer.leer_bandas (que no se importa: importa bpy al cargarse)."""
    ruta = Path(ruta)
    if not ruta.exists():
        raise ErrorUbicacion(f"No existe {ruta}: sin las rutas del vago no se sabe qué publica el atlas. "
                             "Corre antes pipeline/generar-ramas-vago.py")
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError as e:
        raise ErrorUbicacion(f"{ruta} no es JSON válido: {e}") from None
    rutas = datos.get("rutas") if isinstance(datos, dict) else None
    if not isinstance(rutas, dict):
        raise ErrorUbicacion(f"{ruta} no trae el objeto 'rutas'")
    bandas, puntos = {}, {}
    for id_ruta, r in rutas.items():
        if not isinstance(r, dict) or not _puntos_ok(r.get("puntos")):
            raise ErrorUbicacion(f"{ruta}: la ruta {id_ruta} no trae 'puntos' (al menos dos [x, y, z])")
        puntos[id_ruta] = r["puntos"]
        rem = r.get("reemplaza")
        if rem is None:
            continue
        lado = rem.get("lado") if isinstance(rem, dict) else None
        if lado not in ("derecho", "izquierdo"):
            raise ErrorUbicacion(f"{ruta}: la ruta {id_ruta} trae un lado inválido en 'reemplaza': {lado!r}")
        if lado in bandas:
            raise ErrorUbicacion(f"{ruta}: hay dos bandas del vago {lado}")
        y_max, y_min = rem.get("y_max"), rem.get("y_min")
        if not _es_numero(y_max):
            raise ErrorUbicacion(f"{ruta}: la banda del vago {lado} trae un y_max inválido: {y_max!r}")
        if y_min is not None and not (_es_numero(y_min) and y_min < y_max):
            raise ErrorUbicacion(f"{ruta}: la banda del vago {lado} trae un y_min inválido "
                                 f"(debe ser nulo o menor que y_max): {y_min!r}")
        bandas[lado] = (float(y_max), None if y_min is None else float(y_min))
    for lado in ("derecho", "izquierdo"):
        if lado not in bandas:
            raise ErrorUbicacion(f"{ruta}: falta la banda del vago {lado} ('reemplaza' de la ruta torácica). "
                                 "Corre pipeline/generar-ramas-vago.py")
    return {"bandas": bandas, "rutas": puntos}


def publicar(modelo, rutas):
    """Copia del modelo como lo publica el atlas: a `Vagus nerve (X).l/.r` se le quitan los vértices de la
    banda de su lado (su `linea` no cambia) y se le agrega `banda`; cada ruta trazada entra como `ruta:<id>`."""
    copia = dict(modelo)
    for nombre, lado in VAGO_LADO.items():
        if nombre not in copia:
            continue
        y_max, y_min = rutas["bandas"][lado]
        banda = {"lado": lado, "y_max": y_max, "y_min": y_min}
        m = dict(copia[nombre])
        m["vertices"] = [v for v in m["vertices"] if not _dentro_de_banda(v[1], banda)]
        m["banda"] = banda
        copia[nombre] = m
    for id_ruta, puntos in rutas["rutas"].items():
        copia[PREFIJO_RUTA + id_ruta] = {"vertices": [list(p) for p in puntos], "linea": [list(p) for p in puntos]}
    return copia


# --------------------------------------------------------------------------------------------------
# Bibliografía
# --------------------------------------------------------------------------------------------------

def leer_bibliografia(ruta=FUENTES):
    """{clave: entrada} de la sección '## Referencias' de fuentes.md."""
    entradas = {}
    en_seccion = False
    with open(ruta, encoding="utf-8") as f:
        for linea in f.read().splitlines():
            if linea.strip() == "## Referencias":
                en_seccion = True
                continue
            if en_seccion and linea.startswith("## "):
                break
            m = BIBLIOGRAFIA.match(linea.rstrip()) if en_seccion else None
            if m:
                entradas[m.group(1)] = m.group(2).strip()
    return entradas


def tiene_identificador(entrada):
    return bool(IDENTIFICADOR.search(entrada))


def tiene_anio(entrada):
    return bool(ANIO.search(TOKENS_IDENTIFICADOR.sub(" ", entrada)))


def cita_de(entrada):
    """La entrada bibliográfica sin la nota de acceso del final ("Texto completo.", etc.)."""
    entrada = entrada.rstrip()
    for nota in NOTAS_ACCESO:
        if entrada.endswith(" " + nota):
            return entrada[: -len(nota)].rstrip()
    return entrada


# --------------------------------------------------------------------------------------------------
# Ubicación
# --------------------------------------------------------------------------------------------------

def _vertices(modelo, nombres, linea=False):
    nombres = [nombres] if isinstance(nombres, str) else nombres
    pts = []
    for n in nombres:
        pts.extend(modelo[n]["linea" if linea else "vertices"])
    return pts


def _filtrar(s, vs, lado, modelo):
    if "tramo" in s:
        t = s["tramo"]
        vs = g.filtrar_tramo(vs, g.direccion(t["hacia"], lado), t["desde"], t["hasta"])
    if "limite" in s:
        lim = s["limite"]
        vs = g.filtrar_limite(vs, g.direccion(lim["hacia"], lado), punto(lim["de"], lado, modelo))
    if not vs:
        raise _SinPunto("el filtro deja la malla sin vértices")
    return vs


def punto(spec, lado, modelo):
    """Punto [x, y, z] de una operación (recursiva) sobre el modelo. Lanza _SinPunto si no hay punto."""
    try:
        return _punto(spec, lado, modelo)
    except ValueError as e:
        raise _SinPunto(str(e)) from None


def _punto(s, lado, modelo):
    op = s["operacion"]
    if op in ("extremo", "centro", "polo"):
        vs = _vertices(modelo, s["malla"], linea=s.get("de") == "linea")
        vs = _filtrar(s, vs, lado, modelo)
        if op == "extremo":
            return g.extremo(vs, g.direccion(s["hacia"], lado))
        if op == "centro":
            return g.centro(vs)
        return g.polo(vs, [g.direccion(h, lado) for h in s["hacia"]])
    if op == "en_curva":
        linea = modelo[s["curva"]]["linea"]
        if "desde" in s:
            p = punto(s["desde"], lado, modelo)
            q = g.en_curva(linea, p, s.get("distancia_mm", 0) / 1000)
            if q is None:
                raise _SinPunto(f"la distancia {s.get('distancia_mm', 0)} mm cae fuera de la curva {s['curva']}")
        elif "altura" in s:
            y = punto(s["altura"], lado, modelo)[1]
            q = g.en_curva_a_altura(linea, y)
            if q is None:
                raise _SinPunto(f"la curva {s['curva']} no cruza la altura {y:.3f} m")
        else:
            q = g.en_curva_cerca_de(linea, _vertices(modelo, s["cerca_de"]["malla"]))
        banda = modelo[s["curva"]].get("banda")
        if banda and _dentro_de_banda(q[1], banda):
            raise ErrorUbicacion(
                f"el punto cae a {q[1] * 1000:.1f} mm de altura, dentro del tramo del vago {banda['lado']} que el atlas "
                f"ya no publica ({s['curva']}); usa la ruta trazada de ese lado como curva ('{PREFIJO_RUTA}<id>', ADR 0010)")
        if "destino" in s:
            dest = _vertices(modelo, s["destino"]["malla"])
            cerca, d = g.punto_mas_cercano(q, dest)
            if d <= s["destino"]["max_mm"] / 1000:
                q = cerca
        return q
    if op == "superficie":
        vs = _filtrar(s, _vertices(modelo, s["malla"]), lado, modelo)
        ref = s["cerca_de"]
        if "operacion" in ref:
            p = punto(ref, lado, modelo)
        else:
            p = g.par_mas_cercano(vs, _vertices(modelo, ref["malla"]))[0]
        cara = g.direccion(s["cara"], lado) if "cara" in s else None
        q = g.superficie(vs, p, cara, s.get("tolerancia_mm", g.TOLERANCIA_RAYO * 1000) / 1000)
        if q is None:
            raise _SinPunto(f"ningún vértice de {s['malla']} queda sobre la cara {s.get('cara')} del punto de referencia")
        return q
    if op == "plano_medio":
        izq, der = (_vertices(modelo, n) for n in s["mallas"])
        y = punto(s["altura"], lado, modelo)[1]
        q = g.plano_medio(izq, der, y, s["profundidad"])
        if q is None:
            raise _SinPunto(f"no hay vértices de {s['mallas']} cerca del plano medio a la altura {y:.3f} m")
        return q
    # entre
    fraccion = s.get("fraccion", 0.5)
    if "mallas" in s:
        va, vb = (_vertices(modelo, n) for n in s["mallas"])
        if "limite" in s:
            va, vb = _filtrar(s, va, lado, modelo), _filtrar(s, vb, lado, modelo)
        pa, pb, _ = g.par_mas_cercano(va, vb)
        return g.entre(pa, pb, fraccion)
    return g.entre(punto(s["a"], lado, modelo), punto(s["b"], lado, modelo), fraccion)


def _preparar(modelo):
    """Copia del modelo con cada línea orientada de arriba abajo (no cambia el original)."""
    copia = {}
    for nombre, m in modelo.items():
        m2 = dict(m)
        if m2.get("linea"):
            m2["linea"] = g.orientar_de_arriba_abajo(m2["linea"])
        copia[nombre] = m2
    return copia


def _motivo_fuente(claves):
    return "fuente sin registrar en docs/research/marcadores/fuentes.md: " + ", ".join(claves)


def ubicar(reglas, modelo, bibliografia):
    """Propuestas ordenadas por id. Lanza ErrorUbicacion si falta una malla o un punto pasa de 5 mm."""
    modelo = _preparar(modelo)
    ids = sorted(reglas)
    # 1. Cada malla que nombra una regla debe estar en el modelo (y las curvas, traer su línea).
    for id_ in ids:
        for lg, regla in reglas[id_].items():
            for nombre in mallas_de_regla(regla):
                if nombre not in modelo:
                    raise ErrorUbicacion(f"{id_}: falta la malla '{nombre}' en el modelo")
            for nombre in mallas_con_linea(regla):
                if not modelo[nombre].get("linea"):
                    raise ErrorUbicacion(f"{id_}: la malla '{nombre}' no trae línea central (debe ser una curva)")
    propuestas = []
    for id_ in ids:
        lados = reglas[id_]
        primera = next(iter(lados.values()))
        base = {"id": id_, "metodo": primera["metodo"], "estado": "sin_ubicar"}
        if "ancla" in primera:
            base["ancla"] = primera["ancla"]
        if "desacuerdo" in primera:
            base["desacuerdo"] = primera["desacuerdo"]
        # 2. Fuentes registradas, con identificador y año.
        malas = [k for k in primera["fuentes"] if k not in bibliografia
                 or not (tiene_identificador(bibliografia[k]) and tiene_anio(bibliografia[k]))]
        if malas:
            propuestas.append({**base, "posicion": None, "motivo": _motivo_fuente(malas), "cita": {"es": "", "en": ""}})
            continue
        cita = "; ".join(cita_de(bibliografia[k]) for k in primera["fuentes"])
        # 3. Un punto por lado.
        puntos, motivos = {}, []
        for lg, regla in lados.items():
            try:
                p = punto(regla, lg, modelo)
                if "desplazar" in regla:
                    d = regla["desplazar"]
                    p = g.desplazar(p, g.direccion(d["hacia"], lg), d["mm"] / 1000)
                puntos[lg] = g.redondear(p)
            except _SinPunto as e:
                motivos.append(f"lado {lg}: {e}" if len(lados) > 1 else str(e))
            except ErrorUbicacion as e:
                raise ErrorUbicacion(f"{id_} ({lg}): {e}") from None
        if motivos:
            propuestas.append({**base, "posicion": None, "cita": {"es": cita, "en": cita},
                               "motivo": "no se pudo calcular el punto (" + "; ".join(motivos) + ")"})
            continue
        # 4. Ningún punto a más de 5 mm de las mallas de su regla.
        for lg, regla in lados.items():
            nombres = mallas_de_regla(regla)
            d = min(g.distancia_a_superficie(puntos[lg], modelo[n]["vertices"]) for n in nombres)
            if d > MAX_DISTANCIA:
                raise ErrorUbicacion(f"{id_} ({lg}): el punto queda a {d * 1000:.1f} mm de las mallas de su regla "
                                     f"({', '.join(nombres)}), más de 5 mm")
        posicion = dict(puntos) if len(puntos) == 2 else next(iter(puntos.values()))
        propuestas.append({**base, "posicion": posicion, "estado": "aproximada", "cita": {"es": cita, "en": cita}})
    return propuestas


def escribir(propuestas, ruta):
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(propuestas, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)


# --------------------------------------------------------------------------------------------------
# Modelo real (Blender)
# --------------------------------------------------------------------------------------------------

def leer_modelo_blender(nombres):
    """{malla: {vertices, linea?}} desde el .blend en caché. Vértices evaluados con modificadores y
    matrix_world (como medir_malla de auditar-vago.py), en glTF. Las curvas traen además su línea
    central (la spline más larga, sin bisel). Los nombres ausentes se omiten: los nombra ubicar()."""
    import bpy  # solo aquí: el resto del módulo corre sin Blender

    abrir_blend(bpy)
    dg = bpy.context.evaluated_depsgraph_get()
    col = bpy.data.collections.new("_ubicar")
    bpy.context.scene.collection.children.link(col)

    def vertices_de(o):
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts = [g.a_gltf(o.matrix_world @ v.co) for v in me.vertices]
        ev.to_mesh_clear()
        return pts

    def linea_central(o, spline):
        tmp = o.copy()
        tmp.data = o.data.copy()
        col.objects.link(tmp)
        tmp.data.bevel_depth = 0
        tmp.data.bevel_object = None
        tmp.data.extrude = 0
        for j in reversed(range(len(tmp.data.splines))):
            if j != spline:
                tmp.data.splines.remove(tmp.data.splines[j])
        dg.update()
        ev = tmp.evaluated_get(dg)
        me = ev.to_mesh()
        pts = [g.a_gltf(tmp.matrix_world @ v.co) for v in me.vertices]
        ev.to_mesh_clear()
        bpy.data.objects.remove(tmp)
        return pts

    modelo = {}
    for nombre in nombres:
        o = bpy.data.objects.get(nombre)
        if o is None:
            continue
        datos = {"vertices": vertices_de(o)}
        if o.type == "CURVE" and len(o.data.splines):
            mejor = None
            for i in range(len(o.data.splines)):
                linea = linea_central(o, i)
                largo = g.largo(linea)
                if mejor is None or largo > mejor[0]:  # empate: menor índice
                    mejor = (largo, linea)
            datos["linea"] = mejor[1]
        modelo[nombre] = datos
    return modelo


def main(argv=None, leer_modelo=None):
    if argv is None:
        argv = argumentos() if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description="Ubica los marcadores con reglas anatómicas (spec 04).")
    ap.add_argument("--reglas", type=Path, default=REGLAS)
    ap.add_argument("--fuentes", type=Path, default=FUENTES)
    ap.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    ap.add_argument("--rutas", type=Path, default=RUTAS)
    args = ap.parse_args(argv)

    reglas = cargar_reglas(args.reglas)
    bibliografia = leer_bibliografia(args.fuentes)
    rutas = leer_rutas(args.rutas)
    nombres = []
    for lados in reglas.values():
        for regla in lados.values():
            nombres += [n for n in mallas_de_regla(regla) if n not in nombres and not n.startswith(PREFIJO_RUTA)]
    modelo = publicar((leer_modelo or leer_modelo_blender)(nombres), rutas)
    propuestas = ubicar(reglas, modelo, bibliografia)
    escribir(propuestas, args.salida)
    sin = [p["id"] for p in propuestas if p["posicion"] is None]
    print(f"{len(propuestas) - len(sin)} marcadores ubicados, {len(sin)} sin ubicar -> {args.salida}")
    for id_ in sin:
        print(f"  sin ubicar: {id_}")
    return propuestas


if __name__ == "__main__":
    try:
        main()
    except (ErrorRegla, ErrorUbicacion) as e:
        raise SystemExit(str(e))
