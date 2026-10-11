"""Utilidades compartidas del pipeline. Se ejecutan con Blender como módulo (bpy 5.2.2, Python 3.13)
o dentro de Blender con `blender -b --python <script>.py -- <args>`."""
import csv
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
CACHE = RAIZ / ".cache"
COMMIT_Z_ANATOMY = "9de5d6912a1b0df9cab739d57f00e036b0496ddc"
URL_ZIP = f"https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/{COMMIT_Z_ANATOMY}/Z-Anatomy.zip"
URL_TA2 = f"https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/{COMMIT_Z_ANATOMY}/TA2.csv"
# SHA-256 de lo que se descarga en ese commit. descargar.py los verifica antes de usar los archivos.
SHA256_ZIP = "e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736"
SHA256_TA2 = "0f9092a328b27dcd15d696d9f9a4087deb229a1aad21b75876657622de835974"
BLEND = CACHE / "Z-Anatomy" / "Startup.blend"
TA2 = CACHE / "TA2.csv"

# Sufijos de Z-Anatomy que no son geometría de estudio: grupo, rótulo, ancla del rótulo,
# accidentes de superficie (.i) e inserciones musculares (.el, .er).
SUFIJOS_APOYO = (".g", ".t", ".j", ".i", ".el", ".er")

# Raíces de lo que se exporta. Estudio: el encéfalo completo y el vago. Referencia: órganos
# translúcidos del recorrido del vago (SPEC sección 8).
RAIZ_ENCEFALO = "Brain.g"
# Objetos de estudio que Z-Anatomy no cuelga de Brain.g pero que son parte del encéfalo, con el grupo
# que reciben en nuestro árbol. La glándula pineal está en Endocrine glands.g y los plexos coroideos
# en Cranial pia.g. Terminologia Anatomica ubica la pineal en el epitálamo (diencéfalo) y el plexo
# coroideo en el ventrículo lateral, junto a lateral-ventricle-l/r (g-telencephalon).
EXTRAS_ESTUDIO = {
    "Pineal gland": "g-diencephalon",
    "Choroid plexus.l": "g-telencephalon",
    "Choroid plexus.r": "g-telencephalon",
}
VAGO = ("Vagus nerve (X).l", "Vagus nerve (X).r")
RAICES_REFERENCIA = ("Heart.g", "Lungs.g", "Laryngeal cartilages.g", "Trachea", "Oesophagus", "Stomach")


def argumentos():
    """Argumentos después de `--` (convención de Blender)."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def abrir_blend(bpy, ruta=BLEND):
    if not Path(ruta).exists():
        raise SystemExit(f"No existe {ruta}. Corre primero: python pipeline/descargar.py")
    bpy.ops.wm.open_mainfile(filepath=str(ruta), load_ui=False, use_scripts=False)


def es_geometria(o):
    return o.type in ("MESH", "CURVE") and not o.name.endswith(SUFIJOS_APOYO)


def ancestros(o):
    r = []
    p = o.parent
    while p is not None:
        r.append(p)
        p = p.parent
    return r


def nombre_base(nombre):
    """'Hippocampus.l' -> ('Hippocampus', 'l'); 'Hypothalamus' -> ('Hypothalamus', '')."""
    for lado in ("l", "r"):
        if nombre.endswith("." + lado):
            return nombre[: -2], lado
    return nombre, ""


def nombre_grupo(nombre):
    return nombre[:-2] if nombre.endswith(".g") else nombre


def slug(texto):
    import re
    import unicodedata
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t


def leer_ta2(ruta=TA2):
    """Índice por nombre inglés en minúsculas -> (latín, español)."""
    indice = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            partes = linea.strip().strip('"').split(";")
            if len(partes) >= 5 and partes[0].isdigit():
                indice.setdefault(partes[1].strip().lower(), (partes[2].strip(), partes[4].strip()))
    return indice


def leer_mapeo(ruta=RAIZ / "mapeo.csv"):
    with open(ruta, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def asegurar_carpeta(ruta):
    os.makedirs(ruta, exist_ok=True)
