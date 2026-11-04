import { getAusencias, getServicios, getSolicitudes, getSugerencias } from '../api'
import { useSesion } from '../auth/sesion'
import { marcasDelDia } from '../lib/calendario'
import { useDatos } from '../lib/useDatos'
import { cobertura, rolMasEnRiesgo } from '../lib/cobertura'
import { NOMBRE_ROL, porcentaje } from '../lib/formato'
import { fechaLarga } from '../lib/formato'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso from '../components/ui/Aviso'
import AccionesSugeridas from '../components/hoy/AccionesSugeridas'
import AusenciasDia from '../components/hoy/AusenciasDia'
import { Kpis, RiesgoPorRol } from '../components/hoy/PanelJefe'
import panel from '../components/hoy/Panel.module.css'
import SinPermiso from './SinPermiso'
import estilos from './Vistas.module.css'

// Estables entre renders (useDatos depende de la identidad de la función).
// Sin fecha, la API usa su "hoy" (MOCK_HOY en el backend).
const cargarServicios = () => getServicios()
const cargarSugerencias = () => getSugerencias()
const cargarAusencias = () => getAusencias()
const cargarSolicitudes = () => getSolicitudes()

/**
 * Vista Hoy (jefe de turno), con el diseño del kit Luthier: saludo, cifras del día, cobertura de
 * los 4 servicios, riesgo por rol, acciones sugeridas y ausencias.
 */
export default function Hoy() {
  const servicios = useDatos(cargarServicios)
  const sugerencias = useDatos(cargarSugerencias)
  const ausencias = useDatos(cargarAusencias)
  const solicitudes = useDatos(cargarSolicitudes)
  const { sesion } = useSesion()

  if (servicios.estado === 'error' && servicios.sinPermiso) return <SinPermiso />

  const dia = servicios.estado === 'listo' ? servicios.datos : null

  return (
    <>
      <EncabezadoPagina
        saludo
        titulo="Hoy"
        bajada={`Hola, ${sesion?.nombre.split(' ')[0] ?? ''} · ${dia ? fechaLarga(dia.fecha) : 'cobertura del día'}`}
      />

      {dia && (
        <Kpis
          servicios={dia.servicios}
          ausencias={ausencias.estado === 'listo' ? ausencias.datos : null}
          solicitudes={solicitudes.estado === 'listo' ? solicitudes.datos : null}
        />
      )}

      {dia && marcasDelDia(dia.calendario).length > 0 && (
        <ul className={estilos.marcas} aria-label="Lo especial de este día">
          {marcasDelDia(dia.calendario).map((m) => (
            <li key={m.texto}>{m.texto}</li>
          ))}
        </ul>
      )}

      {servicios.estado === 'cargando' && <p role="status">Cargando servicios…</p>}
      {servicios.estado === 'error' && <Aviso tipo="error">{servicios.mensaje}</Aviso>}

      {dia && (
        <section aria-labelledby="titulo-servicios">
          <h2 id="titulo-servicios" className="solo-lector">
            Servicios del día
          </h2>
          <div className={estilos.grilla}>
            {dia.servicios.map((s) => {
              const c = cobertura(s, ausencias.estado === 'listo' ? ausencias.datos : null)
              const r = rolMasEnRiesgo(s)
              return (
                <Tarjeta
                  key={s.servicio}
                  titulo={s.horario}
                  acento={s.nivel_riesgo}
                  extra={<InsigniaRiesgo nivel={s.nivel_riesgo} prob={s.prob_deficit} />}
                >
                  <p className={`${estilos.cifra} ${estilos[s.nivel_riesgo]}`}>
                    {c.presentes}
                    <span>
                      {' '}
                      de {s.requeridos} {c.ausentes === null ? 'programados' : 'vienen'}
                    </span>
                  </p>
                  <div
                    className={estilos.barra}
                    role="img"
                    aria-label={`${c.presentes} de ${s.requeridos} requeridos`}
                  >
                    <i
                      className={estilos[s.nivel_riesgo]}
                      style={{ width: `${Math.min(100, (c.presentes / s.requeridos) * 100)}%` }}
                    />
                  </div>
                  {c.ausentes !== null && (
                    <p className={estilos.nota}>
                      {s.asignados} programados
                      {c.ausentes > 0 && ` · ${c.ausentes} ${c.ausentes > 1 ? 'ausentes' : 'ausente'}`}
                      {c.faltan > 0 && ` · falta${c.faltan > 1 ? 'n' : ''}\u00a0${c.faltan}`}
                    </p>
                  )}
                  {s.nivel_riesgo !== 'bajo' && (
                    <p className={estilos.rolRiesgo}>
                      Más en riesgo: <b>{NOMBRE_ROL[r.rol]}</b> · {porcentaje(r.prob)}
                    </p>
                  )}
                  <p className={estilos.texto}>{s.recomendacion}</p>
                  <p className={estilos.nota}>
                    {s.cubiertos_previstos} cubiertos previstos · {s.reservas} reservas
                  </p>
                </Tarjeta>
              )
            })}
          </div>
        </section>
      )}

      {dia && (
        <div className={panel.par}>
          <RiesgoPorRol servicios={dia.servicios} />
        </div>
      )}

      <div className={estilos.dosColumnas}>
        <Tarjeta titulo="Acciones sugeridas">
          {sugerencias.estado === 'cargando' && <p role="status">Cargando sugerencias…</p>}
          {sugerencias.estado === 'error' && <Aviso tipo="error">{sugerencias.mensaje}</Aviso>}
          {sugerencias.estado === 'listo' && <AccionesSugeridas sugerencias={sugerencias.datos} />}
        </Tarjeta>

        <Tarjeta titulo="Ausencias del día">
          {ausencias.estado === 'cargando' && <p role="status">Cargando ausencias…</p>}
          {ausencias.estado === 'error' && <Aviso tipo="error">{ausencias.mensaje}</Aviso>}
          {ausencias.estado === 'listo' &&
            (ausencias.datos === null ? (
              <Aviso>
                Esta versión de la API todavía no entrega las ausencias del día (<code>GET /ausencias</code>). Actualiza el
                backend a la última versión de <code>main</code>.
              </Aviso>
            ) : (
              <AusenciasDia ausencias={ausencias.datos} />
            ))}
        </Tarjeta>
      </div>
    </>
  )
}
