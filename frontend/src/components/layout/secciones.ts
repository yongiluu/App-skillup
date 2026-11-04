import type { NombreIcono } from '../ui/Icono'
import type { Perfil } from '../../api/tipos'

export interface Seccion {
  ruta: string
  nombre: string
  icono: NombreIcono
}

/**
 * Secciones de la navegación según el perfil. Para agregar una vista: sumarla aquí y en App.tsx.
 * El jefe de turno trabaja en el computador; el empleado, en el celular.
 */
export const SECCIONES: Record<Perfil, Seccion[]> = {
  jefe_turno: [
    { ruta: '/hoy', nombre: 'Hoy', icono: 'hoy' },
    { ruta: '/planificador', nombre: 'Planificador', icono: 'planificador' },
    { ruta: '/equipo', nombre: 'Equipo', icono: 'equipo' },
    { ruta: '/solicitudes', nombre: 'Solicitudes', icono: 'solicitudes' },
    { ruta: '/analisis', nombre: 'Análisis', icono: 'grafico' },
  ],
  empleado: [
    { ruta: '/mi-turno', nombre: 'Mis turnos', icono: 'planificador' },
    { ruta: '/mis-solicitudes', nombre: 'Solicitudes', icono: 'cambio' },
    { ruta: '/mi-bienestar', nombre: 'Bienestar', icono: 'bienestar' },
  ],
}
