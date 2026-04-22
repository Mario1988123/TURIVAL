/**
 * lib/services/reservas.ts
 * ================================================================
 * Gestión de reservas de material. Creado en R6.
 *
 * IMPORTANTE: usa el CLIENTE SERVIDOR de Supabase (@/lib/supabase/server).
 * Se llama desde:
 *   - lib/services/pedidos.ts (al confirmar/cancelar)
 *   - lib/actions/reservas.ts (server action para el panel visual)
 *
 * Flujos:
 *   1. reservarMaterialesPedido(pedidoId)
 *      Al confirmar un pedido: calcula consumo teórico de
 *      lacado/fondo/cata/dis. Crea reservas_stock activas +
 *      movimientos_stock tipo 'reserva' + sube stock_reservado_kg
 *      de cada material.
 *
 *   2. liberarReservasPedido(pedidoId)
 *      Al cancelar: libera reservas activas, baja el reservado,
 *      registra movimientos 'liberacion_reserva'.
 *
 *   3. obtenerResumenReservasPedido(pedidoId)
 *      Devuelve detalles por material (kg, coste, stock físico,
 *      flag suficiente).
 *
 *   4. consumirRealYLiberarReserva (PENDIENTE R6b).
 * ================================================================
 */

import { createClient } from '@/lib/supabase/server'

// =================================================================
// TIPOS PÚBLICOS
// =================================================================

export interface ResumenReservaPorMaterial {
  material_id: string
  codigo: string | null
  nombre: string
  tipo: string
  cantidad_reservada_kg: number
  precio_kg: number
  coste_estimado_eur: number
  stock_fisico_kg: number
  suficiente: boolean
  reservas_count: number
}

export interface ResultadoReservas {
  reservas_creadas: number
  materiales_afectados: number
  total_kg_reservado: number
  detalles: ResumenReservaPorMaterial[]
}

// =================================================================
// HELPER: leer config ERP con server client
// =================================================================

async function leerConfigErp(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('configuracion_empresa')
    .select(`
      rendimiento_lacado_kg_m2,
      rendimiento_fondo_kg_m2,
      ratio_cata_lacado,
      ratio_dis_lacado,
      ratio_cata_fondo,
      ratio_dis_fondo,
      material_catalizador_default_id,
      material_disolvente_default_id
    `)
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('configuracion_empresa no encontrada (id=1)')

  return {
    rendimiento_lacado_kg_m2: Number((data as any).rendimiento_lacado_kg_m2 ?? 0.12),
    rendimiento_fondo_kg_m2:  Number((data as any).rendimiento_fondo_kg_m2  ?? 0.15),
    ratio_cata_lacado: Number((data as any).ratio_cata_lacado ?? 8),
    ratio_dis_lacado:  Number((data as any).ratio_dis_lacado  ?? 4),
    ratio_cata_fondo:  Number((data as any).ratio_cata_fondo  ?? 12),
    ratio_dis_fondo:   Number((data as any).ratio_dis_fondo   ?? 6),
    material_catalizador_default_id:
      (data as any).material_catalizador_default_id as string | null,
    material_disolvente_default_id:
      (data as any).material_disolvente_default_id as string | null,
  }
}

// =================================================================
// 1. RESERVAR MATERIALES DE UN PEDIDO (al confirmar)
// =================================================================

