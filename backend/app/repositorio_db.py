"""Repositorio sobre Postgres / Supabase (esquema de Maxi: public + sensible).

Mismos métodos que RepositorioMock, así los routers y la lógica no cambian.
Se crea uno por request (con una conexión del pool) y guarda en caché lo que ya leyó
durante ese request, para no repetir consultas a Supabase.

Traducciones entre la API y las tablas:
- servicio.franja        ↔ "servicio" en la API
- empleado.rol_principal ↔ "rol"; puede_cubrir = empleado_rol (sin el rol principal) + rol_respaldo
- turno → días seguidos y horas extra se calculan desde las fechas de los turnos
- consentimiento vigente = tipo 'bienestar' y revocado_en nulo
- solicitud_cambio.resuelta_por es un usuario.id; la API muestra el empleado_id de ese usuario
- bienestar_diario solo se lee para quien tiene consentimiento vigente (doble control)
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from threading import Lock

from fastapi import HTTPException
from psycopg import OperationalError, errors
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

from app.config import get_settings
from app.repositorio import PENDIENTE_DUPLICADA, ReglaNegocio

log = logging.getLogger("skillup")
_pool: ConnectionPool | None = None
_pool_lock = Lock()


def _get_pool() -> ConnectionPool:
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = ConnectionPool(
                get_settings().database_url,
                min_size=1,
                max_size=5,
                kwargs={"row_factory": dict_row, "autocommit": True, "connect_timeout": 5},
                open=True,
                name="skillup",
                timeout=get_settings().db_timeout_segundos,
            )
    return _pool


def cerrar_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None


_SIN_BASE = (
    "No se pudo conectar a la base de datos. Revisa DATABASE_URL en backend/.env "
    "(usa la conexión 'Session pooler' de Supabase) y tu conexión a internet."
)


@contextmanager
def abrir_repo():
    try:
        conexion = _get_pool().connection()
        con = conexion.__enter__()
    except (PoolTimeout, OperationalError):
        log.error("Sin conexión a la base de datos (pool de %s s agotado)", get_settings().db_timeout_segundos)
        raise HTTPException(503, _SIN_BASE) from None
    try:
        yield RepositorioDB(con)
    except BaseException as e:
        if not conexion.__exit__(type(e), e, e.__traceback__):
            raise
    else:
        conexion.__exit__(None, None, None)


@lru_cache
def _preguntas_tests() -> dict:
    ruta = Path(__file__).resolve().parent / "mocks" / "preguntas_tests.json"
    return json.loads(ruta.read_text(encoding="utf-8"))


def _num(v):
    """Decimal → float (JSON no entiende Decimal)."""
    return float(v) if isinstance(v, Decimal) else v


def _iso(d) -> str:
    return d.isoformat() if isinstance(d, date) else d


class RepositorioDB:
    def __init__(self, con) -> None:
        self.con = con
        self._cache: dict = {}

    # ---------- utilidades ----------
    def _q(self, sql: str, params: tuple | dict = ()) -> list[dict]:
        with self.con.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else []

    def _una(self, sql: str, params: tuple | dict = ()) -> dict | None:
        filas = self._q(sql, params)
        return filas[0] if filas else None

    def _cacheado(self, clave, fn):
        if clave not in self._cache:
            self._cache[clave] = fn()
        return self._cache[clave]

    @property
    def local_id(self) -> int | None:
        def buscar():
            configurado = get_settings().local_id
            if configurado is not None:
                return configurado
            fila = self._una("select min(id) as id from public.local")
            return fila["id"] if fila else None

        return self._cacheado("local_id", buscar)

    # ---------- rangos ----------
    def rango_servicios(self) -> tuple[str, str] | None:
        f = self._una("select min(fecha) as ini, max(fecha) as fin from public.servicio where local_id = %s", (self.local_id,))
        return (_iso(f["ini"]), _iso(f["fin"])) if f and f["ini"] else None

    def rango_calendario(self) -> tuple[str, str] | None:
        f = self._una("select min(fecha) as ini, max(fecha) as fin from public.calendario_dia")
        return (_iso(f["ini"]), _iso(f["fin"])) if f and f["ini"] else None

    # ---------- empleados ----------
    @property
    def empleados(self) -> dict[str, dict]:
        return self._cacheado("empleados", self._cargar_empleados)

    def _cargar_empleados(self) -> dict[str, dict]:
        hoy = get_settings().mock_hoy
        filas = self._q(
            """
            select e.id, e.nombre, e.rol_principal, e.rol_respaldo, e.tipo_contrato, e.preferencia_turno,
                   e.distancia_trabajo_km, e.fecha_ingreso,
                   coalesce(array_agg(er.rol_codigo) filter (where er.rol_codigo is not null), '{}') as roles
            from public.empleado e
            left join public.empleado_rol er on er.empleado_id = e.id
            where e.activo and e.local_id = %s
            group by e.id
            order by e.id
            """,
            (self.local_id,),
        )
        empleados = {}
        for f in filas:
            cubre = [r for r in f["roles"] if r != f["rol_principal"]]
            if f["rol_respaldo"] and f["rol_respaldo"] not in cubre:
                cubre.append(f["rol_respaldo"])
            antiguedad = int((hoy - f["fecha_ingreso"]).days // 365.25) if f["fecha_ingreso"] else 0
            empleados[f["id"]] = {
                "id": f["id"],
                "nombre": f["nombre"],
                "rol": f["rol_principal"],
                "rol_respaldo": f["rol_respaldo"],
                "polivalente": bool(cubre),
                "puede_cubrir": sorted(cubre),
                "antiguedad_anos": max(antiguedad, 0),
                "tipo_contrato": f["tipo_contrato"],
                "preferencia_turno": f["preferencia_turno"],
                "distancia_trabajo_km": _num(f["distancia_trabajo_km"]),
            }
        return empleados

    # ---------- servicios ----------
    def servicios_de(self, fecha: date) -> list[dict]:
        def cargar():
            filas = self._q(
                """
                select s.fecha, s.franja as servicio,
                       coalesce(s.requeridos,
                                (select sum(r.requeridos) from public.servicio_requerimiento r where r.servicio_id = s.id),
                                0) as requeridos,
                       (select count(*) from public.turno t where t.servicio_id = s.id) as asignados,
                       coalesce(s.cubiertos_previstos, 0) as cubiertos_previstos,
                       coalesce(s.reservas, 0) as reservas,
                       coalesce(s.pedidos_delivery, 0) as pedidos_delivery,
                       p.prob_deficit, p.prob_garzon, p.prob_cocinero_linea, p.prob_jefe_turno,
                       coalesce(p.dotacion_predicha, 0) as dotacion_predicha,
                       coalesce(p.recomendacion, '') as recomendacion
                from public.servicio s
                join public.prediccion p on p.servicio_id = s.id   -- sin predicción no se muestra
                where s.local_id = %s and s.fecha = %s
                order by s.franja
                """,
                (self.local_id, fecha),
            )
            return [
                {
                    "fecha": _iso(f["fecha"]),
                    "servicio": f["servicio"],
                    "requeridos": int(f["requeridos"]),
                    "asignados": int(f["asignados"]),
                    "dotacion_predicha": _num(f["dotacion_predicha"]),
                    "cubiertos_previstos": f["cubiertos_previstos"],
                    "reservas": f["reservas"],
                    "pedidos_delivery": f["pedidos_delivery"],
                    "prob_deficit": _num(f["prob_deficit"]),
                    "prob_por_rol": {
                        "garzon": _num(f["prob_garzon"]) or 0.0,
                        "cocinero_linea": _num(f["prob_cocinero_linea"]) or 0.0,
                        "jefe_turno": _num(f["prob_jefe_turno"]) or 0.0,
                    },
                    "recomendacion": f["recomendacion"],
                }
                for f in filas
            ]

        return self._cacheado(("servicios", fecha), cargar)

    # ---------- calendario y eventos ----------
    def dia_calendario(self, fecha: date) -> dict | None:
        todo = self._cacheado(
            "calendario",
            lambda: {_iso(f["fecha"]): f for f in self._q("select * from public.calendario_dia")},
        )
        return todo.get(fecha.isoformat())

    def _eventos(self) -> list[dict]:
        def cargar():
            filas = self._q(
                """select id, fecha, nombre, tipo, franjas, impacto_esperado, notas
                   from public.evento where local_id = %s order by fecha, id""",
                (self.local_id,),
            )
            return [self._evento_api(f) for f in filas]

        return self._cacheado("eventos", cargar)

    @staticmethod
    def _evento_api(f: dict) -> dict:
        return {
            "id": f["id"],
            "fecha": _iso(f["fecha"]),
            "nombre": f["nombre"],
            "tipo": f["tipo"],
            "servicios": list(f["franjas"] or []),
            "impacto_esperado": f["impacto_esperado"],
            "notas": f["notas"],
        }

    def eventos_de(self, fecha: date) -> list[dict]:
        f = fecha.isoformat()
        return [e for e in self._eventos() if e["fecha"] == f]

    def crear_evento(self, datos: dict) -> dict:
        f = self._una(
            """insert into public.evento (local_id, fecha, nombre, tipo, franjas, impacto_esperado, notas)
               values (%s, %s, %s, %s, %s, %s, %s)
               returning id, fecha, nombre, tipo, franjas, impacto_esperado, notas""",
            (self.local_id, datos["fecha"], datos["nombre"], datos["tipo"], datos["servicios"],
             datos["impacto_esperado"], datos.get("notas")),
        )
        self._cache.pop("eventos", None)
        return self._evento_api(f)

    # ---------- turnos ----------
    _SQL_TURNOS = """
        select t.empleado_id, s.fecha, s.franja as servicio, t.rol_codigo as rol,
               t.horas_programadas, t.horas_extra
        from public.turno t join public.servicio s on s.id = t.servicio_id
        where s.local_id = %s {filtro}
        order by s.fecha, s.franja, t.empleado_id
    """

    @staticmethod
    def _turno_api(f: dict) -> dict:
        return {
            "empleado_id": f["empleado_id"],
            "fecha": _iso(f["fecha"]),
            "servicio": f["servicio"],
            "rol": f["rol"],
            "horas_programadas": _num(f["horas_programadas"]),
            "horas_extra": _num(f["horas_extra"]),
        }

    def turnos_de_servicio(self, fecha: date, servicio: str) -> list[dict]:
        del_dia = self._cacheado(
            ("turnos_dia", fecha),
            lambda: [self._turno_api(f) for f in self._q(self._SQL_TURNOS.format(filtro="and s.fecha = %s"), (self.local_id, fecha))],
        )
        return [t for t in del_dia if t["servicio"] == servicio]

    def turnos_de_empleado(self, empleado_id: str) -> list[dict]:
        return self._cacheado(
            ("turnos_emp", empleado_id),
            lambda: [
                self._turno_api(f)
                for f in self._q(self._SQL_TURNOS.format(filtro="and t.empleado_id = %s"), (self.local_id, empleado_id))
            ],
        )

    def dias_seguidos_hasta(self, fecha: date) -> dict[str, int]:
        """Racha de días trabajados que termina en el último día trabajado de cada persona (≤ fecha)."""

        def calcular():
            filas = self._q(
                """select distinct t.empleado_id, s.fecha
                   from public.turno t join public.servicio s on s.id = t.servicio_id
                   where s.local_id = %s and s.fecha between %s and %s""",
                (self.local_id, fecha - timedelta(days=60), fecha),
            )
            dias: dict[str, set[date]] = defaultdict(set)
            for f in filas:
                dias[f["empleado_id"]].add(f["fecha"])
            racha = {}
            for emp, fechas in dias.items():
                d, n = max(fechas), 0
                while d in fechas:
                    n += 1
                    d -= timedelta(days=1)
                racha[emp] = n
            return racha

        return self._cacheado(("dias_seguidos", fecha), calcular)

    def horas_extra_7d(self, fecha: date) -> dict[str, float]:
        def calcular():
            filas = self._q(
                """select t.empleado_id, sum(t.horas_extra) as extra
                   from public.turno t join public.servicio s on s.id = t.servicio_id
                   where s.local_id = %s and s.fecha between %s and %s
                   group by t.empleado_id""",
                (self.local_id, fecha - timedelta(days=6), fecha),
            )
            return {f["empleado_id"]: _num(f["extra"]) for f in filas}

        return self._cacheado(("extra7", fecha), calcular)

    # ---------- ausencias ----------
    def ausencias_de_empleado(self, empleado_id: str) -> list[dict]:
        filas = self._q(
            "select fecha, motivo, horas, aviso_corto from public.ausencia where empleado_id = %s order by fecha",
            (empleado_id,),
        )
        return [
            {"empleado_id": empleado_id, "fecha": _iso(f["fecha"]), "motivo": f["motivo"],
             "horas": _num(f["horas"]) or 0.0, "aviso_corto": f["aviso_corto"]}
            for f in filas
        ]

    def ausentes_en(self, fecha: date) -> set[str]:
        return self._cacheado(
            ("ausentes", fecha),
            lambda: {f["empleado_id"] for f in self._q("select empleado_id from public.ausencia where fecha = %s", (fecha,))},
        )

    def ausencias_del_dia(self, fecha: date) -> list[dict]:
        # Consulta propuesta por Maxi (probada con la semilla), ordenada por ID para que sea estable.
        filas = self._q(
            """
            select a.empleado_id, e.nombre, e.rol_principal as rol, a.fecha, a.motivo, a.horas, a.aviso_corto,
                   coalesce((select array_agg(s.franja order by s.franja)
                             from public.turno t join public.servicio s on s.id = t.servicio_id
                             where t.empleado_id = a.empleado_id and s.fecha = a.fecha), '{}') as servicios
            from public.ausencia a
            join public.empleado e on e.id = a.empleado_id
            where a.fecha = %s and e.local_id = %s
            order by a.empleado_id
            """,
            (fecha, self.local_id),
        )
        return [{**f, "fecha": _iso(f["fecha"]), "horas": _num(f["horas"]) or 0.0, "servicios": list(f["servicios"])}
                for f in filas]

    # ---------- solicitudes de cambio (las reglas las hace cumplir la base: migración 0003) ----------
    _SQL_SOLICITUD = """
        select sc.id, sc.solicitante_id, sc.fecha, sc.franja as servicio, sc.reemplazo_id, sc.motivo,
               sc.estado, sc.respuesta_reemplazo, sc.respondida_en, sc.comentario,
               u.empleado_id as resuelta_por, sc.creada_en, sc.actualizada_en
        from public.solicitud_cambio sc
        left join public.usuario u on u.id = sc.resuelta_por
    """

    @staticmethod
    def _solicitud_api(f: dict) -> dict:
        return {**f, "fecha": _iso(f["fecha"])}

    @contextmanager
    def _reglas(self):
        """Traduce los rechazos de la base (trigger y regla única) a ReglaNegocio → 409."""
        try:
            yield
        except errors.UniqueViolation as e:
            if "solicitud_una_pendiente" in str(e):
                raise ReglaNegocio(PENDIENTE_DUPLICADA) from None
            raise
        except errors.RaiseException as e:
            raise ReglaNegocio(e.diag.message_primary or str(e)) from None
        finally:
            self._cache.clear()  # pudo cambiar un turno

    def listar_solicitudes(self) -> list[dict]:
        return [self._solicitud_api(f) for f in self._q(self._SQL_SOLICITUD + " order by sc.id")]

    def obtener_solicitud(self, solicitud_id: int) -> dict | None:
        f = self._una(self._SQL_SOLICITUD + " where sc.id = %s", (solicitud_id,))
        return self._solicitud_api(f) if f else None

    def crear_solicitud(self, datos: dict) -> dict:
        with self._reglas():
            f = self._una(
                """insert into public.solicitud_cambio (solicitante_id, fecha, franja, reemplazo_id, motivo)
                   values (%s, %s, %s, %s, %s) returning id""",
                (datos["solicitante_id"], datos["fecha"], datos["servicio"], datos.get("reemplazo_id"),
                 datos.get("motivo")),
            )
        return self.obtener_solicitud(f["id"])

    def cambiar_reemplazo(self, solicitud_id: int, reemplazo_id: str | None) -> dict:
        with self._reglas():
            self._q("update public.solicitud_cambio set reemplazo_id = %s where id = %s", (reemplazo_id, solicitud_id))
        return self.obtener_solicitud(solicitud_id)

    def responder_reemplazo(self, solicitud_id: int, acepta: bool) -> dict:
        with self._reglas():
            self._q(
                "update public.solicitud_cambio set respuesta_reemplazo = %s where id = %s",
                ("aceptada" if acepta else "rechazada", solicitud_id),
            )
        return self.obtener_solicitud(solicitud_id)

    def actualizar_solicitud(self, solicitud_id: int, cambios: dict) -> dict:
        """Aprobar o rechazar. Al aprobar, el trigger de la base valida y mueve el turno en el mismo paso."""
        # En la tabla, resuelta_por es el id del usuario que resolvió (se busca por su nombre de usuario).
        usuario = None
        if cambios.get("usuario"):
            fila = self._una("select id from public.usuario where nombre_usuario = %s", (cambios["usuario"],))
            usuario = fila["id"] if fila else None
        with self._reglas():
            self._q(
                """update public.solicitud_cambio set estado = %s, comentario = %s, resuelta_por = %s
                   where id = %s""",
                (cambios["estado"], cambios.get("comentario"), usuario, solicitud_id),
            )
        return self.obtener_solicitud(solicitud_id)

    def motivo_no_disponible(self, reemplazo: str, solicitante: str, fecha: date, franja: str) -> str | None:
        f = self._una("select public.motivo_no_disponible(%s, %s, %s, %s) as motivo", (reemplazo, solicitante, fecha, franja))
        return f["motivo"]

    def disponibles(self, solicitante: str, fecha: date, franja: str) -> list[dict]:
        # Consulta propuesta por Maxi (motivo vacío = disponible).
        return self._q(
            """select e.id as empleado_id, e.nombre, e.rol_principal as rol,
                      public.motivo_no_disponible(e.id, %(sol)s, %(fecha)s, %(franja)s) as motivo
               from public.empleado e
               where e.id <> %(sol)s and e.activo and e.local_id = %(local)s
               order by e.id""",
            {"sol": solicitante, "fecha": fecha, "franja": franja, "local": self.local_id},
        )

    # ---------- bienestar (esquema sensible) ----------
    def consentimiento_de(self, empleado_id: str) -> dict | None:
        def cargar():
            filas = self._q(
                """select distinct on (empleado_id) empleado_id, version_texto, otorgado_en, revocado_en
                   from sensible.consentimiento where tipo = 'bienestar'
                   order by empleado_id, otorgado_en desc"""
            )
            return {
                f["empleado_id"]: {
                    "otorgado": f["revocado_en"] is None,
                    "fecha": f["otorgado_en"].date().isoformat() if f["revocado_en"] is None else None,
                    "version_texto": f["version_texto"],
                }
                for f in filas
            }

        return self._cacheado("consentimientos", cargar).get(empleado_id)

    def bienestar_de_empleado(self, empleado_id: str, desde: date, hasta: date) -> list[dict]:
        def cargar():
            filas = self._q(
                """select empleado_id, fecha, pasos, sueno_horas, pulso_medio_bpm,
                          encuesta_fatiga_inicio, encuesta_fatiga_fin
                   from sensible.bienestar_diario
                   where fecha between %s and %s
                     and sensible.tiene_consentimiento(empleado_id, 'bienestar')
                   order by empleado_id, fecha""",
                (desde, hasta),
            )
            por_emp: dict[str, list[dict]] = defaultdict(list)
            for f in filas:
                por_emp[f["empleado_id"]].append(
                    {**{k: _num(v) for k, v in f.items()}, "fecha": _iso(f["fecha"])}
                )
            return por_emp

        return self._cacheado(("bienestar", desde, hasta), cargar).get(empleado_id, [])

    def registrar_acceso(self, usuario: str, accion: str, empleado_id: str | None) -> None:
        self._q(
            "insert into sensible.registro_acceso (usuario, accion, empleado_id) values (%s, %s, %s)",
            (usuario, accion, empleado_id),
        )

    @property
    def preguntas_tests(self) -> dict:
        return _preguntas_tests()
