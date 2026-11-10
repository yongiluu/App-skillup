"""Solicitudes de cambio de turno (reglas de la migración 0003, acordadas con Maxi y Manuel).

1. Quien pide el cambio puede proponer un reemplazo, o no proponer a nadie.
2. El reemplazo propuesto acepta o rechaza. Si rechaza, la solicitud sigue pendiente y el
   solicitante o el jefe pueden proponer a otra persona (la respuesta vuelve a "pendiente").
3. El jefe solo puede aprobar si el reemplazo aceptó y sigue disponible. Si nadie acepta,
   solo puede rechazar.
4. Al aprobar, el turno pasa al reemplazo (mismo servicio y rol), en el mismo paso.
5. Disponible = sabe el rol, no está en ese servicio, no está ausente ese día y no supera
   el máximo de días seguidos (6) [PENDIENTE CERVECERÍA].
6. Una sola solicitud pendiente por persona y turno. Una solicitud resuelta no se modifica.

Con la base, las reglas las hace cumplir el trigger de Maxi; en modo mock, el repositorio las
replica con los mismos textos. Los rechazos llegan como 409 con el motivo en palabras.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import get_settings
from app.repositorio import Repositorio, get_repo
from app.schemas import (
    CambioReemplazoIn,
    Disponible,
    Error,
    EstadoSolicitud,
    Franja,
    RespuestaReemplazoIn,
    SolicitudCambio,
    SolicitudCambioIn,
    SolicitudCambioPatch,
)
from app.seguridad import Usuario, solo_jefe, usuario_actual

router = APIRouter(prefix="/solicitudes-cambio", tags=["solicitudes de cambio"], dependencies=[Depends(usuario_actual)])
router_disponibles = APIRouter(tags=["solicitudes de cambio"], dependencies=[Depends(usuario_actual)])
ERRORES = {403: {"model": Error}, 404: {"model": Error}, 409: {"model": Error}}


def _existe(repo: Repositorio, empleado_id: str) -> None:
    if empleado_id not in repo.empleados:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")


def _validar_reemplazo(repo: Repositorio, reemplazo: str, solicitante: str, fecha: date, franja: str) -> None:
    """Al proponer a alguien ya se avisa si no puede (la base solo lo revisa al aceptar y al aprobar)."""
    _existe(repo, reemplazo)
    if reemplazo == solicitante:
        raise HTTPException(409, "El reemplazo no puede ser la misma persona que pide el cambio")
    motivo = repo.motivo_no_disponible(reemplazo, solicitante, fecha, franja)
    if motivo:
        raise HTTPException(409, f"{repo.empleados[reemplazo]['nombre']} no está disponible: {motivo}")


def _vista(u: Usuario, s: dict) -> dict:
    """Lo que ve cada uno. El reemplazo propuesto (que no pidió el cambio) no ve el motivo de quien
    pide (texto libre: puede traer datos de salud) ni quiénes rechazaron antes."""
    if u.es_jefe or u.empleado_id == s["solicitante_id"]:
        return s
    return {**s, "motivo": None, "rechazaron": []}


def _solicitud(repo: Repositorio, solicitud_id: int) -> dict:
    s = repo.obtener_solicitud(solicitud_id)
    if s is None:
        raise HTTPException(404, f"No existe la solicitud {solicitud_id}")
    if s["estado"] != "pendiente":
        raise HTTPException(409, f"La solicitud ya está {s['estado']}")
    return s


@router.get("", response_model=list[SolicitudCambio])
def listar(
    estado: EstadoSolicitud | None = Query(None, description="Filtrar por estado"),
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """El jefe de turno ve todas; un empleado ve las que pidió o en las que lo proponen como reemplazo.
    Al reemplazo propuesto le llegan sin `motivo` y con `rechazaron` vacío (privacidad de quien pide)."""
    return [
        _vista(u, s) for s in repo.listar_solicitudes()
        if (estado is None or s["estado"] == estado.value)
        and (u.es_jefe or u.empleado_id in (s["solicitante_id"], s["reemplazo_id"]))
    ]


@router.post("", response_model=SolicitudCambio, status_code=201, responses=ERRORES)
def crear(datos: SolicitudCambioIn, u: Usuario = Depends(usuario_actual), repo: Repositorio = Depends(get_repo)):
    """Pide cambiar un turno asignado. Queda `pendiente`. El reemplazo es opcional; si viene,
    tiene que estar disponible y su respuesta queda `pendiente`. Un empleado solo pide por sí mismo."""
    if not u.es_jefe and datos.solicitante_id != u.empleado_id:
        raise HTTPException(403, "Solo puedes pedir cambios de tus propios turnos")
    _existe(repo, datos.solicitante_id)
    if not any(t["empleado_id"] == datos.solicitante_id for t in repo.turnos_de_servicio(datos.fecha, datos.servicio)):
        raise HTTPException(409, f"{datos.solicitante_id} no tiene turno el {datos.fecha} en {datos.servicio}")
    if datos.reemplazo_id:
        _validar_reemplazo(repo, datos.reemplazo_id, datos.solicitante_id, datos.fecha, datos.servicio)
    return repo.crear_solicitud(datos.model_dump(mode="json"))


@router.post("/{solicitud_id}/respuesta", response_model=SolicitudCambio, responses=ERRORES)
def responder(
    solicitud_id: int,
    datos: RespuestaReemplazoIn,
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """**Solo la persona propuesta como reemplazo:** acepta o rechaza cubrir el turno.
    Si rechaza, la solicitud sigue pendiente. Para aceptar tiene que estar disponible (409 si no)."""
    s = _solicitud(repo, solicitud_id)
    if s["reemplazo_id"] is None or u.empleado_id != s["reemplazo_id"]:
        raise HTTPException(403, "Solo la persona propuesta como reemplazo puede responder")
    return _vista(u, repo.responder_reemplazo(solicitud_id, datos.acepta))


@router.patch("/{solicitud_id}/reemplazo", response_model=SolicitudCambio, responses=ERRORES)
def cambiar_reemplazo(
    solicitud_id: int,
    datos: CambioReemplazoIn,
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """**Quien pidió el cambio o el jefe de turno:** propone a otra persona (por ejemplo, después de un
    rechazo, o cuando se pidió sin reemplazo). Su respuesta vuelve a `pendiente`."""
    s = _solicitud(repo, solicitud_id)
    if not u.es_jefe and u.empleado_id != s["solicitante_id"]:
        raise HTTPException(403, "Solo quien pidió el cambio o el jefe de turno pueden proponer otro reemplazo")
    _validar_reemplazo(repo, datos.reemplazo_id, s["solicitante_id"], date.fromisoformat(str(s["fecha"])), s["servicio"])
    return repo.cambiar_reemplazo(solicitud_id, datos.reemplazo_id)


@router.patch("/{solicitud_id}", response_model=SolicitudCambio, responses=ERRORES)
def resolver(
    solicitud_id: int,
    cambios: SolicitudCambioPatch,
    u: Usuario = Depends(solo_jefe),
    repo: Repositorio = Depends(get_repo),
):
    """**Jefe de turno:** aprueba o rechaza.
    - **Aprobar** solo si el reemplazo aceptó y sigue disponible; el turno pasa al reemplazo
      (mismo servicio y rol) en el mismo paso. Si no se puede → 409 con el motivo, por ejemplo:
      "Solo se puede aprobar si un reemplazo aceptó. Si nadie acepta, hay que rechazarla" o
      "No se puede aprobar: Está ausente ese día".
    - **Rechazar** siempre se puede mientras esté pendiente; no cambia ningún turno."""
    _solicitud(repo, solicitud_id)
    return repo.actualizar_solicitud(
        solicitud_id, {**cambios.model_dump(), "resuelta_por": u.empleado_id, "usuario": u.usuario}
    )


@router_disponibles.get("/disponibles", response_model=list[Disponible], responses=ERRORES)
def disponibles(
    servicio: Franja = Query(description="Franja del turno"),
    fecha: date | None = Query(None, description="YYYY-MM-DD. Si se omite, usa MOCK_HOY."),
    solicitante: str | None = Query(None, description="De quién es el turno. Por defecto, quien consulta."),
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """Quiénes pueden reemplazar a `solicitante` en ese turno (el rol sale de su turno).
    - **Empleado:** solo para sus propios turnos, y ve solo a los disponibles, sin motivos.
    - **Jefe:** para cualquier turno, ve a todos, con `motivo` cuando no pueden."""
    fecha = fecha or get_settings().mock_hoy
    solicitante = solicitante or u.empleado_id
    if not u.es_jefe and solicitante != u.empleado_id:
        raise HTTPException(403, "Solo puedes buscar reemplazos para tus propios turnos")
    _existe(repo, solicitante)
    if not any(t["empleado_id"] == solicitante for t in repo.turnos_de_servicio(fecha, servicio)):
        raise HTTPException(409, f"{solicitante} no tiene turno el {fecha} en {servicio}")
    filas = [{**f, "disponible": f["motivo"] is None} for f in repo.disponibles(solicitante, fecha, servicio)]
    if u.es_jefe:
        return filas
    return [{**f, "motivo": None} for f in filas if f["disponible"]]
