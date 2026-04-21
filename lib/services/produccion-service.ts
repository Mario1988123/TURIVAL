// lib/services/produccion.ts
/**
 * Service de PRODUCCIÓN — Capa 5
 *
 * Lógica completa del ciclo de vida de una tarea:
 *   pendiente → en_cola → en_progreso → [en_secado] → completada
 *                                  ↘ incidencia
 *
 * Reglas clave:
 *  - Secuencial estricto por pieza: tarea N no arranca hasta que
 *    N-1 esté 'completada'.
 *  - Una tarea en 'en_secado' NO cuenta como completada — sigue
 *    bloqueando la siguiente.
 *  - Al completar todas las tareas de una pieza → pieza pasa a
 *    'completada'. Cuando todas las piezas de un pedido están
 *    completadas → el pedido pasa a 'completado'.
 *
 * Toda la lógica condicional vive aquí (TypeScript), nunca en BD
 * (bug PL/pgSQL del SQL Editor).
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export type EstadoTareaProduccion =
  | 'pendiente'
  | 'en_cola'
  | 'en_progreso'
  | 'en_secado'
  | 'completada'
  | 'incidencia'
  | 'anulada'

export interface FiltrosPanel {
  procesoId?: string
  operarioId?: string
  soloDeHoy?: boolean
  pedidoId?: string
  incluirCompletadasHoy?: boolean
}

// =============================================================
// Helpers internos
// =============================================================

async function getUserIdOrThrow(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function fechaInicioHoy(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// =============================================================
// CONSULTAS
// =============================================================

/**
 * Tareas para el panel de producción.
 * Por defecto trae: pendiente, en_cola, en_progreso, en_secado + las
 * completadas de hoy (si incluirCompletadasHoy=true, default true).
 * Cada fila incluye info enriquecida de pieza, línea, pedido, color, etc.
 */
export async function listarTareasParaPanel(filtros: FiltrosPanel = {}) {
  const supabase = await createClient()
  const incluirCompHoy = filtros.incluirCompletadasHoy ?? true

  const estados: EstadoTareaProduccion[] = [
    'pendiente',
    'en_cola',
    'en_progreso',
    'en_secado',
  ]
  if (incluirCompHoy) estados.push('completada')

  let q = supabase
    .from('tareas_produccion')
    .select(`
      id, secuencia, estado, es_opcional, depende_de_secuencia,
      tiempo_estimado_minutos, tiempo_real_minutos,
      fecha_inicio_planificada, fecha_inicio_real, fecha_fin_real,
      fecha_fin_secado, forzado_seco, minutos_secado_pendiente_al_forzar,
      operario_id, notas,
      operario:operarios(id, nombre, rol, color),
      proceso:procesos_catalogo(
        id, codigo, nombre, abreviatura, color_gantt,
        requiere_secado, tiempo_secado_minutos, rol_operario_requerido,
        escala_por_m2
      ),
      pieza:piezas(
        id, numero, estado, ubicacion_id, superficie_m2,
        color_id, tratamiento_id,
        ubicacion:ubicaciones(id, codigo, nombre, tipo),
        color:colores(id, nombre, codigo_hex),
        linea_pedido:lineas_pedido(
          id, descripcion, cantidad, producto_id,
          producto:productos(id, nombre),
          pedido:pedidos(id, numero, estado, prioridad, fecha_entrega_estimada,
            cliente:clientes(id, nombre_comercial)
          )
        )
      )
    `)
    .in('estado', estados)

  if (filtros.procesoId) q = q.eq('proceso_id', filtros.procesoId)
  if (filtros.operarioId) q = q.eq('operario_id', filtros.operarioId)
  if (filtros.pedidoId) {
    // filtrar por pedido requiere join; hacemos en memoria después
  }
  if (filtros.soloDeHoy) {
    q = q.gte('fecha_inicio_real', fechaInicioHoy())
  }
  if (incluirCompHoy) {
    // No podemos combinar "in estados" + "completada solo de hoy" en la misma
    // query. Hacemos 2 queries y mezclamos en memoria.
    // Simplificación: filtramos las completadas en cliente después.
  }

  const { data, error } = await q
    .order('fecha_inicio_planificada', { ascending: true, nullsFirst: false })
    .order('secuencia', { ascending: true })

  if (error) throw error
  let rows: any[] = (data ?? []) as any[]

  // Filtrar "completadas" para que solo muestre las de hoy
  if (incluirCompHoy) {
    const hoy = fechaInicioHoy()
    rows = rows.filter((t: any) => {
      if (t.estado !== 'completada') return true
      return (t.fecha_fin_real ?? '') >= hoy
    })
  }

  // Filtro por pedido (post-query)
  if (filtros.pedidoId) {
    rows = rows.filter(
      (t: any) => t?.pieza?.linea_pedido?.pedido?.id === filtros.pedidoId
    )
  }

  return rows
}

