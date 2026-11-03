import type { ReactNode } from 'react'
import estilos from './Tarjeta.module.css'

interface Props {
  titulo?: string
  /** Contenido a la derecha del título (p. ej. una insignia) */
  extra?: ReactNode
  children: ReactNode
  /** Borde izquierdo de color según riesgo */
  acento?: 'bajo' | 'alerta' | 'alto'
}

export default function Tarjeta({ titulo, extra, children, acento }: Props) {
  return (
    <section className={`${estilos.tarjeta} ${acento ? estilos[acento] : ''}`}>
      {(titulo || extra) && (
        <header className={estilos.cabecera}>
          {titulo && <h2 className={estilos.titulo}>{titulo}</h2>}
          {extra}
        </header>
      )}
      {children}
    </section>
  )
}
