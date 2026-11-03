from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.repositorio import Repositorio, get_repo
from app.schemas import Error, LoginIn, LoginOut
from app.seguridad import (
    USUARIOS_DEMO,
    crear_token,
    hash_demo,
    hash_password,
    limitador,
    verificar_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash de relleno: se usa cuando el usuario no existe, para que la respuesta tarde lo mismo
# y no se pueda adivinar qué usuarios existen midiendo el tiempo.
_HASH_RELLENO = hash_password("relleno-no-valido")
_CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos"


@router.post(
    "/login",
    response_model=LoginOut,
    responses={401: {"model": Error}, 429: {"model": Error}, 503: {"model": Error}},
)
def login(datos: LoginIn, repo: Repositorio = Depends(get_repo)) -> LoginOut:
    """Inicia sesión y devuelve un token. Usuarios de prueba: `jefe` y `empleado`,
    con la contraseña definida en `DEMO_PASSWORD` (.env)."""
    guardado = hash_demo()
    if guardado is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login deshabilitado: falta DEMO_PASSWORD en .env")

    nombre_usuario = datos.usuario.strip().lower()
    espera = limitador.bloqueado(nombre_usuario)
    if espera:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Demasiados intentos fallidos. Intenta de nuevo en {espera} segundos.",
            headers={"Retry-After": str(espera)},
        )

    u = USUARIOS_DEMO.get(nombre_usuario)
    ok = verificar_password(datos.password, guardado if u else _HASH_RELLENO)
    if u is None or not ok:
        limitador.registrar_fallo(nombre_usuario)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _CREDENCIALES_INVALIDAS)

    limitador.limpiar(nombre_usuario)
    token, expira = crear_token(nombre_usuario, u["perfil"], u["empleado_id"])
    return LoginOut(
        access_token=token,
        expira_en=expira,
        hoy=get_settings().mock_hoy,
        perfil=u["perfil"],
        empleado_id=u["empleado_id"],
        nombre=repo.empleados.get(u["empleado_id"], {}).get("nombre", nombre_usuario),
    )
