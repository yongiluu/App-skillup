import type { DiaServicios, Franja, Semana, Servicio } from '../../api/tipos'
import { FRANJAS, HORARIO_FRANJA, horario, porcentaje } from '../../lib/formato'
import { ETIQUETA_RIESGO } from '../../lib/riesgo'
import { encabezadoDia, rangoSemana } from '../../lib/fechas'
import { ETIQUETA_CORTA, marcasDelDia } from '../../lib/calendario'
import InsigniaRiesgo from '../ui/InsigniaRiesgo'
import Icono from '../ui/Icono'
import estilos from './Planificador.module.css'

const ICONO = { bajo: 'ok', alerta: 'alerta', alto: 'alto' } as const

const servicioDe = (d: DiaServicios, f: Franja) => d.servicios.find((s) => s.servicio === f)

/** Marcas cortas del día (feriado, pago, eventos…) para el encabezado de la columna. */
function Marcas({ dia }: { dia: DiaServicios }) {
  const marcas = marcasDelDia(dia.calendario, false)
  if (marcas.length === 0) return null
  // Varios eventos se resumen en uno ("2 eventos"); el detalle va en el title y para lectores de pantalla.
  const tipos = [...new Set(marcas.map((m) => m.tipo))]
  const eventos = marcas.filter((m) => m.tipo === 'evento').length
  return (
    <span className={estilos.marcas} title={marcas.map((m) => m.texto).join(' · ')}>
      {tipos.map((t) => (
        <span key={t} className={`${estilos.marca} ${estilos[t]}`} aria-hidden="true">
          {t === 'evento' && eventos > 1 ? `${eventos} eventos` : ETIQUETA_CORTA[t]}
        </span>
      ))}
      <span className="solo-lector">{marcas.map((m) => m.texto).join('. ')}</span>
    </span>
  )
}

function Celda({ s }: { s?: Servicio }) {
  if (!s) return <td className={estilos.vacia}>—</td>
  return (
    <td className={`${estilos.celda} ${estilos[s.nivel_riesgo]}`}>
      <span className={estilos.dotacion}>
        {s.asignados}
        <span>/{s.requeridos}</span>
      </span>
      <span className={estilos.riesgo}>
        <Icono nombre={ICONO[s.nivel_riesgo]} tamano={14} />
        {porcentaje(s.prob_deficit)}
      </span>
      <span className="solo-lector">
        {s.asignados} de {s.requeridos} programados. {ETIQUETA_RIESGO[s.nivel_riesgo]}.
      </span>
    </td>
  )
}

/**
 * Semana en dos formatos (solo uno se ve, según el ancho de pantalla):
 * - tabla servicio × día en escritorio;
 * - lista día por día en el celular.
 */
export default function GrillaSemana({ semana, hoy }: { semana: Semana; hoy?: string }) {
  return (
    <>
      <div className={estilos.tablaCaja}>
        <table className={estilos.tabla}>
          <caption className="solo-lector">
            Dotación programada sobre requerida y probabilidad de déficit, del {rangoSemana(semana.inicio, semana.fin)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={estilos.esquina}>
                Servicio
              </th>
              {semana.dias.map((d) => {
                const e = encabezadoDia(d.fecha)
                const finde = d.calendario.es_fin_de_semana || d.calendario.feriado
                return (
                  <th
                    key={d.fecha}
                    scope="col"
                    className={`${estilos.dia} ${finde ? estilos.finde : ''} ${d.fecha === hoy ? estilos.hoy : ''}`}
                    aria-current={d.fecha === hoy ? 'date' : undefined}
                  >
                    <span className={estilos.diaNombre}>
                      {e.corto} <b>{e.numero}</b>
                      {d.fecha === hoy && <span className={estilos.etiquetaHoy}>Hoy</span>}
                    </span>
                    <Marcas dia={d} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {FRANJAS.map((f) => (
              <tr key={f}>
                <th scope="row" className={estilos.franja}>
                  {HORARIO_FRANJA[f]}
                </th>
                {semana.dias.map((d) => (
                  <Celda key={d.fecha} s={servicioDe(d, f)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={estilos.listaDias}>
        {semana.dias.map((d) => (
          <section key={d.fecha} className={`${estilos.diaMovil} ${d.fecha === hoy ? estilos.hoy : ''}`}>
            <h3>
              {encabezadoDia(d.fecha).largo}
              {d.fecha === hoy && <span className={estilos.etiquetaHoy}>Hoy</span>}
            </h3>
            <Marcas dia={d} />
            <ul>
              {FRANJAS.map((f) => {
                const s = servicioDe(d, f)
                return (
                  <li key={f}>
                    <span className={estilos.franjaMovil}>{horario(f, d.fecha)}</span>
                    {s ? (
                      <>
                        <span className={estilos.dotacionMovil}>
                          {s.asignados}
                          <span>/{s.requeridos}</span>
                          <span className="solo-lector"> programados</span>
                        </span>
                        <InsigniaRiesgo nivel={s.nivel_riesgo} prob={s.prob_deficit} />
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
