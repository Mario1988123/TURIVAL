// lib/actions/pedidos.ts
'use server'

/**
 * Server Actions de PEDIDOS — Capa 4
 *
 * Acciones:
 *  - accionConvertirPresupuestoAPedido
 *  - accionObtenerDatosParaConversion
 *  - accionListarUbicacionesActivas
 *  - accionConfirmarPedido
 *  - accionArrancarProduccion
 *  - accionCancelarPedido
 *  - accionMoverPieza            (Iter D)
 *  - accionAñadirLineasAPedido   (Feature B)
 *  - accionEliminarLineaPedido   (Feature B)
 */

import { revalidatePath } from 'next/cache'

import {
  convertirPresupuestoAPedido,
  confirmarPedido,
  arrancarProduccion,
  cancelarPedido,
  moverPieza,
  type ConvertirPresupuestoInput,
  type ConfirmarPedidoInput,
} from '@/lib/services/pedidos'
import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS compartidos
// =============================================================

export interface LineaParaConversion {
  id: string
  descripcion: string | null
  cantidad_original: number
  cantidad_pendiente: number
  precio_unitario: number
}

export interface PresupuestoParaConversion {
  id: string
  numero: string
  cliente_id: string
  estado: string
  total: number | null
  fecha_entrega_estimada: string | null
  observaciones_comerciales: string | null
  observaciones_internas: string | null
  cliente: {
    id: string
    nombre_comercial: string
    direccion: string | null
    codigo_postal: string | null
    ciudad: string | null
    provincia: string | null
    persona_contacto: string | null
    telefono: string | null
  } | null
}

export interface UbicacionOpcion {
  id: string
  codigo: string
  nombre: string
  tipo: 'carrito' | 'estanteria' | 'libre'
}

// =============================================================
// convertirPresupuestoAPedido
// =============================================================

export async function accionConvertirPresupuestoAPedido(
  input: ConvertirPresupuestoInput
) {
  try {
    const pedido = await convertirPresupuestoAPedido(input)
    revalidatePath('/pedidos')
    revalidatePath(`/presupuestos/${input.presupuestoId}`)
    return { ok: true as const, pedido: pedido as any }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al convertir el presupuesto',
    }
  }
}

// =============================================================
// obtenerDatosParaConversion
// =============================================================

export async function accionObtenerDatosParaConversion(presupuestoId: string) {
  try {
    const supabase = await createClient()

    const { data: presupuesto, error: errP } = await supabase
      .from('presupuestos')
      .select(
        `
        id, numero, cliente_id, estado, total,
        fecha_entrega_estimada,
        observaciones_comerciales, observaciones_internas,
        cliente:clientes(
          id, nombre_comercial,
          direccion, codigo_postal, ciudad, provincia,
          persona_contacto, telefono
        )
      `
      )
      .eq('id', presupuestoId)
      .single()
    if (errP) throw errP
    if (!presupuesto) throw new Error('Presupuesto no encontrado')

    const { data: lineasRaw, error: errL } = await supabase
      .from('lineas_presupuesto')
      .select('id, descripcion, cantidad, precio_unitario, orden')
      .eq('presupuesto_id', presupuestoId)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (errL) throw errL

    const lineasList = (lineasRaw ?? []) as Array<{
      id: string
      descripcion: string | null
      cantidad: number | null
      precio_unitario: number | null
      orden: number | null
    }>

    if (lineasList.length === 0) {
      return {
        ok: true as const,
        presupuesto: presupuesto as unknown as PresupuestoParaConversion,
        lineas: [] as LineaParaConversion[],
      }
    }

    const lineaIds = lineasList.map((l) => l.id)

    const { data: lineasPed, error: errLP } = await supabase
      .from('lineas_pedido')
      .select('linea_presupuesto_origen_id, cantidad, pedido_id')
      .in('linea_presupuesto_origen_id', lineaIds)
    if (errLP) throw errLP

    const lineasPedList = (lineasPed ?? []) as Array<{
      linea_presupuesto_origen_id: string
      cantidad: number | null
      pedido_id: string
    }>

    let noCanceladosIds = new Set<string>()
    if (lineasPedList.length > 0) {
      const pedidoIds = [...new Set(lineasPedList.map((l) => l.pedido_id))]
      const { data: pedidos, error: errPed } = await supabase
        .from('pedidos')
        .select('id, estado')
        .in('id', pedidoIds)
      if (errPed) throw errPed
      noCanceladosIds = new Set(
        ((pedidos ?? []) as Array<{ id: string; estado: string }>)
          .filter((p) => p.estado !== 'cancelado')
          .map((p) => p.id)
      )
    }

    const pedidoPorLinea = new Map<string, number>()
    for (const lp of lineasPedList) {
      if (!noCanceladosIds.has(lp.pedido_id)) continue
      const prev = pedidoPorLinea.get(lp.linea_presupuesto_origen_id) ?? 0
      pedidoPorLinea.set(
        lp.linea_presupuesto_origen_id,
        prev + Number(lp.cantidad ?? 0)
      )
    }

    const lineas: LineaParaConversion[] = lineasList.map((l) => {
      const orig = Number(l.cantidad ?? 0)
      const pedido = pedidoPorLinea.get(l.id) ?? 0
      return {
        id: l.id,
        descripcion: l.descripcion,
        cantidad_original: orig,
        cantidad_pendiente: orig - pedido,
        precio_unitario: Number(l.precio_unitario ?? 0),
      }
    })

    return {
      ok: true as const,
      presupuesto: presupuesto as unknown as PresupuestoParaConversion,
      lineas,
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando datos del presupuesto',
      presupuesto: null,
      lineas: [] as LineaParaConversion[],
    }
  }
}

