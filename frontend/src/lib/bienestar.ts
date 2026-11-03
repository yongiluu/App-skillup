import type { MotivoFatiga, NivelFatiga, NivelRiesgo } from '../api/tipos'

export const ETIQUETA_FATIGA: Record<NivelFatiga, string> = {
  bajo: 'Fatiga baja',
  medio: 'Fatiga media',
  alto: 'Fatiga alta',
}

/** Usa los mismos colores que los estados de riesgo. */
export const COLOR_FATIGA: Record<NivelFatiga, NivelRiesgo> = {
  bajo: 'bajo',
  medio: 'alerta',
  alto: 'alto',
}

/** Motivos generales: es lo único que ve el jefe además del nivel. */
export const ETIQUETA_MOTIVO: Record<MotivoFatiga, string> = {
  descanso: 'poco descanso',
  carga_fisica: 'carga física',
  jornada: 'jornada larga',
  autorreporte: 'cansancio informado',
}

export function textoMotivos(motivos: MotivoFatiga[]): string {
  if (motivos.length === 0) return 'Sin señales de fatiga'
  const t = motivos.map((m) => ETIQUETA_MOTIVO[m]).join(' y ')
  return `Motivo: ${t}`
}
