import type { Franja, Rol } from '../api/tipos'

export const HORARIO_FRANJA: Record<Franja, string> = {
  '11_13': '11:00–13:00',
  '13_15': '13:00–15:00',
  '19_21': '19:00–21:00',
  '21_23': '21:00–23:00',
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

/** 0.968 → "97 %" (formato chileno, con espacio antes del %; espacio duro para que no se corte la línea). */
export function porcentaje(prob: number): string {
  return `${Math.round(prob * 100)}\u00a0%`
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
