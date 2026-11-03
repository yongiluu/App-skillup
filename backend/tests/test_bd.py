"""Pruebas de integración contra Postgres con el esquema oficial de Maxi (database/migrations).

Solo corren si existe TEST_DATABASE_URL apuntando a una base LOCAL descartable:
la prueba borra y recrea los esquemas public y sensible.

    TEST_DATABASE_URL=postgresql://postgres@localhost:5432/skillup_test pytest tests/test_bd.py

La idea principal: con los mismos datos, la API debe responder lo mismo leyendo de la
base que leyendo de los mocks (salvo las diferencias conocidas, documentadas abajo).
"""

import os
from pathlib import Path
from urllib.parse import urlparse

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.repositorio import repo_mock
from app.repositorio_db import cerrar_pool
from app.seguridad import limitador
from scripts.cargar_mocks_en_bd import cargar
from tests.conftest import PASSWORD

URL = os.environ.get("TEST_DATABASE_URL", "")
# Esquema oficial de Maxi (database/migrations), el mismo que está en Supabase.
MIGRACIONES = Path(__file__).resolve().parents[2] / "database" / "migrations"
HOY = "2025-10-17"

pytestmark = pytest.mark.skipif(not URL, reason="sin TEST_DATABASE_URL (pruebas de integración con Postgres)")


def _recrear_base(vacia: bool = False) -> None:
    assert urlparse(URL).hostname in {"localhost", "127.0.0.1"}, "TEST_DATABASE_URL debe ser local"
    with psycopg.connect(URL, autocommit=True) as con:
        con.execute("drop schema if exists sensible cascade; drop schema if exists public cascade; create schema public;")
        for archivo in sorted(MIGRACIONES.glob("*.sql")):
            con.execute(archivo.read_text(encoding="utf-8"))
        if not vacia:
            with con.transaction():
                cargar(con)


