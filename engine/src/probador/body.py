"""Maniquí 3D a partir de medidas.

Partimos del modelo paramétrico Anny (NAVER LABS, Apache 2.0) y lo medimos con
clad-body (Apache 2.0, norma ISO 8559-1). El ajuste busca los parámetros del
modelo que reproducen las medidas del usuario resolviendo un problema de
mínimos cuadrados no lineal con Levenberg-Marquardt:

    min_θ  Σ_k ((m_k(θ) - m̂_k) / τ_k)²  +  Σ_i λ_i ((θ_i - θ̄_i) / s_i)²

m_k(θ) es la medida k del maniquí (derivable gracias a clad-body), m̂_k la del
usuario, τ_k su tolerancia, y el segundo término mantiene el cuerpo cerca de
uno medio para que las medidas que el usuario no da salgan plausibles.

Los parámetros son de dos tipos:

* Fenotipo (globales): altura, peso, musculatura, proporciones y, en cuerpos
  femeninos, talla de copa. Explican la forma general.
* Cambios locales («measure-*-incr» de MakeHuman): ajustan un contorno o una
  longitud concreta. Están más penalizados, así que solo se usan para lo que
  el fenotipo no explica.

No usamos los parámetros de origen étnico del modelo: se quedan fijos en la
mezcla neutra. La edad se fija en adulto joven.
"""

from __future__ import annotations

import io
import json
import logging
import threading
import time
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import numpy as np

from .measurements import BY_CLAD_KEY, BY_KEY, DERIVED_CLAD_KEYS, validate

logger = logging.getLogger(__name__)

Sex = Literal["female", "male"]

# Valor del parámetro «gender» de Anny para cada base de cuerpo
# (comprobado midiendo: 0 da el cuerpo masculino y 1 el femenino).
GENDER_VALUE: dict[str, float] = {"male": 0.0, "female": 1.0}

FIXED_PHENOTYPES: dict[str, float] = {
    "age": 0.5,          # adulto joven
    "firmness": 0.5,
    "african": 1 / 3,    # mezcla neutra, nunca se optimiza
    "asian": 1 / 3,
    "caucasian": 1 / 3,
}

# Cambio local -> medida a la que sirve. Solo se activa si el usuario da esa
# medida; si no, se queda en 0 (forma media).
LOCAL_CHANGES: dict[str, str] = {
    "measure-bust-circ-incr": "chest",
    "measure-underbust-circ-incr": "underbust",
    "measure-waist-circ-incr": "waist",
    "stomach-pregnant-incr": "stomach",
    "measure-hips-circ-incr": "hip",
    "measure-thigh-circ-incr": "thigh",
    "measure-knee-circ-incr": "knee",
    "measure-calf-circ-incr": "calf",
    "measure-upperarm-circ-incr": "upper_arm",
    "measure-neck-circ-incr": "neck",
    "measure-shoulder-dist-incr": "shoulder_width",
    "measure-upperleg-height-incr": "inseam",
    "measure-lowerleg-height-incr": "inseam",
    "measure-upperarm-length-incr": "sleeve_length",
    "measure-lowerarm-length-incr": "sleeve_length",
}

FREE_PHENOTYPES: dict[str, tuple[str, ...]] = {
    "male": ("height", "weight", "muscle", "proportions"),
    "female": ("height", "weight", "muscle", "proportions", "cupsize"),
}

KNOT_EPS = 2e-3
# Paramos cuando todas las medidas están a menos de este número de
# tolerancias (0,6 × 0,5 cm = 0,3 cm en los contornos).
CONVERGED = 0.6
# Corrección con la medición de referencia: rondas máximas y umbral (en
# tolerancias) a partir del cual no hace falta corregir.
ISO_ROUNDS = 2
ISO_CONVERGED = 1.0
# Tiempo máximo del bucle de ajuste: con medidas muy raras puede tardar en
# converger; preferimos devolver la mejor aproximación con su aviso.
TIME_BUDGET_S = 8.0

# Tabla de arranque: cuerpos de muestra ya medidos (ver
# scripts/build_init_table.py). Empezar del más parecido ahorra iteraciones.
INIT_TABLE_PATH = Path(__file__).parent / "data" / "init_table.json"
_init_table_cache: dict | None = None


