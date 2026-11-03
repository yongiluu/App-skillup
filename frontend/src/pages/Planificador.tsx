import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSemana, getServicios } from '../api'
import { useDatos } from '../lib/useDatos'
import { mesDe, rangoSemana, sumarDias } from '../lib/fechas'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import GrillaSemana from '../components/planificador/GrillaSemana'
import CalendarioMes from '../components/planificador/CalendarioMes'
import SinPermiso from './SinPermiso'
import estilos from '../components/planificador/Planificador.module.css'

// "Hoy" según la API (sin fecha, /servicios responde el día de hoy).
const cargarHoy = () => getServicios().then((d) => d.fecha)

/**
 * Planificador semanal (jefe de turno, solo lectura): GET /semana y GET /calendario.
 * La semana va en la URL (?inicio=YYYY-MM-DD) para poder compartirla o volver con "atrás".
 */
export default function Planificador() {
  const [params, setParams] = useSearchParams()
  const inicio = params.get('inicio') ?? undefined
  const cargar = useCallback(() => getSemana(inicio), [inicio])
  const semana = useDatos(cargar)
  const hoy = useDatos(cargarHoy) // para marcar el día de hoy en la grilla

  if (semana.estado === 'error' && semana.sinPermiso) return <SinPermiso />

  const datos = semana.estado === 'listo' ? semana.datos : null
  const base = datos?.inicio ?? inicio
  const irA = (dias: number) => base && setParams({ inicio: sumarDias(base, dias) })

  return (
    <>
      <EncabezadoPagina
        titulo="Planificador semanal"
        bajada={datos ? `Semana del ${rangoSemana(datos.inicio, datos.fin)}` : 'Dotación y riesgo por servicio'}
      >
        <nav aria-label="Cambiar de semana" className={estilos.navSemana}>
          <Boton variante="secundario" onClick={() => irA(-7)} disabled={!base}>
            ← Anterior
          </Boton>
          <Boton variante="secundario" onClick={() => setParams({})} disabled={!inicio}>
            Esta semana
          </Boton>
          <Boton variante="secundario" onClick={() => irA(7)} disabled={!base}>
            Siguiente →
          </Boton>
        </nav>
      </EncabezadoPagina>

      {semana.estado === 'cargando' && <p role="status">Cargando semana…</p>}
      {semana.estado === 'error' && (
        <div className={estilos.error}>
          <Aviso tipo="error">{semana.mensaje}</Aviso>
          <Boton onClick={() => setParams({})}>Volver a la semana actual</Boton>
        </div>
      )}

      {datos && (
        <>
          <ul className={estilos.leyenda} aria-label="Cómo leer la grilla">
            <li>
              <b>10/12</b> = programados / requeridos
            </li>
            <li>
              <InsigniaRiesgo nivel="bajo" />
            </li>
            <li>
              <InsigniaRiesgo nivel="alerta" etiqueta="Alerta ≥ 55 %" />
            </li>
            <li>
              <InsigniaRiesgo nivel="alto" etiqueta="Riesgo alto ≥ 75 %" />
            </li>
          </ul>
          <GrillaSemana semana={datos} hoy={hoy.estado === 'listo' ? hoy.datos : undefined} />
          <CalendarioMes mes={mesDe(datos.inicio)} inicioSemana={datos.inicio} />
        </>
      )}
    </>
  )
}
