/**
 * lib/services/stock.ts
 * ================================================================
 * Servicio de movimientos y reservas de stock. Creado en R2a.
 *
 * OPERACIONES DISPONIBLES EN R2a:
 *   - entradaManualStock(): +stock, registra 'entrada'.
 *   - ajusteManualStock():  +/-stock, registra 'ajuste'.
 *   - registrarMerma():     -stock, registra 'merma'.
 *   - listarMovimientos():  histórico filtrable.
 *   - obtenerStockActual(): snapshot (fisico, reservado, disponible).
 *
 * OPERACIONES DIFERIDAS A R6 (integración con pedidos/producción):
 *   - reservarMaterialesPedido()
 *   - liberarReservasPedido()
 *   - consumirMaterialesTarea()
 *
 * NOTA: no hay transacciones cross-tabla en Supabase REST. El flujo
 * es siempre: SELECT actual → UPDATE → INSERT movimiento. Si un INSERT
 * falla, el UPDATE ya se hizo y el invariante se rompe. Es aceptable
 * porque el UPDATE de stock es la verdad y el movimiento es auditoría;
 * si falla el INSERT se loguea error pero se mantiene el cambio.
 * ================================================================
 */

import { createClient } from './client'
import type {
  Material,
  MovimientoStock,
  TipoMovimientoStock,
} from '../types/erp'

interface StockSnapshot {
  stock_fisico_kg: number
  stock_reservado_kg: number
  stock_disponible_kg: number
  stock_minimo_kg: number
  bajo_minimo: boolean
}

// =================================================================
// LECTURA
// =================================================================

export async function obtenerStockActual(
  material_id: string
): Promise<StockSnapshot> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('materiales')
    .select('stock_fisico_kg, stock_reservado_kg, stock_minimo_kg')
    .eq('id', material_id)
    .single()
  if (error) throw error
  const fisico     = Number(data.stock_fisico_kg ?? 0)
  const reservado  = Number(data.stock_reservado_kg ?? 0)
  const minimo     = Number(data.stock_minimo_kg ?? 0)
  const disponible = fisico - reservado
  return {
    stock_fisico_kg:     fisico,
    stock_reservado_kg:  reservado,
    stock_minimo_kg:     minimo,
    stock_disponible_kg: disponible,
    bajo_minimo:         minimo > 0 && fisico < minimo,
  }
}

export async function listarMovimientos(filtros: {
  material_id?: string
  pedido_id?: string
  pieza_id?: string
  tipo?: TipoMovimientoStock
  desde?: string   // ISO date
  hasta?: string   // ISO date
  limite?: number  // default 100
} = {}): Promise<MovimientoStock[]> {
  const supabase = createClient()
  let query = supabase
    .from('movimientos_stock')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(filtros.limite ?? 100)

  if (filtros.material_id) query = query.eq('material_id', filtros.material_id)
  if (filtros.pedido_id)   query = query.eq('pedido_id',   filtros.pedido_id)
  if (filtros.pieza_id)    query = query.eq('pieza_id',    filtros.pieza_id)
  if (filtros.tipo)        query = query.eq('tipo',        filtros.tipo)
  if (filtros.desde)       query = query.gte('fecha',      filtros.desde)
  if (filtros.hasta)       query = query.lte('fecha',      filtros.hasta)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as MovimientoStock[]
}

// =================================================================
// ESCRITURA — MOVIMIENTOS MANUALES (R2a)
// =================================================================

/**
 * Entrada manual de stock (compra recibida). Suma kg al stock_fisico.
 */
export async function entradaManualStock(params: {
  material_id: string
  cantidad_kg: number
  motivo?: string
  operario_id?: string | null
}): Promise<MovimientoStock> {
  if (params.cantidad_kg <= 0) {
    throw new Error('La cantidad de entrada debe ser positiva')
  }
  return aplicarMovimiento({
    ...params,
    tipo: 'entrada',
    delta_fisico_kg: +Math.abs(params.cantidad_kg),
    delta_reservado_kg: 0,
  })
}

/**
 * Ajuste manual (inventario, corrección). Acepta delta positivo o
 * negativo. El "cantidad_kg" aquí es el DELTA, no un valor absoluto.
 */
