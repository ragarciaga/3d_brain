"""Rutas trazadas del vago (ADR 0009 y 0010). Lee pipeline/rutas-vago.yaml y los anclajes que
midió pipeline/auditar-vago.py, y calcula los puntos de cada ruta. No hay coordenadas escritas a mano:
todo sale de los anclajes. No usa Blender, así que se prueba sin él (pipeline/pruebas/).

Una ruta puede arrancar sobre otra (paso desde_ruta) o cerrarse en el tronco escaneado (hasta_vago).
Las rutas se resuelven en orden de dependencia; la salida conserva el orden del YAML.

Salida:
- public/modelos/rutas-vago.json: lo que dibuja la app. Cada ruta lleva su estado de revisión
  ("en_revision" o "aprobada"), que la ficha muestra; los docentes la juzgan con F24.
  Las rutas torácicas llevan además reemplaza: {lado, y_max, y_min}, la banda del tronco escaneado
  que reemplazan, en metros glTF (y_min nulo significa hasta abajo).
- pipeline/salida/rutas-vago-borrador.json con --borrador, para mirarla sin publicarla.

La prueba de las cuatro asimetrías (tests/asimetrias.test.ts) corre en CI sobre esos puntos y falla
si alguna no se cumple o si falta un anclaje.

Despeje (SPEC F25): ninguna ruta puede pasar por dentro de un órgano más allá de su tolerancia. Los órganos son
la tráquea, el esófago y los cartílagos cricoides y tiroides (cajas por franja de altura; donde tráquea y esófago
se tocan, la pared común se parte por la mitad), nueve arterias y bronquios (tubos con línea central y radio) y
los cinco lóbulos pulmonares. Los pulmones no están en anclajes-vago.json: salen de secciones horizontales de 1 mm
de la malla de public/modelos/atlas.glb que exporta `node scripts/exportar-pulmones.ts` a
pipeline/salida/pulmones-vago.json (hay que correrlo antes de este script). Tolerancia: 0,5 mm dentro (el radio
del nervio), salvo contra la tráquea y el esófago, 1 mm (decisión del editor: el recurrente va en el surco
traqueoesofágico, en contacto con sus paredes), y contra el arco aórtico, 1 mm solo en el gancho del recurrente
izquierdo (el asa bajo el arco, desde su primer punto hasta el primer punto, después del más bajo, que llega a la
cima del eje del arco). Cómo se logra, en orden:
1. `surco` recorre el tramo entre el paso anterior y el siguiente con un punto cada 5 mm, cada uno el sitio de una
   rejilla de 0,5 mm más cercano al costado de la tráquea que queda dentro de la tolerancia de todos los órganos
   (`Modelo.surco`). Si no hay ninguno, el que menos se pasa, y `despejar` se detiene.
2. `rodear anterior/posterior` sobre un tubo cuya franja abarca dos ramas (el arco aórtico) parte de su línea
   central más el radio (`Modelo._por_linea_central`); si ese punto se pasa de la tolerancia (un pulmón envuelve el
   arco), gira alrededor del eje del tubo de 5 en 5 grados hasta 60 sin cambiar el lado pedido. Los anclajes medidos
   por cajas (tráquea, esófago, cartílagos) nunca usan esa regla, porque su radio de línea central no describe su
   sección. El control rodeado se empuja fuera de cualquier órgano vecino (`_empujar`); si aun así se pasa, se
   detiene (`Atraviesa`).
3. `despejar` empuja fuera de los órganos solo los puntos de la curva que se pasan de su tolerancia (nunca un
   control), suaviza el entorno de lo empujado y de los giros de más de 30 grados (hasta 20 rondas, sin mover los
   controles), vuelve a empujar lo que se pasó y parte por la mitad todo tramo de más de 2,5 mm. Si al final queda un
   punto fuera de tolerancia lanza `Atraviesa`; si queda un giro de más de 30 grados, `Quiebre`. En los dos casos
   no se escribe nada.

Uso: python pipeline/generar-ramas-vago.py [--borrador]
"""
import bisect
import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
PUBLICADO = RAIZ.parent / "public" / "modelos" / "rutas-vago.json"
ESTADOS = ("en_revision", "aprobada")
PASO_MUESTREO = 0.002  # un punto cada 2 mm a lo largo de la ruta
HOLGURA = 1.5  # el nervio pasa a 1,5 de su radio de la superficie del anclaje
FINAL_GROSOR = 0.6  # el grosor baja del tronco hacia lo distal hasta el 60 %
TOLERANCIA_ALTURA = 1e-5  # 0,01 mm: la curva redondea a 6 decimales y un punto puede quedar justo en el borde
SIDE = {"izquierdo": 1, "derecho": -1}  # +X es la izquierda del cuerpo en el modelo
CORTE_MINIMO = 0.001  # una franja de menos de 1 mm de alto es una lámina suelta, no una sección del órgano
PASO_SURCO = 0.005  # un punto cada 5 mm a lo largo del surco traqueoesofágico
TOLERANCIA_DESPEJE = 0.0005  # hasta 0,5 mm (el radio del nervio) dentro de un órgano se tolera
# Decisión del editor, 2026-10-17: contra la tráquea y el esófago se tolera hasta 1 mm (dos radios del nervio),
# porque el recurrente va en el surco traqueoesofágico, en contacto con sus paredes. Arterias, bronquios y
# cartílagos cricoides y tiroides siguen en TOLERANCIA_DESPEJE. Debe coincidir con scripts/lib/despeje.ts.
TOLERANCIA_SURCO = 0.001
TOLERANCIA_POR_ANCLAJE = {"Trachea": TOLERANCIA_SURCO, "Oesophagus": TOLERANCIA_SURCO}
SALTO_MAXIMO = 0.0025  # entre dos puntos seguidos de una ruta no hay más de 2,5 mm (los empalmes se miden con eso)
PASO_REJILLA = 0.0005  # rejilla de 0,5 mm con la que `surco` busca el sitio libre
# Órganos que ninguna ruta puede atravesar (SPEC F25). Los cuatro primeros se miden por franjas (caja x/z de
# sus vértices en cada altura); los nueve siguientes, como tubos (línea central y radio); los lóbulos pulmonares,
# por las secciones horizontales de su malla (scripts/exportar-pulmones.ts).
OBSTACULOS_CAJA = ("Trachea", "Oesophagus", "Cricoid cartilage", "Thyroid cartilage")
OBSTACULOS_TUBO = (
    "Aortic arch", "Thoracic aorta", "Brachiocephalic trunk",
    "Left common carotid artery", "Right common carotid artery",
    "Left subclavian artery", "Right subclavian artery",
    "Left main bronchus", "Right main bronchus",
)
PULMONES = (
    "Superior lobe of left lung", "Inferior lobe of left lung",
    "Superior lobe of right lung", "Middle lobe of right lung", "Inferior lobe of right lung",
)
SALIDA_PULMONES = RAIZ / "salida" / "pulmones-vago.json"
ALCANCE_SECCION = 0.005  # más lejos que esto de la caja de una sección, el punto no está en ese lóbulo
GIRO_MAXIMO = 30.0  # grados entre dos segmentos seguidos de una ruta
GIRO_SEGMENTO_MIN = 0.0005  # al medir giros se descartan los puntos a menos de 0,5 mm del anterior
RONDAS_SUAVIZADO = 20
VENTANA_SUAVIZADO = 5  # puntos a cada lado de lo empujado o de un giro que se suavizan
GIRO_ROTACION_MAX = 60  # grados que puede girar el control de un rodeo para salir de un pulmón
PASO_ROTACION = 5
# El gancho (decisión del editor): la ruta y el órgano donde se tolera 1 mm. Debe coincidir con scripts/lib/despeje.ts.
GANCHO = ("laringeo_recurrente_izquierdo", "Aortic arch")
TOLERANCIA_GANCHO = 0.001


