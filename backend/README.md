# SkillUp · Backend (FastAPI)

API REST de SkillUp. **Etapa 1:** todos los endpoints del contrato responden **datos de ejemplo**. Todavía no hay conexión a la base de datos.

## Levantarlo en local

Requisitos: Python 3.10 o superior (probado en 3.13 y 3.14).

```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env        # en macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Documentación interactiva (probar cada endpoint): http://localhost:8000/docs
- Pruebas: `pytest`

## Datos de ejemplo

- Vienen del proyecto anterior (`skillup-dotacion-laboral`, dominio `restaurant`) y están en `app/mocks/*.json`.
- **Rango:** servicios y turnos del lunes **2025-09-29** al domingo **2025-11-02** (5 semanas). El calendario cubre de julio a diciembre de 2025.
- **"Hoy" = 2025-10-17** (viernes), configurable con `MOCK_HOY` en `.env`. Si no se manda `fecha`, `inicio` o `mes`, se usa este día.
- Fuera del rango, la API responde `404` con el rango disponible.
- Los nombres de los empleados son **ficticios**.
- Los eventos son simulados `[PENDIENTE CERVECERÍA]`.
- Lo que se crea con `POST` o `PATCH` (eventos y solicitudes) **vive en memoria** y se pierde al reiniciar.
- Para regenerar los mocks: `python scripts/build_mocks.py --origen <ruta>/skillup-dotacion-laboral-main/data/restaurant`

**Privacidad:** las variables descartadas en la matriz de variables (IMC, género, hijos, tabaquismo, nivel educacional) no se exponen. La biometría y los test aparecen como `bienestar.estado = "pendiente"`.

## Endpoints

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/auth/login` | **Mock:** usuarios `jefe` y `empleado`, con cualquier contraseña no vacía. Devuelve un token falso. |
| `GET` | `/servicios?fecha=` | El día con sus 4 servicios (ver cambio de contrato abajo) |
| `GET` | `/semana?inicio=` | 7 días × 4 servicios. Si se omite `inicio`, usa el lunes de "hoy" |
| `GET` | `/calendario?mes=YYYY-MM` | Ventana de pago, feriados, vísperas y eventos por día |
| `GET` | `/sugerencias?fecha=` | Acciones "mover" o "llamar" para los roles críticos en riesgo |
| `GET` | `/empleados?rol=` · `/empleados/{id}` | Lista y ficha |
| `GET` | `/empleados/{id}/turnos?desde=&hasta=` | Turnos de una persona |
| `POST` | `/solicitudes-cambio` | Valida que el solicitante tenga ese turno. Queda `pendiente` |
| `PATCH` | `/solicitudes-cambio/{id}` | `aprobada` o `rechazada`. Solo se resuelven las pendientes |
| `POST` | `/eventos` | Registra un evento. Aparece en `/calendario` |
| `GET` | `/health` | Verifica que la API está arriba (no es parte del contrato) |

Los errores siempre vienen como `{"detail": "mensaje en español"}`.

### Nivel de riesgo
Cada servicio trae `nivel_riesgo`, calculado con los umbrales acordados: `bajo` (< 0,55), `alerta` (≥ 0,55) y `alto` (≥ 0,75). Así el frontend no tiene que repetir esa lógica.

### Regla de sugerencias (v0)
Para cada servicio con `prob_deficit ≥ 0,55` y cada rol crítico en riesgo:
1. **Mover:** alguien que ya trabaja en ese servicio con otro rol y está entrenado para cubrir el rol en riesgo.
2. **Llamar:** alguien libre en ese servicio y que no está ausente ese día. Primero quien tiene ese mismo rol y después los polivalentes.

En cada grupo se prioriza a quien lleva menos días seguidos trabajados. En la etapa 4 esto se combina con el modelo.

> En los datos simulados **nadie está entrenado como respaldo de cocinero de línea ni de jefe de turno**. Para esos roles la API solo puede sugerir "llamar". Hay que confirmar con la cervecería cómo se cubren en la realidad `[PENDIENTE CERVECERÍA]`.

## ⚠️ Cambio de contrato: `GET /servicios`

El README mostraba un solo servicio, pero un día tiene cuatro. Ahora responde así:

```json
{
  "fecha": "2025-10-17",
  "calendario": { "dia_semana": "viernes", "es_viernes": true, "es_ventana_pago": false, "feriado": null, "eventos": [] },
  "servicios": [
    {
      "fecha": "2025-10-17", "servicio": "13_15", "horario": "13:00–15:00",
      "requeridos": 23, "asignados": 21, "dotacion_predicha": 20.83,
      "cubiertos_previstos": 91, "reservas": 37, "pedidos_delivery": 14,
      "prob_deficit": 0.968, "nivel_riesgo": "alto",
      "prob_por_rol": { "garzon": 0.232, "cocinero_linea": 0.318, "jefe_turno": 0.005 },
      "recomendacion": "Activar reemplazo inmediato y reforzar cocinero_linea para la franja 13_15"
    }
  ]
}
```

Cada elemento de `servicios` conserva los campos del ejemplo original y suma `horario`, `dotacion_predicha`, `reservas`, `pedidos_delivery` y `nivel_riesgo`. **Frontend:** tus mocks deben usar esta forma.

## Estructura

```
backend/
├── app/
│   ├── main.py          # crea la app, CORS y routers
│   ├── config.py        # variables de entorno (.env)
│   ├── schemas.py       # contrato: modelos de entrada/salida (Pydantic)
│   ├── repositorio.py   # acceso a datos (hoy JSON en memoria; en la etapa 2, Supabase)
│   ├── logica.py        # nivel de riesgo, sugerencias, ficha
│   ├── routers/         # un archivo por grupo de endpoints
│   └── mocks/           # datos de ejemplo
├── scripts/build_mocks.py
└── tests/test_api.py
```

**Etapa 2:** basta con reemplazar `RepositorioMock` por un repositorio que consulte Supabase y mantenga los mismos métodos. Los routers y los schemas no cambian.
