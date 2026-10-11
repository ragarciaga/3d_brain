"""Descarga Z-Anatomy (commit fijado) y TA2.csv en pipeline/.cache/. Python 3.13 sin Blender."""
import hashlib
import urllib.request
import zipfile

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # para correr también con blender -b --python

from comun import BLEND, CACHE, SHA256_TA2, SHA256_ZIP, TA2, URL_TA2, URL_ZIP, asegurar_carpeta


def bajar(url, destino):
    print(f"Descargando {url}")
    with urllib.request.urlopen(url) as r, open(destino, "wb") as f:
        while bloque := r.read(1 << 20):
            f.write(bloque)


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        while bloque := f.read(1 << 20):
            h.update(bloque)
    return h.hexdigest()


def verificar(ruta, esperado):
    """Compara el SHA-256 del archivo con el fijado en comun.py. Si no coincide, lo borra y se detiene:
    un archivo alterado o incompleto nunca se usa."""
    obtenido = sha256(ruta)
    if obtenido != esperado:
        Path(ruta).unlink(missing_ok=True)
        raise SystemExit(
            f"La suma SHA-256 de {Path(ruta).name} no coincide y el archivo se borró.\n"
            f"  esperada: {esperado}\n  obtenida: {obtenido}\n"
            "Vuelve a correr python pipeline/descargar.py; si se repite, revisa la conexión o el commit fijado en comun.py.")


def main():
    asegurar_carpeta(CACHE)
    if not TA2.exists():
        bajar(URL_TA2, TA2)
    verificar(TA2, SHA256_TA2)
    if not BLEND.exists():
        zip_local = CACHE / "Z-Anatomy.zip"
        if not zip_local.exists():
            bajar(URL_ZIP, zip_local)
        verificar(zip_local, SHA256_ZIP)
        with zipfile.ZipFile(zip_local) as z:
            z.extract("Z-Anatomy/Startup.blend", CACHE)
    print(f"Listo: {BLEND} y {TA2}")


if __name__ == "__main__":
    main()
