"""Acceso a datos.

Hay dos repositorios con los mismos métodos, así los routers y la lógica no cambian:
- RepositorioMock: lee app/mocks/*.json y guarda en memoria (pruebas, CI, demo sin BD).
- RepositorioDB (app/repositorio_db.py): lee y escribe en Postgres/Supabase.
Se elige con FUENTE_DATOS en .env.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from threading import RLock
from typing import Any

MOCKS = Path(__file__).resolve().parent / "mocks"

# RepositorioMock y RepositorioDB tienen los mismos métodos; las anotaciones usan este alias.
Repositorio = Any

PENDIENTE_DUPLICADA = "Ya hay una solicitud pendiente para ese turno"


class ReglaNegocio(Exception):
    """Una regla del negocio impide la operación (la API responde 409 con este mensaje)."""


def _cargar(nombre: str):
    return json.loads((MOCKS / f"{nombre}.json").read_text(encoding="utf-8"))


class RepositorioMock:
    def __init__(self) -> None:
        self._lock = RLock()
        self.servicios: list[dict] = _cargar("servicios")
        self.calendario: dict[str, dict] = {d["fecha"]: d for d in _cargar("calendario")}
        self.eventos: list[dict] = _cargar("eventos")
        self.empleados: dict[str, dict] = {e["id"]: e for e in _cargar("empleados")}
        self.turnos: list[dict] = _cargar("turnos")
        self.ausencias: list[dict] = _cargar("ausencias")
        self.solicitudes: dict[int, dict] = {}
        self.configuracion = {"max_dias_seguidos": 6}  # como public.configuracion [PENDIENTE CERVECERÍA]
        # Datos sensibles: se cargan aparte y solo se leen desde app/bienestar.py
        self.consentimientos: dict[str, dict] = {c["empleado_id"]: c for c in _cargar("consentimientos")}
        self._bienestar_por_empleado: dict[str, list[dict]] = defaultdict(list)
        for b in _cargar("bienestar"):
            self._bienestar_por_empleado[b["empleado_id"]].append(b)
        self.preguntas_tests: dict = _cargar("preguntas_tests")

        self._servicios_por_fecha: dict[str, list[dict]] = defaultdict(list)
        for s in self.servicios:
            self._servicios_por_fecha[s["fecha"]].append(s)
        self._turnos_por_servicio: dict[tuple[str, str], list[dict]] = defaultdict(list)
        self._turnos_por_empleado: dict[str, list[dict]] = defaultdict(list)
        for t in self.turnos:
            self._turnos_por_servicio[(t["fecha"], t["servicio"])].append(t)
            self._turnos_por_empleado[t["empleado_id"]].append(t)

    # ---- rango de datos ----
    def rango_servicios(self) -> tuple[str, str] | None:
        fechas = sorted(self._servicios_por_fecha)
        return (fechas[0], fechas[-1]) if fechas else None

    def rango_calendario(self) -> tuple[str, str] | None:
        fechas = sorted(self.calendario)
        return (fechas[0], fechas[-1]) if fechas else None

    # ---- lecturas ----
    def servicios_de(self, fecha: date) -> list[dict]:
        # "asignados" se cuenta en vivo: cambia cuando se aprueba un cambio de turno (igual que en la base)
        return [
            {**s, "asignados": len(self._turnos_por_servicio.get((s["fecha"], s["servicio"]), []))}
            for s in self._servicios_por_fecha.get(fecha.isoformat(), [])
        ]

    def dia_calendario(self, fecha: date) -> dict | None:
        return self.calendario.get(fecha.isoformat())

    def eventos_de(self, fecha: date) -> list[dict]:
        f = fecha.isoformat()
        return [e for e in self.eventos if e["fecha"] == f]

    def turnos_de_servicio(self, fecha: date, servicio: str) -> list[dict]:
        return self._turnos_por_servicio.get((fecha.isoformat(), servicio), [])

    def turnos_de_empleado(self, empleado_id: str) -> list[dict]:
        return self._turnos_por_empleado.get(empleado_id, [])

    def ausencias_de_empleado(self, empleado_id: str) -> list[dict]:
        return [a for a in self.ausencias if a["empleado_id"] == empleado_id]

    def ausentes_en(self, fecha: date) -> set[str]:
        f = fecha.isoformat()
        return {a["empleado_id"] for a in self.ausencias if a["fecha"] == f}

    def dias_seguidos_hasta(self, fecha: date) -> dict[str, int]:
        """Racha de días con turno que termina en el último día trabajado de cada persona (≤ fecha).
        Se calcula desde los turnos (igual que la base), así refleja los cambios de turno aprobados."""
        desde = fecha - timedelta(days=60)
        racha = {}
        for emp, turnos in self._turnos_por_empleado.items():
            dias = {d for d in (date.fromisoformat(t["fecha"]) for t in turnos) if desde <= d <= fecha}
            if not dias:
                continue
            d, n = max(dias), 0
            while d in dias:
                n += 1
                d -= timedelta(days=1)
            racha[emp] = n
        return racha

    def horas_extra_7d(self, fecha: date) -> dict[str, float]:
        """Horas extra de cada persona en los 7 días que terminan en `fecha`."""
        h, d = fecha.isoformat(), (fecha - timedelta(days=6)).isoformat()
        total: dict[str, float] = defaultdict(float)
        for t in self.turnos:
            if d <= t["fecha"] <= h:
                total[t["empleado_id"]] += t["horas_extra"]
        return dict(total)

    def listar_solicitudes(self) -> list[dict]:
        return list(self.solicitudes.values())

    def obtener_solicitud(self, solicitud_id: int) -> dict | None:
        return self.solicitudes.get(solicitud_id)

    def consentimiento_de(self, empleado_id: str) -> dict | None:
        """Solo el consentimiento vigente; quien no consintió no tiene registro (igual que en la base)."""
        c = self.consentimientos.get(empleado_id)
        return c if c and c["otorgado"] else None

    def ausencias_del_dia(self, fecha: date) -> list[dict]:
        """Ausencias del día con nombre, rol y las franjas en que la persona tenía turno."""
        f = fecha.isoformat()
        filas = []
        for a in self.ausencias:
            if a["fecha"] != f or a["empleado_id"] not in self.empleados:
                continue
            e = self.empleados[a["empleado_id"]]
            franjas = sorted({t["servicio"] for t in self.turnos_de_empleado(e["id"]) if t["fecha"] == f})
            filas.append({**a, "nombre": e["nombre"], "rol": e["rol"], "servicios": franjas})
        return sorted(filas, key=lambda x: x["empleado_id"])  # orden estable en mocks y en la base

    def registrar_acceso(self, usuario: str, accion: str, empleado_id: str | None) -> None:
        """En mock solo queda el log (ver app/bienestar.py); en la BD se guarda en sensible.registro_acceso."""

    def bienestar_de_empleado(self, empleado_id: str, desde: date, hasta: date) -> list[dict]:
        d, h = desde.isoformat(), hasta.isoformat()
        return [b for b in self._bienestar_por_empleado.get(empleado_id, []) if d <= b["fecha"] <= h]

    # ---- escrituras (solo en memoria; se pierden al reiniciar) ----
    def crear_evento(self, datos: dict) -> dict:
        with self._lock:
            nuevo = {"id": max((e["id"] for e in self.eventos), default=0) + 1, **datos}
            self.eventos.append(nuevo)
            return nuevo

    # ---- solicitudes de cambio: mismas reglas que la migración 0003 (trigger de Maxi) ----
    def _pendiente(self, solicitud_id: int) -> dict:
        s = self.solicitudes[solicitud_id]
        if s["estado"] != "pendiente":
            raise ReglaNegocio(f"La solicitud {solicitud_id} ya está {s['estado']}")
        return s

    def motivo_no_disponible(self, reemplazo: str, solicitante: str, fecha: date, franja: str) -> str | None:
        """Copia en Python de public.motivo_no_disponible() (0003). Mismos textos y mismo orden."""
        e = self.empleados.get(reemplazo)
        if e is None:
            return "El reemplazo no es un empleado activo"
        turno = next((t for t in self.turnos_de_servicio(fecha, franja) if t["empleado_id"] == solicitante), None)
        if turno is None:
            return "Quien pide el cambio no tiene turno en esa fecha y franja"
        rol = turno["rol"]
        if rol != e["rol"] and rol not in e["puede_cubrir"]:
            return f"No sabe hacer el rol {rol}"
        if any(t["empleado_id"] == reemplazo for t in self.turnos_de_servicio(fecha, franja)):
            return "Ya trabaja en ese mismo servicio"
        if reemplazo in self.ausentes_en(fecha):
            return "Está ausente ese día"
        dias = {date.fromisoformat(t["fecha"]) for t in self.turnos_de_empleado(reemplazo)} | {fecha}
        inicio = fin = fecha
        while inicio - timedelta(days=1) in dias:
            inicio -= timedelta(days=1)
        while fin + timedelta(days=1) in dias:
            fin += timedelta(days=1)
        total, maximo = (fin - inicio).days + 1, self.configuracion["max_dias_seguidos"]
        if total > maximo:
            return f"Quedaría con {total} días seguidos de trabajo (máximo {maximo})"
        return None

    def disponibles(self, solicitante: str, fecha: date, franja: str) -> list[dict]:
        return [
            {"empleado_id": e["id"], "nombre": e["nombre"], "rol": e["rol"],
             "motivo": self.motivo_no_disponible(e["id"], solicitante, fecha, franja)}
            for e in sorted(self.empleados.values(), key=lambda x: x["id"]) if e["id"] != solicitante
        ]

    def crear_solicitud(self, datos: dict) -> dict:
        with self._lock:
            if any(x["estado"] == "pendiente" and (x["solicitante_id"], x["fecha"], x["servicio"])
                   == (datos["solicitante_id"], datos["fecha"], datos["servicio"]) for x in self.solicitudes.values()):
                raise ReglaNegocio(PENDIENTE_DUPLICADA)
            ahora = datetime.now(timezone.utc)
            nueva = {
                "id": max(self.solicitudes, default=0) + 1,
                **datos,
                "estado": "pendiente",
                "respuesta_reemplazo": "pendiente" if datos.get("reemplazo_id") else None,
                "respondida_en": None,
                "comentario": None,
                "resuelta_por": None,
                "creada_en": ahora,
                "actualizada_en": ahora,
            }
            self.solicitudes[nueva["id"]] = nueva
            return nueva

    def cambiar_reemplazo(self, solicitud_id: int, reemplazo_id: str | None) -> dict:
        with self._lock:
            s = self._pendiente(solicitud_id)
            if reemplazo_id != s["reemplazo_id"]:
                s.update(reemplazo_id=reemplazo_id, respuesta_reemplazo="pendiente" if reemplazo_id else None,
                         respondida_en=None)
            s["actualizada_en"] = datetime.now(timezone.utc)
            return s

    def responder_reemplazo(self, solicitud_id: int, acepta: bool) -> dict:
        with self._lock:
            s = self._pendiente(solicitud_id)
            if s["reemplazo_id"] is None:
                raise ReglaNegocio("La solicitud no tiene reemplazo que pueda responder")
            if acepta:
                motivo = self.motivo_no_disponible(s["reemplazo_id"], s["solicitante_id"],
                                                   date.fromisoformat(s["fecha"]), s["servicio"])
                if motivo:
                    raise ReglaNegocio(f"No puede aceptar: {motivo}")
            ahora = datetime.now(timezone.utc)
            s.update(respuesta_reemplazo="aceptada" if acepta else "rechazada", respondida_en=ahora, actualizada_en=ahora)
            return s

    def actualizar_solicitud(self, solicitud_id: int, cambios: dict) -> dict:
        """Aprobar o rechazar. Al aprobar, el turno pasa al reemplazo (como el trigger de la 0003)."""
        with self._lock:
            s = self._pendiente(solicitud_id)
            if cambios["estado"] == "aprobada":
                if s["reemplazo_id"] is None or s["respuesta_reemplazo"] != "aceptada":
                    raise ReglaNegocio("Solo se puede aprobar si un reemplazo aceptó. Si nadie acepta, hay que rechazarla")
                fecha = date.fromisoformat(s["fecha"])
                motivo = self.motivo_no_disponible(s["reemplazo_id"], s["solicitante_id"], fecha, s["servicio"])
                if motivo:
                    raise ReglaNegocio(f"No se puede aprobar: {motivo}")
                self._mover_turno(fecha, s["servicio"], s["solicitante_id"], s["reemplazo_id"])
            s.update({k: v for k, v in cambios.items() if k != "usuario"}, actualizada_en=datetime.now(timezone.utc))
            return s

    def _mover_turno(self, fecha: date, servicio: str, de: str, a: str) -> None:
        """Pasa el turno de `de` a `a`, con el mismo rol y horas."""
        t = next(x for x in self._turnos_por_servicio[(fecha.isoformat(), servicio)] if x["empleado_id"] == de)
        self._turnos_por_empleado[de].remove(t)
        t["empleado_id"] = a
        self._turnos_por_empleado[a].append(t)
        self._turnos_por_empleado[a].sort(key=lambda x: (x["fecha"], x["servicio"]))


@lru_cache
def repo_mock() -> RepositorioMock:
    """Una sola instancia en memoria (las pruebas la reinician con repo_mock.cache_clear())."""
    return RepositorioMock()


def get_repo():
    """Dependencia de FastAPI: entrega el repositorio según FUENTE_DATOS."""
    from app.config import get_settings

    if get_settings().fuente_datos == "mock":
        yield repo_mock()
        return
    from app.repositorio_db import abrir_repo

    with abrir_repo() as repo:
        yield repo