class FaltaAnclaje(Exception):
    pass


class FaltaRuta(Exception):
    pass


class Atraviesa(ValueError):
    """Un punto de una ruta queda dentro de un órgano más allá de su tolerancia (tolerancia_de)."""

    def __init__(self, mensaje, punto=None):
        super().__init__(mensaje)
        self.punto = punto


class Quiebre(ValueError):
    """Una ruta gira más de GIRO_MAXIMO entre dos segmentos seguidos y el suavizado no lo arregla."""


def sumar(a, b):
    return [a[i] + b[i] for i in range(3)]


def escalar(a, k):
    return [a[i] * k for i in range(3)]


def centro_caja(c):
    return [(c[0][i] + c[1][i]) / 2 for i in range(3)]


def tolerancia_de(nombre, en_gancho=False):
    """Hasta cuánto puede entrar un punto de una ruta en ese órgano, en m. `en_gancho` solo cambia el arco aórtico."""
    if en_gancho and nombre == GANCHO[1]:
        return TOLERANCIA_GANCHO
    return TOLERANCIA_POR_ANCLAJE.get(nombre, TOLERANCIA_DESPEJE)


def indices_gancho(puntos, y_cima):
    """Índices de los puntos del gancho: desde el primero hasta el primero, después del más bajo, con y >= y_cima
    (la cima del eje del arco). Si ninguno lo alcanza, hasta el final."""
    if not puntos:
        return set()
    bajo = min(range(len(puntos)), key=lambda i: puntos[i][1])
    fin = len(puntos) - 1
    for i in range(bajo + 1, len(puntos)):
        if puntos[i][1] >= y_cima:
            fin = i
            break
    return set(range(fin + 1))


def giros(puntos):
    """[(índice, grados)] del giro en cada punto interior: el ángulo entre el segmento que llega y el que sale.
    Antes se descartan los puntos a menos de GIRO_SEGMENTO_MIN del anterior que se conservó."""
    util = []
    for i, p in enumerate(puntos):
        if not util or math.dist(p, puntos[util[-1]]) >= GIRO_SEGMENTO_MIN:
            util.append(i)
    res = []
    for a, b, c in zip(util, util[1:], util[2:]):
        u = [puntos[b][k] - puntos[a][k] for k in range(3)]
        v = [puntos[c][k] - puntos[b][k] for k in range(3)]
        cos = sum(u[k] * v[k] for k in range(3)) / (math.hypot(*u) * math.hypot(*v))
        res.append((b, math.degrees(math.acos(max(-1.0, min(1.0, cos))))))
    return res


def cargar_pulmones(ruta):
    """Secciones de los lóbulos que escribe scripts/exportar-pulmones.ts, o SystemExit si falta el archivo o un lóbulo."""
    ruta = Path(ruta)
    if not ruta.exists():
        raise SystemExit(f"Falta {ruta.name}: corre primero node scripts/exportar-pulmones.ts")
    with open(ruta, encoding="utf-8") as f:
        lobulos = json.load(f)["lobulos"]
    faltan = [n for n in PULMONES if not lobulos.get(n)]
    if faltan:
        raise SystemExit(f"Faltan lóbulos en {ruta.name}: {', '.join(faltan)}. Corre node scripts/exportar-pulmones.ts")
    return lobulos


def dist_a_polilinea(p, pts):
    """(distancia, punto más cercano) de p a una polilínea, con los segmentos acotados en sus extremos."""
    if len(pts) == 1:
        return math.dist(p, pts[0]), list(pts[0])
    mejor = (math.inf, None)
    for a, b in zip(pts, pts[1:]):
        ab = [b[i] - a[i] for i in range(3)]
        largo2 = sum(v * v for v in ab)
        t = 0.0 if largo2 == 0 else max(0.0, min(1.0, sum((p[i] - a[i]) * ab[i] for i in range(3)) / largo2))
        q = [a[i] + ab[i] * t for i in range(3)]
        d = math.dist(p, q)
        if d < mejor[0]:
            mejor = (d, q)
    return mejor