def _init_table() -> dict | None:
    global _init_table_cache
    if _init_table_cache is None and INIT_TABLE_PATH.exists():
        _init_table_cache = json.loads(INIT_TABLE_PATH.read_text())
    return _init_table_cache


def initial_phenotype(sex: str, measurements: dict[str, float]) -> dict[str, float]:
    """Fenotipo de partida: el del cuerpo de muestra más parecido.

    Compara solo las medidas que ha dado el usuario, cada una dividida por
    una escala típica para que pesen lo mismo. Sin tabla, empieza del cuerpo
    medio (apartado de los nudos de la interpolación).
    """
    default = {name: 0.48 for name in FREE_PHENOTYPES[sex]}
    table = _init_table()
    if not table or sex not in table["samples"]:
        return default
    scales = table["scales"]
    best, best_d = None, float("inf")
    for sample in table["samples"][sex]:
        d = 0.0
        for key, value in measurements.items():
            if key in sample["measurements"] and key in scales:
                d += ((sample["measurements"][key] - value) / scales[key]) ** 2
        if d < best_d:
            best, best_d = sample, d
    return dict(best["phenotype"]) if best else default


# Regularización: peso λ y escala s de cada tipo de parámetro.
PHENO_PRIOR = (0.02, 0.5)   # fenotipo: libre, solo evita extremos
LOCAL_PRIOR = (0.15, 1.0)   # cambios locales: más caros que el fenotipo
PHENO_BOUNDS = (0.0, 1.0)
LOCAL_BOUNDS = (-1.0, 1.0)

# Altura de la cinturilla según el tiro del pantalón, como fracción del
# camino de la cintura natural (0) a la línea de cadera (1). Valores de
# partida a calibrar con prendas reales.
RISE_HEIGHT_FRACTION: dict[str, float] = {"high": 0.05, "mid": 0.25, "low": 0.5}

# Medidas que devolvemos siempre del maniquí final (dadas o estimadas).
REPORT_CLAD_KEYS = tuple(
    [m.clad_key for m in BY_KEY.values()] + list(DERIVED_CLAD_KEYS)
)


@dataclass
class BodyFit:
    """Resultado de ajustar el maniquí a unas medidas."""

    sex: Sex
    # Parámetros del modelo: es lo único que hace falta guardar para
    # regenerar el maniquí.
    phenotype: dict[str, float]
    local_changes: dict[str, float]
    # Medidas del maniquí final, con nuestras claves. Incluye las que el
    # usuario no dio (estimadas) y las derivadas (tiro, largo de torso...).
    measurements: dict[str, float]
    # Qué medidas dio el usuario.
    provided: list[str]
    # Diferencia maniquí - usuario en las medidas dadas.
    residuals: dict[str, float]
    warnings: list[str]
    iterations: int
    seconds: float
    # Alturas (m, desde el suelo) de las líneas de referencia del cuerpo,
    # para colorear zonas en la app.
    landmarks: dict[str, float] = field(default_factory=dict)
    vertices: np.ndarray | None = field(default=None, repr=False)
    faces: np.ndarray | None = field(default=None, repr=False)

    @property
    def max_abs_residual(self) -> float:
        """Mayor error absoluto, sin contar el peso (que se mide en kg)."""
        vals = [abs(v) for k, v in self.residuals.items() if k != "weight"]
        return max(vals) if vals else 0.0

    def to_glb(self) -> bytes:
        return mesh_to_glb(self.vertices, self.faces)


def mesh_to_glb(vertices: np.ndarray, faces: np.ndarray) -> bytes:
    """Exporta la malla a GLB (glTF binario) en la convención de glTF.

    El maniquí viene en Z arriba, metros, +Y hacia delante. glTF usa Y arriba
    y el frente del modelo mirando a +Z, así que aplicamos la rotación
    (x, y, z) -> (-x, z, y), que conserva la orientación de la malla.
    """
    import trimesh

    v = np.asarray(vertices, dtype=np.float32)
    v_gltf = np.stack([-v[:, 0], v[:, 2], v[:, 1]], axis=1)
    mesh = trimesh.Trimesh(vertices=v_gltf, faces=faces, process=False)
    buf = io.BytesIO()
    mesh.export(buf, file_type="glb")
    return buf.getvalue()


