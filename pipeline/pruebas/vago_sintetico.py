"""Modelo sintético del vago para probar generar-ramas-vago.py y la prueba de asimetrías sin Blender.
No es anatomía: son tubos y cajas simples con las relaciones de las cuatro asimetrías bien puestas
(glTF: Y arriba, +X izquierda, +Z anterior). Escribe tests/fixtures/vago-sintetico/.

Uso: python pipeline/pruebas/vago_sintetico.py
"""
import importlib.util
import json
import math
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "tests" / "fixtures" / "vago-sintetico"
GROSOR_CORTE = 0.005


def cortes(pts):
    por = {}
    for p in pts:
        por.setdefault(math.floor(p[1] / GROSOR_CORTE), []).append(p)
    return [{"y": round((k + 0.5) * GROSOR_CORTE, 4), "caja": caja(v)} for k, v in sorted(por.items())]


def caja(pts):
    return [[round(min(p[i] for p in pts), 6) for i in range(3)], [round(max(p[i] for p in pts), 6) for i in range(3)]]


def polilinea(control, paso=0.002):
    res = []
    for a, b in zip(control, control[1:]):
        n = max(1, math.ceil(math.dist(a, b) / paso))
        res += [[a[j] + (b[j] - a[j]) * k / n for j in range(3)] for k in range(n)]
    return res + [control[-1]]


def tubo(control, r):
    centro = polilinea(control)
    superficie = []
    for p in centro:
        for k in range(12):
            ang = 2 * math.pi * k / 12
            superficie += [[p[0] + r * math.cos(ang), p[1], p[2] + r * math.sin(ang)],
                           [p[0], p[1] + r * math.cos(ang), p[2] + r * math.sin(ang)]]
    return {"tipo": "CURVE", "puntos": [[round(v, 6) for v in p] for p in centro], "radio": r,
            "caja": caja(superficie), "cortes": cortes(superficie)}


def bloque(minimo, maximo):
    pts = []
    y = minimo[1]
    while y <= maximo[1] + 1e-9:
        for x in (minimo[0], maximo[0]):
            for z in (minimo[2], maximo[2]):
                pts.append([x, y, z])
        y += GROSOR_CORTE / 2
    return {"tipo": "MESH", "caja": caja(pts), "cortes": cortes(pts)}


def modelo():
    anclas = {
        "Medulla oblongata.l": bloque([0.0, 1.53, -0.03], [0.012, 1.58, 0.0]),
        "Medulla oblongata.r": bloque([-0.012, 1.53, -0.03], [0.0, 1.58, 0.0]),
        "Internal jugular vein.l": tubo([[0.035, 1.55, -0.01], [0.03, 1.40, 0.0]], 0.006),
        "Internal jugular vein.r": tubo([[-0.035, 1.55, -0.01], [-0.03, 1.40, 0.0]], 0.006),
        "Laryngopharynx": bloque([-0.015, 1.47, -0.02], [0.015, 1.50, 0.0]),
        "Thyroid cartilage": bloque([-0.02, 1.48, 0.005], [0.02, 1.52, 0.03]),
        "Cricoid cartilage": bloque([-0.013, 1.462, -0.002], [0.013, 1.48, 0.024]),
        "Trachea": bloque([-0.009, 1.355, 0.003], [0.009, 1.462, 0.021]),
        "Oesophagus": tubo([[0.0, 1.48, -0.008], [0.004, 1.30, -0.010], [0.012, 1.21, -0.004]], 0.008),
        "Right subclavian artery": tubo([[-0.02, 1.39, 0.02], [-0.05, 1.415, 0.01], [-0.09, 1.40, 0.0]], 0.004),
        "Left subclavian artery": tubo([[0.015, 1.375, -0.005], [0.04, 1.41, 0.0], [0.08, 1.40, 0.0]], 0.004),
        "Right common carotid artery": tubo([[-0.02, 1.39, 0.02], [-0.025, 1.50, 0.02]], 0.003),
        "Left common carotid artery": tubo([[0.005, 1.38, 0.01], [0.025, 1.50, 0.02]], 0.003),
        "Brachiocephalic trunk": tubo([[-0.005, 1.37, 0.025], [-0.02, 1.39, 0.02]], 0.005),
        "Aortic arch": tubo([[-0.005, 1.33, 0.03], [0.0, 1.38, 0.0], [0.015, 1.36, -0.02], [0.02, 1.32, -0.03]], 0.012),
        "Thoracic aorta": tubo([[0.02, 1.32, -0.03], [0.012, 1.20, -0.022]], 0.011),
        "Node of ligamentum arteriosum": bloque([0.008, 1.325, -0.004], [0.016, 1.335, 0.004]),
        "Left main bronchus": tubo([[0.0, 1.355, 0.012], [0.04, 1.33, 0.006]], 0.006),
        "Right main bronchus": tubo([[0.0, 1.355, 0.012], [-0.035, 1.34, 0.008]], 0.007),
        "Diaphragm": bloque([-0.12, 1.22, -0.08], [0.12, 1.26, 0.08]),
        "Stomach": bloque([0.0, 1.10, -0.04], [0.10, 1.215, 0.04]),
    }
    derecho = polilinea([[-0.006, 1.574, -0.018], [-0.03, 1.50, -0.005], [-0.028, 1.42, -0.002],
                         [-0.015, 1.345, -0.012], [-0.004, 1.25, -0.024], [0.005, 1.13, -0.02]])
    izquierdo = polilinea([[0.006, 1.574, -0.018], [0.03, 1.50, -0.005], [0.028, 1.42, 0.0],
                           [0.02, 1.38, 0.022], [0.012, 1.346, 0.004]])
    trazos = {
        "Vagus nerve (X).r#t00": {"puntos": derecho, "radio": 0.0005},
        "Vagus nerve (X).r#t01": {"puntos": polilinea([[-0.006, 1.576, -0.017], [-0.016, 1.571, -0.015]]), "radio": 0.0005},
        "Vagus nerve (X).l#t00": {"puntos": izquierdo, "radio": 0.0005},
    }
    for t in trazos.values():
        t["puntos"] = [[round(v, 6) for v in p] for p in t["puntos"]]
        t["caja"] = caja(t["puntos"])
    return {"unidad": "metro", "ejes": "glTF (Y arriba, +X izquierda del cuerpo)", "anclas": anclas, "ausentes": [], "trazos": trazos}


def main():
    spec = importlib.util.spec_from_file_location("generar", RAIZ / "pipeline" / "generar-ramas-vago.py")
    generar = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generar)
    datos = modelo()
    with open(RAIZ / "pipeline" / "rutas-vago.yaml", encoding="utf-8") as f:
        rutas = yaml.safe_load(f)
    DESTINO.mkdir(parents=True, exist_ok=True)
    for nombre, contenido in (("anclajes.json", datos), ("puntos.json", generar.generar(datos, rutas))):
        with open(DESTINO / nombre, "w", encoding="utf-8") as f:
            json.dump(contenido, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
    print(f"Escrito {DESTINO}")


if __name__ == "__main__":
    main()
