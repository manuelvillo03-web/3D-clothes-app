"""Comparación prenda-cuerpo y recomendación de talla.

Tres caminos según los datos que haya:

* ``fit_garment`` con tabla de medidas de la prenda: holgura zona a zona
  frente a los intervalos de ``ease``.
* ``fit_garment`` con guía de tallas por cuerpo: se mira si cada medida del
  usuario cae dentro del intervalo de cada talla.
* ``compare_with_reference``: se compara cada talla con una prenda del
  usuario que sabe que le queda bien. No necesita el maniquí.

Todo devuelve el mismo ``FitResult`` y textos listos para la app.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

from . import ease as E
from .garments import BOTTOMS, GARMENT_POINTS, Category, Garment

Preference = Literal["fitted", "regular", "loose"]
Status = Literal["tight", "snug", "good", "loose", "very_loose"]

STATUS_ES: dict[str, str] = {
    "tight": "aprieta",
    "snug": "justo",
    "good": "bien",
    "loose": "holgado",
    "very_loose": "muy holgado",
}
LENGTH_STATUS_ES: dict[str, str] = {
    "tight": "muy corto",
    "snug": "corto",
    "good": "bien",
    "loose": "largo",
    "very_loose": "muy largo",
}
LENGTH_ZONES = frozenset({"length", "sleeve_length", "inseam", "height"})

ZONE_WEIGHT: dict[str, float] = {
    "chest": 1.0, "waist": 0.8, "hip": 0.8, "thigh": 0.6, "shoulder_width": 0.7,
    "length": 0.4, "sleeve_length": 0.5, "neck": 0.6, "inseam": 0.5,
    "height": 0.3,
}
TOP_WAIST_WEIGHT = 0.5
# Peso del término que prefiere el centro del intervalo ideal.
IN_BAND_WEIGHT = 0.05


@dataclass
class ZoneResult:
    zone: str
    name: str
    status: str
    status_text: str
    garment_cm: float | None = None
    body_cm: float | None = None
    ease_cm: float | None = None
    ideal: tuple[float, float] | None = None


@dataclass
class SizeResult:
    label: str
    score: float
    zones: list[ZoneResult]

    @property
    def wearable(self) -> bool:
        return not any(z.status == "tight" for z in self.zones)


@dataclass
class FitResult:
    recommended: str | None
    alternative: str | None
    confidence: Literal["alta", "media", "baja"]
    method: Literal["garment_chart", "body_chart", "reference"]
    sizes: list[SizeResult]
    explanation: list[str]
    warnings: list[str] = field(default_factory=list)
    engine_version: str = E.ENGINE_VERSION

    def to_dict(self) -> dict:
        d = asdict(self)
        for s, size in zip(d["sizes"], self.sizes):
            s["wearable"] = size.wearable
        return d


class ReferenceGarment(BaseModel):
    """Prenda del usuario que le queda como le gusta (armario de referencia)."""

    name: str = "Tu prenda"
    category: Category
    measurements: dict[str, float] = Field(min_length=1)


# --------------------------------------------------------------------------
# Utilidades


def stretch_fraction(garment: Garment) -> float:
    base = E.BASE_STRETCH.get(garment.category, 0.0)
    s = base + E.STRETCH_PER_ELASTANE_PCT * garment.elastane_pct
    return min(s, E.MAX_STRETCH)


def waistband_body(body: dict[str, float], rise: str) -> float:
    """Contorno del cuerpo donde se apoya la cinturilla.

    El maniquí lo mide directamente (``waistband_<tiro>``). Si no está (un
    cuerpo que no viene del maniquí), se interpola entre cintura y cadera.
    """
    measured = body.get(f"waistband_{rise}")
    if measured:
        return measured
    waist, hip = body["waist"], body["hip"]
    return waist + (hip - waist) * E.RISE_DROP.get(rise, E.RISE_DROP["mid"])


def shifted(band: E.Band, preference: Preference) -> E.Band:
    shift = E.PREFERENCE_SHIFT[preference] * band.width
    return E.Band(band.ideal_min + shift, band.ideal_max + shift,
                  band.tight_margin, band.loose_margin)


def classify(ease_cm: float, band: E.Band) -> tuple[str, float]:
    """Estado de una zona y su penalización (0 dentro del intervalo ideal)."""
    if ease_cm < band.ideal_min:
        d = (band.ideal_min - ease_cm) / band.tight_margin
        status = "tight" if d > 1 else "snug"
        # Que apriete es peor que que sobre: una prenda holgada se puede
        # llevar, una que aprieta no.
        return status, 2.0 * d * d + (4.0 if d > 1 else 0.0)
    if ease_cm > band.ideal_max:
        d = (ease_cm - band.ideal_max) / band.loose_margin
        status = "very_loose" if d > 1 else "loose"
        return status, d * d + (1.0 if d > 1 else 0.0)
    return "good", 0.0


def _status_text(zone: str, status: str) -> str:
    table = LENGTH_STATUS_ES if zone in LENGTH_ZONES else STATUS_ES
    return table[status]


# --------------------------------------------------------------------------
# Zonas de una talla con tabla de prenda


ZoneSpec = tuple[str, float, float, E.Band, float, float]


def _garment_zones(garment: Garment, values: dict[str, float],
                   body: dict[str, float]) -> list[ZoneSpec]:
    """(zona, medida prenda, medida cuerpo, intervalo, peso, elasticidad cm)."""
    cat, cut = garment.category, garment.cut
    zones: list[ZoneSpec] = []
    stretch = stretch_fraction(garment)

    def circ(zone: str, g: float, b: float, band: E.Band, w: float) -> None:
        # La elasticidad permite holgura negativa sin que apriete: cuánto da
        # de sí la prenda en esta zona (cm).
        give = stretch * b * E.COMFORT_STRETCH_SHARE
        zones.append((zone, g, b, band, w, give))

    if garment.category in BOTTOMS:
        if "waist" in values and {"waist", "hip"} <= body.keys():
            circ("waist", values["waist"], waistband_body(body, garment.rise or "mid"),
                 E.WAISTBAND[cut], ZONE_WEIGHT["waist"])
        if "hip" in values and "hip" in body:
            circ("hip", values["hip"], body["hip"], E.HIP[cut], ZONE_WEIGHT["hip"])
        if "thigh" in values and "thigh" in body and cat != "skirt":
            circ("thigh", values["thigh"], body["thigh"], E.THIGH[cut], ZONE_WEIGHT["thigh"])
        if "inseam" in values and "inseam" in body and cat in {"jeans", "trousers"}:
            zones.append(("inseam", values["inseam"], body["inseam"], E.INSEAM,
                          ZONE_WEIGHT["inseam"], 0.0))
        return zones

    chest_band = E.CHEST[cat][cut]
    if "chest" in values and "chest" in body:
        circ("chest", values["chest"], body["chest"], chest_band, ZONE_WEIGHT["chest"])
    if "waist" in values and "waist" in body:
        circ("waist", values["waist"], body["waist"], chest_band,
             ZONE_WEIGHT["waist"] if cat == "dress" else TOP_WAIST_WEIGHT)
    if "hip" in values and "hip" in body:
        band = E.HIP[cut] if cat == "dress" else chest_band
        circ("hip", values["hip"], body["hip"], band, ZONE_WEIGHT["hip"] * 0.75)
    if "neck" in values and "neck" in body and cat == "shirt":
        zones.append(("neck", values["neck"], body["neck"], E.NECK, ZONE_WEIGHT["neck"], 0.0))
    if "shoulder_width" in values and "shoulder_width" in body:
        zones.append(("shoulder_width", values["shoulder_width"], body["shoulder_width"],
                      E.SHOULDER[cut], ZONE_WEIGHT["shoulder_width"], 0.0))
    if "length" in values and "torso_length" in body and cat != "dress":
        zones.append(("length", values["length"], body["torso_length"],
                      E.TOP_LENGTH[cat], ZONE_WEIGHT["length"], 0.0))
    if (garment.sleeve == "long" and "sleeve_length" in values
            and "sleeve_length" in body):
        g, b = values["sleeve_length"], body["sleeve_length"]
        band = E.SLEEVE
        # Con hombro caído la manga empieza más abajo: comparamos la medida
        # desde el centro de la espalda hasta el puño.
        if "shoulder_width" in values and "shoulder_width" in body:
            g += values["shoulder_width"] / 2
            b += body["shoulder_width"] / 2
            band = E.SLEEVE_CB
        zones.append(("sleeve_length", g, b, band, ZONE_WEIGHT["sleeve_length"], 0.0))
    return zones


def _evaluate_garment_chart(garment: Garment, body: dict[str, float],
                            preference: Preference) -> list[SizeResult]:
    results = []
    for size in garment.sizes:
        zones, score = [], 0.0
        for zone, g, b, band, w, give in _garment_zones(garment, size.measurements, body):
            if zone not in LENGTH_ZONES:
                band = shifted(band, preference)
            target = (band.ideal_min + band.ideal_max) / 2
            half = max(band.width / 2, 0.5)
            if give:
                band = E.Band(band.ideal_min - give, band.ideal_max,
                              band.tight_margin + give, band.loose_margin)
            ease_cm = g - b
            status, penalty = classify(ease_cm, band)
            # Dentro del intervalo ideal, preferimos la talla que cae más cerca
            # del centro (desempata tallas que quedan «bien» las dos).
            penalty += IN_BAND_WEIGHT * ((ease_cm - target) / half) ** 2
            score += w * penalty
            zones.append(ZoneResult(
                zone=zone, name=GARMENT_POINTS.get(zone, zone), status=status,
                status_text=_status_text(zone, status), garment_cm=round(g, 1),
                body_cm=round(b, 1), ease_cm=round(ease_cm, 1),
                ideal=(round(band.ideal_min, 1), round(band.ideal_max, 1)),
            ))
        results.append(SizeResult(size.label, round(score, 3), zones))
    return results


def _evaluate_body_chart(garment: Garment, body: dict[str, float],
                         preference: Preference) -> list[SizeResult]:
    # Con guía por cuerpo, la preferencia mueve dónde queremos caer dentro del
    # intervalo: ceñido = parte alta (la talla te va justa), holgado = baja.
    results = []
    for size in garment.sizes:
        zones, score = [], 0.0
        for zone, value in size.measurements.items():
            body_key = zone
            if body_key not in body:
                continue
            lo, hi = value if isinstance(value, tuple) else (value - 2.0, value + 2.0)
            b = body[body_key]
            width = max(hi - lo, 2.0)
            target = {"fitted": hi - 0.25 * width, "regular": (lo + hi) / 2,
                      "loose": lo + 0.25 * width}[preference]
            w = ZONE_WEIGHT.get(zone, 0.5)
            if b > hi:
                d = (b - hi) / 3.0
                status = "tight" if d > 1 else "snug"
                penalty = 2.0 * d * d + (4.0 if d > 1 else 0.0) + 0.25
            elif b < lo:
                d = (lo - b) / 4.0
                status = "very_loose" if d > 1 else "loose"
                penalty = d * d + (1.0 if d > 1 else 0.0) + 0.25
            else:
                status = "good"
                penalty = 0.25 * ((b - target) / (width / 2)) ** 2
            # En altura, ser más alto que el intervalo es que la prenda se
            # quede corta: "tight" se lee como «muy corto» (LENGTH_STATUS_ES).
            score += w * penalty
            zones.append(ZoneResult(
                zone=zone, name=GARMENT_POINTS.get(zone, zone), status=status,
                status_text=_status_text(zone, status), body_cm=round(b, 1),
                ideal=(round(lo, 1), round(hi, 1)),
            ))
        results.append(SizeResult(size.label, round(score, 3), zones))
    return results


# --------------------------------------------------------------------------
# Recomendación y textos


def _tightness(size: SizeResult) -> float:
    eases = [z.ease_cm for z in size.zones if z.ease_cm is not None
             and z.zone not in LENGTH_ZONES]
    if eases:
        return sum(eases) / len(eases)
    # Guía por cuerpo: cuanto más arriba en el intervalo, más ceñida.
    pos = [(z.body_cm - z.ideal[0]) / max(z.ideal[1] - z.ideal[0], 1e-6)
           for z in size.zones if z.ideal and z.body_cm is not None]
    return -sum(pos) / len(pos) if pos else 0.0


def _recommend(sizes: list[SizeResult], method: str,
               garment_label: str) -> FitResult:
    scored = [s for s in sizes if s.zones]
    if not scored:
        return FitResult(
            recommended=None, alternative=None, confidence="baja", method=method,
            sizes=sizes,
            explanation=["No hay medidas comparables entre la prenda y tu cuerpo."],
        )
    ranked = sorted(scored, key=lambda s: s.score)
    best = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None

    bad = [z for z in best.zones if z.status in ("tight", "very_loose")
           and ZONE_WEIGHT.get(z.zone, 0.5) >= 0.6]
    close = second is not None and second.score - best.score < 0.15
    confidence = "baja" if bad else ("media" if close else "alta")

    lines = [f"Te recomendamos la talla {best.label}."]
    for z in best.zones:
        if z.ease_cm is not None and z.zone not in LENGTH_ZONES:
            lines.append(f"{z.name}: {z.status_text} ({z.ease_cm:+.0f} cm de holgura).")
        elif z.ease_cm is not None:
            lines.append(f"{z.name}: {z.status_text} ({z.ease_cm:+.0f} cm respecto a tu cuerpo).")
        else:
            lines.append(f"{z.name}: {z.status_text} (tu medida {z.body_cm:g}, "
                         f"la talla va de {z.ideal[0]:g} a {z.ideal[1]:g}).")

    alternative = None
    if close and second is not None:
        alternative = second.label
        tighter, looser = sorted([best, second], key=_tightness)
        lines.append(
            f"Estás entre la {tighter.label} y la {looser.label}: la {tighter.label} "
            f"si te gusta más ceñido, la {looser.label} si lo prefieres más holgado."
        )
    for z in bad:
        lines.append(f"Ojo: en {z.name.lower()} te quedará {z.status_text}.")
    if all(not s.wearable for s in scored):
        lines.append(f"Ninguna talla de {garment_label} parece cómoda para ti.")
    return FitResult(
        recommended=best.label, alternative=alternative, confidence=confidence,
        method=method, sizes=sizes, explanation=lines,
    )


def fit_garment(garment: Garment, body: dict[str, float],
                preference: Preference = "regular") -> FitResult:
    """Recomienda talla a partir de las medidas del cuerpo (del maniquí)."""
    if garment.chart_type == "garment":
        sizes = _evaluate_garment_chart(garment, body, preference)
        method = "garment_chart"
    else:
        sizes = _evaluate_body_chart(garment, body, preference)
        method = "body_chart"
    result = _recommend(sizes, method, garment.name)
    if garment.chart_type == "body":
        result.warnings.append(
            "Esta prenda solo tiene guía de tallas por cuerpo: la recomendación "
            "es menos precisa que con las medidas de la propia prenda."
        )
    if (garment.category in BOTTOMS and garment.chart_type == "garment"
            and f"waistband_{garment.rise}" not in body
            and "waist" in {z.zone for s in sizes for z in s.zones}):
        result.warnings.append(
            "La cintura del pantalón se ha comparado con una estimación de tu "
            "contorno a la altura de la cinturilla."
        )
    return result


REFERENCE_SCALE: dict[str, float] = {
    "chest": 4.0, "waist": 3.0, "hip": 3.0, "thigh": 3.0, "length": 3.0,
    "sleeve_length": 2.0, "shoulder_width": 2.0, "inseam": 2.0, "rise": 2.0,
    "neck": 1.0, "leg_opening": 3.0,
}


def compare_with_reference(garment: Garment, reference: ReferenceGarment) -> FitResult:
    """Compara cada talla con una prenda del usuario que le queda bien."""
    if garment.chart_type != "garment":
        raise ValueError("Para comparar con tu prenda hace falta la tabla de "
                         "medidas de la prenda, no la guía por cuerpo")
    ref = {k.removesuffix("_flat"): (v * 2 if k.endswith("_flat") else v)
           for k, v in reference.measurements.items()}
    sizes = []
    for size in garment.sizes:
        zones, score = [], 0.0
        for zone, g in size.measurements.items():
            if zone not in ref or zone not in REFERENCE_SCALE:
                continue
            delta = g - ref[zone]
            scale = REFERENCE_SCALE[zone]
            score += ZONE_WEIGHT.get(zone, 0.4) * (delta / scale) ** 2
            if abs(delta) <= 0.5 * scale:
                status, text = "good", "igual que tu prenda"
            elif delta > 0:
                status = "loose" if delta <= 2 * scale else "very_loose"
                text = f"{delta:.0f} cm más que tu prenda"
            else:
                status = "snug" if -delta <= 2 * scale else "tight"
                text = f"{-delta:.0f} cm menos que tu prenda"
            zones.append(ZoneResult(
                zone=zone, name=GARMENT_POINTS.get(zone, zone), status=status,
                status_text=text, garment_cm=round(g, 1),
                body_cm=None, ease_cm=round(delta, 1),
            ))
        sizes.append(SizeResult(size.label, round(score, 3), zones))

    scored = [s for s in sizes if s.zones]
    if not scored:
        return FitResult(None, None, "baja", "reference", sizes,
                         ["Tu prenda y esta no tienen medidas en común."])
    ranked = sorted(scored, key=lambda s: s.score)
    best = ranked[0]
    confidence = "alta" if best.score < 0.5 else ("media" if best.score < 2 else "baja")
    lines = [f"La talla {best.label} es la más parecida a {reference.name}."]
    for z in best.zones:
        lines.append(f"{z.name}: {z.status_text}.")
    if confidence == "baja":
        lines.append("Ninguna talla se parece mucho a tu prenda: "
                     "puede que el corte sea distinto.")
    alternative = None
    if len(ranked) > 1 and ranked[1].score - best.score < 0.3:
        alternative = ranked[1].label
    return FitResult(best.label, alternative, confidence, "reference", sizes, lines)
