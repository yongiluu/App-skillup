import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AnilloFatiga from '../components/inicio/AnilloFatiga'
import { TuSemana, TuTurnoHoy } from '../components/inicio/TuDia'
import { Kpis, RiesgoPorRol } from '../components/hoy/PanelJefe'
import { useTema } from '../lib/tema'
import servicios from '../api/mocks/servicios.json'
import ausencias from '../api/mocks/ausencias.json'
import turnos from '../api/mocks/turnos-propios.json'
import fichas from '../api/mocks/fichas.json'
import type { AusenciaDia, Bienestar, DiaServicios, Turno } from '../api/tipos'

const dia = servicios as DiaServicios
const deFicha = (id: string) => (fichas as Record<string, { bienestar: Bienestar }>)[id].bienestar
const enRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('anillo de fatiga (solo la propia persona)', () => {
  it('muestra el nivel que entrega la API, sin calcular otro puntaje', () => {
    enRouter(<AnilloFatiga bienestar={deFicha('RST_003')} />)
    expect(screen.getByText('Fatiga alta')).toBeInTheDocument()
    expect(screen.getByText(/carga física y cansancio informado/)).toBeInTheDocument()
    expect(screen.getByText(/No es diagnóstico/)).toBeInTheDocument()
    expect(screen.queryByText(/de 100/)).not.toBeInTheDocument()
  })

  it('sin consentimiento queda gris y no muestra ningún nivel', () => {
    enRouter(<AnilloFatiga bienestar={deFicha('RST_011')} />)
    expect(screen.getByText('Sin indicador')).toBeInTheDocument()
    expect(screen.getByText(/No compartes datos de bienestar/)).toBeInTheDocument()
    expect(screen.queryByText(/Fatiga (baja|media|alta)/)).not.toBeInTheDocument()
  })
})

describe('inicio del trabajador', () => {
  it('"Tu turno de hoy" muestra los horarios de hoy y "Tu semana" marca los días libres', () => {
    render(
      <>
        <TuTurnoHoy turnos={turnos as Turno[]} hoy="2025-10-17" />
        <TuSemana turnos={turnos as Turno[]} hoy="2025-10-17" />
      </>,
    )
    const hoy = screen.getByRole('region', { name: 'Tu turno de hoy' })
    expect(within(hoy).getByText('19:00–21:00')).toBeInTheDocument()
    expect(within(hoy).getByText('21:00–23:00')).toBeInTheDocument()
    expect(within(hoy).getByText('Garzón')).toBeInTheDocument()
    const semana = screen.getByRole('region', { name: 'Tu semana' })
    expect(within(semana).getAllByRole('listitem')).toHaveLength(7)
  })

  it('un día sin turno lo dice y avisa el próximo', () => {
    render(<TuTurnoHoy turnos={(turnos as Turno[]).filter((t) => t.fecha !== '2025-10-17')} hoy="2025-10-17" />)
    expect(screen.getByText(/Hoy no tienes turno\. El próximo es el sábado, 18 de octubre/)).toBeInTheDocument()
  })
})

describe('panel del jefe', () => {
  it('las cifras usan el servicio más crítico, las ausencias y las solicitudes pendientes', () => {
    enRouter(<Kpis servicios={dia.servicios} ausencias={ausencias as AusenciaDia[]} solicitudes={[]} />)
    const resumen = screen.getByRole('list', { name: 'Resumen del día' })
    expect(within(resumen).getByText(/Crítico 13–15/)).toBeInTheDocument()
    expect(within(resumen).getByText(String(ausencias.length))).toBeInTheDocument()
    expect(within(resumen).getByRole('link', { name: /Solicitudes/ })).toHaveAttribute('href', '/solicitudes')
  })

  it('riesgo por rol: 3 roles × 4 servicios, siempre con palabra además del color', () => {
    render(<RiesgoPorRol servicios={dia.servicios} />)
    const tabla = screen.getByRole('table')
    expect(within(tabla).getAllByRole('row')).toHaveLength(4)
    expect(within(tabla).getAllByRole('cell')).toHaveLength(12)
    // Jefe de turno 13–15 = 75 % → riesgo alto (umbral ≥ 0,75)
    expect(within(tabla).getByText(/75\s%/).textContent).toMatch(/Riesgo alto/)
  })
})

function BotonTema() {
  const { tema, alternar } = useTema()
  return (
    <button type="button" onClick={alternar}>
      {tema}
    </button>
  )
}

describe('modo oscuro', () => {
  afterEach(() => {
    delete document.documentElement.dataset.tema
    localStorage.clear()
  })

  it('el botón alterna el tema, lo marca en <html> y lo recuerda', async () => {
    const u = userEvent.setup()
    render(<BotonTema />)
    const boton = screen.getByRole('button')
    const antes = boton.textContent
    await u.click(boton)
    const despues = antes === 'oscuro' ? 'claro' : 'oscuro'
    expect(boton).toHaveTextContent(despues)
    expect(document.documentElement.dataset.tema).toBe(despues)
    expect(localStorage.getItem('skillup-tema')).toBe(despues)
  })
})

describe('cobertura real (programados − ausentes)', () => {
  it('13–15: 25 programados, 3 avisaron ausencia → vienen 22 de 23 y falta 1', async () => {
    const { cobertura, rolMasEnRiesgo } = await import('../lib/cobertura')
    const s = dia.servicios.find((x) => x.servicio === '13_15')!
    expect(cobertura(s, ausencias as AusenciaDia[])).toEqual({ ausentes: 3, presentes: 22, faltan: 1 })
    expect(rolMasEnRiesgo(s).rol).toBe('jefe_turno')
  })

  it('sin datos de ausencias usa los programados, sin inventar', async () => {
    const { cobertura } = await import('../lib/cobertura')
    const s = dia.servicios[0]
    expect(cobertura(s, null)).toEqual({ ausentes: null, presentes: s.asignados, faltan: Math.max(0, s.requeridos - s.asignados) })
  })
})
