import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { reiniciarSolicitudesMock } from '../api'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  reiniciarSolicitudesMock()
})
