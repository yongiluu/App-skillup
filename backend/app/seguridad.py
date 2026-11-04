"""Autenticación y permisos.

- Contraseñas: se guardan como hash PBKDF2-SHA256 (biblioteca estándar) y se comparan
  en tiempo constante. Nunca se guarda ni se registra la contraseña en texto plano.
- Tokens: JWT firmado (HS256) con SECRET_KEY, con vencimiento. El frontend lo manda en
  la cabecera `Authorization: Bearer <token>`.
- Perfiles: `jefe_turno` ve todo; `empleado` solo sus propios datos.
- Fuerza bruta: tras N intentos fallidos el usuario queda bloqueado unos minutos.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

ALGORITMO = "HS256"
_ITERACIONES = 600_000

# Usuarios de prueba (etapa 1–2). En la etapa 3 salen de la tabla de usuarios en Supabase.
USUARIOS_DEMO = {
    "jefe": {"perfil": "jefe_turno", "empleado_id": "RST_055"},  # Catalina Flores: no está ausente el 17-10
    "empleado": {"perfil": "empleado", "empleado_id": "RST_056"},  # Cristóbal Silva, garzón: trabaja el 17-10 (19–21 y 21–23)
    # Ignacia Muñoz, garzón: libre y disponible para reemplazar a Cristóbal el 17-10 (19–21 y 21–23).
    # Sirve para mostrar el flujo completo: Cristóbal pide → Ignacia acepta → el jefe aprueba.
    "reemplazo": {"perfil": "empleado", "empleado_id": "RST_009"},
}


# ---------- contraseñas ----------
def hash_password(password: str, sal: bytes | None = None) -> str:
    sal = sal or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), sal, _ITERACIONES)
    return f"pbkdf2_sha256${_ITERACIONES}${sal.hex()}${dk.hex()}"


def verificar_password(password: str, guardado: str) -> bool:
    try:
        _, iteraciones, sal, esperado = guardado.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(sal), int(iteraciones))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk.hex(), esperado)


_hash_demo: dict[str, str] = {}


def hash_demo() -> str | None:
    """Hash de DEMO_PASSWORD, calculado una sola vez."""
    pw = get_settings().demo_password
    if not pw:
        return None
    if pw not in _hash_demo:
        _hash_demo.clear()
        _hash_demo[pw] = hash_password(pw)
    return _hash_demo[pw]


# ---------- bloqueo por intentos fallidos ----------
class LimitadorLogin:
    def __init__(self) -> None:
        self._fallos: dict[str, list[float]] = {}
        self._lock = Lock()

    def bloqueado(self, usuario: str) -> int:
        """Segundos que faltan para desbloquear (0 = no bloqueado)."""
        s = get_settings()
        ventana = s.login_bloqueo_minutos * 60
        ahora = time.monotonic()
        usuario = usuario[:64]
        with self._lock:
            fallos = [t for t in self._fallos.get(usuario, []) if ahora - t < ventana]
            if fallos:
                self._fallos[usuario] = fallos
            else:
                self._fallos.pop(usuario, None)
            if len(fallos) >= s.login_max_intentos:
                return int(ventana - (ahora - fallos[0])) + 1
            return 0

    def registrar_fallo(self, usuario: str) -> None:
        with self._lock:
            if len(self._fallos) > 10_000:  # evita que nombres inventados llenen la memoria
                self._fallos.clear()
            self._fallos.setdefault(usuario[:64], []).append(time.monotonic())

    def limpiar(self, usuario: str | None = None) -> None:
        with self._lock:
            if usuario is None:
                self._fallos.clear()
            else:
                self._fallos.pop(usuario, None)


limitador = LimitadorLogin()


# ---------- tokens ----------
@dataclass(frozen=True)
class Usuario:
    usuario: str
    perfil: str
    empleado_id: str

    @property
    def es_jefe(self) -> bool:
        return self.perfil == "jefe_turno"


def crear_token(usuario: str, perfil: str, empleado_id: str) -> tuple[str, int]:
    s = get_settings()
    ahora = datetime.now(timezone.utc)
    exp = ahora + timedelta(minutes=s.token_minutos)
    payload = {"sub": usuario, "perfil": perfil, "emp": empleado_id, "iat": ahora, "exp": exp}
    return jwt.encode(payload, s.secret_key, algorithm=ALGORITMO), s.token_minutos * 60


_bearer = HTTPBearer(auto_error=False)
_NO_AUTENTICADO = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sesión no válida o vencida. Inicia sesión de nuevo.",
    headers={"WWW-Authenticate": "Bearer"},
)


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Usuario:
    if cred is None or cred.scheme.lower() != "bearer":
        raise _NO_AUTENTICADO
    try:
        p = jwt.decode(
            cred.credentials,
            get_settings().secret_key,
            algorithms=[ALGORITMO],  # fijo: evita aceptar tokens "alg: none" u otros algoritmos
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        raise _NO_AUTENTICADO from None
    if p.get("sub") not in USUARIOS_DEMO or p.get("perfil") not in {"jefe_turno", "empleado"}:
        raise _NO_AUTENTICADO
    return Usuario(usuario=p["sub"], perfil=p["perfil"], empleado_id=p["emp"])


def solo_jefe(u: Usuario = Depends(usuario_actual)) -> Usuario:
    if not u.es_jefe:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el jefe de turno puede hacer esto")
    return u


def exigir_propio_o_jefe(u: Usuario, empleado_id: str) -> None:
    """Un empleado solo puede ver o tocar sus propios datos."""
    if not u.es_jefe and u.empleado_id != empleado_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puedes ver tus propios datos")
