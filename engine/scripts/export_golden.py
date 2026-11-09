"""Casos de referencia para comprobar que el motor de la app calcula igual.

La app lleva una copia en TypeScript del motor de tallas (``app/src/core``)
para recomendar sin servidor. Este script genera cientos de casos aleatorios
(prendas de todas las categorías, cortes y tipos de tabla; cuerpos con y sin
medidas estimadas; las tres preferencias; comparaciones con prenda propia),
los resuelve con el motor de Python y guarda entrada y resultado. Los tests de
la app exigen el mismo resultado, texto incluido.

No necesita el modelo 3D: solo pydantic.

    python scripts/export_golden.py            # escribe app/src/core/__fixtures__/golden.json
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from probador.ease import CHEST, ENGINE_VERSION
from probador.fit import ReferenceGarment, compare_with_reference, fit_garment
from probador.garments import BOTTOMS, Garment

OUT = Path(__file__).resolve().parents[2] / "app" / "src" / "core" / "__fixtures__" / "golden.json"

CUTS = ["slim", "regular", "relaxed", "oversize"]
PREFS = ["fitted", "regular", "loose"]
TOP_CATS = list(CHEST)
BOTTOM_CATS = sorted(BOTTOMS)


def r1(rng: random.Random, lo: float, hi: float) -> float:
    """Valor con medio centímetro de resolución (como los de una tabla)."""
    return round(rng.uniform(lo, hi) * 2) / 2


def random_body(rng: random.Random) -> dict[str, float]:
    height = r1(rng, 150, 200)
    chest = r1(rng, 78, 130)
    waist = chest - r1(rng, -8, 22)
    hip = r1(rng, 84, 130)
    body = {
        "height": height, "weight": r1(rng, 48, 120), "chest": chest,
        "waist": waist, "hip": hip, "inseam": round(height * rng.uniform(0.42, 0.49), 1),
    }
    optional = {
        "thigh": r1(rng, 46, 72), "shoulder_width": r1(rng, 34, 48),
        "sleeve_length": r1(rng, 54, 68), "neck": r1(rng, 32, 46),
        "torso_length": r1(rng, 62, 80), "front_rise": r1(rng, 24, 36),
        "upper_arm": r1(rng, 24, 40),
    }
    for key, value in optional.items():
        if rng.random() < 0.75:
            body[key] = value
    # Contorno a la altura de la cinturilla: a veces lo trae el maniquí.
    if rng.random() < 0.5:
        for rise, frac in (("high", 0.05), ("mid", 0.25), ("low", 0.5)):
            body[f"waistband_{rise}"] = round(waist + (hip - waist) * frac * rng.uniform(0.6, 1.2), 1)
    return body


def composition(rng: random.Random) -> dict[str, float]:
    e = rng.choice([0, 0, 0, 1, 2, 3, 5, 8])
    return {"algodon": 100 - e, "elastano": e} if e else {"algodon": 100}


def garment_chart_top(rng, cat: str) -> list[dict]:
    sizes, labels = [], ["XS", "S", "M", "L", "XL", "XXL"][: rng.randint(3, 6)]
    chest = r1(rng, 86, 104)
    step = rng.choice([4, 5, 6])
    flat = rng.random() < 0.5
    for i, label in enumerate(labels):
        m: dict[str, float] = {}
        c = chest + i * step
        m["chest_flat" if flat else "chest"] = c / 2 if flat else c
        if rng.random() < 0.8:
            m["length"] = r1(rng, 64, 72) + 2 * i
        if rng.random() < 0.6:
            m["shoulder_width"] = r1(rng, 40, 46) + 1.5 * i
        if rng.random() < 0.5:
            m["sleeve_length"] = r1(rng, 58, 66) + i
        if rng.random() < 0.4:
            m["waist"] = c - r1(rng, 0, 12)
        if rng.random() < 0.3:
            m["hip"] = c + r1(rng, -4, 8)
        if cat == "shirt" and rng.random() < 0.7:
            m["neck"] = 37 + i
        sizes.append({"label": label, "measurements": m})
    return sizes


def garment_chart_bottom(rng, cat: str) -> list[dict]:
    sizes, start = [], rng.choice([28, 30, 36, 38])
    waist = r1(rng, 70, 84)
    flat = rng.random() < 0.5
    for i in range(rng.randint(3, 6)):
        m: dict[str, float] = {}
        w = waist + 5 * i
        m["waist_flat" if flat else "waist"] = w / 2 if flat else w
        if rng.random() < 0.85:
            m["hip"] = w + r1(rng, 12, 22)
        if rng.random() < 0.6 and cat != "skirt":
            m["thigh"] = r1(rng, 52, 62) + 2 * i
        if rng.random() < 0.6 and cat in ("jeans", "trousers"):
            m["inseam"] = r1(rng, 76, 84)
        if rng.random() < 0.4:
            m["rise"] = r1(rng, 24, 30) + 0.5 * i
        sizes.append({"label": str(start + 2 * i), "measurements": m})
    return sizes


def body_chart(rng, cat: str) -> list[dict]:
    sizes = []
    keys = (["waist", "hip"] if cat in BOTTOMS else ["chest", "waist", "hip"])
    if rng.random() < 0.3:
        keys.append("height")
    if cat == "shirt" and rng.random() < 0.6:
        keys.append("neck")
    if cat in ("jeans", "trousers") and rng.random() < 0.4:
        keys.append("inseam")
    base = {"chest": r1(rng, 80, 92), "waist": r1(rng, 62, 76), "hip": r1(rng, 86, 96),
            "height": r1(rng, 160, 172), "neck": 36.0, "inseam": r1(rng, 74, 80)}
    step = {"chest": 6, "waist": 6, "hip": 6, "height": 4, "neck": 1.5, "inseam": 2}
    for i, label in enumerate(["XS", "S", "M", "L", "XL"][: rng.randint(3, 5)]):
        m = {}
        for k in keys:
            lo = base[k] + i * step[k]
            if rng.random() < 0.8:
                m[k] = [lo, lo + step[k] - (0.5 if k != "neck" else 0)]
            else:
                m[k] = lo + step[k] / 2
        sizes.append({"label": label, "measurements": m})
    return sizes


def random_garment(rng: random.Random, i: int) -> dict:
    cat = rng.choice(TOP_CATS + BOTTOM_CATS)
    chart = "body" if rng.random() < 0.3 else "garment"
    if chart == "body":
        sizes = body_chart(rng, cat)
    elif cat in BOTTOMS:
        sizes = garment_chart_bottom(rng, cat)
    else:
        sizes = garment_chart_top(rng, cat)
    g = {
        "id": f"caso-{i}", "brand": "Prueba", "name": f"Prenda {i}", "category": cat,
        "cut": rng.choice(CUTS), "chart_type": chart, "composition": composition(rng),
        "sizes": sizes,
    }
    if cat in BOTTOMS and rng.random() < 0.7:
        g["rise"] = rng.choice(["low", "mid", "high"])
    if cat not in BOTTOMS and rng.random() < 0.3:
        g["sleeve"] = rng.choice(["short", "long"])
    return g


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fit-cases", type=int, default=500)
    parser.add_argument("--reference-cases", type=int, default=120)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    fit_cases, ref_cases = [], []
    examples = sorted((Path(__file__).resolve().parents[2] / "data" / "catalog" / "ejemplos").glob("*.json"))

    for i in range(args.fit_cases):
        raw = (json.loads(examples[i % len(examples)].read_text()) if i < 3 * len(examples)
               else random_garment(rng, i))
        body = random_body(rng)
        pref = PREFS[i % 3]
        result = fit_garment(Garment.model_validate(raw), body, pref).to_dict()
        fit_cases.append({"garment": raw, "body": body, "preference": pref, "expected": result})

    for i in range(args.reference_cases):
        raw = random_garment(rng, 10_000 + i)
        if raw["chart_type"] != "garment":
            raw["chart_type"] = "garment"
            raw["sizes"] = (garment_chart_bottom(rng, raw["category"]) if raw["category"] in BOTTOMS
                            else garment_chart_top(rng, raw["category"]))
        g = Garment.model_validate(raw)
        mid = g.sizes[len(g.sizes) // 2].measurements
        ref = {k: round(float(v) + rng.uniform(-6, 6) * 2) / 2 for k, v in mid.items()
               if rng.random() < 0.8}
        if rng.random() < 0.3 and "chest" in ref:
            ref["chest_flat"] = ref.pop("chest") / 2
        if not ref:
            ref = {k: float(v) for k, v in mid.items()}
        reference = {"name": rng.choice(["Tu camiseta favorita", "Tu vaquero", "Tu prenda"]),
                     "category": raw["category"], "measurements": ref}
        result = compare_with_reference(g, ReferenceGarment.model_validate(reference)).to_dict()
        ref_cases.append({"garment": raw, "reference": reference, "expected": result})

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(
        {"engine_version": ENGINE_VERSION, "fit": fit_cases, "reference": ref_cases},
        ensure_ascii=False, separators=(",", ":"),
    ))
    print(f"{len(fit_cases)} casos de ajuste y {len(ref_cases)} de referencia en {args.out}")


if __name__ == "__main__":
    main()
