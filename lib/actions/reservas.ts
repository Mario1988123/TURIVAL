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

// =============================================================
// Ajustar cantidad de una reserva manualmente (Mario punto 16)
// NO toca stock físico, solo el campo `kg_reservados` de la reserva.
// =============================================================
export async function accionAjustarReservaKg(input: {
  reserva_id: string
  kg_nuevos: number
}) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!isFinite(input.kg_nuevos) || input.kg_nuevos < 0) {
      return { ok: false as const, error: 'Cantidad inválida' }
    }
    const { error } = await supabase
      .from('reservas_stock')
      .update({
        cantidad_reservada_kg: input.kg_nuevos,
        observaciones: 'Ajustada manualmente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.reserva_id)
    if (error) throw error
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? 'Error ajustando reserva' }
  }
}
