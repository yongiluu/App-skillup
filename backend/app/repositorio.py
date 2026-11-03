"""Acceso a datos. En la etapa 1 todo sale de app/mocks/*.json y vive en memoria.

En la etapa 2 se reemplaza esta clase por una que consulte Supabase manteniendo
los mismos métodos, así los routers no cambian.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path
from threading import Lock

MOCKS = Path(__file__).resolve().parent / "mocks"


def _cargar(nombre: str):
    return json.loads((MOCKS / f"{nombre}.json").read_text(encoding="utf-8"))


class RepositorioMock:
    def __init__(self) -> None:
        self._lock = Lock()
        self.servicios: list[dict] = _cargar("servicios")
        self.calendario: dict[str, dict] = {d["fecha"]: d for d in _cargar("calendario")}
        self.eventos: list[dict] = _cargar("eventos")
        self.empleados: dict[str, dict] = {e["id"]: e for e in _cargar("empleados")}
        self.turnos: list[dict] = _cargar("turnos")
        self.ausencias: list[dict] = _cargar("ausencias")
        self.solicitudes: dict[int, dict] = {}

        self._servicios_por_fecha: dict[str, list[dict]] = defaultdict(list)
        for s in self.servicios:
            self._servicios_por_fecha[s["fecha"]].append(s)
        self._turnos_por_servicio: dict[tuple[str, str], list[dict]] = defaultdict(list)
        self._turnos_por_empleado: dict[str, list[dict]] = defaultdict(list)
        for t in self.turnos:
            self._turnos_por_servicio[(t["fecha"], t["servicio"])].append(t)
            self._turnos_por_empleado[t["empleado_id"]].append(t)

    # ---- rango de datos ----
    @property
    def rango_servicios(self) -> tuple[str, str]:
        fechas = sorted(self._servicios_por_fecha)
        return fechas[0], fechas[-1]

    # ---- lecturas ----
    def servicios_de(self, fecha: date) -> list[dict]:
        return self._servicios_por_fecha.get(fecha.isoformat(), [])

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

    # ---- escrituras (solo en memoria; se pierden al reiniciar) ----
    def crear_evento(self, datos: dict) -> dict:
        with self._lock:
            nuevo = {"id": max((e["id"] for e in self.eventos), default=0) + 1, **datos}
            self.eventos.append(nuevo)
            return nuevo

    def crear_solicitud(self, datos: dict) -> dict:
        with self._lock:
            ahora = datetime.now(timezone.utc)
            nueva = {
                "id": max(self.solicitudes, default=0) + 1,
                **datos,
                "estado": "pendiente",
                "comentario": None,
                "resuelta_por": None,
                "creada_en": ahora,
                "actualizada_en": ahora,
            }
            self.solicitudes[nueva["id"]] = nueva
            return nueva

    def actualizar_solicitud(self, solicitud_id: int, cambios: dict) -> dict:
        with self._lock:
            s = self.solicitudes[solicitud_id]
            s.update(cambios, actualizada_en=datetime.now(timezone.utc))
            return s


@lru_cache
def get_repo() -> RepositorioMock:
    return RepositorioMock()
