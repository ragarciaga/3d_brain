"""Nombres de las piezas que la auditoría del vago puede citar como cercanas a un trazo (spec 04, issue 219).

pipeline/auditar-vago.py mide 24 anclajes con el nombre de la malla de Z-Anatomy ("Olive.l", "Thoracic aorta").
La evidencia de cada trazo (src/data/trazos-vago.json) los cita con el nombre de la pieza en la app, en español y
en inglés, no con el nombre crudo de la malla. Este script arma la tabla de esos nombres. No usa bpy.

- Si la malla está en pipeline/mapeo.csv (la pieza ya está en la app), el nombre sale de src/data/estructuras.json,
  igual que lo muestra la app; el lado va aparte ("l" o "r") y el aplicador (scripts/lib/trazos.ts) lo escribe como
  lo hace nombrePieza de src/lib/nombres.ts: "Oliva (izquierdo)".
- Si no, el nombre sale de Terminologia Anatomica 2 (TA2.csv de Z-Anatomy) por coincidencia exacta del nombre inglés,
  como en pipeline/mapear.py. Si no hay coincidencia exacta se busca "(<nombre>)", el término que TA2 trae entre
  paréntesis, y se quitan los paréntesis exteriores; la fuente de ese nombre lo dice. El texto de TA2 se copia tal cual.
- Si una pieza no tiene nombre, el script falla y la nombra. Nunca se inventa un nombre.

Entradas: pipeline/anclajes-vago.json (las mallas), pipeline/mapeo.csv, src/data/estructuras.json y la copia de
TA2.csv de pipeline/.cache (python pipeline/descargar.py). Salida: pipeline/nombres-anclajes.json.

Uso: python pipeline/nombrar-anclajes.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comun  # noqa: E402

PENDIENTE = "PENDIENTE"
FUENTE_APP = "src/data/estructuras.json"
FUENTE_TA2 = "TA2 (Z-Anatomy)"
FUENTE_TA2_PARENTESIS = FUENTE_TA2 + ", término entre paréntesis"
ENTRADA = comun.RAIZ / "anclajes-vago.json"
ESTRUCTURAS = comun.RAIZ.parent / "src" / "data" / "estructuras.json"
SALIDA = comun.RAIZ / "nombres-anclajes.json"


class SinNombre(Exception):
    """Una pieza no tiene nombre en la app ni en TA2."""


def _sin_parentesis(texto):
    """'(Nodo del ligamento arterioso)' -> 'Nodo del ligamento arterioso'; lo demás queda igual."""
    if texto.startswith("(") and texto.endswith(")"):
        return texto[1:-1].strip()
    return texto


def nombre_de(malla, filas_mapeo, estructuras, ta2):
    """{es, en, lado, fuente, pieza?} de una malla. Lanza SinNombre si no se puede nombrar."""
    base, lado = comun.nombre_base(malla)
    fila = next((f for f in filas_mapeo if f["nombre_malla"] == malla), None)
    if fila is not None:
        entrada = estructuras.get(fila["estructura"])
        if entrada is None:
            raise SinNombre(f"{malla}: está en mapeo.csv pero {fila['estructura']} no está en {FUENTE_APP}")
        es, en = entrada["nombre"]["es"], entrada["nombre"]["en"]
        if not es or not en or PENDIENTE in (es, en):
            raise SinNombre(f"{malla}: el nombre de {fila['estructura']} en {FUENTE_APP} es {PENDIENTE}")
        return {"es": es, "en": en, "lado": fila["lado"], "fuente": FUENTE_APP, "pieza": fila["pieza"]}
    clave = base.lower()
    hit, fuente = ta2.get(clave), FUENTE_TA2
    if hit is None:
        hit, fuente = ta2.get(f"({clave})"), FUENTE_TA2_PARENTESIS
    if hit is None:
        raise SinNombre(f"{malla}: no está en mapeo.csv ni en TA2 con el nombre '{base}' (ni '({base})')")
    es = _sin_parentesis(hit[1])
    if not es or es == PENDIENTE:
        raise SinNombre(f"{malla}: TA2 no trae el nombre en español de '{base}'")
    return {"es": es, "en": base, "lado": lado, "fuente": fuente}


def nombrar(mallas, filas_mapeo, estructuras, ta2):
    """{malla: nombre} de todas las mallas, ordenadas. Lanza SinNombre ante la primera sin nombre."""
    return {malla: nombre_de(malla, filas_mapeo, estructuras, ta2) for malla in sorted(mallas)}


def escribir(tabla, ruta=SALIDA):
    """Escribe la tabla: claves ordenadas, UTF-8, un salto de línea final, los mismos bytes en cada corrida."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps({"piezas": tabla}, ensure_ascii=False, indent=1, sort_keys=True) + "\n")


def main():
    if not comun.TA2.exists():
        raise SystemExit(f"No existe {comun.TA2}. Corre primero: python pipeline/descargar.py")
    with open(ENTRADA, encoding="utf-8") as f:
        mallas = list(json.load(f)["anclas"])
    with open(ESTRUCTURAS, encoding="utf-8") as f:
        estructuras = json.load(f)["estructuras"]
    try:
        tabla = nombrar(mallas, comun.leer_mapeo(), estructuras, comun.leer_ta2())
    except SinNombre as e:
        raise SystemExit(f"Falta el nombre de una pieza: {e}")
    escribir(tabla)
    de_la_app = sum(1 for v in tabla.values() if "pieza" in v)
    print(f"{len(tabla)} piezas nombradas ({de_la_app} de la app, {len(tabla) - de_la_app} de TA2) en {SALIDA}")


if __name__ == "__main__":
    main()
