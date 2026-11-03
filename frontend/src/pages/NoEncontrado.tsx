import { Link } from 'react-router-dom'
import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import estilos from './Vistas.module.css'

export default function NoEncontrado() {
  return (
    <main className={estilos.centrado}>
      <EncabezadoPagina titulo="Página no encontrada" bajada="La dirección no existe o cambió." />
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}
