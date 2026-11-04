import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import estilos from './EncabezadoPagina.module.css'

/**
 * Título de cada vista. Al cambiar de vista mueve el foco al <h1> y actualiza el
 * título de la pestaña, para que lectores de pantalla anuncien la página nueva.
 */
export default function EncabezadoPagina({
  titulo,
  bajada,
  children,
  saludo = false,
}: {
  titulo: string
  bajada?: ReactNode
  children?: ReactNode
  /** Tarjeta de saludo con degradado y lúpulo (inicio de cada perfil, estilo kit Luthier) */
  saludo?: boolean
}) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = `${titulo} · SkillUp`
    ref.current?.focus()
  }, [titulo])

  return (
    <header className={`${estilos.encabezado} ${saludo ? estilos.saludo : ''}`}>
      <div>
        <h1 ref={ref} tabIndex={-1} className={estilos.titulo}>
          {titulo}
        </h1>
        {bajada && <p className={estilos.bajada}>{bajada}</p>}
      </div>
      {children && <div className={estilos.acciones}>{children}</div>}
      {saludo && (
        <svg className={estilos.lupulo} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2v2.8M12 3.2c1.2-1.2 2.8-1.2 3.6-.4M12 4.8c-3.2.8-4.8 3.2-4.8 6.4 0 4 2.4 7.6 4.8 10 2.4-2.4 4.8-6 4.8-10 0-3.2-1.6-5.6-4.8-6.4zM7.6 10c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M7.6 14c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M12 4.8v16.4" />
        </svg>
      )}
    </header>
  )
}
