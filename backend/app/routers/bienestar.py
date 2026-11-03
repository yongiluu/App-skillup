from datetime import date

from fastapi import APIRouter, Depends, Query

from app import bienestar
from app.config import get_settings
from app.repositorio import Repositorio, get_repo
from app.schemas import FatigaEquipo
from app.seguridad import Usuario, solo_jefe, usuario_actual

router = APIRouter(prefix="/bienestar", tags=["bienestar (datos sensibles)"], dependencies=[Depends(usuario_actual)])


@router.get("/fatiga", response_model=list[FatigaEquipo])
def fatiga_del_equipo(
    fecha: date | None = Query(None, description="YYYY-MM-DD. Si se omite, usa MOCK_HOY."),
    u: Usuario = Depends(solo_jefe),
    repo: Repositorio = Depends(get_repo),
):
    """**Solo jefe de turno.** Indicador de fatiga de cada persona: nivel y motivos generales.
    No incluye datos crudos. Quien no dio consentimiento aparece como `sin_consentimiento`."""
    fecha = fecha or get_settings().mock_hoy
    bienestar.registrar_acceso(repo, u.usuario, "fatiga_equipo")
    return [
        {"empleado_id": e["id"], "nombre": e["nombre"], "rol": e["rol"], **bienestar.resumen(repo, e["id"], fecha)}
        for e in repo.empleados.values()
    ]


@router.get("/preguntas")
def preguntas_propuestas(repo: Repositorio = Depends(get_repo)) -> dict:
    """Catálogo de preguntas **propuestas** para tests (estado `pendiente`).
    No se aplican todavía: falta la revisión de un profesional y la decisión de la cervecería."""
    return repo.preguntas_tests
