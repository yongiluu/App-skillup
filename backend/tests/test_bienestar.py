"""Bienestar (datos sensibles simulados): consentimiento, quién ve qué y que nunca se filtren
datos crudos ni diagnósticos al jefe de turno."""

import json
from datetime import date

from app.bienestar import resumen
from app.repositorio import repo_mock

HOY = "2025-10-17"
SIN_CONSENTIMIENTO = "RST_011"  # dato fijo de los mocks
CRUDOS = {"pasos", "sueno_horas", "pulso_medio_bpm", "encuesta_fatiga_inicio", "encuesta_fatiga_fin", "registros"}
NUNCA = {"hrv", "stress", "_is_sick", "_absence_reason", "diagnostico", "respiratorio", "gastrointestinal"}


def _claves(obj) -> set[str]:
    """Todas las claves de un JSON, a cualquier profundidad."""
    if isinstance(obj, dict):
        return set(obj) | {k for v in obj.values() for k in _claves(v)}
    if isinstance(obj, list):
        return {k for v in obj for k in _claves(v)}
    return set()


# ---------- jefe: solo indicador ----------
def test_jefe_ve_indicador_sin_datos_crudos(client):
    equipo = client.get("/bienestar/fatiga", params={"fecha": HOY}).json()
    assert len(equipo) == 80
    assert not CRUDOS & _claves(equipo)
    con_dato = [e for e in equipo if e["estado"] == "ok"]
    assert con_dato and all(e["fatiga"]["nivel"] in {"bajo", "medio", "alto"} for e in con_dato)
    assert all(len(e["fatiga"]["motivos"]) <= 2 for e in con_dato)
    assert {m for e in con_dato for m in e["fatiga"]["motivos"]} <= {"descanso", "carga_fisica", "jornada", "autorreporte"}


def test_ficha_del_jefe_sin_datos_crudos(client):
    ficha = client.get("/empleados/RST_056").json()
    assert ficha["bienestar"]["fatiga"]["nivel"] in {"bajo", "medio", "alto"}
    assert not CRUDOS & _claves(ficha["bienestar"])


def test_jefe_no_ve_datos_crudos_de_nadie(client):
    assert client.get("/empleados/RST_056/bienestar").status_code == 403
    assert client.get("/empleados/RST_055/bienestar").status_code == 200  # los suyos sí


# ---------- empleado: solo lo suyo ----------
def test_empleado_ve_sus_datos_crudos(empleado):
    r = empleado.get("/empleados/RST_056/bienestar", params={"desde": "2025-10-11", "hasta": HOY})
    assert r.status_code == 200
    d = r.json()
    assert d["estado"] == "ok" and len(d["registros"]) == 7
    assert {"pasos", "sueno_horas", "pulso_medio_bpm", "encuesta_fatiga_fin"} <= set(d["registros"][0])


def test_empleado_no_ve_bienestar_ajeno(empleado):
    assert empleado.get("/empleados/RST_002/bienestar").status_code == 403
    assert empleado.get("/bienestar/fatiga").status_code == 403


def test_bienestar_sin_sesion(anonimo):
    for ruta in ("/bienestar/fatiga", "/bienestar/preguntas", "/empleados/RST_056/bienestar"):
        assert anonimo.get(ruta).status_code == 401


def test_rango_invertido(empleado):
    assert empleado.get("/empleados/RST_056/bienestar", params={"desde": HOY, "hasta": "2025-10-01"}).status_code == 422


# ---------- consentimiento ----------
def test_sin_consentimiento_no_hay_nada(client):
    ficha = client.get(f"/empleados/{SIN_CONSENTIMIENTO}").json()["bienestar"]
    assert ficha["estado"] == "sin_consentimiento" and ficha["fatiga"] is None
    equipo = {e["empleado_id"]: e for e in client.get("/bienestar/fatiga").json()}
    assert equipo[SIN_CONSENTIMIENTO]["fatiga"] is None
    # ni siquiera existen sus datos en el almacenamiento
    assert repo_mock().bienestar_de_empleado(SIN_CONSENTIMIENTO, date(2025, 1, 1), date(2026, 1, 1)) == []


def test_sin_datos_fuera_de_rango(client):
    ficha = {e["empleado_id"]: e for e in client.get("/bienestar/fatiga", params={"fecha": "2025-12-15"}).json()}
    assert ficha["RST_056"]["estado"] == "sin_datos"


