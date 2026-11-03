import { describe, expect, it } from 'vitest'
import { nivelDeRiesgo } from '../lib/riesgo'
import servicios from '../api/mocks/servicios.json'

describe('nivelDeRiesgo', () => {
  it('respeta los umbrales acordados (alerta ≥ 0,55 y alto ≥ 0,75)', () => {
    expect(nivelDeRiesgo(0)).toBe('bajo')
    expect(nivelDeRiesgo(0.549)).toBe('bajo')
    expect(nivelDeRiesgo(0.55)).toBe('alerta')
    expect(nivelDeRiesgo(0.749)).toBe('alerta')
    expect(nivelDeRiesgo(0.75)).toBe('alto')
    expect(nivelDeRiesgo(1)).toBe('alto')
  })

  it('da lo mismo que el backend para los servicios de ejemplo', () => {
    for (const s of servicios.servicios) {
      expect(nivelDeRiesgo(s.prob_deficit)).toBe(s.nivel_riesgo)
    }
  })
})
