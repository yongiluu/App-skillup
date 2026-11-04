import type { Bienestar, BienestarPropio, EstadoBienestar } from '../../api/tipos'
import { COLOR_FATIGA, ETIQUETA_FATIGA, textoMotivos } from '../../lib/bienestar'
import { fechaBreve, fechaCorta } from '../../lib/formato'
import InsigniaRiesgo from '../ui/InsigniaRiesgo'
import Aviso, { Pendiente } from '../ui/Aviso'
import estilos from './Bienestar.module.css'

/**
 * Bienestar en la ficha. Siempre muestra uno de los 3 casos:
 *  - ok: indicador de fatiga + aviso de consentimiento
 *  - sin_consentimiento: no se muestra ni se calcula nada
 *  - sin_datos: autorizó, pero no hay registros recientes
 *
 * vista="jefe": SOLO nivel y motivo general (lo que manda /empleados/{id}). Nunca datos crudos.
 * vista="propia": además, los registros de la propia persona (/empleados/{id}/bienestar).
 */
type Props =
  | { vista: 'jefe'; bienestar: Bienestar }
  | { vista: 'propia'; bienestar: BienestarPropio }

const ETIQUETA_ESTADO: Record<Exclude<EstadoBienestar, 'ok'>, string> = {
  // Palabra neutra (evaluación heurística AP-05): no presiona a quien no autorizó
  sin_consentimiento: 'Sin indicador',
  sin_datos: 'Sin datos recientes',
}

export default function BienestarFicha(props: Props) {
  const { bienestar } = props
  const { consentimiento, fatiga } = bienestar
  const propia = props.vista === 'propia'

  return (
    <div className={estilos.bienestar} data-estado={bienestar.estado}>
      {bienestar.estado === 'ok' && fatiga && (
        <div className={estilos.indicador}>
          <InsigniaRiesgo nivel={COLOR_FATIGA[fatiga.nivel]} etiqueta={ETIQUETA_FATIGA[fatiga.nivel]} />
          <p className={estilos.motivos}>{textoMotivos(fatiga.motivos)}</p>
          <p className={estilos.nota}>
            Calculado con {fatiga.dias_considerados} días, al {fechaCorta(fatiga.calculado_al)}. Es una regla simple, no
            un diagnóstico.
          </p>
        </div>
      )}

      {bienestar.estado !== 'ok' && (
        <div className={estilos.vacio}>
          <span className={estilos.estado}>{ETIQUETA_ESTADO[bienestar.estado]}</span>
          <p className={estilos.motivos}>
            {bienestar.estado === 'sin_consentimiento'
              ? propia
                ? 'No autorizaste el uso de tus datos de bienestar, así que no se guarda ni se calcula nada.'
                : 'Esta persona no comparte datos de bienestar. No se muestra ni se calcula nada, y eso no la favorece ni la perjudica en las sugerencias.'
              : propia
                ? 'Autorizaste el uso de tus datos, pero no hay registros de los últimos días (por ejemplo, si no usaste el reloj).'
                : 'Autorizó el uso de sus datos, pero no hay registros de los últimos días.'}
          </p>
        </div>
      )}

      {consentimiento.otorgado && consentimiento.fecha && (
        <Aviso>
          {propia ? 'Autorizaste' : 'Autorizó'} el uso de datos de bienestar el {fechaCorta(consentimiento.fecha)} (texto{' '}
          {consentimiento.version_texto}).{' '}
          {propia
            ? 'Tu jefe de turno solo ve el nivel de fatiga y el motivo general; el detalle lo ves solo tú.'
            : 'Solo ves el nivel y el motivo general: el detalle (sueño, pasos, pulso y encuesta) lo ve únicamente la persona.'}{' '}
          Datos simulados.
        </Aviso>
      )}

      {props.vista === 'propia' && props.bienestar.estado !== 'sin_consentimiento' && props.bienestar.registros.length > 0 && (
        <TablaRegistros registros={props.bienestar.registros.slice(-7)} />
      )}

      <p className={estilos.tests}>
        Tests: <Pendiente>Pendiente</Pendiente>
      </p>
    </div>
  )
}

function TablaRegistros({ registros }: { registros: BienestarPropio['registros'] }) {
  const v = (x: number | null, dec = 0) =>
    x === null ? '—' : x.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return (
    <div className={estilos.tablaCaja}>
      <p className={estilos.escala}>
        <b>Cansancio:</b> 1 = muy alerta · 7 = agotado/a. El primer número es al llegar y el segundo, al salir.
      </p>
      <table className={estilos.tabla}>
        <caption>Tus últimos {registros.length} días</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Sueño</th>
            <th scope="col">Pasos</th>
            <th scope="col">Pulso</th>
            <th scope="col">Cansancio</th>
          </tr>
        </thead>
        <tbody>
          {[...registros].reverse().map((r) => (
            <tr key={r.fecha}>
              <th scope="row" title={fechaBreve(r.fecha)}>
                {new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }).replace(',', '')}
              </th>
              <td>{r.sueno_horas === null ? '—' : `${v(r.sueno_horas, 1)} h`}</td>
              <td>{v(r.pasos)}</td>
              <td>{v(r.pulso_medio_bpm)}</td>
              <td>
                {r.encuesta_fatiga_inicio} → {r.encuesta_fatiga_fin}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={estilos.leyenda}>
        Pulso medio en latidos por minuto. “—” = el reloj no registró ese día.
      </p>
    </div>
  )
}
