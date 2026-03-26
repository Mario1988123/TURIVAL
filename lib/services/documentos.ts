import { createClient } from './client'
import type { Albaran, Pieza } from '../types/erp'
import { obtenerSiguienteNumero } from './presupuestos'

/**
 * Crear albarán para entrega de pedido
 */
export async function crearAlbaran(
  pedido_id: string,
  cliente_id: string,
  piezas_ids: string[],
  observaciones?: string
): Promise<Albaran> {
  const supabase = createClient()
  const numero = await obtenerSiguienteNumero('albaran')

  const { data, error } = await supabase
    .from('albaranes')
    .insert({
      numero,
      pedido_id,
      cliente_id,
      estado: 'borrador',
      fecha_entrega: new Date().toISOString().split('T')[0],
      observaciones,
    })
    .select()
    .single()

  if (error) throw error

  // Crear líneas de albarán desde piezas
  const lineas = piezas_ids.map((pieza_id) => ({
    albaran_id: data.id,
    pieza_id,
    cantidad: 1,
  }))

  await supabase.from('lineas_albaran').insert(lineas)

  return data as Albaran
}

/**
 * Datos para generar etiqueta QR imprimible
 */
export interface DatosEtiquetaQR {
  codigo_pieza: string
  qr_data: string
  cliente_nombre: string
  referencia_cliente: string
  descripcion_acabado: string
  dimensiones: string
  cantidad: number
  fecha_creacion: string
}

/**
 * Obtener datos para etiqueta QR de una pieza
 */
export async function obtenerDatosEtiquetaQR(pieza_id: string): Promise<DatosEtiquetaQR> {
  const supabase = createClient()

  const { data: pieza, error } = await supabase
    .from('piezas')
    .select(
      `
      codigo,
      qr_data,
      cliente_id,
      referencia_cliente,
      acabado_texto,
      ancho,
      alto,
      grosor,
      cantidad,
      created_at,
      clientes: cliente_id (nombre_comercial)
    `
    )
    .eq('id', pieza_id)
    .single()

  if (error) throw error

  const dimensiones = `${pieza.ancho || 0}mm × ${pieza.alto || 0}mm`

  return {
    codigo_pieza: pieza.codigo,
    qr_data: pieza.qr_data,
    cliente_nombre: pieza.clientes.nombre_comercial,
    referencia_cliente: pieza.referencia_cliente || 'N/A',
    descripcion_acabado: pieza.acabado_texto || 'Estándar',
    dimensiones,
    cantidad: pieza.cantidad || 1,
    fecha_creacion: pieza.created_at.split('T')[0],
  }
}

/**
 * Estructura para albarán imprimible
 */
export interface DatosAlbaranImprimible {
  numero: string
  fecha: string
  cliente: {
    nombre: string
    direccion: string
    ciudad: string
    cif: string
  }
  piezas: Array<{
    codigo: string
    referencia_cliente: string
    cantidad: number
    descripcion: string
  }>
  observaciones: string
}

/**
 * Obtener datos completos para imprimir albarán
 */
export async function obtenerDatosAlbaranImprimible(
  albaran_id: string
): Promise<DatosAlbaranImprimible> {
  const supabase = createClient()

  const { data: albaran, error: albaranError } = await supabase
    .from('albaranes')
    .select(
      `
      numero,
      fecha_entrega,
      observaciones,
      cliente_id,
      clientes: cliente_id (nombre_comercial, direccion, ciudad, cif_nif),
      lineas_albaran (
        cantidad,
        piezas: pieza_id (
          codigo,
          referencia_cliente,
          acabado_texto
        )
      )
    `
    )
    .eq('id', albaran_id)
    .single()

  if (albaranError) throw albaranError

  return {
    numero: albaran.numero,
    fecha: albaran.fecha_entrega,
    cliente: {
      nombre: albaran.clientes.nombre_comercial,
      direccion: albaran.clientes.direccion || '',
      ciudad: albaran.clientes.ciudad || '',
      cif: albaran.clientes.cif_nif || '',
    },
    piezas: albaran.lineas_albaran.map((linea: any) => ({
      codigo: linea.piezas?.codigo || 'N/A',
      referencia_cliente: linea.piezas?.referencia_cliente || '',
      cantidad: linea.cantidad,
      descripcion: linea.piezas?.acabado_texto || 'Lacado',
    })),
    observaciones: albaran.observaciones || '',
  }
}

/**
 * Marcar albarán como impreso
 */
export async function marcarAlbaranImpreso(albaran_id: string): Promise<Albaran> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('albaranes')
    .update({
      estado: 'impreso',
    })
    .eq('id', albaran_id)
    .select()
    .single()

  if (error) throw error
  return data as Albaran
}

/**
 * Marcar albarán como entregado (con firma del cliente)
 */
export async function marcarAlbaranEntregado(
  albaran_id: string,
  firma_cliente?: string
): Promise<Albaran> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('albaranes')
    .update({
      estado: 'entregado',
      firma_cliente,
    })
    .eq('id', albaran_id)
    .select()
    .single()

  if (error) throw error

  // Actualizar todas las piezas del albarán como entregadas
  const { data: lineas } = await supabase
    .from('lineas_albaran')
    .select('pieza_id')
    .eq('albaran_id', albaran_id)

  if (lineas) {
    const pieza_ids = lineas
      .map((l: any) => l.pieza_id)
      .filter(Boolean)

    if (pieza_ids.length > 0) {
      await supabase
        .from('piezas')
        .update({ estado: 'entregado' })
        .in('id', pieza_ids)
    }
  }

  return data as Albaran
}

/**
 * Obtener albaranes listos para imprimir
 */
export async function obtenerAlbaranesParaImprimir(pedido_id?: string) {
  const supabase = createClient()

  let query = supabase
    .from('albaranes')
    .select(
      `
      *,
      clientes: cliente_id (nombre_comercial),
      pedidos: pedido_id (numero)
    `
    )
    .eq('estado', 'borrador')
    .order('created_at', { ascending: false })

  if (pedido_id) {
    query = query.eq('pedido_id', pedido_id)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}
