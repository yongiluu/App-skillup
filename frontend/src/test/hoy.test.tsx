import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccionesSugeridas from '../components/hoy/AccionesSugeridas'
import AusenciasDia from '../components/hoy/AusenciasDia'
import sugerencias from '../api/mocks/sugerencias.json'
import ausencias from '../api/mocks/ausencias.json'
import type { AusenciaDia, Sugerencia } from '../api/tipos'

describe('acciones sugeridas', () => {
  it('agrupa por servicio y rol, en orden de franja', () => {
    render(
      <MemoryRouter>
        <AccionesSugeridas sugerencias={sugerencias as Sugerencia[]} />
      </MemoryRouter>,
    )
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    // Las sugerencias del 17-10 son para el cierre del viernes (23:00–02:00)
    expect(titulos[0]).toMatch(/^23:00–02:00 · Garzón/)
    // Cada sugerencia aparece una vez con su acción
    expect(screen.getAllByText(/^(Mover|Llamar)$/)).toHaveLength(sugerencias.length)
    // "Llamar" y "Mover" abren la ficha de la persona (AP-09)
    const s0 = (sugerencias as Sugerencia[])[0]
    expect(screen.getAllByRole('link', { name: new RegExp(`ver la ficha de ${s0.empleado_nombre}`) })[0]).toHaveAttribute(
      'href',
      `/equipo/${s0.empleado_id}`,
    )
  })

  it('sin sugerencias lo dice', () => {
    render(
      <MemoryRouter>
        <AccionesSugeridas sugerencias={[]} />
      </MemoryRouter>,
    )
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
    expect(within(fila).getByText("Programado/a en 19:00–21:00")).toBeInTheDocument()
    expect(within(fila).getByText('Salud')).toBeInTheDocument()
    expect(within(fila).getByText('Aviso corto')).toBeInTheDocument()
  })
})

describe('getAusencias contra la API', () => {
  // El módulo de la API lee VITE_USAR_MOCKS al cargarse: hay que cargarlo de nuevo en cada prueba.
  beforeEach(() => vi.resetModules())
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
