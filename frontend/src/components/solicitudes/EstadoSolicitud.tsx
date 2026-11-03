import type { EstadoSolicitud as Estado } from '../../api/tipos'
import Icono from '../ui/Icono'
import type { NombreIcono } from '../ui/Icono'
import estilos from './Solicitudes.module.css'

const TEXTO: Record<Estado, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' }
const ICONO: Record<Estado, NombreIcono> = { pendiente: 'info', aprobada: 'ok', rechazada: 'alto' }

/** Estado de una solicitud de cambio: color + ícono + palabra. */
export default function EstadoSolicitud({ estado }: { estado: Estado }) {
  return (
    <span className={`${estilos.estado} ${estilos[estado]}`}>
      <Icono nombre={ICONO[estado]} tamano={14} />
      {TEXTO[estado]}
    </span>
  )
}
