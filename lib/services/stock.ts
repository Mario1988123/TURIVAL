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
 *
 * Opcional: si se pasa `precio_compra_kg`, recalcula el
 * `precio_kg_sobrescrito` del material como MEDIA PONDERADA entre el
 * stock existente (a su precio actual) y la nueva compra. Fórmula:
 *
 *   precio_nuevo = (stock_antes * precio_actual + kg_entrada * precio_compra)
 *                  / (stock_antes + kg_entrada)
 *
 *   Si stock_antes = 0 → precio_nuevo = precio_compra (no hay nada que ponderar).
 *
 * El motivo del movimiento se enriquece con ambos precios para dejar
 * auditoría legible en el histórico.
 */
export async function entradaManualStock(params: {
  material_id: string
  cantidad_kg: number
  motivo?: string
  operario_id?: string | null
  precio_compra_kg?: number | null
}): Promise<MovimientoStock> {
  if (params.cantidad_kg <= 0) {
    throw new Error('La cantidad de entrada debe ser positiva')
  }

  // Si hay precio de compra, recalcular precio medio ponderado
  let motivoFinal = params.motivo ?? 'Entrada manual'
  const precioCompra =
    params.precio_compra_kg != null && params.precio_compra_kg > 0
      ? Number(params.precio_compra_kg)
      : null

  if (precioCompra !== null) {
    const supabase = createClient()
    const { data: mat, error } = await supabase
      .from('materiales')
      .select('stock_fisico_kg, precio_kg_sobrescrito')
      .eq('id', params.material_id)
      .single()
    if (error || !mat) throw error ?? new Error('Material no encontrado')

    const stockAntes = Number(mat.stock_fisico_kg ?? 0)
    const precioActual = mat.precio_kg_sobrescrito != null
      ? Number(mat.precio_kg_sobrescrito)
      : null

    let precioNuevo: number
    if (stockAntes <= 0 || precioActual === null) {
      precioNuevo = precioCompra
    } else {
      precioNuevo =
        (stockAntes * precioActual + params.cantidad_kg * precioCompra) /
        (stockAntes + params.cantidad_kg)
    }
    precioNuevo = Number(precioNuevo.toFixed(4))

    const { error: errP } = await supabase
      .from('materiales')
      .update({
        precio_kg_sobrescrito: precioNuevo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.material_id)
    if (errP) throw errP

    const motivoBase = params.motivo?.trim() || 'Entrada manual'
    motivoFinal = `${motivoBase} — ${params.cantidad_kg.toFixed(3)} kg a ${precioCompra.toFixed(4)} €/kg. Precio medio actualizado: ${precioNuevo.toFixed(4)} €/kg.`
  }

  return aplicarMovimiento({
    material_id: params.material_id,
    cantidad_kg: params.cantidad_kg,
    motivo: motivoFinal,
    operario_id: params.operario_id,
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
