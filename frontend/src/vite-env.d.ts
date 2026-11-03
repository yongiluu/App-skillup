/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de la API de backend, sin "/" al final. Ej.: http://localhost:8000 */
  readonly VITE_API_URL?: string
  /** "false" para llamar a la API; cualquier otro valor usa los datos simulados */
  readonly VITE_USAR_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
