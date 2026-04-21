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

function fechaInicioHoy(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatearMinutos(m: number): string {
  const mins = Math.max(0, Math.round(m))
  if (mins < 1) return 'menos de 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const r = mins % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function etiquetaEstadoLegible(estado: string): string {
  switch (estado) {
    case 'pendiente':    return 'pendiente'
    case 'en_cola':      return 'en cola'
    case 'en_progreso':  return 'en progreso'
    case 'en_secado':    return 'en secado'
    case 'completada':   return 'completada'
    case 'incidencia':   return 'con incidencia'
    case 'anulada':      return 'anulada'
    default:             return estado
  }
}

// =============================================================
// CONSULTAS
// =============================================================

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
  if (filtros.soloDeHoy) {
    q = q.gte('fecha_inicio_real', fechaInicioHoy())
  }

  const { data, error } = await q
    .order('fecha_inicio_planificada', { ascending: true, nullsFirst: false })
    .order('secuencia', { ascending: true })

  if (error) throw error
  let rows: any[] = (data ?? []) as any[]

  if (incluirCompHoy) {
    const hoy = fechaInicioHoy()
    rows = rows.filter((t: any) => {
      if (t.estado !== 'completada') return true
      return (t.fecha_fin_real ?? '') >= hoy
    })
  }

  if (filtros.pedidoId) {
    rows = rows.filter(
      (t: any) => t?.pieza?.linea_pedido?.pedido?.id === filtros.pedidoId
    )
  }

  return rows
}

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
 * estén 'completada'. Si alguna bloquea, devuelve un mensaje que
 * indica QUÉ proceso está pendiente y cuánto tiempo estimado falta
 * para poder iniciar esta tarea.
 */
export async function iniciarTarea(tareaId: string, operarioId: string) {
  const supabase = await createClient()

  // 1. Cargar la tarea que queremos iniciar
  const { data: tarea, error: errT } = await supabase
    .from('tareas_produccion')
    .select('id, pieza_id, secuencia, estado, proceso_id')
    .eq('id', tareaId)
    .single()
  if (errT) throw errT
  if (!tarea) throw new Error('Tarea no encontrada')
  const tareaActual: any = tarea
  if (!['pendiente', 'en_cola'].includes(tareaActual.estado)) {
    throw new Error(
      `La tarea no se puede iniciar desde estado "${etiquetaEstadoLegible(tareaActual.estado)}"`
    )
  }

  // 2. Cargar tareas previas (secuencia menor) con info de proceso
  //    para poder decir "Lijado" en vez de "secuencia 1"
  const { data: previas, error: errPrev } = await supabase
    .from('tareas_produccion')
    .select(`
      id, secuencia, estado,
      tiempo_estimado_minutos, fecha_inicio_real, fecha_fin_secado,
      proceso:procesos_catalogo(
        id, nombre, abreviatura, requiere_secado, tiempo_secado_minutos
      )
    `)
    .eq('pieza_id', tareaActual.pieza_id)
    .lt('secuencia', tareaActual.secuencia)
    .order('secuencia', { ascending: true })
  if (errPrev) throw errPrev

  const bloqueantes = (previas ?? []).filter(
    (p: any) => !['completada', 'anulada'].includes(p.estado)
  ) as any[]

  if (bloqueantes.length > 0) {
    // Primera bloqueante (la más próxima a completarse) para el mensaje principal
    const primera = bloqueantes[0]
    const procPrimera = Array.isArray(primera.proceso)
      ? primera.proceso[0]
      : primera.proceso
    const nombrePrimera = procPrimera?.nombre ?? `secuencia ${primera.secuencia}`

    // Calcular tiempo restante estimado hasta poder iniciar ESTA tarea
    const ahora = Date.now()
    let minutosRestantes = 0
    let estimacionIncompleta = false

    for (const b of bloqueantes) {
      const proc = Array.isArray(b.proceso) ? b.proceso[0] : b.proceso
      const estimTrab = Number(b.tiempo_estimado_minutos ?? 0)
      const estimSec = proc?.requiere_secado
        ? Number(proc.tiempo_secado_minutos ?? 0)
        : 0

      if (b.estado === 'en_secado' && b.fecha_fin_secado) {
        const faltan = (new Date(b.fecha_fin_secado).getTime() - ahora) / 60000
        minutosRestantes += Math.max(0, faltan)
      } else if (b.estado === 'en_progreso' && b.fecha_inicio_real) {
        const transcurridos = (ahora - new Date(b.fecha_inicio_real).getTime()) / 60000
        minutosRestantes += Math.max(0, estimTrab - transcurridos) + estimSec
      } else {
        // pendiente / en_cola / incidencia: sumo estimado completo + secado
        minutosRestantes += estimTrab + estimSec
      }

      if (estimTrab === 0 && b.estado !== 'en_secado') {
        estimacionIncompleta = true
      }
    }

    // Construcción del mensaje
    let msg = `No se puede iniciar todavía: falta que termine "${nombrePrimera}" (${etiquetaEstadoLegible(primera.estado)}).`
    if (bloqueantes.length > 1) {
      msg += ` Hay ${bloqueantes.length} tareas previas por completar.`
    }
    if (minutosRestantes > 0) {
      const prefijo = estimacionIncompleta ? 'aprox. ' : ''
      msg += ` Tiempo estimado restante: ${prefijo}${formatearMinutos(minutosRestantes)}.`
    }
    throw new Error(msg)
  }

  // 3. Validar operario activo
  const { data: op, error: errOp } = await supabase
    .from('operarios')
    .select('id, activo, nombre')
    .eq('id', operarioId)
    .single()
  if (errOp) throw errOp
  if (!op || !(op as any).activo) {
    throw new Error('El operario no está activo')
  }

  // 4. Update
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

  await supabase
    .from('piezas')
    .update({ estado: 'en_produccion' })
    .eq('id', tareaActual.pieza_id)
    .eq('estado', 'sin_producir')

  return actualizada
}

export async function completarTarea(tareaId: string) {
  const supabase = await createClient()
  const ahora = new Date()

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
    throw new Error(`Solo se pueden completar tareas en "en progreso" (actual: "${etiquetaEstadoLegible(t.estado)}")`)
  }

  let tiempoReal: number | null = null
  if (t.fecha_inicio_real) {
    const ini = new Date(t.fecha_inicio_real).getTime()
    tiempoReal = Math.round((ahora.getTime() - ini) / 60000)
  }

  const proceso = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
  const requiereSecado = proceso?.requiere_secado === true
  let minutosSecado = Number(proceso?.tiempo_secado_minutos ?? 0)

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
      `Solo se puede forzar seco desde estado "en secado" (actual: "${etiquetaEstadoLegible(t.estado)}")`
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

async function propagarCompletado(piezaId: string) {
  const supabase = await createClient()

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

  const { data: linea } = await supabase
    .from('lineas_pedido')
    .select('id, pedido_id')
    .eq('id', pA.linea_pedido_id)
    .single()
  const pedidoId = (linea as any)?.pedido_id
  if (!pedidoId) return

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

export async function recomputarEstadoPiezaYPedido(piezaId: string) {
  return propagarCompletado(piezaId)
}
