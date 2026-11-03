"""Punto de entrada de la API de SkillUp.

Levantar en local:  uvicorn app.main:app --reload
Documentación:      http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, empleados, operacion, solicitudes

settings = get_settings()

app = FastAPI(
    title="SkillUp API",
    version="0.1.0",
    description=(
        "API de gestión de turnos para restaurantes.\n\n"
        "**Etapa 1:** todas las respuestas salen de datos de ejemplo (`app/mocks/`). "
        f"El 'hoy' de los mocks es **{settings.mock_hoy}** y los servicios cubren "
        "del 2025-09-29 al 2025-11-02. Lo que se crea (eventos, solicitudes) vive en memoria."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(operacion.router)
app.include_router(empleados.router)
app.include_router(solicitudes.router)


@app.get("/health", tags=["sistema"])
def health() -> dict:
    """Para verificar que la API está arriba."""
    return {"estado": "ok", "entorno": settings.app_env, "datos": "mock", "hoy_mock": settings.mock_hoy}
