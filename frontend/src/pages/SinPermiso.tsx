import { useNavigate } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import estilos from './Vistas.module.css'

/** Se muestra ante un 403 de la API o cuando el perfil no corresponde a la ruta. */
export default function SinPermiso() {
  const { sesion, cerrarSesion } = useSesion()
  const navegar = useNavigate()
  const inicio = sesion?.perfil === 'jefe_turno' ? '/hoy' : '/mi-turno'

  return (
    <div className={estilos.centrado}>
      <EncabezadoPagina titulo="Sin permiso" bajada="Tu perfil no tiene acceso a esta sección." />
      <div style={{ display: 'flex', gap: 'var(--esp-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Boton onClick={() => navegar(inicio)}>Ir a mi inicio</Boton>
        <Boton variante="secundario" onClick={() => cerrarSesion()}>
          Ingresar con otro usuario
        </Boton>
      </div>
    </div>
  )
}
