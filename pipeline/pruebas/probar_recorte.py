"""Pruebas del corte del tronco del vago (ADR 0010) en Blender sin ventana:
    .venv-pipeline/bin/python pipeline/pruebas/probar_recorte.py

Necesita bpy como módulo (pipeline/requirements.txt). La parte B necesita además el .blend de
Z-Anatomy (python pipeline/descargar.py). No escribe en pipeline/cajas.json ni en public/modelos/.

Parte C (sin .blend): `extraer.main()` se detiene antes de abrir el .blend y de escribir nada si
        falta rutas-vago.json o la banda de algún lado.
Parte D (sin .blend): `python pipeline/extraer.py` arranca como script en un proceso nuevo (orden de
        imports) y se detiene en el mismo mensaje de bandas, no con ModuleNotFoundError.
Parte A (bpy, sin .blend): `cortar_banda` sobre una curva sintética en zigzag.
Parte B (con .blend): `cortar_banda` sobre `Vagus nerve (X).r#t02` y `.l#t02` reales y sus `#toque`,
        y `extraer.main()` completo con rutas, cajas y salida temporales.

`verificar` comprueba, contra la malla fuente:
  1. cada vértice de la cortada es original (a 0,1 mm o menos de uno de la fuente) o nuevo: a 1 µm o
     menos de un borde de la banda y a 0,1 mm o menos de una intersección arista-plano de la fuente;
  2. cada vértice fuente fuera de la banda tiene su pareja a 0,1 mm o menos (nada se perdió ni se movió);
  3. ningún vértice queda dentro de la banda;
  4. derecho: queda malla arriba y abajo, la de arriba empieza en y_max y la de abajo termina en y_min
     (a 1 µm); izquierdo: solo arriba, empezando en y_max;
  5. hay vértices nuevos y borrados (el corte no pasa por construcción), y hay vértices nuevos en
     cada borde de la banda, no solo en alguno;
  6. no quedan vértices sueltos."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import kdtree

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "pipeline"))


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


comun = cargar("comun", RAIZ / "pipeline" / "comun.py")
extraer = cargar("extraer", RAIZ / "pipeline" / "extraer.py")

TOL_VERTICE = 1e-4  # 0,1 mm: lo que permite check:modelo
TOL_PLANO = 1e-6  # 1 µm
CAJAS_REPO = RAIZ / "pipeline" / "cajas.json"
pruebas = 0


def afirmar(condicion, mensaje):
    global pruebas
    if not condicion:
        raise AssertionError(mensaje)
    pruebas += 1


def sha256(ruta):
    return hashlib.sha256(Path(ruta).read_bytes()).hexdigest()


def arbol_kd(puntos):
    arbol = kdtree.KDTree(max(len(puntos), 1))
    for i, p in enumerate(puntos):
        arbol.insert(p, i)
    arbol.balance()
    return arbol


def instantanea(me):
    """Copia de lo que importa de una malla: vértices, aristas y vértices que forman caras."""
    return {
        "v": [tuple(v.co) for v in me.vertices],
        "e": [tuple(e.vertices) for e in me.edges],
        "usados": {i for p in me.polygons for i in p.vertices},
    }


def dentro(z, y_max, y_min, tol=TOL_PLANO):
    return z < y_max - tol and (y_min is None or z > y_min + tol)


def comprobar_extremos(zs, y_max, y_min, lado, que):
    """Lo que queda arriba empieza justo en y_max; en el derecho, lo de abajo termina justo en y_min;
    en el izquierdo no queda nada por debajo de y_max. `zs`: las Z de los vértices que dejó el corte."""
    arriba = [z for z in zs if z >= y_max - TOL_PLANO]
    afirmar(arriba, f"{que}: no queda nada por encima de y_max")
    afirmar(abs(min(arriba) - y_max) <= TOL_PLANO, f"{que}: lo de arriba empieza en z = {min(arriba)}, no en y_max = {y_max}")
    if lado == "derecho":
        abajo = [z for z in zs if z <= y_min + TOL_PLANO]
        afirmar(abajo, f"{que}: el derecho no conserva nada por debajo de y_min")
        afirmar(abs(max(abajo) - y_min) <= TOL_PLANO, f"{que}: lo de abajo termina en z = {max(abajo)}, no en y_min = {y_min}")
    else:
        afirmar(all(z >= y_max - TOL_PLANO for z in zs), f"{que}: el izquierdo conserva algo por debajo de y_max")


def verificar(fuente, cortada, y_max, y_min, lado, que):
    """Compara la malla cortada con su fuente (ambas de `instantanea`). Devuelve (nuevos, borrados)."""
    planos = [y_max] if y_min is None else [y_max, y_min]
    arbol_fuente = arbol_kd(fuente["v"])
    # Intersecciones exactas arista-plano de la fuente: dónde puede caer un vértice nuevo.
    cruces = []
    for a, b in fuente["e"]:
        pa, pb = fuente["v"][a], fuente["v"][b]
        for z in planos:
            if (pa[2] - z) * (pb[2] - z) < 0:
                t = (pa[2] - z) / (pa[2] - pb[2])
                cruces.append(tuple(pa[k] + (pb[k] - pa[k]) * t for k in range(3)))
    afirmar(cruces, f"{que}: la banda no cruza ninguna arista de la fuente")
    arbol_cruces = arbol_kd(cruces)

    # 1. Cada vértice de la cortada es original o un cruce arista-plano sobre el borde.
    nuevos = 0
    z_nuevos = []
    for co in cortada["v"]:
        if arbol_fuente.find(co)[2] <= TOL_VERTICE:
            continue
        nuevos += 1
        z_nuevos.append(co[2])
        afirmar(min(abs(co[2] - z) for z in planos) <= TOL_PLANO, f"{que}: vértice nuevo {co} fuera de los bordes de la banda")
        afirmar(arbol_cruces.find(co)[2] <= TOL_VERTICE, f"{que}: vértice nuevo {co} no está sobre la superficie original")

    # 2. Nada fuera de la banda se perdió ni se movió.
    arbol_cortada = arbol_kd(cortada["v"])
    borrados = 0
    for co in fuente["v"]:
        if dentro(co[2], y_max, y_min):
            borrados += 1
            continue
        if not (co[2] >= y_max + TOL_PLANO or (y_min is not None and co[2] <= y_min - TOL_PLANO)):
            continue  # a menos de 1 µm de un borde: es del borde y puede quedar o no
        afirmar(arbol_cortada.find(co)[2] <= TOL_VERTICE, f"{que}: el vértice {co} se perdió o se movió")

    # 3. Ninguno dentro de la banda.
    adentro = [co for co in cortada["v"] if dentro(co[2], y_max, y_min)]
    afirmar(not adentro, f"{que}: {len(adentro)} vértice(s) dentro de la banda, el primero en z = {adentro[0][2] if adentro else ''}")

    # 4. Lo que debe quedar queda.
    zs = [co[2] for co in cortada["v"]]
    comprobar_extremos(zs, y_max, y_min, lado, que)
    # Cada borde de la banda tiene su propio corte: sin el de y_min, las caras que lo cruzan se borran
    # enteras y la parte de abajo empieza en el primer anillo original, no en y_min.
    for z in planos:
        afirmar(any(abs(zn - z) <= TOL_PLANO for zn in z_nuevos), f"{que}: ningún vértice nuevo en el borde z = {z}")

    # 5. El corte hizo algo.
    afirmar(nuevos > 0, f"{que}: el corte no creó vértices nuevos en el borde")
    afirmar(borrados > 0, f"{que}: el corte no borró nada")

    # 6. Sin vértices sueltos.
    afirmar(len(cortada["usados"]) == len(cortada["v"]), f"{que}: quedaron vértices sueltos")
    return nuevos, borrados


def cortar(me, y_max, y_min):
    antes = instantanea(me)
    borrados = extraer.cortar_banda(me, y_max, y_min)
    return antes, instantanea(me), borrados


# ---------------------------------------------------------------------------------------------
# Parte C: casos de error de extraer.main(), sin abrir el .blend
# ---------------------------------------------------------------------------------------------
def esperar_alto(ruta_rutas, textos, tmp, que):
    destino = tmp / "cajas-temporal.json"
    salida = tmp / "salida"
    abrir_blend_real = extraer.abrir_blend

    def abrir_blend_prohibido(*args, **kwargs):
        raise AssertionError(f"{que}: main() abrió el .blend antes de detenerse")

    extraer.abrir_blend = abrir_blend_prohibido  # un AssertionError no lo atrapa el `except SystemExit`
    try:
        extraer.main(ruta_rutas=ruta_rutas, destino_cajas=destino, salida=salida)
    except SystemExit as e:
        mensaje = str(e)
        for t in textos:
            afirmar(t in mensaje, f"{que}: el mensaje {mensaje!r} no nombra {t!r}")
    else:
        raise AssertionError(f"{que}: main() debió detenerse")
    finally:
        extraer.abrir_blend = abrir_blend_real
    afirmar(not destino.exists(), f"{que}: escribió cajas.json")
    afirmar(not (salida / "atlas-crudo.glb").exists(), f"{que}: exportó atlas-crudo.glb")
    afirmar(not salida.exists(), f"{que}: llegó a crear la carpeta de salida")


def parte_c():
    hash_antes = sha256(CAJAS_REPO)
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)

        def escribir(nombre, rutas):
            ruta = tmp / nombre
            ruta.write_text(json.dumps({"rutas": rutas}), encoding="utf-8")
            return ruta

        def reemplaza(lado, y_max, y_min):
            return {"lado": lado, "puntos": [], "reemplaza": {"lado": lado, "y_max": y_max, "y_min": y_min}}

        der = reemplaza("derecho", 1.45, 1.35)
        izq = reemplaza("izquierdo", 1.47, None)

        inexistente = tmp / "no-existe.json"
        esperar_alto(inexistente, [str(inexistente), "generar-ramas-vago.py"], tmp, "archivo inexistente")
        esperar_alto(escribir("vacio.json", {}), ["vacio.json", "derecho"], tmp, "rutas vacías")
        esperar_alto(escribir("solo-der.json", {"vago_toracico_derecho": der}), ["solo-der.json", "izquierdo"], tmp, "solo el derecho")
        esperar_alto(escribir("solo-izq.json", {"vago_toracico_izquierdo": izq}), ["solo-izq.json", "derecho"], tmp, "solo el izquierdo")
        sin_reemplaza = {"lado": "derecho", "puntos": []}
        esperar_alto(escribir("sin-reemplaza.json", {"laringeo_recurrente_derecho": sin_reemplaza, "vago_toracico_izquierdo": izq}),
                     ["sin-reemplaza.json", "derecho"], tmp, "ruta sin reemplaza")
        esperar_alto(escribir("invertida.json", {"vago_toracico_derecho": reemplaza("derecho", 1.30, 1.45), "vago_toracico_izquierdo": izq}),
                     ["invertida.json", "derecho", "y_min"], tmp, "y_min por encima de y_max")
        esperar_alto(escribir("igual.json", {"vago_toracico_derecho": reemplaza("derecho", 1.45, 1.45), "vago_toracico_izquierdo": izq}),
                     ["igual.json", "derecho", "y_min"], tmp, "y_min igual a y_max")
        esperar_alto(escribir("sin-ymax.json", {"vago_toracico_derecho": reemplaza("derecho", None, 1.3), "vago_toracico_izquierdo": izq}),
                     ["sin-ymax.json", "derecho", "y_max"], tmp, "y_max que no es número")
        esperar_alto(escribir("repetida.json", {"a": der, "b": der, "c": izq}), ["repetida.json", "derecho", "dos bandas"], tmp, "dos bandas del mismo lado")

        # Control positivo: un JSON válido da exactamente sus dos bandas y no se detiene.
        valido = escribir("valido.json", {"vago_toracico_derecho": der, "vago_toracico_izquierdo": izq,
                                          "laringeo_recurrente_derecho": sin_reemplaza})
        afirmar(extraer.leer_bandas(valido) == {"derecho": (1.45, 1.35), "izquierdo": (1.47, None)}, "leer_bandas no devolvió las dos bandas")

    afirmar(sha256(CAJAS_REPO) == hash_antes, "pipeline/cajas.json cambió durante la prueba")


# ---------------------------------------------------------------------------------------------
# Parte D: extraer.py corrido como script, en un proceso nuevo
# ---------------------------------------------------------------------------------------------
def parte_d():
    """`python pipeline/extraer.py` es el camino principal (pipeline/README.md). Las otras partes cargan el
    archivo con bpy ya importado y no ven un orden de imports que falla en un proceso limpio (con bpy como
    módulo, `import bmesh` antes de `import bpy` da ModuleNotFoundError). Aquí se corre el archivo real
    con el intérprete de bpy (sys.executable), sin importar bpy antes. La copia temporal del pipeline trae
    un rutas-vago.json sin bandas, así que se detiene en leer_bandas, antes de abrir el .blend, sin
    depender de lo que haya publicado public/modelos/."""
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        (tmp / "pipeline").mkdir()
        for nombre in ("extraer.py", "comun.py"):
            (tmp / "pipeline" / nombre).write_bytes((RAIZ / "pipeline" / nombre).read_bytes())
        (tmp / "public" / "modelos").mkdir(parents=True)
        (tmp / "public" / "modelos" / "rutas-vago.json").write_text('{"rutas": {}}', encoding="utf-8")
        r = subprocess.run([sys.executable, str(tmp / "pipeline" / "extraer.py")], cwd=tmp,
                           capture_output=True, text=True, timeout=300)
        afirmar("ModuleNotFoundError" not in r.stderr and "ImportError" not in r.stderr,
                f"extraer.py no arranca como script: {r.stderr}")
        afirmar(r.returncode != 0, "extraer.py debió detenerse por falta de bandas, pero terminó bien")
        afirmar("falta la banda del vago derecho" in r.stderr,
                f"extraer.py no se detuvo en leer_bandas (código {r.returncode}): {r.stderr}")
        afirmar(not (tmp / "pipeline" / "salida").exists() and not (tmp / "pipeline" / "cajas.json").exists(),
                "extraer.py escribió salida o cajas.json al detenerse")


# ---------------------------------------------------------------------------------------------
# Parte A: curva sintética en zigzag
# ---------------------------------------------------------------------------------------------
# Baja en zigzag: cruza z = 1,45 tres veces (1,80 a 1,40; 1,40 a 1,55; 1,55 a 1,30), con x e y que
# cambian para que las intersecciones no sean triviales.
ZIGZAG = [(0.000, 0.000, 1.80), (0.004, 0.002, 1.40), (0.001, 0.006, 1.55), (0.006, 0.003, 1.30)]


def malla_sintetica(nombre, radio, resolucion):
    curva = bpy.data.curves.new(nombre, "CURVE")
    curva.dimensions = "3D"
    curva.bevel_depth = radio
    curva.bevel_resolution = resolucion
    spline = curva.splines.new("POLY")
    spline.points.add(len(ZIGZAG) - 1)
    for punto, (x, y, z) in zip(spline.points, ZIGZAG):
        punto.co = (x, y, z, 1.0)
    obj = bpy.data.objects.new(nombre, curva)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.update()
    return extraer.malla_horneada(obj, bpy.context.evaluated_depsgraph_get(), nombre)


def parte_a():
    for radio, resolucion, variante in ((0.0005, 4, "visible"), (extraer.RADIO_TOQUE, 1, "toque")):
        que = f"sintética {variante}"

        me = malla_sintetica(f"s-dos-{variante}", radio, resolucion)
        afirmar(len(me.vertices) > 0, f"{que}: la curva no generó malla")
        antes, despues, borrados = cortar(me, 1.45, 1.35)
        afirmar(borrados > 0, f"{que}: la banda de dos bordes no borró nada")
        verificar(antes, despues, 1.45, 1.35, "derecho", f"{que} de dos bordes")

        me = malla_sintetica(f"s-izq-{variante}", radio, resolucion)
        antes, despues, borrados = cortar(me, 1.45, None)
        verificar(antes, despues, 1.45, None, "izquierdo", f"{que} izquierda (y_min nulo)")

        # Una sola cruza: la banda empieza en 1,35, que solo cruza el último tramo.
        me = malla_sintetica(f"s-una-{variante}", radio, resolucion)
        antes, despues, borrados = cortar(me, 1.35, None)
        verificar(antes, despues, 1.35, None, "izquierdo", f"{que} que cruza una vez")

        # Banda por encima de la curva: no corta nada y la malla queda idéntica.
        me = malla_sintetica(f"s-fuera-{variante}", radio, resolucion)
        antes, despues, borrados = cortar(me, 2.5, 2.0)
        afirmar(borrados == 0, f"{que}: una banda sin cruce devolvió {borrados}")
        afirmar(antes["v"] == despues["v"], f"{que}: una banda sin cruce movió o reordenó vértices")
        afirmar(len(antes["e"]) == len(despues["e"]), f"{que}: una banda sin cruce cambió las aristas")


# ---------------------------------------------------------------------------------------------
# Parte B: los troncos reales (necesita el .blend)
# ---------------------------------------------------------------------------------------------
def banda_de_prueba(lado, me):
    """Banda tomada del rango de la malla; solo para la prueba, sin valor anatómico."""
    zs = [v.co.z for v in me.vertices]
    zmin, h = min(zs), max(zs) - min(zs)
    if lado == "derecho":
        return zmin + 0.7 * h, zmin + 0.3 * h
    return zmin + 0.5 * h, None


def verificar_exportada(me, y_max, y_min, lado, que):
    """Sobre una malla que dejó `extraer.main()`: nada dentro de la banda de su lado y lo que debe quedar queda."""
    zs = [v.co.z for v in me.vertices]
    adentro = [z for z in zs if dentro(z, y_max, y_min)]
    afirmar(not adentro, f"{que}: main() dejó {len(adentro)} vértice(s) dentro de la banda {lado}, el primero en z = {adentro[0] if adentro else ''}")
    comprobar_extremos(zs, y_max, y_min, lado, f"{que} (tras main())")


def parte_b():
    comun.abrir_blend(bpy)
    tmp_col = bpy.data.collections.new("_tmp_prueba")
    bpy.context.scene.collection.children.link(tmp_col)
    bandas = {}
    for objeto, lado in (("Vagus nerve (X).r", "derecho"), ("Vagus nerve (X).l", "izquierdo")):
        obj = bpy.data.objects[objeto]
        nombre, me, me_toque = extraer.mallas_de_trazo(obj, 2, tmp_col)
        afirmar(nombre == f"{objeto}#t02" and nombre in extraer.TRONCO, f"{objeto}: el trazo 2 no se llama como el tronco de extraer.TRONCO")
        afirmar(extraer.TRONCO[nombre] == lado, f"{nombre}: TRONCO lo asigna al lado equivocado")
        y_max, y_min = banda_de_prueba(lado, me)
        bandas[lado] = (y_max, y_min)
        for malla, que in ((me, nombre), (me_toque, nombre + "#toque")):
            antes, despues, borrados = cortar(malla, y_max, y_min)
            verificar(antes, despues, y_max, y_min, lado, que)

    comprobar_main_completo(bandas)


def comprobar_main_completo(bandas):
    """extraer.main() completo, con rutas, cajas y salida temporales (el repo no se toca)."""
    hash_antes = sha256(CAJAS_REPO)
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        rutas = {f"vago_toracico_{lado}": {"lado": lado, "puntos": [], "reemplaza": {"lado": lado, "y_max": y_max, "y_min": y_min}}
                 for lado, (y_max, y_min) in bandas.items()}
        ruta_rutas = tmp / "rutas-vago.json"
        ruta_rutas.write_text(json.dumps({"rutas": rutas}), encoding="utf-8")
        extraer.main(ruta_rutas=ruta_rutas, destino_cajas=tmp / "cajas.json", salida=tmp / "salida")
        afirmar((tmp / "salida" / "atlas-crudo.glb").exists(), "main() no exportó atlas-crudo.glb")
        cajas = json.loads((tmp / "cajas.json").read_text(encoding="utf-8"))["cajas"]
        izq = cajas["Vagus nerve (X).l#t02"]
        afirmar(izq[2] >= bandas["izquierdo"][0] - TOL_PLANO, f"la caja del tronco izquierdo baja de y_max: {izq[2]}")
        for nombre in ("Vagus nerve (X).l#t02#toque", "Vagus nerve (X).r#t02", "Vagus nerve (X).r#t02#toque"):
            afirmar(nombre in cajas, f"{nombre} no está en las cajas")
        # Las mallas que dejó main(), con la banda de su lado. Las bandas de los dos lados son distintas a
        # propósito: si main() aplicara la banda de un lado al otro, alguna de estas afirmaciones falla.
        afirmar(abs(bandas["derecho"][0] - bandas["izquierdo"][0]) > 0.01, "las bandas de prueba de los dos lados deben diferir")
        for nombre, lado in extraer.TRONCO.items():
            y_max, y_min = bandas[lado]
            for malla in (nombre, nombre + "#toque"):
                verificar_exportada(bpy.data.objects[malla].data, y_max, y_min, lado, malla)
        afirmar(sha256(CAJAS_REPO) == hash_antes, "pipeline/cajas.json del repo cambió")


def main():
    parte_c()
    parte_d()
    parte_a()
    parte_b()
    print(f"probar_recorte.py: {pruebas} pruebas en verde")


if __name__ == "__main__":
    main()