// =============================================================
// listarUbicacionesActivas
// =============================================================

export async function accionListarUbicacionesActivas() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('id, codigo, nombre, tipo')
      .eq('activo', true)
      .order('codigo', { ascending: true })
    if (error) throw error
    return {
      ok: true as const,
      ubicaciones: (data ?? []) as UbicacionOpcion[],
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando ubicaciones',
      ubicaciones: [] as UbicacionOpcion[],
    }
  }
}

// =============================================================
// confirmarPedido
// =============================================================

export async function accionConfirmarPedido(input: ConfirmarPedidoInput) {
  try {
    const resultado = await confirmarPedido(input)
    revalidatePath('/pedidos')
    revalidatePath(`/pedidos/${input.pedidoId}`)
    return {
      ok: true as const,
      pedido: resultado.pedido as any,
      piezasCreadas: resultado.piezasCreadas,
      tareasCreadas: resultado.tareasCreadas,
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al confirmar el pedido',
    }
  }
}

// =============================================================
// arrancarProduccion
// =============================================================

export async function accionArrancarProduccion(pedidoId: string) {
  try {
    const pedido = await arrancarProduccion(pedidoId)
    revalidatePath('/pedidos')
    revalidatePath(`/pedidos/${pedidoId}`)
    return { ok: true as const, pedido: pedido as any }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al arrancar producción',
    }
  }
}

// =============================================================
// cancelarPedido
// =============================================================

export async function accionCancelarPedido(
  pedidoId: string,
  motivo?: string | null
) {
  try {
    const pedido = await cancelarPedido(pedidoId, motivo ?? null)
    revalidatePath('/pedidos')
    revalidatePath(`/pedidos/${pedidoId}`)
    return { ok: true as const, pedido: pedido as any }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al cancelar el pedido',
    }
  }
}

// =============================================================
// moverPieza (Iter D)
// =============================================================

export async function accionMoverPieza(input: {
  piezaId: string
  nuevaUbicacionId: string
  motivo?: string | null
}) {
  try {
    const pieza = await moverPieza(input)
    // Sin path específico fácil de calcular: revalidamos /pedidos en general
    revalidatePath('/pedidos')
    return { ok: true as const, pieza: pieza as any }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al mover la pieza',
    }
  }
}

// =============================================================
// HELPER interno: recalcular totales de un pedido
// =============================================================

