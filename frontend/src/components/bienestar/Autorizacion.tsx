import { useEffect, useId, useRef, useState } from 'react'
import { cambiarConsentimiento } from '../../api'
import type { Consentimiento } from '../../api/tipos'
import Boton from '../ui/Boton'
import Aviso from '../ui/Aviso'
import estilos from './Bienestar.module.css'

interface Props {
  empleadoId: string
  consentimiento: Consentimiento
  /** Se llama después de cambiar la autorización, para volver a cargar el bienestar. */
  alCambiar: () => void
}

/**
 * Control de la propia persona sobre su autorización de bienestar (evaluación AP-04).
 * Retirarla pide una confirmación en la misma pantalla (sin ventanas emergentes).
 * Volver a autorizar también es posible: la decisión es reversible y de la persona.
 * Qué pasa con los datos ya guardados está [PENDIENTE CERVECERÍA / revisión legal]; al trabajador
 * se le dice en palabras simples, sin etiquetas internas (AP-16).
 * Textos y foco según la revisión de Cata (AP-16 a AP-19, docs/ux/evaluacion-heuristica-app.md).
 */

/** AP-19: el error siempre es este texto fijo, nunca el mensaje técnico de la API. */
export const ERROR_AUTORIZACION = 'No se pudo cambiar tu autorización. Inténtalo de nuevo.'

export default function Autorizacion({ empleadoId, consentimiento, alCambiar }: Props) {
  const id = useId()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  // Lo que respondió la API al cambiarla: se muestra al tiro, sin esperar a que se recargue
  // el bienestar (antes aparecía un momento el botón anterior).
  const [cambiada, setCambiada] = useState<boolean | null>(null)
  const otorgado = cambiada ?? consentimiento.otorgado
  const pregunta = useRef<HTMLParagraphElement>(null)
  const botonRetirar = useRef<HTMLButtonElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  // A dónde mover el foco después del próximo render, para que no se pierda cuando
  // desaparece el botón que se tocó (AP-19).
  const foco = useRef<'pregunta' | 'retirar' | 'titulo' | null>(null)
  function setFoco(destino: 'pregunta' | 'retirar' | 'titulo') {
    foco.current = destino
  }

  useEffect(() => {
    if (!foco.current) return
    const destino = { pregunta, retirar: botonRetirar, titulo }[foco.current]
    foco.current = null
    destino.current?.focus()
  })

  function abrirConfirmacion() {
    setHecho(null)
    setError(null)
    setConfirmando(true)
    setFoco('pregunta')
  }

  function mantener() {
    setConfirmando(false)
    setFoco('retirar')
  }

  async function cambiar(acepta: boolean) {
    setError(null)
    setEnviando(true)
    try {
      const nuevo = await cambiarConsentimiento(empleadoId, acepta)
      setCambiada(nuevo.otorgado)
      setConfirmando(false)
      setHecho(
        acepta
          ? 'Autorizaste de nuevo el uso de tus datos de bienestar.'
          : 'Retiraste tu autorización. Desde ahora nadie ve tu indicador de fatiga.',
      )
      setFoco('titulo')
      alCambiar()
    } catch {
      setError(ERROR_AUTORIZACION)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className={estilos.autorizacion} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1}>
        Tu autorización
      </h3>
      {hecho && <Aviso>{hecho}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {otorgado && !confirmando && (
        <>
          <p className={estilos.nota}>Puedes retirarla cuando quieras, sin dar explicaciones.</p>
          <div>
            <Boton variante="secundario" onClick={abrirConfirmacion} ref={botonRetirar}>
              Retirar mi autorización
            </Boton>
          </div>
        </>
      )}

      {otorgado && confirmando && (
        <div className={estilos.confirmar} role="group" aria-labelledby={`${id}-pregunta`}>
          <p id={`${id}-pregunta`} ref={pregunta} tabIndex={-1}>
            <b>¿Retirar tu autorización?</b>
          </p>
          <ul>
            <li>Tu jefe de turno dejará de ver tu indicador de fatiga.</li>
            <li>La app dejará de usar tus datos de bienestar, también al sugerir reemplazos.</li>
            <li>
              La app no mostrará los datos que ya se guardaron. Todavía no está definido si esos datos se borran o se
              conservan por un tiempo.
            </li>
          </ul>
          {/* AP-17: las dos opciones con el mismo peso visual y diciendo qué hacen. */}
          <div className={estilos.botones}>
            <Boton variante="secundario" onClick={() => cambiar(false)} disabled={enviando}>
              {enviando ? 'Retirando…' : 'Sí, retirar mi autorización'}
            </Boton>
            <Boton variante="secundario" onClick={mantener} disabled={enviando}>
              Mantener mi autorización
            </Boton>
          </div>
        </div>
      )}

      {!otorgado && (
        <>
          <p className={estilos.nota}>
            Si autorizas, tu jefe de turno verá solo tu nivel de fatiga y el motivo general; el detalle lo ves solo tú.
            Puedes retirarla cuando quieras. El texto del consentimiento todavía es un borrador.
          </p>
          <div>
            <Boton variante="secundario" onClick={() => cambiar(true)} disabled={enviando}>
              {enviando ? 'Guardando…' : 'Autorizar el uso de mis datos'}
            </Boton>
          </div>
        </>
      )}
    </section>
  )
}
