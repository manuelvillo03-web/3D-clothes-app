"""Maniquí para el móvil: forma media + componentes + relación medidas ↔ forma.

La app no llama a ningún servidor: construye el maniquí en el propio móvil
con un modelo lineal que este script resume a partir del motor de Python.

1. ``sample``: genera cuerpos al azar con Anny (fenotipo y cambios locales),
   los mide con clad-body (ISO 8559-1) y guarda vértices + medidas.
2. ``build``: con las muestras de las dos bases de cuerpo,
   * calcula la forma media y las K componentes principales (PCA);
   * ajusta, por base de cuerpo, una gaussiana conjunta sobre
     [medidas, alturas de referencia, coeficientes PCA];
   * valida con cuerpos apartados: dadas las 6 medidas básicas, cuánto se
     separa el maniquí reconstruido del real (vértices y contornos) y cuánto
     se equivocan las medidas estimadas;
   * escribe ``app/assets/models/body-model.bin`` (formato en
     ``app/src/core/bodyModel.ts``) y casos de prueba para la app.

    python scripts/build_mobile_model.py sample --sex male --n 1200 --out muestras-male.npz
    python scripts/build_mobile_model.py sample --sex female --n 1200 --out muestras-female.npz
    python scripts/build_mobile_model.py build muestras-male.npz muestras-female.npz

Se ejecuta en GitHub Actions (``.github/workflows/body-model.yml``).
"""

from __future__ import annotations

import argparse
import json
import struct
import time
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[2]
OUT_BIN = ROOT / "app" / "assets" / "models" / "body-model.bin"
OUT_CASES = ROOT / "app" / "src" / "core" / "__fixtures__" / "body-model-cases.json"
OUT_REPORT = ROOT / "engine" / "reports" / "body-model.json"

FORMAT_VERSION = "1"

# Medidas de la gaussiana: las del usuario, las derivadas del maniquí, la
# cinturilla para cada tiro y las alturas de referencia (cm desde el suelo).
BASE_KEYS = [
    "height", "weight", "chest", "waist", "hip", "inseam", "shoulder_width",
    "sleeve_length", "neck", "upper_arm", "thigh", "underbust", "stomach", "knee", "calf",
]
DERIVED_KEYS = ["front_rise", "back_rise", "crotch_length", "torso_length", "back_neck_to_waist"]
WAISTBAND_KEYS = ["waistband_high", "waistband_mid", "waistband_low"]
LANDMARK_KEYS = ["z_bust", "z_waist", "z_hip", "z_thigh", "z_knee"]
KEYS = BASE_KEYS + DERIVED_KEYS + WAISTBAND_KEYS + LANDMARK_KEYS

# Error típico al medirse uno mismo con cinta (desviación, en la unidad de
# cada medida). Hace que el maniquí siga las medidas sin obsesionarse con
# un centímetro que puede ser error de medida.
NOISE = {
    "height": 1.0, "weight": 1.5, "chest": 1.2, "waist": 1.2, "hip": 1.2, "inseam": 1.2,
    "shoulder_width": 1.5, "sleeve_length": 1.5, "neck": 0.8, "upper_arm": 1.0,
    "thigh": 1.2, "underbust": 1.2, "stomach": 2.0, "knee": 1.0, "calf": 1.0,
}
BASIC = ["height", "weight", "chest", "waist", "hip", "inseam"]


# ---------------------------------------------------------------- muestreo


def latin_hypercube(n: int, dims: int, rng: np.random.Generator) -> np.ndarray:
    cut = np.linspace(0, 1, n + 1)
    points = cut[:n, None] + rng.random((n, dims)) * (cut[1] - cut[0])
    for d in range(dims):
        points[:, d] = points[rng.permutation(n), d]
    return points


