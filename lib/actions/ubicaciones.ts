// lib/actions/ubicaciones.ts
'use server'

/**
 * Server Actions de UBICACIONES (Capa 4 Pedidos, configuración)
 *
 * CRUD sobre tabla `ubicaciones`. Incluye validación: no se puede
 * eliminar una ubicación que tenga piezas asignadas (se obliga a
 * desactivar en su lugar, así se preserva la trazabilidad).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// =============================================================
// Tipos
// =============================================================

export type TipoUbicacion = 'carrito' | 'estanteria' | 'libre'

export interface Ubicacion {
  id: string
  codigo: string
  nombre: string
  tipo: TipoUbicacion
  capacidad_aprox: number | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UbicacionInput {
  codigo: string
  nombre: string
  tipo: TipoUbicacion
  capacidad_aprox?: number | null
  notas?: string | null
  activo?: boolean
}

// =============================================================
// Listar
// =============================================================

export async function accionListarUbicaciones() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('*')
      .order('codigo', { ascending: true })
    if (error) throw error
    return { ok: true as const, ubicaciones: (data ?? []) as Ubicacion[] }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando ubicaciones',
      ubicaciones: [] as Ubicacion[],
    }
  }
}

// =============================================================
// Crear
// =============================================================

export async function accionCrearUbicacion(input: UbicacionInput) {
  try {
    const codigo = input.codigo.trim().toUpperCase()
    const nombre = input.nombre.trim()
    if (!codigo) throw new Error('El código es obligatorio')
    if (!nombre) throw new Error('El nombre es obligatorio')
    if (!['carrito', 'estanteria', 'libre'].includes(input.tipo)) {
      throw new Error('Tipo no válido')
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ubicaciones')
      .insert({
        codigo,
        nombre,
        tipo: input.tipo,
        capacidad_aprox:
          input.capacidad_aprox != null && Number.isFinite(input.capacidad_aprox)
            ? input.capacidad_aprox
            : null,
        notas: input.notas?.trim() || null,
        activo: input.activo ?? true,
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe una ubicación con el código "${codigo}"`)
      }
      throw error
    }
    revalidatePath('/configuracion/ubicaciones')
    return { ok: true as const, ubicacion: data as Ubicacion }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al crear ubicación',
    }
  }
}

// =============================================================
// Actualizar
// =============================================================

export async function accionActualizarUbicacion(
  id: string,
  input: Partial<UbicacionInput>
) {
  try {
    const supabase = await createClient()
    const payload: any = {}

    if (input.codigo !== undefined) {
      const c = input.codigo.trim().toUpperCase()
      if (!c) throw new Error('El código no puede quedar vacío')
      payload.codigo = c
    }
    if (input.nombre !== undefined) {
      const n = input.nombre.trim()
      if (!n) throw new Error('El nombre no puede quedar vacío')
      payload.nombre = n
    }
    if (input.tipo !== undefined) {
      if (!['carrito', 'estanteria', 'libre'].includes(input.tipo)) {
        throw new Error('Tipo no válido')
      }
      payload.tipo = input.tipo
    }
    if (input.capacidad_aprox !== undefined) {
      payload.capacidad_aprox =
        input.capacidad_aprox != null && Number.isFinite(input.capacidad_aprox)
          ? input.capacidad_aprox
          : null
    }
    if (input.notas !== undefined) {
      payload.notas = input.notas?.trim() || null
    }
    if (input.activo !== undefined) {
      payload.activo = input.activo
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('No hay cambios que guardar')
    }

    const { data, error } = await supabase
      .from('ubicaciones')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe una ubicación con ese código')
      }
      throw error
    }
    revalidatePath('/configuracion/ubicaciones')
    return { ok: true as const, ubicacion: data as Ubicacion }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al actualizar ubicación',
    }
  }
}

// =============================================================
// Eliminar (con validación de piezas asignadas)
// =============================================================

export async function accionEliminarUbicacion(id: string) {
  try {
    const supabase = await createClient()

    const { count, error: errCount } = await supabase
      .from('piezas')
      .select('*', { count: 'exact', head: true })
      .eq('ubicacion_id', id)
    if (errCount) throw errCount
    if ((count ?? 0) > 0) {
      throw new Error(
        `No se puede eliminar: hay ${count} pieza${count === 1 ? '' : 's'} en esta ubicación. Desactívala en su lugar para conservar la trazabilidad.`
      )
    }

    const { error } = await supabase.from('ubicaciones').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/configuracion/ubicaciones')
    return { ok: true as const }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error al eliminar ubicación',
    }
  }
}
