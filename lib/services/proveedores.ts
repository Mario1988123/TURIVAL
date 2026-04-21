/**
 * lib/services/proveedores.ts
 * ================================================================
 * Servicio de proveedores de materiales. Creado en R2a.
 * Seed inicial (019): 3 lacado + 3 fondo + 1 cata + 1 dis como
 * placeholder. Mario los renombra en /configuracion/proveedores (R3).
 * ================================================================
 */

import { createClient } from './client'
import type { Proveedor, TipoMaterial } from '../types/erp'

export async function listarProveedores(
  filtros: { tipo?: TipoMaterial; activos_solo?: boolean } = {}
): Promise<Proveedor[]> {
  const supabase = createClient()
  let query = supabase
    .from('proveedores')
    .select('*')
    .order('tipo_material')
    .order('nombre')

  if (filtros.tipo) query = query.eq('tipo_material', filtros.tipo)
  if (filtros.activos_solo !== false) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Proveedor[]
}

export async function obtenerProveedor(id: string): Promise<Proveedor> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Proveedor
}

export async function crearProveedor(
  datos: Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>
): Promise<Proveedor> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .insert(datos)
    .select()
    .single()
  if (error) throw error
  return data as Proveedor
}

export async function actualizarProveedor(
  id: string,
  datos: Partial<Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>>
): Promise<Proveedor> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Proveedor
}

export async function cambiarActivoProveedor(
  id: string,
  activo: boolean
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('proveedores')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
