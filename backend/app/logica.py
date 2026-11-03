"""Reglas de negocio que no dependen de dónde vienen los datos."""

from __future__ import annotations

import re
from datetime import date, timedelta

from app import bienestar
from app.config import get_settings
from app.repositorio import Repositorio

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


_REGLAS_RECOMENDACION = [
    (re.compile(r"^Activar reemplazo inmediato y reforzar (\w+) para la franja (\w+)$"),
     lambda m: f"Riesgo alto: busca reemplazo ya y refuerza {NOMBRE_ROL.get(m[1], m[1])} de {HORARIOS.get(m[2], m[2])}."),
    (re.compile(r"^Mover personal cross-trained y preparar backup en (\w+)$"),
     lambda m: f"Mueve a alguien entrenado como {NOMBRE_ROL.get(m[1], m[1])} y deja un respaldo listo."),
    (re.compile(r"^Monitorear ausentismo corto aviso y confirmar cobertura de (\w+)$"),
     lambda m: f"Atento a ausencias de último minuto: confirma quién cubre {NOMBRE_ROL.get(m[1], m[1])}."),
    (re.compile(r"^Cobertura estable; mantener monitoreo operativo$"),
     lambda m: "Dotación suficiente: no hace falta hacer nada por ahora."),
]


def recomendacion_natural(texto: str) -> str:
    """Traduce el texto técnico del modelo a lenguaje normal. Si no lo reconoce, lo deja igual."""
    for patron, frase in _REGLAS_RECOMENDACION:
        m = patron.match(texto.strip())
        if m:
            return frase(m)
    return texto


def armar_servicio(s: dict) -> dict:
    return {
        **s,
        "horario": HORARIOS[s["servicio"]],
        "nivel_riesgo": nivel_riesgo(s["prob_deficit"]),
        "recomendacion": recomendacion_natural(s["recomendacion"]),
    }


def armar_dia_calendario(repo: Repositorio, fecha: date) -> dict:
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


def armar_dia_servicios(repo: Repositorio, fecha: date) -> dict | None:
    servicios = repo.servicios_de(fecha)
    if not servicios:
        return None
    return {
        "fecha": fecha,
        "calendario": armar_dia_calendario(repo, fecha),
        "servicios": [armar_servicio(s) for s in servicios],
    }


def sugerencias(repo: Repositorio, fecha: date, max_por_rol: int = 2) -> list[dict]:
    """Regla v0 de cobertura (reemplazable por el modelo en la etapa 4).

    Para cada servicio con prob_deficit >= umbral de alerta y cada rol crítico en riesgo:
      1. "mover": alguien ya asignado a ese servicio en otro rol que puede cubrir el rol en riesgo.
      2. "llamar": alguien libre en ese servicio y no ausente ese día; primero quien tiene ese
         mismo rol y después quien está entrenado para cubrirlo (en los datos simulados nadie
         respalda a cocinero de línea ni a jefe de turno).
    Se prioriza a quien lleva menos días seguidos trabajados; quien tiene fatiga "alta" va al final.
    """
    umbral = get_settings().umbral_alerta
    ausentes = repo.ausentes_en(fecha)
    dias_seguidos = repo.dias_seguidos_hasta(fecha)
    _cache_fatiga: dict[str, bool] = {}

    def fatiga_alta(emp_id: str) -> bool:
        if emp_id not in _cache_fatiga:
            f = bienestar.resumen(repo, emp_id, fecha)["fatiga"]
            _cache_fatiga[emp_id] = bool(f and f["nivel"] == "alto")
        return _cache_fatiga[emp_id]

    resultado: list[dict] = []

    for s in repo.servicios_de(fecha):
        if s["prob_deficit"] < umbral:
            continue
        roles = [r for r in CRITICOS if s["prob_por_rol"][r] >= umbral]
        if not roles:  # riesgo general alto pero ningún rol pasa el umbral: el más probable
            roles = [max(CRITICOS, key=lambda r: s["prob_por_rol"][r])]

        asignados = {t["empleado_id"]: t for t in repo.turnos_de_servicio(fecha, s["servicio"])}
        ya_sugeridos: set[str] = set()  # una persona no se sugiere para dos roles del mismo servicio

        for rol in roles:
            disponibles = [
                e for e in repo.empleados.values() if e["id"] not in ausentes and e["id"] not in ya_sugeridos
            ]
            # mover: ya está en el servicio con otro rol y está entrenado para cubrir `rol`
            mover = [
                e for e in disponibles
                if rol in e["puede_cubrir"] and e["id"] in asignados and asignados[e["id"]]["rol"] != rol
            ]
            # llamar: libre en ese servicio; primero quien tiene ese rol, luego los polivalentes
            libres = [e for e in disponibles if e["id"] not in asignados]
            # Menos días seguidos primero; quien tiene fatiga "alta" va al final. Sin consentimiento
            # no se usa su indicador (no se le favorece ni se le perjudica).
            orden = lambda e: (fatiga_alta(e["id"]), dias_seguidos.get(e["id"], 0))  # noqa: E731
            llamar = sorted((e for e in libres if e["rol"] == rol), key=orden) + sorted(
                (e for e in libres if rol in e["puede_cubrir"]), key=orden
            )
            candidatos = [("mover", e) for e in sorted(mover, key=orden)] + [("llamar", e) for e in llamar]
            for accion, e in candidatos[:max_por_rol]:
                ya_sugeridos.add(e["id"])
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


def ficha_empleado(repo: Repositorio, empleado_id: str, hoy: date) -> dict | None:
    e = repo.empleados.get(empleado_id)
    if e is None:
        return None
    turnos = repo.turnos_de_empleado(empleado_id)
    h = hoy.isoformat()
    return {
        **e,
        "dias_seguidos_trabajados": repo.dias_seguidos_hasta(hoy).get(empleado_id, 0),
        "horas_extra_ultimos_7_dias": round(repo.horas_extra_7d(hoy).get(empleado_id, 0.0), 1),
        "ausencias": repo.ausencias_de_empleado(empleado_id),
        "proximos_turnos": [t for t in turnos if t["fecha"] >= h][:10],
        "bienestar": bienestar.resumen(repo, empleado_id, hoy),
    }
