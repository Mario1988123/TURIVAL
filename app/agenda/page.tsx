import { accionObtenerVistaPlanificador } from '@/lib/actions/planificador'
import AgendaCliente from './agenda-cliente'

export const dynamic = 'force-dynamic'

/**
 * /agenda — vista calendario read-only de la planificación.
 *
 * Complementa al /planificador (que es donde se EDITA). Aquí se LEE:
 * una lista agrupada por día con las tareas planificadas y sus operarios.
 *
 * Reescrita desde cero el 2026-04-24 tras detectar que la versión anterior
 * referenciaba columnas inexistentes en `pedidos` (fecha_pedido,
 * fecha_entrega) y estados no válidos ('pendiente').
 *
 * Parámetros URL:
 *   ?desde=YYYY-MM-DD
 *   ?dias=N            (7 o 14 o 30)
 *   ?operario_id=...
 *   ?pedido_id=...
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string
    dias?: string
    operario_id?: string
    pedido_id?: string
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
  const dias = Math.max(1, Math.min(30, parseInt(params.dias ?? '7', 10) || 7))
  const hasta = new Date(desde.getTime() + dias * 86_400_000)

  const res = await accionObtenerVistaPlanificador({
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    operario_id: params.operario_id,
    pedido_id: params.pedido_id,
    incluir_sin_planificar: false,
  })

  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="font-medium">No se pudo cargar la agenda</div>
          <div className="mt-1 text-sm">{res.error}</div>
        </div>
      </div>
    )
  }

  return (
    <AgendaCliente
      vista={res.data}
      desde={desde.toISOString()}
      dias={dias}
    />
  )
}