def _medida_seccion(segs, x, z):
    """(profundidad, x, z) de (x, z) en una sección: ± la distancia mínima a sus segmentos (positiva dentro) y el punto
    más cercano. Dentro es lo que dicen al menos 2 de 3 rayos (+x, -x, +z) por paridad de cruces: la sección puede
    estar recortada en x y un solo rayo se equivoca."""
    cruces_x_pos = cruces_x_neg = cruces_z = 0
    mejor2, cerca = math.inf, (x, z)
    for x0, z0, x1, z1 in segs:
        if (z0 > z) != (z1 > z):
            xc = x0 + (x1 - x0) * (z - z0) / (z1 - z0)
            if xc > x:
                cruces_x_pos ^= 1
            elif xc < x:
                cruces_x_neg ^= 1
        if (x0 > x) != (x1 > x):
            zc = z0 + (z1 - z0) * (x - x0) / (x1 - x0)
            if zc > z:
                cruces_z ^= 1
        dx, dz = x1 - x0, z1 - z0
        largo2 = dx * dx + dz * dz
        t = 0.0 if largo2 == 0 else max(0.0, min(1.0, ((x - x0) * dx + (z - z0) * dz) / largo2))
        qx, qz = x0 + dx * t, z0 + dz * t
        d2 = (x - qx) ** 2 + (z - qz) ** 2
        if d2 < mejor2:
            mejor2, cerca = d2, (qx, qz)
    if mejor2 == math.inf:
        return (-math.inf, None, None)
    d = math.sqrt(mejor2)
    return ((d if cruces_x_pos + cruces_x_neg + cruces_z >= 2 else -d), cerca[0], cerca[1])


