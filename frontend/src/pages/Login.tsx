import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { USAR_MOCKS } from '../api'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import logoLuthier from '../assets/luthier-logo.png'
import { SECCIONES } from '../components/layout/secciones'
import estilos from './Login.module.css'

export default function Login() {
  const { sesion, aviso, iniciarSesion } = useSesion()
  const ubicacion = useLocation()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    document.title = 'Ingresar · SkillUp'
  }, [])

  if (sesion) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde
    const secciones = SECCIONES[sesion.perfil]
    // Volver a donde estaba solo si esa vista es de su perfil (si entra otra persona, va a su inicio).
    const permitida = desde && secciones.some((s) => desde === s.ruta || desde.startsWith(`${s.ruta}/`))
    return <Navigate to={permitida ? desde : secciones[0].ruta} replace />
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await iniciarSesion(usuario, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className={estilos.pagina}>
      <section className={`${estilos.portada} con-lupulo`}>
        <div className={estilos.marca}>
          <span className={estilos.logo}>
            <img src={logoLuthier} alt="" width={44} height={44} />
          </span>
          <span className={estilos.nombreMarca}>SkillUp · Cervecería Luthier</span>
        </div>
        <h1 className={estilos.titulo}>
          Turnos más claros, <span>equipos más descansados</span>
        </h1>
        <p className={estilos.bajada}>La dotación correcta en cada servicio, sin sorpresas de último minuto.</p>
      </section>

      <div className={estilos.caja}>
        <h2 className={estilos.ingresar}>Ingresar</h2>
        <form onSubmit={enviar} className={estilos.formulario} noValidate>
          {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
          {error && <Aviso tipo="error">{error}</Aviso>}

          <label className={estilos.campo}>
            <span>Usuario</span>
            <input
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              required
              maxLength={64}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </label>

          <label className={estilos.campo}>
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Boton type="submit" anchoCompleto disabled={enviando || !usuario || !password}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>
        </form>

        {USAR_MOCKS && (
          <p className={estilos.ayuda}>
            Modo datos simulados: usa <strong>jefe</strong> o <strong>empleado</strong> con cualquier contraseña.
          </p>
        )}
      </div>
    </main>
  )
}
