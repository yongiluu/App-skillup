import { useCallback, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { crearSolicitud, getDisponibles } from '../../api'
import type { SolicitudCambio, Turno } from '../../api/tipos'
import { useDatos } from '../../lib/useDatos'
import { NOMBRE_ROL, horario } from '../../lib/formato'
import { encabezadoDia } from '../../lib/fechas'
import Boton from '../ui/Boton'
import Aviso from '../ui/Aviso'
import estilos from './Solicitudes.module.css'

const MAX_MOTIVO = 300

interface Props {
  turno: Turno
  alEnviar: (s: SolicitudCambio) => void
  alCancelar: () => void
}

/**
 * Pedir cambio de un turno propio (POST /solicitudes-cambio). El reemplazo es opcional y solo
 * se ofrece a quienes la API dice que están disponibles (GET /disponibles, evaluación AP-03):
 * saben el rol, no están ausentes, no trabajan ya en ese servicio y no pasarían del máximo de
 * días seguidos. El empleado no ve por qué alguien no aparece.
 */
export default function FormularioCambio({ turno, alEnviar, alCancelar }: Props) {
  const id = useId()
  const [reemplazo, setReemplazo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(() => getDisponibles(turno.servicio, turno.fecha), [turno.servicio, turno.fecha])
  const disponibles = useDatos(cargar)
  const candidatos =
    disponibles.estado === 'listo'
      ? disponibles.datos.filter((d) => d.disponible).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      : []

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
        Pedir cambio · {encabezadoDia(turno.fecha).largo}, {horario(turno.servicio, turno.fecha)}
      </h3>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <label className={estilos.campo}>
        <span>¿Quién te podría cubrir? (opcional)</span>
        <select
          value={reemplazo}
          onChange={(e) => setReemplazo(e.target.value)}
          disabled={disponibles.estado === 'cargando'}
          aria-describedby={`${id}-disponibles`}
        >
          <option value="">Que lo decida mi jefe de turno</option>
          {candidatos.map((d) => (
            <option key={d.empleado_id} value={d.empleado_id}>
              {d.nombre} ({NOMBRE_ROL[d.rol]})
            </option>
          ))}
        </select>
        <small id={`${id}-disponibles`} role={disponibles.estado === 'error' ? 'alert' : undefined}>
          {disponibles.estado === 'cargando' && 'Buscando quién está disponible…'}
          {disponibles.estado === 'error' &&
            `No se pudo cargar quién está disponible (${disponibles.mensaje}). Puedes enviar la solicitud igual y tu jefe de turno lo decide.`}
          {disponibles.estado === 'listo' &&
            (candidatos.length > 1
              ? `Solo aparecen las ${candidatos.length} personas disponibles para ese turno.`
              : candidatos.length === 1
                ? 'Solo aparece la persona disponible para ese turno.'
                : 'No hay nadie disponible para ese turno. Tu jefe de turno buscará a alguien.')}
        </small>
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
