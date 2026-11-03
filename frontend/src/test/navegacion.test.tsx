import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SesionProvider } from '../auth/SesionContext'
import App from '../App'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SesionProvider>
        <App />
      </SesionProvider>
    </MemoryRouter>,
  )
}

async function ingresar(usuario: string) {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText('Usuario'), usuario)
  await u.type(screen.getByLabelText('Contraseña'), 'x')
  await u.click(screen.getByRole('button', { name: 'Ingresar' }))
  return u
}

describe('navegación', () => {
  it('sin sesión, cualquier vista manda al login', () => {
    montar('/planificador')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('el jefe entra a Hoy y navega a Planificador y Equipo', async () => {
    montar('/')
    const u = await ingresar('jefe')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page')

    await u.click(screen.getByRole('link', { name: 'Planificador' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Planificador semanal' })).toBeInTheDocument()

    await u.click(screen.getByRole('link', { name: 'Equipo' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Equipo' })).toBeInTheDocument()
    expect(nav).toBeInTheDocument()
  })

  it('Hoy muestra los 4 servicios con su nivel de riesgo', async () => {
    montar('/')
    await ingresar('jefe')
    const servicios = await screen.findByRole('region', { name: 'Servicios del día' })
    const tarjetas = within(servicios).getAllByRole('heading', { level: 2, name: /^\d\d:00–\d\d:00$/ })
    expect(tarjetas.map((t) => t.textContent)).toEqual(['11:00–13:00', '13:00–15:00', '19:00–21:00', '21:00–23:00'])
    // Cada servicio con su nivel de riesgo y la recomendación en lenguaje normal
    expect(within(servicios).getAllByText(/^(Riesgo alto|Alerta|Riesgo bajo)/, { selector: 'span' })).toHaveLength(4)
    expect(within(servicios).getAllByText(/refuerza|mantén|monitoreo|reemplazo/i, { selector: 'p' }).length).toBeGreaterThan(0)
  })

  it('el empleado entra a su bienestar y no a las vistas del jefe', async () => {
    montar('/')
    await ingresar('empleado')
    expect(await screen.findByRole('table', { name: /Tus últimos 7 días/ })).toBeInTheDocument()
  })

  it('desde Equipo el jefe abre una ficha con el bienestar', async () => {
    montar('/')
    const u = await ingresar('jefe')
    await screen.findByRole('heading', { level: 1, name: 'Hoy' })
    await u.click(screen.getByRole('link', { name: 'Equipo' }))
    await u.click(await screen.findByRole('link', { name: /Francisca Silva/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Francisca Silva' })).toBeInTheDocument()
    expect(screen.getByText('Sin consentimiento')).toBeInTheDocument()
  })

  it('el empleado que entra a /hoy ve "Sin permiso"', async () => {
    montar('/hoy')
    await ingresar('empleado')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument()
  })

  it('al salir vuelve al login', async () => {
    montar('/')
    const u = await ingresar('jefe')
    await screen.findByRole('heading', { level: 1, name: 'Hoy' })
    await u.click(screen.getByRole('button', { name: 'Salir' }))
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })
})
