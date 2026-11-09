"""Genera la tabla de cuerpos de muestra que usa el ajuste para arrancar.

Muestrea fenotipos con un hipercubo latino, mide cada cuerpo y guarda
fenotipo + medidas en src/probador/data/init_table.json. Se ejecuta una vez
(tarda unos minutos) y el resultado se versiona en el repositorio.

    python scripts/build_init_table.py --per-sex 400
"""

from __future__ import annotations

import argparse
import json
import time
import warnings

import numpy as np

warnings.filterwarnings("ignore")

from probador.body import (  # noqa: E402
    FIXED_PHENOTYPES,
    FREE_PHENOTYPES,
    GENDER_VALUE,
    INIT_TABLE_PATH,
    BodyModel,
)
from probador.measurements import MEASUREMENTS  # noqa: E402

# Escala típica de cada medida: divide la diferencia al buscar el cuerpo de
# muestra más parecido, para que una medida no domine a las demás.
SCALES = {
    "height": 7.0, "weight": 8.0, "chest": 6.0, "waist": 7.0, "hip": 6.0,
    "inseam": 4.0, "shoulder_width": 2.5, "sleeve_length": 3.0, "neck": 2.5,
    "upper_arm": 3.0, "thigh": 4.0, "underbust": 5.0, "stomach": 8.0,
    "knee": 2.5, "calf": 3.0,
}


def latin_hypercube(n: int, dims: int, rng: np.random.Generator) -> np.ndarray:
    cut = np.linspace(0, 1, n + 1)
    u = rng.random((n, dims))
    points = cut[:n, None] + u * (cut[1] - cut[0])
    for d in range(dims):
        points[:, d] = points[rng.permutation(n), d]
    return points


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-sex", type=int, default=400)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    import torch

    bm = BodyModel()
    rng = np.random.default_rng(args.seed)
    clad_keys = frozenset(m.clad_key for m in MEASUREMENTS)
    zero_local = {lab: torch.zeros(1) for lab in bm.labels}
    out = {"scales": SCALES, "samples": {}}

    for sex, free in FREE_PHENOTYPES.items():
        points = 0.03 + 0.94 * latin_hypercube(args.per_sex, len(free), rng)
        samples = []
        t0 = time.time()
        for row in points:
            # Fuera de los nudos de la interpolación (gradiente 0 en 0,5).
            row = np.where(np.abs(row - 0.5) < 0.004, row + 0.004, row)
            pheno_vals = {name: float(v) for name, v in zip(free, row)}
            pheno = {k: torch.tensor([v]) for k, v in FIXED_PHENOTYPES.items()}
            pheno["gender"] = torch.tensor([GENDER_VALUE[sex]])
            pheno.update({k: torch.tensor([v]) for k, v in pheno_vals.items()})
            with torch.no_grad():
                m = bm._measure_grad(pheno, zero_local, clad_keys)
            meas = {spec.key: round(float(m[spec.clad_key]), 2) for spec in MEASUREMENTS
                    if spec.clad_key in m}
            samples.append({
                "phenotype": {k: round(v, 4) for k, v in pheno_vals.items()},
                "measurements": meas,
            })
        out["samples"][sex] = samples
        print(f"{sex}: {len(samples)} cuerpos en {time.time() - t0:.0f} s")

    INIT_TABLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    INIT_TABLE_PATH.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Guardado en {INIT_TABLE_PATH}")


if __name__ == "__main__":
    main()
