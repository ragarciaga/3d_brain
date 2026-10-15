"""Modelo sintético para probar ubicar-marcadores.py sin Blender (spec 04).
No es anatomía: son cajas, tubos y nubes de puntos simples con los nombres reales de las mallas que usan
las reglas, para probar también los marcadores de lado ({lado}, {Lado}). Ejes glTF (Y arriba, +X izquierda,
+Z anterior), en metros.

modelo() devuelve {nombre: {"vertices": [...], "linea"?: [...]}}. Todo va redondeado a 6 decimales y se
construye por conteo entero (mínimo + i * paso), sin acumular error.
"""
import math


def _r(v):
    return round(v, 6) + 0.0


def caja(minimo, maximo, paso=0.001):
    """Vértices de la superficie de una caja, en malla de 1 mm."""
    n = [round((maximo[a] - minimo[a]) / paso) for a in range(3)]
    vs = []
    for i in range(n[0] + 1):
        for j in range(n[1] + 1):
            for k in range(n[2] + 1):
                if i in (0, n[0]) or j in (0, n[1]) or k in (0, n[2]):
                    vs.append([_r(minimo[0] + i * paso), _r(minimo[1] + j * paso), _r(minimo[2] + k * paso)])
    return vs


def tubo_vertical(x, z, y_arriba, y_abajo, radio, lados=16, paso=0.001):
    """Anillos en XZ cada 1 mm. Con 16 lados los ángulos incluyen +-X y +-Z. `linea` es el centro, de arriba abajo."""
    n = round((y_arriba - y_abajo) / paso)
    vertices, linea = [], []
    for i in range(n + 1):
        y = _r(y_arriba - i * paso)
        linea.append([_r(x), y, _r(z)])
        for k in range(lados):
            ang = 2 * math.pi * k / lados
            vertices.append([_r(x + radio * math.cos(ang)), y, _r(z + radio * math.sin(ang))])
    return {"vertices": vertices, "linea": linea}


def nube(puntos):
    return {"vertices": [[_r(v) for v in p] for p in puntos]}


def espejo(malla):
    """Copia de una nube o caja con x cambiada de signo."""
    return {"vertices": [[_r(-p[0]), p[1], p[2]] for p in malla["vertices"]]}


def modelo():
    m = {}
    # Vagos: tubos delgados. El izquierdo guarda su línea de abajo arriba a propósito, para probar la orientación.
    izq = tubo_vertical(0.03, 0.0, 0.10, 0.0, 0.0005)
    izq["linea"] = list(reversed(izq["linea"]))
    m["Vagus nerve (X).l"] = izq
    m["Vagus nerve (X).r"] = tubo_vertical(-0.03, 0.0, 0.10, 0.0, 0.0005)
    # Venas yugulares internas: el extremo superior de la línea es y = 0,08.
    m["Internal jugular vein.l"] = tubo_vertical(0.04, 0.0, 0.08, 0.0, 0.004)
    m["Internal jugular vein.r"] = tubo_vertical(-0.04, 0.0, 0.08, 0.0, 0.004)
    m["Laryngopharynx"] = {"vertices": caja((-0.027, 0.045, -0.01), (0.027, 0.06, 0.01))}
    # Lejos de la curva del vago (a más de 5 mm de ella y de los puntos que la usan).
    m["Thyroid cartilage"] = {"vertices": caja((-0.01, 0.02, 0.01), (0.01, 0.03, 0.02))}
    m["Oesophagus"] = tubo_vertical(0.0, -0.01, 0.10, 0.0, 0.008)
    m["Diaphragm"] = {"vertices": caja((-0.05, 0.02, -0.05), (0.05, 0.03, 0.05))}
    # Bulbo: mitades con su cara medial a 1 mm del plano medio; olivas con centro común en y = 0,015.
    medulla_l = {"vertices": caja((0.001, 0.0, -0.02), (0.011, 0.03, 0.0))}
    m["Medulla oblongata.l"] = medulla_l
    m["Medulla oblongata.r"] = espejo(medulla_l)
    oliva_l = {"vertices": caja((0.003, 0.01, -0.012), (0.007, 0.02, -0.004))}
    m["Olive.l"] = oliva_l
    m["Olive.r"] = espejo(oliva_l)
    m["Fourth ventricle"] = {"vertices": caja((-0.005, 0.03, -0.01), (0.005, 0.05, -0.006))}
    m["Aqueduct of midbrain"] = {"vertices": caja((-0.001, 0.06, -0.012), (0.001, 0.07, -0.008))}
    # Nube con un extremo único por dirección y un vértice anterosuperior para `polo`.
    m["Nube"] = nube([[0, 0.01, 0], [0, -0.01, 0], [0, 0, 0.01], [0, 0, -0.01], [0.01, 0, 0], [-0.01, 0, 0],
                      [0, 0.008, 0.008]])
    # Caja hueca de 40 mm: su centro queda a más de 5 mm de cualquier vértice.
    m["Prisma"] = {"vertices": caja((-0.02, -0.02, -0.02), (0.02, 0.02, 0.02))}
    # Tálamo: extremos únicos por dirección y el vértice anterosuperior [0,015, 0,012, 0,012].
    talamo_l = nube([[0.015, 0.015, 0.0], [0.015, -0.015, 0.0], [0.015, 0.0, 0.02], [0.015, 0.0, -0.02],
                     [0.015, 0.012, 0.012], [0.02, 0.0, 0.0], [0.01, 0.0, 0.0]])
    m["Thalamus.l"] = talamo_l
    m["Thalamus.r"] = espejo(talamo_l)
    # Caudado y putamen: dos pares de puntos. El par más cercano es el posterior (4,9 mm); si el límite deja
    # solo lo anterior, el par más cercano pasa a ser el anterior (5 mm). Debajo del par anterior hay un
    # punto de cada uno, a 2,5 mm del plano que baja desde el punto medio del par anterior.
    caudado_l = nube([[0.010, 0.010, 0.020], [0.010, 0.003, 0.020], [0.010, 0.010, -0.020]])
    putamen_l = nube([[0.015, 0.010, 0.020], [0.015, 0.004, 0.020], [0.0145, 0.008, -0.020]])
    m["Caudate nucleus.l"] = caudado_l
    m["Caudate nucleus.r"] = espejo(caudado_l)
    m["Putamen.l"] = putamen_l
    m["Putamen.r"] = espejo(putamen_l)
    # Comisura anterior: su extremo posterior (z = 0) queda detrás del par anterior y delante del posterior.
    m["Anterior commissure"] = nube([[-0.005, 0.005, 0.0], [0.005, 0.005, 0.0]])
    # Wernicke: el tercio posterior del plano temporal (z de 0 a 0,01) son los dos primeros puntos, con centro
    # [0,045, 0, 0,0025]; el punto de z = 0,015 queda fuera del tercio y moverlo cambiaría el resultado.
    m["Temporal plane.l"] = nube([[0.045, 0.0, 0.0], [0.045, 0.0, 0.005], [0.045, 0.0, 0.015], [0.045, 0.0, 0.03]])
    m["Superior temporal gyrus (Lateral part).l"] = nube([[0.045, 0.002, 0.0], [0.045, 0.002, 0.008],
                                                          [0.045, 0.002, 0.03]])
    return m
