from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app import logica
from app.config import get_settings
from app.repositorio import RepositorioMock, get_repo
from app.schemas import Empleado, EmpleadoFicha, Error, Rol, Turno
from app.seguridad import Usuario, exigir_propio_o_jefe, usuario_actual

router = APIRouter(prefix="/empleados", tags=["empleados"], dependencies=[Depends(usuario_actual)])
NO_ENCONTRADO = {404: {"model": Error}}
PERMISOS = {403: {"model": Error}, 404: {"model": Error}}


@router.get("", response_model=list[Empleado])
def listar(
    rol: Rol | None = Query(None, description="Filtrar por rol"),
    repo: RepositorioMock = Depends(get_repo),
):
    """Lista del equipo (solo datos básicos; sirve también para elegir reemplazo en un cambio de turno)."""
    return [e for e in repo.empleados.values() if rol is None or e["rol"] == rol]


@router.get("/{empleado_id}", response_model=EmpleadoFicha, responses=PERMISOS)
def ficha(empleado_id: str, u: Usuario = Depends(usuario_actual), repo: RepositorioMock = Depends(get_repo)):
    """Ficha: roles que puede cubrir, días seguidos, horas extra, ausencias y próximos turnos.
    La biometría y los test aparecen como `pendiente`. Un empleado solo puede ver la suya."""
    exigir_propio_o_jefe(u, empleado_id)
    datos = logica.ficha_empleado(repo, empleado_id, get_settings().mock_hoy)
    if datos is None:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    return datos


@router.get("/{empleado_id}/turnos", response_model=list[Turno], responses=PERMISOS)
def turnos(
    empleado_id: str,
    desde: date | None = Query(None, description="YYYY-MM-DD (incluido)"),
    hasta: date | None = Query(None, description="YYYY-MM-DD (incluido)"),
    u: Usuario = Depends(usuario_actual),
    repo: RepositorioMock = Depends(get_repo),
):
    """Turnos de una persona, opcionalmente filtrados por fechas. Un empleado solo ve los suyos."""
    exigir_propio_o_jefe(u, empleado_id)
    if empleado_id not in repo.empleados:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    return [
        t for t in repo.turnos_de_empleado(empleado_id)
        if (desde is None or t["fecha"] >= desde.isoformat()) and (hasta is None or t["fecha"] <= hasta.isoformat())
    ]
