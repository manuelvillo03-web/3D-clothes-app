import pytest

from probador.measurements import BY_KEY, MEASUREMENTS, MeasurementError, validate

BASIC = {"height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98, "inseam": 81}


def test_catalog_is_consistent():
    keys = [m.key for m in MEASUREMENTS]
    assert len(keys) == len(set(keys))
    for m in MEASUREMENTS:
        assert m.min_plausible < m.max_plausible
        assert m.tolerance > 0
        assert m.how_to.endswith(".")


def test_valid_measurements_have_no_warnings():
    assert validate(BASIC) == []


def test_height_and_weight_required():
    with pytest.raises(MeasurementError, match="altura"):
        validate({"weight": 70})


def test_unknown_key():
    with pytest.raises(MeasurementError, match="desconocidas"):
        validate(dict(BASIC, codo=30))


def test_negative_value():
    with pytest.raises(MeasurementError):
        validate(dict(BASIC, chest=-3))


def test_nan_value():
    with pytest.raises(MeasurementError):
        validate(dict(BASIC, chest=float("nan")))


def test_implausible_value_warns_but_does_not_fail():
    warnings = validate(dict(BASIC, chest=170))
    assert len(warnings) == 1 and "Pecho" in warnings[0]


def test_inseam_measured_from_waist_is_caught():
    warnings = validate(dict(BASIC, inseam=105))
    assert any("entrepierna" in w.lower() for w in warnings)


def test_underbust_bigger_than_chest_is_caught():
    warnings = validate(dict(BASIC, underbust=100))
    assert any("bajo pecho" in w.lower() for w in warnings)


def test_basic_form_fields():
    basic = {m.key for m in MEASUREMENTS if m.basic}
    assert basic == set(BASIC)
    assert BY_KEY["weight"].unit == "kg"
