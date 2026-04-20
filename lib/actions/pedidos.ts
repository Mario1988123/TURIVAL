// lib/actions/pedidos.ts
'use server'

/**
 * Server Actions de PEDIDOS — Capa 4
 *
 * Puente entre Client Components (modales, botones) y el service de pedidos.
 * Todas las acciones devuelven un objeto discriminado { ok: true, ... } |
 * { ok: false, error } para que el cliente pueda manejar errores sin try/catch.
 */

import { revalidatePath } from 'next/cache'

import {
  convertirPresupuestoAPedido,
  type ConvertirPresupuestoInput,
} from '@/lib/services/pedidos'
import { createClient } from '@/lib/supabase/server'

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
      error: e?.message ?? 'Error inesperado al convertir el presupuesto',
    }
  }
}

// =============================================================
// obtenerDatosParaConversion
//
// Trae las líneas del presupuesto + la cantidad PENDIENTE de cada una
// (original - suma de cantidades ya pedidas en pedidos no cancelados).
//
// Usa 3 queries en batch (no N+1): líneas + lineas_pedido + estados pedidos.
// =============================================================

export interface LineaParaConversion {
  id: string
  descripcion: string | null
  cantidad_original: number
  cantidad_pendiente: number
  precio_unitario: number
}

export async function accionObtenerDatosParaConversion(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // 1. Cabecera presupuesto (para mostrar cliente/número en el modal)
    const { data: presupuesto, error: errP } = await supabase
      .from('presupuestos')
      .select(
        `
        id, numero, cliente_id, estado, total,
        cliente:clientes(id, nombre_comercial)
      `
      )
      .eq('id', presupuestoId)
      .single()
    if (errP) throw errP
    if (!presupuesto) throw new Error('Presupuesto no encontrado')

    // 2. Líneas del presupuesto
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
        presupuesto: presupuesto as any,
        lineas: [] as LineaParaConversion[],
      }
    }

    const lineaIds = lineasList.map((l) => l.id)

    // 3. Lineas_pedido que apuntan a estas líneas
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

    // 4. Estados de los pedidos implicados (para filtrar cancelados)
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

    // 5. Cantidad ya pedida por línea (excluyendo pedidos cancelados)
    const pedidoPorLinea = new Map<string, number>()
    for (const lp of lineasPedList) {
      if (!noCanceladosIds.has(lp.pedido_id)) continue
      const prev = pedidoPorLinea.get(lp.linea_presupuesto_origen_id) ?? 0
      pedidoPorLinea.set(
        lp.linea_presupuesto_origen_id,
        prev + Number(lp.cantidad ?? 0)
      )
    }

    // 6. Construir resultado
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
      presupuesto: presupuesto as any,
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
