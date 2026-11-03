"""Modelos de entrada y salida de la API (el contrato en código).

Si cambias algo aquí, cambia el contrato: avisa a frontend y base de datos.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

Franja = Literal["11_13", "13_15", "19_21", "21_23"]
RolCritico = Literal["garzon", "cocinero_linea", "jefe_turno"]
Rol = Literal[
    "garzon", "cocinero_linea", "jefe_turno", "runner", "host", "cajero", "ayudante_cocina", "copero"
]
NivelRiesgo = Literal["bajo", "alerta", "alto"]
Perfil = Literal["jefe_turno", "empleado"]


# ---------- Auth ----------
class LoginIn(BaseModel):
    usuario: str = Field(examples=["jefe"])
    password: str = Field(min_length=1, examples=["cualquiera"])


class LoginOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    perfil: Perfil
    empleado_id: str | None
    nombre: str


# ---------- Calendario y eventos ----------
class TipoEvento(str, Enum):
    partido = "partido"
    concierto = "concierto"
    tocata = "tocata"
    lanzamiento = "lanzamiento"
    promocion = "promocion"
    evento_local = "evento_local"
    otro = "otro"


class EventoIn(BaseModel):
    fecha: date
    nombre: str = Field(min_length=1, max_length=120, examples=["Partido Chile vs Perú"])
    tipo: TipoEvento = TipoEvento.otro
    servicios: list[Franja] = Field(default_factory=list, description="Franjas afectadas; vacío = todo el día")
    impacto_esperado: Literal["bajo", "medio", "alto"] = "medio"
    notas: str | None = None


class Evento(EventoIn):
    id: int


class DiaCalendario(BaseModel):
    fecha: date
    dia_semana: str
    es_viernes: bool
    es_fin_de_semana: bool
    es_ventana_pago: bool = Field(description="Días de pago y quincenas")
    feriado: str | None = Field(description="Nombre del feriado, o null")
    es_vispera_feriado: bool
    eventos: list[Evento]


class Calendario(BaseModel):
    mes: str = Field(examples=["2025-10"])
    dias: list[DiaCalendario]


# ---------- Servicios ----------
class ProbPorRol(BaseModel):
    garzon: float
    cocinero_linea: float
    jefe_turno: float


class Servicio(BaseModel):
    fecha: date
    servicio: Franja
    horario: str = Field(examples=["13:00–15:00"])
    requeridos: int
    asignados: int
    dotacion_predicha: float
    cubiertos_previstos: int
    reservas: int
    pedidos_delivery: int
    prob_deficit: float
    nivel_riesgo: NivelRiesgo
    prob_por_rol: ProbPorRol
    recomendacion: str


class DiaServicios(BaseModel):
    fecha: date
    calendario: DiaCalendario
    servicios: list[Servicio]


class Semana(BaseModel):
    inicio: date
    fin: date
    dias: list[DiaServicios]


# ---------- Sugerencias ----------
class Sugerencia(BaseModel):
    fecha: date
    servicio: Franja
    rol_a_cubrir: RolCritico
    prob_deficit_rol: float
    accion: Literal["mover", "llamar"]
    empleado_id: str
    empleado_nombre: str
    rol_actual: str | None = Field(description="Rol que tiene en ese servicio si ya está asignado")
    mensaje: str


# ---------- Empleados ----------
class Empleado(BaseModel):
    id: str
    nombre: str
    rol: Rol
    rol_respaldo: str | None
    polivalente: bool
    puede_cubrir: list[str]
    tipo_contrato: Literal["full_time", "part_time", "weekend_only"]
    preferencia_turno: Literal["midday", "evening", "mixed"]


class Turno(BaseModel):
    empleado_id: str
    fecha: date
    servicio: Franja
    rol: Rol
    horas_programadas: float


class Ausencia(BaseModel):
    fecha: date
    motivo: str
    horas: float
    aviso_corto: bool


class Bienestar(BaseModel):
    """Biometría y test: datos sensibles, fuera del alcance por ahora."""

    estado: Literal["pendiente"] = "pendiente"
    nota: str = "Requiere decisión de la cervecería y consentimiento registrado."


class EmpleadoFicha(Empleado):
    antiguedad_anos: int
    distancia_trabajo_km: float
    dias_seguidos_trabajados: int
    horas_extra_ultimos_7_dias: float
    ausencias: list[Ausencia]
    proximos_turnos: list[Turno]
    bienestar: Bienestar = Field(default_factory=Bienestar)


# ---------- Solicitudes de cambio ----------
class EstadoSolicitud(str, Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    rechazada = "rechazada"


class SolicitudCambioIn(BaseModel):
    solicitante_id: str = Field(examples=["RST_001"])
    fecha: date
    servicio: Franja
    reemplazo_id: str | None = Field(default=None, description="Quién cubre, si ya se sabe")
    motivo: str | None = None


class SolicitudCambioPatch(BaseModel):
    estado: Literal["aprobada", "rechazada"]
    comentario: str | None = None


class SolicitudCambio(SolicitudCambioIn):
    id: int
    estado: EstadoSolicitud
    comentario: str | None = None
    creada_en: datetime
    actualizada_en: datetime


class Error(BaseModel):
    detail: str
