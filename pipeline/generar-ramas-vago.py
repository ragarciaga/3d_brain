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

Despeje (SPEC F25): ninguna ruta puede pasar por dentro de un órgano. Los órganos son la tráquea, el esófago y
los cartílagos cricoides y tiroides (cajas por franja de altura; donde tráquea y esófago se tocan, la pared
común se parte por la mitad) y nueve arterias y bronquios (tubos con línea central y radio). Tolerancia: 0,5 mm
dentro (el radio del nervio), salvo contra la tráquea y el esófago, 1 mm (decisión del editor, 2026-10-17: el
recurrente va en el surco traqueoesofágico, en contacto con sus paredes). Cómo se logra, en orden:
1. `surco` recorre el tramo entre el paso anterior y el siguiente con un punto cada 5 mm, cada uno el sitio libre
   más cercano al costado de la tráquea (`Modelo.surco`, rejilla de 0,5 mm).
2. `rodear anterior/posterior` sobre un tubo cuya franja abarca dos ramas (el arco aórtico) parte de su línea
   central más el radio (`Modelo._por_linea_central`); los anclajes medidos por cajas (tráquea, esófago,
   cartílagos) nunca usan esa regla, porque su radio de línea central no describe su sección. El control
   rodeado se empuja fuera de cualquier órgano vecino en el que haya caído (`_empujar`).
3. `despejar` saca de los órganos los puntos de la curva (sin mover los controles), parte por la mitad todo
   tramo que el empuje estiró a más de 2,5 mm y, si aún queda algún punto fuera de tolerancia, lanza `Atraviesa`.
4. Si hay un punto fuera de tolerancia, el tramo entre los dos controles que lo contienen se rehace con un camino
   libre por una rejilla (`camino_libre`, A*) y se reintenta hasta `MAX_REENRUTAR` veces; si no hay camino, se
   detiene sin escribir nada.

Uso: python pipeline/generar-ramas-vago.py [--borrador]
"""
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
PASO_RUTA_Y = 0.001  # alto de la rejilla con la que se busca un camino libre entre dos controles
MAX_REENRUTAR = 3  # veces que se rehace el tramo que atraviesa un órgano antes de rendirse
MARGEN_RUTA_Y = 0.010  # y en altura (el camino puede bajar bajo el arco)
MARGEN_RUTA = 0.008  # cuánto se ensancha (en x y z) la zona de búsqueda alrededor de los dos controles
# Órganos que ninguna ruta puede atravesar (SPEC F25). Los cuatro primeros se miden por franjas (caja x/z de
# sus vértices en cada altura); los otros nueve, como tubos (línea central y radio).
OBSTACULOS_CAJA = ("Trachea", "Oesophagus", "Cricoid cartilage", "Thyroid cartilage")
OBSTACULOS_TUBO = (
    "Aortic arch", "Thoracic aorta", "Brachiocephalic trunk",
    "Left common carotid artery", "Right common carotid artery",
    "Left subclavian artery", "Right subclavian artery",
    "Left main bronchus", "Right main bronchus",
)


class FaltaAnclaje(Exception):
    pass


class FaltaRuta(Exception):
    pass


class Atraviesa(ValueError):
    """Un punto de una ruta queda dentro de un órgano más allá de su tolerancia (tolerancia_de)."""

    def __init__(self, mensaje, punto=None):
        super().__init__(mensaje)
        self.punto = punto


def sumar(a, b):
    return [a[i] + b[i] for i in range(3)]


def escalar(a, k):
    return [a[i] * k for i in range(3)]


def centro_caja(c):
    return [(c[0][i] + c[1][i]) / 2 for i in range(3)]


def tolerancia_de(nombre):
    """Hasta cuánto puede entrar un punto de una ruta en ese órgano, en m."""
    return TOLERANCIA_POR_ANCLAJE.get(nombre, TOLERANCIA_DESPEJE)


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


class Modelo:
    """Anclajes y trazos medidos, con los ejes anatómicos sacados de los datos."""

    def __init__(self, datos):
        self.anclas = datos["anclas"]
        self.trazos = datos["trazos"]
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
        perpendicular al eje del tubo. None si la regla de la caja basta."""
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
        return [p[k] + u[k] / nu * (radio + h) for k in range(3)]

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

    def profundidad(self, nombre, p):
        """Cuánto está p dentro del obstáculo, en m: positivo dentro, negativo fuera, -inf si no hay órgano a esa
        altura. Cajas: distancia a la cara más cercana. Tubos: radio menos la distancia a la línea central."""
        if nombre in OBSTACULOS_TUBO:
            a = self.ancla(nombre)
            return a["radio"] - dist_a_polilinea(p, a["puntos"])[0]
        c = self._caja_efectiva(nombre, p[1])
        if c is None:
            return -math.inf
        return min(p[0] - c[0], c[1] - p[0], p[2] - c[2], c[3] - p[2])

    def peor(self, p):
        """(anclaje, profundidad) del obstáculo en el que p está más adentro. Un tubo cuya caja crecida en radio +
        h no contiene la altura no cuenta: queda a más de h de su superficie."""
        h = self.radio_nervio * HOLGURA
        mejor = ("", -math.inf)
        for nombre in OBSTACULOS_CAJA + OBSTACULOS_TUBO:
            if nombre in OBSTACULOS_TUBO:
                a = self.ancla(nombre)
                if not (a["caja"][0][1] - a["radio"] - h <= p[1] <= a["caja"][1][1] + a["radio"] + h):
                    continue
            d = self.profundidad(nombre, p)
            if d > mejor[1]:
                mejor = (nombre, d)
        return mejor

    def exceso(self, p):
        """Cuánto se pasa p de la tolerancia del órgano en el que más se pasa, en m (negativo si no se pasa)."""
        return max(self.profundidad(n, p) - tolerancia_de(n) for n in OBSTACULOS_CAJA + OBSTACULOS_TUBO)

    def excede(self, p):
        """(anclaje, profundidad) del obstáculo en el que p pasa más allá de su tolerancia (el que más se pasa), o
        None si ninguno."""
        mejor = None
        for nombre in OBSTACULOS_CAJA + OBSTACULOS_TUBO:
            d = self.profundidad(nombre, p)
            exceso = d - tolerancia_de(nombre)
            if exceso > 0 and (mejor is None or exceso > mejor[2]):
                mejor = (nombre, d, exceso)
        return None if mejor is None else mejor[:2]

    def surco(self, lado, y):
        """Surco traqueoesofágico a la altura y: al costado de la tráquea, entre su cara posterior y la anterior del
        esófago. Parte del sitio nominal (borde lateral de la tráquea más h, z en el punto medio) y busca, en una
        rejilla de 0,5 mm, el punto más cercano al nominal que quede a h o más de todo órgano. Si no hay ninguno
        libre, el que menos se adentra."""
        t = self.corte("Trachea", y)
        e = self.corte("Oesophagus", y)
        h = self.radio_nervio * HOLGURA
        lateral = SIDE[lado]
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
                puntaje = max(0.0, self.peor(q)[1] + h)
                clave = (puntaje, math.hypot(x - x_nominal, z - z_nominal))
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