def sample(sex: str, n: int, seed: int, shard: int, out: Path) -> None:
    import torch

    torch.set_num_threads(1)
    from clad_body.load.anny import load_anny_from_verts
    from clad_body.measure import measure
    from probador.body import (
        FIXED_PHENOTYPES, FREE_PHENOTYPES, GENDER_VALUE, LOCAL_CHANGES, REPORT_CLAD_KEYS, BodyModel,
    )
    from probador.measurements import BY_CLAD_KEY, DERIVED_CLAD_KEYS

    bm = BodyModel()
    rng = np.random.default_rng(seed + (0 if sex == "male" else 1) + 1000 * shard)
    free = FREE_PHENOTYPES[sex]
    points = 0.03 + 0.94 * latin_hypercube(n, len(free), rng)
    labels = list(LOCAL_CHANGES)

    verts, rows, phenos, faces, parts = [], [], [], None, None
    t0 = time.time()
    for i, row in enumerate(points):
        pheno = {k: torch.tensor([v]) for k, v in FIXED_PHENOTYPES.items()}
        pheno["gender"] = torch.tensor([GENDER_VALUE[sex]])
        pheno.update({name: torch.tensor([float(v)]) for name, v in zip(free, row)})
        # Variación local: contornos y longitudes que el fenotipo no explica.
        local_vals = np.clip(rng.normal(0.0, 0.3, len(labels)), -0.75, 0.75)
        local = {lab: torch.tensor([float(v)]) for lab, v in zip(labels, local_vals)}
        try:
            out_t = bm._forward(pheno, local, grad=False)
            body = load_anny_from_verts(
                out_t["vertices"], bm.model, phenotype_kwargs=pheno, local_changes_kwargs=local,
                bone_heads=out_t["bone_heads"], bone_tails=out_t["bone_tails"], source="probador",
            )
            raw = measure(body, only=list(REPORT_CLAD_KEYS))
        except Exception as exc:  # cuerpo raro: se descarta
            print(f"  muestra {i} descartada: {exc}")
            continue

        report: dict[str, float] = {}
        for clad_key, value in raw.items():
            if clad_key.startswith("_") or not isinstance(value, (int, float, np.floating)) or not value > 0:
                continue
            if clad_key in BY_CLAD_KEY:
                report[BY_CLAD_KEY[clad_key].key] = float(value)
            elif clad_key in DERIVED_CLAD_KEYS:
                report[DERIVED_CLAD_KEYS[clad_key]] = float(value)
        landmarks = {name: float(raw[key]) for name, key in (
            ("bust", "_bust_z"), ("waist", "_waist_z"), ("hip", "_hip_z"),
            ("thigh", "_thigh_z"), ("knee", "_knee_z")) if isinstance(raw.get(key), (int, float, np.floating))}
        try:
            report.update(bm._waistbands(body, landmarks, report))
        except Exception:
            pass
        for name, z in landmarks.items():
            report[f"z_{name}"] = z * 100.0  # metros -> cm

        values = [report.get(k, np.nan) for k in KEYS]
        if np.isnan(values).any():
            missing = [k for k, v in zip(KEYS, values) if np.isnan(v)]
            print(f"  muestra {i} descartada: faltan {missing}")
            continue

        v = np.asarray(body.vertices, dtype=np.float32)
        # Z arriba (clad-body) -> Y arriba y frente hacia +Z (glTF): (-x, z, y).
        verts.append(np.stack([-v[:, 0], v[:, 2], v[:, 1]], axis=1))
        rows.append(values)
        phenos.append(np.concatenate([row, local_vals]))
        if faces is None:
            faces = np.asarray(body.faces, dtype=np.int64)
            parts = np.asarray(bm.vertex_parts(), dtype=np.uint8)
        if (i + 1) % 50 == 0:
            el = time.time() - t0
            print(f"{sex}: {i + 1}/{n} en {el:.0f} s ({el / (i + 1):.2f} s/cuerpo)", flush=True)

    np.savez_compressed(
        out, sex=sex, keys=np.array(KEYS), vertices=np.stack(verts), measurements=np.array(rows),
        params=np.array(phenos), faces=faces, parts=parts,
    )
    print(f"{sex}: {len(verts)} cuerpos guardados en {out} ({time.time() - t0:.0f} s)")