/** Tareas de una pieza concreta, en orden de secuencia. */
export async function listarTareasPorPieza(piezaId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tareas_produccion')
    .select(`
      *,
      proceso:procesos_catalogo(id, codigo, nombre, abreviatura,
        requiere_secado, tiempo_secado_minutos, color_gantt),
      operario:operarios(id, nombre, rol, color)
    `)
    .eq('pieza_id', piezaId)
    .order('secuencia', { ascending: true })
  if (error) throw error
  return (data ?? []) as any[]
}

/**
 * Al escanear QR: devuelve la pieza + la tarea "actual" (la primera
 * no completada, que debería ser la que toca). Si hay tareas en
 * en_progreso o en_secado las prioriza.
 */
export async function obtenerTareaActivaPorQr(qrCodigo: string) {
  const supabase = await createClient()

  const { data: pieza, error: errP } = await supabase
    .from('piezas')
    .select(`
      id, numero, estado, qr_codigo, ubicacion_id,
      linea_pedido:lineas_pedido(
        id, pedido:pedidos(id, numero,
          cliente:clientes(id, nombre_comercial)
        )
      )
    `)
    .eq('qr_codigo', qrCodigo)
    .single()
  if (errP) throw errP
  if (!pieza) throw new Error('Pieza no encontrada')

  const tareas = await listarTareasPorPieza((pieza as any).id)

  // Tarea "activa" = la primera de este orden:
  //   1) en_progreso
  //   2) en_secado
  //   3) en_cola / pendiente (con secuencia menor)
  const enProgreso = tareas.find((t: any) => t.estado === 'en_progreso')
  if (enProgreso) return { pieza, tarea: enProgreso, tareas }

  const enSecado = tareas.find((t: any) => t.estado === 'en_secado')
  if (enSecado) return { pieza, tarea: enSecado, tareas }

  const disponible = tareas.find(
    (t: any) => t.estado === 'pendiente' || t.estado === 'en_cola'
  )
  return { pieza, tarea: disponible ?? null, tareas }
}

// =============================================================
// TRANSICIONES
// =============================================================

/**
 * Iniciar una tarea. Valida que todas las tareas con secuencia menor
 * estén 'completada' (no 'en_secado', no 'en_progreso').
 */
