# Datos simulados para la demo (v3: horario de Luthier)

## Por qué
La simulación usaba las franjas 11–13, 13–15, 19–21 y 21–23. Luthier abre de **13:00 a 01:00 de lunes a jueves** y de **13:00 a 02:00 viernes y sábado**: 11–13 queda antes de abrir y faltaba el cierre.

## Qué cambió (sobre la v2)
- **Franjas:** se saca `11_13` y se agrega **`23_cierre`**, que termina a la 01:00, o a las 02:00 viernes y sábado (3 horas de turno esos días). Las otras tres no cambian. Domingo: se asume igual que lunes a jueves `[PENDIENTE CERVECERÍA]`.
- **Demanda del cierre** (supuestos de cervecería, por validar): 30 cubiertos base, pocas reservas (6) y delivery (4), ticket de la noche, +25 % viernes y sábado, más fatiga que las otras franjas y es la franja que se alarga (horas extra).
- **Preferencia de turno:** "mediodía" = 13–15; "noche" = 19–21, 21–23 y cierre.
- **86 personas** en vez de 80. Las 80 primeras no cambian (mismos nombres y roles), así que los usuarios demo siguen siendo los mismos. Con 80, el cierre dejaba al 43 % de los servicios con faltas; con 86 queda parecido a la v2.
- El cambio está en `simulacion-demo-v3.patch`, que se aplica **después** de `simulacion-demo.patch`.

## Resultado

| | v2 | **v3 (Luthier)** |
|---|---|---|
| Servicios con déficit real | 31,5 % | **28,9 %** |
| Riesgo alto / alerta / bajo (180 días) | 8,5 / 20,1 / 71,4 % | **9,3 / 13,5 / 77,2 %** |
| Ventana de la demo (29-sep a 2-nov, 140 servicios) | 26 alto, 45 alerta, 69 bajo | **18 alto, 22 alerta, 100 bajo** |
| AUC-ROC (calibrado / XGBoost) | 0,68 / 0,71 | **0,71 / 0,73** |
| Déficit por franja | — | 13–15: 51 % · 19–21: 26 % · 21–23: 21 % · cierre: 18 % |

**Viernes 17-10 (el "hoy" de la demo):** 13–15, 19–21 y 21–23 en bajo; **cierre (23:00–02:00) en alerta por garzón**. Cristóbal (RST_056) trabaja ese día 19–21 y el cierre; Ignacia (RST_009, usuario `reemplazo`) puede cubrirlo. El sábado 18-10, 21–23 sale en alto por garzón.

Ojo, dato de la simulación: Cristóbal tiene turnos **19 días seguidos** (del 15 de octubre al 2 de noviembre). Con la regla de 6 días no aparece disponible para cubrir a nadie en esas fechas.

## Cómo reproducirlo
```bash
git apply simulacion-demo.patch simulacion-demo-v3.patch   # dentro de una copia de skillup-dotacion-laboral
MARGEN_CRITICOS=1 uv run python scripts/run_pipeline.py --domain restaurant --stage full --employees 86 --days 180 --seed 42
python scripts/build_mocks.py --origen <copia>/data/restaurant   # en App-skillup/backend
```
Después: Maxi aplica la 0005 (franjas) y recarga la semilla; Manuel cambia el tipo `Franja` y vuelve a capturar sus mocks.

---

# Versión anterior (v2)

## Por qué se regeneraron
En la primera versión la app salía casi toda en rojo: 106 de 140 servicios (76 %) en riesgo alto. **El modelo no estaba mal:** en el restaurante simulado del proyecto anterior faltó gente en el **82,6 %** de los servicios. Había 72 personas y el simulador programaba **justo** la dotación requerida, sin margen, así que cualquier ausencia ya dejaba al servicio con déficit.

No se cambiaron los umbrales (alerta ≥ 0,55, alto ≥ 0,75): eso habría escondido el problema en vez de corregir los datos.

## Qué cambió
Se volvió a generar el dominio `restaurant` del proyecto anterior (`skillup-dotacion-laboral`) con dos ajustes que hacen la simulación más realista:

1. **80 personas** en vez de 72. Las primeras 72 son las mismas (mismos nombres y roles); se agregan 8.
2. **Margen de programación:** +1 garzón y +1 cocinero de línea en todos los servicios, como haría un restaurante real para absorber ausencias. El original solo sumaba 1 en 19–21. El cambio está en `simulacion-demo.patch`.

Todo lo demás es igual: semilla 42, 180 días desde 2025-07-01, calendario de Chile, la misma demanda y el mismo modelo (XGBoost calibrado) reentrenado.

## Resultado

| | v1 (72 personas, sin margen) | v2 (80 personas, margen +1) |
|---|---|---|
| Servicios con déficit real | 82,6 % | **31,5 %** |
| Riesgo alto (≥ 0,75), 180 días | 74,3 % | **8,5 %** |
| Riesgo alerta (0,55–0,75) | 11,8 % | 20,1 % |
| Riesgo bajo | 13,9 % | **71,4 %** |
| Ventana de la demo (29-sep a 2-nov) | 106 alto de 140 | 26 alto, 45 alerta y 69 bajo |
| AUC-ROC del clasificador (prueba) | — | 0,68 (calibrado) / 0,71 (XGBoost) |

El AUC baja respecto a la v1 porque ahora el problema es de verdad: antes casi todo era déficit y era fácil "acertar". Con datos reales de la cervecería hay que volver a entrenar.

**Viernes 17-10 (el "hoy" de la demo):** 11–13 bajo, 13–15 **alto** (falta la jefa de turno programada, Javiera Espinoza, ausente por salud → la app sugiere llamar a otro jefe), 19–21 bajo y 21–23 **alto** (garzón).

Otros cambios en los datos: 80 empleados, 15 sin consentimiento (antes 13 de 72) y 5 ausencias el 17-10. Usuarios demo: `jefe` = RST_055 (Catalina Flores) y `empleado` = **RST_056 (Cristóbal Silva, garzón)**. Antes, el empleado era RST_001 (Agustín Díaz), pero con la v2 no tiene turno el 17-10. Cristóbal trabaja ese día de 19 a 21 y de 21 a 23 (el servicio en alto por garzón), así que en la demo puede pedir un cambio justo ahí.

## Cómo reproducirlo
En una copia del proyecto anterior (no en la original):
```bash
git apply simulacion-demo.patch          # dentro de skillup-dotacion-laboral
MARGEN_CRITICOS=1 uv run python scripts/run_pipeline.py --domain restaurant --stage full --employees 80 --days 180 --seed 42
# luego, en App-skillup/backend:
python scripts/build_mocks.py --origen <copia>/data/restaurant
```
Después: Maxi regenera la semilla (`database/seed/generar_semilla.py`) y la recarga en Supabase, y Manuel vuelve a capturar sus mocks (`frontend/scripts/capturar_mocks.py`).
