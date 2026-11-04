"""Genera los archivos SQL de la semilla (datos simulados) a partir de los mocks del backend.

Uso (desde la raíz del repo):
    python database/seed/generar_semilla.py

Lee backend/app/mocks/*.json y escribe en database/seed/:
    01_datos_base.sql   local, empleados, roles que cubren, calendario, servicios,
                        predicciones, eventos, ausencias y usuarios demo
    02_turnos.sql       turnos
    03_bienestar.sql    consentimientos y bienestar diario (esquema sensible)

Sigue las mismas decisiones que backend/scripts/cargar_mocks_en_bd.py (Diego):
- fecha_ingreso = HOY_MOCK - antigüedad en años - 30 días.
- empleado_rol guarda TODOS los roles que la persona sabe hacer (incluido el principal).
- Los turnos repetidos (misma persona dos veces en un servicio) se omiten: queda el primero.
- Solo se cargan consentimientos otorgados; bienestar solo de quien dio consentimiento.
- Usuarios demo 'jefe' (RST_055, Catalina Flores) y 'empleado' (RST_056, Cristóbal Silva) con un hash de relleno que no
  sirve para entrar: el login demo usa DEMO_PASSWORD en el backend.
Solo usa la librería estándar de Python.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MOCKS = RAIZ / "backend" / "app" / "mocks"
SALIDA = Path(__file__).resolve().parent
HOY_MOCK = date(2025, 10, 17)
LOCAL = "Cervecería (simulada)"
FILAS_POR_INSERT = 500


def cargar(nombre: str):
    return json.loads((MOCKS / f"{nombre}.json").read_text(encoding="utf-8"))


def q(v) -> str:
    """Convierte un valor de Python a texto SQL."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, list):
        return "array[" + ", ".join(q(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def bloques(filas: list[str]):
    for i in range(0, len(filas), FILAS_POR_INSERT):
        yield filas[i : i + FILAS_POR_INSERT]


def insert_directo(tabla: str, columnas: str, filas: list[tuple]) -> str:
    partes = []
    for b in bloques(["(" + ", ".join(q(x) for x in f) + ")" for f in filas]):
        partes.append(f"insert into {tabla} ({columnas}) values\n  " + ",\n  ".join(b) + ";\n")
    return "\n".join(partes)


def insert_con_select(cabecera: str, alias: str, columnas_v: str, filas: list[tuple], resto: str) -> str:
    """insert ... select ... from (values ...) as v(...) join ... para buscar ids por fecha y franja."""
    partes = []
    for b in bloques(["(" + ", ".join(q(x) for x in f) + ")" for f in filas]):
        partes.append(
            f"{cabecera}\nfrom (values\n  " + ",\n  ".join(b) + f"\n) as {alias}({columnas_v})\n{resto};\n"
        )
    return "\n".join(partes)


def guarda(tabla: str, descripcion: str) -> str:
    return (
        "do $$\nbegin\n"
        f"    if exists (select 1 from {tabla}) then\n"
        f"        raise exception 'La hoja {tabla} ya tiene datos: {descripcion} ya se cargó. No se cargó nada.';\n"
        "    end if;\nend $$;\n"
    )


def encabezado(titulo: str, orden: str) -> str:
    return (
        "-- =====================================================================\n"
        f"-- SkillUp · Semilla de datos SIMULADOS · {titulo}\n"
        "-- Generado con database/seed/generar_semilla.py desde backend/app/mocks/.\n"
        "-- No editar a mano: si cambian los mocks, se vuelve a generar.\n"
        f"-- {orden}\n"
        "-- Todo se carga junto o no se carga nada (begin ... commit).\n"
        "-- =====================================================================\n\n"
        "begin;\n\n"
    )


def local_id() -> str:
    return f"(select id from public.local where nombre = {q(LOCAL)})"


def generar_base() -> str:
    s = [encabezado("1 de 3: datos base", "Ejecutar PRIMERO, sobre el esquema recién creado.")]
    s.append(guarda("public.local", "la semilla base"))
    s.append(f"\ninsert into public.local (nombre) values ({q(LOCAL)});\n\n")

    emp = cargar("empleados")
    filas = []
    for e in emp:
        ingreso = HOY_MOCK - timedelta(days=int(e["antiguedad_anos"] * 365.25) + 30)
        filas.append((e["id"], e["nombre"], e["rol"], e["rol_respaldo"], e["tipo_contrato"],
                      ingreso.isoformat(), e["preferencia_turno"], e["distancia_trabajo_km"]))
    s.append("-- Empleados (nombres ficticios)\n")
    s.append(insert_con_select(
        "insert into public.empleado (id, local_id, nombre, rol_principal, rol_respaldo, tipo_contrato,\n"
        "                             fecha_ingreso, preferencia_turno, distancia_trabajo_km)\n"
        f"select v.id, {local_id()}, v.nombre, v.rol, v.respaldo, v.contrato,\n"
        "       v.ingreso::date, v.preferencia, v.distancia::numeric",
        "v", "id, nombre, rol, respaldo, contrato, ingreso, preferencia, distancia", filas, ""))

    roles = sorted({(e["id"], r) for e in emp for r in {e["rol"], *e["puede_cubrir"]}})
    s.append("\n-- Roles que cada persona sabe hacer (incluido el principal)\n")
    s.append(insert_directo("public.empleado_rol", "empleado_id, rol_codigo", roles))

    cal = cargar("calendario")
    s.append("\n-- Calendario: ventanas de pago, feriados, vísperas y fines de semana largos\n")
    s.append(insert_directo(
        "public.calendario_dia", "fecha, es_ventana_pago, feriado, es_vispera_feriado, es_fin_de_semana_largo",
        [(d["fecha"], d["es_ventana_pago"], d["feriado"], d["es_vispera_feriado"], d["es_fin_de_semana_largo"])
         for d in cal]))

    serv = cargar("servicios")
    s.append("\n-- Servicios (fecha + franja) con su demanda prevista\n")
    s.append(insert_con_select(
        "insert into public.servicio (local_id, fecha, franja, requeridos, cubiertos_previstos, reservas,\n"
        "                             pedidos_delivery, proporcion_sin_reserva, hay_promocion)\n"
        f"select {local_id()}, v.fecha::date, v.franja, v.req, v.cub, v.res, v.deliv, v.ratio::numeric, v.promo",
        "v", "fecha, franja, req, cub, res, deliv, ratio, promo",
        [(x["fecha"], x["servicio"], x["requeridos"], x["cubiertos_previstos"], x["reservas"],
          x["pedidos_delivery"], x["ratio_sin_reserva"], x["promo"]) for x in serv], ""))

    s.append("\n-- Predicciones del modelo (simuladas)\n")
    s.append(insert_con_select(
        "insert into public.prediccion (servicio_id, prob_deficit, prob_garzon, prob_cocinero_linea,\n"
        "                               prob_jefe_turno, dotacion_predicha, recomendacion, version_modelo)\n"
        "select s.id, v.p::numeric, v.pg::numeric, v.pc::numeric, v.pj::numeric, v.dot::numeric, v.rec, 'simulado-v0'",
        "v", "fecha, franja, p, pg, pc, pj, dot, rec",
        [(x["fecha"], x["servicio"], x["prob_deficit"], x["prob_por_rol"]["garzon"],
          x["prob_por_rol"]["cocinero_linea"], x["prob_por_rol"]["jefe_turno"], x["dotacion_predicha"],
          x["recomendacion"]) for x in serv],
        f"join public.servicio s on s.fecha = v.fecha::date and s.franja = v.franja and s.local_id = {local_id()}"))

    s.append("\n-- Eventos del local (simulados) [PENDIENTE CERVECERÍA]\n")
    s.append(insert_con_select(
        "insert into public.evento (local_id, fecha, nombre, tipo, franjas, impacto_esperado, notas)\n"
        f"select {local_id()}, v.fecha::date, v.nombre, v.tipo, v.franjas, v.impacto, v.notas",
        "v", "fecha, nombre, tipo, franjas, impacto, notas",
        [(e["fecha"], e["nombre"], e["tipo"], e["servicios"], e["impacto_esperado"], e["notas"])
         for e in cargar("eventos")], ""))

    s.append("\n-- Ausencias (motivo solo 'personal' o 'salud', nunca el diagnóstico)\n")
    s.append(insert_directo(
        "public.ausencia", "empleado_id, fecha, motivo, horas, aviso_corto",
        [(a["empleado_id"], a["fecha"], a["motivo"], a["horas"], a["aviso_corto"]) for a in cargar("ausencias")]))

    s.append("\n-- Usuarios demo: el hash es de relleno y NO sirve para entrar\n"
             "-- (el login demo del backend usa DEMO_PASSWORD).\n")
    s.append(insert_directo(
        "public.usuario", "empleado_id, nombre_usuario, hash_contrasena, perfil",
        [("RST_055", "jefe", "sin-uso:login-demo-usa-DEMO_PASSWORD", "jefe_turno"),
         ("RST_056", "empleado", "sin-uso:login-demo-usa-DEMO_PASSWORD", "empleado")]))
    s.append("\ncommit;\n")
    return "".join(s), {"empleados": len(emp), "servicios": len(serv)}


def generar_turnos() -> tuple[str, int, int]:
    vistos, filas, omitidos = set(), [], 0
    for t in cargar("turnos"):
        clave = (t["fecha"], t["servicio"], t["empleado_id"])
        if clave in vistos:
            omitidos += 1
            continue
        vistos.add(clave)
        filas.append((t["fecha"], t["servicio"], t["empleado_id"], t["rol"], t["horas_programadas"], t["horas_extra"]))
    s = [encabezado("2 de 3: turnos", "Ejecutar DESPUÉS de 01_datos_base.sql."),
         guarda("public.turno", "la semilla de turnos"),
         f"\n-- {len(filas)} turnos. Se omitieron {omitidos} repetidos de los mocks\n"
         "-- (misma persona dos veces en el mismo servicio).\n",
         insert_con_select(
             "insert into public.turno (servicio_id, empleado_id, rol_codigo, horas_programadas, horas_extra)\n"
             "select s.id, v.emp, v.rol, v.hp::numeric, v.he::numeric",
             "v", "fecha, franja, emp, rol, hp, he", filas,
             f"join public.servicio s on s.fecha = v.fecha::date and s.franja = v.franja and s.local_id = {local_id()}"),
         "\ncommit;\n"]
    return "".join(s), len(filas), omitidos


def generar_bienestar() -> tuple[str, int, int]:
    cons = [c for c in cargar("consentimientos") if c["otorgado"]]
    con_ok = {c["empleado_id"] for c in cons}
    bien = [b for b in cargar("bienestar") if b["empleado_id"] in con_ok]
    s = [encabezado("3 de 3: bienestar (datos SENSIBLES simulados)", "Ejecutar DESPUÉS de 02_turnos.sql."),
         guarda("sensible.consentimiento", "la semilla de bienestar"),
         f"\n-- Consentimientos otorgados: {len(cons)}. Quien no dio consentimiento no tiene filas\n"
         "-- de bienestar (y la base no las aceptaría).\n",
         insert_directo("sensible.consentimiento", "empleado_id, tipo, version_texto, otorgado_en",
                        [(c["empleado_id"], "bienestar", c["version_texto"], c["fecha"]) for c in cons]),
         f"\n-- Bienestar diario: {len(bien)} registros (pasos, sueño, pulso y encuesta de fatiga 1 a 7)\n",
         insert_directo(
             "sensible.bienestar_diario",
             "empleado_id, fecha, pasos, sueno_horas, pulso_medio_bpm, encuesta_fatiga_inicio, "
             "encuesta_fatiga_fin, escala_version, fuente",
             [(b["empleado_id"], b["fecha"], b["pasos"], b["sueno_horas"], b["pulso_medio_bpm"],
               b["encuesta_fatiga_inicio"], b["encuesta_fatiga_fin"], 1, "simulado") for b in bien]),
         "\ncommit;\n"]
    return "".join(s), len(cons), len(bien)


def main() -> None:
    base, info = generar_base()
    turnos, n_turnos, omitidos = generar_turnos()
    bien, n_cons, n_bien = generar_bienestar()
    for nombre, texto in (("01_datos_base.sql", base), ("02_turnos.sql", turnos), ("03_bienestar.sql", bien)):
        (SALIDA / nombre).write_text(texto, encoding="utf-8")
    print(f"Listo: {info['empleados']} empleados, {info['servicios']} servicios, {n_turnos} turnos "
          f"({omitidos} repetidos omitidos), {n_cons} consentimientos, {n_bien} días de bienestar.")


if __name__ == "__main__":
    main()
