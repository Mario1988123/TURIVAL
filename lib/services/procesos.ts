import { createClient } from './client'
import type {
  ProcesoCatalogo,
  ProcesoProducto,
  ProcesoProductoConDetalle,
  NivelComplejidad,
  TareaProduccion,
} from '../types/erp'

/**
 * ============================================================
 * SERVICIO: PROCESOS DE PRODUCCIÓN
 * ============================================================
 *
 * Este módulo gestiona todo lo relacionado con los 9 procesos
 * maestros de Turiaval (recepción, lijado, fondo, lacado...)
 * y las plantillas de procesos por producto.
 *
 * Contenido:
 *   1. Lectura de procesos maestros (tabla procesos_catalogo)
 *   2. Lectura de niveles de complejidad
 *   3. Gestión de procesos por producto (tabla procesos_producto)
 *   4. Cálculo de tiempos estimados
 *   5. Generación de tareas de producción reales
 * ============================================================
 */


// ============================================================
// 1. PROCESOS MAESTROS (los 9 tipos de proceso de la empresa)
// ============================================================

/**
 * Devuelve los 9 procesos maestros de Turiaval, ordenados por
 * orden_tipico (recepción → ... → listo entrega).
 */
export async function listarProcesosCatalogo(
  solo_activos: boolean = true
): Promise<ProcesoCatalogo[]> {
  const supabase = createClient()

  let query = supabase
    .from('procesos_catalogo')
    .select('*')
    .order('orden_tipico', { ascending: true })

  if (solo_activos) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data as ProcesoCatalogo[]
}

/**
 * Devuelve un proceso maestro por su código (ej: 'LACADO').
 * Útil para lógica de negocio que depende de un proceso concreto.
 */
export async function obtenerProcesoPorCodigo(
  codigo: string
): Promise<ProcesoCatalogo | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('procesos_catalogo')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle()

  if (error) throw error
  return data as ProcesoCatalogo | null
}


// ============================================================
// 2. NIVELES DE COMPLEJIDAD (simple / media / compleja)
// ============================================================

/**
 * Devuelve los niveles de complejidad con sus multiplicadores.
 */
export async function listarNivelesComplejidad(): Promise<NivelComplejidad[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('niveles_complejidad')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (error) throw error
  return data as NivelComplejidad[]
}


// ============================================================
// 3. PROCESOS POR PRODUCTO (plantillas editables)
// ============================================================

/**
 * Devuelve la lista de procesos que aplica un producto,
 * en el orden correcto, incluyendo los datos del proceso maestro.
 */
export async function obtenerProcesosDeProducto(
  producto_id: string
): Promise<ProcesoProductoConDetalle[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('procesos_producto')
    .select(`
      *,
      proceso:proceso_id (
        id, codigo, nombre, orden_tipico, color_gantt,
        permite_repetir, es_tiempo_espera, requiere_operario,
        descripcion, activo, created_at
      )
    `)
    .eq('producto_id', producto_id)
    .eq('activo', true)
    .order('secuencia', { ascending: true })

  if (error) throw error
  return (data || []) as ProcesoProductoConDetalle[]
}

/**
 * Añade un proceso a la plantilla de un producto.
 * La secuencia se coloca al final automáticamente si no se indica.
 */
