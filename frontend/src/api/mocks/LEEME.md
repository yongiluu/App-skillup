# Datos simulados del frontend

Son respuestas reales de la API de ejemplo de Diego, capturadas con el backend corriendo:

| Archivo | Endpoint | Rama del backend |
|---|---|---|
| `servicios.json`, `semana.json`, `sugerencias.json`, `empleados.json` | `/servicios`, `/semana`, `/sugerencias`, `/empleados` | `backend/etapa-1-api-mock` |
| `fatiga.json` | `GET /bienestar/fatiga` | `backend/biometria-simulada` |
| `fichas.json` | `GET /empleados/{id}` (de los 72, con máx. 5 ausencias y 5 próximos turnos) | `backend/biometria-simulada` |
| `ausencias.json` | **[PROPUESTA]** `GET /ausencias?fecha=` (aún no existe) | armado con `ausencias.json`, `empleados.json` y `turnos.json` de `backend/app/mocks` para el 17-10 |
| `bienestar-propio.json` | `GET /empleados/RST_001/bienestar` (usuario `empleado`) | `backend/biometria-simulada` |

**Único cambio a mano:** `RST_004` (Antonia Pérez) se dejó en estado `sin_datos`, para poder ver
ese caso en la ficha. Los datos del backend no traen ninguno para el "hoy" simulado (17-10-2025).
Todo el bienestar es **simulado**.
