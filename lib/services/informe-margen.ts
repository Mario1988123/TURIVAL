// lib/services/informe-margen.ts
/**
 * Capa 8 — Informe de margen REAL por pedido.
 *
 * Calcula el margen económico real de cada pedido comparando:
 *   INGRESOS:
 *     - base_imponible del pedido (ya calculado en presupuesto/pedido).
 *
 *   COSTES REALES:
 *     - Mano de obra real:  Σ tareas.tiempo_real_minutos × coste_minuto_operario
 *     - Materiales reales:  Σ tareas.consumo_{lacado,fondo,cata,dis}_real_kg × precio_kg_material
 *
 *   DERIVADOS:
 *     - coste_total_real      = mo_real + material_real
 *     - margen_real_eur       = base_imponible - coste_total_real
 *     - margen_real_porcentaje= margen_real_eur / base_imponible × 100
 *     - delta_vs_objetivo     = margen_real_porcentaje - margen_objetivo_porcentaje
 *
 * Precios de materiales:
 *   resolverPrecioKg() (de materiales.ts) usa precio_kg_sobrescrito si existe,
 *   si no precio_base_kg del proveedor. Para el cálculo del margen cargamos
 *   todos los materiales con su proveedor en una sola query.
 *
 * Filtrado:
 *   Solo pedidos confirmados/en_produccion/completado/entregado/facturado.
 *   Los pedidos en borrador o cancelados se excluyen (no tienen sentido económico).
 */

import { createClient } from '@/lib/supabase/server'
import { obtenerConfiguracionEmpresa } from './configuracion'
import { resolverPrecioKg } from './materiales'

// =============================================================
// TIPOS
// =============================================================

export interface ResumenMargenPedido {
  pedido_id: string
  pedido_numero: string
  cliente_nombre: string
  estado: string
  fecha_creacion: string

  ingresos_eur: number          // base_imponible
  subtotal_eur: number          // por informarse

  coste_mo_real_eur: number
  coste_material_real_eur: number
  coste_total_real_eur: number

  margen_real_eur: number
  margen_real_porcentaje: number | null

  margen_objetivo_porcentaje: number
  delta_vs_objetivo: number | null  // margen_real_% - margen_objetivo_%

  piezas_count: number
  tareas_con_real_count: number     // cuántas tareas tienen consumo_registrado_at
}

export interface DetalleMargenPedido extends ResumenMargenPedido {
  piezas: Array<{
    pieza_id: string
    pieza_numero: string
    estado: string
    superficie_m2: number | null
    coste_mo_real_eur: number
    coste_material_real_eur: number
    coste_total_real_eur: number
  }>
}

// =============================================================
// HELPERS
// =============================================================

function num(x: unknown): number { return typeof x === 'number' ? x : Number(x ?? 0) || 0 }

async function cargarPreciosMateriales(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('materiales')
    .select('*, proveedor:proveedores(id, nombre, tipo_material, precio_base_kg)')
  const map = new Map<string, number>()
  for (const m of ((data ?? []) as any[])) {
    map.set(m.id, resolverPrecioKg(m))
  }
  return map
}

const SELECT_MARGEN = `
  id, numero, estado, fecha_creacion, base_imponible, subtotal, total,
  cliente:clientes(nombre_comercial),
  lineas_pedido(
    id,
    piezas(
      id, numero, estado, superficie_m2,
      material_lacado_id, material_fondo_id,
      tareas:tareas_produccion(
        id, tiempo_real_minutos, consumo_registrado_at,
        consumo_lacado_real_kg, consumo_fondo_real_kg,
        consumo_cata_real_kg, consumo_dis_real_kg
      )
    )
  )
`

const ESTADOS_FACTURABLES = ['confirmado', 'en_produccion', 'completado', 'entregado', 'facturado']

// =============================================================
// CÁLCULO
// =============================================================

interface ContextoCalculo {
  costeMinuto: number
  margenObjetivo: number
  preciosMateriales: Map<string, number>
  catalizadorPrecio: number
  disolventePrecio: number
}

function calcularCostePieza(p: any, ctx: ContextoCalculo): { mo: number; material: number; con_real: number } {
  let mo = 0
  let material = 0
  let con_real = 0

  const precioLacado = p.material_lacado_id ? (ctx.preciosMateriales.get(p.material_lacado_id) ?? 0) : 0
  const precioFondo  = p.material_fondo_id  ? (ctx.preciosMateriales.get(p.material_fondo_id)  ?? 0) : 0

  for (const t of (p.tareas ?? []) as any[]) {
    if (t.consumo_registrado_at) con_real++
    mo += num(t.tiempo_real_minutos) * ctx.costeMinuto
    material += num(t.consumo_lacado_real_kg) * precioLacado
    material += num(t.consumo_fondo_real_kg)  * precioFondo
    material += num(t.consumo_cata_real_kg)   * ctx.catalizadorPrecio
    material += num(t.consumo_dis_real_kg)    * ctx.disolventePrecio
  }

  return { mo, material, con_real }
}

