// lib/services/albaranes.ts
/**
 * Service de ALBARANES — Capa 7.
 *
 * Reescrito desde cero el 2026-04-24 contra el schema real.
 *
 * Schema:
 *   albaranes (id, numero, pedido_id, cliente_id, estado, fecha_entrega,
 *              observaciones, firma_cliente)
 *     · estado ∈ ('borrador','impreso','entregado')
 *     · numero generado via RPC generar_numero_secuencial('albaran') → ALB-YY-NNNN
 *
 *   lineas_albaran (id, albaran_id, pieza_id, lote_id, descripcion, cantidad,
 *                   observaciones)
 *
 * Reutiliza el service viejo `lib/services/documentos.ts` pero sin tocarlo.
 * Ese archivo tiene referencias a columnas que ya no existen y Mario decidirá
 * si lo migra o lo borra más adelante.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export type EstadoAlbaran = 'borrador' | 'impreso' | 'entregado'

export interface AlbaranListado {
  id: string
  numero: string
  estado: EstadoAlbaran
  fecha_entrega: string
  observaciones: string | null
  pedido_numero: string
  cliente_nombre: string
  piezas_count: number
  created_at: string
}

export interface AlbaranDetalle extends AlbaranListado {
  cliente_direccion: string | null
  cliente_ciudad: string | null
  cliente_cif: string | null
  firma_cliente: string | null
  piezas: Array<{
    linea_id: string
    pieza_id: string | null
    pieza_numero: string | null
    descripcion: string | null
    cantidad: number
    observaciones: string | null
  }>
}

// =============================================================
// CONSULTAS
// =============================================================

export async function listarAlbaranes(filtros?: {
  estado?: EstadoAlbaran
  pedido_id?: string
}): Promise<AlbaranListado[]> {
  const supabase = await createClient()
  let q = supabase
    .from('albaranes')
    .select(`
      id, numero, estado, fecha_entrega, observaciones, created_at,
      pedido:pedidos(numero),
      cliente:clientes(nombre_comercial),
      lineas:lineas_albaran(id)
    `)
    .order('created_at', { ascending: false })
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.pedido_id) q = q.eq('pedido_id', filtros.pedido_id)

  const { data, error } = await q
  if (error) throw error

  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    numero: a.numero,
    estado: a.estado,
    fecha_entrega: a.fecha_entrega,
    observaciones: a.observaciones,
    pedido_numero: a.pedido?.numero ?? '',
    cliente_nombre: a.cliente?.nombre_comercial ?? '',
    piezas_count: (a.lineas ?? []).length,
    created_at: a.created_at,
  }))
}

export async function obtenerAlbaran(id: string): Promise<AlbaranDetalle | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('albaranes')
    .select(`
      id, numero, estado, fecha_entrega, observaciones, firma_cliente, created_at,
      pedido:pedidos(numero),
      cliente:clientes(nombre_comercial, direccion, ciudad, cif_nif),
      lineas:lineas_albaran(
        id, pieza_id, descripcion, cantidad, observaciones,
        pieza:piezas(numero)
      )
    `)
    .eq('id', id)
    .single()
  if (error) return null

  const a = data as any
  return {
    id: a.id,
    numero: a.numero,
    estado: a.estado,
    fecha_entrega: a.fecha_entrega,
    observaciones: a.observaciones,
    firma_cliente: a.firma_cliente,
    created_at: a.created_at,
    pedido_numero: a.pedido?.numero ?? '',
    cliente_nombre: a.cliente?.nombre_comercial ?? '',
    cliente_direccion: a.cliente?.direccion ?? null,
    cliente_ciudad: a.cliente?.ciudad ?? null,
    cliente_cif: a.cliente?.cif_nif ?? null,
    piezas_count: (a.lineas ?? []).length,
    piezas: (a.lineas ?? []).map((l: any) => ({
      linea_id: l.id,
      pieza_id: l.pieza_id,
      pieza_numero: l.pieza?.numero ?? null,
      descripcion: l.descripcion,
      cantidad: l.cantidad ?? 1,
      observaciones: l.observaciones,
    })),
  }
}

// Lista pedidos elegibles para crear albarán (confirmados / en_produccion / completado)
export async function listarPedidosElegibles(): Promise<Array<{
  id: string
  numero: string
  cliente_id: string
  cliente_nombre: string
  piezas_completadas: number
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero, cliente_id, estado,
      cliente:clientes(nombre_comercial),
      lineas_pedido(
        piezas(id, estado)
      )
    `)
    .in('estado', ['confirmado', 'en_produccion', 'completado'])
    .order('created_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as any[]).map((p) => {
    const piezasTotales = (p.lineas_pedido ?? []).flatMap((lp: any) => lp.piezas ?? [])
    const completadas = piezasTotales.filter((pz: any) => pz.estado === 'completada' || pz.estado === 'en_almacen').length
    return {
      id: p.id,
      numero: p.numero,
      cliente_id: p.cliente_id,
      cliente_nombre: p.cliente?.nombre_comercial ?? '',
      piezas_completadas: completadas,
    }
  })
}

// =============================================================
// MUTACIONES
// =============================================================

export interface ResultadoAlbaran { ok: boolean; albaran_id?: string; error?: string }

/**
 * Crea un albarán a partir de un pedido, incluyendo las piezas que estén
 * completadas o en almacén (listas para entregar).
 */
