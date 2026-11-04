# Datos simulados del frontend

Son respuestas reales de la API de Diego (simulación v3 con el horario de Luthier, PR #30, con `FUENTE_DATOS=mock`), capturadas con
`scripts/capturar_mocks.py`. Así tienen exactamente la misma forma y los mismos datos que la API.

| Archivo | Endpoint | Usuario |
|---|---|---|
| `servicios.json` | `GET /servicios` | jefe |
| `semanas.json` | `GET /semana?inicio=` de **todas** las semanas con datos (29-09 al 02-11) + cuál es la de "hoy" | jefe |
| `calendario.json` | `GET /calendario?mes=` de septiembre, octubre y noviembre 2025 | jefe |
| `sugerencias.json` | `GET /sugerencias` | jefe |
| `ausencias.json` | `GET /ausencias` | jefe |
| `empleados.json` | `GET /empleados` | jefe |
| `fatiga.json` | `GET /bienestar/fatiga` | jefe |
| `fichas.json` | `GET /empleados/{id}` de las 86 personas (máx. 5 ausencias y 5 próximos turnos cada una) | jefe |
| `turnos-propios.json` | `GET /empleados/RST_001/turnos` | empleado |
| `bienestar-propio.json` | `GET /empleados/RST_001/bienestar` | empleado |

Usuarios de prueba (iguales al backend): `jefe` = Catalina Flores (RST_055) y `empleado` = Cristóbal Silva (RST_056, garzón).
"Hoy" simulado: 17-10-2025.

**Único cambio a mano:** `RST_004` (Antonia Pérez) queda en estado `sin_datos` en `fatiga.json` y
`fichas.json`, para poder ver ese caso en la ficha (los datos de ejemplo no traen ninguno para el "hoy").
Todo el bienestar es **simulado**.

**Solicitudes de cambio:** no hay archivo. En modo simulado viven en memoria (parten vacías y se pierden al recargar), igual que en el backend con `FUENTE_DATOS=mock`.

## Cómo volver a capturarlos
Con el backend corriendo en modo mock (ver `backend/README.md`):

```bash
cd frontend
DEMO_PASSWORD=<la de tu backend/.env> python scripts/capturar_mocks.py http://localhost:8000
npm test
```
