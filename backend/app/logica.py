"""Reglas de negocio que no dependen de dónde vienen los datos."""

from __future__ import annotations

from datetime import date, timedelta

from app.config import get_settings
from app.repositorio import RepositorioMock

HORARIOS = {"11_13": "11:00–13:00", "13_15": "13:00–15:00", "19_21": "19:00–21:00", "21_23": "21:00–23:00"}
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
CRITICOS = ("garzon", "cocinero_linea", "jefe_turno")
NOMBRE_ROL = {
    "garzon": "garzón", "cocinero_linea": "cocinero de línea", "jefe_turno": "jefe de turno",
    "runner": "runner", "host": "host", "cajero": "cajero", "ayudante_cocina": "ayudante de cocina", "copero": "copero",
}


def nivel_riesgo(prob: float) -> str:
    s = get_settings()
    if prob >= s.umbral_alto:
        return "alto"
    if prob >= s.umbral_alerta:
        return "alerta"
    return "bajo"


def armar_servicio(s: dict) -> dict:
    return {**s, "horario": HORARIOS[s["servicio"]], "nivel_riesgo": nivel_riesgo(s["prob_deficit"])}


def armar_dia_calendario(repo: RepositorioMock, fecha: date) -> dict:
    cal = repo.dia_calendario(fecha) or {}
    wd = fecha.weekday()
    return {
        "fecha": fecha,
        "dia_semana": DIAS[wd],
        "es_viernes": wd == 4,
        "es_fin_de_semana": wd >= 5,
        "es_ventana_pago": cal.get("es_ventana_pago", False),
        "feriado": cal.get("feriado"),
        "es_vispera_feriado": cal.get("es_vispera_feriado", False),
        "eventos": repo.eventos_de(fecha),
    }


def armar_dia_servicios(repo: RepositorioMock, fecha: date) -> dict | None:
    servicios = repo.servicios_de(fecha)
    if not servicios:
        return None
    return {
        "fecha": fecha,
        "calendario": armar_dia_calendario(repo, fecha),
        "servicios": [armar_servicio(s) for s in servicios],
    }


def sugerencias(repo: RepositorioMock, fecha: date, max_por_rol: int = 2) -> list[dict]:
    """Regla v0 de cobertura (reemplazable por el modelo en la etapa 4).

    Para cada servicio con prob_deficit >= umbral de alerta y cada rol crítico en riesgo:
      1. "mover": alguien ya asignado a ese servicio en otro rol que puede cubrir el rol en riesgo.
      2. "llamar": alguien libre en ese servicio y no ausente ese día; primero quien tiene ese
         mismo rol y después quien está entrenado para cubrirlo (en los datos simulados nadie
         respalda a cocinero de línea ni a jefe de turno).
    Se prioriza a quien lleva menos días seguidos trabajados (menos fatiga).
    """
    umbral = get_settings().umbral_alerta
    ausentes = repo.ausentes_en(fecha)
    resultado: list[dict] = []

    for s in repo.servicios_de(fecha):
        if s["prob_deficit"] < umbral:
            continue
        roles = [r for r in CRITICOS if s["prob_por_rol"][r] >= umbral]
        if not roles:  # riesgo general alto pero ningún rol pasa el umbral: el más probable
            roles = [max(CRITICOS, key=lambda r: s["prob_por_rol"][r])]

        asignados = {t["empleado_id"]: t for t in repo.turnos_de_servicio(fecha, s["servicio"])}
        dias_seguidos = _dias_seguidos_hasta(repo, fecha)

        for rol in roles:
            disponibles = [e for e in repo.empleados.values() if e["id"] not in ausentes]
            # mover: ya está en el servicio con otro rol y está entrenado para cubrir `rol`
            mover = [
                e for e in disponibles
                if rol in e["puede_cubrir"] and e["id"] in asignados and asignados[e["id"]]["rol"] != rol
            ]
            # llamar: libre en ese servicio; primero quien tiene ese rol, luego los polivalentes
            libres = [e for e in disponibles if e["id"] not in asignados]
            orden = lambda e: dias_seguidos.get(e["id"], 0)  # noqa: E731
            llamar = sorted((e for e in libres if e["rol"] == rol), key=orden) + sorted(
                (e for e in libres if rol in e["puede_cubrir"]), key=orden
            )
            candidatos = [("mover", e) for e in sorted(mover, key=orden)] + [("llamar", e) for e in llamar]
            for accion, e in candidatos[:max_por_rol]:
                rol_actual = asignados[e["id"]]["rol"] if accion == "mover" else None
                if accion == "mover":
                    msg = f"Mover a {e['nombre']} ({NOMBRE_ROL[rol_actual]}) a {NOMBRE_ROL[rol]} en {HORARIOS[s['servicio']]}"
                else:
                    msg = f"Llamar a {e['nombre']} ({NOMBRE_ROL[e['rol']]}) para cubrir {NOMBRE_ROL[rol]} en {HORARIOS[s['servicio']]}"
                resultado.append(
                    {
                        "fecha": fecha,
                        "servicio": s["servicio"],
                        "rol_a_cubrir": rol,
                        "prob_deficit_rol": s["prob_por_rol"][rol],
                        "accion": accion,
                        "empleado_id": e["id"],
                        "empleado_nombre": e["nombre"],
                        "rol_actual": rol_actual,
                        "mensaje": msg,
                    }
                )
    return resultado


def _dias_seguidos_hasta(repo: RepositorioMock, fecha: date) -> dict[str, int]:
    """Último valor de días seguidos trabajados de cada empleado hasta `fecha` (inclusive)."""
    f = fecha.isoformat()
    ultimo: dict[str, tuple[str, int]] = {}
    for t in repo.turnos:
        if t["fecha"] <= f:
            prev = ultimo.get(t["empleado_id"])
            if prev is None or t["fecha"] >= prev[0]:
                ultimo[t["empleado_id"]] = (t["fecha"], t["dias_seguidos"])
    return {k: v[1] for k, v in ultimo.items()}


def ficha_empleado(repo: RepositorioMock, empleado_id: str, hoy: date) -> dict | None:
    e = repo.empleados.get(empleado_id)
    if e is None:
        return None
    turnos = repo.turnos_de_empleado(empleado_id)
    h = hoy.isoformat()
    hace_7 = (hoy - timedelta(days=6)).isoformat()
    pasados = [t for t in turnos if t["fecha"] <= h]
    return {
        **e,
        "dias_seguidos_trabajados": pasados[-1]["dias_seguidos"] if pasados else 0,
        "horas_extra_ultimos_7_dias": round(sum(t["horas_extra"] for t in pasados if t["fecha"] >= hace_7), 1),
        "ausencias": repo.ausencias_de_empleado(empleado_id),
        "proximos_turnos": [t for t in turnos if t["fecha"] >= h][:10],
    }