export async function crearAlbaranDesdePedido(params: {
  pedido_id: string
  fecha_entrega?: string
  observaciones?: string
  piezas_ids?: string[]    // override manual de qué piezas incluir
}): Promise<ResultadoAlbaran> {
  const supabase = await createClient()

  // Datos del pedido + cliente
  const { data: pedido, error: errPed } = await supabase
    .from('pedidos')
    .select('id, cliente_id')
    .eq('id', params.pedido_id)
    .single()
  if (errPed || !pedido) return { ok: false, error: errPed?.message ?? 'pedido no encontrado' }

  // Piezas a incluir
  let piezasIds: string[] = []
  if (params.piezas_ids && params.piezas_ids.length > 0) {
    piezasIds = params.piezas_ids
  } else {
    const { data: lineas, error: errLp } = await supabase
      .from('lineas_pedido')
      .select(`id, piezas(id, estado)`)
      .eq('pedido_id', params.pedido_id)
    if (errLp) return { ok: false, error: errLp.message }
    piezasIds = ((lineas ?? []) as any[])
      .flatMap((lp) => lp.piezas ?? [])
      .filter((p: any) => p.estado === 'completada' || p.estado === 'en_almacen')
      .map((p: any) => p.id)
  }

  if (piezasIds.length === 0) {
    return { ok: false, error: 'Este pedido no tiene piezas listas para entregar.' }
  }

  // Número secuencial
  const { data: numData, error: errNum } = await supabase.rpc('generar_numero_secuencial', { p_tipo: 'albaran' })
  if (errNum || !numData) return { ok: false, error: errNum?.message ?? 'no se pudo generar número' }

  const fechaEntrega = params.fecha_entrega ?? new Date().toISOString().slice(0, 10)

  const { data: nuevo, error: errIns } = await supabase
    .from('albaranes')
    .insert({
      numero: numData as string,
      pedido_id: params.pedido_id,
      cliente_id: pedido.cliente_id,
      estado: 'borrador',
      fecha_entrega: fechaEntrega,
      observaciones: params.observaciones ?? null,
    })
    .select('id')
    .single()
  if (errIns || !nuevo) return { ok: false, error: errIns?.message ?? 'no se pudo crear albarán' }

  const lineas = piezasIds.map((pieza_id) => ({
    albaran_id: nuevo.id,
    pieza_id,
    cantidad: 1,
  }))
  const { error: errLineas } = await supabase.from('lineas_albaran').insert(lineas)
  if (errLineas) return { ok: false, error: errLineas.message }

  return { ok: true, albaran_id: nuevo.id }
}

export async function cambiarEstadoAlbaran(params: {
  albaran_id: string
  estado: EstadoAlbaran
  firma_cliente?: string
}): Promise<ResultadoAlbaran> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = {
    estado: params.estado,
    updated_at: new Date().toISOString(),
  }
  if (params.firma_cliente !== undefined) updates.firma_cliente = params.firma_cliente

  const { error } = await supabase
    .from('albaranes')
    .update(updates)
    .eq('id', params.albaran_id)
  if (error) return { ok: false, error: error.message }

  // Si se marca entregado, marcar también las piezas
  if (params.estado === 'entregado') {
    const { data: lineas } = await supabase
      .from('lineas_albaran')
      .select('pieza_id')
      .eq('albaran_id', params.albaran_id)
    const piezasIds = ((lineas ?? []) as any[])
      .map((l) => l.pieza_id)
      .filter((x): x is string => !!x)
    if (piezasIds.length > 0) {
      await supabase
        .from('piezas')
        .update({ estado: 'entregada', fecha_entrega: new Date().toISOString() })
        .in('id', piezasIds)
    }
  }

  return { ok: true, albaran_id: params.albaran_id }
}

export async function eliminarAlbaran(albaran_id: string): Promise<ResultadoAlbaran> {
  const supabase = await createClient()
  // Solo permite eliminar si está en borrador
  const { data: alb } = await supabase
    .from('albaranes')
    .select('estado')
    .eq('id', albaran_id)
    .single()
  if (!alb) return { ok: false, error: 'no encontrado' }
  if (alb.estado !== 'borrador') return { ok: false, error: 'solo se pueden borrar albaranes en borrador' }

  const { error } = await supabase.from('albaranes').delete().eq('id', albaran_id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, albaran_id }
}
