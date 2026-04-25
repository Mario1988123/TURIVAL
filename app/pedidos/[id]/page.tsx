import { notFound } from 'next/navigation'
import { obtenerPedido } from '@/lib/services/pedidos'
import PedidoDetalleCliente from './pedido-detalle-cliente'

export const dynamic = 'force-dynamic'

/**
 * /pedidos/[id] — DETALLE del pedido.
 *
 * Mantiene aquí el detalle (líneas, piezas, totales, costes, tiempos,
 * acciones de confirmación). Las etiquetas son un paso paralelo y
 * viven en /etiquetas/pedido/[id]; desde aquí se accede mediante el
 * botón "Imprimir etiquetas" de la cabecera.
 */
export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let pedido: any = null
  try {
    pedido = await obtenerPedido(id)
  } catch {
    notFound()
  }
  if (!pedido) notFound()

  return <PedidoDetalleCliente pedidoInicial={pedido} />
}
