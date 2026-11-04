import { Link } from 'react-router-dom'
import type { Franja, Rol, RolCritico, Sugerencia } from '../../api/tipos'
import { HORARIO_FRANJA, NOMBRE_ROL, porcentaje } from '../../lib/formato'
import Avatar from '../ui/Avatar'
import estilos from './Hoy.module.css'

const ORDEN: Franja[] = ['11_13', '13_15', '19_21', '21_23']
const rol = (r: string) => NOMBRE_ROL[r as Rol] ?? r

interface Grupo {
  servicio: Franja
  rol: RolCritico
  prob: number
  items: Sugerencia[]
}

/** Agrupa por servicio y rol a cubrir, en orden de franja. */
function agrupar(sugerencias: Sugerencia[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const s of sugerencias) {
    const k = `${s.servicio}|${s.rol_a_cubrir}`
    if (!grupos.has(k)) grupos.set(k, { servicio: s.servicio, rol: s.rol_a_cubrir, prob: s.prob_deficit_rol, items: [] })
    grupos.get(k)!.items.push(s)
  }
  return [...grupos.values()].sort(
    (a, b) => ORDEN.indexOf(a.servicio) - ORDEN.indexOf(b.servicio) || b.prob - a.prob,
  )
}

/**
 * Acciones sugeridas por la API (GET /sugerencias): "mover" a alguien que ya está en el servicio
 * o "llamar" a alguien libre. "Mover" y "Llamar" abren la ficha de la persona (evaluación heurística AP-09);
 * la app todavía no ejecuta la acción.
 */
export default function AccionesSugeridas({ sugerencias }: { sugerencias: Sugerencia[] }) {
  if (sugerencias.length === 0) {
    return <p className={estilos.vacio}>No hay roles críticos en riesgo hoy. Nada que mover ni llamar.</p>
  }

  return (
    <div className={estilos.grupos}>
      {agrupar(sugerencias).map((g) => (
        <section key={`${g.servicio}-${g.rol}`} className={estilos.grupo}>
          <header className={estilos.grupoCabecera}>
            <h3>
              {HORARIO_FRANJA[g.servicio]} · {rol(g.rol)}
            </h3>
            <span className={estilos.prob}>Prob. de que falte: {porcentaje(g.prob)}</span>
          </header>
          <ul className={estilos.lista}>
            {g.items.map((s) => (
              <li key={`${s.empleado_id}-${s.accion}`}>
                <Avatar nombre={s.empleado_nombre} id={s.empleado_id} tamano={32} />
                <Link
                  to={`/equipo/${s.empleado_id}`}
                  className={`${estilos.accion} ${estilos[s.accion]}`}
                  aria-label={`${s.accion === 'mover' ? 'Mover' : 'Llamar'}: ver la ficha de ${s.empleado_nombre}`}
                >
                  {s.accion === 'mover' ? 'Mover' : 'Llamar'}
                </Link>
                <span>
                  <b>{s.empleado_nombre}</b>
                  {s.accion === 'mover' && s.rol_actual
                    ? ` (hoy de ${rol(s.rol_actual).toLowerCase()})`
                    : ' (libre en ese horario)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
