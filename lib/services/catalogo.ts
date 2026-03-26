import { createClient } from './client'
import type { Producto, Color, Tratamiento, Acabado, Tarifa } from '../types/erp'

/**
 * ========== PRODUCTOS ==========
 */

export async function crearProducto(
  datos: Omit<Producto, 'id' | 'created_at'>
): Promise<Producto> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

export async function listarProductos(activos_solo: boolean = true) {
  const supabase = createClient()

  let query = supabase.from('productos').select('*').order('nombre')

  if (activos_solo) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as Producto[]
}

export async function obtenerProducto(producto_id: string): Promise<Producto> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', producto_id)
    .single()

  if (error) throw error
  return data as Producto
}

export async function actualizarProducto(
  producto_id: string,
  datos: Partial<Omit<Producto, 'id' | 'created_at'>>
): Promise<Producto> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .update(datos)
    .eq('id', producto_id)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

/**
 * ========== COLORES ==========
 */

export async function crearColor(datos: Omit<Color, 'id' | 'created_at'>): Promise<Color> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('colores')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Color
}

export async function listarColores(
  filtros: { tipo?: string; activos_solo?: boolean } = {}
) {
  const supabase = createClient()

  let query = supabase.from('colores').select('*').order('codigo')

  if (filtros.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros.activos_solo !== false) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as Color[]
}

export async function obtenerColor(color_id: string): Promise<Color> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('colores')
    .select('*')
    .eq('id', color_id)
    .single()

  if (error) throw error
  return data as Color
}

export async function buscarColorPorCodigo(codigo: string): Promise<Color | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('colores')
    .select('*')
    .eq('codigo', codigo)
    .single()

  if (error || !data) return null
  return data as Color
}

export async function actualizarColor(
  color_id: string,
  datos: Partial<Omit<Color, 'id' | 'created_at'>>
): Promise<Color> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('colores')
    .update(datos)
    .eq('id', color_id)
    .select()
    .single()

  if (error) throw error
  return data as Color
}

/**
 * ========== TRATAMIENTOS ==========
 */

export async function crearTratamiento(
  datos: Omit<Tratamiento, 'id' | 'created_at'>
): Promise<Tratamiento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tratamientos')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Tratamiento
}

export async function listarTratamientos(activos_solo: boolean = true) {
  const supabase = createClient()

  let query = supabase.from('tratamientos').select('*').order('nombre')

  if (activos_solo) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as Tratamiento[]
}

export async function obtenerTratamiento(tratamiento_id: string): Promise<Tratamiento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tratamientos')
    .select('*')
    .eq('id', tratamiento_id)
    .single()

  if (error) throw error
  return data as Tratamiento
}

export async function actualizarTratamiento(
  tratamiento_id: string,
  datos: Partial<Omit<Tratamiento, 'id' | 'created_at'>>
): Promise<Tratamiento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tratamientos')
    .update(datos)
    .eq('id', tratamiento_id)
    .select()
    .single()

  if (error) throw error
  return data as Tratamiento
}

/**
 * ========== ACABADOS ==========
 */

export async function crearAcabado(datos: Omit<Acabado, 'id' | 'created_at'>): Promise<Acabado> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('acabados')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Acabado
}

export async function listarAcabados(activos_solo: boolean = true) {
  const supabase = createClient()

  let query = supabase
    .from('acabados')
    .select(
      `
      *,
      colores: color_id (codigo, nombre, hex_aproximado),
      tratamientos: tratamiento_id (nombre)
    `
    )
    .order('codigo')

  if (activos_solo) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as any[]
}

export async function obtenerAcabado(acabado_id: string): Promise<Acabado> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('acabados')
    .select(
      `
      *,
      colores: color_id (codigo, nombre, hex_aproximado),
      tratamientos: tratamiento_id (nombre)
    `
    )
    .eq('id', acabado_id)
    .single()

  if (error) throw error
  return data as Acabado
}

export async function actualizarAcabado(
  acabado_id: string,
  datos: Partial<Omit<Acabado, 'id' | 'created_at'>>
): Promise<Acabado> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('acabados')
    .update(datos)
    .eq('id', acabado_id)
    .select()
    .single()

  if (error) throw error
  return data as Acabado
}

/**
 * ========== TARIFAS ==========
 */

export async function crearTarifa(datos: Omit<Tarifa, 'id' | 'created_at' | 'updated_at'>): Promise<Tarifa> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tarifas')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Tarifa
}

export async function listarTarifas(
  filtros: { producto_id?: string; activos_solo?: boolean } = {}
) {
  const supabase = createClient()

  let query = supabase.from('tarifas').select('*').order('nombre')

  if (filtros.producto_id) {
    query = query.eq('producto_id', filtros.producto_id)
  }

  if (filtros.activos_solo !== false) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as Tarifa[]
}

export async function obtenerTarifa(tarifa_id: string): Promise<Tarifa> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tarifas')
    .select('*')
    .eq('id', tarifa_id)
    .single()

  if (error) throw error
  return data as Tarifa
}

export async function actualizarTarifa(
  tarifa_id: string,
  datos: Partial<Omit<Tarifa, 'id' | 'created_at' | 'updated_at'>>
): Promise<Tarifa> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tarifas')
    .update({
      ...datos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tarifa_id)
    .select()
    .single()

  if (error) throw error
  return data as Tarifa
}

/**
 * ========== GESTIÓN DE CATÁLOGOS ==========
 */

/**
 * Obtener catálogo completo para crear presupuestos
 */
export async function obtenerCatalogoPrecio() {
  const [productos, colores, tratamientos, acabados, tarifas] = await Promise.all([
    listarProductos(true),
    listarColores({ activos_solo: true }),
    listarTratamientos(true),
    listarAcabados(true),
    listarTarifas({ activos_solo: true }),
  ])

  return {
    productos,
    colores,
    tratamientos,
    acabados,
    tarifas,
  }
}
