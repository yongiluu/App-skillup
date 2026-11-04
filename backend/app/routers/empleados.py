from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app import bienestar, logica
from app.config import get_settings
from app.repositorio import Repositorio, get_repo
from app.schemas import BienestarPropio, Consentimiento, ConsentimientoIn, Empleado, EmpleadoFicha, Error, Rol, Turno
from app.seguridad import Usuario, exigir_propio_o_jefe, usuario_actual

router = APIRouter(prefix="/empleados", tags=["empleados"], dependencies=[Depends(usuario_actual)])
NO_ENCONTRADO = {404: {"model": Error}}
PERMISOS = {403: {"model": Error}, 404: {"model": Error}}


@router.get("", response_model=list[Empleado])
def listar(
    rol: Rol | None = Query(None, description="Filtrar por rol"),
    repo: Repositorio = Depends(get_repo),
):
    """Lista del equipo (solo datos básicos; sirve también para elegir reemplazo en un cambio de turno)."""
    return [e for e in repo.empleados.values() if rol is None or e["rol"] == rol]


@router.get("/{empleado_id}", response_model=EmpleadoFicha, responses=PERMISOS)
def ficha(empleado_id: str, u: Usuario = Depends(usuario_actual), repo: Repositorio = Depends(get_repo)):
    """Ficha: roles que puede cubrir, días seguidos, horas extra, ausencias y próximos turnos.
    Incluye el indicador de fatiga (nivel y motivos, nunca datos crudos). Un empleado solo ve la suya."""
    exigir_propio_o_jefe(u, empleado_id)
    datos = logica.ficha_empleado(repo, empleado_id, get_settings().mock_hoy)
    if datos is None:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    bienestar.registrar_acceso(repo, u.usuario, "ficha_indicador", empleado_id)
    return datos


@router.get("/{empleado_id}/bienestar", response_model=BienestarPropio, responses=PERMISOS)
def bienestar_propio(
    empleado_id: str,
    desde: date | None = Query(None, description="YYYY-MM-DD. Por defecto, 14 días antes de 'hasta'."),
    hasta: date | None = Query(None, description="YYYY-MM-DD. Por defecto, MOCK_HOY."),
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """**Solo la propia persona** (ni siquiera el jefe de turno): pasos, sueño, pulso y encuesta
    de fatiga, más su indicador. Sin consentimiento no devuelve registros."""
    if u.empleado_id != empleado_id:
        raise HTTPException(403, "Los datos de bienestar solo los puede ver la propia persona")
    if empleado_id not in repo.empleados:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    hasta = hasta or get_settings().mock_hoy
    desde = desde or hasta - timedelta(days=13)
    if desde > hasta:
        raise HTTPException(422, "'desde' no puede ser posterior a 'hasta'")
    bienestar.registrar_acceso(repo, u.usuario, "datos_propios", empleado_id)
    return bienestar.datos_propios(repo, empleado_id, desde, hasta)


@router.post("/{empleado_id}/consentimiento", response_model=Consentimiento, responses={**PERMISOS, 409: {"model": Error}})
def cambiar_consentimiento(
    empleado_id: str,
    datos: ConsentimientoIn,
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """**Solo la propia persona** (ni siquiera el jefe): autoriza o retira la autorización de bienestar (AP-04).

    - Al **retirarla**, desde ese momento nadie ve su indicador (el jefe ve "sin indicador") y la app
      deja de usar sus datos. El registro de la autorización no se borra (queda `revocado_en`).
    - Qué pasa con los datos ya guardados (borrarlos o conservarlos un tiempo) está
      [PENDIENTE CERVECERÍA / revisión legal]: hoy quedan guardados pero nadie los puede leer.
    - 409 si ya estaba en ese estado."""
    if u.empleado_id != empleado_id:
        raise HTTPException(403, "Solo la propia persona puede dar o retirar su autorización")
    if empleado_id not in repo.empleados:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    c = repo.cambiar_consentimiento(empleado_id, datos.acepta, bienestar.VERSION_TEXTO_CONSENTIMIENTO)
    bienestar.registrar_acceso(
        repo, u.usuario, "consentimiento_otorgado" if datos.acepta else "consentimiento_retirado", empleado_id
    )
    return c


@router.get("/{empleado_id}/turnos", response_model=list[Turno], responses=PERMISOS)
def turnos(
    empleado_id: str,
    desde: date | None = Query(None, description="YYYY-MM-DD (incluido)"),
    hasta: date | None = Query(None, description="YYYY-MM-DD (incluido)"),
    u: Usuario = Depends(usuario_actual),
    repo: Repositorio = Depends(get_repo),
):
    """Turnos de una persona, opcionalmente filtrados por fechas. Un empleado solo ve los suyos."""
    exigir_propio_o_jefe(u, empleado_id)
    if empleado_id not in repo.empleados:
        raise HTTPException(404, f"No existe el empleado {empleado_id}")
    return [
        t for t in repo.turnos_de_empleado(empleado_id)
        if (desde is None or t["fecha"] >= desde.isoformat()) and (hasta is None or t["fecha"] <= hasta.isoformat())
    ]
