// lib/actions/config-tiempos.ts
'use server'

/**
 * Server Actions de CONFIGURACIÓN DE TIEMPOS POR PROCESO.
 * Envuelven el service para poder llamarlas desde Client Components.
 * Todas devuelven { ok: true, ... } | { ok: false, error }.
 */

import { revalidatePath } from 'next/cache'

import {
  listarTiemposGlobales,
  guardarTiempoGlobal,
  type ConfigTiempoProcesoConProceso,
  type GuardarTiempoGlobalInput,
} from '@/lib/services/config-tiempos'

export async function accionListarTiemposGlobales() {
  try {
    const tiempos = await listarTiemposGlobales()
    return { ok: true as const, tiempos }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando los tiempos',
      tiempos: [] as ConfigTiempoProcesoConProceso[],
    }
  }
}

export async function accionGuardarTiempoGlobal(input: GuardarTiempoGlobalInput) {
  try {
    const tiempo = await guardarTiempoGlobal(input)
    revalidatePath('/configuracion/tiempos')
    return { ok: true as const, tiempo }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error guardando el tiempo',
    }
  }
}
