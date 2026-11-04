import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFatigaEquipo } from '../api'
import type { FatigaEquipo, Rol } from '../api/tipos'
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
  // Misma etiqueta neutra para "sin consentimiento" y "sin datos": el jefe no debe saber quién dijo que no (AP-05)
  return <span className={estilos.neutro}>Sin indicador</span>
}

const PESO_FATIGA = { alto: 0, medio: 1, bajo: 2 } as const
const pesoFatiga = (p: FatigaEquipo) => (p.estado === 'ok' && p.fatiga ? PESO_FATIGA[p.fatiga.nivel] : 3)
/** Compara sin tildes ni mayúsculas ("cristobal" encuentra a "Cristóbal"). */
const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Lista del equipo con el indicador de fatiga (GET /bienestar/fatiga, solo jefe).
 * Buscador por nombre, filtro por rol y orden alfabético o por fatiga (evaluación heurística AP-06).
 */
export default function Equipo() {
  const datos = useDatos(cargarEquipo)
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<Rol | ''>('')
  const [orden, setOrden] = useState<'nombre' | 'fatiga'>('nombre')

  const lista = useMemo(() => {
    if (datos.estado !== 'listo') return []
    const q = normal(busqueda.trim())
    return datos.datos
      .filter((p) => (!q || normal(p.nombre).includes(q)) && (!rol || p.rol === rol))
      .sort((a, b) =>
        orden === 'fatiga'
          ? pesoFatiga(a) - pesoFatiga(b) || a.nombre.localeCompare(b.nombre, 'es')
          : a.nombre.localeCompare(b.nombre, 'es'),
      )
  }, [datos, busqueda, rol, orden])

  const roles = datos.estado === 'listo' ? [...new Set(datos.datos.map((p) => p.rol))] : []

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
        <div className={estilos.filtros} role="search">
          <label className={estilos.campo}>
            <span>Buscar por nombre</span>
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: Cristóbal" />
          </label>
          <label className={estilos.campo}>
            <span>Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol | '')}>
              <option value="">Todos los roles</option>
              {roles
                .sort((a, b) => NOMBRE_ROL[a].localeCompare(NOMBRE_ROL[b], 'es'))
                .map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_ROL[r]}
                  </option>
                ))}
            </select>
          </label>
          <label className={estilos.campo}>
            <span>Ordenar</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as 'nombre' | 'fatiga')}>
              <option value="nombre">Por nombre (A–Z)</option>
              <option value="fatiga">Por fatiga (alta primero)</option>
            </select>
          </label>
          <p className={estilos.conteo} role="status">
            {lista.length === datos.datos.length ? `${lista.length} personas` : `${lista.length} de ${datos.datos.length} personas`}
          </p>
        </div>
      )}

      {datos.estado === 'listo' && lista.length === 0 && <p className={estilos.conteo}>Nadie coincide con la búsqueda.</p>}

      {datos.estado === 'listo' && lista.length > 0 && (
        <ul className={estilos.lista}>
          {lista.map((p) => (
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