function construirResumen(pedido: any, ctx: ContextoCalculo): ResumenMargenPedido {
  const lineas = (pedido.lineas_pedido ?? []) as any[]
  const piezas = lineas.flatMap(lp => lp.piezas ?? [])

  let coste_mo = 0
  let coste_material = 0
  let tareas_con_real = 0
  for (const p of piezas) {
    const r = calcularCostePieza(p, ctx)
    coste_mo += r.mo
    coste_material += r.material
    tareas_con_real += r.con_real
  }

  const ingresos = num(pedido.base_imponible)
  const coste_total = coste_mo + coste_material
  const margen_eur = ingresos - coste_total
  const margen_pct = ingresos > 0 ? (margen_eur / ingresos) * 100 : null

  const cliente = pedido.cliente
  const clienteNombre = Array.isArray(cliente) ? cliente[0]?.nombre_comercial : cliente?.nombre_comercial

  return {
    pedido_id: pedido.id,
    pedido_numero: pedido.numero,
    cliente_nombre: clienteNombre ?? '',
    estado: pedido.estado,
    fecha_creacion: pedido.fecha_creacion,

    ingresos_eur: ingresos,
    subtotal_eur: num(pedido.subtotal),

    coste_mo_real_eur: Math.round(coste_mo * 100) / 100,
    coste_material_real_eur: Math.round(coste_material * 100) / 100,
    coste_total_real_eur: Math.round(coste_total * 100) / 100,

    margen_real_eur: Math.round(margen_eur * 100) / 100,
    margen_real_porcentaje: margen_pct != null ? Math.round(margen_pct * 10) / 10 : null,

    margen_objetivo_porcentaje: ctx.margenObjetivo,
    delta_vs_objetivo: margen_pct != null ? Math.round((margen_pct - ctx.margenObjetivo) * 10) / 10 : null,

    piezas_count: piezas.length,
    tareas_con_real_count: tareas_con_real,
  }
}

// =============================================================
// CONSULTAS
// =============================================================

export async function listarMargenPedidos(): Promise<ResumenMargenPedido[]> {
  const supabase = await createClient()
  const conf = await obtenerConfiguracionEmpresa()
  if (!conf) throw new Error('configuracion_empresa no encontrada')

  const ctx: ContextoCalculo = {
    costeMinuto: num(conf.coste_minuto_operario) || 0.4,
    margenObjetivo: num(conf.margen_objetivo_porcentaje) || 30,
    preciosMateriales: await cargarPreciosMateriales(supabase),
    catalizadorPrecio: 0,
    disolventePrecio: 0,
  }

  // Catalizador y disolvente default de la configuración
  if (conf.material_catalizador_default_id) {
    ctx.catalizadorPrecio = ctx.preciosMateriales.get(conf.material_catalizador_default_id) ?? 0
  }
  if (conf.material_disolvente_default_id) {
    ctx.disolventePrecio = ctx.preciosMateriales.get(conf.material_disolvente_default_id) ?? 0
  }

  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_MARGEN)
    .in('estado', ESTADOS_FACTURABLES)
    .order('fecha_creacion', { ascending: false })
    .limit(200)
  if (error) throw error

  return ((data ?? []) as any[]).map(p => construirResumen(p, ctx))
}

export async function obtenerDetalleMargenPedido(pedido_id: string): Promise<DetalleMargenPedido | null> {
  const supabase = await createClient()
  const conf = await obtenerConfiguracionEmpresa()
  if (!conf) return null

  const ctx: ContextoCalculo = {
    costeMinuto: num(conf.coste_minuto_operario) || 0.4,
    margenObjetivo: num(conf.margen_objetivo_porcentaje) || 30,
    preciosMateriales: await cargarPreciosMateriales(supabase),
    catalizadorPrecio: 0,
    disolventePrecio: 0,
  }
  if (conf.material_catalizador_default_id) {
    ctx.catalizadorPrecio = ctx.preciosMateriales.get(conf.material_catalizador_default_id) ?? 0
  }
  if (conf.material_disolvente_default_id) {
    ctx.disolventePrecio = ctx.preciosMateriales.get(conf.material_disolvente_default_id) ?? 0
  }

  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_MARGEN)
    .eq('id', pedido_id)
    .single()
  if (error || !data) return null

  const base = construirResumen(data, ctx)

  const piezas = ((data as any).lineas_pedido ?? [])
    .flatMap((lp: any) => (lp.piezas ?? []) as any[])
    .map((p: any) => {
      const r = calcularCostePieza(p, ctx)
      return {
        pieza_id: p.id,
        pieza_numero: p.numero,
        estado: p.estado,
        superficie_m2: p.superficie_m2 != null ? Number(p.superficie_m2) : null,
        coste_mo_real_eur: Math.round(r.mo * 100) / 100,
        coste_material_real_eur: Math.round(r.material * 100) / 100,
        coste_total_real_eur: Math.round((r.mo + r.material) * 100) / 100,
      }
    })

  return { ...base, piezas }
}
