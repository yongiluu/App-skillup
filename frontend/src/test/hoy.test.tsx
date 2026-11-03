import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccionesSugeridas from '../components/hoy/AccionesSugeridas'
import AusenciasDia from '../components/hoy/AusenciasDia'
import sugerencias from '../api/mocks/sugerencias.json'
import ausencias from '../api/mocks/ausencias.json'
import type { AusenciaDia, Sugerencia } from '../api/tipos'

describe('acciones sugeridas', () => {
  it('agrupa por servicio y rol, en orden de franja', () => {
    render(<AccionesSugeridas sugerencias={sugerencias as Sugerencia[]} />)
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos[0]).toMatch(/^11:00–13:00/)
    // Cada sugerencia aparece una vez con su acción
    expect(screen.getAllByText(/^(Mover|Llamar)$/)).toHaveLength(sugerencias.length)
  })

  it('sin sugerencias lo dice', () => {
    render(<AccionesSugeridas sugerencias={[]} />)
    expect(screen.getByText(/Nada que mover ni llamar/)).toBeInTheDocument()
  })
})

describe('ausencias del día', () => {
  it('muestra quién falta, en qué servicios y si fue con aviso corto (sin diagnóstico)', () => {
    render(
      <MemoryRouter>
        <AusenciasDia ausencias={ausencias as AusenciaDia[]} />
      </MemoryRouter>,
    )
    const fila = screen.getByRole('link', { name: 'Gaspar Espinoza' }).closest('li')!
    expect(within(fila).getByText(/19:00–21:00, 21:00–23:00/)).toBeInTheDocument()
    expect(within(fila).getByText('Salud')).toBeInTheDocument()
    expect(within(fila).getByText('Aviso corto')).toBeInTheDocument()
  })
})

describe('getAusencias contra la API', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('devuelve null si el endpoint todavía no existe (404 "Not Found")', async () => {
    vi.stubEnv('VITE_USAR_MOCKS', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 }))),
    )
    const { getAusencias } = await import('../api')
    await expect(getAusencias('2025-10-17')).resolves.toBeNull()
  })

  it('un 404 con otro mensaje (fecha sin datos) sí es error', async () => {
    vi.stubEnv('VITE_USAR_MOCKS', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Sin datos para 2030-01-01' }), { status: 404 }))),
    )
    const { getAusencias } = await import('../api')
    await expect(getAusencias('2030-01-01')).rejects.toMatchObject({ estado: 404 })
  })
})
