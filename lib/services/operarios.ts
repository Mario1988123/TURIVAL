// lib/services/operarios.ts
/**
 * Service de OPERARIOS — Capa 5 Producción
 *
 * Operarios son etiquetas visuales sin autenticación.
 * Representan a las personas del taller. Se asignan a tareas
 * como "candidatos" (N:M) y se registra cuál de ellos la ejecutó.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export interface Operario {
  id: string
  nombre: string
  rol: string | null
  color: string
  activo: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface OperarioInput {
  nombre: string
  rol?: string | null
  color?: string
  activo?: boolean
  notas?: string | null
}

// =============================================================
// CRUD
// =============================================================

export async function listarOperarios(incluirInactivos = false) {
  const supabase = await createClient()
  let q = supabase
    .from('operarios')
    .select('*')
    .order('nombre', { ascending: true })
  if (!incluirInactivos) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Operario[]
}

export async function listarOperariosPorRol(rol: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operarios')
    .select('*')
    .eq('activo', true)
    .eq('rol', rol)
    .order('nombre', { ascending: true })
  if (error) throw error
  return (data ?? []) as Operario[]
}

export async function obtenerOperario(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operarios')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Operario
}

export async function crearOperario(input: OperarioInput) {
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('El nombre es obligatorio')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operarios')
    .insert({
      nombre,
      rol: input.rol?.trim() || null,
      color: input.color?.trim() || '#64748b',
      activo: input.activo ?? true,
      notas: input.notas?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Operario
}

export async function actualizarOperario(
  id: string,
  input: Partial<OperarioInput>
) {
  const supabase = await createClient()
  const payload: any = {}
  if (input.nombre !== undefined) {
    const n = input.nombre.trim()
    if (!n) throw new Error('El nombre no puede quedar vacío')
    payload.nombre = n
  }
  if (input.rol !== undefined) payload.rol = input.rol?.trim() || null
  if (input.color !== undefined) payload.color = input.color?.trim() || '#64748b'
  if (input.activo !== undefined) payload.activo = input.activo
  if (input.notas !== undefined) payload.notas = input.notas?.trim() || null

  if (Object.keys(payload).length === 0) {
    throw new Error('No hay cambios que guardar')
  }

  const { data, error } = await supabase
    .from('operarios')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Operario
}

export async function eliminarOperario(id: string) {
  const supabase = await createClient()

  // Validar: ¿tiene tareas activas como ejecutor?
  const { count: enEjecucion, error: errEj } = await supabase
    .from('tareas_produccion')
    .select('*', { count: 'exact', head: true })
    .eq('operario_id', id)
    .in('estado', ['en_progreso', 'en_secado'])
  if (errEj) throw errEj
  if ((enEjecucion ?? 0) > 0) {
    throw new Error(
      `No se puede eliminar: el operario tiene ${enEjecucion} tarea${enEjecucion === 1 ? '' : 's'} en curso. Desactívalo en su lugar.`
    )
  }

  const { error } = await supabase.from('operarios').delete().eq('id', id)
  if (error) {
    // Si hay FK pendiente (tareas completadas con operario_id), Postgres
    // devuelve error 23503. En ese caso mejor desactivar.
    if ((error as any).code === '23503') {
      throw new Error(
        'No se puede eliminar: este operario tiene tareas históricas asignadas. Desactívalo para conservar la trazabilidad.'
      )
    }
    throw error
  }
}
