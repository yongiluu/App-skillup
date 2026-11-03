import type { NivelRiesgo } from '../../api/tipos'
import { ETIQUETA_RIESGO } from '../../lib/riesgo'
import { porcentaje } from '../../lib/formato'
import Icono from './Icono'
import type { NombreIcono } from './Icono'
import estilos from './InsigniaRiesgo.module.css'

const ICONO: Record<NivelRiesgo, NombreIcono> = { bajo: 'ok', alerta: 'alerta', alto: 'alto' }

/**
 * Estado de riesgo: color + ícono + palabra (nunca solo color, para daltónicos).
 * Si se pasa `prob`, muestra también el porcentaje de déficit.
 */
export default function InsigniaRiesgo({
  nivel,
  prob,
  etiqueta,
}: {
  nivel: NivelRiesgo
  prob?: number
  /** Texto propio (p. ej. "Fatiga alta"); por defecto, el del nivel de riesgo */
  etiqueta?: string
}) {
  return (
    <span className={`${estilos.insignia} ${estilos[nivel]}`}>
      <Icono nombre={ICONO[nivel]} tamano={16} />
      {etiqueta ?? ETIQUETA_RIESGO[nivel]}
      {prob !== undefined && <span className={estilos.prob}>· {porcentaje(prob)}</span>}
    </span>
  )
}
