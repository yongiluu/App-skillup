"""Datos de la pestaña "Análisis del modelo" (src/data/analisis-modelo.json).

Lee los datos simulados del backend (backend/app/mocks: servicios, turnos y ausencias) y calcula,
para la ventana de la demo:
  - por nivel de riesgo, cuántos servicios terminaron con déficit;
  - la calibración por tramos de probabilidad;
  - la dotación predicha contra la requerida (regresión lineal y R²).
Déficit observado = vinieron menos personas que las requeridas (programados − ausentes ese día).
La validación oficial (AUC en datos de prueba) viene de docs/simulacion-demo.md.
No agrega variables: usa solo campos que ya existen en los datos.

Uso (desde frontend/):  python scripts/analisis_modelo.py
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from statistics import mean

RAIZ = Path(__file__).resolve().parents[2]
MOCKS = RAIZ / "backend" / "app" / "mocks"
SALIDA = Path(__file__).resolve().parents[1] / "src" / "data" / "analisis-modelo.json"

# Validación oficial del clasificador (docs/simulacion-demo.md, simulación v3)
AUC_OFICIAL = {"calibrado": 0.71, "xgboost": 0.73}
UMBRAL_ALERTA, UMBRAL_ALTO = 0.55, 0.75
TRAMOS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.55), (0.55, 0.75), (0.75, 1.0001)]


def cargar(nombre: str):
    return json.loads((MOCKS / f"{nombre}.json").read_text(encoding="utf-8"))


def main() -> None:
    servicios, turnos, ausencias = cargar("servicios"), cargar("turnos"), cargar("ausencias")
    ausentes = defaultdict(set)
    for a in ausencias:
        ausentes[a["fecha"]].add(a["empleado_id"])
    programados = defaultdict(set)
    for t in turnos:
        programados[(t["fecha"], t["servicio"])].add(t["empleado_id"])

    filas = []
    for s in servicios:
        p = programados[(s["fecha"], s["servicio"])]
        vienen = len(p) - len(p & ausentes[s["fecha"]])
        filas.append({"prob": s["prob_deficit"], "deficit": vienen < s["requeridos"],
                      "predicha": s["dotacion_predicha"], "requeridos": s["requeridos"]})

    def nivel(p: float) -> str:
        return "alto" if p >= UMBRAL_ALTO else "alerta" if p >= UMBRAL_ALERTA else "bajo"

    niveles = []
    for n in ("bajo", "alerta", "alto"):
        g = [f for f in filas if nivel(f["prob"]) == n]
        niveles.append({"nivel": n, "servicios": len(g), "con_deficit": sum(f["deficit"] for f in g)})

    calibracion = []
    for lo, hi in TRAMOS:
        g = [f for f in filas if lo <= f["prob"] < hi]
        if g:
            calibracion.append({"desde": lo, "hasta": min(hi, 1.0), "servicios": len(g),
                                "prob_media": round(mean(f["prob"] for f in g), 3),
                                "con_deficit": round(sum(f["deficit"] for f in g) / len(g), 3)})

    x = [f["predicha"] for f in filas]
    y = [f["requeridos"] for f in filas]
    mx, my = mean(x), mean(y)
    b = sum((a - mx) * (c - my) for a, c in zip(x, y)) / sum((a - mx) ** 2 for a in x)
    a0 = my - b * mx
    r2 = 1 - sum((c - (a0 + b * a)) ** 2 for a, c in zip(x, y)) / sum((c - my) ** 2 for c in y)

    fechas = sorted({s["fecha"] for s in servicios})
    datos = {
        "ventana": {"desde": fechas[0], "hasta": fechas[-1], "servicios": len(filas)},
        "auc_oficial": AUC_OFICIAL,
        "niveles": niveles,
        "calibracion": calibracion,
        "regresion": {"pendiente": round(b, 3), "intercepto": round(a0, 3), "r2": round(r2, 3),
                      "puntos": [[f["predicha"], f["requeridos"]] for f in filas]},
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Listo: {SALIDA.relative_to(RAIZ)} ({len(filas)} servicios)")


if __name__ == "__main__":
    main()
