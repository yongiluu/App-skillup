/**
 * Punto de entrada a los datos. Las vistas llaman SOLO a estas funciones.
 * Por defecto llaman a la API de Diego (VITE_API_URL). Con VITE_USAR_MOCKS=true responden los
 * JSON de ./mocks (respuestas reales capturadas de la API; ver mocks/LEEME.md): sirven para las
 * pruebas automáticas y para trabajar sin el backend corriendo.
 */
import { ErrorApi, pedir } from './cliente'
import type {
  AusenciaDia,
  BienestarPropio,
  Calendario,
  DiaServicios,
  Empleado,
  EmpleadoFicha,
  FatigaEquipo,
  LoginIn,
  LoginOut,
  Semana,
  SolicitudCambio,
  SolicitudCambioIn,
  Sugerencia,
  Turno,
} from './tipos'
import mockServicios from './mocks/servicios.json'
import mockSemanas from './mocks/semanas.json'
import mockCalendario from './mocks/calendario.json'
import mockSugerencias from './mocks/sugerencias.json'
import mockEmpleados from './mocks/empleados.json'
import mockFatiga from './mocks/fatiga.json'
import mockFichas from './mocks/fichas.json'
import mockBienestarPropio from './mocks/bienestar-propio.json'
import mockAusencias from './mocks/ausencias.json'
import mockTurnosPropios from './mocks/turnos-propios.json'

export const USAR_MOCKS = import.meta.env.VITE_USAR_MOCKS === 'true'

/** "Hoy" de los datos simulados (igual que MOCK_HOY del backend). */
export const MOCK_HOY = '2025-10-17'

const simularRed = <T>(datos: T): Promise<T> =>
  new Promise((resolver) => setTimeout(() => resolver(structuredClone(datos)), 150))

export function login(datos: LoginIn): Promise<LoginOut> {
  if (USAR_MOCKS) {
    // Solo para desarrollo sin backend: acepta los usuarios de prueba con cualquier contraseña.
    const usuario = datos.usuario.trim().toLowerCase()
    if (usuario !== 'jefe' && usuario !== 'empleado') {
      return Promise.reject(new Error('Usuario o contraseña incorrectos'))
    }
    return simularRed<LoginOut>({
      access_token: 'token-simulado',
      token_type: 'bearer',
      expira_en: 8 * 60 * 60,
      perfil: usuario === 'jefe' ? 'jefe_turno' : 'empleado',
      // Mismos usuarios de prueba que el backend (USUARIOS_DEMO en backend/app/seguridad.py)
      empleado_id: usuario === 'jefe' ? 'RST_055' : 'RST_056',
      nombre: usuario === 'jefe' ? 'Catalina Flores' : 'Cristóbal Silva',
      hoy: MOCK_HOY,
    })
  }
  return pedir<LoginOut>('/auth/login', { method: 'POST', body: JSON.stringify(datos) })
}

export function getServicios(fecha?: string): Promise<DiaServicios> {
  if (USAR_MOCKS) return simularRed(mockServicios as DiaServicios)
  return pedir<DiaServicios>(`/servicios${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`)
}

/** 7 días × 4 servicios desde `inicio`. Sin `inicio`, la API usa el lunes de su "hoy". */
export function getSemana(inicio?: string): Promise<Semana> {
  if (USAR_MOCKS) {
    const semanas = mockSemanas.semanas as Record<string, Semana>
    const semana = semanas[inicio ?? mockSemanas.hoy]
    if (!semana) {
      const fechas = Object.keys(semanas)
      return Promise.reject(
        new ErrorApi(404, `Sin datos de ejemplo para la semana que empieza el ${inicio}. Disponibles: ${fechas[0]} a ${fechas.at(-1)}.`),
      )
    }
    return simularRed(semana)
  }
  return pedir<Semana>(`/semana${inicio ? `?inicio=${encodeURIComponent(inicio)}` : ''}`)
}

/** Días de pago, quincenas, feriados, vísperas y eventos de un mes ("YYYY-MM"). */
export function getCalendario(mes?: string): Promise<Calendario> {
  if (USAR_MOCKS) {
    const meses = mockCalendario as Record<string, Calendario>
    const cal = meses[mes ?? MOCK_HOY.slice(0, 7)]
    return cal ? simularRed(cal) : Promise.reject(new ErrorApi(404, `Sin calendario de ejemplo para ${mes}.`))
  }
  return pedir<Calendario>(`/calendario${mes ? `?mes=${encodeURIComponent(mes)}` : ''}`)
}

export function getSugerencias(fecha?: string): Promise<Sugerencia[]> {
  if (USAR_MOCKS) return simularRed(mockSugerencias as Sugerencia[])
  return pedir<Sugerencia[]>(`/sugerencias${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`)
}

export function getEmpleados(): Promise<Empleado[]> {
  if (USAR_MOCKS) return simularRed(mockEmpleados as Empleado[])
  return pedir<Empleado[]>('/empleados')
}

// ---------- Bienestar (datos sensibles, simulados) ----------

/** Solo jefe de turno: indicador de fatiga de cada persona (nunca datos crudos). */
export function getFatigaEquipo(fecha?: string): Promise<FatigaEquipo[]> {
  if (USAR_MOCKS) return simularRed(mockFatiga as FatigaEquipo[])
  return pedir<FatigaEquipo[]>(`/bienestar/fatiga${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`)
}

