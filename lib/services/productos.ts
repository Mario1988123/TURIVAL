import { createClient } from '../supabase/client'
import type { Producto, ProcesoCatalogo } from '../types/erp'

// ============================================================================
// TIPOS
// ============================================================================

export interface ProductoForm {
  nombre: string
  categoria: string | null
  categoria_id: string | null
  descripcion: string | null
  unidad_tarificacion: 'm2' | 'pieza'
  activo: boolean
}

export interface ProcesoCatalogoExt extends ProcesoCatalogo {
  escala_por_m2: boolean
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
  proceso: ProcesoCatalogoExt
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

/**
 * Crea un producto. Si se pasa auto_cargar_procesos=true, precargarán los
 * procesos estándar de Turiaval (los 9 pasos del flujo de lacado).
 */
export async function crearProducto(
  datos: ProductoForm,
  opciones: { auto_cargar_procesos?: boolean } = {}
): Promise<Producto> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert(datos)
    .select('*')
    .single()
  if (error) throw error

  const producto = data as Producto

  if (opciones.auto_cargar_procesos !== false) {
    await precargarProcesosEstandar(producto.id)
  }

  return producto
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
  await supabase.from('procesos_producto').delete().eq('producto_id', id)
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// AUTO-CARGA DE PROCESOS ESTÁNDAR
// ============================================================================

/**
 * Flujo estándar Turiaval — los 9 pasos de producción.
 * Se precargan al crear un producto nuevo para que Mario solo tenga que
 * ajustar tiempos en vez de construir el flujo desde cero.
 *
 * Valores por defecto (minutos):
 * - Procesos administrativos: tiempo base bajo, tiempo/m² = 0
 * - Procesos físicos: tiempo base moderado + tiempo/m² según tipo
 *
 * Mario ajusta después. El sistema de aprendizaje refinará con datos reales.
 */
const PLANTILLA_PROCESOS_ESTANDAR: Array<{
  codigo: string
  secuencia: number
  tiempo_base_minutos: number
  tiempo_por_m2_minutos: number
  factor_simple: number
  factor_media: number
  factor_compleja: number
  es_opcional: boolean
  depende_de_secuencia: number | null
}> = [
  { codigo: 'COMPROB_MATERIAL', secuencia: 1, tiempo_base_minutos: 2,  tiempo_por_m2_minutos: 0,  factor_simple: 1.0, factor_media: 1.0, factor_compleja: 1.0, es_opcional: false, depende_de_secuencia: null },
  { codigo: 'LIJADO',           secuencia: 2, tiempo_base_minutos: 5,  tiempo_por_m2_minutos: 10, factor_simple: 0.8, factor_media: 1.0, factor_compleja: 1.3, es_opcional: false, depende_de_secuencia: 1 },
  { codigo: 'FONDO',            secuencia: 3, tiempo_base_minutos: 5,  tiempo_por_m2_minutos: 8,  factor_simple: 0.8, factor_media: 1.0, factor_compleja: 1.3, es_opcional: false, depende_de_secuencia: 2 },
  { codigo: 'LIJADO_2',         secuencia: 4, tiempo_base_minutos: 5,  tiempo_por_m2_minutos: 8,  factor_simple: 0.8, factor_media: 1.0, factor_compleja: 1.3, es_opcional: true,  depende_de_secuencia: 3 },
  { codigo: 'FONDEADO_2',       secuencia: 5, tiempo_base_minutos: 5,  tiempo_por_m2_minutos: 8,  factor_simple: 0.8, factor_media: 1.0, factor_compleja: 1.3, es_opcional: true,  depende_de_secuencia: 4 },
  { codigo: 'LACADO',           secuencia: 6, tiempo_base_minutos: 10, tiempo_por_m2_minutos: 12, factor_simple: 0.8, factor_media: 1.0, factor_compleja: 1.3, es_opcional: false, depende_de_secuencia: 5 },
  { codigo: 'TERMINACION',      secuencia: 7, tiempo_base_minutos: 5,  tiempo_por_m2_minutos: 0,  factor_simple: 1.0, factor_media: 1.0, factor_compleja: 1.2, es_opcional: false, depende_de_secuencia: 6 },
  { codigo: 'RECEPCION',        secuencia: 8, tiempo_base_minutos: 3,  tiempo_por_m2_minutos: 0,  factor_simple: 1.0, factor_media: 1.0, factor_compleja: 1.0, es_opcional: false, depende_de_secuencia: 7 },
  { codigo: 'PICKING',          secuencia: 9, tiempo_base_minutos: 3,  tiempo_por_m2_minutos: 0,  factor_simple: 1.0, factor_media: 1.0, factor_compleja: 1.0, es_opcional: false, depende_de_secuencia: 8 },
]

async function precargarProcesosEstandar(productoId: string): Promise<void> {
  const supabase = createClient()

  // Cargar catálogo para mapear código → id
  const { data: catalogo } = await supabase
    .from('procesos_catalogo')
    .select('id, codigo')

  if (!catalogo) return

  const mapa = new Map((catalogo as any[]).map((p) => [p.codigo, p.id]))

  const filas = PLANTILLA_PROCESOS_ESTANDAR
    .filter((p) => mapa.has(p.codigo))
    .map((p) => ({
      producto_id: productoId,
      proceso_id: mapa.get(p.codigo)!,
      secuencia: p.secuencia,
      tiempo_base_minutos: p.tiempo_base_minutos,
      tiempo_por_m2_minutos: p.tiempo_por_m2_minutos,
      factor_simple: p.factor_simple,
      factor_media: p.factor_media,
      factor_compleja: p.factor_compleja,
      es_opcional: p.es_opcional,
      depende_de_secuencia: p.depende_de_secuencia,
      notas: null,
      activo: true,
    }))

  if (filas.length > 0) {
    await supabase.from('procesos_producto').insert(filas)
  }
}

// ============================================================================
// PROCESOS POR PRODUCTO
// ============================================================================

export async function listarProcesosCatalogo(): Promise<ProcesoCatalogoExt[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('procesos_catalogo')
    .select('*')
    .eq('activo', true)
    .order('orden_tipico')
  if (error) throw error
  return (data ?? []) as ProcesoCatalogoExt[]
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
        id, codigo, nombre, orden_tipico, color_gantt, escala_por_m2,
        permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at
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
// APRENDIZAJE DE TIEMPOS (se mantiene igual)
// ============================================================================

export async function estimarTiempoProceso(params: {
  productoId: string
  procesoId: string
  nivelComplejidadId: number | null
  superficieM2: number
}): Promise<number> {
  const supabase = createClient()
  const { productoId, procesoId, nivelComplejidadId, superficieM2 } = params

  const { count } = await supabase
    .from('historial_tiempos_proceso')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId)
    .eq('proceso_id', procesoId)
    .eq('nivel_complejidad', nivelComplejidadId ?? 0)

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

  const { data: config } = await supabase
    .from('procesos_producto')
    .select('tiempo_base_minutos, tiempo_por_m2_minutos')
    .eq('producto_id', productoId)
    .eq('proceso_id', procesoId)
    .eq('activo', true)
    .maybeSingle()

  if (!config) return 0

  let mult = 1
  if (nivelComplejidadId) {
    const { data: nc } = await supabase
      .from('niveles_complejidad')
      .select('multiplicador')
      .eq('id', nivelComplejidadId)
      .maybeSingle()
    if (nc?.multiplicador) mult = Number(nc.multiplicador)
  }

  const base = Number(config.tiempo_base_minutos ?? 0)
  const porM2 = Number(config.tiempo_por_m2_minutos ?? 0)
  const total = (base + porM2 * (superficieM2 ?? 0)) * mult
  return Math.round(total * 100) / 100
}

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
