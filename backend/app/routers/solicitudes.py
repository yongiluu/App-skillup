from fastapi import APIRouter, Depends, HTTPException, Query

from app.repositorio import Repositorio, get_repo
from app.schemas import Error, EstadoSolicitud, SolicitudCambio, SolicitudCambioIn, SolicitudCambioPatch
from app.seguridad import Usuario, solo_jefe, usuario_actual

router = APIRouter(prefix="/solicitudes-cambio", tags=["solicitudes de cambio"], dependencies=[Depends(usuario_actual)])
ERRORES = {403: {"model": Error}, 404: {"model": Error}, 409: {"model": Error}}


@router.get("", response_model=list[SolicitudCambio])
def listar(
    estado: EstadoSolicitud | None = Query(None, description="Filtrar por estado"),
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """El jefe de turno ve todas; un empleado ve las que pidió o en las que lo proponen como reemplazo."""
    return [
        s for s in repo.listar_solicitudes()
        if (estado is None or s["estado"] == estado.value)
        and (u.es_jefe or u.empleado_id in (s["solicitante_id"], s["reemplazo_id"]))
    ]


@router.post("", response_model=SolicitudCambio, status_code=201, responses=ERRORES)
def crear(datos: SolicitudCambioIn, u: Usuario = Depends(usuario_actual), repo: Repositorio = Depends(get_repo)):
    """Pide cambiar un turno asignado. Queda `pendiente`. Un empleado solo puede pedir por sí mismo."""
    if not u.es_jefe and datos.solicitante_id != u.empleado_id:
        raise HTTPException(403, "Solo puedes pedir cambios de tus propios turnos")
    for emp_id in filter(None, (datos.solicitante_id, datos.reemplazo_id)):
        if emp_id not in repo.empleados:
            raise HTTPException(404, f"No existe el empleado {emp_id}")
    if datos.reemplazo_id == datos.solicitante_id:
        raise HTTPException(409, "El reemplazo no puede ser la misma persona que pide el cambio")
    asignados = {t["empleado_id"] for t in repo.turnos_de_servicio(datos.fecha, datos.servicio)}
    if datos.solicitante_id not in asignados:
        raise HTTPException(409, f"{datos.solicitante_id} no tiene turno el {datos.fecha} en {datos.servicio}")
    if datos.reemplazo_id and datos.reemplazo_id in asignados:
        raise HTTPException(409, f"{datos.reemplazo_id} ya trabaja en ese servicio")
    return repo.crear_solicitud(datos.model_dump(mode="json"))


@router.patch("/{solicitud_id}", response_model=SolicitudCambio, responses=ERRORES)
def resolver(
    solicitud_id: int,
    cambios: SolicitudCambioPatch,
    u: Usuario = Depends(solo_jefe),
    repo: Repositorio = Depends(get_repo),
):
    """El jefe de turno aprueba o rechaza. Solo se pueden resolver solicitudes `pendiente`."""
    s = repo.obtener_solicitud(solicitud_id)
    if s is None:
        raise HTTPException(404, f"No existe la solicitud {solicitud_id}")
    if s["estado"] != "pendiente":
        raise HTTPException(409, f"La solicitud ya está {s['estado']}")
    return repo.actualizar_solicitud(
        solicitud_id, {**cambios.model_dump(), "resuelta_por": u.empleado_id, "usuario": u.usuario}
    )
