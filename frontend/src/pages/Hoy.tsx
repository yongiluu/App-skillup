import { getServicios } from '../api'
import { useDatos } from '../lib/useDatos'
import { fechaLarga } from '../lib/formato'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso, { Pendiente } from '../components/ui/Aviso'
import SinPermiso from './SinPermiso'
import estilos from './Vistas.module.css'

// Estable entre renders (useDatos depende de la identidad de la función).
const cargarHoy = () => getServicios()

/**
 * Etapa 1: esqueleto de la vista con los 4 servicios del día, para validar el sistema
 * visual y el flujo de datos. Etapa 2: cobertura detallada, ausencias y sugerencias.
 */
export default function Hoy() {
  const datos = useDatos(cargarHoy)

  if (datos.estado === 'error' && datos.sinPermiso) return <SinPermiso />

  return (
    <>
      <EncabezadoPagina
        titulo="Hoy"
        bajada={datos.estado === 'listo' ? fechaLarga(datos.datos.fecha) : 'Cobertura del día'}
      />

      {datos.estado === 'cargando' && <p role="status">Cargando servicios…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' && (
        <div className={estilos.grilla}>
          {datos.datos.servicios.map((s) => (
            <Tarjeta
              key={s.servicio}
              titulo={s.horario}
              acento={s.nivel_riesgo}
              extra={<InsigniaRiesgo nivel={s.nivel_riesgo} prob={s.prob_deficit} />}
            >
              <p className={`${estilos.cifra} ${estilos[s.nivel_riesgo]}`}>
                {s.asignados}
                <span> de {s.requeridos} personas</span>
              </p>
              <div
                className={estilos.barra}
                role="img"
                aria-label={`${s.asignados} de ${s.requeridos} asignados`}
              >
                <i
                  className={estilos[s.nivel_riesgo]}
                  style={{ width: `${Math.min(100, (s.asignados / s.requeridos) * 100)}%` }}
                />
              </div>
              <p className={estilos.texto}>{s.recomendacion}</p>
            </Tarjeta>
          ))}
        </div>
      )}

      <div className={estilos.proximo}>
        <h2>En la etapa 2</h2>
        <ul>
          <li>Ausencias del día y acciones sugeridas (mover / llamar)</li>
          <li>Detalle por rol crítico: garzón, cocinero de línea y jefe de turno</li>
          <li>
            Tests psicológicos <Pendiente>Pendiente cervecería</Pendiente>
          </li>
        </ul>
      </div>
    </>
  )
}
