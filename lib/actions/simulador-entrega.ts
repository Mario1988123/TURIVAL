// lib/actions/simulador-entrega.ts
'use server'

import {
  simularEntregaPresupuesto,
  simularEntregaPedido,
  listarPresupuestosPendientes,
  listarPedidosFechaSinReservar,
  type ResultadoSimulacion,
  type PresupuestoPendiente,
  type PedidoConFechaSinReservar,
} from '@/lib/services/simulador-entrega'

export async function accionSimularEntrega(presupuesto_id: string): Promise<ResultadoSimulacion> {
  return simularEntregaPresupuesto(presupuesto_id)
}

export async function accionSimularEntregaPedido(pedido_id: string): Promise<ResultadoSimulacion> {
  return simularEntregaPedido(pedido_id)
}

export async function accionPresupuestosPendientes(): Promise<{
  ok: true; items: PresupuestoPendiente[]
} | { ok: false; error: string }> {
  try {
    const items = await listarPresupuestosPendientes()
    return { ok: true, items }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionPedidosFechaSinReservar(): Promise<{
  ok: true; items: PedidoConFechaSinReservar[]
} | { ok: false; error: string }> {
  try {
    const items = await listarPedidosFechaSinReservar()
    return { ok: true, items }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
