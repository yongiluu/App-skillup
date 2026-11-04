import type { AusenciaDia, Franja, RolCritico, Servicio } from '../api/tipos'

/**
 * Cobertura real de un servicio con datos que ya entrega la API (no es una variable nueva):
 * `asignados` cuenta a todos los programados, incluso a quien avisó que no viene.
 * Presentes = programados − quienes avisaron ausencia en ese servicio (GET /ausencias).
 */
export function cobertura(s: Servicio, ausencias: AusenciaDia[] | null) {
  const ausentes = ausencias ? ausencias.filter((a) => a.servicios.includes(s.servicio as Franja)).length : null
  const presentes = ausentes === null ? s.asignados : Math.max(0, s.asignados - ausentes)
  return { ausentes, presentes, faltan: Math.max(0, s.requeridos - presentes) }
}

const ROLES: RolCritico[] = ['garzon', 'cocinero_linea', 'jefe_turno']

/** El rol crítico con más probabilidad de faltar (prob_por_rol del modelo). */
export function rolMasEnRiesgo(s: Servicio): { rol: RolCritico; prob: number } {
  const rol = ROLES.reduce((a, b) => (s.prob_por_rol[b] > s.prob_por_rol[a] ? b : a))
  return { rol, prob: s.prob_por_rol[rol] }
}