class Modelo:
    """Anclajes y trazos medidos, con los ejes anatómicos sacados de los datos."""

    def __init__(self, datos, pulmones=None):
        """`pulmones` son las secciones de los lóbulos ({nombre: [{y, segmentos}]}, ver cargar_pulmones). Sin ellas,
        los pulmones no son obstáculo (las pruebas con el modelo sintético, que no los trae)."""
        self.anclas = datos["anclas"]
        self.trazos = datos["trazos"]
        self.pulmones = {}
        for nombre, secciones in (pulmones or {}).items():
            if nombre not in PULMONES:
                raise ValueError(f"'{nombre}' no es un lóbulo pulmonar conocido")
            secciones = sorted(secciones, key=lambda s: s["y"])
            preparadas = []
            for sec in secciones:
                segs = [tuple(sg) for sg in sec["segmentos"]]
                xs = [v for sg in segs for v in (sg[0], sg[2])] or [0.0]
                zs = [v for sg in segs for v in (sg[1], sg[3])] or [0.0]
                preparadas.append((segs, (min(xs), max(xs), min(zs), max(zs))))
            self.pulmones[nombre] = ([sec["y"] for sec in secciones], preparadas)
        for k in ("Trachea", "Oesophagus"):
            self.ancla(k)
        # Anterior: la tráquea está por delante del esófago. Así el signo de Z no se supone.
        dz = centro_caja(self.anclas["Trachea"]["caja"])[2] - centro_caja(self.anclas["Oesophagus"]["caja"])[2]
        self.anterior = 1 if dz > 0 else -1
        radios = [t["radio"] for t in self.trazos.values() if t.get("radio")]
        self.radio_nervio = max(radios) if radios else 0.0005

    def ancla(self, nombre):
        a = self.anclas.get(nombre)
        if a is None:
            raise FaltaAnclaje(f"Falta el anclaje '{nombre}' en anclajes-vago.json: corre pipeline/auditar-vago.py")
        return a

    def tronco(self, lado):
        """El trazo más largo del vago de ese lado (el tronco escaneado)."""
        sufijo = ".l#" if lado == "izquierdo" else ".r#"
        candidatos = [t["puntos"] for n, t in self.trazos.items() if sufijo in n and "#toque" not in n]
        if not candidatos:
            raise FaltaAnclaje(f"No hay trazos del vago {lado} en anclajes-vago.json")
        return max(candidatos, key=largo)

    def cortes(self, nombre):
        """Las franjas del anclaje que son sección del órgano: se ignoran las de menos de CORTE_MINIMO de alto."""
        buenos = [c for c in self.ancla(nombre)["cortes"] if c["caja"][1][1] - c["caja"][0][1] >= CORTE_MINIMO]
        if not buenos:
            raise FaltaAnclaje(f"El anclaje '{nombre}' no trae ninguna franja de {CORTE_MINIMO * 1000:g} mm o más de alto")
        return buenos

    def corte(self, nombre, y):
        """Caja de la superficie del anclaje en la franja más cercana a la altura y."""
        return min(self.cortes(nombre), key=lambda c: abs(c["y"] - y))["caja"]

    def punto(self, nombre, cual, cerca_de=None):
        a = self.ancla(nombre)
        pts = a.get("puntos")
        if cual == "cerca_de":
            objetivo = centro_caja(self.ancla(cerca_de)["caja"])
            return min(pts or [centro_caja(a["caja"])], key=lambda p: math.dist(p, objetivo))
        if pts:
            if cual in ("mas_bajo", "extremo_inferior"):
                return min(pts, key=lambda p: p[1])
            if cual == "mas_alto":
                return max(pts, key=lambda p: p[1])
            if cual == "centro":
                c = centro_caja(a["caja"])
                return min(pts, key=lambda p: math.dist(p, c))
        cortes = self.cortes(nombre)
        if cual in ("mas_bajo", "extremo_inferior"):
            return centro_caja(cortes[0]["caja"])
        if cual == "mas_alto":
            return centro_caja(cortes[-1]["caja"])
        if cual == "centro":
            return centro_caja(a["caja"])
        raise ValueError(f"Punto desconocido: {cual}")

    def altura(self, ref):
        return self.punto(ref["anclaje"], ref["punto"])[1]

    def _por_linea_central(self, nombre, p, s, lado):
        """Para rodear anterior o posterior un tubo cuya franja abarca dos ramas (el arco aórtico): el punto de la
        línea central p llevado a radio + h, en la dirección (0, 0, s) más la lateral, proyectada en el plano
        perpendicular al eje del tubo. Si ese punto se pasa de la tolerancia de algún órgano (un pulmón envuelve el
        arco), la dirección gira alrededor del eje del tubo de PASO_ROTACION en PASO_ROTACION grados, hasta
        GIRO_ROTACION_MAX, alternando hacia abajo y hacia arriba, y se queda el primer giro que respeta todas las
        tolerancias y no cambia el lado pedido (el signo de u_z por el sentido anterior). None si la regla de la caja
        basta."""
        a = self.ancla(nombre)
        pts, radio = a.get("puntos"), a.get("radio")
        if not pts or not radio or nombre in OBSTACULOS_CAJA:
            return None
        c = self.corte(nombre, p[1])
        h = self.radio_nervio * HOLGURA
        if c[1][2] - c[0][2] <= 2 * radio + 2 * h:
            return None
        u0 = [SIDE[lado] if lado else 0.0, 0.0, float(s)]
        n0 = math.hypot(*u0)
        u0 = [v / n0 for v in u0]
        i = min(range(len(pts)), key=lambda k: math.dist(pts[k], p))
        t = [pts[min(i + 1, len(pts) - 1)][k] - pts[max(i - 1, 0)][k] for k in range(3)]
        nt = math.hypot(*t)
        if nt == 0:
            return None
        t = [v / nt for v in t]
        d = sum(u0[k] * t[k] for k in range(3))
        u = [u0[k] - d * t[k] for k in range(3)]
        nu = math.hypot(*u)
        if nu < 0.3:
            raise ValueError(f"No sé rodear '{nombre}' hacia ese lado: la dirección casi coincide con su eje")
        u = [v / nu for v in u]

        def en(dir_):
            return [p[k] + dir_[k] * (radio + h) for k in range(3)]

        candidato = en(u)
        if self.exceso(candidato) <= 0:
            return candidato
        # b = t x u es unitario y perpendicular a los dos: u(a) = u cos a + b sin a recorre la sección del tubo.
        b = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]
        abajo = -1 if b[1] > 0 else 1  # signo del ángulo que baja el punto
        for grados in range(PASO_ROTACION, GIRO_ROTACION_MAX + 1, PASO_ROTACION):
            for signo in (abajo, -abajo):
                ang = math.radians(signo * grados)
                giro = [u[k] * math.cos(ang) + b[k] * math.sin(ang) for k in range(3)]
                if giro[2] * s <= 0:
                    continue
                if self.exceso(en(giro)) <= 0:
                    return en(giro)
        return candidato

    def rodear(self, nombre, p, hacia, lado=None):
        """El punto p llevado justo por fuera de la superficie del anclaje, hacia donde se pide."""
        c = self.corte(nombre, p[1])
        h = self.radio_nervio * HOLGURA
        q = list(p)
        if hacia == "debajo":
            radio = self.ancla(nombre).get("radio") or 0
            q[1] = p[1] - radio - h
        elif hacia == "encima":
            radio = self.ancla(nombre).get("radio") or 0
            q[1] = p[1] + radio + h
        elif hacia in ("anterior", "posterior"):
            s = self.anterior if hacia == "anterior" else -self.anterior
            tubo = self._por_linea_central(nombre, p, s, lado)
            if tubo is not None:
                return tubo
            borde = c[1][2] if s > 0 else c[0][2]
            q[2] = borde + s * h
            if lado:  # entra por la cara posterolateral o anterolateral
                q[0] = c[1][0] if SIDE[lado] > 0 else c[0][0]
        else:
            raise ValueError(f"No sé rodear hacia '{hacia}'")
        return q

    # --- Despeje: ningún punto de una ruta dentro de un órgano -------------------------------------------

    def _franja(self, nombre, y):
        """La franja no degenerada del anclaje cuyo rango de alturas contiene y, o None."""
        for c in self.ancla(nombre)["cortes"]:
            if c["caja"][1][1] - c["caja"][0][1] >= CORTE_MINIMO and c["caja"][0][1] <= y <= c["caja"][1][1]:
                return c["caja"]
        return None

    def _caja_efectiva(self, nombre, y):
        """(x0, x1, z0, z1) de la franja a la altura y. Donde la tráquea y el esófago se tocan (la cara posterior
        de la tráquea queda detrás de la anterior del esófago), las dos caras se mueven a su punto medio."""
        c = self._franja(nombre, y)
        if c is None:
            return None
        x0, x1, z0, z1 = c[0][0], c[1][0], c[0][2], c[1][2]
        if nombre in ("Trachea", "Oesophagus"):
            t, e = self._franja("Trachea", y), self._franja("Oesophagus", y)
            if t is not None and e is not None:
                trasera_t = t[0][2] if self.anterior > 0 else t[1][2]
                delantera_e = e[1][2] if self.anterior > 0 else e[0][2]
                if (delantera_e - trasera_t) * self.anterior > 0:
                    medio = (trasera_t + delantera_e) / 2
                    if nombre == "Trachea":
                        z0, z1 = (medio, z1) if self.anterior > 0 else (z0, medio)
                    else:
                        z0, z1 = (z0, medio) if self.anterior > 0 else (medio, z1)
        return x0, x1, z0, z1

    def obstaculos(self):
        """Los órganos que cuentan: los trece de los anclajes y los lóbulos pulmonares que se cargaron."""
        return OBSTACULOS_CAJA + OBSTACULOS_TUBO + tuple(n for n in PULMONES if n in self.pulmones)

    def y_cima_arco(self):
        """La altura de la cima del eje del arco aórtico: donde termina el gancho."""
        return max(q[1] for q in self.ancla(GANCHO[1])["puntos"])

    def _medida_pulmon(self, nombre, p):
        """(profundidad, x, z) de p en el lóbulo, en m, con el punto más cercano de su sección. Se toman las dos
        secciones que rodean la altura de p y gana la de mayor profundidad. -inf si p queda fuera del rango de
        alturas del lóbulo o a más de ALCANCE_SECCION de la caja de cada sección."""
        ys, secciones = self.pulmones[nombre]
        y = p[1]
        if not ys or y < ys[0] or y > ys[-1]:
            return (-math.inf, None, None)
        k = max(0, bisect.bisect_right(ys, y) - 1)
        mejor = (-math.inf, None, None)
        for segs, (xmin, xmax, zmin, zmax) in secciones[k:k + 2]:
            if (p[0] < xmin - ALCANCE_SECCION or p[0] > xmax + ALCANCE_SECCION
                    or p[2] < zmin - ALCANCE_SECCION or p[2] > zmax + ALCANCE_SECCION):
                continue
            medida = _medida_seccion(segs, p[0], p[2])
            if medida[0] > mejor[0]:
                mejor = medida
        return mejor

    def profundidad(self, nombre, p):
        """Cuánto está p dentro del obstáculo, en m: positivo dentro, negativo fuera, -inf si no hay órgano a esa
        altura. Cajas: distancia a la cara más cercana. Tubos: radio menos la distancia a la línea central. Pulmones:
        distancia en planta a la sección más cercana (_medida_pulmon)."""
        if nombre in PULMONES:
            return self._medida_pulmon(nombre, p)[0]
        if nombre in OBSTACULOS_TUBO:
            a = self.ancla(nombre)
            return a["radio"] - dist_a_polilinea(p, a["puntos"])[0]
        c = self._caja_efectiva(nombre, p[1])
        if c is None:
            return -math.inf
        return min(p[0] - c[0], c[1] - p[0], p[2] - c[2], c[3] - p[2])

    def exceso(self, p, en_gancho=False):
        """Cuánto se pasa p de la tolerancia del órgano en el que más se pasa, en m (negativo si no se pasa)."""
        return max(self.profundidad(n, p) - tolerancia_de(n, en_gancho) for n in self.obstaculos())

    def excede(self, p, en_gancho=False):
        """(anclaje, profundidad) del obstáculo en el que p pasa más allá de su tolerancia (el que más se pasa), o
        None si ninguno."""
        mejor = None
        for nombre in self.obstaculos():
            d = self.profundidad(nombre, p)
            exceso = d - tolerancia_de(nombre, en_gancho)
            if exceso > 0 and (mejor is None or exceso > mejor[2]):
                mejor = (nombre, d, exceso)
        return None if mejor is None else mejor[:2]

    def surco(self, lado, y, en_gancho=None):
        """Surco traqueoesofágico a la altura y: al costado de la tráquea, entre su cara posterior y la anterior del
        esófago. Parte del sitio nominal (borde lateral de la tráquea más h, z en el punto medio) y busca, en una
        rejilla de 0,5 mm, el sitio más cercano al nominal que queda dentro de la tolerancia de todos los órganos. Si
        no hay ninguno, el que menos se pasa (y `despejar` se detiene). `en_gancho` (por omisión: lado izquierdo a la
        altura de la cima del arco o más abajo) usa la tolerancia del gancho contra el arco."""
        t = self.corte("Trachea", y)
        e = self.corte("Oesophagus", y)
        h = self.radio_nervio * HOLGURA
        lateral = SIDE[lado]
        if en_gancho is None:
            en_gancho = lado == "izquierdo" and y <= self.y_cima_arco()
        x_nominal = (t[1][0] + h) if lateral > 0 else (t[0][0] - h)
        posterior_traquea = t[0][2] if self.anterior > 0 else t[1][2]
        anterior_esofago = e[1][2] if self.anterior > 0 else e[0][2]
        z_nominal = (posterior_traquea + anterior_esofago) / 2
        x_centro = (t[0][0] + t[1][0]) / 2
        x_fuera = x_nominal + lateral * 0.005
        nx = int(round(abs(x_fuera - x_centro) / PASO_REJILLA))
        nz = int(round(0.010 / PASO_REJILLA))
        mejor = None
        for ix in range(nx + 1):
            x = x_centro + (x_fuera - x_centro) * ix / nx if nx else x_centro
            for iz in range(-nz, nz + 1):
                z = z_nominal + iz * PASO_REJILLA
                q = [x, y, z]
                clave = (max(0.0, self.exceso(q, en_gancho)), math.hypot(x - x_nominal, z - z_nominal))
                if mejor is None or clave < mejor[0]:
                    mejor = (clave, q)
        return mejor[1]

    def surco_tramo(self, lado, y_desde, y_hasta):
        """Puntos del surco entre dos alturas, uno cada PASO_SURCO, en el orden del nervio (del paso anterior al
        siguiente), sin tocar las alturas de los dos extremos."""
        signo = 1 if y_hasta > y_desde else -1
        res = []
        k = 1
        while abs(y_hasta - (y_desde + signo * k * PASO_SURCO)) >= PASO_SURCO / 2:
            res.append(self.surco(lado, y_desde + signo * k * PASO_SURCO))
            k += 1
        return res

    def seguir(self, nombre, cara, y_desde, y_hasta):
        """Puntos sobre la cara de un anclaje entre dos alturas, cada 1 cm."""
        arriba, abajo = max(y_desde, y_hasta), min(y_desde, y_hasta)
        res = []
        y = arriba - 0.01
        while y > abajo + 0.005:
            c = self.corte(nombre, y)
            p = [(c[0][0] + c[1][0]) / 2, y, (c[0][2] + c[1][2]) / 2]
            res.append(self.rodear(nombre, p, cara))
            y -= 0.01
        return res


