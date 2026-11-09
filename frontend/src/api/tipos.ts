/**
 * Tipos del contrato de la API, copiados de backend/app/schemas.py (rama backend/etapa-1-api-mock).
 * Si Diego cambia el contrato, este archivo se actualiza en el mismo PR o en uno inmediato.
 */

/** Horario de Luthier (PR #30): "23_cierre" termina a la 01:00 o a las 02:00 según el día */
export type Franja = '13_15' | '19_21' | '21_23' | '23_cierre'
export type RolCritico = 'garzon' | 'cocinero_linea' | 'jefe_turno'
export type Rol =
  | RolCritico
  | 'runner'
  | 'host'
  | 'cajero'
  | 'ayudante_cocina'
  | 'copero'
export type NivelRiesgo = 'bajo' | 'alerta' | 'alto'
export type Perfil = 'jefe_turno' | 'empleado'

// ---------- Auth ----------
export interface LoginIn {
  usuario: string
  password: string
}

export interface LoginOut {
  access_token: string
  token_type: 'bearer'
  /** Segundos de validez del token */
  expira_en: number
  perfil: Perfil
  empleado_id: string | null
  nombre: string
  /**
   * [PROPUESTA para Diego] Fecha de "hoy" según la API (MOCK_HOY en modo mock). El empleado no puede
   * llamar a /servicios, así que no tiene otra forma de saberla. Si no viene, se usa MOCK_HOY.
   */
  hoy?: string
}

// ---------- Calendario y eventos ----------
export type TipoEvento =
  | 'partido'
  | 'concierto'
  | 'tocata'
  | 'lanzamiento'
  | 'promocion'
  | 'evento_local'
  | 'otro'

export interface Evento {
  id: number
  fecha: string
  nombre: string
  tipo: TipoEvento
  servicios: Franja[]
  impacto_esperado: 'bajo' | 'medio' | 'alto'
  notas: string | null
}

export interface DiaCalendario {
  fecha: string
  dia_semana: string
  es_viernes: boolean
  es_fin_de_semana: boolean
  es_ventana_pago: boolean
  feriado: string | null
  es_vispera_feriado: boolean
  eventos: Evento[]
}

// ---------- Servicios ----------
export interface Servicio {
  fecha: string
  servicio: Franja
  horario: string
  requeridos: number
  asignados: number
  dotacion_predicha: number
  cubiertos_previstos: number
  reservas: number
  pedidos_delivery: number
  prob_deficit: number
  nivel_riesgo: NivelRiesgo
  prob_por_rol: Record<RolCritico, number>
  recomendacion: string
}

export interface DiaServicios {
  fecha: string
  calendario: DiaCalendario
  servicios: Servicio[]
}

export interface Calendario {
  /** "YYYY-MM" */
  mes: string
  dias: DiaCalendario[]
}

export interface Semana {
  inicio: string
  fin: string
  dias: DiaServicios[]
}

// ---------- Sugerencias ----------
export interface Sugerencia {
  fecha: string
  servicio: Franja
  rol_a_cubrir: RolCritico
  prob_deficit_rol: number
  accion: 'mover' | 'llamar'
  empleado_id: string
  empleado_nombre: string
  rol_actual: string | null
  mensaje: string
}

// ---------- Empleados ----------
export interface Empleado {
  id: string
  nombre: string
  rol: Rol
  rol_respaldo: string | null
  polivalente: boolean
  puede_cubrir: string[]
  tipo_contrato: 'full_time' | 'part_time' | 'weekend_only'
  preferencia_turno: 'midday' | 'evening' | 'mixed'
}

export interface Turno {
  empleado_id: string
  fecha: string
  servicio: Franja
  rol: Rol
  horas_programadas: number
}

export interface Ausencia {
  fecha: string
  /** Nunca el diagnóstico */
  motivo: 'personal' | 'salud'
  horas: number
  aviso_corto: boolean
}

// ---------- Bienestar (datos sensibles, simulados) ----------
// Rama backend/biometria-simulada. Reglas: sin consentimiento no se muestra nada;
// el jefe de turno solo ve el indicador (nivel + motivos); los datos crudos solo la propia persona.

