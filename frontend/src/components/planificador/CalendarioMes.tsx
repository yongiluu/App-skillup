import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getCalendario } from '../../api'
import { useDatos } from '../../lib/useDatos'
import { diaSemana, encabezadoDia, lunesDe, nombreMes } from '../../lib/fechas'
import { marcasDelDia } from '../../lib/calendario'
import Aviso from '../ui/Aviso'
import estilos from './Planificador.module.css'

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * Calendario del mes (GET /calendario): marca pago o quincena, feriados, vísperas y eventos.
 * Cada día lleva a su semana en la grilla. Se resalta la semana que se está viendo.
 */
export default function CalendarioMes({ mes, inicioSemana }: { mes: string; inicioSemana: string }) {
  const cargar = useCallback(() => getCalendario(mes), [mes])
  const datos = useDatos(cargar)

  return (
    <section className={estilos.calendario} aria-labelledby="titulo-calendario">
      <h2 id="titulo-calendario">Calendario de {nombreMes(mes)}</h2>

      {datos.estado === 'cargando' && <p role="status">Cargando calendario…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' && (
        <>
          <ol className={estilos.mes}>
            {SEMANA.map((d, i) => (
              <li key={i} className={estilos.cabeceraMes} aria-hidden="true">
                {d}
              </li>
            ))}
            {/* Huecos antes del día 1 para que calce con el día de la semana */}
            {Array.from({ length: diaSemana(datos.datos.dias[0]?.fecha ?? `${mes}-01`) }, (_, i) => (
              <li key={`h${i}`} aria-hidden="true" />
            ))}
            {datos.datos.dias.map((d) => {
              const marcas = marcasDelDia(d, false)
              const tipos = new Set(marcas.map((m) => m.tipo))
              const lunes = lunesDe(d.fecha)
              const enSemana = lunes === inicioSemana
              const etiqueta = [encabezadoDia(d.fecha).largo, ...marcas.map((m) => m.texto)].join('. ')
              return (
                <li key={d.fecha}>
                  <Link
                    to={`?inicio=${lunes}`}
                    className={`${estilos.diaMes} ${enSemana ? estilos.enSemana : ''} ${d.feriado ? estilos.esFeriado : ''}`}
                    aria-label={etiqueta}
                    title={marcas.map((m) => m.texto).join(' · ') || undefined}
                  >
                    <span>{Number(d.fecha.slice(8))}</span>
                    <span className={estilos.puntos} aria-hidden="true">
                      {tipos.has('pago') && <i className={estilos.pago} />}
                      {(tipos.has('feriado') || tipos.has('vispera')) && <i className={estilos.feriado} />}
                      {tipos.has('evento') && <i className={estilos.evento} />}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <ul className={estilos.leyendaMes}>
            <li>
              <i className={estilos.pago} /> Pago o quincena
            </li>
            <li>
              <i className={estilos.feriado} /> Feriado o víspera
            </li>
            <li>
              <i className={estilos.evento} /> Evento
            </li>
          </ul>
        </>
      )}
    </section>
  )
}
