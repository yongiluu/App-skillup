/**
 * Íconos en SVG (trazo 1,75 en grilla de 24 px), sin librerías externas.
 * La mayoría vienen del kit de diseño SkillUp Luthier v14; usan currentColor.
 * Son decorativos (aria-hidden): el texto al lado es el que da el significado.
 */
const DIBUJOS = {
  hoy:
    '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  planificador:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  equipo:
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15.5 14.6c2.6.2 4.5 2.1 4.5 5"/>',
  solicitudes:
    '<path d="M3.5 13l3-8h11l3 8v6.5h-17z"/><path d="M3.5 13h5l1 2h5l1-2h5"/>',
  cambio:
    '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  ok:
    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  salir:
    '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  bienestar:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  alerta:
    '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  alto:
    '<path d="M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/>',
  info:
    '<path d="M12 11v5M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/>',
  lupulo:
    '<path d="M12 2v2.8M12 3.2c1.2-1.2 2.8-1.2 3.6-.4M12 4.8c-3.2.8-4.8 3.2-4.8 6.4 0 4 2.4 7.6 4.8 10 2.4-2.4 4.8-6 4.8-10 0-3.2-1.6-5.6-4.8-6.4zM7.6 10c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M7.6 14c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M12 4.8v16.4"/>',
  reloj:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  campana:
    '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  sueno:
    '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  dias:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/>',
  telefono:
    '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat:
    '<path d="M4 5h16v11H9l-5 4z"/>',
  persona:
    '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
  cocina:
    '<path d="M4.5 11h15v2.5a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6z"/><path d="M3 11h18M9.5 7.5c0-1.2 1-1.5 1-2.7M13.5 7.5c0-1.2 1-1.5 1-2.7"/>',
  salon:
    '<path d="M7 3.5v17M4.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M17 20.5V3.5c-2.2 0-3.5 2.4-3.5 5.5s1.3 4.5 3.5 4.5"/>',
  barra:
    '<path d="M5.5 6.5h9.5v12.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z"/><path d="M15 9.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M8.5 10v6.5M12 10v6.5M5.5 6.5c0-1.7 1.3-2.5 2.7-2.5.6-1 1.6-1.5 2.6-1.5 1.5 0 2.7.9 3 2.2 1 .2 1.2 1 1.2 1.8"/>',
  jarra:
    '<path d="M5.5 8.5h10v10.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M15.5 11h1.8a1.7 1.7 0 0 1 1.7 1.7v2.6a1.7 1.7 0 0 1-1.7 1.7h-1.8"/><path d="M5.5 8.5c-.8-2 .7-3.6 2.4-3.2.5-1.3 2.4-1.8 3.5-.6 1.3-.9 3.4-.2 3.6 1.5.9.3 1 1.5.5 2.3"/><path d="M9 12v5M12 12v5"/>',
  sol:
    '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  luna:
    '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  cerrar:
    '<path d="M6 6l12 12M18 6L6 18"/>',
  tarea:
    '<path d="M9 4.5h6M8 4.5H6.5v16h11v-16H16"/><path d="M9 12.5l2 2 4-4"/>',
  escudo:
    '<path d="M12 3.5l7 3v5.2c0 4.3-2.9 7.6-7 8.8-4.1-1.2-7-4.5-7-8.8V6.5z"/><path d="M9 12l2 2 4-4"/>',
  grafico:
    '<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>',
  casa:
    '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
} as const

export type NombreIcono = keyof typeof DIBUJOS

export default function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      // Contenido fijo de este archivo (no viene del usuario ni de la API)
      dangerouslySetInnerHTML={{ __html: DIBUJOS[nombre] }}
    />
  )
}
