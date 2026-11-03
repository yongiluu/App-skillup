import { useCallback } from 'react'
import { useSesion } from '../auth/sesion'
import { getBienestarPropio } from '../api'
import { useDatos } from '../lib/useDatos'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso, { Pendiente } from '../components/ui/Aviso'
import BienestarFicha from '../components/bienestar/Bienestar'
import estilos from './MiTurno.module.css'

/**
 * Inicio del perfil empleado. Etapa 1: su bienestar (datos propios).
 * Mis turnos, pedir cambio y turnos extra son de la etapa 3.
 */
export default function MiTurno() {
  const { sesion, cerrarSesion } = useSesion()
  const id = sesion?.empleadoId ?? ''
  const cargar = useCallback(() => getBienestarPropio(id), [id])
  const datos = useDatos(cargar)

  return (
    <main className={estilos.pagina}>
      <EncabezadoPagina titulo={`Hola, ${sesion?.nombre.split(' ')[0] ?? ''}`} bajada="Tu bienestar y tus turnos">
        <Boton variante="secundario" onClick={() => cerrarSesion()}>
          Salir
        </Boton>
      </EncabezadoPagina>

      <Tarjeta titulo="Mi bienestar">
        {datos.estado === 'cargando' && <p role="status">Cargando…</p>}
        {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}
        {datos.estado === 'listo' && <BienestarFicha vista="propia" bienestar={datos.datos} />}
      </Tarjeta>

      <p className={estilos.proximo}>
        Mis turnos, pedir cambio y turnos extra: <Pendiente>Etapa 3</Pendiente>
      </p>
    </main>
  )
}
