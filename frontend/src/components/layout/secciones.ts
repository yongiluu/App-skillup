import type { NombreIcono } from '../ui/Icono'

/** Las 3 vistas desktop del jefe de turno. Para agregar una vista: sumarla aquí y en App.tsx. */
export const SECCIONES: { ruta: string; nombre: string; icono: NombreIcono }[] = [
  { ruta: '/hoy', nombre: 'Hoy', icono: 'hoy' },
  { ruta: '/planificador', nombre: 'Planificador', icono: 'planificador' },
  { ruta: '/equipo', nombre: 'Equipo', icono: 'equipo' },
]
