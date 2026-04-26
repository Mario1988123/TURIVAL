import { obtenerVistaPlanificador } from '@/lib/services/planificador'
import PlanificadorMovilCliente from './planificador-movil-cliente'

export const dynamic = 'force-dynamic'

/**
 * /m/planificador — vista móvil simplificada del Gantt para Mario
 * sobre la marcha (rondando taller, móvil en mano).
 *
 * Muestra próximos 5 días laborables, agrupando tareas por día.
 * Click en una tarea abre detalle + opción de mover a otro día.
 */
export default async function PlanificadorMovilPage() {
  const desde = new Date(); desde.setHours(0, 0, 0, 0)
  const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 7)
  const vista = await obtenerVistaPlanificador({
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    incluir_sin_planificar: false,
  })
  return <PlanificadorMovilCliente vista={vista} />
}
