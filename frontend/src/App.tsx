import { Navigate, Route, Routes } from 'react-router-dom'
import { useSesion } from './auth/sesion'
import RutaProtegida from './auth/RutaProtegida'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Hoy from './pages/Hoy'
import Planificador from './pages/Planificador'
import Equipo from './pages/Equipo'
import Ficha from './pages/Ficha'
import MisTurnos from './pages/MisTurnos'
import MisSolicitudes from './pages/MisSolicitudes'
import MiBienestar from './pages/MiBienestar'
import Solicitudes from './pages/Solicitudes'
import Analisis from './pages/Analisis'
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
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/analisis" element={<Analisis />} />
        </Route>
      </Route>

      {/* Vistas del empleado (pensadas para el celular) */}
      <Route element={<RutaProtegida perfiles={['empleado']} />}>
        <Route element={<Layout />}>
          <Route path="/mi-turno" element={<MisTurnos />} />
          <Route path="/mis-solicitudes" element={<MisSolicitudes />} />
          <Route path="/mi-bienestar" element={<MiBienestar />} />
        </Route>
      </Route>

      {import.meta.env.DEV && <Route path="/sistema-visual" element={<SistemaVisual />} />}
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
