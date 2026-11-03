"""Configuración leída desde variables de entorno / archivo .env."""

import logging
import secrets
from datetime import date
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("skillup")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # "local" para desarrollo; "production" apaga /docs y exige SECRET_KEY.
    app_env: str = "local"
    # Orígenes permitidos para el frontend (separados por coma). 5173 = Vite por defecto.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # "Hoy" de los datos de ejemplo: los mocks cubren 2025-09-29 a 2025-11-02.
    mock_hoy: date = date(2025, 10, 17)
    # Umbrales de riesgo acordados en el README.
    umbral_alerta: float = 0.55
    umbral_alto: float = 0.75

    # --- Datos ---
    # "mock" = archivos de app/mocks (pruebas y CI). "supabase" = base de datos real.
    fuente_datos: Literal["mock", "supabase"] = "mock"
    # Cadena de conexión a Postgres (Supabase). Solo en .env, nunca en el repo.
    database_url: str = ""
    # Local (sucursal) que atiende esta API. Vacío = el primero de la tabla `local`.
    local_id: int | None = None
    # Segundos máximos esperando la base antes de responder 503 (en vez de quedarse colgada).
    db_timeout_segundos: float = 8.0

    # --- Seguridad ---
    # Clave para firmar los tokens. Nunca en el código ni en el repo.
    secret_key: str = ""
    token_minutos: int = 480  # 8 horas: dura un turno largo
    # Contraseña de los usuarios de prueba (jefe / empleado). Vacía = login deshabilitado.
    demo_password: str = ""
    # Bloqueo por intentos fallidos de login.
    login_max_intentos: int = 5
    login_bloqueo_minutos: int = 5

    @model_validator(mode="after")
    def _validar_secretos(self):
        if self.fuente_datos == "supabase" and not self.database_url:
            raise ValueError("FUENTE_DATOS=supabase requiere DATABASE_URL en .env")
        if not self.secret_key:
            if self.es_produccion:
                raise ValueError("Falta SECRET_KEY en el entorno de producción")
            # En local se genera una al arrancar: los tokens dejan de valer al reiniciar.
            self.secret_key = secrets.token_urlsafe(48)
            log.warning("SECRET_KEY vacía: se generó una temporal (solo para desarrollo local).")
        elif len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres")
        return self

    @property
    def es_produccion(self) -> bool:
        return self.app_env.lower() in {"production", "produccion", "prod"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
