"""Reglas de negocio que no dependen de dónde vienen los datos."""

from __future__ import annotations

import re
from datetime import date, timedelta

from app import bienestar
from app.config import get_settings
from app.repositorio import Repositorio

# Horario de Luthier: lunes a jueves de 13:00 a 01:00; viernes y sábado de 13:00 a 02:00.
# Domingo: se asume como lunes a jueves [PENDIENTE CERVECERÍA].
HORARIOS = {"13_15": "13:00–15:00", "19_21": "19:00–21:00", "21_23": "21:00–23:00", "23_cierre": "23:00–cierre"}
DIAS_CIERRE_TARDE = {4, 5}  # viernes y sábado cierran a las 02:00


def horario(franja: str, fecha: date | None = None) -> str:
    """Horario en palabras. El cierre depende del día: 01:00 o 02:00 (viernes y sábado)."""
    if franja != "23_cierre":
        return HORARIOS.get(franja, franja)
    if fecha is None:
        return "23:00–cierre"
    return "23:00–02:00" if fecha.weekday() in DIAS_CIERRE_TARDE else "23:00–01:00"
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


_ROL_EN_TEXTO = re.compile(r"\b(garzon|cocinero_linea|jefe_turno)\b")


def _fecha(f) -> date:
    return f if isinstance(f, date) else date.fromisoformat(str(f))


def rol_mas_en_riesgo(s: dict) -> str:
    """El rol que nombra el modelo en su recomendación; si no nombra ninguno, el de mayor probabilidad."""
    m = _ROL_EN_TEXTO.search(s.get("recomendacion") or "")
    if m:
        return m[1]
    return max(CRITICOS, key=lambda r: s["prob_por_rol"][r])


def margen(asignados: int, requeridos: int) -> str:
    """Cuánta ausencia aguanta el servicio, en palabras."""
    base = f"Hay {asignados} programados para {requeridos}"
    if asignados > requeridos:
        holgura = asignados - requeridos
        return f"{base}: alcanza si no faltan más de {holgura}"
    if asignados == requeridos:
        return f"{base}: cualquier ausencia lo deja corto"
    return f"{base}: faltan {requeridos - asignados} desde ya"


def recomendacion(s: dict) -> str:
    """Qué hacer con el servicio, explicado (AP-01 de Cata).

    El riesgo del modelo es la probabilidad de que **los que lleguen** sean menos que los
    requeridos (después de las ausencias). Por eso un servicio con más programados que
    requeridos puede estar en riesgo alto: se dice el margen y el rol más ajustado.
    """
    rol = NOMBRE_ROL[rol_mas_en_riesgo(s)]
    texto_margen = margen(s["asignados"], s["requeridos"])
    nivel = nivel_riesgo(s["prob_deficit"])
    if nivel == "alto":
        return f"Riesgo alto de quedar corto, sobre todo en {rol}. {texto_margen}. Confirma quién viene y ten un reemplazo de {rol} listo."
    if nivel == "alerta":
        return f"Atento a {rol}. {texto_margen}. Si alguien avisa, confirma quién lo cubre."
    if s["asignados"] < s["requeridos"]:
        return f"{texto_margen}. Riesgo bajo según el modelo, pero revisa {rol}."
    return f"Dotación suficiente: {texto_margen.lower()}. No hace falta hacer nada por ahora."


def armar_servicio(s: dict) -> dict:
    return {
        **s,
        "horario": horario(s["servicio"], _fecha(s["fecha"])),
        "nivel_riesgo": nivel_riesgo(s["prob_deficit"]),
        "recomendacion": recomendacion(s),
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


def sugerencias(repo: Repositorio, fecha: date, max_por_rol: int = 2, excluir: str | None = None) -> list[dict]:
    """Regla v0 de cobertura (reemplazable por el modelo en la etapa 4).

    Para cada servicio con prob_deficit >= umbral de alerta y cada rol crítico en riesgo:
      1. "mover": alguien ya asignado a ese servicio en otro rol que puede cubrir el rol en riesgo.
      2. "llamar": alguien libre en ese servicio y no ausente ese día; primero quien tiene ese
         mismo rol y después quien está entrenado para cubrirlo (en los datos simulados nadie
         respalda a cocinero de línea ni a jefe de turno).
    Se prioriza a quien lleva menos días seguidos trabajados; quien tiene fatiga "alta" va al final.
    `excluir`: quien mira las sugerencias (el jefe con sesión) nunca se sugiere a sí mismo.
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
        # una persona no se sugiere para dos roles del mismo servicio, ni a quien está mirando
        ya_sugeridos: set[str] = {excluir} if excluir else set()

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
                    msg = f"Mover a {e['nombre']} ({NOMBRE_ROL[rol_actual]}) a {NOMBRE_ROL[rol]} en {horario(s['servicio'], _fecha(s['fecha']))}"
                else:
                    msg = f"Llamar a {e['nombre']} ({NOMBRE_ROL[e['rol']]}) para cubrir {NOMBRE_ROL[rol]} en {horario(s['servicio'], _fecha(s['fecha']))}"
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
