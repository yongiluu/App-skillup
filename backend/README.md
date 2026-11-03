# SkillUp · Backend (FastAPI)

API REST de SkillUp. **Etapa 1:** todos los endpoints del contrato responden **datos de ejemplo**. Todavía no hay conexión a la base de datos, pero el **login y los permisos ya son reales** (ver [Seguridad](#seguridad)).

## Levantarlo en local

Requisitos: Python 3.10 o superior (probado en 3.13 y 3.14).

```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env        # en macOS/Linux: cp .env.example .env
# Abre .env y ponle un valor a DEMO_PASSWORD (y idealmente a SECRET_KEY)
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Documentación interactiva: http://localhost:8000/docs
  1. `POST /auth/login` con `{"usuario": "jefe", "password": "<tu DEMO_PASSWORD>"}`
  2. Copia el `access_token`, aprieta **Authorize** (arriba a la derecha) y pégalo.
  3. Ya puedes probar los demás endpoints.
- Pruebas: `pytest` (60 pruebas, 33 de ellas de seguridad)

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

Todos exigen la cabecera `Authorization: Bearer <token>`, salvo `/auth/login` y `/health`.

| Método | Ruta | Quién | Notas |
|---|---|---|---|
| `POST` | `/auth/login` | Todos | Usuarios de prueba `jefe` y `empleado`, con la contraseña de `DEMO_PASSWORD`. Devuelve el token, el perfil y `expira_en` |
| `GET` | `/servicios?fecha=` | Jefe | El día con sus 4 servicios |
| `GET` | `/semana?inicio=` | Jefe | 7 días × 4 servicios. Si se omite `inicio`, usa el lunes de "hoy" |
| `GET` | `/calendario?mes=YYYY-MM` | Todos | Ventana de pago, feriados, vísperas y eventos por día |
| `GET` | `/sugerencias?fecha=` | Jefe | Acciones "mover" o "llamar" para los roles críticos en riesgo |
| `GET` | `/empleados?rol=` | Todos | Solo datos básicos (sirven para elegir reemplazo) |
| `GET` | `/empleados/{id}` | Jefe, o la misma persona | Ficha completa |
| `GET` | `/empleados/{id}/turnos?desde=&hasta=` | Jefe, o la misma persona | Turnos de una persona |
| `GET` | `/solicitudes-cambio?estado=` | Todos | **Nuevo.** El jefe ve todas; el empleado, solo las suyas |
| `POST` | `/solicitudes-cambio` | Todos | El empleado solo puede pedir por sí mismo. Se valida que tenga ese turno |
| `PATCH` | `/solicitudes-cambio/{id}` | Jefe | `aprobada` o `rechazada`. Queda registrado quién la resolvió (`resuelta_por`) |
| `POST` | `/eventos` | Jefe | Registra un evento. Aparece en `/calendario` |
| `GET` | `/health` | Todos | Verifica que la API está arriba. No muestra datos |

Respuestas de error: `401` sin sesión o con sesión vencida · `403` sin permiso · `404` no existe · `409` conflicto · `422` datos inválidos · `429` demasiados intentos de login.

Los errores siempre vienen como `{"detail": "mensaje en español"}`.

### Nivel de riesgo
Cada servicio trae `nivel_riesgo`, calculado con los umbrales acordados: `bajo` (< 0,55), `alerta` (≥ 0,55) y `alto` (≥ 0,75). Así el frontend no tiene que repetir esa lógica.

### Regla de sugerencias (v0)
Una misma persona nunca se sugiere para dos roles en el mismo servicio.

Para cada servicio con `prob_deficit ≥ 0,55` y cada rol crítico en riesgo:
1. **Mover:** alguien que ya trabaja en ese servicio con otro rol y está entrenado para cubrir el rol en riesgo.
2. **Llamar:** alguien libre en ese servicio y que no está ausente ese día. Primero quien tiene ese mismo rol y después los polivalentes.

En cada grupo se prioriza a quien lleva menos días seguidos trabajados. En la etapa 4 esto se combina con el modelo.

> En los datos simulados **nadie está entrenado como respaldo de cocinero de línea ni de jefe de turno**. Para esos roles la API solo puede sugerir "llamar". Hay que confirmar con la cervecería cómo se cubren en la realidad `[PENDIENTE CERVECERÍA]`.

## Seguridad

Qué está cubierto hoy (cada punto tiene su prueba en `tests/test_seguridad.py`):

- **Nadie entra sin iniciar sesión.** Sin token o con uno inválido, la API responde `401`.
- **Tokens firmados y con vencimiento** (JWT HS256, 8 horas). Si alguien cambia el perfil dentro del token (por ejemplo, de `empleado` a `jefe_turno`), la firma deja de calzar y se rechaza. Tampoco se aceptan tokens sin firma (`alg: none`).
- **Permisos por perfil.** El empleado solo ve su ficha, sus turnos y sus solicitudes, y solo puede pedir cambios por sí mismo. Aprobar solicitudes, registrar eventos y ver los datos operativos es solo del jefe de turno.
- **Contraseñas:** se guardan con hash PBKDF2-SHA256 (600.000 iteraciones y sal aleatoria) y se comparan en tiempo constante. Nunca quedan en el código ni en el repo.
- **Fuerza bruta:** tras 5 intentos fallidos, ese usuario queda bloqueado 5 minutos (`429`). El error es el mismo si el usuario no existe o si la contraseña está mal, así no se puede adivinar qué usuarios existen.
- **Ausencias:** el motivo solo dice `personal` o `salud`. El diagnóstico nunca sale de la API.
- **Entradas:** se rechazan campos que no están en el contrato, para que nadie pueda mandar `"estado": "aprobada"` en su propia solicitud. Los textos tienen largo máximo.
- **CORS** solo acepta el origen del frontend (`CORS_ORIGINS`), nunca `*`.
- **Cabeceras:** `nosniff`, `X-Frame-Options: DENY`, `no-referrer` y `Cache-Control: no-store` (que no queden datos del personal en caché). En producción se suma HSTS.
- **Producción** (`APP_ENV=production`): se apagan `/docs` y `/openapi.json`, y la API no arranca sin una `SECRET_KEY` de al menos 32 caracteres.
- **Secretos:** solo en `.env`, que está en `.gitignore`. Las dependencias se revisaron con `pip-audit` y no tienen vulnerabilidades conocidas.

**Ojo: el repositorio es público.** Nunca subas un `.env`, claves de Supabase ni datos reales de la cervecería o del personal.

**Pendiente para la etapa 3:** usuarios reales en Supabase (cada empleado con su cuenta), cambio de contraseña y cierre de sesión. Además, el bloqueo de login y las solicitudes viven en memoria: con más de un proceso (`--workers`), eso tiene que pasar a la base de datos.

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
