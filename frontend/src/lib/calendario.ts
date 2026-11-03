import type { DiaCalendario } from '../api/tipos'

export type TipoMarca = 'feriado' | 'vispera' | 'pago' | 'evento' | 'dia'

export interface Marca {
  tipo: TipoMarca
  texto: string
}

/**
 * Lo que hace distinto a un día (sobredemanda): feriado, víspera, pago o quincena, eventos
 * y viernes o fin de semana. `conDia=false` omite viernes y fin de semana (útil en grillas).
 */
export function marcasDelDia(c: DiaCalendario, conDia = true): Marca[] {
  const m: Marca[] = []
  if (c.feriado) m.push({ tipo: 'feriado', texto: `Feriado: ${c.feriado}` })
  if (c.es_vispera_feriado) m.push({ tipo: 'vispera', texto: 'Víspera de feriado' })
  if (c.es_ventana_pago) m.push({ tipo: 'pago', texto: 'Día de pago / quincena' })
  for (const e of c.eventos) m.push({ tipo: 'evento', texto: `Evento: ${e.nombre}` })
  if (conDia) {
    if (c.es_viernes) m.push({ tipo: 'dia', texto: 'Viernes' })
    else if (c.es_fin_de_semana) m.push({ tipo: 'dia', texto: 'Fin de semana' })
  }
  return m
}

/** Etiqueta corta para espacios chicos (grilla y calendario). */
export const ETIQUETA_CORTA: Record<TipoMarca, string> = {
  feriado: 'Feriado',
  vispera: 'Víspera',
  pago: 'Pago',
  evento: 'Evento',
  dia: '',
}
