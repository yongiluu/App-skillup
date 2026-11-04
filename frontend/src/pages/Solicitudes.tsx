import { useState } from 'react'
import { getSolicitudes, resolverSolicitud } from '../api'
import type { SolicitudCambio } from '../api/tipos'
import { useDatos } from '../lib/useDatos'
import { useEquipo } from '../lib/useNombres'
import { NOMBRE_ROL, horario } from '../lib/formato'
import { encabezadoDia } from '../lib/fechas'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import EstadoSolicitud from '../components/solicitudes/EstadoSolicitud'
import SinPermiso from './SinPermiso'
import estilos from '../components/solicitudes/Solicitudes.module.css'

type Vista = 'pendientes' | 'resueltas'

const cargar = () => getSolicitudes()

/** Una solicitud pendiente con su comentario y los botones Aprobar / Rechazar. */
function Pendiente({
  s,
  nombre,
  rol,
  alResolver,
}: {
  s: SolicitudCambio
  nombre: (id: string | null) => string
  rol: string
  alResolver: (s: SolicitudCambio) => void
}) {
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function resolver(estado: 'aprobada' | 'rechazada') {
    setError(null)
    setEnviando(true)
    try {
      alResolver(await resolverSolicitud(s.id, estado, comentario.trim() || undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setEnviando(false)
    }
  }

  return (
    <li className={estilos.tarjeta}>
      <div className={estilos.cabeceraSolicitud}>
        <b>
          {nombre(s.solicitante_id)} <span className={estilos.detalle}>· {rol}</span>
        </b>
        <EstadoSolicitud estado={s.estado} />
      </div>
      <p>
        {encabezadoDia(s.fecha).largo} · {horario(s.servicio, s.fecha)}
      </p>
      <p className={estilos.detalle}>
        {s.reemplazo_id ? `Propone que lo cubra: ${nombre(s.reemplazo_id)}` : 'No propuso reemplazo'}
      </p>
      {s.motivo && <p className={estilos.detalle}>Motivo: {s.motivo}</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <label className={estilos.campo}>
        <span>Comentario para {nombre(s.solicitante_id).split(' ')[0]} (opcional)</span>
        <input value={comentario} maxLength={300} onChange={(e) => setComentario(e.target.value)} />
      </label>
      <div className={estilos.botones}>
        <Boton onClick={() => resolver('aprobada')} disabled={enviando}>
          Aprobar
        </Boton>
        <Boton variante="secundario" onClick={() => resolver('rechazada')} disabled={enviando}>
          Rechazar
        </Boton>
      </div>
    </li>
  )
}

/** Bandeja del jefe de turno: aprobar o rechazar los cambios de turno que pide el equipo. */
export default function Solicitudes() {
  const datos = useDatos(cargar)
  const { nombre, empleado } = useEquipo()
  const [vista, setVista] = useState<Vista>('pendientes')
  const [ultima, setUltima] = useState<SolicitudCambio | null>(null)

  if (datos.estado === 'error' && datos.sinPermiso) return <SinPermiso />

  const todas = datos.estado === 'listo' ? [...datos.datos].sort((a, b) => b.creada_en.localeCompare(a.creada_en)) : []
  const pendientes = todas.filter((s) => s.estado === 'pendiente')
  const resueltas = todas.filter((s) => s.estado !== 'pendiente')
  const rolDe = (id: string) => {
    const e = empleado(id)
    return e ? NOMBRE_ROL[e.rol] : ''
  }

  return (
    <>
      <EncabezadoPagina titulo="Solicitudes de cambio" bajada="Cambios de turno que pide el equipo" />

      <div className={estilos.pestanas} role="group" aria-label="Filtrar solicitudes">
        <button type="button" aria-pressed={vista === 'pendientes'} onClick={() => setVista('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button type="button" aria-pressed={vista === 'resueltas'} onClick={() => setVista('resueltas')}>
          Resueltas ({resueltas.length})
        </button>
      </div>

      {ultima && (
        <div className={estilos.confirmacion}>
          <Aviso>
            Solicitud de {nombre(ultima.solicitante_id)} {ultima.estado === 'aprobada' ? 'aprobada' : 'rechazada'}.
          </Aviso>
        </div>
      )}

      {datos.estado === 'cargando' && <p role="status">Cargando solicitudes…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' && vista === 'pendientes' && (
        pendientes.length === 0 ? (
          <p className={estilos.vacio}>No hay solicitudes pendientes.</p>
        ) : (
          <ul className={estilos.tarjetas}>
            {pendientes.map((s) => (
              <Pendiente
                key={s.id}
                s={s}
                nombre={nombre}
                rol={rolDe(s.solicitante_id)}
                alResolver={(r) => {
                  setUltima(r)
                  datos.recargar()
                }}
              />
            ))}
          </ul>
        )
      )}

      {datos.estado === 'listo' && vista === 'resueltas' && (
        resueltas.length === 0 ? (
          <p className={estilos.vacio}>Todavía no hay solicitudes resueltas.</p>
        ) : (
          <ul className={estilos.tarjetas}>
            {resueltas.map((s) => (
              <li key={s.id} className={estilos.tarjeta}>
                <div className={estilos.cabeceraSolicitud}>
                  <b>{nombre(s.solicitante_id)}</b>
                  <EstadoSolicitud estado={s.estado} />
                </div>
                <p>
                  {encabezadoDia(s.fecha).largo} · {horario(s.servicio, s.fecha)}
                </p>
                {s.reemplazo_id && <p className={estilos.detalle}>Reemplazo: {nombre(s.reemplazo_id)}</p>}
                {s.comentario && <p className={estilos.comentario}>{s.comentario}</p>}
                {s.resuelta_por && <p className={estilos.detalle}>Resolvió: {nombre(s.resuelta_por)}</p>}
              </li>
            ))}
          </ul>
        )
      )}
    </>
  )
}
