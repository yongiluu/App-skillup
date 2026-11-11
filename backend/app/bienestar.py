"""Bienestar: indicador de fatiga a partir de datos sensibles (simulados).

Reglas (acordadas con el equipo):
- Sin consentimiento registrado no se usa ni se muestra nada de la persona.
- El jefe de turno solo ve el indicador: nivel (bajo/medio/alto) y hasta 2 motivos generales.
  Nunca ve horas de sueño, pasos, pulso ni respuestas de la encuesta.
- Los datos crudos solo los ve la propia persona.
- Cada acceso a datos de bienestar queda registrado (log de auditoría).

El indicador es una regla simple y explicable (v0), no un modelo clínico.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from statistics import mean

from app.repositorio import Repositorio

auditoria = logging.getLogger("skillup.auditoria")

# Versión del texto de autorización que acepta quien autoriza hoy. [PENDIENTE CERVECERÍA / revisión legal]
VERSION_TEXTO_CONSENTIMIENTO = "borrador-v0"
DIAS_VENTANA = 3  # se consideran los últimos 3 días hasta la fecha
UMBRAL_MEDIO = 0.35
UMBRAL_ALTO = 0.60


def _acotar(x: float) -> float:
    return max(0.0, min(1.0, x))


def _componentes(registros: list[dict], dias_seguidos: int, horas_extra_7d: float) -> dict[str, float]:
    """Cada componente va de 0 (sin señal de fatiga) a 1 (señal fuerte)."""
    c: dict[str, float] = {}
    sueno = [r["sueno_horas"] for r in registros if r["sueno_horas"] is not None]
    pasos = [r["pasos"] for r in registros if r["pasos"] is not None]
    pulso = [r["pulso_medio_bpm"] for r in registros if r["pulso_medio_bpm"] is not None]
    if sueno:
        c["descanso"] = _acotar((7.0 - mean(sueno)) / 1.5)  # < 5,5 h promedio = 1
    if pasos or pulso:
        c["carga_fisica"] = max(
            _acotar((mean(pasos) - 9000) / 6000) if pasos else 0.0,  # > 15.000 pasos = 1
            _acotar((mean(pulso) - 78) / 15) if pulso else 0.0,  # > 93 bpm medio = 1
        )
    encuesta = [r["encuesta_fatiga_fin"] for r in registros if r["encuesta_fatiga_fin"] is not None]
    if encuesta:  # vacía si la persona no respondió la encuesta de salida esos días
        c["autorreporte"] = _acotar((mean(encuesta) - 3) / 3)  # 6–7 = 1
    # La jornada no es un dato de salud, pero suma a la fatiga.
    c["jornada"] = max(_acotar((dias_seguidos - 4) / 4), _acotar(horas_extra_7d / 6))
    return c


def _nivel(componentes: dict[str, float]) -> tuple[str, list[str]]:
    valores = list(componentes.values())
    # Mezcla del peor componente y el promedio: una sola señal fuerte cuenta, pero no lo es todo.
    puntaje = 0.6 * max(valores) + 0.4 * mean(valores)
    nivel = "alto" if puntaje >= UMBRAL_ALTO else "medio" if puntaje >= UMBRAL_MEDIO else "bajo"
    orden = sorted(componentes, key=componentes.get, reverse=True)
    motivos = [m for m in orden if componentes[m] >= 0.5][:2]
    if nivel != "bajo" and not motivos:
        motivos = orden[:1]
    return nivel, motivos


def _jornada(repo: Repositorio, empleado_id: str, fecha: date) -> tuple[int, float]:
    return repo.dias_seguidos_hasta(fecha).get(empleado_id, 0), repo.horas_extra_7d(fecha).get(empleado_id, 0.0)


def resumen(repo: Repositorio, empleado_id: str, fecha: date) -> dict:
    """Estado + indicador de fatiga (lo que puede ver el jefe de turno)."""
    consentimiento = repo.consentimiento_de(empleado_id) or {
        "otorgado": False, "fecha": None, "version_texto": "sin-registro"
    }
    base = {"consentimiento": consentimiento, "fatiga": None}
    if not consentimiento["otorgado"]:
        return {**base, "estado": "sin_consentimiento"}
    registros = repo.bienestar_de_empleado(empleado_id, fecha - timedelta(days=DIAS_VENTANA - 1), fecha)
    if not registros:
        return {**base, "estado": "sin_datos"}
    nivel, motivos = _nivel(_componentes(registros, *_jornada(repo, empleado_id, fecha)))
    return {
        **base,
        "estado": "ok",
        "fatiga": {"nivel": nivel, "motivos": motivos, "calculado_al": fecha, "dias_considerados": len(registros)},
    }


def datos_propios(repo: Repositorio, empleado_id: str, desde: date, hasta: date) -> dict:
    """Datos crudos + indicador. Solo para la propia persona (el router lo controla)."""
    r = resumen(repo, empleado_id, hasta)
    registros = repo.bienestar_de_empleado(empleado_id, desde, hasta) if r["estado"] != "sin_consentimiento" else []
    return {**r, "empleado_id": empleado_id, "registros": registros}


def registrar_acceso(repo: Repositorio, usuario: str, accion: str, empleado_id: str | None = None) -> None:
    """Deja rastro de quién miró datos de bienestar: en el log y, con BD, en sensible.registro_acceso."""
    auditoria.info("bienestar acceso usuario=%s accion=%s empleado=%s", usuario, accion, empleado_id or "-")
    repo.registrar_acceso(usuario, accion, empleado_id)
