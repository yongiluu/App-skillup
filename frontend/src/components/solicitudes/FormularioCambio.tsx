import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { crearSolicitud } from '../../api'
import type { Empleado, SolicitudCambio, Turno } from '../../api/tipos'
import { HORARIO_FRANJA, NOMBRE_ROL } from '../../lib/formato'
import { encabezadoDia } from '../../lib/fechas'
import Boton from '../ui/Boton'
import Aviso from '../ui/Aviso'
import estilos from './Solicitudes.module.css'

const MAX_MOTIVO = 300

interface Props {
  turno: Turno
  /** Equipo completo, para proponer reemplazo */
  equipo: Empleado[]
  alEnviar: (s: SolicitudCambio) => void
  alCancelar: () => void
}

/**
 * Pedir cambio de un turno propio (POST /solicitudes-cambio). El reemplazo es opcional:
 * se ofrecen las personas que tienen ese rol o lo pueden cubrir. La API valida el resto
 * (por ejemplo, que el reemplazo no esté ya en ese servicio) y su mensaje se muestra tal cual.
 */
export default function FormularioCambio({ turno, equipo, alEnviar, alCancelar }: Props) {
  const id = useId()
  const [reemplazo, setReemplazo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const candidatos = equipo
    .filter((e) => e.id !== turno.empleado_id && (e.rol === turno.rol || e.puede_cubrir.includes(turno.rol)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const s = await crearSolicitud({
        solicitante_id: turno.empleado_id,
        fecha: turno.fecha,
        servicio: turno.servicio,
        reemplazo_id: reemplazo || null,
        motivo: motivo.trim() || null,
      })
      alEnviar(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={enviar} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>
        Pedir cambio · {encabezadoDia(turno.fecha).largo}, {HORARIO_FRANJA[turno.servicio]}
      </h3>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <label className={estilos.campo}>
        <span>¿Quién te podría cubrir? (opcional)</span>
        <select value={reemplazo} onChange={(e) => setReemplazo(e.target.value)}>
          <option value="">Que lo decida mi jefe de turno</option>
          {candidatos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} ({NOMBRE_ROL[e.rol]})
            </option>
          ))}
        </select>
      </label>

      <label className={estilos.campo}>
        <span>Motivo (opcional)</span>
        <textarea
          value={motivo}
          maxLength={MAX_MOTIVO}
          rows={3}
          onChange={(e) => setMotivo(e.target.value)}
          aria-describedby={`${id}-ayuda`}
        />
        <small id={`${id}-ayuda`}>
          {motivo.length}/{MAX_MOTIVO}. No es necesario dar detalles de salud.
        </small>
      </label>

      <div className={estilos.botones}>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
        </Boton>
        <Boton variante="secundario" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
