import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import estilos from './EncabezadoPagina.module.css'

/**
 * Título de cada vista. Al cambiar de vista mueve el foco al <h1> y actualiza el
 * título de la pestaña, para que lectores de pantalla anuncien la página nueva.
 */
export default function EncabezadoPagina({ titulo, bajada, children }: { titulo: string; bajada?: ReactNode; children?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = `${titulo} · SkillUp`
    ref.current?.focus()
  }, [titulo])

  return (
    <header className={estilos.encabezado}>
      <div>
        <h1 ref={ref} tabIndex={-1} className={estilos.titulo}>
          {titulo}
        </h1>
        {bajada && <p className={estilos.bajada}>{bajada}</p>}
      </div>
      {children && <div className={estilos.acciones}>{children}</div>}
    </header>
  )
}
