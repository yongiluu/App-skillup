import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Boton from '../components/ui/Boton'
import InsigniaRiesgo from '../components/ui/InsigniaRiesgo'
import Tarjeta from '../components/ui/Tarjeta'
import Aviso, { Pendiente } from '../components/ui/Aviso'
import { UMBRAL_ALERTA, UMBRAL_ALTO } from '../lib/riesgo'
import estilos from './SistemaVisual.module.css'

const COLORES = [
  ['--color-primario', 'Primario'],
  ['--color-primario-suave', 'Primario suave'],
  ['--color-ambar', 'Ámbar'],
  ['--color-superficie', 'Superficie'],
  ['--color-hundido', 'Hundido'],
  ['--color-texto', 'Texto'],
  ['--color-texto-suave', 'Texto suave'],
  ['--color-borde', 'Borde'],
  ['--color-fondo', 'Fondo'],
  ['--riesgo-bajo-borde', 'Riesgo bajo'],
  ['--riesgo-alerta-borde', 'Alerta'],
  ['--riesgo-alto-borde', 'Riesgo alto'],
] as const

/** Catálogo del sistema visual (solo en desarrollo: /sistema-visual). Sirve para revisar PRs de UI. */
export default function SistemaVisual() {
  return (
    <main className={estilos.pagina}>
      <EncabezadoPagina titulo="Sistema visual" bajada="Tokens y componentes base, estilo demo Luthier (solo desarrollo). Cambia el sistema a modo oscuro para ver la otra paleta." />

      <section className={estilos.seccion}>
        <h2>Colores</h2>
        <div className={estilos.muestras}>
          {COLORES.map(([variable, nombre]) => (
            <div key={variable} className={estilos.muestra}>
              <span className={estilos.color} style={{ background: `var(${variable})` }} />
              <strong>{nombre}</strong>
              <code>{variable}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2>Estados de riesgo</h2>
        <p className={estilos.nota}>
          Bajo &lt; {UMBRAL_ALERTA} · Alerta ≥ {UMBRAL_ALERTA} · Alto ≥ {UMBRAL_ALTO}
        </p>
        <div className={estilos.fila}>
          <InsigniaRiesgo nivel="bajo" prob={0.41} />
          <InsigniaRiesgo nivel="alerta" prob={0.62} />
          <InsigniaRiesgo nivel="alto" prob={0.97} />
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2>Tipografía</h2>
        <p style={{ fontSize: 'var(--texto-2xl)', fontWeight: 600 }}>Cifra 2xl · 32 px</p>
        <p style={{ fontSize: 'var(--texto-xl)', fontWeight: 600 }}>Título xl · 28 px</p>
        <p style={{ fontSize: 'var(--texto-md)' }}>Texto base · 16 px — Inter</p>
        <p style={{ fontSize: 'var(--texto-sm)', color: 'var(--color-texto-suave)' }}>Texto pequeño · 14 px</p>
      </section>

      <section className={estilos.seccion}>
        <h2>Botones (mínimo 44 px)</h2>
        <div className={estilos.fila}>
          <Boton>Primario</Boton>
          <Boton variante="secundario">Secundario</Boton>
          <Boton variante="fantasma">Fantasma</Boton>
          <Boton disabled>Deshabilitado</Boton>
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2>Avisos y etiquetas</h2>
        <div className={estilos.columna}>
          <Aviso>Información neutra.</Aviso>
          <Aviso tipo="alerta">Tu sesión venció. Vuelve a ingresar.</Aviso>
          <Aviso tipo="error">No se pudo conectar con el servidor.</Aviso>
          <div>
            <Pendiente>Pendiente cervecería</Pendiente>
          </div>
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2>Tarjetas</h2>
        <div className={estilos.tarjetas}>
          <Tarjeta titulo="13:00–15:00" acento="alto" extra={<InsigniaRiesgo nivel="alto" />}>
            Con acento de riesgo
          </Tarjeta>
          <Tarjeta titulo="Sin acento">Contenido</Tarjeta>
        </div>
      </section>
    </main>
  )
}
