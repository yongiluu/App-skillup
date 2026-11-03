import { useEffect, useState } from 'react'
import { ErrorApi } from '../api/cliente'

export type EstadoDatos<T> =
  | { estado: 'cargando' }
  | { estado: 'listo'; datos: T }
  | { estado: 'error'; mensaje: string; sinPermiso: boolean }

/**
 * Carga datos al montar la vista y expone cargando / listo / error.
 * `cargar` debe ser estable (definida fuera del componente o con useCallback).
 */
export function useDatos<T>(cargar: () => Promise<T>): EstadoDatos<T> {
  const [estado, setEstado] = useState<EstadoDatos<T>>({ estado: 'cargando' })

  useEffect(() => {
    let vigente = true
    cargar()
      .then((datos) => vigente && setEstado({ estado: 'listo', datos }))
      .catch((e: unknown) => {
        if (!vigente) return
        const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.'
        setEstado({ estado: 'error', mensaje, sinPermiso: e instanceof ErrorApi && e.estado === 403 })
      })
    return () => {
      vigente = false
    }
  }, [cargar])

  return estado
}
