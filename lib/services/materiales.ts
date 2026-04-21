/**
 * lib/services/materiales.ts
 * ================================================================
 * Servicio de materiales (lacado, fondo, catalizador, disolvente).
 * Creado en R2a del rediseño ERP TURIVAL.
 *
 * La tabla `colores` vieja se renombró a `colores_legacy` (R1/019)
 * y todos los colores se migraron a esta tabla `materiales` con
 * tipo='lacado'. Las funciones de catalogo.ts que siguen exponiendo
 * la interfaz `Color` internamente usan este servicio.
 * ================================================================
 */

import { createClient } from './client'
import type {
  Material,
  MaterialConProveedor,
  Proveedor,
  TipoMaterial,
} from '../types/erp'

// =================================================================
// LISTADO
// =================================================================

export async function listarMateriales(filtros: {
  tipo?: TipoMaterial
  activos_solo?: boolean
  con_proveedor?: boolean
  busqueda?: string
} = {}): Promise<MaterialConProveedor[]> {
  const supabase = createClient()

  const selectClause = filtros.con_proveedor !== false
    ? '*, proveedor:proveedores(id, nombre, tipo_material, precio_base_kg)'
    : '*'

  let query = supabase
    .from('materiales')
    .select(selectClause)
    .order('codigo', { ascending: true, nullsFirst: false })
    .range(0, 9999)

  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.activos_solo !== false) query = query.eq('activo', true)

  if (filtros.busqueda && filtros.busqueda.trim()) {
    const q = filtros.busqueda.trim()
    query = query.or(
      `codigo.ilike.%${q}%,nombre.ilike.%${q}%,familia.ilike.%${q}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as MaterialConProveedor[]
}

/** Atajo: lista solo lacados activos (lo que antes era "colores"). */
export async function listarLacados(busqueda?: string): Promise<MaterialConProveedor[]> {
  return listarMateriales({ tipo: 'lacado', activos_solo: true, busqueda })
}

/** Atajo: lista solo fondos activos. */
export async function listarFondos(): Promise<MaterialConProveedor[]> {
  return listarMateriales({ tipo: 'fondo', activos_solo: true })
}

/** Atajo: lista solo catalizadores activos. */
export async function listarCatalizadores(): Promise<MaterialConProveedor[]> {
  return listarMateriales({ tipo: 'catalizador', activos_solo: true })
}

/** Atajo: lista solo disolventes activos. */
export async function listarDisolventes(): Promise<MaterialConProveedor[]> {
  return listarMateriales({ tipo: 'disolvente', activos_solo: true })
}

// =================================================================
// OBTENER
// =================================================================

export async function obtenerMaterial(id: string): Promise<MaterialConProveedor> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('materiales')
    .select('*, proveedor:proveedores(id, nombre, tipo_material, precio_base_kg)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as MaterialConProveedor
}

export async function buscarMaterialPorCodigo(
  tipo: TipoMaterial,
  codigo: string
): Promise<MaterialConProveedor | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('materiales')
    .select('*, proveedor:proveedores(id, nombre, tipo_material, precio_base_kg)')
    .eq('tipo', tipo)
    .eq('codigo', codigo)
    .maybeSingle()
  if (error) throw error
  return data as unknown as MaterialConProveedor | null
}

// =================================================================
// CRUD
// =================================================================

export async function crearMaterial(
  datos: Omit<Material, 'id' | 'created_at' | 'updated_at' |
                        'stock_fisico_kg' | 'stock_reservado_kg'>
    & Partial<Pick<Material, 'stock_fisico_kg' | 'stock_reservado_kg'>>
): Promise<Material> {
  const supabase = createClient()
  const payload = {
    ...datos,
    stock_fisico_kg:    datos.stock_fisico_kg ?? 0,
    stock_reservado_kg: datos.stock_reservado_kg ?? 0,
  }
  const { data, error } = await supabase
    .from('materiales')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as Material
}

export async function actualizarMaterial(
  id: string,
  datos: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at' |
                                 'stock_fisico_kg' | 'stock_reservado_kg'>>
): Promise<Material> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('materiales')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Material
}

export async function cambiarActivoMaterial(
  id: string,
  activo: boolean
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('materiales')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// =================================================================
// HELPERS DE NEGOCIO
// =================================================================

/**
 * Precio final €/kg de un material. Si tiene precio_kg_sobrescrito
 * se usa ese, si no se usa el precio_base_kg del proveedor.
 */
export function resolverPrecioKg(material: MaterialConProveedor): number {
  if (material.precio_kg_sobrescrito != null) {
    return Number(material.precio_kg_sobrescrito)
  }
  return Number(material.proveedor?.precio_base_kg ?? 0)
}

/**
 * Rendimiento kg/m² de un material de lacado o fondo. Si el material
 * tiene rendimiento_kg_m2_sobrescrito se usa ese, si no el global
 * de ConfigErp según el tipo.
 */
export function resolverRendimientoKgM2(
  material: Pick<Material, 'tipo' | 'rendimiento_kg_m2_sobrescrito'>,
  config: { rendimiento_lacado_kg_m2: number; rendimiento_fondo_kg_m2: number }
): number {
  if (material.rendimiento_kg_m2_sobrescrito != null) {
    return Number(material.rendimiento_kg_m2_sobrescrito)
  }
  if (material.tipo === 'lacado') return Number(config.rendimiento_lacado_kg_m2)
  if (material.tipo === 'fondo')  return Number(config.rendimiento_fondo_kg_m2)
  return 0
}

/**
 * Materiales bajo stock mínimo (útil para R3: alertas en sidebar).
 * Un material se considera bajo mínimo cuando stock_fisico_kg <
 * stock_minimo_kg y stock_minimo_kg > 0.
 */
export async function listarMaterialesBajoMinimo(): Promise<MaterialConProveedor[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('materiales')
    .select('*, proveedor:proveedores(id, nombre, tipo_material, precio_base_kg)')
    .eq('activo', true)
    .gt('stock_minimo_kg', 0)
    .order('tipo')
    .order('nombre')
  if (error) throw error
  const rows = (data ?? []) as unknown as MaterialConProveedor[]
  return rows.filter(m => Number(m.stock_fisico_kg) < Number(m.stock_minimo_kg))
}
