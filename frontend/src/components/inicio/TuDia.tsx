import type { Rol, Turno } from '../../api/tipos'
import { NOMBRE_ROL, horario } from '../../lib/formato'
import { encabezadoDia, sumarDias } from '../../lib/fechas'
import Icono from '../ui/Icono'
import type { NombreIcono } from '../ui/Icono'
import estilos from './Inicio.module.css'

/** Ícono según el rol (solo decorativo; el nombre del rol va escrito). */
const ICONO_ROL: Record<Rol, NombreIcono> = {
  garzon: 'salon',
  runner: 'salon',
  host: 'salon',
  cajero: 'barra',
  cocinero_linea: 'cocina',
  ayudante_cocina: 'cocina',
  copero: 'cocina',
  jefe_turno: 'equipo',
}

/** "13:00–15:00" → "13–15" */
const corto = (h: string) => h.replace(/:00/g, '')

/** "Tu turno de hoy": horarios en fichas grandes y el rol (kit Luthier). */
export function TuTurnoHoy({ turnos, hoy }: { turnos: Turno[]; hoy: string }) {
  const deHoy = turnos.filter((t) => t.fecha === hoy).sort((a, b) => a.servicio.localeCompare(b.servicio))
  const proximo = turnos.find((t) => t.fecha > hoy)

  return (
    <section className={estilos.tarjeta} aria-labelledby="titulo-turno-hoy">
      <h2 id="titulo-turno-hoy" className={estilos.tituloTarjeta}>
        <span className={estilos.iconoTitulo}>
          <Icono nombre="reloj" tamano={18} />
        </span>
        Tu turno de hoy
      </h2>
      {deHoy.length > 0 ? (
        <>
          <ul className={estilos.fichas}>
            {deHoy.map((t) => (
              <li key={t.servicio}>
                <Icono nombre="reloj" tamano={16} />
                {horario(t.servicio, t.fecha)}
              </li>
            ))}
          </ul>
          <p className={estilos.rol}>
            <span className={estilos.iconoTitulo}>
              <Icono nombre={ICONO_ROL[deHoy[0].rol]} tamano={18} />
            </span>
            {[...new Set(deHoy.map((t) => NOMBRE_ROL[t.rol]))].join(' · ')}
          </p>
        </>
      ) : (
        <p className={estilos.libre}>
          Hoy no tienes turno.
          {proximo && ` El próximo es el ${encabezadoDia(proximo.fecha).largo}.`}
        </p>
      )}
    </section>
  )
}

/** "Tu semana": los 7 días desde hoy, con sus franjas o "libre". */
export function TuSemana({ turnos, hoy }: { turnos: Turno[]; hoy: string }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i))
  return (
    <section className={estilos.semana} aria-labelledby="titulo-semana">
      <h2 id="titulo-semana" className={estilos.tituloSeccion}>
        <span className={estilos.iconoTitulo}>
          <Icono nombre="dias" tamano={18} />
        </span>
        Tu semana
      </h2>
      <ol className={estilos.dias7}>
        {dias.map((d) => {
          const del = turnos.filter((t) => t.fecha === d).sort((a, b) => a.servicio.localeCompare(b.servicio))
          const e = encabezadoDia(d)
          return (
            <li key={d} className={`${d === hoy ? estilos.diaHoy : ''} ${del.length === 0 ? estilos.diaLibre : ''}`}>
              <span className={estilos.nombreDia}>
                {e.corto}
                <b>{e.numero}</b>
                {d === hoy && <span className="solo-lector"> (hoy)</span>}
              </span>
              {del.length > 0 ? (
                del.map((t) => <span key={t.servicio}>{corto(horario(t.servicio, t.fecha))}</span>)
              ) : (
                <span>libre</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
