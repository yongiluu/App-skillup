import { useMemo } from 'react'
import { getEmpleados } from '../api'
import type { Empleado } from '../api/tipos'
import { useDatos } from './useDatos'

const cargarEmpleados = () => getEmpleados()

/**
 * Lista del equipo (GET /empleados, datos básicos) y un buscador de nombre por id.
 * Si todavía no carga, `nombre(id)` devuelve el id.
 */
export function useEquipo() {
  const datos = useDatos(cargarEmpleados)
  const empleados: Empleado[] = useMemo(() => (datos.estado === 'listo' ? datos.datos : []), [datos])
  const porId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])
  return {
    empleados,
    nombre: (id: string | null | undefined) => (id ? (porId.get(id)?.nombre ?? id) : ''),
    empleado: (id: string) => porId.get(id),
  }
}
