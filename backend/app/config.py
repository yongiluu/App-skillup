"""Configuración leída desde variables de entorno / archivo .env."""

from datetime import date
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    # Orígenes permitidos para el frontend (separados por coma). 5173 = Vite por defecto.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # "Hoy" de los datos de ejemplo: los mocks cubren 2025-09-29 a 2025-11-02.
    mock_hoy: date = date(2025, 10, 17)
    # Umbrales de riesgo acordados en el README.
    umbral_alerta: float = 0.55
    umbral_alto: float = 0.75

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
