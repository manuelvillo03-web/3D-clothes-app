"""Tests del motor de tallas (no necesitan el modelo 3D)."""

import pytest
from pydantic import ValidationError

from probador.fit import (
    ReferenceGarment,
    classify,
    compare_with_reference,
    fit_garment,
    stretch_fraction,
    waistband_body,
)
from probador.ease import Band
from probador.garments import Garment

# Cuerpo de un hombre de 178 cm como lo devolvería el maniquí.
BODY_M = {
    "height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98,
    "inseam": 81, "thigh": 55, "shoulder_width": 39.5, "sleeve_length": 62.5,
    "neck": 40, "torso_length": 73, "front_rise": 33,
}


def tshirt(cut="regular", composition=None, **extra):
    return Garment(
        brand="Prueba", name="Camiseta básica", category="tshirt", cut=cut,
        composition=composition or {"algodon": 100},
        sizes=[
            {"label": "S", "measurements": {"chest_flat": 50, "length": 68}},
            {"label": "M", "measurements": {"chest_flat": 54, "length": 70}},
            {"label": "L", "measurements": {"chest_flat": 58, "length": 72}},
            {"label": "XL", "measurements": {"chest_flat": 62, "length": 74}},
        ],
        **extra,
    )


def jeans(cut="regular", composition=None):
    return Garment(
        brand="Prueba", name="Vaquero recto", category="jeans", cut=cut,
        composition=composition or {"algodon": 100},
        sizes=[
            {"label": "30", "measurements": {"waist": 80, "hip": 98, "thigh": 58, "inseam": 81}},
            {"label": "32", "measurements": {"waist": 85, "hip": 103, "thigh": 61, "inseam": 81}},
            {"label": "34", "measurements": {"waist": 90, "hip": 108, "thigh": 64, "inseam": 82}},
            {"label": "36", "measurements": {"waist": 95, "hip": 113, "thigh": 67, "inseam": 82}},
        ],
    )


# ---------------------------------------------------------------- formato


def test_flat_measurements_are_doubled():
    g = tshirt()
    assert g.sizes[1].measurements["chest"] == 108


def test_unknown_point_rejected():
    with pytest.raises(ValidationError):
        Garment(brand="x", name="y", category="tshirt",
                sizes=[{"label": "M", "measurements": {"barriga": 100}}])


def test_duplicate_sizes_rejected():
    with pytest.raises(ValidationError):
        Garment(brand="x", name="y", category="tshirt",
                sizes=[{"label": "M", "measurements": {"chest": 100}},
                       {"label": "M", "measurements": {"chest": 104}}])


def test_composition_must_add_up():
    with pytest.raises(ValidationError):
        tshirt(composition={"algodon": 60})


def test_ranges_only_in_body_charts():
    with pytest.raises(ValidationError):
        Garment(brand="x", name="y", category="tshirt", chart_type="garment",
                sizes=[{"label": "M", "measurements": {"chest": (96, 100)}}])


def test_defaults_by_category():
    assert tshirt().sleeve == "short"
    assert jeans().rise == "mid"
    assert jeans().sleeve == "none"


# ---------------------------------------------------------------- piezas


def test_classify_inside_band_is_good():
    assert classify(10, Band(8, 16, 3, 5)) == ("good", 0.0)


def test_tightness_penalised_more_than_looseness():
    band = Band(8, 16, 4, 4)
    _, tight = classify(6, band)
    _, loose = classify(18, band)
    assert tight > loose


def test_classify_thresholds():
    band = Band(8, 16, 4, 5)
    assert classify(5, band)[0] == "snug"
    assert classify(3, band)[0] == "tight"
    assert classify(20, band)[0] == "loose"
    assert classify(22, band)[0] == "very_loose"


def test_elastane_adds_stretch():
    plain = tshirt()
    stretchy = tshirt(composition={"algodon": 95, "elastano": 5})
    assert stretch_fraction(stretchy) > stretch_fraction(plain) > 0


def test_waistband_between_waist_and_hip():
    wb = waistband_body(BODY_M, "mid")
    assert BODY_M["waist"] < wb < BODY_M["hip"]
    assert waistband_body(BODY_M, "high") < wb < waistband_body(BODY_M, "low")


# ---------------------------------------------------------------- tallas


def test_regular_tshirt_recommends_m():
    r = fit_garment(tshirt(), BODY_M)
    assert r.recommended == "M"
    chest = next(z for z in r.sizes[1].zones if z.zone == "chest")
    assert chest.ease_cm == 10 and chest.status == "good"
    assert r.explanation[0] == "Te recomendamos la talla M."


