"""Pruebas funcionales de la API con datos de ejemplo. Correr con:  pytest
(Las fixtures `client`, `empleado` y `anonimo` están en conftest.py.)"""

from tests.conftest import PASSWORD

HOY = "2025-10-17"


def test_health(anonimo):
    assert anonimo.get("/health").json()["estado"] == "ok"


# ---------- auth ----------
def test_login_jefe(anonimo):
    r = anonimo.post("/auth/login", json={"usuario": "jefe", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["perfil"] == "jefe_turno" and r.json()["expira_en"] > 0
    assert r.json()["hoy"] == HOY  # el empleado no puede pedir /servicios: así sabe qué día es


def test_login_empleado(anonimo):
    r = anonimo.post("/auth/login", json={"usuario": "Empleado ", "password": PASSWORD})
    assert r.json()["perfil"] == "empleado" and r.json()["empleado_id"] == "RST_056"


def test_login_invalido(anonimo):
    assert anonimo.post("/auth/login", json={"usuario": "nadie", "password": PASSWORD}).status_code == 401
    assert anonimo.post("/auth/login", json={"usuario": "jefe", "password": "mala"}).status_code == 401
    assert anonimo.post("/auth/login", json={"usuario": "jefe", "password": ""}).status_code == 422


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
    # cada rol crítico en riesgo (≥ 0,55) de un servicio en riesgo tiene al menos una sugerencia
    for s in client.get("/servicios", params={"fecha": HOY}).json()["servicios"]:
        if s["prob_deficit"] >= 0.55:
            en_riesgo = {r for r, p in s["prob_por_rol"].items() if p >= 0.55}
            sugeridos = {x["rol_a_cubrir"] for x in sug if x["servicio"] == s["servicio"]}
            assert en_riesgo <= sugeridos, s["servicio"]
    # 17-10, 13-15: falta la jefa programada (RST_008, ausente) → se sugiere otro jefe de turno
    assert any(x["servicio"] == "13_15" and x["rol_a_cubrir"] == "jefe_turno" for x in sug)


def test_sugerencias_no_incluyen_ausentes(client):
    from app.repositorio import repo_mock as repo
    from datetime import date

    for fecha in ("2025-10-03", "2025-10-17", "2025-10-24"):
        ausentes = repo().ausentes_en(date.fromisoformat(fecha))
        sug = client.get("/sugerencias", params={"fecha": fecha}).json()
        assert not {s["empleado_id"] for s in sug} & ausentes


# ---------- empleados ----------
def test_empleados(client):
    lista = client.get("/empleados").json()
    assert len(lista) == 80
    campos_prohibidos = {"gender", "genero", "bmi", "imc", "children", "hijos", "smoker", "edad", "age"}
    assert not campos_prohibidos & set(lista[0])


def test_empleados_filtro_rol(client):
    garzones = client.get("/empleados", params={"rol": "garzon"}).json()
    assert garzones and all(e["rol"] == "garzon" for e in garzones)


def test_ficha(client):
    f = client.get("/empleados/RST_056").json()
    assert f["bienestar"]["estado"] == "ok" and f["bienestar"]["tests"]["estado"] == "pendiente"
    assert all(t["fecha"] >= HOY for t in f["proximos_turnos"])


def test_ficha_inexistente(client):
    assert client.get("/empleados/RST_999").status_code == 404
    assert client.get("/empleados/RST_999/turnos").status_code == 404


def test_turnos_filtrados(client):
    ts = client.get("/empleados/RST_056/turnos", params={"desde": "2025-10-13", "hasta": "2025-10-19"}).json()
    assert ts and all("2025-10-13" <= t["fecha"] <= "2025-10-19" for t in ts)


# ---------- solicitudes de cambio ----------
def _turno_de(client, emp="RST_056"):
    return client.get(f"/empleados/{emp}/turnos", params={"desde": HOY}).json()[0]


def test_flujo_solicitud_aprobada(client):
    t = _turno_de(client)
    r = client.post(
        "/solicitudes-cambio",
        json={"solicitante_id": "RST_056", "fecha": t["fecha"], "servicio": t["servicio"], "motivo": "Examen"},
    )
    assert r.status_code == 201 and r.json()["estado"] == "pendiente"
    sid = r.json()["id"]
    r = client.patch(f"/solicitudes-cambio/{sid}", json={"estado": "aprobada"})
    assert r.status_code == 200 and r.json()["estado"] == "aprobada"
    # no se puede resolver dos veces
    assert client.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada"}).status_code == 409


def test_solicitud_sin_turno(client):
    # RST_056 no trabaja el 2025-10-17 en 11_13 (dato fijo de los mocks)
    r = client.post("/solicitudes-cambio", json={"solicitante_id": "RST_056", "fecha": HOY, "servicio": "11_13"})
    assert r.status_code == 409


def test_listar_solicitudes(client):
    t = _turno_de(client)
    client.post("/solicitudes-cambio", json={"solicitante_id": "RST_056", "fecha": t["fecha"], "servicio": t["servicio"]})
    assert len(client.get("/solicitudes-cambio", params={"estado": "pendiente"}).json()) == 1
    assert client.get("/solicitudes-cambio", params={"estado": "aprobada"}).json() == []


def test_sugerencias_sin_persona_repetida_en_un_servicio(client):
    for fecha in ("2025-10-03", "2025-10-17", "2025-10-24", "2025-10-31"):
        vistos = set()
        for s in client.get("/sugerencias", params={"fecha": fecha}).json():
            clave = (s["servicio"], s["empleado_id"])
            assert clave not in vistos
            vistos.add(clave)


def test_solicitud_inexistente(client):
    assert client.patch("/solicitudes-cambio/999", json={"estado": "aprobada"}).status_code == 404
    assert client.patch("/solicitudes-cambio/1", json={"estado": "pendiente"}).status_code == 422


# ---------- ausencias del día ----------
def test_ausencias_del_dia(client):
    aus = client.get("/ausencias", params={"fecha": HOY}).json()
    assert {a["empleado_id"] for a in aus} == {"RST_003", "RST_008", "RST_051", "RST_068", "RST_074"}  # dato fijo de los mocks
    assert all(a["motivo"] in {"personal", "salud"} for a in aus)
    assert [a["empleado_id"] for a in aus] == sorted(a["empleado_id"] for a in aus)
    # "servicios" = franjas en que esa persona tenía turno ese día
    for a in aus:
        turnos = client.get(f"/empleados/{a['empleado_id']}/turnos", params={"desde": HOY, "hasta": HOY}).json()
        assert a["servicios"] == sorted(t["servicio"] for t in turnos)


def test_ausencias_sin_fecha_y_dia_sin_ausencias(client):
    assert client.get("/ausencias").json() == client.get("/ausencias", params={"fecha": HOY}).json()
    assert client.get("/ausencias", params={"fecha": "2030-01-01"}).json() == []


# ---------- recomendación en lenguaje normal ----------
def test_recomendacion_en_lenguaje_normal(client):
    for s in client.get("/semana", params={"inicio": "2025-10-13"}).json()["dias"][0]["servicios"]:
        r = s["recomendacion"]
        assert r and "_" not in r and "cross-trained" not in r and r.endswith(".")


def test_jefe_demo_no_esta_ausente_hoy(client):
    assert "RST_055" not in [a["empleado_id"] for a in client.get("/ausencias", params={"fecha": HOY}).json()]


def test_sugerencias_no_incluyen_a_quien_mira(client):
    """El jefe con la sesión iniciada (RST_055) nunca se sugiere a sí mismo."""
    for fecha in ("2025-10-03", "2025-10-17", "2025-10-24", "2025-10-31"):
        assert "RST_055" not in {s["empleado_id"] for s in client.get("/sugerencias", params={"fecha": fecha}).json()}
