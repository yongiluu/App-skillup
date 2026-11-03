import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }, // el backend permite CORS solo desde el 5173
  test: {
    environment: 'jsdom',
    env: { VITE_USAR_MOCKS: 'true' }, // las pruebas no dependen del backend
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
