import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SesionProvider } from '../auth/SesionContext'
import App from '../App'
import { getDisponibles } from '../api'
import Autorizacion, { ERROR_AUTORIZACION } from '../components/bienestar/Autorizacion'

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

    // Confirmación en la misma pantalla, con el foco en la pregunta (AP-19)
    const confirmar = screen.getByRole('group', { name: /Retirar tu autorización/ })
    expect(screen.getByText('¿Retirar tu autorización?').closest('p')).toHaveFocus()
    expect(within(confirmar).getByText(/dejará de ver tu indicador/)).toBeInTheDocument()
    // AP-16 y AP-18: sin etiquetas internas y sin prometer más de lo que pasa
    expect(within(confirmar).queryByText(/Pendiente/i)).not.toBeInTheDocument()
    expect(within(confirmar).queryByText(/Nadie podrá ver/)).not.toBeInTheDocument()
    expect(within(confirmar).getByText(/La app no mostrará los datos que ya se guardaron/)).toBeInTheDocument()
    expect(within(confirmar).getByText(/también al sugerir reemplazos/)).toBeInTheDocument()

    // AP-17: "Mantener mi autorización" no cambia nada y devuelve el foco al botón
    await u.click(within(confirmar).getByRole('button', { name: 'Mantener mi autorización' }))
    expect(screen.queryByRole('group', { name: /Retirar tu autorización/ })).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirar mi autorización' })).toHaveFocus()

    // Retirar: desaparecen los datos y queda "Sin indicador"
    await u.click(screen.getByRole('button', { name: 'Retirar mi autorización' }))
    await u.click(screen.getByRole('button', { name: 'Sí, retirar mi autorización' }))
    // AP-19: el aviso se anuncia solo (role="status")
    expect((await screen.findByText(/Retiraste tu autorización/)).closest('[role="status"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tu autorización' })).toHaveFocus()
    // Ya no aparece el botón para retirarla, ni siquiera mientras se recarga el bienestar
    expect(screen.queryByRole('button', { name: 'Retirar mi autorización' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autorizar el uso de mis datos' })).toBeInTheDocument()
    expect(await screen.findByText('Sin indicador')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    // Volver a autorizar
    await u.click(screen.getByRole('button', { name: 'Autorizar el uso de mis datos' }))
    expect(await screen.findByText(/Autorizaste de nuevo/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Retirar mi autorización' })).toBeInTheDocument()
  })
})

describe('AP-19: si falla, un mensaje fijo y claro', () => {
  it('no muestra el texto técnico de la API', async () => {
    const u = userEvent.setup()
    // En modo simulado, otra persona distinta a la de la sesión recibe 403
    render(
      <Autorizacion
        empleadoId="RST_999"
        consentimiento={{ otorgado: true, fecha: '2025-10-01', version_texto: 'borrador-v0' }}
        alCambiar={() => {}}
      />,
    )
    await u.click(screen.getByRole('button', { name: 'Retirar mi autorización' }))
    await u.click(screen.getByRole('button', { name: 'Sí, retirar mi autorización' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_AUTORIZACION)
    expect(screen.queryByText(/Solo la propia persona/)).not.toBeInTheDocument()
  })
})
