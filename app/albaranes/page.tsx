import { accionListarAlbaranes, accionPedidosElegibles } from '@/lib/actions/albaranes'
import AlbaranesCliente from './albaranes-cliente'

export const dynamic = 'force-dynamic'

/**
 * /albaranes — listado de albaranes (Capa 7).
 *
 * Reescrito desde cero el 2026-04-24 contra el schema real.
 * La versión anterior referenciaba columnas inexistentes.
 */
export default async function AlbaranesPage() {
  const [albaranesRes, pedidosRes] = await Promise.all([
    accionListarAlbaranes(),
    accionPedidosElegibles(),
  ])

  if (!albaranesRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudieron cargar los albaranes</div>
        <div className="mt-1 text-sm">{albaranesRes.error}</div>
      </div>
    )
  }

  return (
    <AlbaranesCliente
      albaranes={albaranesRes.albaranes}
      pedidosElegibles={pedidosRes.ok ? pedidosRes.pedidos : []}
    />
  )
}
