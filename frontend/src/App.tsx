import { Navigate, Route, Routes } from 'react-router-dom'
import { useSesion } from './auth/sesion'
import RutaProtegida from './auth/RutaProtegida'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Hoy from './pages/Hoy'
import Planificador from './pages/Planificador'
import Equipo from './pages/Equipo'
import Ficha from './pages/Ficha'
import MiTurno from './pages/MiTurno'
import NoEncontrado from './pages/NoEncontrado'
import SistemaVisual from './pages/SistemaVisual'

/** Al entrar a "/" se va al inicio según el perfil. */
function Inicio() {
  const { sesion } = useSesion()
  if (!sesion) return <Navigate to="/login" replace />
  return <Navigate to={sesion.perfil === 'jefe_turno' ? '/hoy' : '/mi-turno'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />

      {/* Vistas desktop: solo jefe de turno (igual que los permisos del backend) */}
      <Route element={<RutaProtegida perfiles={['jefe_turno']} />}>
        <Route element={<Layout />}>
          <Route path="/hoy" element={<Hoy />} />
          <Route path="/planificador" element={<Planificador />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="/equipo/:id" element={<Ficha />} />
        </Route>
      </Route>

      {/* Inicio del empleado (vistas móviles en la etapa 3) */}
      <Route element={<RutaProtegida perfiles={['empleado']} />}>
        <Route path="/mi-turno" element={<MiTurno />} />
      </Route>

      {import.meta.env.DEV && <Route path="/sistema-visual" element={<SistemaVisual />} />}
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