def largo(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def en_polilinea_a_altura(pts, y, que="El tronco del vago"):
    """Primer punto (de arriba hacia abajo) donde la polilínea cruza la altura y."""
    orden = pts if pts[0][1] >= pts[-1][1] else list(reversed(pts))
    for a, b in zip(orden, orden[1:]):
        if (a[1] - y) * (b[1] - y) <= 0 and a[1] != b[1]:
            t = (a[1] - y) / (a[1] - b[1])
            return [a[i] + (b[i] - a[i]) * t for i in range(3)]
    raise FaltaAnclaje(f"{que} no llega a la altura {y:.3f} m")


def punto_en_ruta(puntos, y, id_ruta):
    """Punto de una ruta ya generada a la altura y. Si y queda fuera por TOLERANCIA_ALTURA o menos
    (el redondeo de la curva), devuelve el extremo más cercano."""
    alto = max(puntos, key=lambda p: p[1])
    bajo = min(puntos, key=lambda p: p[1])
    if y > alto[1] and y - alto[1] <= TOLERANCIA_ALTURA:
        return list(alto)
    if y < bajo[1] and bajo[1] - y <= TOLERANCIA_ALTURA:
        return list(bajo)
    return en_polilinea_a_altura(puntos, y, que=f"La ruta '{id_ruta}'")


def dependencias(ruta):
    """Ids de las rutas sobre las que arranca esta (pasos desde_ruta)."""
    return {paso["desde_ruta"]["ruta"] for paso in ruta["pasos"] if "desde_ruta" in paso}


def banda(modelo, id_ruta, ruta):
    """Banda del tronco escaneado que reemplaza una ruta torácica, o None si no reemplaza nada."""
    reemplaza = ruta.get("reemplaza")
    if reemplaza is None:
        return None
    if not reemplaza.get("desde"):
        raise ValueError(f"{id_ruta}: 'reemplaza' necesita 'desde'")
    y_max = modelo.altura(reemplaza["desde"])
    y_min = modelo.altura(reemplaza["hasta"]) if reemplaza.get("hasta") is not None else None
    if y_min is not None and y_min >= y_max:
        raise ValueError(f"{id_ruta}: 'reemplaza' tiene la altura de 'hasta' por encima de la de 'desde'")
    return {"lado": ruta["lado"], "y_max": round(y_max, 6), "y_min": None if y_min is None else round(y_min, 6)}


def resolver(modelo, ruta, hechas, id_ruta="ruta"):
    """Pasos del YAML a puntos de control. 'seguir' y 'surco' se expanden entre el paso anterior y el siguiente.
    `hechas` trae las rutas ya generadas (id a salida) para los pasos desde_ruta. Un control rodeado que, tras
    empujarlo, siga pasado de la tolerancia de un órgano lanza Atraviesa."""
    lado = ruta["lado"]
    fijos = []
    for paso in ruta["pasos"]:
        if "hasta_vago" in paso:
            if "a_la_altura_de" not in paso:
                raise ValueError(f"El paso hasta_vago necesita a_la_altura_de: {paso}")
            fijos.append(en_polilinea_a_altura(modelo.tronco(paso["hasta_vago"]), modelo.altura(paso["a_la_altura_de"])))
        elif "desde_ruta" in paso:
            ref = paso["desde_ruta"]["ruta"]
            if ref not in hechas:
                raise FaltaRuta(f"Falta la ruta '{ref}': no está en rutas-vago.yaml")
            puntos = hechas[ref]["puntos"]
            if paso["desde_ruta"].get("punto") == "final":
                fijos.append(list(puntos[-1]))
            elif "a_la_altura_de" in paso["desde_ruta"]:
                fijos.append(punto_en_ruta(puntos, modelo.altura(paso["desde_ruta"]["a_la_altura_de"]), ref))
            else:
                raise ValueError(f"El paso desde_ruta necesita punto: final o a_la_altura_de: {paso}")
        elif "desde_vago" in paso:
            tronco = modelo.tronco(paso["desde_vago"])
            if paso.get("punto") == "extremo_inferior":
                fijos.append(min(tronco, key=lambda p: p[1]))
            else:
                fijos.append(en_polilinea_a_altura(tronco, modelo.altura(paso["a_la_altura_de"])))
        elif "surco" in paso:
            if "a_la_altura_de" in paso:
                raise ValueError(f"surco recorre el tramo entre el paso anterior y el siguiente; no lleva a_la_altura_de: {paso}")
            fijos.append(("surco", paso["surco"]))
        elif "seguir" in paso:
            fijos.append(("seguir", paso["seguir"]))
        elif "anclaje" in paso:
            p = modelo.punto(paso["anclaje"], paso["punto"], paso.get("cerca_de"))
            if "rodear" in paso:
                p = modelo.rodear(paso["anclaje"], p, paso["rodear"], lado if paso.get("cara_lateral") else None)
                p = _empujar(modelo, _empujar(modelo, p))  # el punto rodeado no cae dentro de un órgano vecino
                en_gancho = id_ruta == GANCHO[0] and p[1] <= modelo.y_cima_arco()
                e = modelo.excede(p, en_gancho)
                if e is not None:
                    raise Atraviesa(f"{id_ruta}: el control de {paso['anclaje']} queda {e[1] * 1000:.2f} mm dentro de {e[0]}", p)
            fijos.append(p)
        else:
            raise ValueError(f"Paso sin tipo conocido: {paso}")
    res = []
    for i, p in enumerate(fijos):
        if isinstance(p, tuple):
            if i == 0 or i == len(fijos) - 1 or isinstance(fijos[i - 1], tuple) or isinstance(fijos[i + 1], tuple):
                raise ValueError(f"'{p[0]}' necesita un punto fijo antes y otro después: {ruta['pasos']}")
            antes, despues = fijos[i - 1], fijos[i + 1]
            if p[0] == "seguir":
                res.extend(modelo.seguir(p[1]["anclaje"], p[1]["cara"], antes[1], despues[1]))
            else:
                res.extend(modelo.surco_tramo(p[1], antes[1], despues[1]))
        else:
            res.append(p)
    return res


def catmull_rom(control, paso=PASO_MUESTREO):
    """Curva suave que pasa por todos los puntos de control, muestreada cada `paso` metros."""
    if len(control) < 2:
        return control
    ext = [control[0]] + control + [control[-1]]
    res = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]

        def en(t):
            t2, t3 = t * t, t * t * t
            return [
                0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                       + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
                for j in range(3)
            ]

        res.extend((en(k / 256), k == 0) for k in range(256))
    res.append((control[-1], True))
    return [[round(v, 6) for v in p] for p in remuestrear(res, paso)]


