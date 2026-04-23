// lib/services/config-tiempos.ts

/**
 * Service de CONFIGURACIÓN DE TIEMPOS POR PROCESO
 *
 * Gestiona la tabla config_tiempos_proceso creada en el script 028.
 * Esta tabla contiene, por cada proceso (y opcionalmente por cada
 * categoría de pieza), los tiempos que usa el motor ERP v2 para
 * calcular las tareas de producción al confirmar un pedido.
 *
 * En esta iteración (2 del nudo P+2B) sólo exponemos la lectura y
 * edición de las filas GLOBALES (categoria_pieza_id = NULL). Las
 * específicas por categoría se añadirán cuando se necesiten.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export interface ConfigTiempoProceso {
  id: string
  proceso_id: string
  categoria_pieza_id: string | null
  tiempo_base_min: number
  tiempo_por_m2_min: number
  tiempo_por_ml_min: number
  created_at: string
  updated_at: string
}

/** Fila combinada con información del proceso para mostrar en la UI. */
export interface ConfigTiempoProcesoConProceso extends ConfigTiempoProceso {
  proceso: {
    id: string
    codigo: string
    nombre: string
    orden_tipico: number
    activo: boolean
  } | null
}

export interface GuardarTiempoGlobalInput {
  proceso_id: string
  tiempo_base_min: number
  tiempo_por_m2_min: number
  tiempo_por_ml_min: number
}

// =============================================================
// LISTADO GLOBAL (categoria_pieza_id = NULL)
// =============================================================

/**
 * Devuelve las filas globales (una por proceso activo) ya con el
 * proceso embebido. Si falta alguna fila para un proceso, la crea
 * al vuelo con ceros para que la UI siempre tenga las 9 filas.
 *
 * El orden es el `orden_tipico` del proceso.
 */
export async function listarTiemposGlobales(): Promise<
  ConfigTiempoProcesoConProceso[]
> {
  const supabase = await createClient()

  // 1. Todos los procesos activos (son la fuente de verdad)
  const { data: procesos, error: errP } = await supabase
    .from('procesos_catalogo')
    .select('id, codigo, nombre, orden_tipico, activo')
    .eq('activo', true)
    .order('orden_tipico', { ascending: true })
  if (errP) throw errP

  const procesosArr = (procesos ?? []) as Array<{
    id: string
    codigo: string
    nombre: string
    orden_tipico: number
    activo: boolean
  }>

  if (procesosArr.length === 0) return []

  // 2. Filas globales existentes
  const { data: tiempos, error: errT } = await supabase
    .from('config_tiempos_proceso')
    .select('*')
    .is('categoria_pieza_id', null)
  if (errT) throw errT

  const tiemposByProceso = new Map<string, ConfigTiempoProceso>(
    ((tiempos ?? []) as ConfigTiempoProceso[]).map((t) => [t.proceso_id, t])
  )

  // 3. Para cada proceso, buscamos su fila. Si no existe, creamos
  //    una fila con ceros para que la UI pueda editarla (el INSERT
  //    real ocurre la primera vez que el usuario guarda).
  const resultado: ConfigTiempoProcesoConProceso[] = procesosArr.map((p) => {
    const existente = tiemposByProceso.get(p.id)
    if (existente) {
      return {
        ...existente,
        proceso: p,
      }
    }
    // Fila "fantasma" — aún no existe en BD.
    return {
      id: '', // vacío indica "aún no persistida"
      proceso_id: p.id,
      categoria_pieza_id: null,
      tiempo_base_min: 0,
      tiempo_por_m2_min: 0,
      tiempo_por_ml_min: 0,
      created_at: '',
      updated_at: '',
      proceso: p,
    }
  })

  return resultado
}

// =============================================================
// GUARDAR (upsert) una fila global
// =============================================================

/**
 * Inserta o actualiza la fila global para un proceso. Devuelve la
 * fila actualizada. Valida que los tiempos no sean negativos.
 */
export async function guardarTiempoGlobal(
  input: GuardarTiempoGlobalInput
): Promise<ConfigTiempoProceso> {
  if (!input.proceso_id) {
    throw new Error('proceso_id es obligatorio')
  }
  if (
    !Number.isFinite(input.tiempo_base_min) ||
    !Number.isFinite(input.tiempo_por_m2_min) ||
    !Number.isFinite(input.tiempo_por_ml_min) ||
    input.tiempo_base_min < 0 ||
    input.tiempo_por_m2_min < 0 ||
    input.tiempo_por_ml_min < 0
  ) {
    throw new Error('Los tiempos deben ser números mayores o iguales a 0')
  }

  const supabase = await createClient()

  // ¿Hay ya una fila global para este proceso?
  const { data: existente, error: errE } = await supabase
    .from('config_tiempos_proceso')
    .select('id')
    .eq('proceso_id', input.proceso_id)
    .is('categoria_pieza_id', null)
    .maybeSingle()
  if (errE) throw errE

  const payload = {
    proceso_id: input.proceso_id,
    categoria_pieza_id: null as string | null,
    tiempo_base_min: input.tiempo_base_min,
    tiempo_por_m2_min: input.tiempo_por_m2_min,
    tiempo_por_ml_min: input.tiempo_por_ml_min,
    updated_at: new Date().toISOString(),
  }

  if (existente && (existente as any).id) {
    const { data, error } = await supabase
      .from('config_tiempos_proceso')
      .update(payload)
      .eq('id', (existente as any).id)
      .select()
      .single()
    if (error) throw error
    return data as ConfigTiempoProceso
  } else {
    const { data, error } = await supabase
      .from('config_tiempos_proceso')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as ConfigTiempoProceso
  }
}
