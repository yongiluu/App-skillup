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

  it('el empleado entra a sus turnos y tiene su propia navegación', async () => {
    montar('/')
    const u = await ingresar('empleado')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Cristóbal' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Mis turnos', 'Solicitudes', 'Bienestar'])
    await u.click(within(nav).getByRole('link', { name: 'Bienestar' }))
    expect(await screen.findByRole('table', { name: /Tus últimos 7 días/ })).toBeInTheDocument()
  })

  it('desde Equipo el jefe abre una ficha con el bienestar', async () => {
    montar('/')
    const u = await ingresar('jefe')
    await screen.findByRole('heading', { level: 1, name: 'Hoy' })
    await u.click(screen.getByRole('link', { name: 'Equipo' }))
    await u.click(await screen.findByRole('link', { name: /Francisca Silva/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Francisca Silva' })).toBeInTheDocument()
    expect(screen.getByText('Sin indicador')).toBeInTheDocument()
  })

  it('si el empleado venía de una vista del jefe, al entrar va a su propio inicio', async () => {
    montar('/hoy')
    await ingresar('empleado')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Cristóbal' })).toBeInTheDocument()
  })

  it('el empleado con sesión que abre /hoy ve "Sin permiso"', async () => {
    const { unmount } = montar('/')
    await ingresar('empleado')
    await screen.findByRole('heading', { level: 1, name: 'Hola, Cristóbal' })
    unmount() // la sesión queda guardada en sessionStorage
    montar('/hoy')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument()
  })

  it('al salir vuelve al login', async () => {
    montar('/')
    const u = await ingresar('jefe')
    await screen.findByRole('heading', { level: 1, name: 'Hoy' })
    await u.click(screen.getByRole('button', { name: 'Salir' }))
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('Equipo: buscar por nombre (sin tildes), filtrar por rol y ordenar (AP-06)', async () => {
    montar('/')
    const u = await ingresar('jefe')
    await screen.findByRole('heading', { level: 1, name: 'Hoy' })
    await u.click(screen.getByRole('link', { name: 'Equipo' }))
    await screen.findByRole('link', { name: /Cristóbal Silva/ })
    await u.type(screen.getByLabelText('Buscar por nombre'), 'cristobal silva')
    expect(screen.getAllByRole('link', { name: /Cristóbal/ })).toHaveLength(1)
    expect(screen.getByText('1 de 80 personas')).toBeInTheDocument()
    await u.clear(screen.getByLabelText('Buscar por nombre'))
    await u.selectOptions(screen.getByLabelText('Rol'), 'jefe_turno')
    const jefes = screen.getAllByRole('link', { name: /Jefe de turno/ })
    expect(jefes.length).toBeGreaterThan(0)
    const nombres = jefes.map((a) => a.querySelector('b')!.textContent!)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')))
    // Nunca dice "Sin consentimiento" en la lista del jefe (AP-05)
    expect(screen.queryByText('Sin consentimiento')).not.toBeInTheDocument()
  })
})
