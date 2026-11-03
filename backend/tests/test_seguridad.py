"""Pruebas de seguridad: que nadie entre sin sesión, que cada perfil vea solo lo suyo
y que los ataques típicos (token falso, fuerza bruta, campos extra) se rechacen."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from tests.conftest import PASSWORD

from app.config import get_settings
from app.seguridad import hash_password, verificar_password

HOY = "2025-10-17"

PROTEGIDOS = [
    ("get", "/servicios"),
    ("get", "/semana"),
    ("get", "/calendario"),
    ("get", "/sugerencias"),
    ("get", "/empleados"),
    ("get", "/empleados/RST_001"),
    ("get", "/empleados/RST_001/turnos"),
    ("get", "/solicitudes-cambio"),
    ("post", "/solicitudes-cambio"),
    ("patch", "/solicitudes-cambio/1"),
    ("post", "/eventos"),
]


# ---------- sin sesión no se entra a nada ----------
@pytest.mark.parametrize(("metodo", "ruta"), PROTEGIDOS)
def test_sin_token_401(anonimo, metodo, ruta):
    r = getattr(anonimo, metodo)(ruta, **({"json": {}} if metodo != "get" else {}))
    assert r.status_code == 401


def test_token_falso_o_alterado(anonimo, client):
    anonimo.headers["Authorization"] = "Bearer esto.no.es-un-token"
    assert anonimo.get("/empleados").status_code == 401
    # token real con un carácter cambiado en la firma
    real = client.headers["Authorization"]
    anonimo.headers["Authorization"] = real[:-2] + ("A" if real[-2] != "A" else "B") + real[-1]
    assert anonimo.get("/empleados").status_code == 401


def test_token_firmado_con_otra_clave(anonimo):
    falso = jwt.encode(
        {"sub": "jefe", "perfil": "jefe_turno", "emp": "RST_008", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "otra-clave-que-no-es-la-del-servidor-1234567890",
        algorithm="HS256",
    )
    anonimo.headers["Authorization"] = f"Bearer {falso}"
    assert anonimo.get("/servicios").status_code == 401


def test_token_alg_none_rechazado(anonimo):
    falso = jwt.encode({"sub": "jefe", "perfil": "jefe_turno", "emp": "RST_008", "exp": 9999999999}, key=None, algorithm="none")
    anonimo.headers["Authorization"] = f"Bearer {falso}"
    assert anonimo.get("/servicios").status_code == 401


def test_token_vencido(anonimo):
    vencido = jwt.encode(
        {"sub": "jefe", "perfil": "jefe_turno", "emp": "RST_008", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        get_settings().secret_key,
        algorithm="HS256",
    )
    anonimo.headers["Authorization"] = f"Bearer {vencido}"
    assert anonimo.get("/servicios").status_code == 401


def test_empleado_no_puede_auto_ascenderse(anonimo):
    """Un token con perfil cambiado a mano no sirve porque la firma deja de calzar."""
    ok = anonimo.post("/auth/login", json={"usuario": "empleado", "password": PASSWORD}).json()["access_token"]
    payload = jwt.decode(ok, options={"verify_signature": False})
    payload["perfil"] = "jefe_turno"
    trucho = jwt.encode(payload, "adivinanza", algorithm="HS256")
    anonimo.headers["Authorization"] = f"Bearer {trucho}"
    assert anonimo.get("/servicios").status_code == 401


# ---------- permisos por perfil ----------
@pytest.mark.parametrize("ruta", ["/servicios", "/semana", "/sugerencias"])
def test_empleado_no_ve_datos_operativos(empleado, ruta):
    assert empleado.get(ruta).status_code == 403


def test_empleado_no_aprueba_ni_crea_eventos(empleado):
    assert empleado.patch("/solicitudes-cambio/1", json={"estado": "aprobada"}).status_code == 403
    assert empleado.post("/eventos", json={"fecha": HOY, "nombre": "x"}).status_code == 403


def test_empleado_ve_solo_lo_suyo(empleado):
    assert empleado.get("/empleados/RST_001").status_code == 200
    assert empleado.get("/empleados/RST_001/turnos").status_code == 200
    assert empleado.get("/empleados/RST_002").status_code == 403
    assert empleado.get("/empleados/RST_002/turnos").status_code == 403


def test_empleado_no_pide_cambio_por_otro(empleado):
    r = empleado.post("/solicitudes-cambio", json={"solicitante_id": "RST_002", "fecha": HOY, "servicio": "13_15"})
    assert r.status_code == 403


def test_empleado_solo_lista_sus_solicitudes(client, empleado):
    # el jefe crea una solicitud para otra persona que sí tiene turno ese servicio
    otro = next(t for t in client.get("/empleados/RST_002/turnos", params={"desde": HOY}).json())
    client.post("/solicitudes-cambio", json={"solicitante_id": "RST_002", "fecha": otro["fecha"], "servicio": otro["servicio"]})
    # el empleado pide la suya
    t = empleado.get("/empleados/RST_001/turnos", params={"desde": HOY}).json()[0]
    empleado.post("/solicitudes-cambio", json={"solicitante_id": "RST_001", "fecha": t["fecha"], "servicio": t["servicio"]})
    assert len(client.get("/solicitudes-cambio").json()) == 2
    propias = empleado.get("/solicitudes-cambio").json()
    assert [s["solicitante_id"] for s in propias] == ["RST_001"]


def test_jefe_queda_registrado_al_resolver(client):
    t = client.get("/empleados/RST_001/turnos", params={"desde": HOY}).json()[0]
    sid = client.post("/solicitudes-cambio", json={"solicitante_id": "RST_001", "fecha": t["fecha"], "servicio": t["servicio"]}).json()["id"]
    assert client.patch(f"/solicitudes-cambio/{sid}", json={"estado": "rechazada"}).json()["resuelta_por"] == "RST_008"


# ---------- fuerza bruta ----------
def test_bloqueo_tras_intentos_fallidos(anonimo):
    for _ in range(get_settings().login_max_intentos):
        assert anonimo.post("/auth/login", json={"usuario": "jefe", "password": "mala"}).status_code == 401
    r = anonimo.post("/auth/login", json={"usuario": "jefe", "password": PASSWORD})
    assert r.status_code == 429  # bloqueado aunque ahora la contraseña sea correcta
    assert "Retry-After" in r.headers
    # el bloqueo es por usuario: "empleado" sigue pudiendo entrar
    assert anonimo.post("/auth/login", json={"usuario": "empleado", "password": PASSWORD}).status_code == 200


def test_mismo_error_si_usuario_no_existe_o_clave_mala(anonimo):
    a = anonimo.post("/auth/login", json={"usuario": "noexiste", "password": "x"})
    b = anonimo.post("/auth/login", json={"usuario": "jefe", "password": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()  # no revela qué usuarios existen


# ---------- entradas ----------
def test_campos_extra_rechazados(client):
    """Nadie puede colar campos que no están en el contrato (ej. marcar su solicitud como aprobada)."""
    t = client.get("/empleados/RST_001/turnos", params={"desde": HOY}).json()[0]
    r = client.post(
        "/solicitudes-cambio",
        json={"solicitante_id": "RST_001", "fecha": t["fecha"], "servicio": t["servicio"], "estado": "aprobada"},
    )
    assert r.status_code == 422


def test_textos_demasiado_largos(client):
    assert client.post("/eventos", json={"fecha": HOY, "nombre": "x" * 121}).status_code == 422
    assert client.post("/auth/login", json={"usuario": "a" * 65, "password": "x"}).status_code == 422


# ---------- contraseñas y cabeceras ----------
def test_hash_password():
    h = hash_password("secreta")
    assert "secreta" not in h and h.startswith("pbkdf2_sha256$")
    assert verificar_password("secreta", h) and not verificar_password("otra", h)
    assert hash_password("secreta") != h  # sal distinta cada vez


def test_cabeceras_de_seguridad(client):
    r = client.get("/empleados")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Cache-Control"] == "no-store"


def test_cors_solo_frontend_conocido(anonimo):
    ok = anonimo.options("/empleados", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    malo = anonimo.options("/empleados", headers={"Origin": "https://sitio-malicioso.com", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in malo.headers


def test_produccion_exige_secret_key(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "")
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(_env_file=None)
    monkeypatch.setenv("SECRET_KEY", "corta")
    with pytest.raises(ValueError, match="32"):
        Settings(_env_file=None)
