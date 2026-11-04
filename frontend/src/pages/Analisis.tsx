import datos from '../data/analisis-modelo.json'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Icono from '../components/ui/Icono'
import type { ReactNode } from 'react'
import { fechaCorta, porcentaje } from '../lib/formato'
import estilos from './Analisis.module.css'

/*
 * Análisis del modelo / algoritmo (solo jefe, pensado para el computador).
 * Datos: src/data/analisis-modelo.json, generado con scripts/analisis_modelo.py a partir de los datos
 * simulados del backend. La validación oficial (AUC en prueba) viene de docs/simulacion-demo.md.
 */

const NOMBRE = { bajo: 'Bajo', alerta: 'Alerta', alto: 'Alto' } as const

function Bloque({ n, titulo, extra, children }: { n: number; titulo: string; extra?: string; children: ReactNode }) {
  return (
    <section className={estilos.bloque} aria-labelledby={`analisis-${n}`}>
      <h2 id={`analisis-${n}`} className={estilos.titulo}>
        <span className={estilos.numero}>{n}</span>
        {titulo}
        {extra && <span className={estilos.extra}>{extra}</span>}
      </h2>
      {children}
    </section>
  )
}

/** Barra de 0,5 (azar) a 1 (perfecto) con las dos marcas de AUC. */
function Auc() {
  const pos = (v: number) => `${((v - 0.5) / 0.5) * 100}%`
  const { calibrado, xgboost } = datos.auc_oficial
  return (
    <div>
      <div className={estilos.escala}>
        <span className={estilos.marcaAuc} style={{ left: pos(calibrado) }} data-tipo="calibrado">
          <b>{calibrado.toLocaleString('es-CL')}</b> calibrado
        </span>
        <span className={estilos.marcaAuc} style={{ left: pos(xgboost) }} data-tipo="xgboost">
          <b>{xgboost.toLocaleString('es-CL')}</b> XGBoost
        </span>
      </div>
      <div className={estilos.reglas}>
        <span style={{ left: 0 }}>0,5 al azar</span>
        <span style={{ left: pos(0.7) }}>0,7 aceptable</span>
        <span style={{ right: 0 }}>1,0 perfecto</span>
      </div>
    </div>
  )
}

