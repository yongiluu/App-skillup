import type { ComponentPropsWithRef } from 'react'
import estilos from './Boton.module.css'

type Variante = 'primario' | 'secundario' | 'fantasma'

interface Props extends ComponentPropsWithRef<'button'> {
  variante?: Variante
  anchoCompleto?: boolean
}

/** Botón real (<button>), mínimo 44 px de alto. type="button" por defecto para no enviar formularios por accidente. */
export default function Boton({ variante = 'primario', anchoCompleto, className, type = 'button', ...resto }: Props) {
  const clases = [estilos.boton, estilos[variante], anchoCompleto ? estilos.completo : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={clases} {...resto} />
}