export async function reservarMaterialesPedido(
  pedidoId: string
): Promise<ResultadoReservas> {
  const supabase = await createClient()

  // Idempotencia: si ya hay reservas activas, no duplicar
  const { data: existentes } = await supabase
    .from('reservas_stock')
    .select('id')
    .eq('pedido_id', pedidoId)
    .eq('estado', 'activa')
    .limit(1)

  if (existentes && existentes.length > 0) {
    console.info(`[reservas] Pedido ${pedidoId} ya tiene reservas activas. Omito.`)
    return await obtenerResumenReservasPedido(pedidoId)
  }

  const cfg = await leerConfigErp(supabase)

  const { data: lineas, error: errL } = await supabase
    .from('lineas_pedido')
    .select(`
      id, cantidad, modo_precio, superficie_m2, longitud_ml,
      material_lacado_id, material_fondo_id
    `)
    .eq('pedido_id', pedidoId)
  if (errL) throw errL
  if (!lineas || lineas.length === 0) {
    return { reservas_creadas: 0, materiales_afectados: 0, total_kg_reservado: 0, detalles: [] }
  }

  // Materiales implicados
  const materialIds = new Set<string>()
  for (const l of lineas as any[]) {
    if (l.material_lacado_id) materialIds.add(l.material_lacado_id)
    if (l.material_fondo_id)  materialIds.add(l.material_fondo_id)
  }
  if (cfg.material_catalizador_default_id) materialIds.add(cfg.material_catalizador_default_id)
  if (cfg.material_disolvente_default_id)  materialIds.add(cfg.material_disolvente_default_id)

  if (materialIds.size === 0) {
    console.warn(`[reservas] Pedido ${pedidoId}: líneas sin materiales. Sin reservas.`)
    return { reservas_creadas: 0, materiales_afectados: 0, total_kg_reservado: 0, detalles: [] }
  }

  const { data: materiales, error: errM } = await supabase
    .from('materiales')
    .select(`
      id, codigo, nombre, tipo,
      precio_kg, precio_kg_sobrescrito,
      rendimiento_kg_m2_sobrescrito,
      stock_fisico_kg, stock_reservado_kg
    `)
    .in('id', Array.from(materialIds))
  if (errM) throw errM

  const mapMat = new Map<string, any>((materiales ?? []).map((m: any) => [m.id, m]))

  // Agregar consumo teórico por material
  const consumoPorMaterial = new Map<string, number>()
  const sumar = (mId: string, kg: number) => {
    if (kg <= 0) return
    consumoPorMaterial.set(mId, (consumoPorMaterial.get(mId) ?? 0) + kg)
  }

  for (const l of lineas as any[]) {
    const superficieTotal = Number(l.superficie_m2 ?? 0) * Number(l.cantidad ?? 1)
    if (superficieTotal <= 0) continue

    let consumoLacadoKg = 0
    if (l.material_lacado_id) {
      const m = mapMat.get(l.material_lacado_id)
      const rend = m?.rendimiento_kg_m2_sobrescrito != null
        ? Number(m.rendimiento_kg_m2_sobrescrito)
        : cfg.rendimiento_lacado_kg_m2
      consumoLacadoKg = superficieTotal * rend
      sumar(l.material_lacado_id, consumoLacadoKg)
    }

    let consumoFondoKg = 0
    if (l.material_fondo_id) {
      const m = mapMat.get(l.material_fondo_id)
      const rend = m?.rendimiento_kg_m2_sobrescrito != null
        ? Number(m.rendimiento_kg_m2_sobrescrito)
        : cfg.rendimiento_fondo_kg_m2
      consumoFondoKg = superficieTotal * rend
      sumar(l.material_fondo_id, consumoFondoKg)
    }

    const cataLacado = consumoLacadoKg / Math.max(1, cfg.ratio_cata_lacado)
    const disLacado  = consumoLacadoKg / Math.max(1, cfg.ratio_dis_lacado)
    const cataFondo  = consumoFondoKg  / Math.max(1, cfg.ratio_cata_fondo)
    const disFondo   = consumoFondoKg  / Math.max(1, cfg.ratio_dis_fondo)

    if (cfg.material_catalizador_default_id) {
      sumar(cfg.material_catalizador_default_id, cataLacado + cataFondo)
    }
    if (cfg.material_disolvente_default_id) {
      sumar(cfg.material_disolvente_default_id, disLacado + disFondo)
    }
  }

  // Crear reservas + movimientos
  const detalles: ResumenReservaPorMaterial[] = []
  let totalKg = 0

  for (const [materialId, kg] of consumoPorMaterial.entries()) {
    if (kg <= 0) continue
    const m = mapMat.get(materialId)
    if (!m) continue

    const kgRedondeado = Number(kg.toFixed(4))
    const stockFisicoAntes     = Number(m.stock_fisico_kg ?? 0)
    const stockReservadoAntes  = Number(m.stock_reservado_kg ?? 0)
    const stockReservadoDespues = stockReservadoAntes + kgRedondeado

    // UPDATE material
    const { error: errU } = await supabase
      .from('materiales')
      .update({
        stock_reservado_kg: stockReservadoDespues,
        updated_at: new Date().toISOString(),
      })
      .eq('id', materialId)
    if (errU) throw errU

    // INSERT reserva
    const { data: reserva, error: errR } = await supabase
      .from('reservas_stock')
      .insert({
        pedido_id: pedidoId,
        material_id: materialId,
        cantidad_reservada_kg: kgRedondeado,
        estado: 'activa',
        observaciones: 'Reserva automática al confirmar pedido',
      })
      .select()
      .single()
    if (errR) {
      // Rollback manual
      await supabase
        .from('materiales')
        .update({ stock_reservado_kg: stockReservadoAntes })
        .eq('id', materialId)
      throw errR
    }

    // INSERT movimiento auditable
    await supabase.from('movimientos_stock').insert({
      material_id: materialId,
      tipo: 'reserva',
      cantidad_kg: kgRedondeado,
      pedido_id: pedidoId,
      reserva_id: (reserva as any).id,
      stock_antes_kg: stockFisicoAntes,
      stock_despues_kg: stockFisicoAntes,  // físico no cambia
      motivo: 'Reserva automática — pedido',
    })

    const precioKg = m.precio_kg_sobrescrito != null
      ? Number(m.precio_kg_sobrescrito)
      : Number(m.precio_kg ?? 0)

    detalles.push({
      material_id: materialId,
      codigo: m.codigo ?? null,
      nombre: m.nombre,
      tipo: m.tipo,
      cantidad_reservada_kg: kgRedondeado,
      precio_kg: precioKg,
      coste_estimado_eur: Number((kgRedondeado * precioKg).toFixed(2)),
      stock_fisico_kg: stockFisicoAntes,
      suficiente: stockFisicoAntes >= stockReservadoDespues,
      reservas_count: 1,
    })
    totalKg += kgRedondeado
  }

  return {
    reservas_creadas: detalles.length,
    materiales_afectados: detalles.length,
    total_kg_reservado: Number(totalKg.toFixed(4)),
    detalles,
  }
}

