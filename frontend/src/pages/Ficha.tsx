import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFicha } from '../api'
import { useDatos } from '../lib/useDatos'
import { NOMBRE_ROL, fechaBreve, fechaCorta, horario } from '../lib/formato'
import type { Rol } from '../api/tipos'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso from '../components/ui/Aviso'
import BienestarFicha from '../components/bienestar/Bienestar'
import SinPermiso from './SinPermiso'
import estilos from './Ficha.module.css'

const rol = (r: string) => NOMBRE_ROL[r as Rol] ?? r

/** Ficha del empleado (vista del jefe). Etapa 1: datos básicos + bienestar; el resto se pule en la etapa 3. */
export default function Ficha() {
  const { id = '' } = useParams()
  const cargar = useCallback(() => getFicha(id), [id])
  const datos = useDatos(cargar)

  if (datos.estado === 'error' && datos.sinPermiso) return <SinPermiso />

  return (
    <>
      <p className={estilos.volver}>
        <Link to="/equipo">← Equipo</Link>
      </p>

      {datos.estado === 'cargando' && <p role="status">Cargando ficha…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' &&
        (() => {
          const f = datos.datos
          return (
            <>
              <EncabezadoPagina
                titulo={f.nombre}
                bajada={`${rol(f.rol)}${f.puede_cubrir.length ? ` · también cubre ${f.puede_cubrir.map(rol).join(', ')}` : ''}`}
              />
              <div className={estilos.columnas}>
                <div className={estilos.columna}>
                  <Tarjeta titulo="Jornada">
                    <dl className={estilos.datos}>
                      <div>
                        <dt>Días seguidos trabajados</dt>
                        <dd>{f.dias_seguidos_trabajados}</dd>
                      </div>
                      <div>
                        <dt>Horas extra (7 días)</dt>
                        <dd>{f.horas_extra_ultimos_7_dias.toLocaleString('es-CL')}</dd>
                      </div>
                      <div>
                        <dt>Antigüedad</dt>
                        <dd>{f.antiguedad_anos} años</dd>
                      </div>
                    </dl>
                  </Tarjeta>

                  <Tarjeta titulo="Próximos turnos">
                    {f.proximos_turnos.length === 0 ? (
                      <p className={estilos.vacio}>Sin turnos próximos.</p>
                    ) : (
                      <ul className={estilos.lista}>
                        {f.proximos_turnos.map((t) => (
                          <li key={`${t.fecha}-${t.servicio}-${t.rol}`}>
                            <span>{fechaBreve(t.fecha)}</span>
                            <span>
                              {horario(t.servicio, t.fecha)} · {rol(t.rol)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Ausencias recientes">
                    {f.ausencias.length === 0 ? (
                      <p className={estilos.vacio}>Sin ausencias registradas.</p>
                    ) : (
                      <ul className={estilos.lista}>
                        {f.ausencias.map((a, i) => (
                          <li key={`${a.fecha}-${i}`}>
                            <span>{fechaCorta(a.fecha)}</span>
                            <span>
                              {a.motivo === 'salud' ? 'Salud' : 'Personal'}
                              {a.aviso_corto ? ' · aviso corto' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Tarjeta>
                </div>

                <Tarjeta titulo="Bienestar">
                  <BienestarFicha vista="jefe" bienestar={f.bienestar} />
                </Tarjeta>
              </div>
            </>
          )
        })()}
    </>
  )
}
