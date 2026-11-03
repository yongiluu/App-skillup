/**
 * Fechas "YYYY-MM-DD" sin zona horaria. Todo se calcula en UTC para que el día
 * no se corra según el computador (Chile cambia de horario dos veces al año).
 */
const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`)
const aIso = (d: Date) => d.toISOString().slice(0, 10)

export function sumarDias(iso: string, dias: number): string {
  const d = aFecha(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return aIso(d)
}

/** Lunes de la semana de esa fecha (la semana parte el lunes, como en la API). */
export function lunesDe(iso: string): string {
  const dia = aFecha(iso).getUTCDay() // 0 = domingo
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia)
}

/** "2025-10-17" → "2025-10" */
export const mesDe = (iso: string) => iso.slice(0, 7)

/** Día de la semana (0 = lunes … 6 = domingo). */
export const diaSemana = (iso: string) => (aFecha(iso).getUTCDay() + 6) % 7

/** Días del mes "YYYY-MM" (28 a 31). */
export function diasDelMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

const formato = (iso: string, opciones: Intl.DateTimeFormatOptions) =>
  aFecha(iso).toLocaleDateString('es-CL', { timeZone: 'UTC', ...opciones })

/** "2025-10-13", "2025-10-19" → "13 al 19 de octubre de 2025" (o "29 de septiembre al 5 de octubre de 2025"). */
export function rangoSemana(inicio: string, fin: string): string {
  const mismoMes = mesDe(inicio) === mesDe(fin)
  const mismoAno = inicio.slice(0, 4) === fin.slice(0, 4)
  const desde = mismoMes
    ? formato(inicio, { day: 'numeric' })
    : formato(inicio, mismoAno ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
  return `${desde} al ${formato(fin, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

/** "2025-10" → "octubre de 2025" */
export const nombreMes = (mes: string) => formato(`${mes}-01`, { month: 'long', year: 'numeric' })

/** "2025-10-13" → { corto: "lun", numero: "13" } */
export function encabezadoDia(iso: string) {
  return {
    corto: formato(iso, { weekday: 'short' }).replace('.', ''),
    largo: formato(iso, { weekday: 'long', day: 'numeric', month: 'long' }),
    numero: formato(iso, { day: 'numeric' }),
  }
}
