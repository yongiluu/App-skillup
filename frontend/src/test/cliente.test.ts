import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi, alRecibir401, fijarToken, pedir } from '../api/cliente'

function respuesta(estado: number, cuerpo: unknown) {
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  fijarToken(null)
  alRecibir401(() => {})
})

describe('cliente HTTP', () => {
  it('manda el token en Authorization', async () => {
    const fetchFalso = vi.fn(() => respuesta(200, { ok: true }))
    vi.stubGlobal('fetch', fetchFalso)
    fijarToken('abc')
    await pedir('/servicios')
    const init = (fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer abc')
  })

  it('ante 401 avisa a la sesión y lanza ErrorApi', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respuesta(401, { detail: 'Token vencido' })))
    const al401 = vi.fn()
    alRecibir401(al401)
    await expect(pedir('/servicios')).rejects.toMatchObject({ estado: 401 })
    expect(al401).toHaveBeenCalledOnce()
  })

  it('un 401 del login NO cierra sesión (es contraseña incorrecta)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respuesta(401, { detail: 'Usuario o contraseña incorrectos' })))
    const al401 = vi.fn()
    alRecibir401(al401)
    await expect(pedir('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow(
      'Usuario o contraseña incorrectos',
    )
    expect(al401).not.toHaveBeenCalled()
  })

  it('ante 403 lanza ErrorApi con estado 403 y mensaje claro', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respuesta(403, { detail: 'Solo jefe de turno' })))
    const error = await pedir('/semana').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ErrorApi)
    expect((error as ErrorApi).estado).toBe(403)
    expect((error as ErrorApi).message).toBe('Tu perfil no tiene permiso para ver esto.')
  })

  it('sin conexión lanza ErrorApi con estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(pedir('/servicios')).rejects.toMatchObject({ estado: 0 })
  })
})
