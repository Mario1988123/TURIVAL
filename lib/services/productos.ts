import { createClient } from '../supabase/client'
import type { Producto, ProcesoCatalogo } from '../types/erp'

// ============================================================================
// TIPOS
// ============================================================================

export interface ProductoForm {
  nombre: string
  categoria: string | null
  descripcion: string | null
  unidad_tarificacion: 'm2' | 'pieza'
  activo: boolean
}

export interface ProcesoProductoDetalle {
  id: string
  producto_id: string
  proceso_id: string
  secuencia: number
  tiempo_base_minutos: number
  tiempo_por_m2_minutos: number
  factor_simple: number
  factor_media: number
  factor_compleja: number
  es_opcional: boolean
  depende_de_secuencia: number | null
  notas: string | null
  activo: boolean
  proceso: {
    id: string
    codigo: string
    nombre: string
    orden_tipico: number
    color_gantt: string
  }
}

// ============================================================================
// CRUD PRODUCTOS
// ============================================================================

export async function listarProductos(soloActivos = false): Promise<Producto[]> {
  const supabase = createClient()
  let q = supabase.from('productos').select('*').order('nombre')
  if (soloActivos) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Producto[]
}

export async function obtenerProducto(id: string): Promise<Producto | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Producto | null
}

export async function crearProducto(datos: ProductoForm): Promise<Producto> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert(datos)
    .select('*')
    .single()
  if (error) throw error
  return data as Producto
}

export async function actualizarProducto(
  id: string,
  cambios: Partial<ProductoForm>
): Promise<Producto> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('productos')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Producto
}

export async function eliminarProducto(id: string): Promise<void> {
  const supabase = createClient()
  // Borrar primero los procesos asociados
  await supabase.from('procesos_producto').delete().eq('producto_id', id)
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// PROCESOS POR PRODUCTO
// ============================================================================

export async function listarProcesosCatalogo(): Promise<ProcesoCatalogo[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('procesos_catalogo')
    .select('*')
    .eq('activo', true)
    .order('orden_tipico')
  if (error) throw error
  return (data ?? []) as ProcesoCatalogo[]
}

export async function listarProcesosDeProducto(
  productoId: string
): Promise<ProcesoProductoDetalle[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('procesos_producto')
    .select(
      `
      *,
      proceso:procesos_catalogo (
        id, codigo, nombre, orden_tipico, color_gantt
      )
    `
    )
    .eq('producto_id', productoId)
    .order('secuencia')
  if (error) throw error
  return (data ?? []) as unknown as ProcesoProductoDetalle[]
}

export interface ProcesoProductoForm {
  proceso_id: string
  secuencia: number
  tiempo_base_minutos: number
  tiempo_por_m2_minutos: number
  factor_simple: number
  factor_media: number
  factor_compleja: number
  es_opcional: boolean
  depende_de_secuencia: number | null
  notas: string | null
}

export async function guardarProcesosDeProducto(
  productoId: string,
  procesos: ProcesoProductoForm[]
): Promise<void> {
  const supabase = createClient()
  // Estrategia simple: borrar todos los de este producto y recrear
  await supabase.from('procesos_producto').delete().eq('producto_id', productoId)
  if (procesos.length === 0) return
  const filas = procesos.map((p) => ({
    producto_id: productoId,
    proceso_id: p.proceso_id,
    secuencia: p.secuencia,
    tiempo_base_minutos: p.tiempo_base_minutos,
    tiempo_por_m2_minutos: p.tiempo_por_m2_minutos,
    factor_simple: p.factor_simple,
    factor_media: p.factor_media,
    factor_compleja: p.factor_compleja,
    es_opcional: p.es_opcional,
    depende_de_secuencia: p.depende_de_secuencia,
    notas: p.notas,
    activo: true,
  }))
  const { error } = await supabase.from('procesos_producto').insert(filas)
  if (error) throw error
}

// ============================================================================
// LÓGICA DE APRENDIZAJE (reemplaza la función PL/pgSQL que falla en Supabase)
// ============================================================================

/**
 * Estima tiempo en minutos para un proceso concreto.
 * Si hay >=3 registros históricos del mismo producto+proceso+complejidad,
 * usa la media de las últimas 10 ejecuciones reales (aprendizaje).
 * Si no, usa el tiempo configurado en procesos_producto con el multiplicador.
 */
export async function estimarTiempoProceso(params: {
  productoId: string
  procesoId: string
  nivelComplejidadId: number | null
  superficieM2: number
}): Promise<number> {
  const supabase = createClient()
  const { productoId, procesoId, nivelComplejidadId, superficieM2 } = params

  // 1) Contar registros históricos
  const { count } = await supabase
    .from('historial_tiempos_proceso')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId)
    .eq('proceso_id', procesoId)
    .eq('nivel_complejidad', nivelComplejidadId ?? 0)

  // 2) Si hay suficientes, usar media de últimas 10 ejecuciones
  if ((count ?? 0) >= 3) {
    const { data } = await supabase
      .from('historial_tiempos_proceso')
      .select('tiempo_real_minutos')
      .eq('producto_id', productoId)
      .eq('proceso_id', procesoId)
      .eq('nivel_complejidad', nivelComplejidadId ?? 0)
      .order('fecha_ejecucion', { ascending: false })
      .limit(10)

    const tiempos = (data ?? []).map((r: any) => Number(r.tiempo_real_minutos))
    if (tiempos.length > 0) {
      const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
      return Math.round(media * 100) / 100
    }
  }

  // 3) Sin histórico, usar tiempo configurado
  const { data: configData } = await supabase
    .from('procesos_producto')
    .select('tiempo_base_minutos, tiempo_por_m2_minutos')
    .eq('producto_id', productoId)
    .eq('proceso_id', procesoId)
    .eq('activo', true)
    .maybeSingle()

  if (!configData) return 0

  // 4) Obtener multiplicador de complejidad
  let mult = 1
  if (nivelComplejidadId) {
    const { data: nc } = await supabase
      .from('niveles_complejidad')
      .select('multiplicador')
      .eq('id', nivelComplejidadId)
      .maybeSingle()
    if (nc?.multiplicador) mult = Number(nc.multiplicador)
  }

  const base = Number(configData.tiempo_base_minutos ?? 0)
  const porM2 = Number(configData.tiempo_por_m2_minutos ?? 0)
  const total = (base + porM2 * (superficieM2 ?? 0)) * mult
  return Math.round(total * 100) / 100
}

/**
 * Registra en el historial el tiempo real de una tarea completada.
 * Se llama desde el módulo de producción cuando se cierra una tarea.
 */
export async function registrarTiempoRealEnHistorial(params: {
  tareaId: string
  productoId: string
  procesoId: string
  nivelComplejidadId: number | null
  superficieM2: number
  tiempoRealMinutos: number
  tiempoEstimadoMinutos: number | null
  empleadoId: string | null
  huboIncidencia: boolean
  notas?: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('historial_tiempos_proceso').insert({
    tarea_id: params.tareaId,
    producto_id: params.productoId,
    proceso_id: params.procesoId,
    nivel_complejidad: params.nivelComplejidadId,
    superficie_m2: params.superficieM2,
    tiempo_real_minutos: params.tiempoRealMinutos,
    tiempo_estimado_minutos: params.tiempoEstimadoMinutos,
    empleado_id: params.empleadoId,
    hubo_incidencia: params.huboIncidencia,
    notas: params.notas,
  })
  if (error) throw error
}
