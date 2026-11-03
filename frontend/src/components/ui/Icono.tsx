/**
 * Íconos propios en SVG (trazos de 24×24), sin librerías externas.
 * Son decorativos (aria-hidden): el texto al lado es el que da el significado.
 */
const TRAZOS = {
  hoy: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  planificador: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h2M14 13h2M8 17h2M14 17h2',
  equipo: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8',
  salir: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  ok: 'M20 6 9 17l-5-5',
  /* Bandeja (solicitudes) */
  solicitudes: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
  /* Corazón (bienestar) */
  bienestar: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  /* Flechas de intercambio (pedir cambio) */
  cambio: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  alto: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  info: 'M12 11v5M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  /* Lúpulo (mismo dibujo del patrón de la demo Luthier) */
  lupulo:
    'M12 2v2.8M12 3.2c1.2-1.2 2.8-1.2 3.6-.4M12 4.8c-3.2.8-4.8 3.2-4.8 6.4 0 4 2.4 7.6 4.8 10 2.4-2.4 4.8-6 4.8-10 0-3.2-1.6-5.6-4.8-6.4zM7.6 10c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M7.6 14c1.6 1.2 2.8 1.6 4.4 1.6s2.8-.4 4.4-1.6M12 4.8v16.4',
} as const

export type NombreIcono = keyof typeof TRAZOS

export default function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}
