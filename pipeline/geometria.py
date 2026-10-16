"""Geometría pura del pipeline (solo biblioteca estándar: sin bpy ni yaml).

Ejes: los de glTF. Y arriba, +X a la izquierda del cuerpo, +Z anterior, en metros. Fuentes:
docs/research/vago/auditoria-vago.md ("Eje anterior medido: +Z") y SIDE en generar-ramas-vago.py
({"izquierdo": 1, "derecho": -1}: +X es la izquierda).

Lo usan pipeline/ubicar-marcadores.py (spec 04) y las reglas del vago (spec 04, T5). Todo acepta tuplas
o listas y devuelve listas. Los vértices son listas de [x, y, z]; una malla de curva trae además su
`linea` (la línea central, lista de puntos en orden).
"""
import math

DECIMALES = 5
FRANJA = 0.0025  # medio ancho de la banda del plano medio: 2,5 mm
TOLERANCIA_RAYO = 0.003  # distancia perpendicular máxima de un vértice al rayo de `superficie`: 3 mm
EPS = 1e-9

DIRECCIONES = {
    "superior": (0.0, 1.0, 0.0),
    "inferior": (0.0, -1.0, 0.0),
    "anterior": (0.0, 0.0, 1.0),
    "ventral": (0.0, 0.0, 1.0),
    "posterior": (0.0, 0.0, -1.0),
    "dorsal": (0.0, 0.0, -1.0),
    "izquierda": (1.0, 0.0, 0.0),
    "derecha": (-1.0, 0.0, 0.0),
}
LATERALES = ("lateral", "medial")


def direccion(nombre, lado=None):
    """Vector unitario de una palabra anatómica. `lateral` y `medial` dependen del lado (l o r)."""
    if nombre in LATERALES:
        if lado not in ("l", "r"):
            raise ValueError(f"'{nombre}' necesita el lado l o r, no {lado!r}")
        signo = 1.0 if lado == "l" else -1.0
        if nombre == "medial":
            signo = -signo
        return (signo, 0.0, 0.0)
    if nombre in DIRECCIONES:
        return DIRECCIONES[nombre]
    raise ValueError(f"dirección desconocida: {nombre!r}")


def redondear(p):
    """Redondea a 5 decimales sin dejar -0.0 (el +0.0 lo normaliza)."""
    return [round(float(v), DECIMALES) + 0.0 for v in p]