export async function iniciarTarea(tareaId: string, operarioId: string) {
  const supabase = await createClient()

  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select('id, pieza_id, secuencia, estado, proceso_id')
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')
  if (!['pendiente', 'en_cola'].includes((tarea as any).estado)) {
    throw new Error(
      `La tarea no se puede iniciar desde estado "${(tarea as any).estado}"`
    )
  }

  // Validar secuencia: no hay tareas previas no completadas
  const { data: previas, error: errPrev } = await supabase
    .from('tareas_produccion')
    .select('id, secuencia, estado')
    .eq('pieza_id', (tarea as any).pieza_id)
    .lt('secuencia', (tarea as any).secuencia)
  if (errPrev) throw errPrev

  const bloqueante = (previas ?? []).find(
    (p: any) => !['completada', 'anulada'].includes(p.estado)
  )
  if (bloqueante) {
    throw new Error(
      `No se puede iniciar: la tarea de secuencia ${bloqueante.secuencia} está en estado "${bloqueante.estado}".`
    )
  }

  // Validar operario existe y activo
  const { data: op, error: errOp } = await supabase
    .from('operarios')
    .select('id, activo, nombre')
    .eq('id', operarioId)
    .single()
  if (errOp) throw errOp
  if (!op || !(op as any).activo) {
    throw new Error('El operario no está activo')
  }

  // Update
  const { data: actualizada, error: errU } = await supabase
    .from('tareas_produccion')
    .update({
      estado: 'en_progreso',
      operario_id: operarioId,
      fecha_inicio_real: new Date().toISOString(),
    })
    .eq('id', tareaId)
    .select()
    .single()
  if (errU) throw errU

  // Si la pieza estaba en sin_producir, pasa a en_produccion
  await supabase
    .from('piezas')
    .update({ estado: 'en_produccion' })
    .eq('id', (tarea as any).pieza_id)
    .eq('estado', 'sin_producir')

  return actualizada
}

/**
 * Completar una tarea en progreso.
 * Si el proceso requiere secado → pasa a 'en_secado' con fecha_fin_secado.
 * Si no → pasa a 'completada' y se propaga.
 */
export async function completarTarea(tareaId: string) {
  const supabase = await createClient()
  const ahora = new Date()

  // Cargar tarea con info del proceso y posible override por producto
  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select(`
      id, pieza_id, estado, fecha_inicio_real, secuencia, proceso_id,
      proceso:procesos_catalogo(
        id, requiere_secado, tiempo_secado_minutos
      ),
      pieza:piezas(
        id, linea_pedido_id,
        linea_pedido:lineas_pedido(id, producto_id)
      )
    `)
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')

  const t: any = tarea
  if (t.estado !== 'en_progreso') {
    throw new Error(`Solo se pueden completar tareas en "en_progreso" (actual: "${t.estado}")`)
  }

  // Tiempo real trabajado
  let tiempoReal: number | null = null
  if (t.fecha_inicio_real) {
    const ini = new Date(t.fecha_inicio_real).getTime()
    tiempoReal = Math.round((ahora.getTime() - ini) / 60000)
  }

  const proceso = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
  const requiereSecado = proceso?.requiere_secado === true
  let minutosSecado = Number(proceso?.tiempo_secado_minutos ?? 0)

  // Override por producto
  if (requiereSecado) {
    const productoId = t.pieza?.linea_pedido?.producto_id
    if (productoId) {
      const { data: pp } = await supabase
        .from('procesos_producto')
        .select('tiempo_secado_minutos_override')
        .eq('producto_id', productoId)
        .eq('proceso_id', t.proceso_id)
        .maybeSingle()
      const override = (pp as any)?.tiempo_secado_minutos_override
      if (override != null && Number.isFinite(override)) {
        minutosSecado = Number(override)
      }
    }
  }

  if (requiereSecado && minutosSecado > 0) {
    const finSecado = new Date(ahora.getTime() + minutosSecado * 60000)
    const { data, error } = await supabase
      .from('tareas_produccion')
      .update({
        estado: 'en_secado',
        fecha_fin_real: ahora.toISOString(),
        tiempo_real_minutos: tiempoReal,
        fecha_fin_secado: finSecado.toISOString(),
      })
      .eq('id', tareaId)
      .select()
      .single()
    if (error) throw error
    return { tarea: data, estado: 'en_secado' as const, finSecado }
  }

  // Sin secado → completada directa
  const { data, error } = await supabase
    .from('tareas_produccion')
    .update({
      estado: 'completada',
      fecha_fin_real: ahora.toISOString(),
      tiempo_real_minutos: tiempoReal,
    })
    .eq('id', tareaId)
    .select()
    .single()
  if (error) throw error

  await propagarCompletado(t.pieza_id)

  return { tarea: data, estado: 'completada' as const }
}

