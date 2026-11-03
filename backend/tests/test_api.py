"""Pruebas de la API con datos de ejemplo. Correr con:  pytest"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositorio import get_repo

HOY = "2025-10-17"


@pytest.fixture()
def client():
    get_repo.cache_clear()  # cada test parte con los mocks limpios
    return TestClient(app)


def test_health(client):
    assert client.get("/health").json()["estado"] == "ok"


# ---------- auth ----------
def test_login_jefe(client):
    r = client.post("/auth/login", json={"usuario": "jefe", "password": "x"})
    assert r.status_code == 200
    assert r.json()["perfil"] == "jefe_turno"


def test_login_empleado(client):
    r = client.post("/auth/login", json={"usuario": "empleado", "password": "x"})
    assert r.json()["perfil"] == "empleado" and r.json()["empleado_id"] == "RST_001"


def test_login_invalido(client):
    assert client.post("/auth/login", json={"usuario": "nadie", "password": "x"}).status_code == 401
    assert client.post("/auth/login", json={"usuario": "jefe", "password": ""}).status_code == 422


# ---------- servicios / semana ----------
def test_servicios_del_dia(client):
    r = client.get("/servicios", params={"fecha": HOY})
    assert r.status_code == 200
    d = r.json()
    assert d["fecha"] == HOY
    assert [s["servicio"] for s in d["servicios"]] == ["11_13", "13_15", "19_21", "21_23"]
    assert d["calendario"]["es_viernes"] is True
    s = d["servicios"][0]
    assert set(s["prob_por_rol"]) == {"garzon", "cocinero_linea", "jefe_turno"}
    assert s["nivel_riesgo"] in {"bajo", "alerta", "alto"}


def test_nivel_riesgo_respeta_umbrales(client):
    for s in client.get("/semana", params={"inicio": "2025-10-13"}).json()["dias"][0]["servicios"]:
        p = s["prob_deficit"]
        esperado = "alto" if p >= 0.75 else "alerta" if p >= 0.55 else "bajo"
        assert s["nivel_riesgo"] == esperado


def test_servicios_sin_fecha_usa_hoy_mock(client):
    assert client.get("/servicios").json()["fecha"] == HOY


def test_servicios_fuera_de_rango(client):
    r = client.get("/servicios", params={"fecha": "2026-11-02"})
    assert r.status_code == 404
    assert "Rango disponible" in r.json()["detail"]


def test_servicios_fecha_mal_formada(client):
    assert client.get("/servicios", params={"fecha": "17-10-2025"}).status_code == 422


def test_semana(client):
    d = client.get("/semana", params={"inicio": "2025-10-13"}).json()
    assert d["fin"] == "2025-10-19"
    assert len(d["dias"]) == 7
    assert all(len(dia["servicios"]) == 4 for dia in d["dias"])
    assert d["dias"][0]["calendario"]["feriado"] is not None  # 13-oct: Encuentro de Dos Mundos


def test_semana_fuera_de_rango(client):
    assert client.get("/semana", params={"inicio": "2025-10-30"}).status_code == 404


# ---------- calendario / eventos ----------
def test_calendario(client):
    d = client.get("/calendario", params={"mes": "2025-10"}).json()
    assert len(d["dias"]) == 31
    assert any(dia["es_ventana_pago"] for dia in d["dias"])


def test_calendario_formato_invalido(client):
    assert client.get("/calendario", params={"mes": "2025-13"}).status_code == 422
    assert client.get("/calendario", params={"mes": "2030-01"}).status_code == 404


def test_crear_evento_aparece_en_calendario(client):
    r = client.post(
        "/eventos",
        json={"fecha": "2025-10-25", "nombre": "Tocata banda local", "tipo": "tocata", "servicios": ["21_23"]},
    )
    assert r.status_code == 201
    nuevo = r.json()
    dia = next(x for x in client.get("/calendario", params={"mes": "2025-10"}).json()["dias"] if x["fecha"] == "2025-10-25")
    assert nuevo["id"] in [e["id"] for e in dia["eventos"]]


def test_evento_tipo_invalido(client):
    assert client.post("/eventos", json={"fecha": "2025-10-25", "nombre": "x", "tipo": "rave"}).status_code == 422


# ---------- sugerencias ----------
def test_sugerencias(client):
    sug = client.get("/sugerencias", params={"fecha": HOY}).json()
    assert len(sug) > 0
    ids_empleados = {e["id"]: e for e in client.get("/empleados").json()}
    for s in sug:
        e = ids_empleados[s["empleado_id"]]
        # solo sugiere gente con ese rol o entrenada para cubrirlo
        assert s["rol_a_cubrir"] == e["rol"] or s["rol_a_cubrir"] in e["puede_cubrir"]
        assert (s["accion"] == "mover") == (s["rol_actual"] is not None)
    # el 21_23 del 17-oct tiene en riesgo los 3 roles críticos: debe haber sugerencias para cada uno
    roles_21 = {s["rol_a_cubrir"] for s in sug if s["servicio"] == "21_23"}
    assert roles_21 == {"garzon", "cocinero_linea", "jefe_turno"}


def test_sugerencias_no_incluyen_ausentes(client):
    from app.repositorio import get_repo as repo
    from datetime import date

    for fecha in ("2025-10-03", "2025-10-17", "2025-10-24"):
        ausentes = repo().ausentes_en(date.fromisoformat(fecha))
        sug = client.get("/sugerencias", params={"fecha": fecha}).json()
        assert not {s["empleado_id"] for s in sug} & ausentes


# ---------- empleados ----------
def test_empleados(client):
    lista = client.get("/empleados").json()
    assert len(lista) == 72
    campos_prohibidos = {"gender", "genero", "bmi", "imc", "children", "hijos", "smoker", "edad", "age"}
    assert not campos_prohibidos & set(lista[0])


def test_empleados_filtro_rol(client):
    garzones = client.get("/empleados", params={"rol": "garzon"}).json()
    assert garzones and all(e["rol"] == "garzon" for e in garzones)


def test_ficha(client):
    f = client.get("/empleados/RST_001").json()
    assert f["bienestar"]["estado"] == "pendiente"
    assert all(t["fecha"] >= HOY for t in f["proximos_turnos"])


def test_ficha_inexistente(client):
    assert client.get("/empleados/RST_999").status_code == 404
    assert client.get("/empleados/RST_999/turnos").status_code == 404


def test_turnos_filtrados(client):
    ts = client.get("/empleados/RST_001/turnos", params={"desde": "2025-10-13", "hasta": "2025-10-19"}).json()
    assert ts and all("2025-10-13" <= t["fecha"] <= "2025-10-19" for t in ts)


# ---------- solicitudes de cambio ----------
def _turno_de(client, emp="RST_001"):
    return client.get(f"/empleados/{emp}/turnos", params={"desde": HOY}).json()[0]


def test_flujo_solicitud_aprobada(client):
    t = _turno_de(client)
    r = client.post(
        "/solicitudes-cambio",
        json={"solicitante_id": "RST_001", "fecha": t["fecha"], "servicio": t["servicio"], "motivo": "Examen"},
    )
    assert r.status_code == 201 and r.json()["estado"] == "pendiente"
    sid = r.json()["id"]
    r = client.patch(f"/solicitudes-cambio/{sid}", json={"estado": "aprobada"})
    assert r.status_code == 200 and r.json()["estado"] == "aprobada"
    # no se puede resolver dos veces
    assert client.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada"}).status_code == 409


def test_solicitud_sin_turno(client):
    r = client.post("/solicitudes-cambio", json={"solicitante_id": "RST_001", "fecha": "2025-10-17", "servicio": "11_13"})
    # puede o no tener turno ese servicio; si no lo tiene debe ser 409
    asignado = any(
        t["fecha"] == "2025-10-17" and t["servicio"] == "11_13"
        for t in client.get("/empleados/RST_001/turnos").json()
    )
    assert r.status_code == (201 if asignado else 409)


def test_solicitud_inexistente(client):
    assert client.patch("/solicitudes-cambio/999", json={"estado": "aprobada"}).status_code == 404
    assert client.patch("/solicitudes-cambio/1", json={"estado": "pendiente"}).status_code == 422