export type EstadoBienestar = 'ok' | 'sin_consentimiento' | 'sin_datos'
export type NivelFatiga = 'bajo' | 'medio' | 'alto'
export type MotivoFatiga = 'descanso' | 'carga_fisica' | 'jornada' | 'autorreporte'

export interface Consentimiento {
  otorgado: boolean
  fecha: string | null
  version_texto: string
}

export interface IndicadorFatiga {
  nivel: NivelFatiga
  /** Hasta 2 motivos generales, del más al menos influyente */
  motivos: MotivoFatiga[]
  calculado_al: string
  dias_considerados: number
}

export interface Bienestar {
  estado: EstadoBienestar
  consentimiento: Consentimiento
  fatiga: IndicadorFatiga | null
  tests: { estado: 'pendiente'; nota: string }
}

export interface FatigaEquipo {
  empleado_id: string
  nombre: string
  rol: Rol
  estado: EstadoBienestar
  fatiga: IndicadorFatiga | null
}

export interface RegistroBienestar {
  fecha: string
  /** null = el reloj no tuvo buena señal ese día */
  pasos: number | null
  sueno_horas: number | null
  pulso_medio_bpm: number | null
  /** 1 = totalmente alerta, 7 = agotado/a */
  encuesta_fatiga_inicio: number
  encuesta_fatiga_fin: number
}

/** Datos crudos: solo los ve la propia persona (el jefe recibe 403). */
export interface BienestarPropio extends Bienestar {
  empleado_id: string
  registros: RegistroBienestar[]
}

export interface EmpleadoFicha extends Empleado {
  antiguedad_anos: number
  /** null si no se conoce (desde la etapa 2 del backend) */
  distancia_trabajo_km: number | null
  dias_seguidos_trabajados: number
  horas_extra_ultimos_7_dias: number
  ausencias: Ausencia[]
  proximos_turnos: Turno[]
  /** Lo que ve el jefe: estado, consentimiento e indicador. Nunca datos crudos. */
  bienestar: Bienestar
}

// ---------- Ausencias del día (GET /ausencias?fecha=) ----------
export interface AusenciaDia {
  empleado_id: string
  nombre: string
  rol: Rol
  fecha: string
  /** Nunca el diagnóstico */
  motivo: 'personal' | 'salud'
  horas: number
  aviso_corto: boolean
  /** Servicios del día en que esa persona estaba programada */
  servicios: Franja[]
}

// ---------- Solicitudes de cambio de turno ----------
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada'
/** Lo que contestó la persona propuesta como reemplazo */
export type RespuestaReemplazo = 'pendiente' | 'aceptada' | 'rechazada'

/** Alguien que ya dijo que no a cubrir ese turno */
export interface Rechazo {
  empleado_id: string
  /** Fecha y hora ISO */
  rechazado_en: string
}

export interface SolicitudCambioIn {
  solicitante_id: string
  fecha: string
  servicio: Franja
  /** Quién cubre, si ya se sabe */
  reemplazo_id?: string | null
  /** Máximo 300 caracteres */
  motivo?: string | null
}

export interface SolicitudCambio {
  id: number
  solicitante_id: string
  fecha: string
  servicio: Franja
  reemplazo_id: string | null
  /** null si no hay reemplazo propuesto. El jefe solo puede aprobar si es 'aceptada'. */
  respuesta_reemplazo: RespuestaReemplazo | null
  /** Cuándo contestó el reemplazo */
  respondida_en: string | null
  /** Desde cuándo está propuesto el reemplazo actual */
  propuesto_en: string | null
  /** Quiénes ya dijeron que no, en orden */
  rechazaron: Rechazo[]
  motivo: string | null
  estado: EstadoSolicitud
  comentario: string | null
  /** Jefe de turno que la resolvió */
  resuelta_por: string | null
  creada_en: string
  actualizada_en: string
}

/**
 * Posible reemplazo para un turno (GET /disponibles). El empleado recibe solo a los disponibles
 * y sin motivo; el jefe de turno recibe a todos, con `motivo` cuando no pueden.
 */
export interface Disponible {
  empleado_id: string
  nombre: string
  rol: Rol
  disponible: boolean
  motivo: string | null
}
