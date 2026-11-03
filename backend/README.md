# SkillUp · Backend (FastAPI)

API REST de SkillUp. **Etapa 2:** la API lee y escribe en la base de datos de Supabase (esquema de Maxi) o, para pruebas, en los datos de ejemplo. Se elige con `FUENTE_DATOS` (ver [Fuente de datos](#fuente-de-datos)). El **login y los permisos ya son reales** (ver [Seguridad](#seguridad)).

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
- Pruebas: `pytest` → 82 pruebas con los mocks (incluye seguridad y bienestar), más 29 de integración con Postgres si defines `TEST_DATABASE_URL` (ver abajo).

## Fuente de datos

| `FUENTE_DATOS` | De dónde lee | Para qué |
|---|---|---|
| `mock` (por defecto) | `app/mocks/*.json`, en memoria | Pruebas, CI y demo sin base de datos |
| `supabase` | Postgres de Supabase (`DATABASE_URL`) | El prototipo real |

Para usar Supabase, en tu `backend\.env`:
```
FUENTE_DATOS=supabase
DATABASE_URL=postgresql://postgres.<proyecto>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres
```
Usa la conexión **Session pooler** (Supabase → botón **Connect** → *Session pooler* → URI). La conexión directa (`db.<proyecto>.supabase.co`) solo funciona con IPv6 y falla en muchas redes de casa o de la universidad.

Si la base no responde, la API contesta `503` con un mensaje claro en pocos segundos (`DB_TIMEOUT_SEGUNDOS`, por defecto 8), en vez de quedarse colgada.
`DATABASE_URL` va **solo** en `.env`, que Git ignora. Nunca en el código, un PR o un issue: el repo es público.

Los dos modos tienen los mismos métodos (`app/repositorio.py` y `app/repositorio_db.py`), así que los routers no cambian. En modo `supabase`:

- Se crea un repositorio por request con una conexión del pool (máximo 5), y lo que ya se leyó en ese request se reutiliza.
- **`asignados` = turnos programados** del servicio, igual que en los mocks.
- **`puede_cubrir`** = `empleado_rol` (sin el rol principal) + `rol_respaldo`.
- **Días seguidos y horas extra** se calculan desde las fechas de los turnos.
- **Servicios sin fila en `prediccion` no se muestran** (no hay probabilidad que dar).
- **Consentimiento vigente** = fila en `sensible.consentimiento` con `tipo = 'bienestar'` y `revocado_en` nulo. Los datos de bienestar se leen solo para quien lo tiene (se usa `sensible.tiene_consentimiento`).
- **Accesos a bienestar** quedan en `sensible.registro_acceso` (la tabla de Maxi no permite borrar ni editar).
- **`resuelta_por`** en la tabla es un `usuario.id`; la API muestra el `empleado_id` de ese usuario. Si el jefe que resuelve no tiene fila en `usuario`, queda vacío.
- La conexión usa el usuario `postgres`, que se salta RLS. Sirve para el prototipo; en producción hay que usar un rol con permisos mínimos (ver pendientes).

### Pruebas de integración con Postgres
`tests/test_bd.py` aplica en una base **local y descartable** las migraciones oficiales de Maxi (`database/migrations/*.sql`), carga los mocks con `scripts/cargar_mocks_en_bd.py` y verifica que la API responda **exactamente igual** que en modo mock: las 80 fichas, servicios, sugerencias, fatiga, ausencias, semana y calendario. Los mocks se generan para que coincidan con la base: sin turnos repetidos, `asignados` = turnos programados, dotación con 1 decimal y días seguidos calculados desde los turnos.

```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/skillup_test pytest
```
Si `TEST_DATABASE_URL` no está definida, esas pruebas se saltan. La prueba se niega a correr contra un host que no sea local.

`scripts/cargar_mocks_en_bd.py` también se niega a escribir en un host remoto salvo con `--permitir-remoto`. Cargar la semilla en Supabase le toca a base de datos (Maxi).

## Datos de ejemplo

> **Versión 2 de la simulación** (80 personas, con margen de programación): faltas en el 31,5 % de los servicios y no en el 82,6 %. Detalle y forma de reproducirla en [`docs/simulacion-demo.md`](../docs/simulacion-demo.md).

- Vienen del proyecto anterior (`skillup-dotacion-laboral`, dominio `restaurant`) y están en `app/mocks/*.json`.
- **Rango:** servicios y turnos del lunes **2025-09-29** al domingo **2025-11-02** (5 semanas). El calendario cubre de julio a diciembre de 2025.
- **"Hoy" = 2025-10-17** (viernes), configurable con `MOCK_HOY` en `.env`. Si no se manda `fecha`, `inicio` o `mes`, se usa este día.
- Fuera del rango, la API responde `404` con el rango disponible.
- Los nombres de los empleados son **ficticios**.
- Los eventos son simulados `[PENDIENTE CERVECERÍA]`.
- En modo `mock`, lo que se crea con `POST` o `PATCH` (eventos y solicitudes) **vive en memoria** y se pierde al reiniciar.
- Para regenerar los mocks: `python scripts/build_mocks.py --origen <ruta>/skillup-dotacion-laboral-main/data/restaurant`

**Privacidad:** las variables descartadas en la matriz de variables (IMC, género, hijos, tabaquismo, nivel educacional) no se exponen. La biometría es simulada y tiene reglas propias (ver [Bienestar](#bienestar-datos-sensibles)).

## Endpoints

Todos exigen la cabecera `Authorization: Bearer <token>`, salvo `/auth/login` y `/health`.

| Método | Ruta | Quién | Notas |
|---|---|---|---|
| `POST` | `/auth/login` | Todos | Usuarios de prueba `jefe` (RST_055, Catalina Flores) y `empleado` (RST_001), con la contraseña de `DEMO_PASSWORD`. Devuelve el token, el perfil, `expira_en` y `hoy` (la fecha de trabajo de la API) |
| `GET` | `/servicios?fecha=` | Jefe | El día con sus 4 servicios |
| `GET` | `/semana?inicio=` | Jefe | 7 días × 4 servicios. Si se omite `inicio`, usa el lunes de "hoy" |
| `GET` | `/calendario?mes=YYYY-MM` | Todos | Ventana de pago, feriados, vísperas y eventos por día |
| `GET` | `/sugerencias?fecha=` | Jefe | Acciones "mover" o "llamar" para los roles críticos en riesgo. Nunca sugiere a quien tiene la sesión iniciada |
| `GET` | `/ausencias?fecha=` | Jefe | **Nuevo.** Quién falta ese día: nombre, rol, motivo (`personal`/`salud`), horas, si avisó con poca anticipación y `servicios` (las franjas en que tenía turno). Ordenado por ID. Lista vacía si nadie falta |
| `GET` | `/empleados?rol=` | Todos | Solo datos básicos (sirven para elegir reemplazo) |
| `GET` | `/empleados/{id}` | Jefe, o la misma persona | Ficha completa |
| `GET` | `/empleados/{id}/turnos?desde=&hasta=` | Jefe, o la misma persona | Turnos de una persona |
| `GET` | `/solicitudes-cambio?estado=` | Todos | **Nuevo.** El jefe ve todas; el empleado, solo las suyas |
| `POST` | `/solicitudes-cambio` | Todos | El empleado solo puede pedir por sí mismo. Se valida que tenga ese turno |
| `PATCH` | `/solicitudes-cambio/{id}` | Jefe | `aprobada` o `rechazada`. Queda registrado quién la resolvió (`resuelta_por`) |
| `POST` | `/eventos` | Jefe | Registra un evento. Aparece en `/calendario` |
| `GET` | `/bienestar/fatiga?fecha=` | Jefe | **Nuevo.** Indicador de fatiga de cada persona: solo nivel y motivos |
| `GET` | `/empleados/{id}/bienestar?desde=&hasta=` | **Solo la misma persona** | **Nuevo.** Datos crudos propios: pasos, sueño, pulso y encuesta. El jefe recibe `403` |
| `GET` | `/bienestar/preguntas` | Todos | **Nuevo.** Preguntas propuestas para los tests (estado `pendiente`) |
| `GET` | `/health` | Todos | Verifica que la API está arriba. No muestra datos |

Respuestas de error: `401` sin sesión o con sesión vencida · `403` sin permiso · `404` no existe · `409` conflicto · `422` datos inválidos · `429` demasiados intentos de login.

Los errores siempre vienen como `{"detail": "mensaje en español"}`.

### Nivel de riesgo
Cada servicio trae `nivel_riesgo`, calculado con los umbrales acordados: `bajo` (< 0,55), `alerta` (≥ 0,55) y `alto` (≥ 0,75). Así el frontend no tiene que repetir esa lógica.

### Recomendación en lenguaje normal
El modelo guarda frases técnicas ("Activar reemplazo inmediato y reforzar garzon para la franja 13_15"). La API las traduce al mostrarlas: "Riesgo alto: busca reemplazo ya y refuerza garzón de 13:00–15:00." Si aparece una frase que no reconoce, la deja igual. En la base queda el texto original.

### Regla de sugerencias (v0)
Una misma persona nunca se sugiere para dos roles en el mismo servicio.

Para cada servicio con `prob_deficit ≥ 0,55` y cada rol crítico en riesgo:
1. **Mover:** alguien que ya trabaja en ese servicio con otro rol y está entrenado para cubrir el rol en riesgo.
2. **Llamar:** alguien libre en ese servicio y que no está ausente ese día. Primero quien tiene ese mismo rol y después los polivalentes.

En cada grupo se prioriza a quien lleva menos días seguidos trabajados. En la etapa 4 esto se combina con el modelo.

> En los datos simulados **nadie está entrenado como respaldo de cocinero de línea ni de jefe de turno**. Para esos roles la API solo puede sugerir "llamar". Hay que confirmar con la cervecería cómo se cubren en la realidad `[PENDIENTE CERVECERÍA]`.

## Bienestar (datos sensibles)

Los datos son **simulados** y solo incluyen las variables activas de la matriz: pasos, horas de sueño, pulso medio y la encuesta de fatiga al inicio y al final del turno (escala 1–7). Del proyecto anterior se descartan a propósito `hrv`, `stress_score`, `_is_sick` y `_absence_reason`.

| Quién | Qué ve |
|---|---|
| La propia persona | Sus datos crudos y su indicador (`/empleados/{id}/bienestar`) |
| Jefe de turno | Solo el **indicador**: nivel `bajo` / `medio` / `alto` y hasta 2 motivos generales (`descanso`, `carga_fisica`, `jornada`, `autorreporte`). Aparece en la ficha y en `/bienestar/fatiga` |
| Nadie | Diagnósticos ni datos de quien no dio consentimiento |

- **Consentimiento:** cada persona tiene un registro simulado (`otorgado`, `fecha`, `version_texto`). 15 de las 80 no consintieron (por ejemplo, `RST_011`). Para ellas el estado es `sin_consentimiento` y no existen datos de bienestar, ni siquiera guardados.
- **Indicador v0** (`app/bienestar.py`): se calcula con los últimos 3 días. Cada componente va de 0 a 1:
  - descanso: menos de 5,5 h de sueño promedio = 1;
  - carga física: más de 15.000 pasos o pulso medio sobre 93 = 1;
  - autorreporte: encuesta de cierre en 6–7 = 1;
  - jornada: días seguidos trabajados y horas extra (no es dato de salud).

  Puntaje = 0,6 × el peor componente + 0,4 × el promedio. Es `alto` desde 0,60 y `medio` desde 0,35. Es una regla simple y explicable, no un modelo clínico.
- **Sugerencias:** quien tiene fatiga `alta` queda al final de la lista de candidatos. A quien no consintió no se le aplica el indicador: no se le favorece ni se le perjudica.
- **Auditoría:** cada acceso a datos de bienestar queda en el log `skillup.auditoria` (quién, qué y de quién).
- **Tests psicológicos:** siguen `pendiente`. `/bienestar/preguntas` trae **preguntas propuestas** (fatiga, somnolencia, carga del turno, descanso y apoyo del equipo), inspiradas en escalas conocidas y sin preguntas de salud mental. Antes de usarlas tiene que revisarlas un profesional y decidirlas la cervecería `[PENDIENTE CERVECERÍA]`.

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
│   ├── repositorio.py   # repositorio mock (JSON en memoria) y elección según FUENTE_DATOS
│   ├── repositorio_db.py # repositorio sobre Postgres/Supabase
│   ├── logica.py        # nivel de riesgo, sugerencias, ficha
│   ├── routers/         # un archivo por grupo de endpoints
│   └── mocks/           # datos de ejemplo
├── scripts/build_mocks.py
└── tests/test_api.py
```

**Pendientes de la etapa 3:**
- Login con la tabla `usuario`: cada persona con su cuenta y contraseña con hash (hoy, `jefe`/`empleado` con `DEMO_PASSWORD`).
- Conectarse con un rol de Postgres con permisos mínimos, en vez de `postgres`.
- Guardar en la base el bloqueo por intentos de login (hoy vive en memoria).
