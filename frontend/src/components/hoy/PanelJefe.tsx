import { Link } from 'react-router-dom'
import type { AusenciaDia, NivelRiesgo, RolCritico, Servicio, SolicitudCambio } from '../../api/tipos'
import { NOMBRE_ROL, porcentaje } from '../../lib/formato'
import { ETIQUETA_RIESGO, nivelDeRiesgo } from '../../lib/riesgo'
import { cobertura } from '../../lib/cobertura'
import Icono from '../ui/Icono'
import type { NombreIcono } from '../ui/Icono'
import estilos from './Panel.module.css'

/*
 * Panel del jefe con el diseño del kit Luthier v14.
 * Solo usa datos que la API ya entrega (GET /servicios, /ausencias y /solicitudes-cambio):
 * no agrega variables ni cálculos nuevos al modelo.
 */

const ICONO_NIVEL: Record<NivelRiesgo, NombreIcono> = { bajo: 'ok', alerta: 'alerta', alto: 'alto' }
const ROLES: RolCritico[] = ['garzon', 'cocinero_linea', 'jefe_turno']
/** "13:00–15:00" → "13–15" */
const corto = (h: string) => h.replace(/:00/g, '')

function Kpi({
  icono,
  titulo,
  cifra,
  de,
  nota,
  nivel,
  enlace,
}: {
  icono: NombreIcono
  titulo: string
  cifra: number | string
  de?: string
  nota: string
  nivel?: NivelRiesgo
  enlace?: string
}) {
  const contenido = (
    <>
      <span className={estilos.kpiIcono}>
        <Icono nombre={icono} tamano={20} />
      </span>
      <span>
        <span className={estilos.kpiTitulo}>{titulo}</span>
        <span className={estilos.kpiCifra}>
          {cifra}
          {de && <small> {de}</small>}
        </span>
        <span className={estilos.kpiNota}>{nota}</span>
      </span>
    </>
  )
  const clase = `${estilos.kpi} ${nivel ? estilos[`kpi_${nivel}`] : ''}`
  return (
    <li>
      {enlace ? (
        <Link to={enlace} className={`${clase} ${estilos.kpiEnlace}`}>
          {contenido}
        </Link>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
    </li>
  )
}

/** Tres cifras arriba de Hoy: el servicio más crítico, las ausencias y las solicitudes por responder. */
export function Kpis({
  servicios,
  ausencias,
  solicitudes,
}: {
  servicios: Servicio[]
  ausencias: AusenciaDia[] | null
  solicitudes: SolicitudCambio[] | null
}) {
  const critico = [...servicios].sort((a, b) => b.prob_deficit - a.prob_deficit)[0]
  const c = critico ? cobertura(critico, ausencias) : null
  const faltan = c?.faltan ?? 0
  const pendientes = solicitudes?.filter((s) => s.estado === 'pendiente').length
  const cortos = ausencias?.filter((a) => a.aviso_corto).length ?? 0

  return (
    <ul className={estilos.kpis} aria-label="Resumen del día">
      {critico && (
        <Kpi
          icono="grafico"
          titulo={`Crítico ${corto(critico.horario)}`}
          cifra={c!.presentes}
          de={`de ${critico.requeridos}`}
          nota={`${faltan > 0 ? `Faltan ${faltan} · ` : ''}${ETIQUETA_RIESGO[critico.nivel_riesgo]} · ${porcentaje(critico.prob_deficit)}`}
          nivel={critico.nivel_riesgo}
        />
      )}
      <Kpi
        icono="persona"
        titulo="Ausencias"
        cifra={ausencias ? ausencias.length : '—'}
        nota={ausencias ? (cortos > 0 ? `${cortos} aviso corto` : 'Sin aviso corto') : 'Sin datos'}
      />
      <Kpi
        icono="solicitudes"
        titulo="Solicitudes"
        cifra={pendientes ?? '—'}
        nota="Por responder"
        enlace="/solicitudes"
      />
    </ul>
  )
}

/**
 * Riesgo por rol crítico y servicio (prob_por_rol del modelo).
 * Cada celda: color + ícono + porcentaje, nunca solo color.
 */
export function RiesgoPorRol({ servicios }: { servicios: Servicio[] }) {
  return (
    <section className={estilos.bloque} aria-labelledby="titulo-riesgo-rol">
      <h2 id="titulo-riesgo-rol" className={estilos.tituloBloque}>
        <span className={estilos.iconoTitulo}>
          <Icono nombre="grafico" tamano={18} />
        </span>
        Riesgo por rol
      </h2>
      <div className={estilos.tablaScroll}>
        <table className={estilos.mapa}>
          <caption className="solo-lector">Probabilidad de que falte cada rol crítico, por servicio</caption>
          <thead>
            <tr>
              <th scope="col">Rol</th>
              {servicios.map((s) => (
                <th key={s.servicio} scope="col">
                  {corto(s.horario)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r}>
                <th scope="row">{NOMBRE_ROL[r]}</th>
                {servicios.map((s) => {
                  const p = s.prob_por_rol[r]
                  const n = nivelDeRiesgo(p)
                  return (
                    <td key={s.servicio}>
                      <span className={`${estilos.celda} ${estilos[`celda_${n}`]}`} title={ETIQUETA_RIESGO[n]}>
                        <Icono nombre={ICONO_NIVEL[n]} tamano={14} />
                        {porcentaje(p)}
                        <span className="solo-lector"> ({ETIQUETA_RIESGO[n]})</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={estilos.nota}>Probabilidad de que falte alguien de ese rol (modelo de déficit).</p>
    </section>
  )
}