def remuestrear(pts, paso):
    """Un punto cada `paso` a lo largo de la curva, sin perder ningún punto de control.
    `pts` son pares (punto, es_control) muy juntos."""
    res = [pts[0][0]]
    acumulado = 0.0
    for (a, _), (b, es_control) in zip(pts, pts[1:]):
        acumulado += math.dist(a, b)
        if acumulado >= paso or es_control:
            res.append(b)
            acumulado = 0.0
    return res


def _empujar(modelo, p):
    """p llevado fuera de los órganos en los que está dentro: los tubos en dirección radial hasta radio + h, las
    cajas por la cara más cercana hasta cara + h, los pulmones en horizontal hasta el segmento más cercano de su
    sección + h."""
    h = modelo.radio_nervio * HOLGURA
    p = list(p)
    for nombre in OBSTACULOS_TUBO:
        a = modelo.ancla(nombre)
        if not (a["caja"][0][1] - a["radio"] - h <= p[1] <= a["caja"][1][1] + a["radio"] + h):
            continue
        d, q = dist_a_polilinea(p, a["puntos"])
        if d < a["radio"] + h and d > 1e-12:
            p = [q[i] + (p[i] - q[i]) / d * (a["radio"] + h) for i in range(3)]
    for nombre in OBSTACULOS_CAJA:
        c = modelo._caja_efectiva(nombre, p[1])
        if c is None or modelo.profundidad(nombre, p) <= 0:
            continue
        caras = [(p[0] - c[0], 0, c[0] - h), (c[1] - p[0], 0, c[1] + h), (p[2] - c[2], 2, c[2] - h), (c[3] - p[2], 2, c[3] + h)]
        _, eje, valor = min(caras, key=lambda f: f[0])
        p[eje] = valor
    for nombre in PULMONES:
        if nombre not in modelo.pulmones:
            continue
        d, qx, qz = modelo._medida_pulmon(nombre, p)
        if d > 1e-12:
            # Hacia el segmento más cercano y h más allá: ahí termina el pulmón y empieza el aire.
            ux, uz = (qx - p[0]) / d, (qz - p[2]) / d
            p[0], p[2] = qx + ux * h, qz + uz * h
    return p