async function recalcularTotalesPedido(pedidoId: string, supabase: any) {
  const { data: pedido, error: errP } = await supabase
    .from('pedidos')
    .select('descuento_porcentaje, iva_porcentaje')
    .eq('id', pedidoId)
    .single()
  if (errP) throw errP

  const { data: lineas, error: errL } = await supabase
    .from('lineas_pedido')
    .select('total_linea')
    .eq('pedido_id', pedidoId)
  if (errL) throw errL

  const subtotal = Number(
    ((lineas ?? []) as Array<{ total_linea: number | null }>)
      .reduce((s, l) => s + Number(l.total_linea ?? 0), 0)
      .toFixed(2)
  )
  const descPct = Number(pedido?.descuento_porcentaje ?? 0)
  const descImp = Number(((subtotal * descPct) / 100).toFixed(2))
  const baseImp = Number((subtotal - descImp).toFixed(2))
  const ivaPct = Number(pedido?.iva_porcentaje ?? 21)
  const ivaImp = Number(((baseImp * ivaPct) / 100).toFixed(2))
  const total = Number((baseImp + ivaImp).toFixed(2))

  const { error: errU } = await supabase
    .from('pedidos')
    .update({
      subtotal,
      descuento_importe: descImp,
      base_imponible: baseImp,
      iva_importe: ivaImp,
      total,
    })
    .eq('id', pedidoId)
  if (errU) throw errU
}

// =============================================================
// añadirLineasAPedido (Feature B)
// =============================================================

interface SeleccionAñadir {
  lineaPresupuestoId: string
  cantidad: number
}

