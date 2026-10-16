"""Reglas de la auditoría del vago (spec 04, T5): qué es cada uno de los 28 trazos sin nombre.

Solo biblioteca estándar y pipeline/geometria.py: no importa bpy, así que las reglas se prueban sin
Blender (pipeline/pruebas/probar_auditar.py). pipeline/auditar-vago.py lee el modelo real, le pasa a este
módulo los anclajes, los trazos y las superficies (listas de vértices) y escribe lo que sale de aquí.

Ejes: los de glTF (Y arriba, +X izquierda del cuerpo, +Z anterior), en metros. Los umbrales están en
milímetros y son constantes con nombre. Las reglas son las de docs/research/marcadores/fuentes.md, sección
"Trazos sin nombre del vago: cómo distinguirlos". Lo que no sale de una cifra de la fuente va marcado
"(derivado)": lo revisa el editor en el PR que lleva la auditoría a los datos (spec 04, T7).

Cada regla es una propuesta, nunca un nombre definitivo: un docente la confirma con F24.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geometria as g  # noqa: E402

SALIDA = Path(__file__).resolve().parent / "salida" / "trazos-medidos.json"

# --- Umbrales (mm) ---------------------------------------------------------------------------------
LARGO_TRONCO_MM = 200.0  # más largo que esto es el tronco del vago, no un ramo (la regla de la auditoría del 13 de octubre de 2026)
LARGO_RAICILLA_MAX_MM = 20.0  # (derivado) una raicilla es corta; la cifra no sale de fuentes.md (misma auditoría)
CERCA_BULBO_MM = 10.0  # (derivado) "toca o casi toca" Medulla oblongata, Kim2022: la superficie se mide por vértices
DISTANCIA_FARINGEO_MM = (20.0, 35.0)  # bajo el foramen yugular: 2,0 a 3,5 cm [Mansour2021], [Bahadir2026]
DISTANCIA_LARINGEO_SUPERIOR_MM = (33.0, 48.0)  # bajo el foramen yugular: 3,3 a 4,8 cm [Lee2017]
CERCA_CUELLO_MM = 25.0  # (derivado) el extremo del ramo del cuello queda a esto o menos de la faringe o del tiroides
CERCA_ABDOMEN_MM = 15.0  # (derivado) extremo a esto o menos del destino abdominal (el CERCA_ESTOMAGO de la auditoría anterior)
MARGEN_BAJA_MM = 3.0  # confianza baja si algún umbral queda a menos de esto del límite
FACTOR_ALTA = 2.0  # confianza alta si la segunda pieza más cercana está a más de este múltiplo de la primera

# --- Reglas ----------------------------------------------------------------------------------------
REGLAS = ("raicilla", "faringeo", "laringeo_superior", "abdominal_hepatico", "abdominal_gastrico_anterior",
          "abdominal_gastrico_posterior", "abdominal_celiaco", "tronco", "sin_regla")

# Id de ramo de src/data/marcadores.json, "no_es_ramo" o None (sin propuesta).
PROPUESTA = {
    "raicilla": "no_es_ramo",
    "tronco": "no_es_ramo",
    "faringeo": "m-pharyngeal-branch-of-vagus-nerve",
    "laringeo_superior": "m-superior-laryngeal-nerve",
    "abdominal_hepatico": "m-hepatic-branches-of-anterior-vagal-trunk",
    "abdominal_gastrico_anterior": "m-anterior-gastric-branches-of-anterior-vagal-trunk",
    "abdominal_gastrico_posterior": "m-posterior-gastric-branches-of-posterior-vagal-trunk",
    "abdominal_celiaco": "m-coeliac-branches-of-posterior-vagal-trunk",
    "sin_regla": None,
}

# Una sola clave de docs/research/marcadores/fuentes.md ("## Referencias") por regla: la primera que cita
# la sección de los trazos. tronco y sin_regla no tienen cita propia en esa sección.
FUENTE = {
    "raicilla": "Kim2022",
    "faringeo": "Mansour2021",
    "laringeo_superior": "Lee2017",
    "abdominal_hepatico": "Zhang2026",
    "abdominal_gastrico_anterior": "Guo2024",
    "abdominal_gastrico_posterior": "Guo2024",
    "abdominal_celiaco": "Guo2024",
    "tronco": "In2026",
    "sin_regla": "Bahadir2026",
}

# Texto de la columna "Propuesta" de la tabla de la auditoría.
TEXTO_AUDITORIA = {
    "raicilla": "raicilla (sale del bulbo)",
    "tronco": "tronco del vago",
    "faringeo": "candidato: ramo faríngeo",
    "laringeo_superior": "candidato: nervio laríngeo superior",
    "abdominal_hepatico": "candidato: ramo hepático",
    "abdominal_gastrico_anterior": "candidato: ramo gástrico anterior",
    "abdominal_gastrico_posterior": "candidato: ramo gástrico posterior",
    "abdominal_celiaco": "candidato: ramo celíaco",
    "sin_regla": "sin candidato",
}

# Piezas que las reglas exigen. Las de superficie traen vértices; las de línea, además, su línea central.
BULBO = ("Medulla oblongata.l", "Medulla oblongata.r")
PIEZAS_SUPERFICIE = ("Medulla oblongata.l", "Medulla oblongata.r", "Olive.l", "Olive.r", "Laryngopharynx",
                     "Thyroid cartilage", "Diaphragm", "Stomach", "Liver", "Thoracic aorta")
PIEZAS_LINEA = ("Internal jugular vein.l", "Internal jugular vein.r", "Oesophagus")


class FaltaPieza(Exception):
    """Una pieza que exigen las reglas no está en el modelo."""


def lado_de(nombre):
    """'l' o 'r' según el nombre de la malla del trazo ('Vagus nerve (X).l#t00')."""
    if ".l#" in nombre:
        return "l"
    if ".r#" in nombre:
        return "r"
    raise ValueError(f"no se sabe el lado de '{nombre}': esperaba '.l#' o '.r#' en el nombre")


def troncos(trazos):
    """{lado: línea} del trazo más largo de cada lado, orientado de arriba abajo. Empate: el nombre menor.
    Mismo criterio que Modelo.tronco de generar-ramas-vago.py."""
    mejores = {}
    for nombre in sorted(trazos):
        lado = lado_de(nombre)
        largo = g.largo(trazos[nombre]["puntos"])
        if lado not in mejores or largo > mejores[lado][0]:
            mejores[lado] = (largo, nombre)
    return {lado: g.orientar_de_arriba_abajo(trazos[nombre]["puntos"]) for lado, (_, nombre) in mejores.items()}


def foramen(tronco, puntos_yugular):
    """(punto, s) del foramen yugular sobre el tronco: el punto del tronco más cercano al extremo superior
    de la vena yugular interna (docs/research/vago/design.md, "Foramen yugular y ganglios"). s es la
    longitud de arco desde el extremo superior del tronco."""
    arriba = max(puntos_yugular, key=lambda p: p[1])
    return g.proyectar_en_polilinea(tronco, arriba)


def distancia_desde_foramen_mm(tronco, s_foramen, p):
    """Distancia a lo largo del tronco, desde el foramen hacia abajo, del punto del tronco más cercano a p."""
    return (g.proyectar_en_polilinea(tronco, p)[1] - s_foramen) * 1000


def altura_hiato(linea_esofago, vertices_diafragma):
    """Altura (y) del hiato esofágico: donde la línea central del esófago pasa más cerca del diafragma."""
    return g.en_curva_cerca_de(g.orientar_de_arriba_abajo(linea_esofago), vertices_diafragma)[1]


class Contexto:
    """Lo que las reglas miden en el modelo, calculado una vez."""

    def __init__(self, anclas, superficies, trazos):
        for nombre in PIEZAS_SUPERFICIE:
            if not superficies.get(nombre):
                raise FaltaPieza(f"Falta la superficie de '{nombre}': las reglas de los trazos la necesitan")
        for nombre in PIEZAS_LINEA:
            if not anclas.get(nombre, {}).get("puntos"):
                raise FaltaPieza(f"Falta la línea central de '{nombre}': las reglas de los trazos la necesitan")
        self.indices = {nombre: g.Indice(v) for nombre, v in superficies.items() if v}
        self.centros = {nombre: g.centro(superficies[nombre]) for nombre in
                        ("Olive.l", "Olive.r", "Laryngopharynx", "Stomach")}
        self.hiato = altura_hiato(anclas["Oesophagus"]["puntos"], superficies["Diaphragm"])
        self.troncos = troncos(trazos)
        self.foramen = {lado: foramen(linea, anclas[f"Internal jugular vein.{lado}"]["puntos"])
                        for lado, linea in self.troncos.items()}

    def distancia(self, pieza, p):
        """Distancia en metros de p a la superficie de la pieza (por vértices)."""
        return self.indices[pieza].mas_cercano(p)[1]

    def cercanos(self, p):
        """[(distancia en metros, pieza)] de todas las piezas, de menor a mayor (empate: por nombre)."""
        return sorted((self.distancia(nombre, p), nombre) for nombre in self.indices)


def cercanos(p, ctx):
    return ctx.cercanos(p)


def _cumple(firmados):
    """Márgenes firmados en mm (cero o más es que se cumple). Devuelve los márgenes si todos se cumplen, o None."""
    return list(firmados) if all(m >= 0 for m in firmados) else None


def _raicilla(lado, linea, largo_mm, ctx):
    sup = linea[0]
    d_bulbo = min(ctx.distancia(n, sup) for n in BULBO) * 1000
    return _cumple([
        LARGO_RAICILLA_MAX_MM - largo_mm,
        CERCA_BULBO_MM - d_bulbo,
        (ctx.centros[f"Olive.{lado}"][2] - sup[2]) * 1000,  # (derivado) dorsal a la oliva: cara decidida por el centro z de la caja
        (min(p[1] for p in linea) - ctx.foramen[lado][0][1]) * 1000,  # por encima del foramen
    ])


def _entre_cuello(inf, ctx):
    """(distancia a la faringe, distancia al tiroides), en metros."""
    return ctx.distancia("Laryngopharynx", inf), ctx.distancia("Thyroid cartilage", inf)


def _faringeo(lado, linea, ctx):
    sup, inf = linea[0], linea[-1]
    d = distancia_desde_foramen_mm(ctx.troncos[lado], ctx.foramen[lado][1], sup)
    d_faringe, d_tiroides = _entre_cuello(inf, ctx)
    return _cumple([
        d - DISTANCIA_FARINGEO_MM[0],
        DISTANCIA_FARINGEO_MM[1] - d,
        (d_tiroides - d_faringe) * 1000,  # termina más cerca de la faringe que del tiroides
        CERCA_CUELLO_MM - d_faringe * 1000,
        (ctx.centros["Laryngopharynx"][2] - inf[2]) * 1000,  # (derivado) cara posterior: decidida por el centro z de la caja
    ])


def _laringeo_superior(lado, linea, ctx):
    sup, inf = linea[0], linea[-1]
    d = distancia_desde_foramen_mm(ctx.troncos[lado], ctx.foramen[lado][1], sup)
    d_faringe, d_tiroides = _entre_cuello(inf, ctx)
    return _cumple([
        d - DISTANCIA_LARINGEO_SUPERIOR_MM[0],
        DISTANCIA_LARINGEO_SUPERIOR_MM[1] - d,
        (d_faringe - d_tiroides) * 1000,  # termina más cerca del tiroides que de la faringe
        CERCA_CUELLO_MM - d_tiroides * 1000,
    ])


def _abdominal(lado, linea, ctx):
    """(regla, márgenes) de un ramo abdominal, o None."""
    inf = linea[-1]
    bajo_hiato = (ctx.hiato - max(p[1] for p in linea)) * 1000  # todo el trazo debajo del hiato
    destinos = sorted((ctx.distancia(n, inf), n) for n in ("Liver", "Stomach", "Thoracic aorta"))
    (d1, destino), (d2, _) = destinos[0], destinos[1]
    cerca = [bajo_hiato, (d2 - d1) * 1000, CERCA_ABDOMEN_MM - d1 * 1000]
    if destino == "Liver":
        regla = "abdominal_hepatico"
    elif destino == "Thoracic aorta":
        regla = "abdominal_celiaco"
    else:
        dz = inf[2] - ctx.centros["Stomach"][2]  # (derivado) cara del estómago: decidida por el centro z de la caja
        if lado == "l" and dz >= 0:
            regla = "abdominal_gastrico_anterior"
        elif lado == "r" and dz < 0:
            regla = "abdominal_gastrico_posterior"
        else:
            return None  # cara y lado no encajan: el tronco anterior es el izquierdo y el posterior, el derecho
        cerca.append(abs(dz) * 1000)
    margenes = _cumple(cerca)
    return None if margenes is None else (regla, margenes)


def clasificar(nombre, puntos, ctx):
    """(regla, márgenes en mm, extremo del que salen los cercanos: 'superior' o 'inferior').
    Primero el tronco; después cada regla en orden. Son excluyentes por construcción: la raicilla queda por
    encima del foramen, el cuello entre 20 y 48 mm debajo, el abdomen bajo el hiato."""
    linea = g.orientar_de_arriba_abajo(puntos)
    lado = lado_de(nombre)
    largo_mm = g.largo(linea) * 1000
    if largo_mm > LARGO_TRONCO_MM:
        return "tronco", [largo_mm - LARGO_TRONCO_MM], "inferior"
    margenes = _raicilla(lado, linea, largo_mm, ctx)
    if margenes is not None:
        return "raicilla", margenes, "superior"
    for regla, evaluar in (("faringeo", _faringeo), ("laringeo_superior", _laringeo_superior)):
        margenes = evaluar(lado, linea, ctx)
        if margenes is not None:
            return regla, margenes, "inferior"
    abdominal = _abdominal(lado, linea, ctx)
    if abdominal is not None:
        return abdominal[0], abdominal[1], "inferior"
    return "sin_regla", [], "inferior"


def confianza(regla, margenes_mm, cercanos_extremo_m):
    """None sin regla. 'baja' si algún margen queda a menos de MARGEN_BAJA_MM (gana sobre 'media'); si no,
    'alta' si la segunda pieza más cercana al extremo está a más de FACTOR_ALTA veces la primera; si no, 'media'."""
    if regla == "sin_regla":
        return None
    if any(m < MARGEN_BAJA_MM for m in margenes_mm):
        return "baja"
    if len(cercanos_extremo_m) < 2:
        raise ValueError("la confianza necesita al menos dos piezas cercanas")
    if cercanos_extremo_m[1][0] > FACTOR_ALTA * cercanos_extremo_m[0][0]:
        return "alta"
    return "media"


def _mm(metros):
    return round(metros * 1000, 1) + 0.0


def medir_trazos(anclas, trazos, superficies):
    """{malla: registro} de todos los trazos. Lanza FaltaPieza si falta una pieza que las reglas exigen.
    Las distancias se redondean a 0,1 mm al final; la confianza se calcula con las exactas."""
    ctx = Contexto(anclas, superficies, trazos)
    medidos = {}
    for nombre in sorted(trazos):
        puntos = trazos[nombre]["puntos"]
        linea = g.orientar_de_arriba_abajo(puntos)
        regla, margenes, extremo = clasificar(nombre, puntos, ctx)
        por_extremo = {"superior": ctx.cercanos(linea[0]), "inferior": ctx.cercanos(linea[-1])}
        alturas = [p[1] for p in puntos]
        medidos[nombre] = {
            "altura_mm": {"max": _mm(max(alturas)), "min": _mm(min(alturas))},
            "largo_mm": _mm(g.largo(puntos)),
            "cerca_extremos": {k: [{"pieza": pieza, "mm": _mm(d)} for d, pieza in v[:2]]
                               for k, v in por_extremo.items()},
            "regla": regla,
            "auditoria": TEXTO_AUDITORIA[regla],
            "propuesta": PROPUESTA[regla],
            "confianza": confianza(regla, margenes, por_extremo[extremo]),
            "fuente": FUENTE[regla],
        }
    return medidos


def escribir_trazos_medidos(medidos, ruta=SALIDA):
    """Escribe el JSON de los trazos medidos: claves ordenadas, sin depender del orden de entrada, byte a byte."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(medidos, ensure_ascii=False, indent=1, sort_keys=True) + "\n")