def resolver(modelo, ruta, hechas):
    """Pasos del YAML a puntos de control. 'seguir' y 'surco' se expanden entre el paso anterior y el siguiente.
    `hechas` trae las rutas ya generadas (id a salida) para los pasos desde_ruta."""
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
    cajas por la cara más cercana hasta cara + h."""
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
    return p


def camino_libre(modelo, a, b, holgura):
    """Camino de a a b por una rejilla (PASO_REJILLA en x y z, PASO_RUTA_Y en y) cuyas celdas quedan a `holgura` o
    más por debajo de la tolerancia de todo órgano (exceso <= -holgura). A* con 26 vecinos; devuelve la lista de
    celdas como puntos (sin los extremos) o None si no hay camino."""
    import heapq

    x0 = min(a[0], b[0]) - MARGEN_RUTA
    z0 = min(a[2], b[2]) - MARGEN_RUTA
    y0 = min(a[1], b[1]) - MARGEN_RUTA_Y
    nx = int((max(a[0], b[0]) + MARGEN_RUTA - x0) / PASO_REJILLA) + 1
    nz = int((max(a[2], b[2]) + MARGEN_RUTA - z0) / PASO_REJILLA) + 1
    ny = int((max(a[1], b[1]) + MARGEN_RUTA_Y - y0) / PASO_RUTA_Y) + 1

    def punto(c):
        return [x0 + c[0] * PASO_REJILLA, y0 + c[1] * PASO_RUTA_Y, z0 + c[2] * PASO_REJILLA]

    def celda(p):
        return (round((p[0] - x0) / PASO_REJILLA), round((p[1] - y0) / PASO_RUTA_Y), round((p[2] - z0) / PASO_REJILLA))

    libres = {}

    def libre(c):
        if not (0 <= c[0] < nx and 0 <= c[1] < ny and 0 <= c[2] < nz):
            return False
        if c not in libres:
            libres[c] = modelo.exceso(punto(c)) <= -holgura
        return libres[c]

    ini, fin = celda(a), celda(b)
    # Los extremos son controles: se aceptan aunque su celda no cumpla la holgura.
    libres[ini] = libres[fin] = True
    vecinos = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) if (i, j, k) != (0, 0, 0)]

    def paso(d):
        return math.dist((0, 0, 0), (d[0] * PASO_REJILLA, d[1] * PASO_RUTA_Y, d[2] * PASO_REJILLA))

    costo, padre = {ini: 0.0}, {}
    cola = [(math.dist(punto(ini), punto(fin)), ini)]
    while cola:
        _, c = heapq.heappop(cola)
        if c == fin:
            camino = [c]
            while camino[-1] in padre:
                camino.append(padre[camino[-1]])
            return [punto(q) for q in reversed(camino)][1:-1]
        for d in vecinos:
            n = (c[0] + d[0], c[1] + d[1], c[2] + d[2])
            if not libre(n):
                continue
            nuevo = costo[c] + paso(d)
            if nuevo < costo.get(n, math.inf):
                costo[n], padre[n] = nuevo, c
                heapq.heappush(cola, (nuevo + math.dist(punto(n), punto(fin)), n))
    return None


def reenrutar(modelo, control, falla, id_ruta):
    """Control con el tramo que contiene el punto `falla` cambiado por un camino libre (un control cada ~2 mm), o
    None si no hay camino. El tramo es el par de controles seguidos entre los que la curva pasa por `falla`."""
    tramo = min(range(len(control) - 1), key=lambda i: math.dist(falla, control[i]) + math.dist(falla, control[i + 1]) - math.dist(control[i], control[i + 1]))
    a, b = control[tramo], control[tramo + 1]
    for holgura in (0.0005, 0.0):
        camino = camino_libre(modelo, a, b, holgura)
        if camino is not None:
            break
    else:
        return None
    # Un control cada PASO_MUESTREO de camino, para que la curva siga el camino sin cortar esquinas.
    nuevos, acumulado, anterior = [], 0.0, a
    for q in camino:
        acumulado += math.dist(anterior, q)
        anterior = q
        if acumulado >= PASO_MUESTREO:
            nuevos.append([round(v, 6) for v in q])
            acumulado = 0.0
    return control[: tramo + 1] + nuevos + control[tramo + 1 :]


def despejar(modelo, puntos, control, id_ruta):
    """Saca de los órganos los puntos de la curva que quedaron dentro (en dos pasadas), sin mover los que
    coinciden con un punto de control. Después comprueba todos los puntos: si alguno sigue más de
    su tolerancia adentro (tolerancia_de), lanza Atraviesa y no se escribe nada."""
    fijos = [[round(v, 6) for v in c] for c in control]
    res = [list(p) for p in puntos]
    for _ in range(2):
        for i, p in enumerate(res):
            if any(math.dist(p, c) < 1e-9 for c in fijos):
                continue
            res[i] = [round(v, 6) for v in _empujar(modelo, p)]
    # Empujar mueve cada punto por separado: donde un vecino se mueve y el otro no, el tramo se estira. Se parte
    # por la mitad todo tramo de más de SALTO_MAXIMO (el punto nuevo también se empuja) hasta que ninguno lo pase.
    for _ronda in range(8):
        nuevo, partido = [res[0]], False
        for a, b in zip(res, res[1:]):
            if math.dist(a, b) > SALTO_MAXIMO:
                m = [(a[k] + b[k]) / 2 for k in range(3)]
                candidatos = [m]
                for _pasada in range(2):
                    candidatos.append(_empujar(modelo, candidatos[-1]))
                # Empujar dos veces puede pasar de un órgano a otro (la tráquea y el arco están pegados): se queda
                # el candidato que menos se pasa de su tolerancia.
                m = min(candidatos, key=lambda q: modelo.exceso(q))
                nuevo.append([round(v, 6) for v in m])
                partido = True
            nuevo.append(b)
        res = nuevo
        if not partido:
            break
    peor = None
    for p in res:
        e = modelo.excede(p)
        if e is not None and (peor is None or e[1] - tolerancia_de(e[0]) > peor[1] - tolerancia_de(peor[0])):
            peor = (e[0], e[1], p[1], p)
    if peor is not None:
        raise Atraviesa(f"{id_ruta} pasa {peor[1] * 1000:.2f} mm dentro de {peor[0]} en y = {peor[2] * 1000:.1f} mm", peor[3])
    return res


def generar(datos_anclajes, rutas_yaml):
    modelo = Modelo(datos_anclajes)
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
            control = resolver(modelo, ruta, hechas)
            # Si la curva atraviesa un órgano, el tramo que lo hace se rehace por un camino libre y se reintenta.
            puntos = None
            for _intento in range(MAX_REENRUTAR + 1):
                try:
                    puntos = despejar(modelo, catmull_rom(control), control, id_ruta)
                    break
                except Atraviesa:
                    nuevo = reenrutar(modelo, control, sys.exc_info()[1].punto, id_ruta) if _intento < MAX_REENRUTAR else None
                    if nuevo is None:
                        raise
                    control = nuevo
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


def generar_y_escribir(datos_anclajes, rutas_yaml, destino):
    """Genera y, solo si terminó sin error, escribe el JSON en `destino`."""
    salida = generar(datos_anclajes, rutas_yaml)
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
    destino = (RAIZ / "salida" / "rutas-vago-borrador.json") if borrador else PUBLICADO
    try:
        salida = generar_y_escribir(anclajes, rutas, destino)
    except (FaltaAnclaje, FaltaRuta, Atraviesa) as e:
        raise SystemExit(str(e)) from e
    print(f"{len(salida['rutas'])} rutas en {destino}")


if __name__ == "__main__":
    main()