def test_preference_moves_recommendation():
    fitted = fit_garment(tshirt(), BODY_M, "fitted").recommended
    loose = fit_garment(tshirt(), BODY_M, "loose").recommended
    order = ["S", "M", "L", "XL"]
    assert order.index(fitted) <= order.index("M") <= order.index(loose)
    assert fitted != loose


def test_cut_changes_target_ease():
    # Con las mismas medidas, una prenda pensada para llevarse oversize pide
    # más holgura, así que recomienda una talla igual o mayor que si fuera
    # entallada.
    order = ["S", "M", "L", "XL"]
    slim = fit_garment(tshirt(cut="slim"), BODY_M).recommended
    over = fit_garment(tshirt(cut="oversize"), BODY_M).recommended
    assert order.index(over) > order.index(slim)


def test_small_size_marked_tight_for_big_chest():
    big = dict(BODY_M, chest=112)
    r = fit_garment(tshirt(), big)
    s = r.sizes[0]
    assert not s.wearable
    assert r.recommended in {"XL", "L"}


def test_jeans_recommendation():
    # Cinturilla medida en el maniquí a la altura del tiro medio.
    r = fit_garment(jeans(), dict(BODY_M, waistband_mid=85.9))
    assert r.recommended == "32"
    zones = {z.zone for z in r.sizes[0].zones}
    assert zones == {"waist", "hip", "thigh", "inseam"}


def test_stretch_jeans_allow_smaller_size():
    order = ["30", "32", "34", "36"]
    rigid = fit_garment(jeans(), BODY_M, "fitted").recommended
    stretch = fit_garment(jeans(composition={"algodon": 98, "elastano": 2}),
                          BODY_M, "fitted").recommended
    assert order.index(stretch) <= order.index(rigid)


def test_body_chart():
    g = Garment(
        brand="Tienda", name="Camisa", category="shirt", chart_type="body",
        sizes=[
            {"label": "S", "measurements": {"chest": (88, 94), "waist": (76, 82)}},
            {"label": "M", "measurements": {"chest": (94, 100), "waist": (82, 88)}},
            {"label": "L", "measurements": {"chest": (100, 106), "waist": (88, 94)}},
        ],
    )
    r = fit_garment(g, BODY_M)
    assert r.recommended == "M"
    assert r.method == "body_chart"
    assert any("guía de tallas por cuerpo" in w for w in r.warnings)


def test_long_sleeve_compared_from_centre_back():
    shirt = Garment(
        brand="x", name="Camisa", category="shirt",
        sizes=[{"label": "M", "measurements": {
            "chest": 112, "shoulder_width": 45, "sleeve_length": 64, "length": 74}}],
    )
    r = fit_garment(shirt, BODY_M)
    sleeve = next(z for z in r.sizes[0].zones if z.zone == "sleeve_length")
    assert sleeve.garment_cm == pytest.approx(64 + 22.5)
    assert sleeve.body_cm == pytest.approx(62.5 + 19.75, abs=0.1)


def test_short_sleeve_not_compared_with_arm():
    r = fit_garment(tshirt(), dict(BODY_M, sleeve_length=80))
    assert all(z.zone != "sleeve_length" for s in r.sizes for z in s.zones)


def test_no_common_measurements():
    g = Garment(brand="x", name="y", category="tshirt",
                sizes=[{"label": "M", "measurements": {"neck": 40}}])
    r = fit_garment(g, BODY_M)
    assert r.recommended is None and r.confidence == "baja"


def test_between_sizes_message():
    body = dict(BODY_M, chest=101)
    r = fit_garment(tshirt(), body)
    if r.alternative:
        assert any("Estás entre" in line for line in r.explanation)


def test_result_serialises():
    d = fit_garment(tshirt(), BODY_M).to_dict()
    assert d["recommended"] == "M"
    assert "wearable" in d["sizes"][0]
    assert d["engine_version"]


# ---------------------------------------------------------- prenda propia


def test_reference_garment():
    mine = ReferenceGarment(name="tu camiseta azul", category="tshirt",
                            measurements={"chest_flat": 55, "length": 71})
    r = compare_with_reference(tshirt(), mine)
    assert r.recommended == "M"
    assert r.method == "reference"
    assert "tu camiseta azul" in r.explanation[0]


def test_reference_needs_garment_chart():
    g = Garment(brand="x", name="y", category="shirt", chart_type="body",
                sizes=[{"label": "M", "measurements": {"chest": (94, 100)}}])
    with pytest.raises(ValueError):
        compare_with_reference(g, ReferenceGarment(category="shirt",
                                                   measurements={"chest": 110}))
