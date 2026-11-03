import { Link } from 'react-router-dom'
import { getFatigaEquipo } from '../api'
import type { FatigaEquipo } from '../api/tipos'
import { useDatos } from '../lib/useDatos'
import { NOMBRE_ROL } from '../lib/formato'
import { COLOR_FATIGA, ETIQUETA_FATIGA } from '../lib/bienestar'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import Aviso from '../components/ui/Aviso'
import SinPermiso from './SinPermiso'
import estilos from './Equipo.module.css'

const cargarEquipo = () => getFatigaEquipo()

function EstadoBienestar({ p }: { p: FatigaEquipo }) {
  if (p.estado === 'ok' && p.fatiga) {
    return <InsigniaRiesgo nivel={COLOR_FATIGA[p.fatiga.nivel]} etiqueta={ETIQUETA_FATIGA[p.fatiga.nivel]} />
  }
  return (
    <span className={estilos.neutro}>{p.estado === 'sin_consentimiento' ? 'Sin consentimiento' : 'Sin datos'}</span>
  )
}

/**
 * Lista del equipo con el indicador de fatiga (GET /bienestar/fatiga, solo jefe).
 * La lista completa con filtros y la ficha completa son de la etapa 3.
 */
export default function Equipo() {
  const datos = useDatos(cargarEquipo)

  if (datos.estado === 'error' && datos.sinPermiso) return <SinPermiso />

  return (
    <>
      <EncabezadoPagina
        titulo="Equipo"
        bajada={datos.estado === 'listo' ? `${datos.datos.length} personas` : 'Fichas y bienestar del equipo'}
      />
      <div className={estilos.aviso}>
        <Aviso>
          El indicador de fatiga usa datos simulados que cada persona autorizó. Aquí solo ves el nivel; el detalle lo ve
          únicamente la persona.
        </Aviso>
      </div>

      {datos.estado === 'cargando' && <p role="status">Cargando equipo…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' && (
        <ul className={estilos.lista}>
          {datos.datos.map((p) => (
            <li key={p.empleado_id}>
              <Link to={`/equipo/${p.empleado_id}`} className={estilos.fila}>
                <span className={estilos.quien}>
                  <b>{p.nombre}</b>
                  <span>{NOMBRE_ROL[p.rol]}</span>
                </span>
                <EstadoBienestar p={p} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
