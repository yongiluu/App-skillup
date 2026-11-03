import EncabezadoPagina from '../components/ui/EncabezadoPagina'
import Tarjeta from '../components/ui/Tarjeta'
import { Pendiente } from '../components/ui/Aviso'
import estilos from './Vistas.module.css'

/** Etapa 1: solo la estructura. La grilla 7 días × 4 servicios llega en la etapa 2 (GET /semana y /calendario). */
export default function Planificador() {
  return (
    <>
      <EncabezadoPagina titulo="Planificador semanal" bajada="Dotación y riesgo por servicio, día a día" />
      <div className={estilos.grilla}>
        <Tarjeta titulo="Grilla de la semana" extra={<Pendiente>Etapa 2</Pendiente>}>
          <p className={estilos.texto}>
            7 días × 4 servicios (11–13, 13–15, 19–21, 21–23) con dotación asignada / requerida y probabilidad de déficit.
          </p>
        </Tarjeta>
        <Tarjeta titulo="Calendario" extra={<Pendiente>Etapa 2</Pendiente>}>
          <p className={estilos.texto}>
            Días de pago, quincenas, feriados y eventos. Eventos reales: <Pendiente>Pendiente cervecería</Pendiente>
          </p>
        </Tarjeta>
      </div>
    </>
  )
}