def informe(nombres_anclajes, anclas, ausentes, medidos):
    """Markdown de la auditoría (pipeline/salida/auditoria-vago.md). Con medidos=None solo trae los anclajes."""
    lineas = ["# Auditoría del vago (ADR 0009)", "", "Propuestas para revisión docente: ningún nombre es definitivo.", "",
              "## Anclajes", "", "| Anclaje | Estado | Tipo |", "|---|---|---|"]
    for n in nombres_anclajes:
        estado = "AUSENTE" if n in ausentes else "presente"
        lineas.append(f"| {n} | {estado} | {anclas.get(n, {}).get('tipo', '')} |")
    if medidos is not None:
        lineas += ["", "## Trazos", "",
                   "Altura en mm sobre el origen del modelo (Y arriba). Cercanos: las dos piezas más próximas a cada "
                   "extremo del trazo (arriba / abajo), a su superficie. Los umbrales de cada regla están en "
                   "`pipeline/reglas_vago.py` y las fuentes, en `docs/research/marcadores/fuentes.md`.", "",
                   "| Trazo | Altura (mm) | Largo (mm) | Cercanos (arriba / abajo) | Propuesta | Regla | Confianza | Fuente |",
                   "|---|---|---|---|---|---|---|---|"]
        for n in sorted(medidos):
            m = medidos[n]
            cerca = {k: ", ".join(f"{c['pieza']} {c['mm']:.0f} mm" for c in v) for k, v in m["cerca_extremos"].items()}
            lineas.append(f"| {n} | {m['altura_mm']['max']:.0f} a {m['altura_mm']['min']:.0f} | {m['largo_mm']:.0f} "
                          f"| {cerca['superior']} / {cerca['inferior']} | {m['auditoria']} | {m['regla']} "
                          f"| {m['confianza'] or '-'} | {m['fuente']} |")
    return "\n".join(lineas) + "\n"