def _redondear(p):
    return [round(v, 6) for v in p]


def _partir_largos(modelo, res, tocado, fijo, y_cima):
    """Parte por la mitad todo tramo de más de SALTO_MAXIMO (hasta 8 rondas). El punto nuevo también se empuja: empujar
    dos veces puede pasar de un órgano a otro (la tráquea y el arco están pegados) y se queda el candidato que menos
    se pasa de su tolerancia."""
    for _ronda in range(8):
        gancho = indices_gancho(res, y_cima) if y_cima is not None else set()
        nuevo, nuevo_tocado, nuevo_fijo, partido = [res[0]], [tocado[0]], [fijo[0]], False
        for i, (a, b) in enumerate(zip(res, res[1:])):
            if math.dist(a, b) > SALTO_MAXIMO:
                m = [(a[k] + b[k]) / 2 for k in range(3)]
                candidatos = [m]
                for _pasada in range(2):
                    candidatos.append(_empujar(modelo, candidatos[-1]))
                m = min(candidatos, key=lambda q: modelo.exceso(q, i in gancho))
                nuevo.append(_redondear(m))
                nuevo_tocado.append(True)
                nuevo_fijo.append(False)
                partido = True
            nuevo.append(b)
            nuevo_tocado.append(tocado[i + 1])
            nuevo_fijo.append(fijo[i + 1])
        res, tocado, fijo = nuevo, nuevo_tocado, nuevo_fijo
        if not partido:
            break
    return res, tocado, fijo


def despejar(modelo, puntos, control, id_ruta):
    """Saca de los órganos los puntos de la curva que se pasan de su tolerancia y deja la ruta sin quiebres. Nunca mueve
    un punto que coincide con un control. Empuja solo los puntos con exceso (tolerancia_de, con la del gancho en la ruta
    GANCHO) y después, hasta RONDAS_SUAVIZADO rondas: suaviza (promedio de los vecinos, a medias) los VENTANA_SUAVIZADO
    puntos a cada lado de lo empujado o de un giro de más de GIRO_MAXIMO, vuelve a empujar lo que se pasó y parte los
    tramos de más de SALTO_MAXIMO. Termina cuando no queda exceso ni giro. Si al final queda un punto fuera de tolerancia
    lanza Atraviesa; si queda un giro de más de GIRO_MAXIMO, Quiebre."""
    fijos = [[round(v, 6) for v in c] for c in control]
    res = [list(p) for p in puntos]
    fijo = [any(math.dist(p, c) < 1e-9 for c in fijos) for p in res]
    tocado = [False] * len(res)
    y_cima = modelo.y_cima_arco() if id_ruta == GANCHO[0] else None

    def excesos(pts):
        gancho = indices_gancho(pts, y_cima) if y_cima is not None else set()
        return [modelo.exceso(p, i in gancho) for i, p in enumerate(pts)]

    def empujar_pasados(pts):
        for i, e in enumerate(excesos(pts)):
            if e > 0 and not fijo[i]:
                pts[i] = _redondear(_empujar(modelo, pts[i]))
                tocado[i] = True

    empujar_pasados(res)
    res, tocado, fijo = _partir_largos(modelo, res, tocado, fijo, y_cima)
    for _ronda in range(RONDAS_SUAVIZADO):
        quiebres = [i for i, g in giros(res) if g > GIRO_MAXIMO]
        if not quiebres and max(excesos(res)) <= 0:
            break
        objetivo = set()
        for i in [i for i, t in enumerate(tocado) if t] + quiebres:
            objetivo.update(range(max(1, i - VENTANA_SUAVIZADO), min(len(res) - 1, i + VENTANA_SUAVIZADO + 1)))
        nuevo = [list(p) for p in res]
        for i in objetivo:
            if not fijo[i]:
                medio = [(res[i - 1][k] + res[i + 1][k]) / 2 for k in range(3)]
                nuevo[i] = _redondear([res[i][k] + 0.5 * (medio[k] - res[i][k]) for k in range(3)])
        res = nuevo
        empujar_pasados(res)
        res, tocado, fijo = _partir_largos(modelo, res, tocado, fijo, y_cima)
    comprobar_despeje(modelo, res, id_ruta)
    comprobar_giros(res, id_ruta)
    return res


