"""Descarga Z-Anatomy (commit fijado) y TA2.csv en pipeline/.cache/. Python 3.13 sin Blender."""
import urllib.request
import zipfile

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import BLEND, CACHE, TA2, URL_TA2, URL_ZIP, asegurar_carpeta


def bajar(url, destino):
    print(f"Descargando {url}")
    with urllib.request.urlopen(url) as r, open(destino, "wb") as f:
        while bloque := r.read(1 << 20):
            f.write(bloque)


def main():
    asegurar_carpeta(CACHE)
    if not TA2.exists():
        bajar(URL_TA2, TA2)
    if not BLEND.exists():
        zip_local = CACHE / "Z-Anatomy.zip"
        if not zip_local.exists():
            bajar(URL_ZIP, zip_local)
        with zipfile.ZipFile(zip_local) as z:
            z.extract("Z-Anatomy/Startup.blend", CACHE)
    print(f"Listo: {BLEND} y {TA2}")


if __name__ == "__main__":
    main()
