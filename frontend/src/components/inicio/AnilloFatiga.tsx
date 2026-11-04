import { Link } from 'react-router-dom'
import type { Bienestar } from '../../api/tipos'
import { COLOR_FATIGA, textoMotivos } from '../../lib/bienestar'
import estilos from './Inicio.module.css'

const NIVEL = { bajo: 'Baja', medio: 'Media', alto: 'Alta' } as const
/** Cuánto se llena el anillo: 1 de 3 (baja), 2 de 3 (media) o 3 de 3 (alta). */
const TERCIOS = { bajo: 1, medio: 2, alto: 3 } as const

const R = 52
const LARGO = 2 * Math.PI * R

/**
 * Anillo de fatiga (diseño del kit Luthier, solo para la propia persona).
 * NO calcula nada: muestra el nivel que entrega la API (backend/app/bienestar.py).
 * Sin consentimiento o sin datos, el anillo queda gris y no se muestra ningún nivel.
 */
export default function AnilloFatiga({ bienestar }: { bienestar: Bienestar }) {
  const f = bienestar.estado === 'ok' ? bienestar.fatiga : null
  const color = f ? COLOR_FATIGA[f.nivel] : 'gris'
  const lleno = f ? TERCIOS[f.nivel] / 3 : 0

  const texto = f
    ? textoMotivos(f.motivos)
    : bienestar.estado === 'sin_consentimiento'
      ? 'No compartes datos de bienestar. No se calcula nada.'
      : 'Tu reloj no envió datos recientes.'

  return (
    <section className={`${estilos.tarjeta} ${estilos[`fondo_${color}`]}`} aria-labelledby="titulo-fatiga">
      <h2 id="titulo-fatiga" className={estilos.tituloTarjeta}>
        Tu fatiga
      </h2>
      <div className={estilos.anilloFila}>
        <svg className={`${estilos.anillo} ${estilos[`trazo_${color}`]}`} viewBox="0 0 132 132" aria-hidden="true">
          <circle className={estilos.pista} cx="66" cy="66" r={R} />
          {lleno > 0 && (
            <circle
              className={estilos.arco}
              cx="66"
              cy="66"
              r={R}
              strokeDasharray={`${LARGO * lleno} ${LARGO}`}
              transform="rotate(-90 66 66)"
            />
          )}
          <text x="66" y="72" textAnchor="middle" className={estilos.centro}>
            {f ? NIVEL[f.nivel] : '—'}
          </text>
        </svg>
        <div>
          <p className={estilos.nivel}>
            <span className={`${estilos.punto} ${estilos[`punto_${color}`]}`} aria-hidden="true" />
            {f ? `Fatiga ${NIVEL[f.nivel].toLowerCase()}` : 'Sin indicador'}
          </p>
          <p className={estilos.detalleAnillo}>{texto}</p>
        </div>
      </div>
      <footer className={estilos.pieTarjeta}>
        <span>Indicador simple · No es diagnóstico</span>
        <Link to="/mi-bienestar">Ver detalle</Link>
      </footer>
    </section>
  )
}
