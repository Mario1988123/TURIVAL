import { accionObtenerVistaPlanificador } from '@/lib/actions/planificador'
import { accionPresupuestosPendientes } from '@/lib/actions/simulador-entrega'
import PlanificadorCliente from './planificador-cliente'

export const dynamic = 'force-dynamic'

/**
 * Ruta /planificador — Gantt de planificación (G3 read-only).
 *
 * Server component: carga la vista del planificador y la pasa al
 * client component que hace la pintura con CSS grid.
 *
 * Parámetros de URL soportados:
 *   ?desde=YYYY-MM-DD   — primer día visible (default hoy)
 *   ?dias=N             — cuántos días mostrar (default 14)
 *   ?modo=operario|proceso|pedido  — carril del Gantt (default operario)
 *   ?prioridad=urgente|alta|normal|baja
 *   ?pedido_id=...
 *   ?operario_id=...
 */
export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string
    dias?: string
    modo?: string
    prioridad?: string
    pedido_id?: string
    operario_id?: string
  }>
}) {
  const params = await searchParams

  const desde = params.desde
    ? new Date(`${params.desde}T00:00:00`)
    : (() => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d
    })()
  const dias = Math.max(1, Math.min(60, parseInt(params.dias ?? '14', 10) || 14))
  const hasta = new Date(desde.getTime() + dias * 86_400_000)

  const modo = (params.modo === 'proceso' || params.modo === 'pedido') ? params.modo : 'operario'

  const [res, pendRes] = await Promise.all([
    accionObtenerVistaPlanificador({
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      operario_id: params.operario_id,
      pedido_id: params.pedido_id,
      prioridad: (params.prioridad as any) || undefined,
      incluir_sin_planificar: true,
    }),
    accionPresupuestosPendientes(),
  ])

  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="font-medium">No se pudo cargar el planificador</div>
          <div className="mt-1 text-sm">{res.error}</div>
        </div>
      </div>
    )
  }

  return (
    <PlanificadorCliente
      vista={res.data}
      desde={desde.toISOString()}
      dias={dias}
      modo={modo as 'operario' | 'proceso' | 'pedido'}
      filtros={{
        operario_id: params.operario_id,
        pedido_id: params.pedido_id,
        prioridad: params.prioridad,
      }}
      presupuestosPendientes={pendRes.ok ? pendRes.items : []}
    />
  )
}
