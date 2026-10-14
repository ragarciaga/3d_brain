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


class FaltaAnclaje(Exception):
    pass


class FaltaRuta(Exception):
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
    """Pasos del YAML a puntos de control. 'seguir' se expande entre el paso anterior y el siguiente.
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
            resuelta = {
                "nombre": ruta["nombre"],
                "lado": ruta["lado"],
                "entrada": ruta["entrada"],
                "revision": ruta["revision"],
                "radio": [modelo.radio_nervio, round(modelo.radio_nervio * FINAL_GROSOR, 6)],
                "control": [[round(v, 6) for v in p] for p in control],
                "puntos": catmull_rom(control),
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
    except (FaltaAnclaje, FaltaRuta) as e:
        raise SystemExit(str(e)) from e
    print(f"{len(salida['rutas'])} rutas en {destino}")


if __name__ == "__main__":
    main()
