"""API HTTP del motor.

Sin estado y sin registros de datos personales: recibe medidas, calcula y
responde. Los registros de acceso solo llevan método, ruta y código.

Rutas (todas bajo /v1 salvo la de salud):

* GET  /health                 estado del servicio
* GET  /v1/measurements        catálogo de medidas (para construir formularios)
* GET  /v1/topology            parte del cuerpo de cada vértice del maniquí
* POST /v1/body                medidas -> parámetros del maniquí y medidas completas
* POST /v1/body/mesh           parámetros -> maniquí en GLB
* POST /v1/fit                 cuerpo + prenda -> recomendación de talla
* POST /v1/fit/reference       prenda + prenda propia de referencia -> talla
"""

from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from . import __version__
from .body import FIXED_PHENOTYPES, FREE_PHENOTYPES, LOCAL_CHANGES, BodyModel, mesh_to_glb
from .ease import ENGINE_VERSION
from .fit import Preference, ReferenceGarment, compare_with_reference, fit_garment
from .garments import Garment
from .measurements import MEASUREMENTS, MeasurementError

logger = logging.getLogger("probador")

PHENOTYPE_KEYS = set(FIXED_PHENOTYPES) | {"gender"} | set(FREE_PHENOTYPES["female"])

_model_ready = threading.Event()
_model_error: list[str] = []


def _load_model() -> None:
    try:
        BodyModel.get()
        _model_ready.set()
    except Exception as exc:  # pragma: no cover - solo si falla la carga
        logger.exception("No se pudo cargar el modelo de cuerpo")
        _model_error.append(str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # El modelo se carga en segundo plano para que /health responda desde el
    # primer momento (lo necesita el arranque en Cloud Run).
    if os.environ.get("PROBADOR_LAZY_MODEL") != "1":
        threading.Thread(target=_load_model, daemon=True).start()
    yield


app = FastAPI(
    title="Probador · motor",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

_origins = [o.strip() for o in os.environ.get("PROBADOR_CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=_origins, allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Api-Key", "Authorization"],
    )


def _check_key(x_api_key: str | None) -> None:
    expected = os.environ.get("PROBADOR_API_KEY")
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Clave de API no válida")


def _body_model() -> BodyModel:
    if _model_error:
        raise HTTPException(status_code=503, detail="El modelo de cuerpo no está disponible")
    if not _model_ready.is_set():
        # Primera petición con carga perezosa, o carga aún en marcha.
        _load_model()
    return BodyModel.get()


# ------------------------------------------------------------------ modelos


class BodyRequest(BaseModel):
    sex: Literal["female", "male"] = Field(
        description="Base de cuerpo del maniquí (no es una pregunta de identidad).")
    measurements: dict[str, float]


class BodyResponse(BaseModel):
    sex: str
    phenotype: dict[str, float]
    local_changes: dict[str, float]
    measurements: dict[str, float]
    provided: list[str]
    residuals: dict[str, float]
    warnings: list[str]
    landmarks: dict[str, float]
    seconds: float
    engine_version: str = ENGINE_VERSION


class MeshRequest(BaseModel):
    phenotype: dict[str, float]
    local_changes: dict[str, float] = Field(default_factory=dict)

    @field_validator("phenotype")
    @classmethod
    def _pheno(cls, v: dict[str, float]) -> dict[str, float]:
        unknown = set(v) - PHENOTYPE_KEYS
        if unknown:
            raise ValueError(f"Parámetros desconocidos: {sorted(unknown)}")
        if any(not 0.0 <= x <= 1.0 for x in v.values()):
            raise ValueError("Los parámetros de fenotipo van de 0 a 1")
        return v

    @field_validator("local_changes")
    @classmethod
    def _local(cls, v: dict[str, float]) -> dict[str, float]:
        unknown = set(v) - set(LOCAL_CHANGES)
        if unknown:
            raise ValueError(f"Cambios locales desconocidos: {sorted(unknown)}")
        if any(not -1.0 <= x <= 1.0 for x in v.values()):
            raise ValueError("Los cambios locales van de -1 a 1")
        return v


class FitRequest(BaseModel):
    body: dict[str, float] = Field(
        description="Medidas del cuerpo, normalmente las que devuelve /v1/body.")
    garment: Garment
    preference: Preference = "regular"


class ReferenceRequest(BaseModel):
    garment: Garment
    reference: ReferenceGarment


# ------------------------------------------------------------------ rutas


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": __version__,
        "engine_version": ENGINE_VERSION,
        "body_model": "ready" if _model_ready.is_set() else (
            "error" if _model_error else "loading"),
    }


@app.get("/v1/measurements")
def measurements() -> list[dict]:
    return [
        {
            "key": m.key, "name": m.name, "unit": m.unit, "kind": m.kind,
            "basic": m.basic, "how_to": m.how_to,
            "min": m.min_plausible, "max": m.max_plausible,
        }
        for m in MEASUREMENTS
    ]


@app.get("/v1/topology")
def topology(x_api_key: str | None = Header(default=None)) -> dict:
    _check_key(x_api_key)
    parts = _body_model().vertex_parts()
    return {"vertex_count": len(parts), "parts": parts,
            "legend": {"1": "tronco y cabeza", "2": "brazos", "3": "piernas"}}


@app.post("/v1/body", response_model=BodyResponse)
def body(req: BodyRequest, x_api_key: str | None = Header(default=None)) -> BodyResponse:
    _check_key(x_api_key)
    try:
        fit = _body_model().fit(req.sex, req.measurements, include_mesh=False)
    except MeasurementError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return BodyResponse(
        sex=fit.sex, phenotype=fit.phenotype, local_changes=fit.local_changes,
        measurements=fit.measurements, provided=fit.provided,
        residuals=fit.residuals, warnings=fit.warnings, landmarks=fit.landmarks,
        seconds=round(fit.seconds, 2),
    )


@app.post("/v1/body/mesh", response_class=Response,
          responses={200: {"content": {"model/gltf-binary": {}}}})
def body_mesh(req: MeshRequest, x_api_key: str | None = Header(default=None)) -> Response:
    _check_key(x_api_key)
    vertices, faces = _body_model().mesh_from_params(req.phenotype, req.local_changes)
    return Response(content=mesh_to_glb(vertices, faces), media_type="model/gltf-binary",
                    headers={"Cache-Control": "private, max-age=86400"})


@app.post("/v1/fit")
def fit(req: FitRequest, x_api_key: str | None = Header(default=None)) -> dict:
    _check_key(x_api_key)
    return fit_garment(req.garment, req.body, req.preference).to_dict()


@app.post("/v1/fit/reference")
def fit_reference(req: ReferenceRequest, x_api_key: str | None = Header(default=None)) -> dict:
    _check_key(x_api_key)
    try:
        return compare_with_reference(req.garment, req.reference).to_dict()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
