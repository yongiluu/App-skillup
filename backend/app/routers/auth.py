from fastapi import APIRouter, Depends, HTTPException

from app.repositorio import RepositorioMock, get_repo
from app.schemas import Error, LoginIn, LoginOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Etapa 1: usuarios de prueba, sin contraseña real (cualquier contraseña no vacía sirve).
# El login real (JWT + contraseñas con hash en la BD) llega en la etapa 3.
USUARIOS_DEMO = {
    "jefe": {"perfil": "jefe_turno", "empleado_id": "RST_008"},
    "empleado": {"perfil": "empleado", "empleado_id": "RST_001"},
}


@router.post("/login", response_model=LoginOut, responses={401: {"model": Error}})
def login(datos: LoginIn, repo: RepositorioMock = Depends(get_repo)) -> LoginOut:
    """Inicia sesión. **Mock**: usuarios `jefe` o `empleado`, con cualquier contraseña."""
    u = USUARIOS_DEMO.get(datos.usuario.strip().lower())
    if u is None:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    nombre = repo.empleados[u["empleado_id"]]["nombre"]
    return LoginOut(access_token=f"mock-token-{u['perfil']}", nombre=nombre, **u)
