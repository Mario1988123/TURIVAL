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
      precio_kg_sobrescrito,
      rendimiento_kg_m2_sobrescrito,
      stock_fisico_kg, stock_reservado_kg,
      proveedor:proveedores(precio_base_kg)
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
      : Number(m.proveedor?.precio_base_kg ?? 0)

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
      precio_kg_sobrescrito,
      stock_fisico_kg, stock_reservado_kg,
      proveedor:proveedores(precio_base_kg)
    `)
    .in('id', Array.from(porMaterial.keys()))

  const detalles: ResumenReservaPorMaterial[] = (mats ?? []).map((m: any) => {
    const acc = porMaterial.get(m.id) ?? { kg: 0, reservas: 0 }
    const precioKg = m.precio_kg_sobrescrito != null
      ? Number(m.precio_kg_sobrescrito)
      : Number(m.proveedor?.precio_base_kg ?? 0)
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
 * Al completar una tarea de LACADO/FONDO/FONDEADO_2:
 *   1. Calcula el consumo TEÓRICO proporcional a la superficie de la pieza
 *      sobre el total del pedido, para cada material implicado:
 *      lacado (o fondo), catalizador default y disolvente default.
 *   2. Aplica merma (total de la mezcla) al estado 'sobro' o 'falto':
 *      - exacto → consumo_real = teórico
 *      - sobro  → consumo_real = teórico − merma (reparto proporcional 3 materiales)
 *      - falto  → consumo_real = teórico + merma (reparto proporcional 3 materiales)
 *   3. UPDATE materiales.stock_fisico_kg (-consumo_real)
 *      UPDATE materiales.stock_reservado_kg (-consumo_teórico)  [libera reservado]
 *   4. INSERT movimientos_stock tipo='consumo' por cada material con la cantidad real.
 *   5. UPDATE reservas_stock parciales → 'consumida' cuando ya consumido todo.
 *      Si queda saldo tras esta tarea, la reserva sigue 'activa'.
 *   6. Si merma_pct > umbral_alerta_merma_pct → INSERT ajustes_rendimiento_pendientes.
 *
 * Devuelve el resumen de consumos aplicados y el registro de ajuste (si se generó).
 */

export interface ResumenConsumoPorMaterial {
  material_id: string
  codigo: string | null
  nombre: string
  tipo: string
  kg_teoricos: number
  kg_merma_asignados: number   // positivo si sobró, negativo si faltó
  kg_consumidos_real: number
  precio_kg: number
  coste_eur: number
}

export interface ResultadoConsumo {
  consumos: ResumenConsumoPorMaterial[]
  total_kg_teoricos: number
  total_kg_consumidos_real: number
  kg_merma_total: number        // + sobró, - faltó, 0 exacto
  merma_porcentaje: number      // abs, sobre kg_teoricos
  ajuste_rendimiento_generado: boolean
  ajuste_rendimiento_id: string | null
}

export async function consumirRealYLiberarReserva(args: {
  tarea_id: string
  tipo: 'lacado' | 'fondo'       // fondo cubre FONDO y FONDEADO_2
  estado_mezcla: 'exacto' | 'sobro' | 'falto'
  kg_merma_total?: number        // obligatorio si estado_mezcla != 'exacto'
}): Promise<ResultadoConsumo> {
  const supabase = await createClient()

  // 1) Cargar tarea + pieza + linea_pedido + pedido
  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select(`
      id, pieza_id, proceso_id, superficie_m2_aplicada,
      pieza:piezas(
        id, superficie_m2, linea_pedido_id,
        linea_pedido:lineas_pedido(
          id, pedido_id, material_lacado_id, material_fondo_id,
          pedido:pedidos(id, estado)
        )
      )
    `)
    .eq('id', args.tarea_id)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')

  const t: any = tarea
  const pieza = Array.isArray(t.pieza) ? t.pieza[0] : t.pieza
  if (!pieza) throw new Error('Pieza no encontrada para esta tarea')
  const linea = Array.isArray(pieza.linea_pedido) ? pieza.linea_pedido[0] : pieza.linea_pedido
  if (!linea) throw new Error('Línea de pedido no encontrada')
  const pedido = Array.isArray(linea.pedido) ? linea.pedido[0] : linea.pedido
  if (!pedido) throw new Error('Pedido no encontrado')

  const materialPrincipalId: string | null =
    args.tipo === 'lacado' ? linea.material_lacado_id : linea.material_fondo_id
  if (!materialPrincipalId) {
    throw new Error(
      `La línea de pedido no tiene material_${args.tipo === 'lacado' ? 'lacado' : 'fondo'}_id. ` +
      'No se puede calcular consumo.'
    )
  }

  // 2) Config ERP (ratios, umbral, rendimientos)
  const { data: cfgRow, error: errC } = await supabase
    .from('configuracion_empresa')
    .select(`
      rendimiento_lacado_kg_m2, rendimiento_fondo_kg_m2,
      ratio_cata_lacado, ratio_dis_lacado,
      ratio_cata_fondo, ratio_dis_fondo,
      material_catalizador_default_id, material_disolvente_default_id,
      umbral_alerta_merma_pct
    `)
    .eq('id', 1)
    .maybeSingle()
  if (errC) throw errC
  if (!cfgRow) throw new Error('configuracion_empresa (id=1) no encontrada')
  const cfg = cfgRow as any
  const rendimiento = args.tipo === 'lacado'
    ? Number(cfg.rendimiento_lacado_kg_m2 ?? 0.12)
    : Number(cfg.rendimiento_fondo_kg_m2 ?? 0.15)
  const ratioCata = args.tipo === 'lacado'
    ? Number(cfg.ratio_cata_lacado ?? 8)
    : Number(cfg.ratio_cata_fondo ?? 12)
  const ratioDis = args.tipo === 'lacado'
    ? Number(cfg.ratio_dis_lacado ?? 4)
    : Number(cfg.ratio_dis_fondo ?? 6)
  const umbralPct = Number(cfg.umbral_alerta_merma_pct ?? 15)
  const cataDefaultId: string | null = cfg.material_catalizador_default_id
  const disDefaultId: string | null  = cfg.material_disolvente_default_id

  // 3) Superficie de ESTA tarea (usar aplicada si existe, si no la de la pieza)
  const superficieTarea = Number(
    t.superficie_m2_aplicada ?? pieza.superficie_m2 ?? 0
  )
  if (superficieTarea <= 0) {
    throw new Error('Superficie de la tarea es 0. No se puede calcular consumo.')
  }

  // 4) Cálculo teórico
  const kgTeoricoPrincipal = Number((superficieTarea * rendimiento).toFixed(4))
  const kgTeoricoCata = Number((kgTeoricoPrincipal / Math.max(1, ratioCata)).toFixed(4))
  const kgTeoricoDis  = Number((kgTeoricoPrincipal / Math.max(1, ratioDis)).toFixed(4))
  const totalTeorico  = kgTeoricoPrincipal + kgTeoricoCata + kgTeoricoDis

  // 5) Merma con signo (+ sobró → consumo_real menor, - faltó → consumo mayor)
  //    Usamos signo consistente: merma positiva = sobró = consumimos MENOS.
  let mermaTotal = 0
  if (args.estado_mezcla === 'sobro') {
    mermaTotal = Math.abs(args.kg_merma_total ?? 0)
    // Mario punto 24: si la merma "sobrada" es mayor que el total
    // teorico fabricado, es imposible. Bloqueamos.
    if (mermaTotal > totalTeorico) {
      throw new Error(
        `Imposible: has sobrado ${mermaTotal.toFixed(2)} kg pero el total de mezcla teorico era ` +
        `${totalTeorico.toFixed(2)} kg. Revisa el dato.`,
      )
    }
  } else if (args.estado_mezcla === 'falto') {
    mermaTotal = -Math.abs(args.kg_merma_total ?? 0)
  }

  // Reparto proporcional de la merma entre los 3 materiales
  const pesoPrincipal = kgTeoricoPrincipal / Math.max(0.0001, totalTeorico)
  const pesoCata      = kgTeoricoCata     / Math.max(0.0001, totalTeorico)
  const pesoDis       = kgTeoricoDis      / Math.max(0.0001, totalTeorico)

  const mermaPrincipal = Number((mermaTotal * pesoPrincipal).toFixed(4))
  const mermaCata      = Number((mermaTotal * pesoCata).toFixed(4))
  const mermaDis       = Number((mermaTotal * pesoDis).toFixed(4))

  // Consumo real = teórico − merma_asignada (si sobró, consume menos; si faltó, consume más)
  const consumoRealPrincipal = Math.max(0, Number((kgTeoricoPrincipal - mermaPrincipal).toFixed(4)))
  const consumoRealCata      = Math.max(0, Number((kgTeoricoCata      - mermaCata).toFixed(4)))
  const consumoRealDis       = Math.max(0, Number((kgTeoricoDis       - mermaDis).toFixed(4)))

  // 6) Aplicar a los 3 materiales (o 1 ó 2 si falta alguno)
  const items: Array<{
    material_id: string
    kg_teoricos: number
    kg_merma_asignados: number
    kg_consumidos_real: number
  }> = [{
    material_id: materialPrincipalId,
    kg_teoricos: kgTeoricoPrincipal,
    kg_merma_asignados: mermaPrincipal,
    kg_consumidos_real: consumoRealPrincipal,
  }]
  if (cataDefaultId && kgTeoricoCata > 0) {
    items.push({
      material_id: cataDefaultId,
      kg_teoricos: kgTeoricoCata,
      kg_merma_asignados: mermaCata,
      kg_consumidos_real: consumoRealCata,
    })
  }
  if (disDefaultId && kgTeoricoDis > 0) {
    items.push({
      material_id: disDefaultId,
      kg_teoricos: kgTeoricoDis,
      kg_merma_asignados: mermaDis,
      kg_consumidos_real: consumoRealDis,
    })
  }

  const consumos: ResumenConsumoPorMaterial[] = []

  for (const it of items) {
    // Leer material actual
    const { data: mat, error: errM } = await supabase
      .from('materiales')
      .select('id, codigo, nombre, tipo, precio_kg_sobrescrito, stock_fisico_kg, stock_reservado_kg')
      .eq('id', it.material_id)
      .single()
    if (errM || !mat) continue
    const m = mat as any

    const stockFisicoAntes    = Number(m.stock_fisico_kg ?? 0)
    const stockReservadoAntes = Number(m.stock_reservado_kg ?? 0)

    // UPDATE stock: se consume real, se libera teórico
    const stockFisicoDespues = Number((stockFisicoAntes - it.kg_consumidos_real).toFixed(4))
    const stockReservadoDespues = Number(
      Math.max(0, stockReservadoAntes - it.kg_teoricos).toFixed(4)
    )
    const { error: errU } = await supabase
      .from('materiales')
      .update({
        stock_fisico_kg: stockFisicoDespues,
        stock_reservado_kg: stockReservadoDespues,
        updated_at: new Date().toISOString(),
      })
      .eq('id', it.material_id)
    if (errU) throw errU

    // INSERT movimiento consumo
    await supabase.from('movimientos_stock').insert({
      material_id: it.material_id,
      tipo: 'consumo',
      cantidad_kg: -it.kg_consumidos_real,
      pedido_id: pedido.id,
      pieza_id: pieza.id,
      tarea_produccion_id: args.tarea_id,
      stock_antes_kg: stockFisicoAntes,
      stock_despues_kg: stockFisicoDespues,
      motivo: `Consumo real tarea ${args.tipo} — teórico ${it.kg_teoricos.toFixed(4)} kg, merma ${it.kg_merma_asignados.toFixed(4)} kg (${args.estado_mezcla}).`,
    })

    // Marcar reserva como 'consumida' si la hay activa para este pedido+material
    //    Si la reserva reservaba más kg que los teóricos de esta tarea, se deja
    //    parte activa; PostgREST no permite UPDATE parcial de cantidad, por
    //    simplicidad del MVP marcamos la reserva como 'consumida' cuando el
    //    consumo_teorico de esta tarea >= reserva.cantidad_reservada_kg,
    //    o cuando no queden más tareas pendientes del mismo proceso para
    //    este pedido. La reserva se mantiene 'activa' si todavía hay
    //    consumo futuro. Implementación simple: si queda 0 reservado tras
    //    esta tarea para este material en el pedido, marcar las reservas
    //    como consumidas.
    const { data: reservas } = await supabase
      .from('reservas_stock')
      .select('id, cantidad_reservada_kg')
      .eq('pedido_id', pedido.id)
      .eq('material_id', it.material_id)
      .eq('estado', 'activa')

    if (reservas && reservas.length > 0 && stockReservadoDespues <= 0.0001) {
      for (const r of reservas as any[]) {
        await supabase
          .from('reservas_stock')
          .update({
            estado: 'consumida',
            fecha_cierre: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id)
      }
    }

    const precioKg = m.precio_kg_sobrescrito != null
      ? Number(m.precio_kg_sobrescrito)
      : 0

    consumos.push({
      material_id: it.material_id,
      codigo: m.codigo ?? null,
      nombre: m.nombre,
      tipo: m.tipo,
      kg_teoricos: it.kg_teoricos,
      kg_merma_asignados: it.kg_merma_asignados,
      kg_consumidos_real: it.kg_consumidos_real,
      precio_kg: precioKg,
      coste_eur: Number((it.kg_consumidos_real * precioKg).toFixed(2)),
    })
  }

  // 7) Merma % sobre teóricos
  const mermaPct = totalTeorico > 0
    ? Number((Math.abs(mermaTotal) / totalTeorico * 100).toFixed(2))
    : 0

  // 8) Si merma supera umbral, generar ajuste pendiente
  let ajusteId: string | null = null
  let ajusteGenerado = false
  if (args.estado_mezcla !== 'exacto' && mermaPct > umbralPct) {
    // Rendimiento sugerido: si sobró (mermaTotal > 0) → bajar rendimiento
    //                      si faltó (mermaTotal < 0) → subir rendimiento
    // rendimiento_sugerido = consumo_real_principal / superficie
    const rendSugerido = Number((consumoRealPrincipal / superficieTarea).toFixed(6))

    const { data: ajuste, error: errAj } = await supabase
      .from('ajustes_rendimiento_pendientes')
      .insert({
        tarea_id: args.tarea_id,
        tipo: args.tipo,
        superficie_m2: superficieTarea,
        kg_teoricos_mezcla: totalTeorico,
        kg_merma_total: mermaTotal,
        merma_porcentaje: mermaPct,
        rendimiento_actual_kg_m2: rendimiento,
        rendimiento_sugerido_kg_m2: rendSugerido,
        estado: 'pendiente',
        notas: `Generado automáticamente por tarea ${args.tarea_id}. Revisar y confirmar desde /configuracion.`,
      })
      .select('id')
      .single()
    if (!errAj && ajuste) {
      ajusteId = (ajuste as any).id
      ajusteGenerado = true
    }
  }

  const totalConsumidoReal = consumos.reduce((a, c) => a + c.kg_consumidos_real, 0)

  return {
    consumos,
    total_kg_teoricos: Number(totalTeorico.toFixed(4)),
    total_kg_consumidos_real: Number(totalConsumidoReal.toFixed(4)),
    kg_merma_total: Number(mermaTotal.toFixed(4)),
    merma_porcentaje: mermaPct,
    ajuste_rendimiento_generado: ajusteGenerado,
    ajuste_rendimiento_id: ajusteId,
  }
}

/**
 * Revierte el consumo de una tarea para poder reabrirla.
 * Busca todos los movimientos tipo='consumo' de la tarea_id y los revierte
 * con movimientos tipo='ajuste' con signo opuesto. Restaura stock_fisico_kg
 * y reactiva las reservas consumidas a 'activa'.
 *
 * Se usa al REABRIR una tarea completada (decisión 13 R6b).
 */
export async function revertirConsumoTarea(tareaId: string): Promise<{
  movimientos_revertidos: number
  materiales_afectados: number
}> {
  const supabase = await createClient()

  // 1) Buscar movimientos consumo de esta tarea
  const { data: movs, error: errMv } = await supabase
    .from('movimientos_stock')
    .select('id, material_id, cantidad_kg, pedido_id, stock_antes_kg, stock_despues_kg')
    .eq('tarea_produccion_id', tareaId)
    .eq('tipo', 'consumo')
  if (errMv) throw errMv
  if (!movs || movs.length === 0) {
    return { movimientos_revertidos: 0, materiales_afectados: 0 }
  }

  const materialesAfectados = new Set<string>()

  for (const mv of movs as any[]) {
    materialesAfectados.add(mv.material_id)
    // cantidad_kg viene negativa (consumo). Devolver el valor absoluto al stock.
    const kgARestaurar = Math.abs(Number(mv.cantidad_kg))

    const { data: mat } = await supabase
      .from('materiales')
      .select('stock_fisico_kg, stock_reservado_kg')
      .eq('id', mv.material_id)
      .single()
    if (!mat) continue
    const stockAntes    = Number((mat as any).stock_fisico_kg ?? 0)
    const reservadoAntes = Number((mat as any).stock_reservado_kg ?? 0)
    const stockDespues  = Number((stockAntes + kgARestaurar).toFixed(4))

    await supabase
      .from('materiales')
      .update({
        stock_fisico_kg: stockDespues,
        // No tocamos stock_reservado_kg aquí: al reabrir la tarea se volverá
        // a reservar? Decisión: NO. La reserva original ya se consumió (o
        // liberó). Si el operario reabrir y re-completa, el flujo consumirá
        // de nuevo. Para auditoría perfecta se re-reservaría, pero el MVP
        // solo repone stock_fisico.
        updated_at: new Date().toISOString(),
      })
      .eq('id', mv.material_id)

    await supabase.from('movimientos_stock').insert({
      material_id: mv.material_id,
      tipo: 'ajuste',
      cantidad_kg: +kgARestaurar,
      pedido_id: mv.pedido_id,
      tarea_produccion_id: tareaId,
      stock_antes_kg: stockAntes,
      stock_despues_kg: stockDespues,
      motivo: `Reversión consumo — reapertura tarea ${tareaId}`,
    })
  }

  // 2) Marcar ajustes_rendimiento_pendientes de esta tarea como 'rechazado'
  //    para que no queden huérfanos (si el operario rehace la tarea, se
  //    generará uno nuevo).
  await supabase
    .from('ajustes_rendimiento_pendientes')
    .update({
      estado: 'rechazado',
      resuelto_at: new Date().toISOString(),
      notas: 'Rechazado automáticamente por reapertura de tarea',
    })
    .eq('tarea_id', tareaId)
    .eq('estado', 'pendiente')

  return {
    movimientos_revertidos: movs.length,
    materiales_afectados: materialesAfectados.size,
  }
}

// =================================================================
// 6. CALCULAR MEZCLA TEÓRICA DE UNA TAREA (sin consumir)
// =================================================================
// Usado por el modal "Prepara esta mezcla" al iniciar la tarea.
// =================================================================

export interface PrevisioMezclaMaterial {
  material_id: string
  codigo: string | null
  nombre: string
  tipo: string
  kg_teoricos: number
  precio_kg: number
  coste_eur: number
  stock_fisico_kg: number
  suficiente: boolean
}

export interface PrevisioMezcla {
  tarea_id: string
  tipo: 'lacado' | 'fondo'
  superficie_m2: number
  rendimiento_kg_m2: number
  materiales: PrevisioMezclaMaterial[]
  total_kg: number
  total_coste_eur: number
  todos_suficientes: boolean
}

export async function calcularMezclaTeoricaTarea(
  tareaId: string
): Promise<PrevisioMezcla> {
  const supabase = await createClient()

  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select(`
      id, superficie_m2_aplicada, proceso_id,
      proceso:procesos_catalogo(codigo),
      pieza:piezas(
        id, superficie_m2,
        linea_pedido:lineas_pedido(
          material_lacado_id, material_fondo_id
        )
      )
    `)
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')

  const t: any = tarea
  const proceso = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
  const codigo: string = proceso?.codigo ?? ''
  let tipo: 'lacado' | 'fondo'
  if (codigo === 'LACADO') tipo = 'lacado'
  else if (codigo === 'FONDO' || codigo === 'FONDEADO_2') tipo = 'fondo'
  else throw new Error(`Proceso ${codigo} no consume mezcla.`)

  const pieza = Array.isArray(t.pieza) ? t.pieza[0] : t.pieza
  if (!pieza) throw new Error('Pieza no encontrada')
  const linea = Array.isArray(pieza.linea_pedido) ? pieza.linea_pedido[0] : pieza.linea_pedido
  if (!linea) throw new Error('Línea de pedido no encontrada')

  const materialPrincipalId: string | null =
    tipo === 'lacado' ? linea.material_lacado_id : linea.material_fondo_id
  if (!materialPrincipalId) {
    throw new Error(`La línea no tiene material_${tipo}_id asignado.`)
  }

  const cfg = await leerConfigErp(supabase)
  const rendimiento = tipo === 'lacado'
    ? cfg.rendimiento_lacado_kg_m2
    : cfg.rendimiento_fondo_kg_m2
  const ratioCata = tipo === 'lacado' ? cfg.ratio_cata_lacado : cfg.ratio_cata_fondo
  const ratioDis  = tipo === 'lacado' ? cfg.ratio_dis_lacado  : cfg.ratio_dis_fondo

  const superficie = Number(t.superficie_m2_aplicada ?? pieza.superficie_m2 ?? 0)
  if (superficie <= 0) {
    throw new Error('Superficie de la tarea es 0. No se puede calcular.')
  }

  const kgPrincipal = Number((superficie * rendimiento).toFixed(4))
  const kgCata = Number((kgPrincipal / Math.max(1, ratioCata)).toFixed(4))
  const kgDis  = Number((kgPrincipal / Math.max(1, ratioDis)).toFixed(4))

  const idsRelevantes = [materialPrincipalId]
  if (cfg.material_catalizador_default_id) idsRelevantes.push(cfg.material_catalizador_default_id)
  if (cfg.material_disolvente_default_id)  idsRelevantes.push(cfg.material_disolvente_default_id)

  const { data: mats } = await supabase
    .from('materiales')
    .select('id, codigo, nombre, tipo, precio_kg_sobrescrito, stock_fisico_kg, stock_reservado_kg')
    .in('id', idsRelevantes)
  const mapMat = new Map<string, any>((mats ?? []).map((m: any) => [m.id, m]))

  function filaMaterial(id: string | null, kg: number): PrevisioMezclaMaterial | null {
    if (!id || kg <= 0) return null
    const m = mapMat.get(id)
    if (!m) return null
    const precioKg = m.precio_kg_sobrescrito != null ? Number(m.precio_kg_sobrescrito) : 0
    const stockFisico = Number(m.stock_fisico_kg ?? 0)
    const stockReservado = Number(m.stock_reservado_kg ?? 0)
    const disponible = stockFisico - stockReservado
    return {
      material_id: id,
      codigo: m.codigo ?? null,
      nombre: m.nombre,
      tipo: m.tipo,
      kg_teoricos: kg,
      precio_kg: precioKg,
      coste_eur: Number((kg * precioKg).toFixed(2)),
      stock_fisico_kg: stockFisico,
      suficiente: disponible >= kg - 0.0001,
    }
  }

  const filas: PrevisioMezclaMaterial[] = []
  const filaP = filaMaterial(materialPrincipalId, kgPrincipal)
  if (filaP) filas.push(filaP)
  const filaC = filaMaterial(cfg.material_catalizador_default_id, kgCata)
  if (filaC) filas.push(filaC)
  const filaD = filaMaterial(cfg.material_disolvente_default_id, kgDis)
  if (filaD) filas.push(filaD)

  const totalKg = kgPrincipal + kgCata + kgDis
  const totalCoste = filas.reduce((a, f) => a + f.coste_eur, 0)

  return {
    tarea_id: tareaId,
    tipo,
    superficie_m2: superficie,
    rendimiento_kg_m2: rendimiento,
    materiales: filas,
    total_kg: Number(totalKg.toFixed(4)),
    total_coste_eur: Number(totalCoste.toFixed(2)),
    todos_suficientes: filas.every((f) => f.suficiente),
  }
}
