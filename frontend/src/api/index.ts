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
  DiaServicios,
  Empleado,
  EmpleadoFicha,
  FatigaEquipo,
  LoginIn,
  LoginOut,
  Semana,
  Sugerencia,
} from './tipos'
import mockServicios from './mocks/servicios.json'
import mockSemana from './mocks/semana.json'
import mockSugerencias from './mocks/sugerencias.json'
import mockEmpleados from './mocks/empleados.json'
import mockFatiga from './mocks/fatiga.json'
import mockFichas from './mocks/fichas.json'
import mockBienestarPropio from './mocks/bienestar-propio.json'
import mockAusencias from './mocks/ausencias.json'

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
      empleado_id: usuario === 'jefe' ? 'RST_008' : 'RST_001',
      nombre: usuario === 'jefe' ? 'Javiera Espinoza' : 'Agustín Díaz',
    })
  }
  return pedir<LoginOut>('/auth/login', { method: 'POST', body: JSON.stringify(datos) })
}

export function getServicios(fecha?: string): Promise<DiaServicios> {
  if (USAR_MOCKS) return simularRed(mockServicios as DiaServicios)
  return pedir<DiaServicios>(`/servicios${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`)
}

export function getSemana(inicio?: string): Promise<Semana> {
  if (USAR_MOCKS) return simularRed(mockSemana as Semana)
  return pedir<Semana>(`/semana${inicio ? `?inicio=${encodeURIComponent(inicio)}` : ''}`)
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

// ---------- Ausencias del día [PROPUESTA: endpoint aún no existe en el backend] ----------

/**
 * Ausencias de un día, con los servicios afectados. Propuesta para Diego: GET /ausencias?fecha=
 * (solo jefe). Devuelve null mientras el endpoint no exista, para que la vista lo indique.
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
