import type React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSesion } from '../../auth/sesion'
import { USAR_MOCKS } from '../../api'
import Icono from '../ui/Icono'
import { SECCIONES } from './secciones'
import estilos from './Layout.module.css'

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace

/**
 * Estructura común (estilo demo Luthier):
 * - Escritorio (≥ 900 px): cabecera oliva con lúpulo, con la marca, las secciones y el usuario.
 * - Celular: la misma cabecera arriba y las secciones como pestañas abajo.
 * Es el mismo <nav>: cambia solo el CSS.
 */
export default function Layout() {
  const { sesion, cerrarSesion } = useSesion()

  return (
    <div className={estilos.marco}>
      <a href="#contenido" className={estilos.saltar}>
        Saltar al contenido
      </a>

      <header className={`${estilos.cabecera} con-lupulo`}>
        <div className={estilos.envoltorio}>
          <div className={estilos.marca}>
            <span className={estilos.logo}>
              <Icono nombre="lupulo" tamano={22} />
            </span>
            <span className={estilos.textoMarca}>
              <b>SkillUp</b>
              <span>Cervecería Luthier</span>
            </span>
          </div>

          <nav aria-label="Principal" className={estilos.nav}>
            <ul style={{ '--secciones': SECCIONES[sesion?.perfil ?? 'empleado'].length } as React.CSSProperties}>
              {SECCIONES[sesion?.perfil ?? 'empleado'].map((s) => (
                <li key={s.ruta}>
                  <NavLink to={s.ruta} className={claseEnlace}>
                    <span className={estilos.icono}>
                      <Icono nombre={s.icono} />
                    </span>
                    <span>{s.nombre}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={estilos.usuario}>
            <span className={estilos.datosUsuario}>
              <b>{sesion?.nombre}</b>
              <span>{sesion?.perfil === 'jefe_turno' ? 'Jefe de turno' : 'Empleado'}</span>
            </span>
            <button type="button" className={estilos.salir} onClick={() => cerrarSesion()}>
              <Icono nombre="salir" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className={estilos.contenido}>
        {USAR_MOCKS && (
          <p className={estilos.simulados} role="note">
            Datos simulados · “hoy” es el 17 de octubre de 2025 · [PENDIENTE CERVECERÍA]
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
