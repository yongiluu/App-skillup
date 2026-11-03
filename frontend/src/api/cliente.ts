/**
 * Cliente HTTP único para hablar con la API de Diego.
 * - Agrega `Authorization: Bearer <token>` en cada llamada.
 * - 401 → avisa a la sesión para que cierre y vuelva al login.
 * - 403 → lanza ErrorApi con estado 403 para que la vista muestre "sin permiso".
 */

export class ErrorApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

const URL_API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

let tokenActual: string | null = null
let alNoAutorizado: () => void = () => {}

/**
 * La sesión fija aquí el token en el mismo momento en que inicia o cierra sesión
 * (no en un efecto de React), así ninguna vista alcanza a llamar sin token.
 */
export function fijarToken(token: string | null) {
  tokenActual = token
}

/** La sesión registra qué hacer ante un 401 (cerrar sesión y volver al login). */
export function alRecibir401(accion: () => void) {
  alNoAutorizado = accion
}

export async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (tokenActual) headers.set('Authorization', `Bearer ${tokenActual}`)

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, { ...init, headers })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.')
  }

  if (respuesta.ok) {
    return respuesta.status === 204 ? (undefined as T) : ((await respuesta.json()) as T)
  }

  // FastAPI devuelve { detail: "..." }; si no viene, usamos un texto genérico.
  let mensaje = 'Ocurrió un error inesperado.'
  try {
    const cuerpo: unknown = await respuesta.json()
    if (cuerpo && typeof cuerpo === 'object' && 'detail' in cuerpo && typeof cuerpo.detail === 'string') {
      mensaje = cuerpo.detail
    }
  } catch {
    /* respuesta sin JSON */
  }

  // En /auth/login un 401 significa "contraseña incorrecta", no "sesión vencida".
  if (respuesta.status === 401 && !ruta.startsWith('/auth/')) alNoAutorizado()
  if (respuesta.status === 403) mensaje = 'Tu perfil no tiene permiso para ver esto.'
  throw new ErrorApi(respuesta.status, mensaje)
}
