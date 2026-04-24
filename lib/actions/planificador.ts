// lib/actions/planificador.ts
'use server'

/**
 * Server Actions del PLANIFICADOR (Gantt) — Capa 6.
 *
 * Envuelven las funciones de `lib/services/planificador.ts` para
 * poder llamarlas desde Client Components de /planificador.
 *
 * Convención: todas devuelven { ok: true, ... } o { ok: false, error }.
 */

import { revalidatePath } from 'next/cache'

import {
  obtenerVistaPlanificador,
  moverTarea,
  planificarTareaManual,
  aplicarAgrupacion,
  obtenerSugerenciasHuecos,
  obtenerSugerenciasAgrupacion,
  obtenerSugerenciasHorasExtra,
  autogenerar,
  type FiltrosPlanificador,
  type VistaPlanificador,
  type ResultadoMoverTarea,
  type ResultadoAutogenerarServicio,
} from '@/lib/services/planificador'
import type {
  SugerenciaHueco,
  SugerenciaHorasExtra,
  SugerenciaAgrupacion,
} from '@/lib/motor/planificador'

// =============================================================
// CONSULTAS
// =============================================================

export async function accionObtenerVistaPlanificador(
  filtros: FiltrosPlanificador = {},
): Promise<{ ok: true; data: VistaPlanificador } | { ok: false; error: string }> {
  try {
    const data = await obtenerVistaPlanificador(filtros)
    return { ok: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al cargar el planificador'
    return { ok: false, error: msg }
  }
}

export async function accionSugerenciasHuecos(filtros: FiltrosPlanificador = {}):
  Promise<{ ok: true; sugerencias: SugerenciaHueco[] } | { ok: false; error: string }>
{
  try {
    const sugerencias = await obtenerSugerenciasHuecos(filtros)
    return { ok: true, sugerencias }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionSugerenciasAgrupacion(filtros: FiltrosPlanificador = {}):
  Promise<{ ok: true; sugerencias: SugerenciaAgrupacion[] } | { ok: false; error: string }>
{
  try {
    const sugerencias = await obtenerSugerenciasAgrupacion(filtros)
    return { ok: true, sugerencias }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionSugerenciasHorasExtra(filtros: FiltrosPlanificador = {}):
  Promise<{ ok: true; sugerencias: SugerenciaHorasExtra[] } | { ok: false; error: string }>
{
  try {
    const sugerencias = await obtenerSugerenciasHorasExtra(filtros)
    return { ok: true, sugerencias }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

// =============================================================
// MUTACIONES (para G4+)
// =============================================================

export async function accionMoverTarea(params: {
  tarea_id: string
  nuevo_inicio: string
  nuevo_operario_id: string | null | undefined
}): Promise<ResultadoMoverTarea> {
  const res = await moverTarea(params)
  if (res.ok) revalidatePath('/planificador')
  return res
}

export async function accionPlanificarTareaManual(params: {
  tarea_id: string
  inicio: string
  operario_id: string | null
}): Promise<ResultadoMoverTarea> {
  const res = await planificarTareaManual(params)
  if (res.ok) revalidatePath('/planificador')
  return res
}

export async function accionAplicarAgrupacion(params: {
  tareas_ids: string[]
  operario_id: string
  inicio: string
}): Promise<ResultadoMoverTarea> {
  const res = await aplicarAgrupacion(params)
  if (res.ok) revalidatePath('/planificador')
  return res
}

export async function accionAutogenerar(params: {
  rango?: { desde: string; hasta: string }
  dry_run?: boolean
}): Promise<ResultadoAutogenerarServicio> {
  const res = await autogenerar(params)
  if (res.ok && !params.dry_run) revalidatePath('/planificador')
  return res
}
