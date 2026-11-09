"""Escribe data/catalog/schema.json a partir del modelo Garment.

    python scripts/export_schema.py
"""

import json
from pathlib import Path

from probador.garments import Garment

OUT = Path(__file__).resolve().parents[2] / "data" / "catalog" / "schema.json"


def schema() -> dict:
    s = Garment.model_json_schema()
    s["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    s["title"] = "Prenda"
    return s


if __name__ == "__main__":
    OUT.write_text(json.dumps(schema(), indent=2, ensure_ascii=False) + "\n")
    print(f"Escrito {OUT}")
