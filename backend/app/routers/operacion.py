"""Servicios del día, grilla semanal, calendario, sugerencias y eventos."""

import calendar as pycal
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app import logica
from app.config import get_settings
from app.repositorio import RepositorioMock, get_repo
from app.schemas import Calendario, DiaServicios, Error, Evento, EventoIn, Semana, Sugerencia

router = APIRouter(tags=["operación"])
NO_ENCONTRADO = {404: {"model": Error}}


def _sin_datos(repo: RepositorioMock, que: str) -> HTTPException:
    ini, fin = repo.rango_servicios
    return HTTPException(404, f"Sin datos de ejemplo para {que}. Rango disponible: {ini} a {fin}.")


@router.get("/servicios", response_model=DiaServicios, responses=NO_ENCONTRADO)
def servicios_del_dia(
    fecha: date | None = Query(None, description="YYYY-MM-DD. Si se omite, usa el 'hoy' de los mocks."),
    repo: RepositorioMock = Depends(get_repo),
):
    """Los 4 servicios del día con dotación, demanda, probabilidad de déficit y nivel de riesgo."""
    fecha = fecha or get_settings().mock_hoy
    dia = logica.armar_dia_servicios(repo, fecha)
    if dia is None:
        raise _sin_datos(repo, str(fecha))
    return dia


@router.get("/semana", response_model=Semana, responses=NO_ENCONTRADO)
def semana(
    inicio: date | None = Query(None, description="Primer día (YYYY-MM-DD). Si se omite, el lunes de 'hoy'."),
    repo: RepositorioMock = Depends(get_repo),
):
    """Grilla de 7 días × 4 servicios, a partir de `inicio`."""
    if inicio is None:
        hoy = get_settings().mock_hoy
        inicio = hoy - timedelta(days=hoy.weekday())
    dias = [logica.armar_dia_servicios(repo, inicio + timedelta(days=i)) for i in range(7)]
    if any(d is None for d in dias):
        raise _sin_datos(repo, f"la semana que empieza el {inicio}")
    return {"inicio": inicio, "fin": inicio + timedelta(days=6), "dias": dias}


@router.get("/calendario", response_model=Calendario, responses={**NO_ENCONTRADO, 422: {"model": Error}})
def calendario(
    mes: str | None = Query(None, description="YYYY-MM. Si se omite, el mes de 'hoy'."),
    repo: RepositorioMock = Depends(get_repo),
):
    """Días de pago/quincenas, feriados, vísperas y eventos del mes."""
    if mes is None:
        mes = get_settings().mock_hoy.strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", mes):
        raise HTTPException(422, "El parámetro 'mes' debe tener el formato YYYY-MM")
    anio, m = map(int, mes.split("-"))
    fechas = [date(anio, m, d) for d in range(1, pycal.monthrange(anio, m)[1] + 1)]
    if not any(repo.dia_calendario(f) for f in fechas):
        fs = sorted(repo.calendario)
        raise HTTPException(404, f"Sin calendario de ejemplo para {mes}. Disponible: {fs[0][:7]} a {fs[-1][:7]}.")
    return {"mes": mes, "dias": [logica.armar_dia_calendario(repo, f) for f in fechas]}


@router.get("/sugerencias", response_model=list[Sugerencia], responses=NO_ENCONTRADO)
def sugerencias(
    fecha: date | None = Query(None, description="YYYY-MM-DD. Si se omite, usa el 'hoy' de los mocks."),
    repo: RepositorioMock = Depends(get_repo),
):
    """Acciones sugeridas de cobertura (mover o llamar) para los servicios en riesgo del día."""
    fecha = fecha or get_settings().mock_hoy
    if not repo.servicios_de(fecha):
        raise _sin_datos(repo, str(fecha))
    return logica.sugerencias(repo, fecha)


@router.post("/eventos", response_model=Evento, status_code=201)
def crear_evento(evento: EventoIn, repo: RepositorioMock = Depends(get_repo)):
    """Registra un evento de la cervecería. **Mock**: se guarda en memoria y se pierde al reiniciar."""
    return repo.crear_evento(evento.model_dump(mode="json"))
