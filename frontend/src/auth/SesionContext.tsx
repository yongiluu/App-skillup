import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { alRecibir401, fijarToken } from '../api/cliente'
import { MOCK_HOY, login as loginApi } from '../api'
import { SesionContext } from './sesion'
import type { Sesion } from './sesion'

/*
 * El token se guarda en sessionStorage (se borra al cerrar la pestaña) y no en localStorage,
 * para que no quede guardado en el computador del local. Nunca se guarda la contraseña.
 */
const CLAVE = 'skillup.sesion'
const VENCIDA = 'Tu sesión venció. Vuelve a ingresar.'

function leerGuardada(): Sesion | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    const s = JSON.parse(crudo) as Sesion
    if (s.expiraEn <= Date.now() || !s.hoy) return null
    fijarToken(s.token)
    return s
  } catch {
    return null
  }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(leerGuardada)
  const [aviso, setAviso] = useState<string | null>(null)

  const cerrarSesion = useCallback((motivo?: string) => {
    fijarToken(null)
    try {
      sessionStorage.removeItem(CLAVE)
    } catch {
      /* sin almacenamiento disponible */
    }
    setSesion(null)
    setAviso(motivo ?? null)
  }, [])

  const iniciarSesion = useCallback(async (usuario: string, password: string) => {
    const r = await loginApi({ usuario, password })
    const nueva: Sesion = {
      token: r.access_token,
      perfil: r.perfil,
      nombre: r.nombre,
      empleadoId: r.empleado_id,
      expiraEn: Date.now() + r.expira_en * 1000,
      // [PENDIENTE Diego] la API todavía no manda "hoy" en el login; mientras, el mismo MOCK_HOY del backend.
      hoy: r.hoy ?? MOCK_HOY,
    }
    fijarToken(nueva.token)
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(nueva))
    } catch {
      /* sin almacenamiento: la sesión dura mientras la página esté abierta */
    }
    setAviso(null)
    setSesion(nueva)
  }, [])

  // Ante un 401 de la API: cerrar sesión y volver al login.
  useEffect(() => {
    alRecibir401(() => cerrarSesion(VENCIDA))
  }, [cerrarSesion])

  // Cierre automático cuando vence el token (8 h en el backend).
  useEffect(() => {
    if (!sesion) return
    const t = setTimeout(() => cerrarSesion(VENCIDA), Math.max(0, sesion.expiraEn - Date.now()))
    return () => clearTimeout(t)
  }, [sesion, cerrarSesion])

  const valor = useMemo(
    () => ({ sesion, aviso, iniciarSesion, cerrarSesion }),
    [sesion, aviso, iniciarSesion, cerrarSesion],
  )
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
