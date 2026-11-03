import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SesionProvider } from '../auth/SesionContext'
import App from '../App'

function montar(ruta = '/') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SesionProvider>
        <App />
      </SesionProvider>
    </MemoryRouter>,
  )
}

async function ingresar(u: ReturnType<typeof userEvent.setup>, usuario: string) {
  await u.type(screen.getByLabelText('Usuario'), usuario)
  await u.type(screen.getByLabelText('Contraseña'), 'x')
  await u.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('cambio de turno: el empleado pide y el jefe resuelve', () => {
  it('el empleado ve solo sus turnos desde hoy, agrupados por día', async () => {
    const u = userEvent.setup()
    montar()
    await ingresar(u, 'empleado')
    // Cristóbal Silva (RST_056, garzón) trabaja hoy 17-10 de 19 a 21 y de 21 a 23
    const hoy = await screen.findByRole('heading', { level: 2, name: /viernes, 17 de octubre.*Hoy/i })
    const dia = hoy.closest('section')!
    expect(within(dia).getByText('19:00–21:00')).toBeInTheDocument()
    expect(within(dia).getByText('21:00–23:00')).toBeInTheDocument()
    expect(within(dia).getAllByText('Garzón')).toHaveLength(2)
    // Nada antes de hoy
    expect(screen.queryByText(/16 de octubre/)).not.toBeInTheDocument()
  })

  it('flujo completo: pedir cambio → aparece pendiente → el jefe aprueba → el empleado lo ve aprobado', async () => {
    const u = userEvent.setup()
    const { unmount } = montar()
    await ingresar(u, 'empleado')

    // 1. Pedir cambio del turno de hoy, proponiendo reemplazo y motivo
    const hoy = (await screen.findByRole('heading', { level: 2, name: /17 de octubre/ })).closest('section')!
    await u.click(within(hoy).getAllByRole('button', { name: 'Pedir cambio' })[0])
    const form = within(hoy).getByRole('form', { name: /Pedir cambio/ })
    const select = within(form).getByLabelText(/Quién te podría cubrir/)
    expect(within(select).getByRole('option', { name: /Camila Gutiérrez/ })).toBeInTheDocument()
    await u.selectOptions(select, within(select).getByRole('option', { name: /Camila Gutiérrez/ }))
    await u.type(within(form).getByLabelText(/Motivo/), 'Trámite personal')
    await u.click(within(form).getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument()
    expect(await within(hoy).findByText('Pendiente')).toBeInTheDocument()
    // El otro turno del mismo día todavía se puede pedir
    expect(within(hoy).getAllByRole('button', { name: 'Pedir cambio' })).toHaveLength(1)

    // 2. El jefe la aprueba con un comentario
    await u.click(screen.getByRole('button', { name: 'Salir' }))
    await ingresar(u, 'jefe')
    await u.click(await screen.findByRole('link', { name: 'Solicitudes' }))
    expect(await screen.findByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument()
    const tarjeta = (await screen.findByText(/Cristóbal Silva/)).closest('li')!
    expect(within(tarjeta).getByText(/Propone que lo cubra: Camila Gutiérrez/)).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Motivo: Trámite personal/)).toBeInTheDocument()
    await u.type(within(tarjeta).getByLabelText(/Comentario/), 'Ok, avisa a Camila')
    await u.click(within(tarjeta).getByRole('button', { name: 'Aprobar' }))
    expect(await screen.findByText(/Solicitud de Cristóbal Silva aprobada/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Resueltas (1)' })).toBeInTheDocument()

    // 3. El empleado la ve aprobada con el comentario
    await u.click(screen.getByRole('button', { name: 'Salir' }))
    await ingresar(u, 'empleado')
    await u.click(await screen.findByRole('link', { name: 'Solicitudes' }))
    expect(await screen.findByText('Aprobada')).toBeInTheDocument()
    expect(screen.getByText('Ok, avisa a Camila')).toBeInTheDocument()
    unmount()
  })

  it('el jefe puede rechazar; el empleado puede volver a pedir', async () => {
    const u = userEvent.setup()
    montar()
    await ingresar(u, 'empleado')
    const hoy = (await screen.findByRole('heading', { level: 2, name: /17 de octubre/ })).closest('section')!
    await u.click(within(hoy).getAllByRole('button', { name: 'Pedir cambio' })[0])
    await u.click(within(hoy).getByRole('button', { name: 'Enviar solicitud' }))
    await within(hoy).findByText('Pendiente')

    await u.click(screen.getByRole('button', { name: 'Salir' }))
    await ingresar(u, 'jefe')
    await u.click(await screen.findByRole('link', { name: 'Solicitudes' }))
    const tarjeta = (await screen.findByText(/No propuso reemplazo/)).closest('li')!
    await u.click(within(tarjeta).getByRole('button', { name: 'Rechazar' }))
    expect(await screen.findByText(/rechazada/)).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Salir' }))
    await ingresar(u, 'empleado')
    const hoy2 = (await screen.findByRole('heading', { level: 2, name: /17 de octubre/ })).closest('section')!
    expect(await within(hoy2).findByText('Rechazada')).toBeInTheDocument()
    expect(within(hoy2).getByRole('button', { name: 'Pedir otra vez' })).toBeInTheDocument()
  })
})
