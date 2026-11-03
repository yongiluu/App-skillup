import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { getSolicitudes, getTurnos } from '../api'
import type { SolicitudCambio, Turno } from '../api/tipos'
import { useDatos } from '../lib/useDatos'
import { useEquipo } from '../lib/useNombres'
import { HORARIO_FRANJA, NOMBRE_ROL } from '../lib/formato'
import { encabezadoDia } from '../lib/fechas'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import EstadoSolicitud from '../components/solicitudes/EstadoSolicitud'
import FormularioCambio from '../components/solicitudes/FormularioCambio'
import estilos from '../components/solicitudes/Solicitudes.module.css'

const cargarSolicitudes = () => getSolicitudes()
const clave = (t: { fecha: string; servicio: string }) => `${t.fecha}|${t.servicio}`

/** Agrupa los turnos por día, en orden. */
function porDia(turnos: Turno[]) {
  const dias = new Map<string, Turno[]>()
  for (const t of [...turnos].sort((a, b) => clave(a).localeCompare(clave(b)))) {
    dias.set(t.fecha, [...(dias.get(t.fecha) ?? []), t])
  }
  return [...dias.entries()]
}

/**
 * Inicio del empleado (celular): sus próximos turnos y "Pedir cambio" en cada uno.
 * Un turno con una solicitud pendiente o aprobada muestra el estado en vez del botón.
 */
export default function MisTurnos() {
  const { sesion } = useSesion()
  const id = sesion?.empleadoId ?? ''
  const hoy = sesion?.hoy

  const cargarTurnos = useCallback(() => getTurnos(id, hoy), [id, hoy])
  const turnos = useDatos(cargarTurnos)
  const solicitudes = useDatos(cargarSolicitudes)
  const { empleados } = useEquipo()

  const [abierto, setAbierto] = useState<string | null>(null)
  const [enviada, setEnviada] = useState<SolicitudCambio | null>(null)

  // Última solicitud propia de cada turno (la más nueva manda)
  const solicitudDe = new Map<string, SolicitudCambio>()
  if (solicitudes.estado === 'listo') {
    for (const s of solicitudes.datos) if (s.solicitante_id === id) solicitudDe.set(clave(s), s)
  }

  return (
    <>
      <EncabezadoPagina titulo={`Hola, ${sesion?.nombre.split(' ')[0] ?? ''}`} bajada="Tus próximos turnos" />

      {enviada && (
        <div className={estilos.confirmacion}>
          <Aviso>
            Solicitud enviada para el {encabezadoDia(enviada.fecha).largo}, {HORARIO_FRANJA[enviada.servicio]}. Tu jefe
            de turno la va a revisar. Puedes seguirla en <Link to="/mis-solicitudes">Solicitudes</Link>.
          </Aviso>
        </div>
      )}

      {turnos.estado === 'cargando' && <p role="status">Cargando turnos…</p>}
      {turnos.estado === 'error' && <Aviso tipo="error">{turnos.mensaje}</Aviso>}
      {turnos.estado === 'listo' && turnos.datos.length === 0 && (
        <p className={estilos.vacio}>No tienes turnos programados desde hoy.</p>
      )}

      {turnos.estado === 'listo' && (
        <div className={estilos.dias}>
          {porDia(turnos.datos).map(([fecha, lista]) => (
            <section key={fecha} className={`${estilos.dia} ${fecha === hoy ? estilos.esHoy : ''}`}>
              <h2>
                {encabezadoDia(fecha).largo}
                {fecha === hoy && <span className={estilos.etiquetaHoy}>Hoy</span>}
              </h2>
              <ul>
                {lista.map((t) => {
                  const s = solicitudDe.get(clave(t))
                  const puedePedir = !s || s.estado === 'rechazada'
                  return (
                    <li key={clave(t)}>
                      <div className={estilos.turno}>
                        <span>
                          <b>{HORARIO_FRANJA[t.servicio]}</b>
                          <span className={estilos.detalle}>{NOMBRE_ROL[t.rol]}</span>
                        </span>
                        {s && <EstadoSolicitud estado={s.estado} />}
                        {puedePedir && abierto !== clave(t) && (
                          <Boton variante="secundario" onClick={() => setAbierto(clave(t))}>
                            {s ? 'Pedir otra vez' : 'Pedir cambio'}
                          </Boton>
                        )}
                      </div>
                      {abierto === clave(t) && (
                        <FormularioCambio
                          turno={t}
                          equipo={empleados}
                          alCancelar={() => setAbierto(null)}
                          alEnviar={(nueva) => {
                            setAbierto(null)
                            setEnviada(nueva)
                            solicitudes.recargar()
                          }}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