export async function ajusteManualStock(params: {
  material_id: string
  delta_kg: number         // puede ser negativo
  motivo: string           // obligatorio para auditoría
  operario_id?: string | null
}): Promise<MovimientoStock> {
  if (!params.motivo || !params.motivo.trim()) {
    throw new Error('El motivo es obligatorio para ajustes manuales')
  }
  return aplicarMovimiento({
    material_id: params.material_id,
    cantidad_kg: params.delta_kg,
    tipo: 'ajuste',
    delta_fisico_kg: params.delta_kg,
    delta_reservado_kg: 0,
    motivo: params.motivo,
    operario_id: params.operario_id,
  })
}

/**
 * Registra una merma: kg que se descartan sin producción. Resta stock.
 */
export async function registrarMerma(params: {
  material_id: string
  cantidad_kg: number
  motivo: string
  operario_id?: string | null
}): Promise<MovimientoStock> {
  if (params.cantidad_kg <= 0) {
    throw new Error('La merma debe ser positiva (kg desechados)')
  }
  if (!params.motivo || !params.motivo.trim()) {
    throw new Error('El motivo es obligatorio para registrar una merma')
  }
  return aplicarMovimiento({
    material_id: params.material_id,
    cantidad_kg: -Math.abs(params.cantidad_kg),
    tipo: 'merma',
    delta_fisico_kg: -Math.abs(params.cantidad_kg),
    delta_reservado_kg: 0,
    motivo: params.motivo,
    operario_id: params.operario_id,
  })
}

// =================================================================
// INTERNA — APLICAR MOVIMIENTO (núcleo transaccional sin BD tx)
// =================================================================

interface AplicarMovimientoArgs {
  material_id: string
  tipo: TipoMovimientoStock
  cantidad_kg: number       // puede ser signed
  delta_fisico_kg: number
  delta_reservado_kg: number
  motivo?: string | null
  operario_id?: string | null
  pedido_id?: string | null
  pieza_id?: string | null
  tarea_produccion_id?: string | null
  reserva_id?: string | null
}

async function aplicarMovimiento(
  args: AplicarMovimientoArgs
): Promise<MovimientoStock> {
  const supabase = createClient()

  // 1) SELECT stock actual
  const { data: matBefore, error: err1 } = await supabase
    .from('materiales')
    .select('stock_fisico_kg, stock_reservado_kg')
    .eq('id', args.material_id)
    .single()
  if (err1 || !matBefore) throw err1 ?? new Error('Material no encontrado')

  const stock_antes  = Number(matBefore.stock_fisico_kg ?? 0)
  const reserva_antes = Number(matBefore.stock_reservado_kg ?? 0)
  const stock_despues  = stock_antes  + Number(args.delta_fisico_kg)
  const reserva_despues = reserva_antes + Number(args.delta_reservado_kg)

  // Validación de no-negativos
  if (stock_despues < 0) {
    throw new Error(
      `Stock insuficiente. Actual: ${stock_antes.toFixed(3)} kg, ` +
      `solicitado: ${Math.abs(args.delta_fisico_kg).toFixed(3)} kg`
    )
  }
  if (reserva_despues < 0) {
    throw new Error(
      `Reserva negativa detectada. Reserva actual: ${reserva_antes}, ` +
      `delta: ${args.delta_reservado_kg}`
    )
  }

  // 2) UPDATE stock
  const { error: err2 } = await supabase
    .from('materiales')
    .update({
      stock_fisico_kg:    stock_despues,
      stock_reservado_kg: reserva_despues,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', args.material_id)
  if (err2) throw err2

  // 3) INSERT movimiento (auditoría)
  const { data: mov, error: err3 } = await supabase
    .from('movimientos_stock')
    .insert({
      material_id:         args.material_id,
      tipo:                args.tipo,
      cantidad_kg:         args.cantidad_kg,
      pedido_id:           args.pedido_id ?? null,
      pieza_id:            args.pieza_id ?? null,
      tarea_produccion_id: args.tarea_produccion_id ?? null,
      reserva_id:          args.reserva_id ?? null,
      operario_id:         args.operario_id ?? null,
      stock_antes_kg:      stock_antes,
      stock_despues_kg:    stock_despues,
      motivo:              args.motivo ?? null,
    })
    .select()
    .single()

  if (err3) {
    // El UPDATE ya se hizo; loguear pero no revertir
    console.error('[stock] UPDATE OK pero INSERT movimiento falló:', err3)
    throw err3
  }

  return mov as MovimientoStock
}
