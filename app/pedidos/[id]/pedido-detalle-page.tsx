import { notFound } from 'next/navigation'
import { obtenerPedido } from '@/lib/services/pedidos'
import PedidoDetalleCliente from './pedido-detalle-cliente'

export const dynamic = 'force-dynamic'

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let pedido: any = null
  try {
    pedido = await obtenerPedido(id)
  } catch (e) {
    // Si no se encuentra, Supabase .single() lanza error → 404
    notFound()
  }

  if (!pedido) notFound()

  return <PedidoDetalleCliente pedidoInicial={pedido} />
}