export async function accionAñadirLineasAPedido(input: {
  pedidoId: string
  lineas: SeleccionAñadir[]
}) {
  try {
    if (!input.lineas || input.lineas.length === 0) {
      throw new Error('No hay líneas para añadir')
    }

    const supabase = await createClient()

    // 1. Validar que el pedido existe y está en borrador
    const { data: pedido, error: errP } = await supabase
      .from('pedidos')
      .select('id, estado, presupuesto_origen_id')
      .eq('id', input.pedidoId)
      .single()
    if (errP) throw errP
    if (!pedido) throw new Error('Pedido no encontrado')
    if ((pedido as any).estado !== 'borrador') {
      throw new Error(
        `Solo se pueden añadir líneas a pedidos en estado "borrador" (actual: "${(pedido as any).estado}")`
      )
    }
    if (!(pedido as any).presupuesto_origen_id) {
      throw new Error(
        'Este pedido no tiene presupuesto de origen, no se pueden añadir líneas desde un presupuesto'
      )
    }

    // 2. Cargar las líneas del presupuesto que se van a añadir
    const lineaIds = input.lineas.map((l) => l.lineaPresupuestoId)
    const { data: lineasPres, error: errLP } = await supabase
      .from('lineas_presupuesto')
      .select('*')
      .in('id', lineaIds)
    if (errLP) throw errLP

    const lineasPresMap = new Map<string, any>(
      ((lineasPres ?? []) as any[]).map((l) => [l.id, l])
    )

    // Todas las líneas deben pertenecer al presupuesto origen
    for (const lp of (lineasPres ?? []) as any[]) {
      if (lp.presupuesto_id !== (pedido as any).presupuesto_origen_id) {
        throw new Error(
          'Al menos una línea no pertenece al presupuesto de origen del pedido'
        )
      }
    }

    // 3. Validar cantidades contra pendiente (calculado en vivo)
    // Cargar todas las lineas_pedido que apuntan + sus estados
    const { data: lineasPedPrev, error: errLPed } = await supabase
      .from('lineas_pedido')
      .select('linea_presupuesto_origen_id, cantidad, pedido_id')
      .in('linea_presupuesto_origen_id', lineaIds)
    if (errLPed) throw errLPed

    const lineasPedPrevList = (lineasPedPrev ?? []) as Array<{
      linea_presupuesto_origen_id: string
      cantidad: number | null
      pedido_id: string
    }>

    let noCanceladosIds = new Set<string>()
    if (lineasPedPrevList.length > 0) {
      const pedidoIds = [...new Set(lineasPedPrevList.map((l) => l.pedido_id))]
      const { data: peds, error: errPeds } = await supabase
        .from('pedidos')
        .select('id, estado')
        .in('id', pedidoIds)
      if (errPeds) throw errPeds
      noCanceladosIds = new Set(
        ((peds ?? []) as Array<{ id: string; estado: string }>)
          .filter((p) => p.estado !== 'cancelado')
          .map((p) => p.id)
      )
    }

    const pedidoPorLinea = new Map<string, number>()
    for (const lp of lineasPedPrevList) {
      if (!noCanceladosIds.has(lp.pedido_id)) continue
      const prev = pedidoPorLinea.get(lp.linea_presupuesto_origen_id) ?? 0
      pedidoPorLinea.set(
        lp.linea_presupuesto_origen_id,
        prev + Number(lp.cantidad ?? 0)
      )
    }

    // Validar cantidades
    for (const sel of input.lineas) {
      if (sel.cantidad <= 0) {
        throw new Error('Todas las cantidades deben ser mayores que 0')
      }
      const linea = lineasPresMap.get(sel.lineaPresupuestoId)
      if (!linea) throw new Error('Línea de presupuesto no encontrada')
      const original = Number(linea.cantidad ?? 0)
      const yaPedido = pedidoPorLinea.get(sel.lineaPresupuestoId) ?? 0
      const pendiente = original - yaPedido
      if (sel.cantidad > pendiente) {
        throw new Error(
          `Una línea solicita ${sel.cantidad} pero solo quedan ${pendiente} pendientes`
        )
      }
    }

    // 4. Construir payload insert
    const payload = input.lineas.map((sel) => {
      const src: any = lineasPresMap.get(sel.lineaPresupuestoId)
      const precioUnitario = Number(src.precio_unitario ?? 0)
      return {
        pedido_id: input.pedidoId,
        linea_presupuesto_origen_id: src.id,
        producto_id: src.producto_id,
        tarifa_id: src.tarifa_id,
        referencia_cliente_id: src.referencia_cliente_id,
        acabado_id: src.acabado_id,
        acabado_texto: src.acabado_texto,
        descripcion: src.descripcion,
        orden: src.orden,
        notas: src.notas,
        nivel_complejidad: src.nivel_complejidad ?? 2,
        color_id: src.color_id,
        tratamiento_id: src.tratamiento_id,
        tipo_pieza: src.tipo_pieza,
        modo_precio: src.modo_precio,
        unidad: src.unidad,
        cantidad: sel.cantidad,
        ancho: src.ancho,
        alto: src.alto,
        grosor: src.grosor,
        longitud_ml: src.longitud_ml,
        superficie_m2: src.superficie_m2,
        cara_frontal: src.cara_frontal,
        cara_trasera: src.cara_trasera,
        canto_superior: src.canto_superior,
        canto_inferior: src.canto_inferior,
        canto_izquierdo: src.canto_izquierdo,
        canto_derecho: src.canto_derecho,
        precio_unitario: precioUnitario,
        precio_m2: src.precio_m2,
        precio_pieza: src.precio_pieza,
        precio_minimo: src.precio_minimo,
        suplemento_manual: src.suplemento_manual,
        suplemento_descripcion: src.suplemento_descripcion,
        total_linea: Number((precioUnitario * sel.cantidad).toFixed(2)),
        tiempo_estimado: src.tiempo_estimado,
        extras: src.extras,
        material_disponible: false,
        // --- Campos del motor ERP (R6) + nudo P+2B iter 4 ---
        // Homogeneizados con convertirPresupuestoAPedido. Sin esto
        // las líneas añadidas posteriormente se quedan "zombie v2"
        // (sin info de materiales, categoría ni procesos) y la
        // generación de tareas de producción las ignora.
        material_lacado_id: src.material_lacado_id ?? null,
        material_fondo_id: src.material_fondo_id ?? null,
        categoria_pieza_id: src.categoria_pieza_id ?? null,
        contabilizar_grosor: src.contabilizar_grosor ?? false,
        precio_aproximado: src.precio_aproximado ?? false,
        desglose_coste_json: src.desglose_coste_json ?? null,
        procesos_codigos: src.procesos_codigos ?? null,
      }
    })

    // 5. Insert
    const { error: errIns, data: creadas } = await supabase
      .from('lineas_pedido')
      .insert(payload)
      .select('id')
    if (errIns) throw errIns

    // 6. Recalcular totales
    await recalcularTotalesPedido(input.pedidoId, supabase)

    revalidatePath(`/pedidos/${input.pedidoId}`)
    revalidatePath('/pedidos')

    return {
      ok: true as const,
      lineasAñadidas: (creadas ?? []).length,
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al añadir líneas',
    }
  }
}

