import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SesionProvider } from '../auth/SesionContext'
import App from '../App'
import { getDisponibles } from '../api'

function montar(ruta: string) {
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

describe('AP-03: reemplazo solo entre los disponibles', () => {
  it('el empleado recibe solo disponibles y sin motivo', async () => {
    const lista = await getDisponibles('23_cierre', '2025-10-17')
    expect(lista.length).toBeGreaterThan(0)
    expect(lista.every((d) => d.disponible && d.motivo === null)).toBe(true)
    // Nadie se propone a sí mismo
    expect(lista.some((d) => d.empleado_id === 'RST_056')).toBe(false)
  })
})

describe('AP-04: retirar la autorización de bienestar', () => {
  it('pide confirmación, deja de mostrar los datos y permite volver a autorizar', async () => {
    const u = userEvent.setup()
    montar('/mi-bienestar')
    await ingresar(u, 'empleado')
    await u.click(await screen.findByRole('link', { name: /Bienestar/ }))

    // Con autorización: ve sus registros y el botón para retirarla
    expect(await screen.findByRole('table')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Retirar mi autorización' }))

    // Confirmación en la misma pantalla; cancelar no cambia nada
    const confirmar = screen.getByRole('group', { name: /Retirar tu autorización/ })
    expect(within(confirmar).getByText(/dejará de ver tu indicador/)).toBeInTheDocument()
    await u.click(within(confirmar).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: /Retirar tu autorización/ })).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()

    // Retirar: desaparecen los datos y queda "Sin indicador"
    await u.click(screen.getByRole('button', { name: 'Retirar mi autorización' }))
    await u.click(screen.getByRole('button', { name: 'Sí, retirar' }))
    expect(await screen.findByText(/Retiraste tu autorización/)).toBeInTheDocument()
    expect(await screen.findByText('Sin indicador')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    // Volver a autorizar
    await u.click(screen.getByRole('button', { name: 'Autorizar el uso de mis datos' }))
    expect(await screen.findByText(/Autorizaste de nuevo/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Retirar mi autorización' })).toBeInTheDocument()
  })
})