function PorNivel() {
  return (
    <ul className={estilos.niveles}>
      {datos.niveles.map((n) => {
        const pct = n.servicios ? n.con_deficit / n.servicios : 0
        return (
          <li key={n.nivel}>
            <span className={`${estilos.etiqueta} ${estilos[n.nivel]}`}>
              {NOMBRE[n.nivel as keyof typeof NOMBRE]} · {n.servicios}
            </span>
            <span className={estilos.pista}>
              <i className={estilos[`barra_${n.nivel}`]} style={{ width: `${Math.max(1, pct * 100)}%` }} />
            </span>
            <span className={estilos.valor}>
              {n.con_deficit} con déficit ({porcentaje(pct)})
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Ejes y grilla comunes para los dos gráficos de puntos. */
function Lienzo({
  xs,
  ys,
  tituloX,
  tituloY,
  children,
  etiqueta,
}: {
  xs: [number, number, number[]]
  ys: [number, number, number[]]
  tituloX: string
  tituloY: string
  children: (x: (v: number) => number, y: (v: number) => number) => ReactNode
  etiqueta: string
}) {
  const W = 440
  const H = 300
  const P = { izq: 48, der: 12, arr: 12, aba: 44 }
  const x = (v: number) => P.izq + ((v - xs[0]) / (xs[1] - xs[0])) * (W - P.izq - P.der)
  const y = (v: number) => H - P.aba - ((v - ys[0]) / (ys[1] - ys[0])) * (H - P.aba - P.arr)
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toLocaleString('es-CL'))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={estilos.grafico} role="img" aria-label={etiqueta}>
      {xs[2].map((v) => (
        <g key={`x${v}`}>
          <line x1={x(v)} x2={x(v)} y1={P.arr} y2={H - P.aba} className={estilos.grilla} />
          <text x={x(v)} y={H - P.aba + 16} textAnchor="middle" className={estilos.eje}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {ys[2].map((v) => (
        <g key={`y${v}`}>
          <line x1={P.izq} x2={W - P.der} y1={y(v)} y2={y(v)} className={estilos.grilla} />
          <text x={P.izq - 6} y={y(v) + 4} textAnchor="end" className={estilos.eje}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {children(x, y)}
      <text x={(W + P.izq) / 2} y={H - 6} textAnchor="middle" className={estilos.tituloEje}>
        {tituloX}
      </text>
      <text x={14} y={(H - P.aba) / 2} textAnchor="middle" className={estilos.tituloEje} transform={`rotate(-90 14 ${(H - P.aba) / 2})`}>
        {tituloY}
      </text>
    </svg>
  )
}

function Calibracion() {
  const marcas = [0, 0.25, 0.5, 0.75, 1]
  return (
    <Lienzo
      xs={[0, 1, marcas]}
      ys={[0, 1, marcas]}
      tituloX="Probabilidad que dio el modelo"
      tituloY="Servicios con déficit"
      etiqueta="Calibración: probabilidad del modelo contra la proporción de servicios con déficit"
    >
      {(x, y) => (
        <>
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className={estilos.ideal} />
          <polyline
            points={datos.calibracion.map((c) => `${x(c.prob_media)},${y(c.con_deficit)}`).join(' ')}
            className={estilos.curva}
          />
          {datos.calibracion.map((c) => (
            <circle key={c.desde} cx={x(c.prob_media)} cy={y(c.con_deficit)} r={4 + Math.sqrt(c.servicios)} className={estilos.punto}>
              <title>{`${porcentaje(c.prob_media)} de probabilidad media → ${porcentaje(c.con_deficit)} con déficit (${c.servicios} servicios)`}</title>
            </circle>
          ))}
        </>
      )}
    </Lienzo>
  )
}

function Regresion() {
  const { puntos, pendiente, intercepto } = datos.regresion
  const todos = puntos.flat()
  const lo = Math.floor(Math.min(...todos) / 5) * 5
  const hi = Math.ceil(Math.max(...todos) / 5) * 5
  const marcas = Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + i * 5)
  const xFin = Math.min(hi, (hi - intercepto) / pendiente)
  return (
    <Lienzo
      xs={[lo, hi, marcas]}
      ys={[lo, hi, marcas]}
      tituloX="Dotación predicha por el modelo"
      tituloY="Personas requeridas"
      etiqueta={`Regresión de la dotación: R² ${datos.regresion.r2.toLocaleString('es-CL')}`}
    >
      {(x, y) => (
        <>
          <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} className={estilos.ideal} />
          {puntos.map(([p, r], i) => (
            <circle key={i} cx={x(p)} cy={y(r)} r={3.2} className={estilos.dato} />
          ))}
          <line x1={x(lo)} y1={y(intercepto + pendiente * lo)} x2={x(xFin)} y2={y(intercepto + pendiente * xFin)} className={estilos.ajuste} />
        </>
      )}
    </Lienzo>
  )
}

export default function Analisis() {
  const v = datos.ventana
  return (
    <>
      <EncabezadoPagina titulo="Análisis del modelo" bajada="Qué tan confiable es la predicción de déficit" />

      <div className={estilos.contenido}>
        <Bloque n={1} titulo="Validación oficial" extra="AUC en datos de prueba">
          <Auc />
        </Bloque>

        <div className={estilos.par}>
          <Bloque n={2} titulo="¿Se cumple lo que avisa?" extra={`${v.servicios} servicios`}>
            <PorNivel />
          </Bloque>
          <Bloque n={3} titulo="Calibración" extra="por tramos de probabilidad">
            <Calibracion />
          </Bloque>
        </div>

        <Bloque n={4} titulo="Regresión de la dotación" extra={`R² = ${datos.regresion.r2.toLocaleString('es-CL')}`}>
          <div className={estilos.regresion}>
            <Regresion />
            <ul className={estilos.leyenda}>
              <li>
                <Icono nombre="grafico" tamano={16} /> Pendiente {datos.regresion.pendiente.toLocaleString('es-CL')}
              </li>
              <li>
                <i className={estilos.lineaIdeal} /> Predicción perfecta
              </li>
              <li>
                <i className={estilos.lineaAjuste} /> Ajuste lineal
              </li>
            </ul>
          </div>
        </Bloque>

        <p className={estilos.nota}>
          Gráficos 2 a 4: servicios del {fechaCorta(v.desde)} al {fechaCorta(v.hasta)}. Datos simulados.
        </p>
      </div>
    </>
  )
}
