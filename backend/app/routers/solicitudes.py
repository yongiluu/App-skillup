from fastapi import APIRouter, Depends, HTTPException

from app.repositorio import RepositorioMock, get_repo
from app.schemas import Error, SolicitudCambio, SolicitudCambioIn, SolicitudCambioPatch

router = APIRouter(prefix="/solicitudes-cambio", tags=["solicitudes de cambio"])


@router.post(
    "",
    response_model=SolicitudCambio,
    status_code=201,
    responses={404: {"model": Error}, 409: {"model": Error}},
)
def crear(datos: SolicitudCambioIn, repo: RepositorioMock = Depends(get_repo)):
    """Un empleado pide cambiar un turno que tiene asignado. Queda `pendiente`.
    **Mock**: se guarda en memoria."""
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


@router.patch(
    "/{solicitud_id}",
    response_model=SolicitudCambio,
    responses={404: {"model": Error}, 409: {"model": Error}},
)
def resolver(solicitud_id: int, cambios: SolicitudCambioPatch, repo: RepositorioMock = Depends(get_repo)):
    """El jefe de turno aprueba o rechaza. Solo se pueden resolver solicitudes `pendiente`.
    (En la etapa 3 este endpoint exigirá el perfil `jefe_turno`.)"""
    s = repo.solicitudes.get(solicitud_id)
    if s is None:
        raise HTTPException(404, f"No existe la solicitud {solicitud_id}")
    if s["estado"] != "pendiente":
        raise HTTPException(409, f"La solicitud ya está {s['estado']}")
    return repo.actualizar_solicitud(solicitud_id, cambios.model_dump())