def a_gltf(v):
    """Blender (Z arriba) a glTF (Y arriba): el mismo giro global del exportador, nada más."""
    return redondear([v[0], v[2], -v[1]])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _resta(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _norma(a):
    return math.sqrt(_dot(a, a))


def distancia(a, b):
    return math.dist(a, b)


def largo(polilinea):
    """Longitud de una polilínea; 0 si trae menos de dos puntos."""
    return sum(math.dist(a, b) for a, b in zip(polilinea, polilinea[1:]))


def caja(vertices):
    """[[mínimos], [máximos]]."""
    return [[min(v[i] for v in vertices) for i in range(3)], [max(v[i] for v in vertices) for i in range(3)]]


def centro(vertices):
    """Centro de la caja que envuelve los vértices."""
    if not vertices:
        raise ValueError("centro de una lista vacía")
    c = caja(vertices)
    return [(c[0][i] + c[1][i]) / 2 for i in range(3)]


def punto_mas_cercano(p, vertices):
    """(vértice, distancia) por fuerza bruta. Empate: el de menor índice."""
    if not len(vertices):
        raise ValueError("sin vértices")
    mejor_i, mejor_d = 0, math.dist(p, vertices[0])
    for i in range(1, len(vertices)):
        d = math.dist(p, vertices[i])
        if d < mejor_d:
            mejor_i, mejor_d = i, d
    return list(vertices[mejor_i]), mejor_d


def distancia_a_superficie(p, vertices):
    """Distancia de p al vértice más cercano (la malla se mide por sus vértices, como auditar-vago.py)."""
    return punto_mas_cercano(p, vertices)[1]


class Indice:
    """Vecino más cercano exacto sobre una malla uniforme. Mismo resultado que la fuerza bruta,
    empates incluidos: gana (distancia, índice) menor."""

    def __init__(self, vertices, celda=0.005):
        if not len(vertices):
            raise ValueError("Indice sin vértices")
        self.vertices = [tuple(p) for p in vertices]
        self.celda = celda
        self.celdas = {}
        for i, p in enumerate(self.vertices):
            self.celdas.setdefault(self._clave(p), []).append(i)
        claves = list(self.celdas)
        self.minimo = tuple(min(k[a] for k in claves) for a in range(3))
        self.maximo = tuple(max(k[a] for k in claves) for a in range(3))

    def _clave(self, p):
        return tuple(math.floor(c / self.celda) for c in p)

    def _anillo(self, c0, r):
        """Celdas ocupables a distancia de Chebyshev r de c0, recortadas a la caja de celdas ocupadas."""
        lo = [max(c0[a] - r, self.minimo[a]) for a in range(3)]
        hi = [min(c0[a] + r, self.maximo[a]) for a in range(3)]
        if r == 0:
            yield c0
            return
        for x in (c0[0] - r, c0[0] + r):  # caras x
            if lo[0] <= x <= hi[0]:
                for y in range(lo[1], hi[1] + 1):
                    for z in range(lo[2], hi[2] + 1):
                        yield (x, y, z)
        xs = range(max(c0[0] - r + 1, self.minimo[0]), min(c0[0] + r - 1, self.maximo[0]) + 1)
        for y in (c0[1] - r, c0[1] + r):  # caras y, sin las aristas ya vistas
            if lo[1] <= y <= hi[1]:
                for x in xs:
                    for z in range(lo[2], hi[2] + 1):
                        yield (x, y, z)
        ys = range(max(c0[1] - r + 1, self.minimo[1]), min(c0[1] + r - 1, self.maximo[1]) + 1)
        for z in (c0[2] - r, c0[2] + r):  # caras z
            if lo[2] <= z <= hi[2]:
                for x in xs:
                    for y in ys:
                        yield (x, y, z)

    def mas_cercano(self, p):
        """(índice, distancia) del vértice más cercano a p."""
        c0 = self._clave(p)
        r_min = max(max(self.minimo[a] - c0[a], c0[a] - self.maximo[a], 0) for a in range(3))
        r_max = max(max(abs(self.minimo[a] - c0[a]), abs(self.maximo[a] - c0[a])) for a in range(3))
        mejor = None
        for r in range(r_min, r_max + 1):
            for clave in self._anillo(c0, r):
                for i in self.celdas.get(clave, ()):
                    cand = (math.dist(p, self.vertices[i]), i)
                    if mejor is None or cand < mejor:
                        mejor = cand
            # Lo que queda sin mirar está en anillos mayores: a r celdas o más. Estricto, para respetar empates.
            if mejor is not None and mejor[0] < r * self.celda - 1e-12:
                break
        return mejor[1], mejor[0]


def par_mas_cercano(a, b):
    """(punto de a, punto de b, distancia) del par más cercano. Empate: gana el primero de a, luego el menor índice de b."""
    if not len(a) or not len(b):
        raise ValueError("par más cercano de una lista vacía")
    indice = Indice(b)
    mejor = None
    for pa in a:
        j, d = indice.mas_cercano(pa)
        if mejor is None or d < mejor[2]:
            mejor = (list(pa), list(b[j]), d)
    return mejor


def filtrar_tramo(vertices, d, desde, hasta):
    """Vértices cuya fracción s (0 en el extremo hacia d, 1 en el opuesto) cae en [desde, hasta]."""
    if not vertices:
        return []
    proy = [_dot(v, d) for v in vertices]
    mx, mn = max(proy), min(proy)
    if mx - mn < EPS:
        return [list(v) for v in vertices]
    return [list(v) for v, pv in zip(vertices, proy) if desde - EPS <= (mx - pv) / (mx - mn) <= hasta + EPS]


def filtrar_limite(vertices, d, ref):
    """Vértices con (v - ref)·d >= 0: del lado de d respecto del punto ref."""
    return [list(v) for v in vertices if _dot(_resta(v, ref), d) >= 0]


def extremo(vertices, d):
    """Vértice más lejano hacia d. Si una cara plana empata, el más cercano al centro de esa cara."""
    if not len(vertices):
        raise ValueError("extremo de una lista vacía")
    proy = [_dot(v, d) for v in vertices]
    mx = max(proy)
    grupo = [i for i, pv in enumerate(proy) if mx - pv < EPS]
    c = centro([vertices[i] for i in grupo])
    mejor = min(grupo, key=lambda i: (math.dist(vertices[i], c), i))
    return list(vertices[mejor])


def polo(vertices, ds):
    """Extremo hacia la suma normalizada de varias direcciones (por ejemplo anterior y superior)."""
    s = [sum(d[i] for d in ds) for i in range(3)]
    n = _norma(s)
    if n < EPS:
        raise ValueError("las direcciones del polo se anulan")
    return extremo(vertices, [c / n for c in s])


def orientar_de_arriba_abajo(linea):
    """La línea empieza arriba: si el primer punto está más bajo que el último, se invierte."""
    linea = [list(p) for p in linea]
    if linea and linea[0][1] < linea[-1][1]:
        linea.reverse()
    return linea


def proyectar_en_polilinea(linea, p):
    """(punto más cercano sobre la polilínea, longitud de arco desde linea[0]). Empate: primer segmento."""
    if not linea:
        raise ValueError("polilínea vacía")
    if len(linea) == 1:
        return list(linea[0]), 0.0
    mejor = None
    acumulado = 0.0
    for a, b in zip(linea, linea[1:]):
        ab = _resta(b, a)
        l2 = _dot(ab, ab)
        t = 0.0 if l2 == 0 else min(1.0, max(0.0, _dot(_resta(p, a), ab) / l2))
        q = [a[i] + ab[i] * t for i in range(3)]
        d = math.dist(p, q)
        if mejor is None or d < mejor[0]:
            mejor = (d, q, acumulado + t * math.sqrt(l2))
        acumulado += math.sqrt(l2)
    return mejor[1], mejor[2]


def punto_a_distancia(linea, s):
    """Punto a longitud de arco s desde linea[0]; None si s cae fuera de la polilínea."""
    total = largo(linea)
    if s < -EPS or s > total + EPS:
        return None
    s = min(max(s, 0.0), total)
    acumulado = 0.0
    for a, b in zip(linea, linea[1:]):
        seg = math.dist(a, b)
        if seg > 0 and s <= acumulado + seg:
            t = (s - acumulado) / seg
            return [a[i] + (b[i] - a[i]) * t for i in range(3)]
        acumulado += seg
    return list(linea[-1]) if linea else None


def en_curva(linea, p, distancia):
    """Punto de la línea a `distancia` (con signo: positiva baja si la línea va de arriba abajo) del
    punto de la línea más cercano a p."""
    _, s0 = proyectar_en_polilinea(linea, p)
    return punto_a_distancia(linea, s0 + distancia)


def en_curva_a_altura(linea, y):
    """Primer punto, desde linea[0], donde la línea cruza la altura y (interpolado); None si no cruza.
    Mismo criterio que en_polilinea_a_altura de generar-ramas-vago.py."""
    for a, b in zip(linea, linea[1:]):
        if (a[1] - y) * (b[1] - y) <= 0 and a[1] != b[1]:
            t = (a[1] - y) / (a[1] - b[1])
            return [a[i] + (b[i] - a[i]) * t for i in range(3)]
    return None


def en_curva_cerca_de(linea, vertices):
    """Punto de la línea más cercano a una malla (por sus vértices). Empate: el primero de la línea."""
    if not len(linea) or not len(vertices):
        raise ValueError("en_curva_cerca_de con una lista vacía")
    indice = Indice(vertices)
    mejor = None
    for p in linea:
        _, d = indice.mas_cercano(p)
        if mejor is None or d < mejor[0]:
            mejor = (d, p)
    return list(mejor[1])


def superficie(vertices, p, cara=None, tolerancia=TOLERANCIA_RAYO):
    """Sin cara: el vértice más cercano a p. Con cara d: rayo desde p hacia d; gana el vértice más lejano
    sobre el rayo (t mayor) entre los que quedan a `tolerancia` o menos del rayo. Sin candidatos, None."""
    if not len(vertices):
        return None
    if cara is None:
        return punto_mas_cercano(p, vertices)[0]
    mejor = None
    for i, v in enumerate(vertices):
        rel = _resta(v, p)
        t = _dot(rel, cara)
        if t < 0:
            continue
        perp = math.sqrt(max(0.0, _dot(rel, rel) - t * t))
        if perp > tolerancia:
            continue
        if (mejor is None or t > mejor[0] + EPS
                or (abs(t - mejor[0]) <= EPS and perp < mejor[1] - EPS)):
            mejor = (t, perp, i)
    return None if mejor is None else list(vertices[mejor[2]])


def plano_medio(izq, der, y, profundidad, franja=FRANJA):
    """Punto en el plano medio entre dos mallas, a la altura y. x es el centro entre el borde medial de
    cada una; z sale de una banda de vértices cerca de ese plano y de esa altura: "medio" (mitad del rango
    de z) o una dirección anteroposterior (el extremo de la banda hacia ella). Sin banda, None."""
    if not len(izq) or not len(der):
        return None
    x_mid = (min(v[0] for v in izq) + max(v[0] for v in der)) / 2
    banda = [v for v in list(izq) + list(der)
             if abs(v[1] - y) <= franja + EPS and abs(v[0] - x_mid) <= franja + EPS]
    if not banda:
        return None
    if profundidad == "medio":
        zs = [v[2] for v in banda]
        z = (min(zs) + max(zs)) / 2
    else:
        d = direccion(profundidad)
        if d[0] != 0 or d[1] != 0:
            raise ValueError(f"la profundidad {profundidad!r} no es anteroposterior")
        z = extremo(banda, d)[2]
    return [x_mid, y, z]


def entre(a, b, fraccion=0.5):
    return [a[i] + (b[i] - a[i]) * fraccion for i in range(3)]


def desplazar(p, d, metros):
    return [p[i] + d[i] * metros for i in range(3)]