class BodyModel:
    """Modelo Anny cargado una vez y reutilizado en cada ajuste.

    La primera vez que se crea en una máquina, Anny lee miles de «targets» de
    MakeHuman y tarda en torno a un minuto; después guarda los datos ya
    procesados en ``ANNY_CACHE_DIR`` (por defecto ``~/.cache/anny``) y crear el
    modelo cuesta un par de segundos. La imagen Docker hace esa primera
    creación al construirse, para que el servidor arranque rápido.

    El modelo no es seguro entre hilos (guarda datos de la última pasada),
    por eso cada ajuste toma un cerrojo.

    No usamos nunca la conversión a SMPL-X de Anny: necesita datos con
    licencia no comercial.
    """

    _instance: "BodyModel | None" = None
    _instance_lock = threading.Lock()

    def __init__(self):
        import torch

        self.torch = torch
        self.device = torch.device("cpu")
        self.labels = list(LOCAL_CHANGES)
        self.model = self._build()
        from clad_body.load.anny import build_anny_apose

        self.pose = build_anny_apose(self.model, self.device)
        self.lock = threading.Lock()

    @classmethod
    def get(cls) -> "BodyModel":
        """Instancia compartida por todo el proceso."""
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _build(self):
        import anny

        t = time.time()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = anny.create_fullbody_model(
                all_phenotypes=True,
                triangulate_faces=True,
                local_changes=self.labels,
            ).to(dtype=self.torch.float32, device=self.device)
        logger.info("Modelo de cuerpo listo en %.1f s", time.time() - t)
        return model

    # ------------------------------------------------------------------ util

    def _forward(self, pheno: dict, local: dict, *, grad: bool):
        torch = self.torch
        ctx = torch.enable_grad() if grad else torch.no_grad()
        with ctx:
            out = self.model(
                pose_parameters=self.pose,
                phenotype_kwargs=pheno,
                local_changes_kwargs=local,
                pose_parameterization="root_relative_world",
                return_bone_ends=True,
            )
        self.model._last_bone_heads = out["bone_heads"]
        self.model._last_bone_tails = out["bone_tails"]
        return out

    def _measure_grad(self, pheno: dict, local: dict, keys: frozenset[str]):
        from clad_body.measure.anny import _measure_grad_from_verts

        out = self._forward(pheno, local, grad=True)
        return _measure_grad_from_verts(self.model, out["vertices"], requested=keys)

    # ------------------------------------------------------------------ fit

    def fit(
        self,
        sex: Sex,
        measurements: dict[str, float],
        *,
        max_iterations: int = 15,
        include_mesh: bool = True,
    ) -> BodyFit:
        if sex not in GENDER_VALUE:
            raise ValueError("sex tiene que ser 'female' o 'male'")
        user_warnings = validate(measurements)
        with self.lock:
            return self._fit_locked(sex, measurements, user_warnings,
                                    max_iterations, include_mesh)

    def _fit_locked(self, sex, measurements, user_warnings, max_iterations,
                    include_mesh) -> BodyFit:
        torch = self.torch
        t0 = time.time()

        provided = [k for k in BY_KEY if k in measurements]
        targets = torch.tensor([float(measurements[k]) for k in provided],
                               dtype=torch.float32)
        tols = torch.tensor([BY_KEY[k].tolerance for k in provided], dtype=torch.float32)
        clad_keys = frozenset(BY_KEY[k].clad_key for k in provided)

        free_pheno = list(FREE_PHENOTYPES[sex])
        active_local = [lab for lab, key in LOCAL_CHANGES.items() if key in measurements]
        n_p, n_l = len(free_pheno), len(active_local)

        start = initial_phenotype(sex, measurements)
        theta = torch.cat([
            torch.tensor([start[name] for name in free_pheno], dtype=torch.float32),
            torch.zeros(n_l),
        ])
        lower = torch.tensor([PHENO_BOUNDS[0]] * n_p + [LOCAL_BOUNDS[0]] * n_l)
        upper = torch.tensor([PHENO_BOUNDS[1]] * n_p + [LOCAL_BOUNDS[1]] * n_l)
        prior_mean = torch.cat([torch.full((n_p,), 0.5), torch.zeros(n_l)])
        prior_w = torch.tensor(
            [np.sqrt(PHENO_PRIOR[0]) / PHENO_PRIOR[1]] * n_p
            + [np.sqrt(LOCAL_PRIOR[0]) / LOCAL_PRIOR[1]] * n_l,
            dtype=torch.float32,
        )

        fixed = dict(FIXED_PHENOTYPES, gender=GENDER_VALUE[sex])

        def unpack(th):
            pheno = {k: torch.tensor([v]) for k, v in fixed.items()}
            for i, name in enumerate(free_pheno):
                pheno[name] = th[i:i + 1]
            local = {lab: torch.zeros(1) for lab in self.labels}
            for j, lab in enumerate(active_local):
                local[lab] = th[n_p + j:n_p + j + 1]
            return pheno, local

        def residuals(th, goal):
            th = th.detach().clone().requires_grad_(True)
            pheno, local = unpack(th)
            m = self._measure_grad(pheno, local, clad_keys)
            meas = torch.stack([m[BY_KEY[k].clad_key].reshape(()) for k in provided])
            r_meas = (meas - goal) / tols
            r_prior = prior_w * (th - prior_mean)
            r = torch.cat([r_meas, r_prior])
            rows = []
            for i in range(len(provided)):
                (g,) = torch.autograd.grad(r_meas[i], th, retain_graph=True,
                                           allow_unused=True)
                rows.append(torch.zeros_like(th) if g is None else g)
            j_meas = torch.stack(rows)
            j_prior = torch.diag(prior_w)
            return r.detach(), torch.cat([j_meas, j_prior]).detach(), meas.detach()

        def off_knots(th):
            # La interpolación de los fenotipos de Anny es lineal a trozos con
            # nudos en 0, 0.5 y 1, y en un nudo el gradiente sale 0. Si un
            # fenotipo cae justo en uno, lo apartamos un poco.
            th = th.clone()
            for i in range(n_p):
                for knot in (0.0, 0.5, 1.0):
                    if abs(float(th[i]) - knot) < KNOT_EPS:
                        th[i] = knot + (KNOT_EPS if knot < 1.0 else -KNOT_EPS)
            return th

        def solve(theta, goal, max_iter):
            """Levenberg-Marquardt sobre las medidas derivables."""
            mu = 1e-2
            theta = off_knots(theta)
            r, J, meas = residuals(theta, goal)
            cost = 0.5 * float(r @ r)
            done = 0
            for done in range(1, max_iter + 1):
                if float(((meas - goal).abs() / tols).max()) < CONVERGED:
                    break
                if time.time() - t0 > TIME_BUDGET_S:
                    logger.warning("Ajuste cortado por tiempo tras %d iteraciones", done)
                    break
                JtJ = J.T @ J
                g = J.T @ r
                accepted = False
                for _ in range(6):
                    A = JtJ + mu * (torch.diag(torch.diag(JtJ)) + torch.eye(len(theta)))
                    step = torch.linalg.solve(A, -g)
                    cand = off_knots(torch.clamp(theta + step, lower, upper))
                    r_c, J_c, meas_c = residuals(cand, goal)
                    cost_c = 0.5 * float(r_c @ r_c)
                    if cost_c < cost:
                        accepted = True
                        mu = max(mu / 3, 1e-6)
                        break
                    mu *= 4
                if not accepted:
                    break
                rel_gain = (cost - cost_c) / max(cost, 1e-12)
                theta, r, J, meas, cost = cand, r_c, J_c, meas_c, cost_c
                if rel_gain < 1e-4:
                    break
            return theta, J, done

        theta, J, iterations = solve(theta, targets, max_iterations)

        # Las medidas derivables de clad-body son aproximaciones de su
        # medición de referencia (ISO 8559-1), con desvíos de hasta ~1,5 cm
        # en algunas zonas. Medimos con la referencia y, si no cuadra,
        # corregimos con un paso de Gauss-Newton usando el último jacobiano
        # (el desvío cambia poco cerca de la solución, así que basta).
        iso_keys = sorted(clad_keys | {"waist_cm", "hip_cm"})
        is_weight = torch.tensor([k == "weight" for k in provided])
        best = None
        for round_ in range(ISO_ROUNDS + 1):
            pheno, local = unpack(theta.detach())
            body, raw = self._iso_measure(pheno, local, iso_keys)
            iso = torch.tensor([float(raw.get(BY_KEY[k].clad_key, 0.0)) for k in provided],
                               dtype=torch.float32)
            # Si la referencia no encuentra una zona (devuelve 0), esa medida
            # no entra en la corrección: nos quedamos con el ajuste derivable.
            unmeasured = iso <= 0
            iso = torch.where(unmeasured, targets, iso)
            err = (iso - targets) / tols
            # El peso no entra en la corrección: su versión derivable y la de
            # referencia son la misma fórmula, y es un objetivo blando (el
            # peso depende de la composición corporal, no solo de la forma).
            err = torch.where(is_weight, torch.zeros_like(err), err)
            worst = float(err.abs().max())
            sq = float(err @ err)
            if best is None or sq < best[0]:
                best = (sq, theta.clone(), pheno, local, body, raw, iso,
                        [k for k, u in zip(provided, unmeasured) if u])
            if round_ == ISO_ROUNDS or worst < ISO_CONVERGED:
                break
            n_m = len(provided)
            Jm = J[:n_m]
            # Mismo problema regularizado que el ajuste: medidas + prior.
            A = Jm.T @ Jm + J[n_m:].T @ J[n_m:] + 1e-3 * torch.eye(len(theta))
            step = torch.linalg.solve(A, -(Jm.T @ err))
            theta = off_knots(torch.clamp(theta + step, lower, upper))
            iterations += 1
        _, theta, pheno, local, body, raw, iso, unmeasured_keys = best

        fitted = {k: float(v) for k, v in zip(provided, iso) if k not in unmeasured_keys}
        result = self._finish(sex, pheno, local, body, raw, provided, measurements,
                              fitted, user_warnings, iterations, include_mesh)
        result.seconds = time.time() - t0
        return result

    def _iso_measure(self, pheno, local, keys):
        from clad_body.load.anny import load_anny_from_verts
        from clad_body.measure import measure

        out = self._forward(pheno, local, grad=False)
        body = load_anny_from_verts(
            out["vertices"], self.model,
            phenotype_kwargs=pheno, local_changes_kwargs=local,
            bone_heads=out["bone_heads"], bone_tails=out["bone_tails"],
            source="probador",
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw = measure(body, only=list(keys))
        return body, raw

    # --------------------------------------------------------------- finish

    def _finish(self, sex, pheno, local, body, raw, provided, measurements,
                fitted, user_warnings, iterations, include_mesh) -> BodyFit:
        from clad_body.measure import measure

        # Medimos lo que el usuario no dio (lo que dio ya está en «raw»).
        rest = [k for k in REPORT_CLAD_KEYS if k not in raw]
        if rest:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                raw = {**measure(body, only=rest), **raw}

        report: dict[str, float] = {}
        for clad_key, value in raw.items():
            if clad_key.startswith("_") or not isinstance(value, (int, float, np.floating)):
                continue
            # clad-body devuelve 0 cuando no encuentra el contorno (pasa en
            # algún cuerpo con brazos muy pegados): mejor no dar la medida.
            if not value > 0:
                logger.warning("Medida %s no disponible en este maniquí", clad_key)
                continue
            if clad_key in BY_CLAD_KEY:
                report[BY_CLAD_KEY[clad_key].key] = round(float(value), 1)
            elif clad_key in DERIVED_CLAD_KEYS:
                report[DERIVED_CLAD_KEYS[clad_key]] = round(float(value), 1)

        # Las medidas que dio el usuario se usan tal cual en el resto del
        # motor: el maniquí las reproduce con error < tolerancia y la
        # recomendación de talla no debe depender de ese pequeño error.
        residuals = {}
        for k in provided:
            if k in fitted:
                residuals[k] = round(fitted[k] - float(measurements[k]), 2)
            report[k] = float(measurements[k])

        landmarks = {}
        for name, key in (("bust", "_bust_z"), ("waist", "_waist_z"), ("hip", "_hip_z"),
                          ("thigh", "_thigh_z"), ("knee", "_knee_z")):
            if key in raw and isinstance(raw[key], (int, float, np.floating)):
                landmarks[name] = round(float(raw[key]), 4)
        if "inseam" in report:
            landmarks["crotch"] = round(report["inseam"] / 100, 4)

        report.update(self._waistbands(body, landmarks, report))

        warnings_out = list(user_warnings)
        for k, err in residuals.items():
            tol = BY_KEY[k].tolerance
            if abs(err) > max(2.0, 3 * tol):
                warnings_out.append(
                    f"No hemos podido reproducir bien tu {BY_KEY[k].name.lower()} "
                    f"(diferencia de {err:+.1f} {BY_KEY[k].unit}). Puede que esa "
                    "medida no encaje con las demás: revísala."
                )

        return BodyFit(
            sex=sex,
            phenotype={k: round(float(v.reshape(())), 5) for k, v in pheno.items()},
            local_changes={k: round(float(v.reshape(())), 5) for k, v in local.items()
                           if abs(float(v.reshape(()))) > 1e-6},
            measurements=report,
            provided=provided,
            residuals=residuals,
            warnings=warnings_out,
            iterations=iterations,
            seconds=0.0,
            landmarks=landmarks,
            vertices=body.vertices if include_mesh else None,
            faces=body.faces if include_mesh else None,
        )

    def _waistbands(self, body, landmarks: dict[str, float],
                    report: dict[str, float]) -> dict[str, float]:
        """Contorno del cuerpo donde se apoya la cinturilla de un pantalón.

        Corta el torso (sin brazos) a la altura de cada tipo de tiro, entre la
        cintura natural y la cadera, y lo ancla a la cintura del usuario:
        cinturilla = cintura + (corte a esa altura - corte a la cintura).
        """
        if not {"waist", "hip"} <= landmarks.keys() or "waist" not in report:
            return {}
        from clad_body.measure._slicer import torso_circumference_at_z
        from clad_body.measure.anny import build_arm_mask, build_torso_mesh

        torso = build_torso_mesh(body.mesh, build_arm_mask(self.model))
        wz, hz = landmarks["waist"], landmarks["hip"]

        def circ(z):
            return torso_circumference_at_z(torso, z, max_x_extent=0.6) * 100

        base = circ(wz)
        if base <= 0:
            return {}
        out = {}
        for rise, frac in RISE_HEIGHT_FRACTION.items():
            c = circ(wz - frac * (wz - hz))
            if c > 0:
                out[f"waistband_{rise}"] = round(report["waist"] + (c - base), 1)
        return out

    def vertex_parts(self) -> list[int]:
        """Parte del cuerpo de cada vértice: 1 tronco y cabeza, 2 brazos, 3 piernas.

        La topología es la misma para todos los maniquíes, así que la app lo
        pide una vez y lo usa para colorear zonas (los brazos no deben
        pintarse con el color del pecho aunque estén a su altura).
        """
        from clad_body.measure.anny import (
            ARM_HAND_BONES,
            LEFT_LEG_BONES,
            RIGHT_LEG_BONES,
        )

        torch = self.torch
        vbw = self.model.vertex_bone_weights.detach().cpu()
        vbi = self.model.vertex_bone_indices.detach().cpu()
        dominant = vbi[torch.arange(len(vbi)), vbw.argmax(dim=1)].numpy()
        parts = np.ones(len(dominant), dtype=np.int8)
        parts[np.isin(dominant, list(ARM_HAND_BONES))] = 2
        parts[np.isin(dominant, list(LEFT_LEG_BONES | RIGHT_LEG_BONES))] = 3
        return parts.tolist()

    def mesh_from_params(self, phenotype: dict[str, float],
                         local_changes: dict[str, float]):
        """Regenera el maniquí a partir de parámetros guardados."""
        from clad_body.load.anny import load_anny_from_verts

        torch = self.torch
        values = {**FIXED_PHENOTYPES, **phenotype}
        pheno = {k: torch.tensor([float(v)]) for k, v in values.items()}
        local = {lab: torch.tensor([float(local_changes.get(lab, 0.0))])
                 for lab in self.labels}
        with self.lock:
            out = self._forward(pheno, local, grad=False)
            body = load_anny_from_verts(out["vertices"], self.model,
                                        bone_heads=out["bone_heads"],
                                        bone_tails=out["bone_tails"])
        return body.vertices, body.faces
