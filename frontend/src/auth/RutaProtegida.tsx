import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Perfil } from '../api/tipos'
import { useSesion } from './sesion'
import SinPermiso from '../pages/SinPermiso'

/**
 * Deja pasar solo con sesión iniciada (y, si se indica, con el perfil correcto).
 * Esto es solo para la experiencia de uso: la protección real la hace el backend.
 */
export default function RutaProtegida({ perfiles }: { perfiles?: Perfil[] }) {
  const { sesion } = useSesion()
  const ubicacion = useLocation()

  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  if (perfiles && !perfiles.includes(sesion.perfil)) return <SinPermiso />
  return <Outlet />
}
