"""Catálogo de medidas del cuerpo.

Cada medida tiene una clave estable (la que usan la app y la API), su
equivalente en clad-body, un rango plausible para adultos, la tolerancia con
la que el maniquí debe reproducirla y las instrucciones para que el usuario
se la tome. Este módulo es la única fuente de verdad sobre medidas: la app
construye sus formularios a partir de lo que devuelve la API.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Unit = Literal["cm", "kg"]
Kind = Literal["length", "circumference", "scalar"]


@dataclass(frozen=True)
class BodyMeasurement:
    key: str
    clad_key: str
    name: str
    unit: Unit
    kind: Kind
    min_plausible: float
    max_plausible: float
    # Desviación (en la unidad de la medida) que aceptamos entre el maniquí y
    # la medida del usuario. Se usa como escala de los residuos del ajuste.
    tolerance: float
    # Si se puede pedir en el formulario básico (las demás son opcionales).
    basic: bool
    how_to: str
    differentiable: bool = True


MEASUREMENTS: tuple[BodyMeasurement, ...] = (
    BodyMeasurement(
        key="height", clad_key="height_cm", name="Altura", unit="cm",
        kind="scalar", min_plausible=140, max_plausible=210, tolerance=0.5,
        basic=True,
        how_to="Descalzo, de espaldas a una pared, con los talones juntos. "
        "Mide desde el suelo hasta lo más alto de la cabeza.",
    ),
    BodyMeasurement(
        key="weight", clad_key="mass_kg", name="Peso", unit="kg",
        kind="scalar", min_plausible=40, max_plausible=160, tolerance=3.0,
        basic=True,
        how_to="Por la mañana, con ropa ligera.",
    ),
    BodyMeasurement(
        key="chest", clad_key="bust_cm", name="Pecho", unit="cm",
        kind="circumference", min_plausible=70, max_plausible=150, tolerance=0.5,
        basic=True,
        how_to="Pasa la cinta por debajo de las axilas y por la parte más "
        "ancha del pecho, horizontal y sin apretar. Respira con normalidad.",
    ),
    BodyMeasurement(
        key="waist", clad_key="waist_cm", name="Cintura", unit="cm",
        kind="circumference", min_plausible=55, max_plausible=150, tolerance=0.5,
        basic=True,
        how_to="A la altura del ombligo, entre la última costilla y el hueso "
        "de la cadera. Cinta horizontal, sin meter tripa.",
    ),
    BodyMeasurement(
        key="hip", clad_key="hip_cm", name="Cadera", unit="cm",
        kind="circumference", min_plausible=70, max_plausible=160, tolerance=0.5,
        basic=True,
        how_to="Con los pies juntos, por la parte más ancha de los glúteos, "
        "con la cinta horizontal.",
    ),
    BodyMeasurement(
        key="inseam", clad_key="inseam_cm", name="Entrepierna", unit="cm",
        kind="length", min_plausible=60, max_plausible=100, tolerance=0.5,
        basic=True,
        how_to="Descalzo y de pie, desde la entrepierna hasta el suelo, por la "
        "cara interior de la pierna. Más fácil con ayuda o con un libro "
        "apretado contra la entrepierna.",
    ),
    BodyMeasurement(
        key="shoulder_width", clad_key="shoulder_width_cm",
        name="Ancho de hombros", unit="cm", kind="length",
        min_plausible=30, max_plausible=55, tolerance=1.5, basic=False,
        how_to="Por la espalda, de la punta de un hombro a la del otro, "
        "pasando por la base del cuello. Mejor con ayuda.",
    ),
    BodyMeasurement(
        key="sleeve_length", clad_key="sleeve_length_cm", name="Largo de brazo",
        unit="cm", kind="length", min_plausible=45, max_plausible=75,
        tolerance=1.0, basic=False,
        how_to="Con el brazo un poco doblado, desde la punta del hombro, "
        "por fuera del codo, hasta el hueso de la muñeca.",
    ),
    BodyMeasurement(
        key="neck", clad_key="neck_cm", name="Cuello", unit="cm",
        kind="circumference", min_plausible=28, max_plausible=52, tolerance=0.5,
        basic=False,
        how_to="Justo por debajo de la nuez, sin apretar. Útil para camisas.",
    ),
    BodyMeasurement(
        key="upper_arm", clad_key="upperarm_cm", name="Brazo", unit="cm",
        kind="circumference", min_plausible=20, max_plausible=52, tolerance=0.8,
        basic=False,
        how_to="Por la parte más gruesa del brazo, a medio camino entre el "
        "hombro y el codo, con el brazo relajado.",
    ),
    BodyMeasurement(
        key="thigh", clad_key="thigh_cm", name="Muslo", unit="cm",
        kind="circumference", min_plausible=38, max_plausible=85, tolerance=0.5,
        basic=False,
        how_to="Por la parte más gruesa del muslo, justo debajo del glúteo, "
        "con las piernas un poco separadas.",
    ),
    BodyMeasurement(
        key="underbust", clad_key="underbust_cm", name="Bajo pecho", unit="cm",
        kind="circumference", min_plausible=58, max_plausible=135,
        tolerance=0.5, basic=False,
        how_to="Justo por debajo del pecho, donde va la banda del sujetador.",
    ),
    BodyMeasurement(
        key="stomach", clad_key="stomach_cm", name="Barriga", unit="cm",
        kind="circumference", min_plausible=60, max_plausible=165,
        tolerance=1.5, basic=False,
        how_to="Por el punto que más sobresale de la barriga, normalmente a la "
        "altura del ombligo o un poco por debajo.",
    ),
    BodyMeasurement(
        key="knee", clad_key="knee_cm", name="Rodilla", unit="cm",
        kind="circumference", min_plausible=28, max_plausible=52, tolerance=0.8,
        basic=False,
        how_to="Por el centro de la rótula, con la rodilla ligeramente doblada.",
    ),
    BodyMeasurement(
        key="calf", clad_key="calf_cm", name="Gemelo", unit="cm",
        kind="circumference", min_plausible=26, max_plausible=55, tolerance=0.8,
        basic=False,
        how_to="Por la parte más ancha del gemelo.",
    ),
)

BY_KEY: dict[str, BodyMeasurement] = {m.key: m for m in MEASUREMENTS}
BY_CLAD_KEY: dict[str, BodyMeasurement] = {m.clad_key: m for m in MEASUREMENTS}

# Medidas que el maniquí deriva aunque el usuario no las dé (no se pueden
# optimizar, solo medir) y que el motor de ajuste usa para prendas.
DERIVED_CLAD_KEYS: dict[str, str] = {
    "front_rise_cm": "front_rise",
    "back_rise_cm": "back_rise",
    "crotch_length_cm": "crotch_length",
    "shirt_length_cm": "torso_length",
    "back_neck_to_waist_cm": "back_neck_to_waist",
}

REQUIRED_KEYS = ("height", "weight")


class MeasurementError(ValueError):
    """Medidas que no se pueden usar (faltan o no son números)."""


def validate(measurements: dict[str, float]) -> list[str]:
    """Comprueba las medidas del usuario.

    Lanza ``MeasurementError`` si falta algo imprescindible o hay claves
    desconocidas; devuelve una lista de avisos (en español, listos para la
    app) para los valores fuera de lo habitual, que no impiden calcular.
    """
    unknown = sorted(set(measurements) - set(BY_KEY))
    if unknown:
        raise MeasurementError(f"Medidas desconocidas: {', '.join(unknown)}")
    missing = [k for k in REQUIRED_KEYS if k not in measurements]
    if missing:
        names = ", ".join(BY_KEY[k].name.lower() for k in missing)
        raise MeasurementError(f"Faltan medidas imprescindibles: {names}")

    warnings: list[str] = []
    for key, value in measurements.items():
        spec = BY_KEY[key]
        if not isinstance(value, (int, float)) or value != value:  # NaN
            raise MeasurementError(f"{spec.name}: el valor no es un número")
        if value <= 0:
            raise MeasurementError(f"{spec.name}: el valor tiene que ser positivo")
        if not spec.min_plausible <= value <= spec.max_plausible:
            warnings.append(
                f"{spec.name}: {value:g} {spec.unit} es poco habitual "
                f"(lo normal está entre {spec.min_plausible:g} y "
                f"{spec.max_plausible:g} {spec.unit}). Revisa que esté bien medida."
            )

    # Coherencias que delatan medidas mal tomadas.
    if "waist" in measurements and "hip" in measurements:
        if measurements["waist"] > measurements["hip"] * 1.35:
            warnings.append(
                "La cintura es mucho mayor que la cadera. Comprueba que la "
                "cadera está medida por la parte más ancha de los glúteos."
            )
    if "inseam" in measurements and measurements["inseam"] > measurements["height"] * 0.56:
        warnings.append(
            "La entrepierna parece demasiado larga para tu altura. Mídela "
            "desde la entrepierna hasta el suelo, no desde la cintura."
        )
    if "underbust" in measurements and "chest" in measurements:
        if measurements["underbust"] > measurements["chest"]:
            warnings.append(
                "El bajo pecho no puede ser mayor que el pecho. Revisa ambas medidas."
            )
    return warnings