export async function agregarProcesoAProducto(datos: {
  producto_id: string
  proceso_id: string
  secuencia?: number
  tiempo_base_minutos?: number
  tiempo_por_m2_minutos?: number
  factor_simple?: number
  factor_media?: number
  factor_compleja?: number
  notas?: string
}): Promise<ProcesoProducto> {
  const supabase = createClient()

  // Si no se indica secuencia, calcular la siguiente
  let secuencia = datos.secuencia
  if (secuencia === undefined) {
    const { data: ultimos } = await supabase
      .from('procesos_producto')
      .select('secuencia')
      .eq('producto_id', datos.producto_id)
      .order('secuencia', { ascending: false })
      .limit(1)

    secuencia = (ultimos && ultimos.length > 0 ? ultimos[0].secuencia : 0) + 1
  }

  const { data, error } = await supabase
    .from('procesos_producto')
    .insert({
      producto_id: datos.producto_id,
      proceso_id: datos.proceso_id,
      secuencia,
      tiempo_base_minutos: datos.tiempo_base_minutos ?? 0,
      tiempo_por_m2_minutos: datos.tiempo_por_m2_minutos ?? 0,
      factor_simple: datos.factor_simple ?? 1.0,
      factor_media: datos.factor_media ?? 1.3,
      factor_compleja: datos.factor_compleja ?? 1.7,
      notas: datos.notas ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as ProcesoProducto
}

/**
 * Actualiza un proceso de la plantilla (tiempos, factores, notas).
 */
export async function actualizarProcesoProducto(
  id: string,
  datos: Partial<Omit<ProcesoProducto, 'id' | 'producto_id' | 'created_at'>>
): Promise<ProcesoProducto> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('procesos_producto')
    .update({
      ...datos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ProcesoProducto
}

/**
 * Elimina un proceso de la plantilla de un producto.
 */
export async function eliminarProcesoDeProducto(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('procesos_producto')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Reordena la secuencia de procesos de un producto.
 * Recibe un array con el nuevo orden: [{id, secuencia_nueva}, ...]
 */
export async function reordenarProcesosDeProducto(
  producto_id: string,
  orden_nuevo: { id: string; secuencia: number }[]
): Promise<void> {
  const supabase = createClient()

  // Actualizar cada uno. Son pocos registros, no vale la pena una transacción.
  for (const item of orden_nuevo) {
    const { error } = await supabase
      .from('procesos_producto')
      .update({ secuencia: item.secuencia, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('producto_id', producto_id) // seguridad extra

    if (error) throw error
  }
}


// ============================================================
// 4. CÁLCULO DE TIEMPOS ESTIMADOS
// ============================================================

/**
 * Calcula el tiempo estimado de un solo proceso sobre una pieza.
 * Fórmula: (tiempo_base + tiempo_m2 × superficie) × factor_complejidad
 *
 * @param proceso_producto La fila de procesos_producto con los datos
 * @param superficie_m2 Superficie de la pieza en m² (0 si el producto es por pieza)
 * @param nivel_complejidad 1=simple, 2=media, 3=compleja
 * @returns Tiempo estimado en minutos
 */
export function calcularTiempoProceso(
  proceso_producto: Pick<
    ProcesoProducto,
    | 'tiempo_base_minutos'
    | 'tiempo_por_m2_minutos'
    | 'factor_simple'
    | 'factor_media'
    | 'factor_compleja'
  >,
  superficie_m2: number,
  nivel_complejidad: 1 | 2 | 3
): number {
  const base = Number(proceso_producto.tiempo_base_minutos) || 0
  const por_m2 = Number(proceso_producto.tiempo_por_m2_minutos) || 0
  const superficie = Number(superficie_m2) || 0

  let factor: number
  switch (nivel_complejidad) {
    case 1:
      factor = Number(proceso_producto.factor_simple) || 1.0
      break
    case 2:
      factor = Number(proceso_producto.factor_media) || 1.3
      break
    case 3:
      factor = Number(proceso_producto.factor_compleja) || 1.7
      break
  }

  const tiempo_sin_factor = base + por_m2 * superficie
  return +(tiempo_sin_factor * factor).toFixed(2)
}

/**
 * Calcula el tiempo total estimado de TODO el flujo de producción
 * de una pieza (suma de todos los procesos).
 *
 * @param producto_id Producto cuya plantilla se va a usar
 * @param superficie_m2 Superficie de la pieza
 * @param nivel_complejidad 1, 2 o 3
 * @returns Objeto con tiempo total y desglose por proceso
 */
export async function calcularTiempoTotalPieza(
  producto_id: string,
  superficie_m2: number,
  nivel_complejidad: 1 | 2 | 3
): Promise<{
  tiempo_total_minutos: number
  tiempo_trabajo_efectivo_minutos: number  // sin tiempos de espera (secado)
  tiempo_espera_minutos: number            // solo secado y similares
  desglose: Array<{
    secuencia: number
    proceso_codigo: string
    proceso_nombre: string
    tiempo_minutos: number
    es_espera: boolean
  }>
}> {
  const procesos = await obtenerProcesosDeProducto(producto_id)

  let tiempo_total = 0
  let tiempo_trabajo = 0
  let tiempo_espera = 0
  const desglose = []

  for (const pp of procesos) {
    const tiempo = calcularTiempoProceso(pp, superficie_m2, nivel_complejidad)

    tiempo_total += tiempo
    if (pp.proceso.es_tiempo_espera) {
      tiempo_espera += tiempo
    } else {
      tiempo_trabajo += tiempo
    }

    desglose.push({
      secuencia: pp.secuencia,
      proceso_codigo: pp.proceso.codigo,
      proceso_nombre: pp.proceso.nombre,
      tiempo_minutos: tiempo,
      es_espera: pp.proceso.es_tiempo_espera,
    })
  }

  return {
    tiempo_total_minutos: +tiempo_total.toFixed(2),
    tiempo_trabajo_efectivo_minutos: +tiempo_trabajo.toFixed(2),
    tiempo_espera_minutos: +tiempo_espera.toFixed(2),
    desglose,
  }
}


// ============================================================
// 5. GENERACIÓN DE TAREAS DE PRODUCCIÓN REALES
// ============================================================

/**
 * Cuando una pieza entra en producción, se crean sus tareas
 * automáticamente a partir de la plantilla del producto.
 *
 * Esta función recibe una pieza y genera una fila en
 * `tareas_produccion` por cada paso que debe hacer esa pieza.
 *
 * Los tiempos estimados se calculan aquí ya aplicando la
 * superficie y la complejidad reales de la pieza.
 *
 * No se asignan fechas ni operarios: eso lo hará el Gantt
 * (futuro Módulo 6).
 *
 * Si la pieza ya tiene tareas creadas, no las duplica.
 */
export async function generarTareasParaPieza(
  pieza_id: string,
  producto_id: string,
  superficie_m2: number,
  nivel_complejidad: 1 | 2 | 3
): Promise<TareaProduccion[]> {
  const supabase = createClient()

  // 1. ¿Ya existen tareas para esta pieza? Si sí, no duplicar.
  const { data: existentes } = await supabase
    .from('tareas_produccion')
    .select('id')
    .eq('pieza_id', pieza_id)
    .limit(1)

  if (existentes && existentes.length > 0) {
    throw new Error(
      `La pieza ${pieza_id} ya tiene tareas de producción. ` +
      `Elimínalas primero si quieres regenerarlas.`
    )
  }

  // 2. Obtener plantilla del producto
  const procesos = await obtenerProcesosDeProducto(producto_id)

  if (procesos.length === 0) {
    throw new Error(
      `El producto ${producto_id} no tiene procesos definidos. ` +
      `Configura los procesos antes de producir piezas.`
    )
  }

  // 3. Crear las tareas (una por cada fila de la plantilla)
  const tareas_a_insertar = procesos.map((pp) => {
    const tiempo_estimado = calcularTiempoProceso(
      pp,
      superficie_m2,
      nivel_complejidad
    )

    return {
      pieza_id,
      proceso_id: pp.proceso_id,
      secuencia: pp.secuencia,
      estado: 'pendiente' as const,
      tiempo_estimado_minutos: tiempo_estimado,
      nivel_complejidad_aplicado: nivel_complejidad,
      superficie_m2_aplicada: superficie_m2,
    }
  })

  const { data, error } = await supabase
    .from('tareas_produccion')
    .insert(tareas_a_insertar)
    .select()

  if (error) throw error
  return (data || []) as TareaProduccion[]
}

/**
 * Obtiene todas las tareas de una pieza concreta.
 */
export async function obtenerTareasDePieza(
  pieza_id: string
): Promise<TareaProduccion[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tareas_produccion')
    .select('*')
    .eq('pieza_id', pieza_id)
    .order('secuencia', { ascending: true })

  if (error) throw error
  return (data || []) as TareaProduccion[]
}
