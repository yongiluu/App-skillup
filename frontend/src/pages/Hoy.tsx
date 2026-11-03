import { getAusencias, getServicios, getSugerencias } from '../api'
import { marcasDelDia } from '../lib/calendario'
import { useDatos } from '../lib/useDatos'
import { fechaLarga } from '../lib/formato'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso from '../components/ui/Aviso'
import AccionesSugeridas from '../components/hoy/AccionesSugeridas'
import AusenciasDia from '../components/hoy/AusenciasDia'
import SinPermiso from './SinPermiso'
import estilos from './Vistas.module.css'

// Estables entre renders (useDatos depende de la identidad de la función).
// Sin fecha, la API usa su "hoy" (MOCK_HOY en el backend).
const cargarServicios = () => getServicios()
const cargarSugerencias = () => getSugerencias()
const cargarAusencias = () => getAusencias()

/** Vista Hoy (jefe de turno): cobertura de los 4 servicios, acciones sugeridas y ausencias. */
export default function Hoy() {
  const servicios = useDatos(cargarServicios)
  const sugerencias = useDatos(cargarSugerencias)
  const ausencias = useDatos(cargarAusencias)

  if (servicios.estado === 'error' && servicios.sinPermiso) return <SinPermiso />

  const dia = servicios.estado === 'listo' ? servicios.datos : null

  return (
    <>
      <EncabezadoPagina titulo="Hoy" bajada={dia ? fechaLarga(dia.fecha) : 'Cobertura del día'} />

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
            {dia.servicios.map((s) => (
              <Tarjeta
                key={s.servicio}
                titulo={s.horario}
                acento={s.nivel_riesgo}
                extra={<InsigniaRiesgo nivel={s.nivel_riesgo} prob={s.prob_deficit} />}
              >
                <p className={`${estilos.cifra} ${estilos[s.nivel_riesgo]}`}>
                  {s.asignados}
                  <span> de {s.requeridos} programados</span>
                </p>
                <div
                  className={estilos.barra}
                  role="img"
                  aria-label={`${s.asignados} de ${s.requeridos} programados`}
                >
                  <i
                    className={estilos[s.nivel_riesgo]}
                    style={{ width: `${Math.min(100, (s.asignados / s.requeridos) * 100)}%` }}
                  />
                </div>
                <p className={estilos.texto}>{s.recomendacion}</p>
                <p className={estilos.nota}>
                  {s.cubiertos_previstos} cubiertos previstos · {s.reservas} reservas
                </p>
              </Tarjeta>
            ))}
          </div>
        </section>
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