// =============================================================
// eliminarLineaPedido (Feature B)
// =============================================================

export async function accionEliminarLineaPedido(input: {
  pedidoId: string
  lineaPedidoId: string
}) {
  try {
    const supabase = await createClient()

    // 1. Pedido en borrador
    const { data: pedido, error: errP } = await supabase
      .from('pedidos')
      .select('id, estado')
      .eq('id', input.pedidoId)
      .single()
    if (errP) throw errP
    if (!pedido) throw new Error('Pedido no encontrado')
    if ((pedido as any).estado !== 'borrador') {
      throw new Error(
        `Solo se pueden eliminar líneas de pedidos en estado "borrador"`
      )
    }

    // 2. La línea pertenece al pedido y no tiene piezas
    const { data: linea, error: errL } = await supabase
      .from('lineas_pedido')
      .select('id, pedido_id')
      .eq('id', input.lineaPedidoId)
      .single()
    if (errL) throw errL
    if (!linea) throw new Error('Línea no encontrada')
    if ((linea as any).pedido_id !== input.pedidoId) {
      throw new Error('La línea no pertenece al pedido indicado')
    }

    const { count, error: errCount } = await supabase
      .from('piezas')
      .select('*', { count: 'exact', head: true })
      .eq('linea_pedido_id', input.lineaPedidoId)
    if (errCount) throw errCount
    if ((count ?? 0) > 0) {
      throw new Error(
        `No se puede eliminar: la línea tiene ${count} pieza${count === 1 ? '' : 's'} asociada${count === 1 ? '' : 's'}. Cancela el pedido si necesitas deshacer.`
      )
    }

    // 3. Delete
    const { error: errDel } = await supabase
      .from('lineas_pedido')
      .delete()
      .eq('id', input.lineaPedidoId)
    if (errDel) throw errDel

    // 4. Recalcular totales
    await recalcularTotalesPedido(input.pedidoId, supabase)

    revalidatePath(`/pedidos/${input.pedidoId}`)
    revalidatePath('/pedidos')

    return { ok: true as const }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al eliminar línea',
    }
  }
}

// =============================================================
// PAUSAR / REANUDAR PEDIDO (Mario punto 19)
// =============================================================
import { createClient as createSupaServer } from '@/lib/supabase/server'

export async function accionPausarPedido(pedidoId: string) {
  try {
    const supabase = await createSupaServer()
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'pausado' })
      .eq('id', pedidoId)
    if (error) throw error
    // Pausar tareas en_progreso del pedido
    await supabase
      .from('tareas_produccion')
      .update({ estado: 'pendiente' })
      .in('pieza_id', [])  // placeholder; el filtro real va por embed
    revalidatePath(`/pedidos/${pedidoId}`)
    revalidatePath('/produccion')
    revalidatePath('/planificador')
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? 'Error al pausar' }
  }
}

export async function accionReanudarPedido(pedidoId: string) {
  try {
    const supabase = await createSupaServer()
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'en_produccion' })
      .eq('id', pedidoId)
    if (error) throw error
    revalidatePath(`/pedidos/${pedidoId}`)
    revalidatePath('/produccion')
    revalidatePath('/planificador')
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? 'Error al reanudar' }
  }
}
