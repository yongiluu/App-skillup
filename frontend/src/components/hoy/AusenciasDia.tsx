import { Link } from 'react-router-dom'
import type { AusenciaDia, Rol } from '../../api/tipos'
import { NOMBRE_ROL, horario } from '../../lib/formato'
import Avatar from '../ui/Avatar'
import estilos from './Hoy.module.css'

/**
 * Quién falta hoy y en qué servicios. Motivo solo "personal" o "salud", nunca el diagnóstico.
 * Fuente: GET /ausencias?fecha= (solo jefe de turno).
 */
export default function AusenciasDia({ ausencias }: { ausencias: AusenciaDia[] }) {
  if (ausencias.length === 0) {
    return <p className={estilos.vacio}>Nadie avisó ausencia para hoy.</p>
  }

  return (
    <ul className={estilos.lista}>
      {ausencias.map((a) => (
        <li key={a.empleado_id} className={estilos.ausencia}>
          <Avatar nombre={a.nombre} id={a.empleado_id} tamano={36} />
          <span className={estilos.crece}>
            <Link to={`/equipo/${a.empleado_id}`}>
              <b>{a.nombre}</b>
            </Link>{' '}
            · {NOMBRE_ROL[a.rol as Rol] ?? a.rol}
            <span className={estilos.detalle}>
              {a.servicios.length > 0
                ? `Programado/a en ${a.servicios.map((s) => horario(s, a.fecha)).join(', ')}`
                : 'Sin turnos programados hoy'}
            </span>
          </span>
          <span className={estilos.etiquetas}>
            <span className={estilos.motivo}>{a.motivo === 'salud' ? 'Salud' : 'Personal'}</span>
            {a.aviso_corto && <span className={estilos.avisoCorto}>Aviso corto</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
