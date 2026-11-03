import { useCallback } from 'react'
import { useSesion } from '../auth/sesion'
import { getBienestarPropio } from '../api'
import { useDatos } from '../lib/useDatos'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso from '../components/ui/Aviso'
import BienestarFicha from '../components/bienestar/Bienestar'

/** Bienestar propio del empleado (datos crudos: solo los ve la propia persona). */
export default function MiBienestar() {
  const { sesion } = useSesion()
  const id = sesion?.empleadoId ?? ''
  const cargar = useCallback(() => getBienestarPropio(id), [id])
  const datos = useDatos(cargar)

  return (
    <>
      <EncabezadoPagina titulo="Mi bienestar" bajada="Solo tú ves este detalle" />
      <Tarjeta>
        {datos.estado === 'cargando' && <p role="status">Cargando…</p>}
        {datos.estado === 'error' && <Aviso tipo="error">{datos.mensaje}</Aviso>}
        {datos.estado === 'listo' && <BienestarFicha vista="propia" bienestar={datos.datos} />}
      </Tarjeta>
    </>
  )
}
