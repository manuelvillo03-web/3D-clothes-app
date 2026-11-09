"""El catálogo de ejemplo y el esquema publicado siguen al día con el código."""

import json
from pathlib import Path

import pytest

from probador.fit import fit_garment
from probador.garments import Garment

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "data" / "catalog"
EXAMPLES = sorted((CATALOG / "ejemplos").glob("*.json"))

BODY = {"height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98,
        "inseam": 81, "thigh": 55, "shoulder_width": 39.5, "sleeve_length": 62.5,
        "neck": 40, "torso_length": 73, "waistband_mid": 86}


def test_examples_exist():
    assert len(EXAMPLES) >= 3


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_example_is_valid_and_fits(path):
    garment = Garment.model_validate(json.loads(path.read_text()))
    result = fit_garment(garment, BODY)
    assert result.recommended is not None


def test_schema_is_up_to_date():
    import sys

    sys.path.insert(0, str(ROOT / "engine" / "scripts"))
    from export_schema import schema

    published = json.loads((CATALOG / "schema.json").read_text())
    assert published == schema(), "Ejecuta python engine/scripts/export_schema.py"
