import type { ReactNode } from 'react'
import Icono from './Icono'
import estilos from './Aviso.module.css'

type Tipo = 'info' | 'alerta' | 'error'

/** Mensaje en línea. Los errores se anuncian a lectores de pantalla (role="alert"). */
export default function Aviso({ tipo = 'info', children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div className={`${estilos.aviso} ${estilos[tipo]}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono nombre={tipo === 'info' ? 'info' : 'alerta'} tamano={18} />
      <div>{children}</div>
    </div>
  )
}

/** Etiqueta "Pendiente" para lo que depende de la cervecería o de etapas futuras. */
export function Pendiente({ children = 'Pendiente' }: { children?: ReactNode }) {
  return <span className={estilos.pendiente}>{children}</span>
}
