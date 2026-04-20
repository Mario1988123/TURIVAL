import { listarPedidos } from '@/lib/services/pedidos'
import { PedidosListaCliente } from './pedidos-lista-cliente'

// Force dynamic rendering: el listado de pedidos debe estar siempre fresco
// (no cacheado) para reflejar nuevos pedidos recién creados.
export const dynamic = 'force-dynamic'

export default async function PedidosPage() {
  let pedidos: any[] = []
  let errorMsg: string | null = null

  try {
    pedidos = await listarPedidos()
  } catch (e: any) {
    errorMsg = e?.message ?? 'Error cargando pedidos'
  }

  if (errorMsg) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudieron cargar los pedidos</div>
        <div className="mt-1 text-sm">{errorMsg}</div>
      </div>
    )
  }

  return <PedidosListaCliente pedidos={pedidos as any} />
}
