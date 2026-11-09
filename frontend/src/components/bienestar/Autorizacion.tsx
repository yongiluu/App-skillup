import { useId, useState } from 'react'
import { cambiarConsentimiento } from '../../api'
import type { Consentimiento } from '../../api/tipos'
import Boton from '../ui/Boton'
import Aviso, { Pendiente } from '../ui/Aviso'
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
 * Qué pasa con los datos ya guardados está [PENDIENTE CERVECERÍA / revisión legal].
 */
export default function Autorizacion({ empleadoId, consentimiento, alCambiar }: Props) {
  const id = useId()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  async function cambiar(acepta: boolean) {
    setError(null)
    setEnviando(true)
    try {
      await cambiarConsentimiento(empleadoId, acepta)
      setConfirmando(false)
      setHecho(
        acepta
          ? 'Autorizaste de nuevo el uso de tus datos de bienestar.'
          : 'Retiraste tu autorización. Desde ahora nadie ve tu indicador de fatiga.',
      )
      alCambiar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar tu autorización.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className={estilos.autorizacion} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>Tu autorización</h3>
      {hecho && <Aviso>{hecho}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {consentimiento.otorgado && !confirmando && (
        <>
          <p className={estilos.nota}>Puedes retirarla cuando quieras, sin dar explicaciones.</p>
          <div>
            <Boton variante="secundario" onClick={() => setConfirmando(true)}>
              Retirar mi autorización
            </Boton>
          </div>
        </>
      )}

      {consentimiento.otorgado && confirmando && (
        <div className={estilos.confirmar} role="group" aria-labelledby={`${id}-pregunta`}>
          <p id={`${id}-pregunta`}>
            <b>¿Retirar tu autorización?</b>
          </p>
          <ul>
            <li>Tu jefe de turno dejará de ver tu indicador de fatiga.</li>
            <li>La app dejará de usar tus datos de bienestar. No te favorece ni te perjudica en las sugerencias de turnos.</li>
            <li>
              Nadie podrá ver los datos ya guardados. Si se borran o se conservan un tiempo está por definir:{' '}
              <Pendiente>Pendiente cervecería</Pendiente>
            </li>
          </ul>
          <div className={estilos.botones}>
            <Boton onClick={() => cambiar(false)} disabled={enviando}>
              {enviando ? 'Retirando…' : 'Sí, retirar'}
            </Boton>
            <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={enviando}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}

      {!consentimiento.otorgado && (
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
