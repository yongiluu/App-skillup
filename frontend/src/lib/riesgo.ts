import type { NivelRiesgo } from '../api/tipos'

/** Umbrales acordados por el equipo (README e instrucciones del proyecto). */
export const UMBRAL_ALERTA = 0.55
export const UMBRAL_ALTO = 0.75

/**
 * Nivel de riesgo a partir de una probabilidad de déficit (0 a 1).
 * La API ya manda `nivel_riesgo` en cada servicio; esta función sirve para lo que
 * no lo trae (por ejemplo `prob_por_rol`) y debe dar el mismo resultado que el backend.
 */
export function nivelDeRiesgo(prob: number): NivelRiesgo {
  if (prob >= UMBRAL_ALTO) return 'alto'
  if (prob >= UMBRAL_ALERTA) return 'alerta'
  return 'bajo'
}

export const ETIQUETA_RIESGO: Record<NivelRiesgo, string> = {
  bajo: 'Riesgo bajo',
  alerta: 'Alerta',
  alto: 'Riesgo alto',
}
