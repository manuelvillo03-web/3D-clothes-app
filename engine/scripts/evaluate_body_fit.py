"""Evalúa el ajuste del maniquí con cuerpos sintéticos.

Genera cuerpos aleatorios (fenotipo + cambios locales), los mide con la
referencia ISO de clad-body, ajusta el maniquí a esas medidas y comprueba
cuánto se separa. Es la prueba de que el ajuste recupera cualquier cuerpo que
el modelo puede representar.

    python scripts/evaluate_body_fit.py --n 30 --set basic
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
import warnings

import numpy as np

warnings.filterwarnings("ignore")

from probador.body import FIXED_PHENOTYPES, FREE_PHENOTYPES, GENDER_VALUE, LOCAL_CHANGES, BodyModel  # noqa: E402
from probador.measurements import BY_KEY  # noqa: E402

SETS = {
    "basic": ["height", "weight", "chest", "waist", "hip", "inseam"],
    "full": ["height", "weight", "chest", "waist", "hip", "inseam", "shoulder_width",
             "sleeve_length", "neck", "upper_arm", "thigh"],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=30)
    parser.add_argument("--set", choices=SETS, default="basic")
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    import torch
    from clad_body.load.anny import load_anny_from_verts
    from clad_body.measure import measure

    bm = BodyModel()
    rng = np.random.default_rng(args.seed)
    keys = SETS[args.set]
    rows = []
    for i in range(args.n):
        sex = "male" if i % 2 == 0 else "female"
        pheno = {k: torch.tensor([v]) for k, v in FIXED_PHENOTYPES.items()}
        pheno["gender"] = torch.tensor([GENDER_VALUE[sex]])
        for name in FREE_PHENOTYPES[sex]:
            pheno[name] = torch.tensor([float(rng.uniform(0.1, 0.9))])
        local = {lab: torch.zeros(1) for lab in bm.labels}
        for lab, key in LOCAL_CHANGES.items():
            if key in keys:
                local[lab] = torch.tensor([float(rng.uniform(-0.5, 0.5))])
        out = bm._forward(pheno, local, grad=False)
        body = load_anny_from_verts(out["vertices"], bm.model, phenotype_kwargs=pheno,
                                    local_changes_kwargs=local,
                                    bone_heads=out["bone_heads"],
                                    bone_tails=out["bone_tails"])
        raw = measure(body, only=[BY_KEY[k].clad_key for k in keys])
        target = {k: round(float(raw[BY_KEY[k].clad_key]), 1) for k in keys}
        if any(v <= 0 for v in target.values()):
            # clad-body no pudo medir alguna zona de este cuerpo sintético.
            print(f"{i + 1:3d} {sex:6s} omitido: medida no disponible", flush=True)
            continue

        t = time.time()
        fit = bm.fit(sex, target, include_mesh=False)
        rows.append({
            "sex": sex, "seconds": round(time.time() - t, 2),
            "iterations": fit.iterations, "target": target,
            "residuals": fit.residuals, "warnings": fit.warnings,
        })
        print(f"{i + 1:3d} {sex:6s} {rows[-1]['seconds']:5.1f}s "
              f"máx {fit.max_abs_residual:4.2f} cm  "
              + " ".join(f"{k}={v:+.2f}" for k, v in fit.residuals.items()), flush=True)

    print("\nResumen")
    secs = [r["seconds"] for r in rows]
    print(f"  tiempo: mediana {statistics.median(secs):.1f} s, máx {max(secs):.1f} s")
    for k in keys:
        errs = [abs(r["residuals"][k]) for r in rows]
        unit = BY_KEY[k].unit
        within = sum(e <= 1.0 for e in errs) / len(errs) * 100
        print(f"  {k:15s} error medio {statistics.mean(errs):.2f} {unit}, "
              f"máx {max(errs):.2f} {unit}, ≤1 {unit}: {within:.0f} %")
    if args.out:
        with open(args.out, "w") as f:
            json.dump(rows, f, indent=1)


if __name__ == "__main__":
    main()