def _cliente(usuario: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/auth/login", json={"usuario": usuario, "password": PASSWORD})
    c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return c


@pytest.fixture(scope="module")
def modo_bd():
    _recrear_base()
    os.environ["FUENTE_DATOS"] = "supabase"
    os.environ["DATABASE_URL"] = URL
    get_settings.cache_clear()
    cerrar_pool()
    yield
    os.environ["FUENTE_DATOS"] = "mock"
    os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    cerrar_pool()


@pytest.fixture()
def jefe_bd(modo_bd):
    limitador.limpiar()
    return _cliente("jefe")


@pytest.fixture()
def empleado_bd(modo_bd):
    return _cliente("empleado")


def _mock(ruta: str, usuario: str = "jefe", **params):
    """La misma consulta en modo mock, para comparar."""
    os.environ["FUENTE_DATOS"] = "mock"
    get_settings.cache_clear()
    repo_mock.cache_clear()
    try:
        return _cliente(usuario).get(ruta, params=params).json()
    finally:
        os.environ["FUENTE_DATOS"] = "supabase"
        get_settings.cache_clear()


def _sin(d: dict, *claves) -> dict:
    return {k: v for k, v in d.items() if k not in claves}


# ---------- misma respuesta que los mocks (sin excepciones) ----------
FECHAS = ["2025-09-29", "2025-10-13", HOY, "2025-11-02"]


@pytest.mark.parametrize("fecha", FECHAS)
@pytest.mark.parametrize("ruta", ["/servicios", "/sugerencias", "/bienestar/fatiga", "/ausencias"])
def test_dia_igual_a_mock(jefe_bd, ruta, fecha):
    assert jefe_bd.get(ruta, params={"fecha": fecha}).json() == _mock(ruta, fecha=fecha)


def test_asignados_son_turnos_programados(jefe_bd):
    total = sum(len(jefe_bd.get(f"/empleados/{e['id']}/turnos", params={"desde": HOY, "hasta": HOY}).json())
                for e in jefe_bd.get("/empleados").json())
    assert sum(s["asignados"] for s in jefe_bd.get("/servicios", params={"fecha": HOY}).json()["servicios"]) == total


def test_semana_y_calendario_iguales_a_mock(jefe_bd):
    assert jefe_bd.get("/semana", params={"inicio": "2025-10-13"}).json() == _mock("/semana", inicio="2025-10-13")
    assert jefe_bd.get("/calendario", params={"mes": "2025-10"}).json() == _mock("/calendario", mes="2025-10")


def test_empleados_iguales_a_mock(jefe_bd):
    assert jefe_bd.get("/empleados").json() == _mock("/empleados")


def test_todas_las_fichas_iguales_a_mock(jefe_bd):
    for e in jefe_bd.get("/empleados").json():
        ruta = f"/empleados/{e['id']}"
        assert jefe_bd.get(ruta).json() == _mock(ruta), e["id"]


def test_bienestar_propio_igual_a_mock(empleado_bd):
    ruta = "/empleados/RST_001/bienestar"
    bd = empleado_bd.get(ruta, params={"desde": "2025-10-11", "hasta": HOY}).json()
    mk = _mock(ruta, usuario="empleado", desde="2025-10-11", hasta=HOY)
    assert bd["registros"] == mk["registros"] and len(bd["registros"]) == 7


def test_preguntas_iguales(jefe_bd):
    assert jefe_bd.get("/bienestar/preguntas").json() == _mock("/bienestar/preguntas")


# ---------- reglas que dependen de la BD ----------
def test_dias_seguidos_razonables(jefe_bd):
    for e in jefe_bd.get("/empleados").json()[:20]:
        f = jefe_bd.get(f"/empleados/{e['id']}").json()
        assert 0 <= f["dias_seguidos_trabajados"] <= 35


def test_sin_consentimiento_en_bd(jefe_bd):
    equipo = {e["empleado_id"]: e for e in jefe_bd.get("/bienestar/fatiga", params={"fecha": HOY}).json()}
    assert equipo["RST_011"]["estado"] == "sin_consentimiento" and equipo["RST_011"]["fatiga"] is None
    assert sum(e["estado"] == "sin_consentimiento" for e in equipo.values()) == 15


def test_sugerencias_en_bd(jefe_bd):
    sug = jefe_bd.get("/sugerencias", params={"fecha": HOY}).json()
    assert sug and all(s["accion"] in {"mover", "llamar"} for s in sug)


def test_accesos_se_guardan_en_sensible(jefe_bd):
    with psycopg.connect(URL) as con:
        antes = con.execute("select count(*) from sensible.registro_acceso").fetchone()[0]
    jefe_bd.get("/bienestar/fatiga")
    jefe_bd.get("/empleados/RST_005")
    with psycopg.connect(URL) as con:
        filas = con.execute(
            "select usuario, accion, empleado_id from sensible.registro_acceso order by id desc limit 2"
        ).fetchall()
        despues = con.execute("select count(*) from sensible.registro_acceso").fetchone()[0]
    assert despues == antes + 2
    assert ("jefe", "ficha_indicador", "RST_005") in filas


# ---------- escrituras ----------
def test_crear_evento_en_bd(jefe_bd):
    r = jefe_bd.post("/eventos", json={"fecha": "2025-10-25", "nombre": "Tocata", "tipo": "tocata", "servicios": ["21_23"]})
    assert r.status_code == 201
    dia = next(d for d in jefe_bd.get("/calendario", params={"mes": "2025-10"}).json()["dias"] if d["fecha"] == "2025-10-25")
    assert r.json()["id"] in [e["id"] for e in dia["eventos"]]


def test_flujo_solicitud_en_bd(jefe_bd, empleado_bd):
    t = empleado_bd.get("/empleados/RST_001/turnos", params={"desde": HOY}).json()[0]
    r = empleado_bd.post("/solicitudes-cambio", json={"solicitante_id": "RST_001", "fecha": t["fecha"], "servicio": t["servicio"]})
    assert r.status_code == 201 and r.json()["estado"] == "pendiente"
    sid = r.json()["id"]
    assert [s["id"] for s in empleado_bd.get("/solicitudes-cambio").json()] == [sid]
    r = jefe_bd.patch(f"/solicitudes-cambio/{sid}", json={"estado": "aprobada", "comentario": "ok"})
    assert r.status_code == 200
    assert r.json()["estado"] == "aprobada" and r.json()["resuelta_por"] == "RST_055"
    assert jefe_bd.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada"}).status_code == 409


# ---------- base vacía ----------
def test_base_vacia_responde_404_claro(modo_bd):
    _recrear_base(vacia=True)
    try:
        c = TestClient(app)
        r = c.post("/auth/login", json={"usuario": "jefe", "password": PASSWORD})
        c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        r = c.get("/servicios", params={"fecha": HOY})
        assert r.status_code == 404 and "Todavía no hay servicios" in r.json()["detail"]
        assert c.get("/empleados").json() == []
    finally:
        _recrear_base()
