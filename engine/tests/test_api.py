"""Tests de la API.

Los marcados como ``slow`` cargan el modelo de cuerpo real.
"""

import os

os.environ.setdefault("PROBADOR_LAZY_MODEL", "1")

import pytest
from fastapi.testclient import TestClient

from probador.api import app

client = TestClient(app)

TSHIRT = {
    "brand": "Prueba", "name": "Camiseta", "category": "tshirt",
    "sizes": [
        {"label": "S", "measurements": {"chest_flat": 50, "length": 68}},
        {"label": "M", "measurements": {"chest_flat": 54, "length": 70}},
        {"label": "L", "measurements": {"chest_flat": 58, "length": 72}},
    ],
}
BODY = {"height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98,
        "inseam": 81, "torso_length": 73}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_measurement_catalog():
    r = client.get("/v1/measurements")
    assert r.status_code == 200
    keys = {m["key"] for m in r.json()}
    assert {"height", "weight", "chest", "waist", "hip", "inseam"} <= keys


def test_fit_endpoint():
    r = client.post("/v1/fit", json={"body": BODY, "garment": TSHIRT})
    assert r.status_code == 200
    data = r.json()
    assert data["recommended"] == "M"
    assert data["explanation"][0].startswith("Te recomendamos")


def test_fit_rejects_bad_garment():
    bad = dict(TSHIRT, category="calcetin")
    r = client.post("/v1/fit", json={"body": BODY, "garment": bad})
    assert r.status_code == 422


def test_reference_endpoint():
    r = client.post("/v1/fit/reference", json={
        "garment": TSHIRT,
        "reference": {"category": "tshirt", "measurements": {"chest_flat": 54.5}},
    })
    assert r.status_code == 200
    assert r.json()["recommended"] == "M"


def test_mesh_request_validation():
    r = client.post("/v1/body/mesh", json={"phenotype": {"height": 2.0}})
    assert r.status_code == 422
    r = client.post("/v1/body/mesh", json={"phenotype": {"raza": 0.5}})
    assert r.status_code == 422


def test_api_key(monkeypatch):
    monkeypatch.setenv("PROBADOR_API_KEY", "secreta")
    r = client.post("/v1/fit", json={"body": BODY, "garment": TSHIRT})
    assert r.status_code == 401
    r = client.post("/v1/fit", json={"body": BODY, "garment": TSHIRT},
                    headers={"X-Api-Key": "secreta"})
    assert r.status_code == 200


@pytest.mark.slow
def test_body_endpoint_and_mesh():
    r = client.post("/v1/body", json={"sex": "male", "measurements": {
        "height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98, "inseam": 81}})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["measurements"]["chest"] == 98
    assert "torso_length" in data["measurements"]
    assert "waistband_mid" in data["measurements"]

    mesh = client.post("/v1/body/mesh", json={
        "phenotype": data["phenotype"], "local_changes": data["local_changes"]})
    assert mesh.status_code == 200
    assert mesh.headers["content-type"] == "model/gltf-binary"
    assert mesh.content[:4] == b"glTF"

    # La talla con el cuerpo devuelto por el maniquí.
    fit = client.post("/v1/fit", json={"body": data["measurements"], "garment": TSHIRT})
    assert fit.json()["recommended"] == "M"


@pytest.mark.slow
def test_body_endpoint_rejects_missing_height():
    r = client.post("/v1/body", json={"sex": "male", "measurements": {"weight": 70}})
    assert r.status_code == 422
    assert "altura" in r.json()["detail"]


@pytest.mark.slow
def test_topology():
    r = client.get("/v1/topology")
    data = r.json()
    assert data["vertex_count"] == len(data["parts"]) > 10000
    assert set(data["parts"]) == {1, 2, 3}