# ---------------------------------------------------------------- estadística


def pca(x: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Media, componentes (k × d, filas ortonormales) y varianza explicada."""
    mean = x.mean(axis=0)
    _, s, vt = np.linalg.svd(x - mean, full_matrices=False)
    var = s**2
    return mean, vt[:k], var[:k] / var.sum()


def gaussian(z: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mean = z.mean(axis=0)
    cov = np.cov(z, rowvar=False)
    cov += np.eye(len(cov)) * 1e-6 * np.trace(cov) / len(cov)
    return mean, cov


def condition(mean: np.ndarray, cov: np.ndarray, obs: list[int], x_obs: np.ndarray,
              noise: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Media y varianza (diagonal) condicionadas; las observadas quedan tal cual."""
    n = len(mean)
    obs = list(obs)
    un = [i for i in range(n) if i not in obs]
    soo = cov[np.ix_(obs, obs)] + np.diag(noise**2)
    sol = np.linalg.solve(soo, x_obs - mean[obs])
    out = mean.copy()
    out[un] = mean[un] + cov[np.ix_(un, obs)] @ sol
    out[obs] = x_obs
    var = np.diag(cov).copy()
    var[un] = var[un] - np.einsum("ij,ji->i", cov[np.ix_(un, obs)], np.linalg.solve(soo, cov[np.ix_(obs, un)]))
    var[obs] = 0
    return out, np.maximum(var, 0)


# ---------------------------------------------------------------- medida simple


def torso_girth(vertices: np.ndarray, faces: np.ndarray, torso_mask: np.ndarray, y: float) -> float:
    """Contorno (cm) del tronco a la altura y (m), como una cinta: casco convexo.

    Corta solo las caras del tronco (sin brazos) con un plano horizontal. Sirve
    para comparar el maniquí reconstruido con el real con la misma vara de medir.
    """
    from scipy.spatial import ConvexHull

    f = faces[torso_mask[faces].all(axis=1)]
    a, b, c = vertices[f[:, 0]], vertices[f[:, 1]], vertices[f[:, 2]]
    pts = []
    for p, q in ((a, b), (b, c), (c, a)):
        dp, dq = p[:, 1] - y, q[:, 1] - y
        cross = dp * dq < 0
        t = dp[cross] / (dp[cross] - dq[cross])
        pts.append(p[cross][:, [0, 2]] + t[:, None] * (q[cross][:, [0, 2]] - p[cross][:, [0, 2]]))
    pts = np.concatenate(pts)
    if len(pts) < 3:
        return float("nan")
    hull = ConvexHull(pts)
    ring = pts[hull.vertices]
    return float(np.linalg.norm(np.roll(ring, -1, axis=0) - ring, axis=1).sum() * 100)


# ---------------------------------------------------------------- binario


def write_binary(path: Path, header: dict, arrays: dict[str, np.ndarray]) -> None:
    """PRBM: 'PRBM' + versión (u32) + largo de cabecera (u32) + JSON + secciones."""
    dtypes = {np.float32: "f32", np.float64: "f64", np.int16: "i16", np.uint8: "u8",
              np.uint16: "u16", np.uint32: "u32"}
    sections, blobs = {}, []
    # La cabecera lleva los desplazamientos: se calcula dos veces para que su
    # propio tamaño quede dentro.
    for _ in range(2):
        head = json.dumps({**header, "sections": sections}, separators=(",", ":")).encode()
        offset = 12 + len(head)
        offset += (-offset) % 8
        sections, blobs = {}, []
        for name, arr in arrays.items():
            arr = np.ascontiguousarray(arr)
            offset += (-offset) % 8
            sections[name] = {"offset": offset, "length": int(arr.size), "dtype": dtypes[arr.dtype.type]}
            blobs.append((offset, arr.tobytes()))
            offset += arr.nbytes
    head = json.dumps({**header, "sections": sections}, separators=(",", ":")).encode()
    assert 12 + len(head) <= min(o for o, _ in blobs), "la cabecera pisa los datos"
    buf = bytearray(offset)
    buf[0:12] = b"PRBM" + struct.pack("<II", int(FORMAT_VERSION), len(head))
    buf[12:12 + len(head)] = head
    for off, data in blobs:
        buf[off:off + len(data)] = data
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(buf))


