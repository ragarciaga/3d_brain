"""Pruebas de pipeline/nombrar-anclajes.py (nombres de las piezas cercanas de la auditoría) sin Blender ni descargas,
con un TA2, un mapeo y unas estructuras sintéticos:
python pipeline/pruebas/probar_nombrar.py
"""
import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "pipeline"))


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


n = cargar("nombrar_anclajes", RAIZ / "pipeline" / "nombrar-anclajes.py")
import comun  # noqa: E402

# 1. No usa bpy, ni en memoria ni en el texto del archivo.
assert "bpy" not in sys.modules, "nombrar-anclajes.py no debe cargar bpy"
texto = open(RAIZ / "pipeline" / "nombrar-anclajes.py", encoding="utf-8").read()
assert not re.search(r"^\s*(import|from)\s+bpy\b", texto, re.M), "nombrar-anclajes.py importa bpy"

# 2. Datos sintéticos con el mismo formato que los reales.
MAPEO = [
    {"nombre_malla": "Olive.l", "pieza": "olive-l", "estructura": "olive", "lado": "l"},
    {"nombre_malla": "Olive.r", "pieza": "olive-r", "estructura": "olive", "lado": "r"},
    {"nombre_malla": "Stomach", "pieza": "stomach", "estructura": "stomach", "lado": ""},
    {"nombre_malla": "Pendiente.l", "pieza": "pendiente-l", "estructura": "pendiente", "lado": "l"},
    {"nombre_malla": "Fantasma", "pieza": "fantasma", "estructura": "fantasma", "lado": ""},
]
ESTRUCTURAS = {
    "olive": {"nombre": {"es": "Oliva", "en": "Olive"}},
    "stomach": {"nombre": {"es": "Estómago", "en": "Stomach"}},
    "pendiente": {"nombre": {"es": "PENDIENTE", "en": "Pendiente"}},
}
TA2_CSV = "\n".join([
    '"id;en;latin;fr;es;pt;it;fa"',
    '"1;Internal jugular vein;Vena jugularis interna;Veine;Vena yugular interna;Veia;Vena;x"',
    '"2;Left main bronchus;Bronchus principalis sinister;Bronche;Bronquio principal izquierdo;B;B;x"',
    '"3;(Node of ligamentum arteriosum);(Nodus ligamenti arteriosi);(L);(Nodo del ligamento arterioso);(N);(L);x"',
    '"4;Sin espanol;Nihil;N;;N;N;x"',
    '"5;Laryngopharynx;Pars laryngea pharyngis;P;Porción laríngea de la farínge;P;P;x"',
])


def ta2():
    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(tmp) / "TA2.csv"
        ruta.write_text(TA2_CSV, encoding="utf-8")
        return comun.leer_ta2(ruta)


TA2 = ta2()
assert "(node of ligamentum arteriosum)" in TA2 and "node of ligamentum arteriosum" not in TA2, "el fixture no es el caso del paréntesis"


def nombre(malla):
    return n.nombre_de(malla, MAPEO, ESTRUCTURAS, TA2)


# 3. Una pieza de la app toma el nombre de estructuras.json, con su lado aparte y el id de la pieza.
assert nombre("Olive.l") == {"es": "Oliva", "en": "Olive", "lado": "l", "fuente": "src/data/estructuras.json", "pieza": "olive-l"}
assert nombre("Olive.r")["lado"] == "r" and nombre("Olive.r")["pieza"] == "olive-r"
assert nombre("Stomach") == {"es": "Estómago", "en": "Stomach", "lado": "", "fuente": "src/data/estructuras.json", "pieza": "stomach"}

# 4. Una pieza fuera de la app sale de TA2 por el nombre inglés exacto: con lado (se separa) y sin lado (viene en el nombre).
assert nombre("Internal jugular vein.l") == {"es": "Vena yugular interna", "en": "Internal jugular vein", "lado": "l",
                                              "fuente": "TA2 (Z-Anatomy)"}
assert nombre("Left main bronchus") == {"es": "Bronquio principal izquierdo", "en": "Left main bronchus", "lado": "",
                                         "fuente": "TA2 (Z-Anatomy)"}
