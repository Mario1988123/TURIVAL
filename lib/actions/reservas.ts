// lib/actions/reservas.ts
'use server'

/**
 * Server Actions de RESERVAS — R6
 *
 * Wrapper fino sobre lib/services/reservas.ts para poder
 * invocarlo desde componentes 'use client'.
 */

import {
  obtenerResumenReservasPedido,
  reservarMaterialesPedido,
  liberarReservasPedido,
  type ResultadoReservas,
} from '@/lib/services/reservas'

/**
 * Obtener el resumen de reservas activas de un pedido.
 * Usado por el panel visual del detalle de pedido.
 */
export async function accionObtenerResumenReservas(
  pedidoId: string
): Promise<ResultadoReservas> {
  if (!pedidoId) throw new Error('pedidoId es obligatorio')
  return await obtenerResumenReservasPedido(pedidoId)
}

/**
 * Reservar materiales manualmente (útil si confirmarPedido falló
 * al reservar por error transitorio — el pedido queda confirmado
 * pero sin reservas, y Mario dispara la reserva desde el panel).
 */
export async function accionReservarMaterialesPedido(
  pedidoId: string
): Promise<ResultadoReservas> {
  if (!pedidoId) throw new Error('pedidoId es obligatorio')
  return await reservarMaterialesPedido(pedidoId)
}

/**
 * Liberar reservas manualmente (poco habitual; normalmente se
 * liberan solas al cancelar el pedido).
 */
export async function accionLiberarReservasPedido(pedidoId: string) {
  if (!pedidoId) throw new Error('pedidoId es obligatorio')
  return await liberarReservasPedido(pedidoId)
}
