"""Rutas trazadas del vago (ADR 0009, fases C y D). Lee pipeline/rutas-vago.yaml y los anclajes que
midió pipeline/auditar-vago.py, y calcula los puntos de cada ruta. No hay coordenadas escritas a mano:
todo sale de los anclajes. No usa Blender, así que se prueba sin él (pipeline/tests/).

Salida:
- pipeline/rutas-vago-puntos.json, solo si la revisión docente del YAML dice "aprobada".
- pipeline/salida/rutas-vago-borrador.json con --borrador, para ver la ruta antes de aprobarla.

La prueba de las cuatro asimetrías (tests/asimetrias.test.ts) corre en CI sobre esos puntos y falla
si alguna no se cumple o si falta un anclaje.

Uso: python pipeline/generar-ramas-vago.py [--borrador]
"""
import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
PASO_MUESTREO = 0.002  # un punto cada 2 mm a lo largo de la ruta
HOLGURA = 1.5  # el nervio pasa a 1,5 de su radio de la superficie del anclaje
FINAL_GROSOR = 0.6  # el grosor baja del tronco hacia lo distal hasta el 60 %
SIDE = {"izquierdo": 1, "derecho": -1}  # +X es la izquierda del cuerpo en el modelo


class FaltaAnclaje(Exception):
    pass


def sumar(a, b):
    return [a[i] + b[i] for i in range(3)]


def escalar(a, k):
    return [a[i] * k for i in range(3)]


def centro_caja(c):
    return [(c[0][i] + c[1][i]) / 2 for i in range(3)]


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

    def corte(self, nombre, y):
        """Caja de la superficie del anclaje en la franja más cercana a la altura y."""
        cortes = self.ancla(nombre)["cortes"]
        return min(cortes, key=lambda c: abs(c["y"] - y))["caja"]

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
        cortes = a["cortes"]
        if cual in ("mas_bajo", "extremo_inferior"):
            return centro_caja(cortes[0]["caja"])
        if cual == "mas_alto":
            return centro_caja(cortes[-1]["caja"])
        if cual == "centro":
            return centro_caja(a["caja"])
        raise ValueError(f"Punto desconocido: {cual}")

    def altura(self, ref):
        return self.punto(ref["anclaje"], ref["punto"])[1]

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
            borde = c[1][2] if s > 0 else c[0][2]
            q[2] = borde + s * h
            if lado:  # entra por la cara posterolateral o anterolateral
                q[0] = c[1][0] if SIDE[lado] > 0 else c[0][0]
        else:
            raise ValueError(f"No sé rodear hacia '{hacia}'")
        return q

    def surco(self, lado, y):
        """Surco traqueoesofágico: al costado de la tráquea, entre su cara posterior y la anterior del esófago."""
        t = self.corte("Trachea", y)
        e = self.corte("Oesophagus", y)
        x = t[1][0] if SIDE[lado] > 0 else t[0][0]
        posterior_traquea = t[0][2] if self.anterior > 0 else t[1][2]
        anterior_esofago = e[1][2] if self.anterior > 0 else e[0][2]
        return [x, y, (posterior_traquea + anterior_esofago) / 2]

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


def en_polilinea_a_altura(pts, y):
    """Primer punto (de arriba hacia abajo) donde la polilínea cruza la altura y."""
    orden = pts if pts[0][1] >= pts[-1][1] else list(reversed(pts))
    for a, b in zip(orden, orden[1:]):
        if (a[1] - y) * (b[1] - y) <= 0 and a[1] != b[1]:
            t = (a[1] - y) / (a[1] - b[1])
            return [a[i] + (b[i] - a[i]) * t for i in range(3)]
    raise FaltaAnclaje(f"El tronco del vago no llega a la altura {y:.3f} m")


def resolver(modelo, ruta):
    """Pasos del YAML a puntos de control. 'seguir' se expande entre el paso anterior y el siguiente."""
    lado = ruta["lado"]
    fijos = []
    for paso in ruta["pasos"]:
        if "desde_vago" in paso:
            tronco = modelo.tronco(paso["desde_vago"])
            if paso.get("punto") == "extremo_inferior":
                fijos.append(min(tronco, key=lambda p: p[1]))
            else:
                fijos.append(en_polilinea_a_altura(tronco, modelo.altura(paso["a_la_altura_de"])))
        elif "surco" in paso:
            fijos.append(modelo.surco(paso["surco"], modelo.altura(paso["a_la_altura_de"])))
        elif "seguir" in paso:
            fijos.append(("seguir", paso["seguir"]))
        elif "anclaje" in paso:
            p = modelo.punto(paso["anclaje"], paso["punto"], paso.get("cerca_de"))
            if "rodear" in paso:
                p = modelo.rodear(paso["anclaje"], p, paso["rodear"], lado if paso.get("cara_lateral") else None)
            fijos.append(p)
        else:
            raise ValueError(f"Paso sin tipo conocido: {paso}")
    res = []
    for i, p in enumerate(fijos):
        if isinstance(p, tuple):
            antes, despues = fijos[i - 1], fijos[i + 1]
            res.extend(modelo.seguir(p[1]["anclaje"], p[1]["cara"], antes[1], despues[1]))
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


def generar(datos_anclajes, rutas_yaml):
    modelo = Modelo(datos_anclajes)
    salida = {"unidad": "metro", "ejes": "glTF (Y arriba, +X izquierda del cuerpo)", "anterior_z": modelo.anterior,
              "fuentes": rutas_yaml["fuentes"], "rutas": {}}
    for id_ruta, ruta in rutas_yaml["rutas"].items():
        control = resolver(modelo, ruta)
        salida["rutas"][id_ruta] = {
            "nombre": ruta["nombre"],
            "lado": ruta["lado"],
            "radio": [modelo.radio_nervio, round(modelo.radio_nervio * FINAL_GROSOR, 6)],
            "control": [[round(v, 6) for v in p] for p in control],
            "puntos": catmull_rom(control),
        }
    return salida


def main():
    import yaml

    borrador = "--borrador" in sys.argv
    with open(RAIZ / "rutas-vago.yaml", encoding="utf-8") as f:
        rutas = yaml.safe_load(f)
    estado = rutas["revision_docente"]["estado"]
    if estado != "aprobada" and not borrador:
        raise SystemExit("rutas-vago.yaml no tiene revisión docente aprobada. Para verla antes: --borrador")
    ruta_anclajes = RAIZ / "anclajes-vago.json"
    if not ruta_anclajes.exists():
        raise SystemExit("Falta pipeline/anclajes-vago.json: corre primero pipeline/auditar-vago.py")
    with open(ruta_anclajes, encoding="utf-8") as f:
        anclajes = json.load(f)
    try:
        salida = generar(anclajes, rutas)
    except FaltaAnclaje as e:
        raise SystemExit(str(e)) from e
    destino = (RAIZ / "salida" / "rutas-vago-borrador.json") if borrador else (RAIZ / "rutas-vago-puntos.json")
    destino.parent.mkdir(exist_ok=True)
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=0)
        f.write("\n")
    print(f"{len(salida['rutas'])} rutas en {destino}")


if __name__ == "__main__":
    main()