def test_sugerencias_dejan_al_final_a_quien_tiene_fatiga_alta(client):
    repo = repo_mock()
    for fecha in ("2025-10-03", "2025-10-17", "2025-10-31"):
        f = date.fromisoformat(fecha)
        sug = client.get("/sugerencias", params={"fecha": fecha}).json()
        por_grupo: dict = {}
        for s in sug:
            por_grupo.setdefault((s["servicio"], s["rol_a_cubrir"], s["accion"]), []).append(s["empleado_id"])
        for ids in por_grupo.values():
            altas = [(resumen(repo, i, f)["fatiga"] or {}).get("nivel") == "alto" for i in ids]
            assert altas == sorted(altas)  # nunca alguien con fatiga alta antes que alguien sin ella


# ---------- nunca se filtran campos prohibidos ----------
def test_mocks_sin_campos_prohibidos():
    repo = repo_mock()
    texto = json.dumps(repo._bienestar_por_empleado) + json.dumps(repo.ausencias)
    assert not any(p in texto for p in NUNCA)


# ---------- tests psicológicos: solo propuestas ----------
def test_preguntas_propuestas(empleado):
    p = empleado.get("/bienestar/preguntas").json()
    assert p["estado"] == "pendiente" and "[PENDIENTE CERVECERÍA]" in p["nota"]
    preguntas = [q for i in p["instrumentos"] for q in i["preguntas"]]
    assert len(preguntas) >= 8 and all(q["texto"] for q in preguntas)


def test_ficha_tests_pendientes(client):
    assert client.get("/empleados/RST_056").json()["bienestar"]["tests"]["estado"] == "pendiente"


# ---------- auditoría ----------
def test_accesos_quedan_registrados(client, caplog):
    with caplog.at_level("INFO", logger="skillup.auditoria"):
        client.get("/bienestar/fatiga")
        client.get("/empleados/RST_005")
    textos = [r.getMessage() for r in caplog.records if r.name == "skillup.auditoria"]
    assert any("fatiga_equipo" in t and "usuario=jefe" in t for t in textos)
    assert any("ficha_indicador" in t and "RST_005" in t for t in textos)


# ---------- retirar o volver a dar la autorización (AP-04) ----------
def revisar_retirar_y_volver_a_autorizar(jefe, empleado):
    """La usan también las pruebas con la base (tests/test_bd.py)."""
    yo = "RST_056"
    assert empleado.get(f"/empleados/{yo}").json()["bienestar"]["estado"] == "ok"

    r = empleado.post(f"/empleados/{yo}/consentimiento", json={"acepta": False})
    assert r.status_code == 200, r.text
    assert r.json()["otorgado"] is False and r.json()["fecha"] is None
    # desde ya, nadie ve su indicador ni sus datos
    fila = next(e for e in jefe.get("/bienestar/fatiga", params={"fecha": HOY}).json() if e["empleado_id"] == yo)
    assert fila["estado"] == "sin_consentimiento" and fila["fatiga"] is None
    assert jefe.get(f"/empleados/{yo}").json()["bienestar"]["estado"] == "sin_consentimiento"
    propio = empleado.get(f"/empleados/{yo}/bienestar").json()
    assert propio["estado"] == "sin_consentimiento" and propio["registros"] == []
    # retirar dos veces → 409
    r = empleado.post(f"/empleados/{yo}/consentimiento", json={"acepta": False})
    assert r.status_code == 409 and r.json()["detail"] == "No tienes una autorización vigente que retirar"

    # vuelve a autorizar: se ve de nuevo
    r = empleado.post(f"/empleados/{yo}/consentimiento", json={"acepta": True})
    assert r.status_code == 200 and r.json()["otorgado"] is True and r.json()["fecha"] == date.today().isoformat()
    assert r.json()["version_texto"] == "borrador-v0"
    assert jefe.get(f"/empleados/{yo}").json()["bienestar"]["estado"] == "ok"
    r = empleado.post(f"/empleados/{yo}/consentimiento", json={"acepta": True})
    assert r.status_code == 409 and r.json()["detail"] == "Ya tienes una autorización vigente"


def test_retirar_y_volver_a_autorizar(client, empleado):
    revisar_retirar_y_volver_a_autorizar(client, empleado)


def test_solo_la_propia_persona_cambia_su_autorizacion(client, empleado):
    assert client.post("/empleados/RST_056/consentimiento", json={"acepta": False}).status_code == 403  # ni el jefe
    assert empleado.post("/empleados/RST_005/consentimiento", json={"acepta": False}).status_code == 403
    assert empleado.post("/empleados/RST_056/consentimiento", json={"acepta": "talvez"}).status_code == 422
    assert empleado.post("/empleados/RST_056/consentimiento", json={"acepta": False, "x": 1}).status_code == 422