assert "pieza" not in nombre("Left main bronchus")
# El texto de TA2 se copia tal cual, con su ortografía.
assert nombre("Laryngopharynx")["es"] == "Porción laríngea de la farínge"

# 5. El término entre paréntesis: se quitan los paréntesis exteriores y la fuente lo dice.
assert nombre("Node of ligamentum arteriosum") == {
    "es": "Nodo del ligamento arterioso", "en": "Node of ligamentum arteriosum", "lado": "",
    "fuente": "TA2 (Z-Anatomy), término entre paréntesis"}

# 6. Una pieza sin nombre falla nombrándola; nada se inventa.
for malla, texto_error in (("Desconocida", "Desconocida"), ("Sin espanol", "Sin espanol"), ("Pendiente.l", "Pendiente.l"),
                           ("Fantasma", "Fantasma")):
    try:
        nombre(malla)
        raise AssertionError(f"debió fallar con {malla}")
    except n.SinNombre as e:
        assert texto_error in str(e), (malla, str(e))
try:
    n.nombrar(["Olive.l", "Desconocida"], MAPEO, ESTRUCTURAS, TA2)
    raise AssertionError("nombrar debió fallar con una pieza sin nombre")
except n.SinNombre as e:
    assert "Desconocida" in str(e)

# 7. La tabla sale ordenada y escribir da los mismos bytes en cada corrida, con la forma {"piezas": {...}}.
tabla = n.nombrar(["Stomach", "Olive.l", "Left main bronchus"], MAPEO, ESTRUCTURAS, TA2)
assert list(tabla) == sorted(tabla)
with tempfile.TemporaryDirectory() as tmp:
    a, b = Path(tmp) / "a" / "uno.json", Path(tmp) / "b" / "dos.json"
    n.escribir(tabla, a)
    n.escribir(dict(reversed(list(tabla.items()))), b)
    assert a.read_bytes() == b.read_bytes()
    assert a.read_bytes().endswith(b"}\n") and b"\r" not in a.read_bytes()
    leido = json.load(open(a, encoding="utf-8"))
    assert list(leido) == ["piezas"] and leido["piezas"] == tabla
    assert "Estómago" in a.read_text(encoding="utf-8"), "ensure_ascii debe ser False"

# 8. El archivo versionado: una entrada por anclaje que mide auditar-vago.py, con el nombre que la app da a las que tiene.
auditar = open(RAIZ / "pipeline" / "auditar-vago.py", encoding="utf-8").read()
anclajes = re.search(r"^ANCLAJES = \[(.*?)^\]", auditar, re.M | re.S).group(1)
mallas = re.findall(r'^\s*"([^"]+)",', anclajes, re.M)
assert len(mallas) >= 24, mallas
real = json.load(open(RAIZ / "pipeline" / "nombres-anclajes.json", encoding="utf-8"))["piezas"]
assert sorted(real) == sorted(mallas), (set(real) ^ set(mallas))
estructuras_reales = json.load(open(RAIZ / "src" / "data" / "estructuras.json", encoding="utf-8"))["estructuras"]
mapeo_real = {f["nombre_malla"]: f for f in comun.leer_mapeo()}
for malla, v in real.items():
    assert v["es"] and v["en"] and "PENDIENTE" not in (v["es"], v["en"]), malla
    assert sorted(v) in (["en", "es", "fuente", "lado"], ["en", "es", "fuente", "lado", "pieza"]), (malla, sorted(v))
    assert chr(0x2014) not in json.dumps(v, ensure_ascii=False), malla
    if malla in mapeo_real:
        fila = mapeo_real[malla]
        nom = estructuras_reales[fila["estructura"]]["nombre"]
        assert v == {"es": nom["es"], "en": nom["en"], "lado": fila["lado"], "fuente": "src/data/estructuras.json",
                     "pieza": fila["pieza"]}, malla
    else:
        assert "pieza" not in v and v["fuente"].startswith("TA2 (Z-Anatomy)"), malla
        assert v["lado"] == comun.nombre_base(malla)[1], malla
assert len([1 for v in real.values() if "pieza" in v]) == len([m for m in mallas if m in mapeo_real])

print("nombrar-anclajes.py: pruebas en verde")
