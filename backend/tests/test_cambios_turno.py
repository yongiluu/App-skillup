"""Cambios de turno con las reglas de la migración 0003 (Maxi).

El reemplazo acepta o rechaza; el jefe solo aprueba si el reemplazo aceptó y sigue
disponible; al aprobar, el turno pasa al reemplazo.

Las mismas comprobaciones corren con los mocks (aquí) y con Postgres + el trigger de Maxi
(tests/test_bd.py importa `REVISIONES`). Caso de la demo: Cristóbal Silva (RST_056,
usuario `empleado`) pide cambiar su turno del 17-10 de 21 a 23; Ignacia Muñoz (RST_009,
usuario `reemplazo`) puede cubrirlo.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import _token

HOY = "2025-10-17"
SOLICITANTE = "RST_056"
REEMPLAZO = "RST_009"
OTRO_GARZON_LIBRE = "RST_021"  # también disponible ese turno
GARZON_DEL_SERVICIO = "RST_003"  # ya trabaja el 17-10 de 21 a 23
SERVICIO = "21_23"


def _turnos_servicio(jefe, fecha=HOY, servicio=SERVICIO) -> dict[str, str]:
    """empleado_id → rol de quienes trabajan ese servicio."""
    out = {}
    for e in jefe.get("/empleados").json():
        for t in jefe.get(f"/empleados/{e['id']}/turnos", params={"desde": fecha, "hasta": fecha}).json():
            if t["servicio"] == servicio:
                out[e["id"]] = t["rol"]
    return out


def _asignados(jefe, servicio=SERVICIO) -> int:
    return next(s["asignados"] for s in jefe.get("/servicios", params={"fecha": HOY}).json()["servicios"]
                if s["servicio"] == servicio)


def _pedir(cliente, reemplazo=None, solicitante=SOLICITANTE):
    return cliente.post(
        "/solicitudes-cambio",
        json={"solicitante_id": solicitante, "fecha": HOY, "servicio": SERVICIO, "reemplazo_id": reemplazo},
    )


def _responder(cliente, sid, acepta):
    return cliente.post(f"/solicitudes-cambio/{sid}/respuesta", json={"acepta": acepta})


def _resolver(jefe, sid, estado):
    return jefe.patch(f"/solicitudes-cambio/{sid}", json={"estado": estado})


# ---------- comprobaciones (también las usa test_bd.py) ----------
def revisar_flujo_completo(jefe, empleado, reemplazo):
    """Pide con reemplazo → no se aprueba antes de que acepte → acepta → se aprueba y el turno se mueve."""
    antes = _asignados(jefe)
    r = _pedir(empleado, REEMPLAZO)
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["estado"] == "pendiente" and s["respuesta_reemplazo"] == "pendiente" and s["respondida_en"] is None
    sid = s["id"]
    # el reemplazo ve la solicitud en la que lo proponen
    assert sid in [x["id"] for x in reemplazo.get("/solicitudes-cambio").json()]

    r = _resolver(jefe, sid, "aprobada")
    assert r.status_code == 409 and r.json()["detail"].startswith("Solo se puede aprobar si un reemplazo aceptó")

    r = _responder(reemplazo, sid, True)
    assert r.status_code == 200, r.text
    assert r.json()["respuesta_reemplazo"] == "aceptada" and r.json()["respondida_en"] is not None
    assert SOLICITANTE in _turnos_servicio(jefe)  # aceptar todavía no mueve nada

    r = jefe.patch(f"/solicitudes-cambio/{sid}", json={"estado": "aprobada", "comentario": "ok"})
    assert r.status_code == 200 and r.json()["estado"] == "aprobada" and r.json()["resuelta_por"] == "RST_055"
    trabajan = _turnos_servicio(jefe)
    assert SOLICITANTE not in trabajan  # ya no trabaja ese servicio
    assert trabajan[REEMPLAZO] == "garzon"  # el reemplazo toma el mismo rol
    assert _asignados(jefe) == antes  # la dotación no cambia
    assert not any(t["fecha"] == HOY and t["servicio"] == SERVICIO
                   for t in empleado.get(f"/empleados/{SOLICITANTE}/turnos", params={"desde": HOY}).json())
    # resuelta: ya no se toca
    assert _resolver(jefe, sid, "rechazada").status_code == 409
    assert _responder(reemplazo, sid, False).status_code == 409
    assert jefe.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": OTRO_GARZON_LIBRE}).status_code == 409


def revisar_rechazo_y_otro_reemplazo(jefe, empleado, reemplazo):
    """Si el reemplazo rechaza, sigue pendiente; se propone a otra persona y su respuesta vuelve a pendiente."""
    antes = _turnos_servicio(jefe)
    sid = _pedir(empleado, REEMPLAZO).json()["id"]
    # solo el reemplazo responde
    assert _responder(empleado, sid, True).status_code == 403
    assert _responder(jefe, sid, True).status_code == 403

    r = _responder(reemplazo, sid, False)
    assert r.status_code == 200
    assert r.json()["estado"] == "pendiente" and r.json()["respuesta_reemplazo"] == "rechazada"
    assert _resolver(jefe, sid, "aprobada").status_code == 409

    # quien pidió propone a otra persona
    r = empleado.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": OTRO_GARZON_LIBRE})
    assert r.status_code == 200
    assert r.json()["reemplazo_id"] == OTRO_GARZON_LIBRE and r.json()["respuesta_reemplazo"] == "pendiente"
    assert r.json()["respondida_en"] is None
    assert _responder(reemplazo, sid, True).status_code == 403  # ya no es el reemplazo propuesto
    assert sid not in [x["id"] for x in reemplazo.get("/solicitudes-cambio").json()]

    # el jefe también puede proponer (vuelve a la primera persona)
    r = jefe.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": REEMPLAZO})
    assert r.status_code == 200 and r.json()["respuesta_reemplazo"] == "pendiente"
    assert _responder(reemplazo, sid, True).json()["respuesta_reemplazo"] == "aceptada"

    # rechazar siempre se puede y no cambia ningún turno
    r = jefe.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada", "comentario": "Ese día no"})
    assert r.status_code == 200 and r.json()["estado"] == "rechazada"
    assert _turnos_servicio(jefe) == antes


def revisar_sin_reemplazo(jefe, empleado, reemplazo):
    """Sin reemplazo no se puede aprobar; el jefe propone a alguien, acepta y se aprueba."""
    r = _pedir(empleado)
    assert r.status_code == 201 and r.json()["respuesta_reemplazo"] is None
    sid = r.json()["id"]
    r = _resolver(jefe, sid, "aprobada")
    assert r.status_code == 409 and "Si nadie acepta, hay que rechazarla" in r.json()["detail"]
    assert _responder(reemplazo, sid, True).status_code == 403  # nadie propuesto
    assert jefe.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": REEMPLAZO}).status_code == 200
    assert _responder(reemplazo, sid, True).status_code == 200
    assert _resolver(jefe, sid, "aprobada").status_code == 200
    assert _turnos_servicio(jefe)[REEMPLAZO] == "garzon"


def revisar_una_pendiente_por_turno(jefe, empleado, reemplazo):
    sid = _pedir(empleado).json()["id"]
    r = _pedir(empleado, REEMPLAZO)
    assert r.status_code == 409 and r.json()["detail"] == "Ya hay una solicitud pendiente para ese turno"
    assert _pedir(jefe).status_code == 409  # tampoco el jefe a nombre de la misma persona
    # otro turno de la misma persona sí se puede
    otra = empleado.post("/solicitudes-cambio", json={"solicitante_id": SOLICITANTE, "fecha": HOY, "servicio": "19_21"})
    assert otra.status_code == 201
    # una vez resuelta, se puede volver a pedir
    assert _resolver(jefe, sid, "rechazada").status_code == 200
    assert _pedir(empleado).status_code == 201


def revisar_disponibilidad_se_revisa_de_nuevo(jefe, empleado, reemplazo):
    """Si entre proponer y aceptar/aprobar el reemplazo quedó en ese servicio, ya no puede."""
    sid_1 = _pedir(empleado, REEMPLAZO).json()["id"]
    assert _responder(reemplazo, sid_1, True).status_code == 200
    # otro garzón del mismo servicio pide cambio con la misma persona, que acepta y se aprueba primero
    sid_2 = _pedir(jefe, REEMPLAZO, solicitante=GARZON_DEL_SERVICIO).json()["id"]
    assert _responder(reemplazo, sid_2, True).status_code == 200
    assert _resolver(jefe, sid_2, "aprobada").status_code == 200

    r = _resolver(jefe, sid_1, "aprobada")
    assert r.status_code == 409 and r.json()["detail"] == "No se puede aprobar: Ya trabaja en ese mismo servicio"
    assert jefe.get("/solicitudes-cambio", params={"estado": "pendiente"}).json()[0]["id"] == sid_1
    # tampoco puede volver a aceptar: se le propone de nuevo y responde
    assert jefe.patch(f"/solicitudes-cambio/{sid_1}/reemplazo", json={"reemplazo_id": OTRO_GARZON_LIBRE}).status_code == 200
    r = jefe.patch(f"/solicitudes-cambio/{sid_1}/reemplazo", json={"reemplazo_id": REEMPLAZO})
    assert r.status_code == 409 and "no está disponible: Ya trabaja en ese mismo servicio" in r.json()["detail"]


REVISIONES = [
    revisar_flujo_completo,
    revisar_rechazo_y_otro_reemplazo,
    revisar_sin_reemplazo,
    revisar_una_pendiente_por_turno,
    revisar_disponibilidad_se_revisa_de_nuevo,
]


# ---------- con los mocks ----------
@pytest.fixture()
def reemplazo(client):  # `client` deja los mocks limpios antes
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {_token(c, 'reemplazo')}"
    return c


@pytest.mark.parametrize("revisar", REVISIONES, ids=lambda f: f.__name__)
def test_reglas_con_mocks(revisar, client, empleado, reemplazo):
    revisar(client, empleado, reemplazo)


def test_aceptar_sin_estar_disponible(client, empleado, reemplazo):
    """El reemplazo no puede aceptar si dejó de estar disponible (mismo texto que el trigger)."""
    sid_1 = _pedir(empleado, REEMPLAZO).json()["id"]
    sid_2 = _pedir(client, REEMPLAZO, solicitante=GARZON_DEL_SERVICIO).json()["id"]
    assert _responder(reemplazo, sid_2, True).status_code == 200
    assert _resolver(client, sid_2, "aprobada").status_code == 200
    r = _responder(reemplazo, sid_1, True)
    assert r.status_code == 409 and r.json()["detail"] == "No puede aceptar: Ya trabaja en ese mismo servicio"
    assert _responder(reemplazo, sid_1, False).status_code == 200  # rechazar sí puede


@pytest.mark.parametrize(
    ("reemplazo_id", "texto"),
    [
        ("RST_055", "No sabe hacer el rol garzon"),  # Catalina, jefa de turno
        (GARZON_DEL_SERVICIO, "Ya trabaja en ese mismo servicio"),
    ],
)
def test_proponer_a_quien_no_puede(client, empleado, reemplazo_id, texto):
    r = _pedir(empleado, reemplazo_id)
    assert r.status_code == 409 and r.json()["detail"].endswith(texto)


def test_proponer_a_alguien_ausente(client, empleado):
    ausentes = {a["empleado_id"] for a in client.get("/ausencias", params={"fecha": HOY}).json()}
    filas = client.get("/disponibles", params={"fecha": HOY, "servicio": "19_21", "solicitante": SOLICITANTE}).json()
    ausente = next(f["empleado_id"] for f in filas if f["motivo"] == "Está ausente ese día")
    assert ausente in ausentes
    r = empleado.post("/solicitudes-cambio", json={
        "solicitante_id": SOLICITANTE, "fecha": HOY, "servicio": "19_21", "reemplazo_id": ausente})
    # privacidad: nunca el motivo de la ausencia, solo esto
    assert r.status_code == 409 and r.json()["detail"].endswith("Está ausente ese día")


def test_proponer_a_si_mismo_o_inexistente(client, empleado):
    assert _pedir(empleado, SOLICITANTE).status_code == 409
    assert _pedir(empleado, "RST_999").status_code == 404


def test_solo_solicitante_o_jefe_cambian_el_reemplazo(client, empleado, reemplazo):
    sid = _pedir(client, None, solicitante=GARZON_DEL_SERVICIO).json()["id"]
    r = empleado.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": REEMPLAZO})
    assert r.status_code == 403
    assert reemplazo.patch(f"/solicitudes-cambio/{sid}/reemplazo", json={"reemplazo_id": REEMPLAZO}).status_code == 403
    assert client.patch("/solicitudes-cambio/999/reemplazo", json={"reemplazo_id": REEMPLAZO}).status_code == 404
    assert _responder(reemplazo, 999, True).status_code == 404


def test_empleado_no_resuelve(client, empleado):
    sid = _pedir(empleado).json()["id"]
    assert empleado.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada"}).status_code == 403


def test_campos_extra_rechazados(client, empleado):
    sid = _pedir(empleado, REEMPLAZO).json()["id"]
    r = empleado.post(f"/solicitudes-cambio/{sid}/respuesta", json={"acepta": True, "estado": "aprobada"})
    assert r.status_code == 422


# ---------- /disponibles ----------
def test_disponibles_jefe_ve_todo_con_motivo(client):
    filas = client.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO, "solicitante": SOLICITANTE}).json()
    assert SOLICITANTE not in [f["empleado_id"] for f in filas]
    assert len(filas) == 79  # 80 personas menos quien pide
    libres = [f for f in filas if f["disponible"]]
    assert REEMPLAZO in [f["empleado_id"] for f in libres] and all(f["motivo"] is None for f in libres)
    ocupados = [f for f in filas if not f["disponible"]]
    assert ocupados and all(f["motivo"] for f in ocupados)
    motivos = {f["motivo"] for f in ocupados}
    assert "Ya trabaja en ese mismo servicio" in motivos and "No sabe hacer el rol garzon" in motivos
    assert not any("salud" in m or "personal" in m for m in motivos)  # nunca el motivo de una ausencia


def test_disponibles_empleado_ve_solo_libres_sin_motivo(client, empleado):
    jefe = client.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO, "solicitante": SOLICITANTE}).json()
    r = empleado.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO})
    assert r.status_code == 200
    assert r.json() == [{**f, "motivo": None} for f in jefe if f["disponible"]]
    # solo para sus propios turnos
    r = empleado.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO, "solicitante": GARZON_DEL_SERVICIO})
    assert r.status_code == 403


def test_disponibles_sin_turno_o_sin_sesion(client, anonimo):
    r = client.get("/disponibles", params={"fecha": HOY, "servicio": "11_13", "solicitante": SOLICITANTE})
    assert r.status_code == 409
    assert client.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO, "solicitante": "RST_999"}).status_code == 404
    assert client.get("/disponibles", params={"fecha": HOY, "servicio": "10_12"}).status_code == 422
    del anonimo.headers["Authorization"]
    assert anonimo.get("/disponibles", params={"fecha": HOY, "servicio": SERVICIO}).status_code == 401


def test_disponibles_cuenta_dias_seguidos(client):
    """RST_056 lleva una racha larga: no puede cubrir a nadie el 17-10 por días seguidos."""
    filas = client.get("/disponibles", params={"fecha": HOY, "servicio": "13_15", "solicitante": GARZON_DEL_SERVICIO}).json()
    yo = next(f for f in filas if f["empleado_id"] == SOLICITANTE)
    assert yo["motivo"] == "Quedaría con 10 días seguidos de trabajo (máximo 6)"
