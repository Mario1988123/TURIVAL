/**
 * lib/services/categorias-pieza.ts
 * ================================================================
 * Servicio de categorías de pieza. Creado en R2b.
 * Tabla `categorias_pieza` creada por el script 018 con 6 seeds:
 * Zócalos, Puertas, Mueble cocina, Mobiliario, Listones, Irregular.
 * ================================================================
 */

import { createClient } from './client'
import type { CategoriaPieza } from '../types/erp'

export async function listarCategoriasPieza(
  activas_solo: boolean = true
): Promise<CategoriaPieza[]> {
  const supabase = createClient()
  let query = supabase
    .from('categorias_pieza')
    .select('*')
    .order('orden')

  if (activas_solo) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CategoriaPieza[]
}

export async function obtenerCategoriaPieza(id: string): Promise<CategoriaPieza> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_pieza')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as CategoriaPieza
}

export async function buscarCategoriaPorCodigo(
  codigo: string
): Promise<CategoriaPieza | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_pieza')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle()
  if (error) throw error
  return data as CategoriaPieza | null
}

export async function crearCategoriaPieza(
  datos: Omit<CategoriaPieza, 'id' | 'created_at' | 'updated_at'>
): Promise<CategoriaPieza> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_pieza')
    .insert(datos)
    .select()
    .single()
  if (error) throw error
  return data as CategoriaPieza
}

export async function actualizarCategoriaPieza(
  id: string,
  datos: Partial<Omit<CategoriaPieza, 'id' | 'created_at' | 'updated_at'>>
): Promise<CategoriaPieza> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_pieza')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CategoriaPieza
}
