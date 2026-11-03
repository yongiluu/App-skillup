"""Punto de entrada de la API de SkillUp.

Levantar en local:  uvicorn app.main:app --reload
Documentación:      http://localhost:8000/docs  (apagada si APP_ENV=production)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, bienestar, empleados, operacion, solicitudes

settings = get_settings()
docs = not settings.es_produccion


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    yield
    if get_settings().fuente_datos == "supabase":
        from app.repositorio_db import cerrar_pool

        cerrar_pool()  # cierra las conexiones a la base al apagar la API

app = FastAPI(
    title="SkillUp API",
    version="0.3.0",
    description=(
        "API de gestión de turnos para restaurantes.\n\n"
        "**Cómo probar:** `POST /auth/login` con `jefe` o `empleado` y la contraseña de `DEMO_PASSWORD`; "
        "copia el `access_token` y pégalo en el botón **Authorize** (arriba a la derecha).\n\n"
        f"**Fuente de datos:** `{settings.fuente_datos}`. El 'hoy' por defecto es **{settings.mock_hoy}** "
        "(los datos simulados cubren del 2025-09-29 al 2025-11-02). "
        "En modo `mock`, lo que se crea (eventos, solicitudes) vive en memoria; en modo `supabase`, se guarda en la base."
    ),
    lifespan=ciclo_de_vida,
    docs_url="/docs" if docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # nunca "*": solo el frontend conocido
    allow_credentials=False,  # el token va en la cabecera Authorization, no en cookies
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def cabeceras_de_seguridad(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path not in ("/docs", "/openapi.json"):
        resp.headers.setdefault("Cache-Control", "no-store")  # no guardar datos del personal en caché
    if settings.es_produccion:
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return resp


app.include_router(auth.router)
app.include_router(operacion.router)
app.include_router(empleados.router)
app.include_router(solicitudes.router)
app.include_router(bienestar.router)


@app.get("/health", tags=["sistema"])
def health() -> dict:
    """Para verificar que la API está arriba (no requiere sesión ni expone datos)."""
    return {"estado": "ok"}