/** Ficha de una persona. El bienestar viene solo como estado + indicador. */
export function getFicha(id: string): Promise<EmpleadoFicha> {
  if (USAR_MOCKS) {
    const ficha = (mockFichas as Record<string, EmpleadoFicha>)[id]
    return ficha ? simularRed(ficha) : Promise.reject(new ErrorApi(404, `No existe el empleado ${id}`))
  }
  return pedir<EmpleadoFicha>(`/empleados/${encodeURIComponent(id)}`)
}

/** Solo la propia persona: sus datos crudos de bienestar. */
export function getBienestarPropio(id: string): Promise<BienestarPropio> {
  if (USAR_MOCKS) {
    if (id !== mockBienestarPropio.empleado_id) {
      return Promise.reject(new ErrorApi(403, 'Los datos de bienestar solo los puede ver la propia persona'))
    }
    return simularRed(mockBienestarPropio as BienestarPropio)
  }
  return pedir<BienestarPropio>(`/empleados/${encodeURIComponent(id)}/bienestar`)
}

// ---------- Ausencias del día ----------

/**
 * Ausencias de un día, con los servicios afectados: GET /ausencias?fecha= (solo jefe; PR #16 de Diego).
 * Devuelve null si la API que se usa es anterior y no tiene ese endpoint, para que la vista lo indique.
 */
export async function getAusencias(fecha?: string): Promise<AusenciaDia[] | null> {
  if (USAR_MOCKS) return simularRed(mockAusencias as AusenciaDia[])
  try {
    return await pedir<AusenciaDia[]>(`/ausencias${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`)
  } catch (e) {
    // FastAPI responde {"detail": "Not Found"} cuando la ruta no existe.
    if (e instanceof ErrorApi && e.estado === 404 && e.message === 'Not Found') return null
    throw e
  }
}

// ---------- Turnos y solicitudes de cambio ----------

/** Turnos de una persona (el empleado solo los suyos; el jefe, los de cualquiera). */
export function getTurnos(empleadoId: string, desde?: string): Promise<Turno[]> {
  if (USAR_MOCKS) {
    const turnos = (mockTurnosPropios as Turno[]).filter(
      (t) => t.empleado_id === empleadoId && (!desde || t.fecha >= desde),
    )
    return simularRed(turnos)
  }
  const q = desde ? `?desde=${encodeURIComponent(desde)}` : ''
  return pedir<Turno[]>(`/empleados/${encodeURIComponent(empleadoId)}/turnos${q}`)
}

/*
 * En modo simulado las solicitudes viven en memoria, igual que en el backend con FUENTE_DATOS=mock:
 * parten vacías y se pierden al recargar la página.
 */
let solicitudesMock: SolicitudCambio[] = []
let siguienteId = 1

/** Solo para las pruebas: vuelve a dejar las solicitudes simuladas vacías. */
export function reiniciarSolicitudesMock() {
  solicitudesMock = []
  siguienteId = 1
}

/** El jefe ve todas; el empleado, las que pidió o en las que lo proponen como reemplazo. */
export function getSolicitudes(): Promise<SolicitudCambio[]> {
  if (USAR_MOCKS) return simularRed(solicitudesMock)
  return pedir<SolicitudCambio[]>('/solicitudes-cambio')
}

export function crearSolicitud(datos: SolicitudCambioIn): Promise<SolicitudCambio> {
  if (USAR_MOCKS) {
    const tiene = (mockTurnosPropios as Turno[]).some(
      (t) => t.empleado_id === datos.solicitante_id && t.fecha === datos.fecha && t.servicio === datos.servicio,
    )
    if (!tiene) {
      return Promise.reject(
        new ErrorApi(409, `${datos.solicitante_id} no tiene turno el ${datos.fecha} en ${datos.servicio}`),
      )
    }
    const ahora = new Date().toISOString()
    const nueva: SolicitudCambio = {
      id: siguienteId++,
      solicitante_id: datos.solicitante_id,
      fecha: datos.fecha,
      servicio: datos.servicio,
      reemplazo_id: datos.reemplazo_id ?? null,
      motivo: datos.motivo ?? null,
      estado: 'pendiente',
      comentario: null,
      resuelta_por: null,
      creada_en: ahora,
      actualizada_en: ahora,
    }
    solicitudesMock = [...solicitudesMock, nueva]
    return simularRed(nueva)
  }
  return pedir<SolicitudCambio>('/solicitudes-cambio', { method: 'POST', body: JSON.stringify(datos) })
}

/** Solo jefe de turno. Solo se pueden resolver solicitudes pendientes. */
export function resolverSolicitud(
  id: number,
  estado: 'aprobada' | 'rechazada',
  comentario?: string,
): Promise<SolicitudCambio> {
  if (USAR_MOCKS) {
    const s = solicitudesMock.find((x) => x.id === id)
    if (!s) return Promise.reject(new ErrorApi(404, `No existe la solicitud ${id}`))
    if (s.estado !== 'pendiente') return Promise.reject(new ErrorApi(409, `La solicitud ya está ${s.estado}`))
    const actualizada: SolicitudCambio = {
      ...s,
      estado,
      comentario: comentario || null,
      resuelta_por: 'RST_055',
      actualizada_en: new Date().toISOString(),
    }
    solicitudesMock = solicitudesMock.map((x) => (x.id === id ? actualizada : x))
    return simularRed(actualizada)
  }
  return pedir<SolicitudCambio>(`/solicitudes-cambio/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, comentario: comentario || null }),
  })
}
