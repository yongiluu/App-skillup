import type { Franja, Rol } from '../api/tipos'

/** Franjas en orden del día (horario de Luthier, PR #30). */
export const FRANJAS: Franja[] = ['13_15', '19_21', '21_23', '23_cierre']

/** Horario sin fecha. El cierre depende del día: usa `horario(franja, fecha)` cuando se conoce la fecha. */
export const HORARIO_FRANJA: Record<Franja, string> = {
  '13_15': '13:00–15:00',
  '19_21': '19:00–21:00',
  '21_23': '21:00–23:00',
  '23_cierre': '23:00–cierre',
}

/**
 * Horario en palabras, igual que el backend (app/logica.py → horario):
 * el cierre es a las 02:00 viernes y sábado, y a la 01:00 el resto de los días.
 */
export function horario(franja: Franja, fecha?: string): string {
  if (franja !== '23_cierre' || !fecha) return HORARIO_FRANJA[franja]
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay() // 5 = viernes, 6 = sábado
  return dia === 5 || dia === 6 ? '23:00–02:00' : '23:00–01:00'
}

export const NOMBRE_ROL: Record<Rol, string> = {
  garzon: 'Garzón',
  cocinero_linea: 'Cocinero de línea',
  jefe_turno: 'Jefe de turno',
  runner: 'Runner',
  host: 'Host',
  cajero: 'Cajero',
  ayudante_cocina: 'Ayudante de cocina',
  copero: 'Copero',
}

/**
 * 0.968 → "96 %" (formato chileno, con espacio duro antes del %).
 * Se redondea hacia abajo para que calce con los umbrales: 0,549 es "Riesgo bajo" y se muestra 54 %, no 55 %.
 */
export function porcentaje(prob: number): string {
  return `${Math.floor(prob * 100 + 1e-9)}\u00a0%`
}

/** "2025-10-17" → "viernes 17 de octubre de 2025". Se arma a mediodía para no correr el día por zona horaria. */
export function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "2025-09-15" → "15-09-2025" */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}-${m}-${a}`
}

/** "2025-10-17" → "vie 17 oct" */
export function fechaBreve(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Iniciales de un nombre: "Cristóbal Silva" → "CS". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