/**
 * Forzar fin de secado: pasa de 'en_secado' a 'completada'.
 * Guarda minutos_secado_pendiente_al_forzar: positivo = se forzó antes;
 * cero = justo a tiempo; negativo = se forzó después de expirar.
 */
export async function forzarSeco(tareaId: string) {
  const supabase = await createClient()
  const ahora = new Date()

  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select('id, pieza_id, estado, fecha_fin_secado')
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')
  const t: any = tarea
  if (t.estado !== 'en_secado') {
    throw new Error(
      `Solo se puede forzar seco desde estado "en_secado" (actual: "${t.estado}")`
    )
  }

  let pendiente: number | null = null
  if (t.fecha_fin_secado) {
    const fin = new Date(t.fecha_fin_secado).getTime()
    pendiente = Math.round((fin - ahora.getTime()) / 60000)
  }

  const { data, error } = await supabase
    .from('tareas_produccion')
    .update({
      estado: 'completada',
      forzado_seco: true,
      minutos_secado_pendiente_al_forzar: pendiente,
    })
    .eq('id', tareaId)
    .select()
    .single()
  if (error) throw error

  await propagarCompletado(t.pieza_id)

  return data
}

/** Reportar incidencia: la tarea pasa a 'incidencia'. */
export async function reportarIncidencia(
  tareaId: string,
  motivo?: string | null
) {
  const supabase = await createClient()

  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select('id, estado, notas')
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')

  const prevNotas = (tarea as any).notas ?? ''
  const nuevasNotas = motivo
    ? `${prevNotas}\n[INCIDENCIA ${new Date().toLocaleString('es-ES')}] ${motivo}`.trim()
    : prevNotas

  const { data, error } = await supabase
    .from('tareas_produccion')
    .update({
      estado: 'incidencia',
      notas: nuevasNotas,
    })
    .eq('id', tareaId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Duplicar una tarea para rehacer. Típicamente llamado tras una
 * incidencia. Se crea nueva fila con la misma configuración, estado
 * 'pendiente', secuencia = max(secuencia) + 0.5 para que vaya después
 * de las existentes sin chocar con la UNIQUE INDEX (pieza_id, secuencia).
 */
export async function duplicarTarea(tareaId: string) {
  const supabase = await createClient()

  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select('*')
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')
  const t: any = tarea

  // Buscar máxima secuencia actual para esta pieza
  const { data: maxRow, error: errMax } = await supabase
    .from('tareas_produccion')
    .select('secuencia')
    .eq('pieza_id', t.pieza_id)
    .order('secuencia', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (errMax) throw errMax
  const maxSec = Number((maxRow as any)?.secuencia ?? t.secuencia)
  const nuevaSec = maxSec + 1

  // NOTA: la tabla tiene UNIQUE (pieza_id, secuencia) e integer, así que
  // no podemos usar fracciones; incrementamos +1.
  const { data: nueva, error: errIns } = await supabase
    .from('tareas_produccion')
    .insert({
      pieza_id: t.pieza_id,
      proceso_id: t.proceso_id,
      secuencia: nuevaSec,
      es_opcional: t.es_opcional,
      depende_de_secuencia: t.depende_de_secuencia,
      estado: 'pendiente',
      tiempo_estimado_minutos: t.tiempo_estimado_minutos,
      notas: `Duplicada de tarea secuencia ${t.secuencia} (${t.estado})`,
    })
    .select()
    .single()
  if (errIns) throw errIns

  // También copiar candidatos asignados
  const { data: candidatos } = await supabase
    .from('operarios_tareas_candidatos')
    .select('operario_id')
    .eq('tarea_id', t.id)
  const cands = (candidatos ?? []) as Array<{ operario_id: string }>
  if (cands.length > 0) {
    await supabase.from('operarios_tareas_candidatos').insert(
      cands.map((c) => ({
        tarea_id: (nueva as any).id,
        operario_id: c.operario_id,
      }))
    )
  }

  return nueva
}

// =============================================================
// ASIGNACIÓN DE CANDIDATOS
// =============================================================

/**
 * Reemplaza completamente los candidatos de una tarea.
 * Si operarioIds está vacío, la tarea queda sin candidatos (abierta).
 */
export async function asignarCandidatos(
  tareaId: string,
  operarioIds: string[]
) {
  const supabase = await createClient()

  const { error: errDel } = await supabase
    .from('operarios_tareas_candidatos')
    .delete()
    .eq('tarea_id', tareaId)
  if (errDel) throw errDel

  if (operarioIds.length === 0) return { insertados: 0 }

  const payload = operarioIds.map((oid) => ({
    tarea_id: tareaId,
    operario_id: oid,
  }))
  const { error: errIns } = await supabase
    .from('operarios_tareas_candidatos')
    .insert(payload)
  if (errIns) throw errIns

  return { insertados: operarioIds.length }
}

// =============================================================
// PROPAGACIÓN pieza → pedido
// =============================================================

/**
 * Cuando una tarea pasa a 'completada', si TODAS las tareas de la
 * pieza (no anuladas, no incidencia) están completadas, la pieza pasa
 * a 'completada'. Y si TODAS las piezas del pedido están 'completada',
 * 'entregada' o 'cancelada', el pedido pasa a 'completado'.
 */
async function propagarCompletado(piezaId: string) {
  const supabase = await createClient()

  // 1. Todas las tareas "vivas" de la pieza
  const { data: tareas, error: errT } = await supabase
    .from('tareas_produccion')
    .select('id, estado')
    .eq('pieza_id', piezaId)
  if (errT) throw errT

  const vivas = (tareas ?? []).filter(
    (t: any) => !['anulada', 'incidencia'].includes(t.estado)
  )
  if (vivas.length === 0) return
  const todasCompletadas = vivas.every((t: any) => t.estado === 'completada')
  if (!todasCompletadas) return

  // Pieza → completada (solo si no estaba ya en un estado final)
  const { data: piezaActual } = await supabase
    .from('piezas')
    .select('id, estado, linea_pedido_id')
    .eq('id', piezaId)
    .single()
  const pA: any = piezaActual
  if (!pA) return
  if (['completada', 'entregada', 'cancelada'].includes(pA.estado)) return

  await supabase
    .from('piezas')
    .update({
      estado: 'completada',
      fecha_completada: new Date().toISOString(),
    })
    .eq('id', piezaId)

  // 2. Comprobar el pedido entero
  const { data: linea } = await supabase
    .from('lineas_pedido')
    .select('id, pedido_id')
    .eq('id', pA.linea_pedido_id)
    .single()
  const pedidoId = (linea as any)?.pedido_id
  if (!pedidoId) return

  // Todas las piezas del pedido
  const { data: lineas } = await supabase
    .from('lineas_pedido')
    .select('id')
    .eq('pedido_id', pedidoId)
  const lineaIds = (lineas ?? []).map((l: any) => l.id)
  if (lineaIds.length === 0) return

  const { data: piezas } = await supabase
    .from('piezas')
    .select('id, estado')
    .in('linea_pedido_id', lineaIds)

  const piezasList = (piezas ?? []) as Array<{ id: string; estado: string }>
  if (piezasList.length === 0) return

  const estadosFinales = ['completada', 'entregada', 'cancelada']
  const todasFinal = piezasList.every((p) => estadosFinales.includes(p.estado))
  if (!todasFinal) return

  // Pedido → completado (solo si aún está en_produccion/confirmado)
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, estado')
    .eq('id', pedidoId)
    .single()
  const estadoPed = (pedido as any)?.estado
  if (!['en_produccion', 'confirmado'].includes(estadoPed)) return

  await supabase
    .from('pedidos')
    .update({ estado: 'completado' })
    .eq('id', pedidoId)
}

// =============================================================
// Export opcional del helper por si un admin quiere forzar recálculo
// =============================================================

export async function recomputarEstadoPiezaYPedido(piezaId: string) {
  return propagarCompletado(piezaId)
}
