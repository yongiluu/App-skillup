import { useSesion } from '../auth/sesion'
import { getSolicitudes } from '../api'
import type { SolicitudCambio } from '../api/tipos'
import { useDatos } from '../lib/useDatos'
import { useEquipo } from '../lib/useNombres'
import { HORARIO_FRANJA } from '../lib/formato'
import { encabezadoDia } from '../lib/fechas'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Aviso from '../components/ui/Aviso'
import EstadoSolicitud from '../components/solicitudes/EstadoSolicitud'
import estilos from '../components/solicitudes/Solicitudes.module.css'

const cargar = () => getSolicitudes()
const masNuevaPrimero = (a: SolicitudCambio, b: SolicitudCambio) => b.creada_en.localeCompare(a.creada_en)

/** Solicitudes del empleado: las que pidió y aquellas en que lo proponen como reemplazo. */
export default function MisSolicitudes() {
  const { sesion } = useSesion()
  const yo = sesion?.empleadoId
  const datos = useDatos(cargar)
  const { nombre } = useEquipo()

  const mias = datos.estado === 'listo' ? datos.datos.filter((s) => s.solicitante_id === yo).sort(masNuevaPrimero) : []
  const comoReemplazo =
    datos.estado === 'listo' ? datos.datos.filter((s) => s.reemplazo_id === yo).sort(masNuevaPrimero) : []

  return (
    <>
      <EncabezadoPagina titulo="Solicitudes" bajada="Cambios de turno que pediste" />
      {datos.estado === 'cargando' && <p role="status">Cargando solicitudes…</p>}
      {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}

      {datos.estado === 'listo' && (
        <>
          {mias.length === 0 ? (
            <p className={estilos.vacio}>
              Todavía no pides cambios. Puedes hacerlo desde <b>Mis turnos</b>.
            </p>
          ) : (
            <ul className={estilos.tarjetas}>
              {mias.map((s) => (
                <li key={s.id} className={estilos.tarjeta}>
                  <div className={estilos.cabeceraSolicitud}>
                    <b>
                      {encabezadoDia(s.fecha).largo} · {HORARIO_FRANJA[s.servicio]}
                    </b>
                    <EstadoSolicitud estado={s.estado} />
                  </div>
                  <p className={estilos.detalle}>
                    {s.reemplazo_id ? `Reemplazo propuesto: ${nombre(s.reemplazo_id)}` : 'Sin reemplazo propuesto'}
                  </p>
                  {s.motivo && <p className={estilos.detalle}>Motivo: {s.motivo}</p>}
                  {s.comentario && (
                    <p className={estilos.comentario}>
                      <b>Jefe de turno:</b> {s.comentario}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {comoReemplazo.length > 0 && (
            <>
              <h2 className={estilos.subtitulo}>Te propusieron como reemplazo</h2>
              <ul className={estilos.tarjetas}>
                {comoReemplazo.map((s) => (
                  <li key={s.id} className={estilos.tarjeta}>
                    <div className={estilos.cabeceraSolicitud}>
                      <b>
                        {encabezadoDia(s.fecha).largo} · {HORARIO_FRANJA[s.servicio]}
                      </b>
                      <EstadoSolicitud estado={s.estado} />
                    </div>
                    <p className={estilos.detalle}>Pidió el cambio: {nombre(s.solicitante_id)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  )
}