def comprobar_despeje(modelo, puntos, id_ruta):
    """Lanza Atraviesa nombrando ruta, órgano y altura si algún punto pasa de la tolerancia de un órgano (la del gancho
    en los puntos del gancho)."""
    y_cima = modelo.y_cima_arco() if id_ruta == GANCHO[0] else None
    gancho = indices_gancho(puntos, y_cima) if y_cima is not None else set()
    peor = None
    for i, p in enumerate(puntos):
        e = modelo.excede(p, i in gancho)
        if e is not None and (peor is None or e[1] - tolerancia_de(e[0], i in gancho) > peor[1] - tolerancia_de(peor[0], peor[4])):
            peor = (e[0], e[1], p[1], p, i in gancho)
    if peor is not None:
        raise Atraviesa(f"{id_ruta} pasa {peor[1] * 1000:.2f} mm dentro de {peor[0]} en y = {peor[2] * 1000:.1f} mm", peor[3])


def comprobar_giros(puntos, id_ruta):
    """Lanza Quiebre si algún giro entre segmentos seguidos pasa de GIRO_MAXIMO."""
    quiebres = giros(puntos)
    if quiebres:
        i, grados = max(quiebres, key=lambda g: g[1])
        if grados > GIRO_MAXIMO:
            raise Quiebre(f"{id_ruta} gira {grados:.1f}° en y = {puntos[i][1] * 1000:.1f} mm")


def generar(datos_anclajes, rutas_yaml, pulmones=None):
    modelo = Modelo(datos_anclajes, pulmones)
    salida = {"unidad": "metro", "ejes": "glTF (Y arriba, +X izquierda del cuerpo)", "anterior_z": modelo.anterior,
              "fuentes": rutas_yaml["fuentes"], "rutas": {}}
    todas = rutas_yaml["rutas"]
    for id_ruta, ruta in todas.items():
        if ruta["revision"]["estado"] not in ESTADOS:
            raise ValueError(f"{id_ruta}: estado de revisión desconocido {ruta['revision']['estado']!r}")
    for id_ruta, ruta in todas.items():
        for ref in sorted(dependencias(ruta)):
            if ref not in todas:
                raise FaltaRuta(f"{id_ruta}: falta la ruta '{ref}' en rutas-vago.yaml")
    # Se resuelven en orden de dependencia: cada pasada toma las rutas cuyas dependencias ya están hechas.
    hechas = {}
    pendientes = list(todas)
    while pendientes:
        listas = [i for i in pendientes if dependencias(todas[i]) <= hechas.keys()]
        if not listas:
            raise ValueError(f"Dependencia circular entre rutas: {', '.join(pendientes)}")
        for id_ruta in listas:
            ruta = todas[id_ruta]
            control = resolver(modelo, ruta, hechas, id_ruta)
            puntos = despejar(modelo, catmull_rom(control), control, id_ruta)
            resuelta = {
                "nombre": ruta["nombre"],
                "lado": ruta["lado"],
                "entrada": ruta["entrada"],
                "revision": ruta["revision"],
                "radio": [modelo.radio_nervio, round(modelo.radio_nervio * FINAL_GROSOR, 6)],
                "control": [[round(v, 6) for v in p] for p in control],
                "puntos": puntos,
            }
            reemplaza = banda(modelo, id_ruta, ruta)
            if reemplaza is not None:
                resuelta["reemplaza"] = reemplaza
            hechas[id_ruta] = resuelta
        pendientes = [i for i in pendientes if i not in hechas]
    # La salida conserva el orden del YAML. Nada se escribe aquí: si algo falló, ya se lanzó.
    salida["rutas"] = {i: hechas[i] for i in todas}
    return salida


def generar_y_escribir(datos_anclajes, rutas_yaml, destino, pulmones=None):
    """Genera y, solo si terminó sin error, escribe el JSON en `destino`."""
    salida = generar(datos_anclajes, rutas_yaml, pulmones)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=0)
        f.write("\n")
    return salida


def main():
    import yaml

    borrador = "--borrador" in sys.argv
    with open(RAIZ / "rutas-vago.yaml", encoding="utf-8") as f:
        rutas = yaml.safe_load(f)
    ruta_anclajes = RAIZ / "anclajes-vago.json"
    if not ruta_anclajes.exists():
        raise SystemExit("Falta pipeline/anclajes-vago.json: corre primero pipeline/auditar-vago.py")
    with open(ruta_anclajes, encoding="utf-8") as f:
        anclajes = json.load(f)
    pulmones = cargar_pulmones(SALIDA_PULMONES)
    destino = (RAIZ / "salida" / "rutas-vago-borrador.json") if borrador else PUBLICADO
    try:
        salida = generar_y_escribir(anclajes, rutas, destino, pulmones)
    except (FaltaAnclaje, FaltaRuta, Atraviesa, Quiebre) as e:
        raise SystemExit(str(e)) from e
    print(f"{len(salida['rutas'])} rutas en {destino}")


if __name__ == "__main__":
    main()
