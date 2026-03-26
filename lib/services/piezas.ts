import { createClient } from './client'
import type { Pieza, Pedido, Lote } from '../types/erp'
import { obtenerSiguienteNumero } from './presupuestos'

/**
 * Genera datos para QR con trazabilidad completa
 * Formato: https://tuapp.com/trace/PIE-2026-00001?pedido=PED-2026-0001&lote=LOT-2026-0001
 */
export function generarQRData(
  codigo_pieza: string,
  codigo_pedido: string,
  codigo_lote?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const params = new URLSearchParams({
    pedido: codigo_pedido,
    ...(codigo_lote && { lote: codigo_lote }),
  })
  return `${baseUrl}/trace/${codigo_pieza}?${params.toString()}`
}

/**
 * Crear lote para un pedido
 */
export async function crearLote(
  pedido_id: string,
  descripcion?: string,
  color_id?: string,
  tratamiento_id?: string
): Promise<Lote> {
  const supabase = createClient()
  const codigo = await obtenerSiguienteNumero('lote')

  const { data, error } = await supabase
    .from('lotes')
    .insert({
      codigo,
      pedido_id,
      descripcion,
      color_id,
      tratamiento_id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Lote
}

/**
 * Crear pieza con QR
 */
export interface CrearPiezaInput {
  pedido_id: string
  lote_id?: string
  cliente_id: string
  referencia_cliente?: string
  producto_id?: string
  acabado_id?: string
  cantidad?: number
  ancho?: number
  alto?: number
  grosor?: number
  superficie_m2?: number
  modo_precio?: 'm2' | 'pieza'
  color_id?: string
  tratamiento_id?: string
  acabado_texto?: string
  observaciones?: string
  tiempo_estimado?: number
}

export async function crearPieza(input: CrearPiezaInput): Promise<Pieza> {
  const supabase = createClient()

  // Obtener pedido para saber su número
  const { data: pedido, error: pedError } = await supabase
    .from('pedidos')
    .select('numero')
    .eq('id', input.pedido_id)
    .single()

  if (pedError) throw pedError

  // Obtener lote si existe
  let codigo_lote: string | undefined
  if (input.lote_id) {
    const { data: lote } = await supabase
      .from('lotes')
      .select('codigo')
      .eq('id', input.lote_id)
      .single()

    codigo_lote = lote?.codigo
  }

  // Generar código único de pieza
  const codigo_pieza = await obtenerSiguienteNumero('pieza')

  // Generar QR data
  const qr_data = generarQRData(codigo_pieza, pedido.numero, codigo_lote)

  // Crear pieza
  const { data, error } = await supabase
    .from('piezas')
    .insert({
      codigo: codigo_pieza,
      qr_data,
      pedido_id: input.pedido_id,
      lote_id: input.lote_id,
      cliente_id: input.cliente_id,
      referencia_cliente: input.referencia_cliente,
      producto_id: input.producto_id,
      acabado_id: input.acabado_id,
      cantidad: input.cantidad || 1,
      ancho: input.ancho,
      alto: input.alto,
      grosor: input.grosor,
      superficie_m2: input.superficie_m2,
      modo_precio: input.modo_precio,
      color_id: input.color_id,
      tratamiento_id: input.tratamiento_id,
      acabado_texto: input.acabado_texto,
      observaciones: input.observaciones,
      tiempo_estimado: input.tiempo_estimado,
    })
    .select()
    .single()

  if (error) throw error
  return data as Pieza
}

/**
 * Crear fases de producción automáticas para una pieza
 */
export async function crearFasesProduccion(pieza_id: string) {
  const supabase = createClient()

  const fases = [
    { fase: 'recepcion', orden: 1 },
    { fase: 'lijado', orden: 2 },
    { fase: 'fondo', orden: 3 },
    { fase: 'lacado', orden: 4 },
    { fase: 'secado', orden: 5 },
    { fase: 'manipulado', orden: 6 },
    { fase: 'terminacion', orden: 7 },
    { fase: 'empaquetado', orden: 8 },
    { fase: 'listo_entrega', orden: 9 },
  ]

  const { data, error } = await supabase
    .from('fases_produccion')
    .insert(
      fases.map((f) => ({
        pieza_id,
        fase: f.fase,
        orden: f.orden,
        estado: 'pendiente',
      }))
    )
    .select()

  if (error) throw error
  return data
}

/**
 * Obtener trazabilidad completa de una pieza
 */
export async function obtenerTrazabilidad(codigo_pieza: string) {
  const supabase = createClient()

  const { data: pieza, error: piezaError } = await supabase
    .from('piezas')
    .select(
      `
      *,
      pedidos: pedido_id (numero, estado, cliente_id),
      lotes: lote_id (codigo, estado),
      fases: fases_produccion(*)
    `
    )
    .eq('codigo', codigo_pieza)
    .single()

  if (piezaError) throw piezaError

  return {
    pieza,
    pedido: pieza.pedidos,
    lote: pieza.lotes,
    fases: pieza.fases,
    estado_actual: pieza.estado,
    fecha_creacion: pieza.created_at,
    fecha_actualizacion: pieza.updated_at,
  }
}

/**
 * Actualizar estado de pieza
 */
export async function actualizarEstadoPieza(
  pieza_id: string,
  estado: string,
  observaciones?: string
): Promise<Pieza> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('piezas')
    .update({
      estado,
      observaciones,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pieza_id)
    .select()
    .single()

  if (error) throw error
  return data as Pieza
}

/**
 * Marcar fase como completada
 */
export async function completarFase(
  fase_id: string,
  operario_id?: string,
  duracion_minutos?: number,
  observaciones?: string
): Promise<any> {
  const supabase = createClient()

  const ahora = new Date().toISOString()

  const { data, error } = await supabase
    .from('fases_produccion')
    .update({
      estado: 'completado',
      fin: ahora,
      operario_id,
      duracion_minutos,
      observaciones,
      validacion_ok: true,
    })
    .eq('id', fase_id)
    .select()
    .single()

  if (error) throw error

  // Actualizar fase_actual de la pieza
  const { data: fase } = await supabase
    .from('fases_produccion')
    .select('pieza_id')
    .eq('id', fase_id)
    .single()

  if (fase) {
    await supabase
      .from('piezas')
      .update({
        fase_actual: null,
        updated_at: ahora,
      })
      .eq('id', fase.pieza_id)
  }

  return data
}
