import { useCallback, useEffect, useState } from 'react'
import { ErrorApi } from '../api/cliente'

export type EstadoDatos<T> =
  | { estado: 'cargando' }
  | { estado: 'listo'; datos: T }
  | { estado: 'error'; mensaje: string; sinPermiso: boolean }

/**
 * Carga datos al montar la vista y expone cargando / listo / error.
 * `cargar` debe ser estable (definida fuera del componente o con useCallback).
 * `recargar()` vuelve a pedir los datos (por ejemplo, después de crear o aprobar algo);
 * mientras llegan, se siguen mostrando los anteriores.
 */
export function useDatos<T>(cargar: () => Promise<T>): EstadoDatos<T> & { recargar: () => void } {
  const [estado, setEstado] = useState<EstadoDatos<T>>({ estado: 'cargando' })
  const [vuelta, setVuelta] = useState(0)
  const recargar = useCallback(() => setVuelta((v) => v + 1), [])

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
  }, [cargar, vuelta])

  return { ...estado, recargar }
}
