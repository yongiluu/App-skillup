import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SesionProvider } from '../auth/SesionContext'
import App from '../App'
import { cambiarReemplazo, crearSolicitud, getSolicitudes, login, resolverSolicitud, responderReemplazo } from '../api'
import { ErrorApi } from '../api/cliente'

/** El turno de hoy de Cristóbal Silva (RST_056) en los datos simulados. */
const TURNO = { solicitante_id: 'RST_056', fecha: '2025-10-17', servicio: '19_21' } as const
const NADIE_ACEPTO = 'Solo se puede aprobar si un reemplazo aceptó. Si nadie acepta, hay que rechazarla'

describe('reemplazo: las mismas reglas que la API, en modo simulado', () => {
  it('al pedir con reemplazo, su respuesta queda pendiente; sin reemplazo, no hay respuesta', async () => {
    const con = await crearSolicitud({ ...TURNO, reemplazo_id: 'RST_009' })
    expect(con.respuesta_reemplazo).toBe('pendiente')
    expect(con.propuesto_en).toBe(con.creada_en)
    expect(con.respondida_en).toBeNull()
    expect(con.rechazaron).toEqual([])

    const sin = await crearSolicitud({ ...TURNO, servicio: '23_cierre' })
    expect(sin.respuesta_reemplazo).toBeNull()
    expect(sin.propuesto_en).toBeNull()
  })

  it('el jefe no puede aprobar hasta que el reemplazo acepte', async () => {
    const s = await crearSolicitud({ ...TURNO, reemplazo_id: 'RST_009' })
    await expect(resolverSolicitud(s.id, 'aprobada')).rejects.toMatchObject({ estado: 409, message: NADIE_ACEPTO })

    const aceptada = await responderReemplazo(s.id, true)
    expect(aceptada.respuesta_reemplazo).toBe('aceptada')
    expect(aceptada.respondida_en).not.toBeNull()
    expect(aceptada.estado).toBe('pendiente')

    const aprobada = await resolverSolicitud(s.id, 'aprobada')
    expect(aprobada.estado).toBe('aprobada')
    // Una solicitud resuelta ya no se modifica
    await expect(responderReemplazo(s.id, false)).rejects.toMatchObject({ estado: 409, message: 'La solicitud ya está aprobada' })
    await expect(cambiarReemplazo(s.id, 'RST_010')).rejects.toBeInstanceOf(ErrorApi)
  })

  it('si el reemplazo rechaza, la solicitud sigue pendiente y se puede proponer a otra persona', async () => {
    const s = await crearSolicitud({ ...TURNO, reemplazo_id: 'RST_009' })
    const rechazada = await responderReemplazo(s.id, false)
    expect(rechazada.estado).toBe('pendiente')
    expect(rechazada.respuesta_reemplazo).toBe('rechazada')
    expect(rechazada.rechazaron).toEqual([{ empleado_id: 'RST_009', rechazado_en: rechazada.respondida_en }])
    await expect(resolverSolicitud(s.id, 'aprobada')).rejects.toMatchObject({ estado: 409 })

    const otra = await cambiarReemplazo(s.id, 'RST_010')
    expect(otra.reemplazo_id).toBe('RST_010')
    expect(otra.respuesta_reemplazo).toBe('pendiente')
    expect(otra.respondida_en).toBeNull()
    expect(otra.rechazaron).toHaveLength(1) // queda anotado quién ya dijo que no

    await responderReemplazo(s.id, true)
    expect((await resolverSolicitud(s.id, 'aprobada')).estado).toBe('aprobada')
  })

  it('sin reemplazo no se puede aprobar ni responder, pero sí rechazar', async () => {
    const s = await crearSolicitud(TURNO)
    await expect(resolverSolicitud(s.id, 'aprobada')).rejects.toMatchObject({ estado: 409, message: NADIE_ACEPTO })
    await expect(responderReemplazo(s.id, true)).rejects.toMatchObject({ estado: 403 })
    expect((await resolverSolicitud(s.id, 'rechazada', 'No hay quién cubra')).estado).toBe('rechazada')
    expect((await getSolicitudes())[0].comentario).toBe('No hay quién cubra')
  })

  it('no se puede proponer como reemplazo a quien pide el cambio; una solicitud que no existe da 404', async () => {
    const s = await crearSolicitud(TURNO)
    await expect(cambiarReemplazo(s.id, 'RST_056')).rejects.toMatchObject({ estado: 409 })
    await expect(responderReemplazo(99, true)).rejects.toMatchObject({ estado: 404, message: 'No existe la solicitud 99' })
  })

  it('existe el usuario de prueba "reemplazo" (Ignacia Muñoz, perfil empleado), igual que en el backend', async () => {
    const sesion = await login({ usuario: 'reemplazo', password: 'x' })
    expect(sesion).toMatchObject({ perfil: 'empleado', empleado_id: 'RST_009', nombre: 'Ignacia Muñoz' })
    await expect(login({ usuario: 'otro', password: 'x' })).rejects.toThrow('Usuario o contraseña incorrectos')
  })
})

describe('reemplazo: lo que ve el jefe si aprueba antes de tiempo', () => {
  it('la tarjeta muestra el motivo en palabras y la solicitud sigue pendiente', async () => {
    await crearSolicitud({ ...TURNO, reemplazo_id: 'RST_009' })
    const u = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <SesionProvider>
          <App />
        </SesionProvider>
      </MemoryRouter>,
    )
    await u.type(screen.getByLabelText('Usuario'), 'jefe')
    await u.type(screen.getByLabelText('Contraseña'), 'x')
    await u.click(screen.getByRole('button', { name: 'Ingresar' }))
    await u.click(await screen.findByRole('link', { name: 'Solicitudes' }))
    const tarjeta = (await screen.findByText(/Cristóbal Silva/)).closest('li')!
    await u.click(within(tarjeta).getByRole('button', { name: 'Aprobar' }))
    expect(await screen.findByText(NADIE_ACEPTO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument()
  })
})
