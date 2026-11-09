"""Formato de las prendas.

Una prenda es una lista de tallas, y cada talla una tabla de medidas. Hay dos
tipos de tabla:

* ``garment``: medidas de la propia prenda (lo mejor). Los contornos van
  completos; si la marca da el ancho a plano (de costura a costura), se usa la
  clave ``*_flat`` y aquí se multiplica por dos.
* ``body``: medidas del cuerpo al que va destinada la talla, que es lo que
  publican muchas tiendas en su guía de tallas. Cada valor puede ser un número
  o un intervalo ``[min, max]``.
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field, field_validator, model_validator

Category = Literal[
    "tshirt", "shirt", "polo", "sweater", "hoodie", "jacket", "coat", "dress",
    "jeans", "trousers", "shorts", "skirt",
]
Cut = Literal["slim", "regular", "relaxed", "oversize"]
ChartType = Literal["garment", "body"]
Sleeve = Literal["none", "short", "long"]
Rise = Literal["low", "mid", "high"]
Audience = Literal["men", "women", "unisex"]

TOPS: frozenset[str] = frozenset(
    {"tshirt", "shirt", "polo", "sweater", "hoodie", "jacket", "coat", "dress"}
)
BOTTOMS: frozenset[str] = frozenset({"jeans", "trousers", "shorts", "skirt"})
KNITS: frozenset[str] = frozenset({"tshirt", "polo", "sweater", "hoodie"})

# Puntos de medida de una prenda (contornos completos y longitudes, en cm).
GARMENT_POINTS: dict[str, str] = {
    "chest": "Pecho",
    "waist": "Cintura",
    "hip": "Cadera",
    "thigh": "Muslo",
    "length": "Largo",
    "sleeve_length": "Manga",
    "shoulder_width": "Hombros",
    "inseam": "Entrepierna",
    "rise": "Tiro",
    "neck": "Cuello",
    "leg_opening": "Bajo",
    # Solo en guías de tallas por cuerpo (chart_type="body").
    "height": "Altura",
}
FLAT_SUFFIX = "_flat"
ELASTANE_NAMES = ("elastane", "elastano", "spandex", "lycra", "elastan")

Value = Union[float, tuple[float, float]]


class Price(BaseModel):
    amount: float = Field(ge=0)
    currency: str = "EUR"


class Size(BaseModel):
    label: str = Field(min_length=1, max_length=20)
    measurements: dict[str, Value]

    @field_validator("measurements")
    @classmethod
    def _known_points(cls, v: dict[str, Value]) -> dict[str, Value]:
        normalized: dict[str, Value] = {}
        for key, value in v.items():
            base = key.removesuffix(FLAT_SUFFIX)
            if base not in GARMENT_POINTS:
                raise ValueError(f"Punto de medida desconocido: {key}")
            if key.endswith(FLAT_SUFFIX):
                if isinstance(value, tuple):
                    value = (value[0] * 2, value[1] * 2)
                else:
                    value = value * 2
            if isinstance(value, tuple):
                lo, hi = value
                if not 0 < lo <= hi:
                    raise ValueError(f"{key}: intervalo no válido {value}")
            elif value <= 0:
                raise ValueError(f"{key}: la medida tiene que ser positiva")
            normalized[base] = value
        if not normalized:
            raise ValueError("La talla no tiene medidas")
        return normalized


class Garment(BaseModel):
    id: str | None = None
    brand: str
    name: str
    category: Category
    cut: Cut = "regular"
    chart_type: ChartType = "garment"
    sleeve: Sleeve | None = None
    rise: Rise | None = None
    composition: dict[str, float] = Field(default_factory=dict)
    sizes: list[Size] = Field(min_length=1)
    url: str | None = None
    price: Price | None = None
    barcodes: list[str] = Field(default_factory=list)
    source: str | None = None
    verified: bool = False
    # Público al que va la prenda (para filtrar el catálogo); no afecta al ajuste.
    audience: Audience | None = None

    @model_validator(mode="after")
    def _check(self) -> "Garment":
        labels = [s.label for s in self.sizes]
        if len(set(labels)) != len(labels):
            raise ValueError("Hay tallas repetidas")
        if self.chart_type == "garment":
            for s in self.sizes:
                if any(isinstance(v, tuple) for v in s.measurements.values()):
                    raise ValueError(
                        "Una tabla de medidas de prenda no admite intervalos; "
                        "usa chart_type='body' para guías de tallas por cuerpo"
                    )
        total = sum(self.composition.values())
        if self.composition and not 95 <= total <= 105:
            raise ValueError(f"La composición suma {total:g} %, no 100 %")
        if self.sleeve is None:
            self.sleeve = "short" if self.category in {"tshirt", "polo"} else (
                "none" if self.category in BOTTOMS else "long")
        if self.rise is None and self.category in BOTTOMS:
            self.rise = "mid"
        return self

    @property
    def is_top(self) -> bool:
        return self.category in TOPS

    @property
    def elastane_pct(self) -> float:
        return sum(v for k, v in self.composition.items()
                   if k.strip().lower() in ELASTANE_NAMES)
