import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import BienestarFicha from '../components/bienestar/Bienestar'
import fichas from '../api/mocks/fichas.json'
import propio from '../api/mocks/bienestar-propio.json'
import type { Bienestar, BienestarPropio } from '../api/tipos'

const de = (id: string) => (fichas as unknown as Record<string, { bienestar: Bienestar }>)[id].bienestar

describe('bienestar en la ficha (vista del jefe)', () => {
  it('con datos: muestra nivel, motivo y aviso de consentimiento', () => {
    render(<BienestarFicha vista="jefe" bienestar={de('RST_002')} />)
    expect(screen.getByText('Fatiga alta')).toBeInTheDocument()
    expect(screen.getByText(/Motivo: carga física y jornada larga/i)).toBeInTheDocument()
    expect(screen.getByText(/Autorizó el uso de datos de bienestar el 15-09-2025/)).toBeInTheDocument()
  })

  it('sin consentimiento: no muestra indicador ni aviso de autorización', () => {
    render(<BienestarFicha vista="jefe" bienestar={de('RST_011')} />)
    expect(screen.getByText('Sin indicador')).toBeInTheDocument()
    expect(screen.queryByText(/Fatiga/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Autorizó/)).not.toBeInTheDocument()
  })

  it('sin datos: lo indica y mantiene el aviso de consentimiento', () => {
    render(<BienestarFicha vista="jefe" bienestar={de('RST_004')} />)
    expect(screen.getByText('Sin datos recientes')).toBeInTheDocument()
    expect(screen.getByText(/Autorizó el uso de datos de bienestar el 15-09-2025/)).toBeInTheDocument()
  })

  it('el jefe nunca ve datos crudos, aunque vengan en el objeto', () => {
    // Aunque por error llegara un objeto con registros, la vista del jefe no los dibuja.
    render(<BienestarFicha vista="jefe" bienestar={propio as BienestarPropio} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sueño/)).not.toBeInTheDocument()
  })
})

describe('bienestar propio (vista del empleado)', () => {
  it('muestra sus registros y el aviso de quién ve qué', () => {
    render(<BienestarFicha vista="propia" bienestar={propio as BienestarPropio} />)
    expect(screen.getByRole('table', { name: /Tus últimos 7 días/ })).toBeInTheDocument()
    expect(screen.getByText(/Tu jefe de turno solo ve el nivel de fatiga/)).toBeInTheDocument()
  })
})
