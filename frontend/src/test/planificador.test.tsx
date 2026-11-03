import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Planificador from '../pages/Planificador'
import { diaSemana, diasDelMes, lunesDe, rangoSemana, sumarDias } from '../lib/fechas'

describe('fechas', () => {
  it('suma días cruzando meses y años', () => {
    expect(sumarDias('2025-09-29', 7)).toBe('2025-10-06')
    expect(sumarDias('2025-12-29', 7)).toBe('2026-01-05')
    expect(sumarDias('2025-10-06', -7)).toBe('2025-09-29')
  })

  it('el lunes de cualquier día (domingo incluido)', () => {
    expect(lunesDe('2025-10-17')).toBe('2025-10-13') // viernes
    expect(lunesDe('2025-10-19')).toBe('2025-10-13') // domingo
    expect(lunesDe('2025-10-13')).toBe('2025-10-13') // lunes
  })

  it('día de la semana y largo del mes', () => {
    expect(diaSemana('2025-10-01')).toBe(2) // miércoles
    expect(diasDelMes('2025-02')).toBe(28)
    expect(diasDelMes('2024-02')).toBe(29)
  })

  it('rango legible de la semana', () => {
    expect(rangoSemana('2025-10-13', '2025-10-19')).toBe('13 al 19 de octubre de 2025')
    expect(rangoSemana('2025-09-29', '2025-10-05')).toBe('29 de septiembre al 5 de octubre de 2025')
  })
})

function montar(ruta = '/planificador') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/planificador" element={<Planificador />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Planificador', () => {
  it('parte en la semana de hoy con 7 días × 4 servicios', async () => {
    montar()
    expect(await screen.findByText('Semana del 13 al 19 de octubre de 2025')).toBeInTheDocument()
    const tabla = screen.getByRole('table')
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(8) // "Servicio" + 7 días
    expect(within(tabla).getAllByRole('rowheader').map((r) => r.textContent)).toEqual([
      '11:00–13:00',
      '13:00–15:00',
      '19:00–21:00',
      '21:00–23:00',
    ])
    expect(within(tabla).getAllByRole('cell')).toHaveLength(28)
  })

  it('marca hoy (17-10) y el feriado del lunes 13-10', async () => {
    montar()
    const tabla = await screen.findByRole('table')
    const hoy = within(tabla).getByRole('columnheader', { current: 'date' })
    expect(hoy).toHaveTextContent('17')
    expect(within(tabla).getByText(/Feriado: Encuentro de Dos Mundos/)).toBeInTheDocument()
  })

  it('cambia de semana con los botones', async () => {
    const u = userEvent.setup()
    montar()
    await screen.findByText('Semana del 13 al 19 de octubre de 2025')
    await u.click(screen.getByRole('button', { name: 'Siguiente →' }))
    expect(await screen.findByText('Semana del 20 al 26 de octubre de 2025')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(await screen.findByText('Semana del 13 al 19 de octubre de 2025')).toBeInTheDocument()
  })

  it('fuera del rango de datos lo explica y permite volver', async () => {
    const u = userEvent.setup()
    montar('/planificador?inicio=2025-09-22')
    expect(await screen.findByRole('alert')).toHaveTextContent(/Sin datos/)
    await u.click(screen.getByRole('button', { name: 'Volver a la semana actual' }))
    expect(await screen.findByText('Semana del 13 al 19 de octubre de 2025')).toBeInTheDocument()
  })

  it('el calendario del mes marca la semana que se ve y lleva a otras', async () => {
    const u = userEvent.setup()
    montar()
    const cal = await screen.findByRole('region', { name: /Calendario de octubre de 2025/i })
    const dia13 = await within(cal).findByRole('link', { name: /lunes, 13 de octubre.*Feriado/i })
    expect(dia13).toHaveAttribute('href', '/planificador?inicio=2025-10-13')
    await u.click(within(cal).getByRole('link', { name: /^jueves, 23 de octubre/i }))
    expect(await screen.findByText('Semana del 20 al 26 de octubre de 2025')).toBeInTheDocument()
  })
})
