import { createContext, useContext } from 'react'
import type { Perfil } from '../api/tipos'

export interface Sesion {
  token: string
  perfil: Perfil
  nombre: string
  empleadoId: string | null
  /** Momento (ms) en que vence el token */
  expiraEn: number
}

export interface ValorSesion {
  sesion: Sesion | null
  /** Motivo por el que se cerró la sesión, para mostrarlo en el login */
  aviso: string | null
  iniciarSesion: (usuario: string, password: string) => Promise<void>
  cerrarSesion: (aviso?: string) => void
}

export const SesionContext = createContext<ValorSesion | null>(null)

export function useSesion(): ValorSesion {
  const v = useContext(SesionContext)
  if (!v) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return v
}