def quantize(components: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    scale = np.abs(components).max(axis=1) / 32767.0
    q = np.round(components / scale[:, None]).astype(np.int16)
    return q, scale.astype(np.float64)


# ---------------------------------------------------------------- build


def build(paths: list[Path], k: int, holdout: float, seed: int) -> None:
    # Varios archivos por base de cuerpo (trozos muestreados en paralelo).
    parts_by_sex: dict[str, list] = {}
    for p in paths:
        d = dict(np.load(p, allow_pickle=False))
        assert list(d["keys"]) == KEYS, f"{p}: claves distintas, vuelve a muestrear"
        parts_by_sex.setdefault(str(d["sex"]), []).append(d)
    data = {}
    for sex, ds in parts_by_sex.items():
        data[sex] = {**ds[0], **{key: np.concatenate([d[key] for d in ds])
                               for key in ("vertices", "measurements", "params")}}
        print(f"{sex}: {len(data[sex]['vertices'])} cuerpos")
    assert set(data) == {"male", "female"}, "Hacen falta muestras de las dos bases de cuerpo"
    faces = data["male"]["faces"]
    parts = data["male"]["parts"]
    n_vert = data["male"]["vertices"].shape[1]

    rng = np.random.default_rng(seed)
    split = {}
    for sex, d in data.items():
        idx = rng.permutation(len(d["vertices"]))
        n_test = int(len(idx) * holdout)
        split[sex] = (idx[n_test:], idx[:n_test])

    train_v = np.concatenate([data[s]["vertices"][split[s][0]].reshape(len(split[s][0]), -1)
                              for s in data]).astype(np.float64)
    mean_v, comps, explained = pca(train_v, k)
    print(f"PCA: {k} componentes explican el {explained.sum() * 100:.3f} % de la varianza")

    q, scale = quantize(comps)
    comps_q = q.astype(np.float64) * scale[:, None]
    quant_err = np.abs(comps_q - comps).max()

    models, report = {}, {"components": k, "explained_variance": float(explained.sum()),
                          "vertex_count": int(n_vert), "face_count": int(len(faces)), "sexes": {}}
    torso = parts == 1
    cases = []
    for sex, d in data.items():
        tr, te = split[sex]
        v = d["vertices"].reshape(len(d["vertices"]), -1).astype(np.float64)
        coeff = (v - mean_v) @ comps_q.T
        z = np.concatenate([d["measurements"], coeff], axis=1)
        mean, cov = gaussian(z[tr])
        models[sex] = (mean, cov)

        # --- validación con cuerpos que el modelo no ha visto
        m_keys = len(KEYS)
        obs = [KEYS.index(key) for key in BASIC]
        noise = np.array([NOISE[key] for key in BASIC])
        vert_err, girth_err, est_err = [], {key: [] for key in ("chest", "waist", "hip")}, {}
        for j in te:
            truth = z[j]
            pred, _ = condition(mean, cov, obs, truth[obs], noise)
            recon = (mean_v + pred[m_keys:] @ comps_q).reshape(-1, 3)
            real = d["vertices"][j].astype(np.float64)
            vert_err.append(np.sqrt(((recon - real) ** 2).sum(axis=1)).mean() * 1000)
            for key, zkey in (("chest", "z_bust"), ("waist", "z_waist"), ("hip", "z_hip")):
                y = truth[KEYS.index(zkey)] / 100
                girth_err[key].append(torso_girth(recon, faces, torso, y) - torso_girth(real, faces, torso, y))
            for i, key in enumerate(KEYS):
                if i not in obs:
                    est_err.setdefault(key, []).append(pred[i] - truth[i])
        report["sexes"][sex] = {
            "train": int(len(tr)), "test": int(len(te)),
            "given": BASIC,
            "vertex_error_mm": {"mean": float(np.mean(vert_err)), "p95": float(np.percentile(vert_err, 95))},
            "girth_error_cm": {key: {"mae": float(np.nanmean(np.abs(e))), "bias": float(np.nanmean(e)),
                                     "p95": float(np.nanpercentile(np.abs(e), 95))}
                               for key, e in girth_err.items()},
            "estimated_error_cm": {key: {"mae": float(np.mean(np.abs(e))),
                                         "p95": float(np.percentile(np.abs(e), 95))}
                                   for key, e in est_err.items()},
        }
        print(json.dumps(report["sexes"][sex], indent=1, ensure_ascii=False))

        # --- casos para comprobar la implementación de la app
        for j in te[:3]:
            given = {key: round(float(z[j][KEYS.index(key)]), 1) for key in BASIC}
            obs_idx = [KEYS.index(key) for key in given]
            pred, var = condition(mean, cov, obs_idx, np.array(list(given.values())),
                                  np.array([NOISE[key] for key in given]))
            cases.append({
                "sex": sex, "given": given,
                "expected_measurements": {key: float(pred[i]) for i, key in enumerate(KEYS)},
                "expected_sd": {key: float(np.sqrt(var[i])) for i, key in enumerate(KEYS)},
                "expected_coefficients": [float(c) for c in pred[m_keys:]],
            })

    report["quantization_max_error"] = float(quant_err)
    header = {
        "version": f"{FORMAT_VERSION}.{time.strftime('%Y%m%d')}",
        "vertex_count": int(n_vert), "component_count": int(k), "keys": KEYS, "noise": NOISE,
        "component_scale": [float(s) for s in scale],
        "validation": {sex: {
            "vertex_error_mm": r["vertex_error_mm"]["mean"],
            "girth_mae_cm": {key: round(v["mae"], 2) for key, v in r["girth_error_cm"].items()},
        } for sex, r in report["sexes"].items()},
    }
    face_dtype = np.uint16 if n_vert < 65536 else np.uint32
    arrays = {
        "faces": faces.astype(face_dtype).ravel(),
        "mean_vertices": mean_v.astype(np.float32),
        "components": q.ravel(),
        "vertex_part": parts.astype(np.uint8),
        "male_mean": models["male"][0], "male_cov": models["male"][1].ravel(),
        "female_mean": models["female"][0], "female_cov": models["female"][1].ravel(),
    }
    write_binary(OUT_BIN, header, arrays)
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    OUT_CASES.parent.mkdir(parents=True, exist_ok=True)
    OUT_CASES.write_text(json.dumps(cases, separators=(",", ":")))
    print(f"{OUT_BIN}: {OUT_BIN.stat().st_size / 1e6:.2f} MB")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sample")
    s.add_argument("--sex", choices=["male", "female"], required=True)
    s.add_argument("--n", type=int, default=1200)
    s.add_argument("--seed", type=int, default=20261109)
    s.add_argument("--shard", type=int, default=0, help="trozo (cambia la semilla)")
    s.add_argument("--out", type=Path, required=True)
    b = sub.add_parser("build")
    b.add_argument("samples", type=Path, nargs="+")
    b.add_argument("--components", type=int, default=40)
    b.add_argument("--holdout", type=float, default=0.1)
    b.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    if args.cmd == "sample":
        sample(args.sex, args.n, args.seed, args.shard, args.out)
    else:
        build(args.samples, args.components, args.holdout, args.seed)


if __name__ == "__main__":
    main()