// =================================================================
// 2. LIBERAR RESERVAS (al cancelar pedido)
// =================================================================

export async function liberarReservasPedido(pedidoId: string): Promise<{
  reservas_liberadas: number
  total_kg_liberado: number
}> {
  const supabase = await createClient()

  const { data: reservas, error: errR } = await supabase
    .from('reservas_stock')
    .select('id, material_id, cantidad_reservada_kg')
    .eq('pedido_id', pedidoId)
    .eq('estado', 'activa')
  if (errR) throw errR
  if (!reservas || reservas.length === 0) {
    return { reservas_liberadas: 0, total_kg_liberado: 0 }
  }

  let totalKg = 0

  for (const r of reservas as any[]) {
    const kg = Number(r.cantidad_reservada_kg)

    const { data: m, error: errM } = await supabase
      .from('materiales')
      .select('stock_fisico_kg, stock_reservado_kg')
      .eq('id', r.material_id)
      .single()
    if (errM || !m) continue

    const stockFisico      = Number(m.stock_fisico_kg ?? 0)
    const reservadoAntes   = Number(m.stock_reservado_kg ?? 0)
    const reservadoDespues = Math.max(0, reservadoAntes - kg)

    await supabase
      .from('materiales')
      .update({
        stock_reservado_kg: reservadoDespues,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.material_id)

    await supabase
      .from('reservas_stock')
      .update({
        estado: 'liberada',
        fecha_cierre: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)

    await supabase.from('movimientos_stock').insert({
      material_id: r.material_id,
      tipo: 'liberacion_reserva',
      cantidad_kg: -kg,
      pedido_id: pedidoId,
      reserva_id: r.id,
      stock_antes_kg: stockFisico,
      stock_despues_kg: stockFisico,
      motivo: 'Liberación — pedido cancelado',
    })

    totalKg += kg
  }

  return {
    reservas_liberadas: reservas.length,
    total_kg_liberado: Number(totalKg.toFixed(4)),
  }
}

// =================================================================
// 3. RESUMEN DE RESERVAS DE UN PEDIDO
// =================================================================

export async function obtenerResumenReservasPedido(
  pedidoId: string
): Promise<ResultadoReservas> {
  const supabase = await createClient()

  const { data: reservas, error } = await supabase
    .from('reservas_stock')
    .select('id, material_id, cantidad_reservada_kg, estado')
    .eq('pedido_id', pedidoId)
    .eq('estado', 'activa')
  if (error) throw error

  if (!reservas || reservas.length === 0) {
    return { reservas_creadas: 0, materiales_afectados: 0, total_kg_reservado: 0, detalles: [] }
  }

  const porMaterial = new Map<string, { kg: number; reservas: number }>()
  for (const r of reservas as any[]) {
    const prev = porMaterial.get(r.material_id)
    porMaterial.set(r.material_id, {
      kg: (prev?.kg ?? 0) + Number(r.cantidad_reservada_kg),
      reservas: (prev?.reservas ?? 0) + 1,
    })
  }

  const { data: mats } = await supabase
    .from('materiales')
    .select(`
      id, codigo, nombre, tipo,
      precio_kg, precio_kg_sobrescrito,
      stock_fisico_kg, stock_reservado_kg
    `)
    .in('id', Array.from(porMaterial.keys()))

  const detalles: ResumenReservaPorMaterial[] = (mats ?? []).map((m: any) => {
    const acc = porMaterial.get(m.id) ?? { kg: 0, reservas: 0 }
    const precioKg = m.precio_kg_sobrescrito != null
      ? Number(m.precio_kg_sobrescrito)
      : Number(m.precio_kg ?? 0)
    const stockFisico = Number(m.stock_fisico_kg ?? 0)
    return {
      material_id: m.id,
      codigo: m.codigo ?? null,
      nombre: m.nombre,
      tipo: m.tipo,
      cantidad_reservada_kg: Number(acc.kg.toFixed(4)),
      precio_kg: precioKg,
      coste_estimado_eur: Number((acc.kg * precioKg).toFixed(2)),
      stock_fisico_kg: stockFisico,
      suficiente: stockFisico >= acc.kg,
      reservas_count: acc.reservas,
    }
  })

  const totalKg = detalles.reduce((s, d) => s + d.cantidad_reservada_kg, 0)

  return {
    reservas_creadas: reservas.length,
    materiales_afectados: detalles.length,
    total_kg_reservado: Number(totalKg.toFixed(4)),
    detalles,
  }
}

// =================================================================
// 4. PENDIENTE — consumirRealYLiberarReserva (R6b)
// =================================================================

/**
 * PENDIENTE R6b.
 * Al completar una tarea de lacado/fondo:
 *   1. Consumir stock REAL (baja stock_fisico_kg)
 *   2. Liberar la parte reservada (baja stock_reservado_kg)
 *   3. Si consumo_real != reservado → merma (+/-)
 *   4. Marcar reserva como 'consumida'
 * Se cablea junto al modal de consumo real.
 */
export async function consumirRealYLiberarReserva(_args: {
  tarea_id: string
  consumos: Array<{ material_id: string; cantidad_real_kg: number }>
}): Promise<void> {
  throw new Error('consumirRealYLiberarReserva se cablea en R6b')
}
