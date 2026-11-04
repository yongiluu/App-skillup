import { iniciales } from '../../lib/formato'
import estilos from './Avatar.module.css'

/** Tono estable por persona (no significa nada: solo ayuda a distinguir a la gente). */
function tono(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (h % 3) + 1
}

/** Círculo con iniciales (estilo kit Luthier). Decorativo: el nombre siempre va escrito al lado. */
export default function Avatar({ nombre, id, tamano = 40 }: { nombre: string; id?: string; tamano?: number }) {
  return (
    <span
      className={`${estilos.avatar} ${estilos[`tono${tono(id ?? nombre)}`]}`}
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.36 }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  )
}
