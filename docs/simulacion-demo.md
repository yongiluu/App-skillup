# Datos simulados para la demo (v2)

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

Otros cambios en los datos: 80 empleados, 15 sin consentimiento (antes 13 de 72) y 5 ausencias el 17-10. Los usuarios demo no cambian: `jefe` = RST_055 (Catalina Flores) y `empleado` = RST_001 (Agustín Díaz).

## Cómo reproducirlo
En una copia del proyecto anterior (no en la original):
```bash
git apply simulacion-demo.patch          # dentro de skillup-dotacion-laboral
MARGEN_CRITICOS=1 uv run python scripts/run_pipeline.py --domain restaurant --stage full --employees 80 --days 180 --seed 42
# luego, en App-skillup/backend:
python scripts/build_mocks.py --origen <copia>/data/restaurant
```
Después: Maxi regenera la semilla (`database/seed/generar_semilla.py`) y la recarga en Supabase, y Manuel vuelve a capturar sus mocks (`frontend/scripts/capturar_mocks.py`).
