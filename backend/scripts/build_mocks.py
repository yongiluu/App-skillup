"""Genera los datos de ejemplo (app/mocks/*.json) a partir del proyecto anterior.

Lee los CSV simulados de `skillup-dotacion-laboral/data/restaurant/` y escribe JSON
pequeños con la forma del contrato de la API. Solo hace falta correrlo si se quieren
regenerar los mocks; los JSON ya vienen versionados en el repo.

Uso:
    python scripts/build_mocks.py --origen ../../skillup-dotacion-laboral-main/data/restaurant

Notas:
- Ventana de datos: 5 semanas completas (lunes 2025-09-29 a domingo 2025-11-02).
- Los nombres de empleados son ficticios (el proyecto anterior solo tiene IDs).
- Se descartan a propósito las variables excluidas en la matriz de variables
  (género, IMC, hijos, tabaquismo, consumo de alcohol, edad) y la biometría.
- El motivo de ausencia se reduce a "personal" o "salud": nunca se expone el diagnóstico.
- Los eventos son simulados a partir de `local_event_flag` / `promo_flag`
  [PENDIENTE CERVECERÍA].
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import pandas as pd

INICIO = "2025-09-29"
FIN = "2025-11-02"
CRITICOS = ["garzon", "cocinero_linea", "jefe_turno"]
DESTINO = Path(__file__).resolve().parent.parent / "app" / "mocks"

NOMBRES = [
    "Camila", "Valentina", "Javiera", "Fernanda", "Constanza", "Catalina", "Francisca",
    "Antonia", "Isidora", "Josefa", "Daniela", "Paula", "Martina", "Ignacia", "Florencia",
    "Benjamín", "Matías", "Vicente", "Tomás", "Joaquín", "Agustín", "Sebastián", "Nicolás",
    "Cristóbal", "Felipe", "Ignacio", "Diego", "Martín", "Lucas", "Gaspar", "Bastián",
]
APELLIDOS = [
    "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva",
    "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández",
    "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes",
    "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández",
]


def _bool(v) -> bool:
    return str(v).strip().lower() in {"true", "1"}


def construir(origen: Path) -> None:
    raw, proc = origen / "raw", origen / "processed"
    pred = pd.read_csv(proc / "restaurant_staffing_predictions.csv")
    dem = pd.read_csv(raw / "restaurant_demand.csv")
    cal = pd.read_csv(raw / "restaurant_calendar_cl.csv")
    emp = pd.read_csv(raw / "restaurant_employees.csv")
    wr = pd.read_csv(raw / "restaurant_work_records.csv")
    aus = pd.read_csv(raw / "restaurant_absenteeism.csv")

    en_rango = lambda df: df[(df["date"] >= INICIO) & (df["date"] <= FIN)]  # noqa: E731

    # --- servicios -----------------------------------------------------------
    p = en_rango(pred).merge(
        dem[["date", "service_period", "walk_in_ratio", "promo_flag", "local_event_flag"]],
        on=["date", "service_period"],
        how="left",
    )
    servicios = []
    for r in p.sort_values(["date", "service_period"]).itertuples():
        servicios.append(
            {
                "fecha": r.date,
                "servicio": r.service_period,
                "requeridos": int(r.required_headcount_total),
                "asignados": int(r.actual_headcount_total),
                "dotacion_predicha": round(float(r.predicted_headcount_total), 2),
                "cubiertos_previstos": int(r.forecast_covers),
                "reservas": int(r.reservation_count),
                "pedidos_delivery": int(r.delivery_order_volume),
                "ratio_sin_reserva": round(float(r.walk_in_ratio), 2),
                "prob_deficit": round(float(r.predicted_deficit_probability), 3),
                "prob_por_rol": {
                    rol: round(float(getattr(r, f"predicted_role_deficit_prob_{rol}")), 3)
                    for rol in CRITICOS
                },
                "recomendacion": r.recommended_action,
                "promo": _bool(r.promo_flag),
                "evento_local": _bool(r.local_event_flag),
            }
        )

    # --- calendario (todo el rango simulado: jul-dic 2025) --------------------
    calendario = [
        {
            "fecha": r.date,
            "feriado": r.holiday_name if _bool(r.is_holiday) and isinstance(r.holiday_name, str) else None,
            "es_vispera_feriado": _bool(r.is_holiday_eve),
            "es_ventana_pago": _bool(r.is_payday_window),
            "es_fin_de_semana_largo": _bool(r.is_long_weekend),
        }
        for r in cal.sort_values("date").itertuples()
    ]

    # --- eventos simulados -----------------------------------------------------
    eventos, n = [], 0
    for (fecha, sub) in p.groupby("date"):
        for flag, nombre, tipo in (
            ("local_event_flag", "Evento local cercano (simulado)", "evento_local"),
            ("promo_flag", "Promoción / Happy Hour (simulado)", "promocion"),
        ):
            franjas = sorted(sub.loc[sub[flag].map(_bool), "service_period"].tolist())
            if franjas:
                n += 1
                eventos.append(
                    {
                        "id": n,
                        "fecha": fecha,
                        "nombre": nombre,
                        "tipo": tipo,
                        "servicios": franjas,
                        "impacto_esperado": "medio",
                        "notas": "[PENDIENTE CERVECERÍA] Evento simulado a partir de los datos de ejemplo.",
                    }
                )

    # --- empleados -------------------------------------------------------------
    rnd = random.Random(42)
    usados: set[str] = set()
    empleados = []
    for r in emp.sort_values("employee_id").itertuples():
        while True:
            nombre = f"{rnd.choice(NOMBRES)} {rnd.choice(APELLIDOS)}"
            if nombre not in usados:
                usados.add(nombre)
                break
        polivalente = _bool(r.cross_trained)
        respaldo = r.backup_role if isinstance(r.backup_role, str) else None
        empleados.append(
            {
                "id": r.employee_id,
                "nombre": nombre,
                "rol": r.role,
                "rol_respaldo": respaldo,
                "polivalente": polivalente,
                "puede_cubrir": [respaldo] if polivalente and respaldo else [],
                "antiguedad_anos": int(r.seniority_years),
                "tipo_contrato": r.contract_type,
                "preferencia_turno": r.shift_preference,
                "distancia_trabajo_km": round(float(r.distance_to_work_km), 1),
            }
        )

    # --- turnos y ausencias --------------------------------------------------------
    w = en_rango(wr).sort_values(["date", "service_period", "employee_id"])
    turnos = [
        {
            "empleado_id": r.employee_id,
            "fecha": r.date,
            "servicio": r.service_period,
            "rol": r.role_assigned,
            "horas_programadas": float(r.scheduled_hours),
            "horas_extra": float(r.overtime_hours),
            "dias_seguidos": int(r.consecutive_work_days),
        }
        for r in w.itertuples()
    ]
    a = en_rango(aus).sort_values(["date", "employee_id"])
    ausencias = [
        {
            "empleado_id": r.employee_id,
            "fecha": r.date,
            # Nunca el diagnóstico: solo "personal" o "salud" (como una licencia médica).
            "motivo": "personal" if "personal" in str(r.absence_reason) else "salud",
            "horas": float(r.absence_hours),
            "aviso_corto": _bool(r.is_short_notice),
        }
        for r in a.itertuples()
    ]

    DESTINO.mkdir(parents=True, exist_ok=True)
    salida = {
        "servicios": servicios,
        "calendario": calendario,
        "eventos": eventos,
        "empleados": empleados,
        "turnos": turnos,
        "ausencias": ausencias,
    }
    for nombre, datos in salida.items():
        ruta = DESTINO / f"{nombre}.json"
        ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{ruta.name}: {len(datos)} registros")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--origen", type=Path, required=True, help="Carpeta data/restaurant del proyecto anterior")
    construir(ap.parse_args().origen)
