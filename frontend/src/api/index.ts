/**
 * Punto de entrada a los datos. Las vistas llaman SOLO a estas funciones.
 * Con VITE_USAR_MOCKS=true responden los JSON de ./mocks (capturados de la API real de las
 * ramas backend/etapa-1-api-mock y backend/biometria-simulada; ver mocks/LEEME.md).
 * Con false llaman a la API. Para pasar a la API en la etapa 2 no hay que tocar las vistas.
 */
import { ErrorApi, pedir } from './cliente'
import type {
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

export const USAR_MOCKS = import.meta.env.VITE_USAR_MOCKS !== 'false'

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
