"""Carga los datos de ejemplo (app/mocks/*.json) en una base Postgres con el esquema de Maxi.

Uso principal: las pruebas de integración del backend, sobre una base LOCAL y vacía.
También le puede servir a Maxi como referencia para su semilla (database/), pero la
carga en Supabase es tarea de base de datos.

    python scripts/cargar_mocks_en_bd.py postgresql://postgres@localhost:5432/skillup_test

Seguro: se niega a conectarse a un host que no sea local, salvo con --permitir-remoto.

Adaptaciones a las reglas del esquema:
- turno tiene UNIQUE (servicio_id, empleado_id): los 12 duplicados de los mocks se omiten.
- bienestar_diario exige consentimiento vigente (trigger): primero se cargan los consentimientos.
- solicitud_cambio.resuelta_por apunta a usuario: se crean los usuarios demo (jefe, empleado)
  con un hash de relleno que no sirve para entrar (el login demo usa DEMO_PASSWORD).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

import psycopg

MOCKS = Path(__file__).resolve().parent.parent / "app" / "mocks"
HOY_MOCK = date(2025, 10, 17)
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1", "", None}


def _j(nombre: str):
    return json.loads((MOCKS / f"{nombre}.json").read_text(encoding="utf-8"))


def cargar(con: psycopg.Connection) -> dict:
    cur = con.cursor()
    n: dict[str, int] = {}

    local_id = cur.execute(
        "insert into public.local (nombre, direccion) values ('Cervecería (simulada)', null) returning id"
    ).fetchone()[0]

    empleados = _j("empleados")
    for e in empleados:
        ingreso = HOY_MOCK - timedelta(days=int(e["antiguedad_anos"] * 365.25) + 30)
        cur.execute(
            """insert into public.empleado (id, local_id, nombre, rol_principal, rol_respaldo, tipo_contrato,
                                            fecha_ingreso, preferencia_turno, distancia_trabajo_km)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (e["id"], local_id, e["nombre"], e["rol"], e["rol_respaldo"], e["tipo_contrato"], ingreso,
             e["preferencia_turno"], e["distancia_trabajo_km"]),
        )
        for r in {e["rol"], *e["puede_cubrir"]}:
            cur.execute("insert into public.empleado_rol (empleado_id, rol_codigo) values (%s,%s)", (e["id"], r))
    n["empleado"] = len(empleados)

    for d in _j("calendario"):
        cur.execute(
            """insert into public.calendario_dia (fecha, es_ventana_pago, feriado, es_vispera_feriado, es_fin_de_semana_largo)
               values (%s,%s,%s,%s,%s)""",
            (d["fecha"], d["es_ventana_pago"], d["feriado"], d["es_vispera_feriado"], d["es_fin_de_semana_largo"]),
        )

    ids_servicio: dict[tuple[str, str], int] = {}
    for s in _j("servicios"):
        sid = cur.execute(
            """insert into public.servicio (local_id, fecha, franja, requeridos, cubiertos_previstos, reservas,
                                            pedidos_delivery, proporcion_sin_reserva, hay_promocion)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
            (local_id, s["fecha"], s["servicio"], s["requeridos"], s["cubiertos_previstos"], s["reservas"],
             s["pedidos_delivery"], s["ratio_sin_reserva"], s["promo"]),
        ).fetchone()[0]
        ids_servicio[(s["fecha"], s["servicio"])] = sid
        r = s["prob_por_rol"]
        cur.execute(
            """insert into public.prediccion (servicio_id, prob_deficit, prob_garzon, prob_cocinero_linea,
                                              prob_jefe_turno, dotacion_predicha, recomendacion, version_modelo)
               values (%s,%s,%s,%s,%s,%s,%s,'simulado-v0')""",
            (sid, s["prob_deficit"], r["garzon"], r["cocinero_linea"], r["jefe_turno"], s["dotacion_predicha"],
             s["recomendacion"]),
        )
    n["servicio"] = len(ids_servicio)

    vistos, omitidos = set(), 0
    for t in _j("turnos"):
        sid = ids_servicio.get((t["fecha"], t["servicio"]))
        if sid is None:
            continue
        if (sid, t["empleado_id"]) in vistos:
            omitidos += 1
            continue
        vistos.add((sid, t["empleado_id"]))
        cur.execute(
            """insert into public.turno (servicio_id, empleado_id, rol_codigo, horas_programadas, horas_extra)
               values (%s,%s,%s,%s,%s)""",
            (sid, t["empleado_id"], t["rol"], t["horas_programadas"], t["horas_extra"]),
        )
    n["turno"], n["turno_duplicado_omitido"] = len(vistos), omitidos

    for a in _j("ausencias"):
        cur.execute(
            "insert into public.ausencia (empleado_id, fecha, motivo, horas, aviso_corto) values (%s,%s,%s,%s,%s)",
            (a["empleado_id"], a["fecha"], a["motivo"], a["horas"], a["aviso_corto"]),
        )

    for e in _j("eventos"):
        cur.execute(
            """insert into public.evento (local_id, fecha, nombre, tipo, franjas, impacto_esperado, notas)
               values (%s,%s,%s,%s,%s,%s,%s)""",
            (local_id, e["fecha"], e["nombre"], e["tipo"], e["servicios"], e["impacto_esperado"], e["notas"]),
        )

    con_consentimiento = 0
    for c in _j("consentimientos"):
        if c["otorgado"]:
            cur.execute(
                """insert into sensible.consentimiento (empleado_id, tipo, version_texto, otorgado_en)
                   values (%s, 'bienestar', %s, %s)""",
                (c["empleado_id"], c["version_texto"], c["fecha"]),
            )
            con_consentimiento += 1
    n["consentimiento"] = con_consentimiento

    bien = _j("bienestar")
    for b in bien:
        cur.execute(
            """insert into sensible.bienestar_diario (empleado_id, fecha, pasos, sueno_horas, pulso_medio_bpm,
                                                      encuesta_fatiga_inicio, encuesta_fatiga_fin, escala_version, fuente)
               values (%s,%s,%s,%s,%s,%s,%s,1,'simulado')""",
            (b["empleado_id"], b["fecha"], b["pasos"], b["sueno_horas"], b["pulso_medio_bpm"],
             b["encuesta_fatiga_inicio"], b["encuesta_fatiga_fin"]),
        )
    n["bienestar_diario"] = len(bien)

    for usuario, perfil, emp in (("jefe", "jefe_turno", "RST_008"), ("empleado", "empleado", "RST_001")):
        cur.execute(
            "insert into public.usuario (empleado_id, nombre_usuario, hash_contrasena, perfil) values (%s,%s,%s,%s)",
            (emp, usuario, "sin-uso:login-demo-usa-DEMO_PASSWORD", perfil),
        )
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", help="Cadena de conexión a Postgres")
    ap.add_argument("--permitir-remoto", action="store_true", help="Permitir un host que no sea local")
    args = ap.parse_args()
    host = urlparse(args.url).hostname
    if host not in HOSTS_LOCALES and not args.permitir_remoto:
        sys.exit(f"Me niego a cargar datos en {host}: no es local. Usa --permitir-remoto si de verdad quieres.")
    with psycopg.connect(args.url) as con:
        print(cargar(con))


if __name__ == "__main__":
    main()
