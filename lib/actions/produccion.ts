// lib/actions/produccion.ts
'use server'

/**
 * Server Actions de PRODUCCIÓN — Capa 5
 *
 * Envuelven las funciones del service /lib/services/produccion.ts para
 * poder llamarlas desde Client Components del panel /produccion y de
 * la página de detalle del pedido.
 *
 * Convención: todas devuelven { ok: true, ... } o { ok: false, error }.
 * El cliente muestra un TOAST inferior verde (ok) o rojo (error) que se
 * auto-desvanece en ~3s. El texto de `error` viene formateado en español
 * desde el service, listo para mostrar al usuario.
 */

import { revalidatePath } from 'next/cache'

import {
  listarTareasParaPanel,
  listarTareasPorPieza,
  obtenerTareaActivaPorQr,
  iniciarTarea,
  completarTarea,
  forzarSeco,
  reportarIncidencia,
  duplicarTarea,
  asignarCandidatos,
  recomputarEstadoPiezaYPedido,
  reabrirTarea,
  type FiltrosPanel,
} from '@/lib/services/produccion'
import { calcularMezclaTeoricaTarea } from '@/lib/services/reservas'

// =============================================================
// CONSULTAS
// =============================================================

export async function accionListarTareasParaPanel(filtros: FiltrosPanel = {}) {
  try {
    const tareas = await listarTareasParaPanel(filtros)
    return { ok: true as const, tareas }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando tareas',
      tareas: [] as any[],
    }
  }
}

export async function accionListarTareasPorPieza(piezaId: string) {
  try {
    const tareas = await listarTareasPorPieza(piezaId)
    return { ok: true as const, tareas }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando tareas de la pieza',
      tareas: [] as any[],
    }
  }
}

export async function accionObtenerTareaActivaPorQr(qrCodigo: string) {
  try {
    const data = await obtenerTareaActivaPorQr(qrCodigo)
    return { ok: true as const, ...data }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'No se encontró la pieza',
    }
  }
}

// =============================================================
// TRANSICIONES
// =============================================================

export async function accionIniciarTarea(input: {
  tareaId: string
  operarioId: string
}) {
  try {
    const tarea = await iniciarTarea(input.tareaId, input.operarioId)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return { ok: true as const, tarea }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error iniciando la tarea',
    }
  }
}

export async function accionCompletarTarea(
  input: string | {
    tareaId: string
    mezcla?: {
      estado: 'exacto' | 'sobro' | 'falto'
      kg_merma_total?: number
    }
  }
) {
  // Compatibilidad hacia atrás: si llega un string, es el tareaId sin mezcla
  const tareaId = typeof input === 'string' ? input : input.tareaId
  const mezcla = typeof input === 'string' ? undefined : input.mezcla
  try {
    const res = await completarTarea(tareaId, mezcla)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')

    // Mario punto 26: detectar si el pedido pasa a 'completado' tras
    // esta accion para que la UI muestre modal "PEDIDO TERMINADO".
    let pedidoTerminado: { id: string; numero: string; cliente: string | null } | null = null
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: tareaInfo } = await supabase
        .from('tareas_produccion')
        .select('pieza:piezas(linea_pedido:lineas_pedido(pedido:pedidos(id, numero, estado, cliente:clientes(nombre_comercial))))')
        .eq('id', tareaId)
        .maybeSingle()
      const ped = (tareaInfo as any)?.pieza?.linea_pedido?.pedido
      if (ped?.estado === 'completado') {
        pedidoTerminado = {
          id: ped.id,
          numero: ped.numero,
          cliente: ped.cliente?.nombre_comercial ?? null,
        }
      }
    } catch { /* silencio */ }

    return {
      ok: true as const,
      tarea: res.tarea,
      estado: res.estado,
      finSecado: 'finSecado' in res ? res.finSecado : null,
      consumo: 'consumo' in res ? res.consumo : null,
      albaran: 'albaran' in res ? (res as any).albaran : null,
      pedidoTerminado,
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error completando la tarea',
    }
  }
}

export async function accionForzarSeco(tareaId: string) {
  try {
    const tarea = await forzarSeco(tareaId)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return { ok: true as const, tarea }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error forzando fin de secado',
    }
  }
}

export async function accionReportarIncidencia(input: {
  tareaId: string
  motivo?: string | null
}) {
  try {
    const tarea = await reportarIncidencia(input.tareaId, input.motivo ?? null)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return { ok: true as const, tarea }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error reportando incidencia',
    }
  }
}

export async function accionDuplicarTarea(tareaId: string) {
  try {
    const tarea = await duplicarTarea(tareaId)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return { ok: true as const, tarea }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error duplicando la tarea',
    }
  }
}

// =============================================================
// ASIGNACIÓN MANUAL DE CANDIDATOS
// =============================================================

export async function accionAsignarCandidatos(input: {
  tareaId: string
  operarioIds: string[]
}) {
  try {
    const res = await asignarCandidatos(input.tareaId, input.operarioIds)
    revalidatePath('/produccion')
    return { ok: true as const, insertados: res.insertados }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error asignando candidatos',
    }
  }
}

// =============================================================
// UTILIDAD DE MANTENIMIENTO
// =============================================================

/**
 * Recalcula el estado de una pieza y de su pedido en cascada.
 * Útil si quedaron datos inconsistentes por bugs anteriores.
 * No debería llamarse en flujo normal.
 */
export async function accionRecomputarEstadoPiezaYPedido(piezaId: string) {
  try {
    await recomputarEstadoPiezaYPedido(piezaId)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return { ok: true as const }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error recalculando estado',
    }
  }
}

// =============================================================
// R6b — MEZCLA Y CONSUMO
// =============================================================

/**
 * Calcula la mezcla teórica de una tarea (lacado o fondo) para mostrarla
 * al operario en el modal "Prepara esto" antes de iniciar.
 * No consume stock ni modifica nada.
 */
export async function accionCalcularMezclaTeorica(tareaId: string) {
  try {
    const mezcla = await calcularMezclaTeoricaTarea(tareaId)
    return { ok: true as const, mezcla }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error calculando mezcla teórica',
    }
  }
}

/**
 * Reabre una tarea completada para ajustar el consumo.
 * Revierte los movimientos de stock con auditoría y pone la tarea
 * de vuelta en 'en_progreso'.
 */
export async function accionReabrirTarea(input: {
  tareaId: string
  operarioId: string
}) {
  try {
    const res = await reabrirTarea(input.tareaId, input.operarioId)
    revalidatePath('/produccion')
    revalidatePath('/pedidos')
    return {
      ok: true as const,
      tarea: res.tarea,
      movimientosRevertidos: res.movimientos_revertidos,
      materialesAfectados: res.materiales_afectados,
    }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error reabriendo la tarea',
    }
  }
}

// =============================================================
// Resolver incidencia (Mario punto 27)
// =============================================================
export async function accionResolverIncidencia(incidenciaId: string) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase
      .from('incidencias_tarea')
      .update({ resuelta: true, fecha_resolucion: new Date().toISOString() })
      .eq('id', incidenciaId)
    if (error) throw error
    revalidatePath('/produccion')
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? 'Error' }
  }
}
