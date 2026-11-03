"""Vuelve a capturar los datos simulados del frontend desde la API de Diego.

Uso (con el backend corriendo en modo mock, ver backend/README.md):
    DEMO_PASSWORD=<la del .env del backend> python scripts/capturar_mocks.py [URL_API]

URL_API por defecto: http://localhost:8000. Escribe en src/api/mocks/.
Así los mocks tienen siempre la misma forma (y los mismos datos) que la API.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

API = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
DESTINO = Path(__file__).resolve().parent.parent / "src" / "api" / "mocks"
CLAVE = os.environ.get("DEMO_PASSWORD")
if not CLAVE:
    sys.exit("Falta DEMO_PASSWORD (la misma del .env del backend).")


def pedir(ruta: str, token: str | None = None, cuerpo: dict | None = None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(API + ruta, data=datos)
    req.add_header("Accept", "application/json")
    if datos:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def login(usuario: str) -> str:
    return pedir("/auth/login", cuerpo={"usuario": usuario, "password": CLAVE})["access_token"]


def guardar(nombre: str, datos, sangria: int | None = 2) -> None:
    (DESTINO / nombre).write_text(json.dumps(datos, ensure_ascii=False, indent=sangria) + "\n", encoding="utf-8")
    print(f"  {nombre}")


jefe, empleado = login("jefe"), login("empleado")
yo = pedir("/auth/login", cuerpo={"usuario": "empleado", "password": CLAVE})["empleado_id"]

print(f"Capturando desde {API}:")
guardar("servicios.json", pedir("/servicios", jefe))
guardar("semana.json", pedir("/semana", jefe))
guardar("sugerencias.json", pedir("/sugerencias", jefe))
guardar("ausencias.json", pedir("/ausencias", jefe))
guardar("empleados.json", pedir("/empleados", jefe))

fatiga = pedir("/bienestar/fatiga", jefe)
fichas = {}
for p in fatiga:
    f = pedir(f"/empleados/{p['empleado_id']}", jefe)
    # Para no inflar el repo: máximo 5 ausencias y 5 próximos turnos por persona.
    f["ausencias"], f["proximos_turnos"] = f["ausencias"][:5], f["proximos_turnos"][:5]
    fichas[p["empleado_id"]] = f

# Único cambio a mano: RST_004 en "sin_datos", para poder ver ese caso en la ficha
# (los datos de ejemplo no traen ninguno para el "hoy" simulado).
for p in fatiga:
    if p["empleado_id"] == "RST_004":
        p["estado"], p["fatiga"] = "sin_datos", None
fichas["RST_004"]["bienestar"].update(estado="sin_datos", fatiga=None)

guardar("fatiga.json", fatiga, sangria=1)
guardar("fichas.json", fichas, sangria=None)
guardar("bienestar-propio.json", pedir(f"/empleados/{yo}/bienestar", empleado), sangria=1)
print("Listo. Revisa los cambios con git diff antes de subirlos.")
