"""Tests del maniquí. Cargan el modelo de cuerpo real (lentos)."""

import pytest

from probador.body import BodyModel, initial_phenotype, mesh_to_glb

pytestmark = pytest.mark.slow

CASES = [
    ("male", {"height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98, "inseam": 81}),
    ("female", {"height": 165, "weight": 60, "chest": 90, "waist": 70, "hip": 97, "inseam": 76}),
    ("male", {"height": 185, "weight": 95, "chest": 110, "waist": 100, "hip": 106,
              "inseam": 85, "shoulder_width": 42, "sleeve_length": 64, "neck": 41,
              "thigh": 60, "upper_arm": 34}),
]


@pytest.fixture(scope="module")
def model():
    return BodyModel.get()


@pytest.mark.parametrize("sex,measurements", CASES)
def test_fit_reproduces_measurements(model, sex, measurements):
    fit = model.fit(sex, measurements)
    # Requisito: error de 1 cm o menos en los contornos y longitudes.
    for key, err in fit.residuals.items():
        if key == "weight":
            assert abs(err) <= 3.5, (key, err)
        else:
            assert abs(err) <= 1.0, (key, err)
    assert fit.warnings == []
    # Las medidas dadas se devuelven tal cual.
    for key, value in measurements.items():
        assert fit.measurements[key] == value


def test_fit_estimates_missing_measurements(model):
    fit = model.fit(*CASES[0])
    for key in ("thigh", "neck", "shoulder_width", "sleeve_length",
                "torso_length", "front_rise", "waistband_mid"):
        assert key in fit.measurements and fit.measurements[key] > 0
    # La cinturilla de tiro bajo está más abajo y es más ancha que la de tiro alto.
    m = fit.measurements
    assert m["waistband_high"] <= m["waistband_mid"] <= m["waistband_low"]


def test_landmarks_are_ordered(model):
    lm = model.fit(*CASES[1]).landmarks
    assert lm["bust"] > lm["waist"] > lm["hip"] > lm["crotch"] > lm["knee"] > 0


def test_inconsistent_measurements_warn(model):
    # Cintura imposible para ese peso y esa cadera.
    fit = model.fit("male", {"height": 175, "weight": 60, "chest": 90,
                             "waist": 125, "hip": 92, "inseam": 80})
    assert fit.warnings


def test_mesh_roundtrip(model):
    fit = model.fit(*CASES[0])
    vertices, faces = model.mesh_from_params(fit.phenotype, fit.local_changes)
    assert vertices.shape == fit.vertices.shape
    assert abs(vertices[:, 2].max() - 1.78) < 0.01
    glb = mesh_to_glb(vertices, faces)
    assert glb[:4] == b"glTF" and len(glb) < 2_000_000


def test_initial_phenotype_uses_table():
    start = initial_phenotype("male", {"height": 190, "weight": 100})
    default = initial_phenotype("male", {})
    assert start["height"] > 0.6
    assert set(start) == set(default)
