"""Dibuja el maniquí de frente y de perfil en un PNG, para revisarlo a ojo.

    python scripts/render_body.py --sex male --m height=178 weight=76 chest=98 \\
        waist=84 hip=98 inseam=81 --out maniqui.png
"""

from __future__ import annotations

import argparse
import warnings

import numpy as np

warnings.filterwarnings("ignore")


def main() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection

    from probador.body import BodyModel

    parser = argparse.ArgumentParser()
    parser.add_argument("--sex", choices=["male", "female"], required=True)
    parser.add_argument("--m", nargs="+", required=True, help="clave=valor")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    measurements = {k: float(v) for k, v in (p.split("=") for p in args.m)}

    fit = BodyModel.get().fit(args.sex, measurements)
    v, f = fit.vertices, fit.faces
    fig, axes = plt.subplots(1, 2, figsize=(8, 8))
    light = np.array([0.3, -1.0, 0.4])
    light /= np.linalg.norm(light)
    for ax, (a, b, depth, title) in zip(axes, [(0, 2, 1, "Frente"), (1, 2, 0, "Perfil")]):
        tri = v[f]
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12
        order = np.argsort(tri[:, :, depth].mean(axis=1) * (-1 if depth == 1 else 1))
        shade = 0.35 + 0.65 * np.clip(np.abs(normals @ light), 0, 1)
        polys = tri[order][:, :, [a, b]]
        colors = np.stack([shade[order] * 0.85, shade[order] * 0.72, shade[order] * 0.62], 1)
        ax.add_collection(PolyCollection(polys, facecolors=colors, edgecolors="none"))
        for name, z in fit.landmarks.items():
            ax.axhline(z, color="#3b6fd8", lw=0.6, ls="--")
            ax.text(v[:, a].max() + 0.02, z, name, va="center", fontsize=8, color="#3b6fd8")
        ax.set_xlim(v[:, a].min() - 0.05, v[:, a].max() + 0.25)
        ax.set_ylim(-0.02, v[:, 2].max() + 0.03)
        ax.set_aspect("equal")
        ax.set_title(title)
        ax.axis("off")
    text = ", ".join(f"{k} {fit.measurements[k]:g}" for k in fit.provided)
    fig.suptitle(f"{args.sex} · {text}", fontsize=9)
    fig.savefig(args.out, dpi=110, bbox_inches="tight")
    print("residuos", fit.residuals, "avisos", fit.warnings)


if __name__ == "__main__":
    main()
