// lib/actions/informe-margen.ts
'use server'

import {
  listarMargenPedidos,
  obtenerDetalleMargenPedido,
  type ResumenMargenPedido,
  type DetalleMargenPedido,
} from '@/lib/services/informe-margen'

export async function accionListarMargenPedidos():
  Promise<{ ok: true; items: ResumenMargenPedido[] } | { ok: false; error: string }>
{
  try {
    const items = await listarMargenPedidos()
    return { ok: true, items }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionDetalleMargenPedido(pedido_id: string):
  Promise<{ ok: true; detalle: DetalleMargenPedido } | { ok: false; error: string }>
{
  try {
    const detalle = await obtenerDetalleMargenPedido(pedido_id)
    if (!detalle) return { ok: false, error: 'pedido no encontrado' }
    return { ok: true, detalle }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
