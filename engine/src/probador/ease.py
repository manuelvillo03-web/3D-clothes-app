"""Holguras ideales por categoría, corte y zona.

La holgura es la diferencia entre la medida de la prenda y la del cuerpo en
la misma zona (cm). Cada entrada da el intervalo en que la prenda «queda
bien» para ese corte. Por debajo, la prenda va justa y luego aprieta; por
encima, holgada y luego muy holgada.

ESTOS VALORES SON EL PUNTO DE PARTIDA, NO LA VERDAD. Salen de rangos
habituales de patronaje y se calibrarán con pruebas reales y con las
valoraciones de los usuarios («¿te quedó bien?»). Cada cambio de calibración
debe subir ENGINE_VERSION para poder recalcular resultados antiguos.
"""

from __future__ import annotations

from dataclasses import dataclass

ENGINE_VERSION = "2026.11.0"


@dataclass(frozen=True)
class Band:
    ideal_min: float
    ideal_max: float
    # Cuánto por debajo del mínimo pasa de «justo» a «aprieta», y cuánto por
    # encima del máximo pasa de «holgado» a «muy holgado».
    tight_margin: float
    loose_margin: float

    @property
    def width(self) -> float:
        return self.ideal_max - self.ideal_min


def _circ(lo: float, hi: float) -> Band:
    width = hi - lo
    return Band(lo, hi, tight_margin=max(3.0, 0.4 * width),
                loose_margin=max(5.0, 0.6 * width))


# Contorno de pecho de prendas de arriba, por categoría y corte.
CHEST: dict[str, dict[str, Band]] = {
    "tshirt": {"slim": _circ(2, 8), "regular": _circ(8, 16),
               "relaxed": _circ(14, 24), "oversize": _circ(22, 40)},
    "polo": {"slim": _circ(4, 10), "regular": _circ(10, 18),
             "relaxed": _circ(16, 26), "oversize": _circ(24, 40)},
    "shirt": {"slim": _circ(8, 14), "regular": _circ(14, 22),
              "relaxed": _circ(20, 30), "oversize": _circ(28, 44)},
    "sweater": {"slim": _circ(4, 10), "regular": _circ(10, 18),
                "relaxed": _circ(16, 26), "oversize": _circ(24, 42)},
    "hoodie": {"slim": _circ(8, 14), "regular": _circ(14, 24),
               "relaxed": _circ(20, 32), "oversize": _circ(30, 50)},
    "jacket": {"slim": _circ(10, 16), "regular": _circ(16, 24),
               "relaxed": _circ(22, 32), "oversize": _circ(30, 50)},
    "coat": {"slim": _circ(14, 20), "regular": _circ(20, 30),
             "relaxed": _circ(28, 40), "oversize": _circ(36, 60)},
    "dress": {"slim": _circ(2, 8), "regular": _circ(6, 14),
              "relaxed": _circ(12, 22), "oversize": _circ(20, 40)},
}

# Cintura de la cinturilla de prendas de abajo (sobre el cuerpo a la altura
# donde se apoya la cinturilla, ver fit.waistband_body).
WAISTBAND: dict[str, Band] = {
    "slim": _circ(-1, 2), "regular": _circ(0, 3),
    "relaxed": _circ(1, 5), "oversize": _circ(2, 8),
}
HIP: dict[str, Band] = {
    "slim": _circ(0, 4), "regular": _circ(3, 8),
    "relaxed": _circ(6, 12), "oversize": _circ(10, 20),
}
THIGH: dict[str, Band] = {
    "slim": _circ(1, 5), "regular": _circ(4, 10),
    "relaxed": _circ(8, 16), "oversize": _circ(14, 26),
}
# Ancho de hombros de la prenda (costura a costura, por la espalda) frente al
# del maniquí, que clad-body mide entre acromiones y sale unos centímetros
# menor que el de la prenda aunque esta quede perfecta. A VERIFICAR con
# medidas reales: es la calibración más dudosa de esta tabla.
SHOULDER: dict[str, Band] = {
    "slim": Band(2, 5, 2, 3), "regular": Band(3, 7, 2, 3),
    "relaxed": Band(6, 11, 2, 4), "oversize": Band(10, 20, 3, 6),
}
NECK = Band(1, 3, 1, 2)             # cuello de camisa
INSEAM = Band(-2, 2, 3, 5)          # largo de pierna
SLEEVE = Band(-1.5, 2.5, 3, 4)      # manga larga, desde el hombro
# Manga medida desde el centro de la espalda (mitad de hombros + manga): el
# hombro de la prenda ya suma unos centímetros sobre el del cuerpo.
SLEEVE_CB = Band(0.5, 5, 3, 4)
# Largo de prendas de arriba frente al largo de torso (lateral del cuello
# hasta la altura de la entrepierna, por delante).
TOP_LENGTH: dict[str, Band] = {
    "tshirt": Band(-8, 2, 5, 6), "polo": Band(-8, 2, 5, 6),
    "shirt": Band(-4, 4, 5, 8), "sweater": Band(-8, 2, 5, 6),
    "hoodie": Band(-8, 3, 5, 6), "jacket": Band(-8, 4, 5, 8),
    "coat": Band(0, 40, 6, 20), "dress": Band(0, 60, 10, 30),
}

# Elasticidad base por categoría (fracción del contorno que da de sí): el
# punto estira aunque no lleve elastano y el vaquero rígido cede con el uso.
# Se suma el aumento por cada 1 % de elastano.
BASE_STRETCH = {"tshirt": 0.04, "polo": 0.03, "sweater": 0.06, "hoodie": 0.04,
                "jeans": 0.015}
STRETCH_PER_ELASTANE_PCT = 0.025
MAX_STRETCH = 0.25
# De la elasticidad total, qué parte aceptamos como «cómoda».
COMFORT_STRETCH_SHARE = 0.5

# Cuánto mueve el intervalo ideal la preferencia del usuario (fracción del
# ancho del intervalo).
PREFERENCE_SHIFT = {"fitted": -0.35, "regular": 0.0, "loose": 0.35}

# Solo si el cuerpo no trae el contorno de cinturilla medido en el maniquí:
# fracción del paso de contorno de cintura a cadera según el tiro.
RISE_DROP = {"high": 0.02, "mid": 0.2, "low": 0.45}
