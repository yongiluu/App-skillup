"""Configuración común de las pruebas: variables de entorno y clientes con sesión."""

import os

# Deben definirse antes de importar la app.
os.environ["SECRET_KEY"] = "clave-de-prueba-solo-para-tests-0123456789abcdef"
os.environ["DEMO_PASSWORD"] = "clave-demo-tests"
os.environ["APP_ENV"] = "local"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.repositorio import repo_mock  # noqa: E402
from app.seguridad import limitador  # noqa: E402

PASSWORD = os.environ["DEMO_PASSWORD"]


def _token(c: TestClient, usuario: str) -> str:
    r = c.post("/auth/login", json={"usuario": usuario, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def anonimo():
    repo_mock.cache_clear()  # cada test parte con los mocks limpios
    limitador.limpiar()
    return TestClient(app)


@pytest.fixture()
def client(anonimo):
    """Cliente con sesión de jefe de turno."""
    anonimo.headers["Authorization"] = f"Bearer {_token(anonimo, 'jefe')}"
    return anonimo


@pytest.fixture()
def empleado():
    """Cliente con sesión de empleado (RST_001), independiente del de jefe."""
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {_token(c, 'empleado')}"
    return c
