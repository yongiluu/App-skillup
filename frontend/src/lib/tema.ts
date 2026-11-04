import { useState } from 'react'

/**
 * Modo claro / oscuro.
 * Por defecto sigue al sistema (prefers-color-scheme). Si la persona lo cambia con el botón,
 * se guarda solo en este navegador (localStorage) y se marca en <html data-tema="...">.
 * Los colores de cada modo están en styles/tokens.css.
 */
export type Tema = 'claro' | 'oscuro'

const CLAVE = 'skillup-tema'

function guardado(): Tema | null {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : null
  } catch {
    return null // modo privado o almacenamiento bloqueado: se sigue al sistema
  }
}

function delSistema(): Tema {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'oscuro'
    : 'claro'
}

/** Se llama antes de dibujar la app, para que no parpadee. */
export function aplicarTemaGuardado() {
  const t = guardado()
  if (t) document.documentElement.dataset.tema = t
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(() => guardado() ?? delSistema())

  const alternar = () => {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
    document.documentElement.dataset.tema = nuevo
    try {
      localStorage.setItem(CLAVE, nuevo)
    } catch {
      // Sin almacenamiento: el cambio dura hasta recargar
    }
    setTema(nuevo)
  }

  return { tema, alternar }
}
