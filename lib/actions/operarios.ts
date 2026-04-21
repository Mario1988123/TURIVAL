// lib/actions/operarios.ts
'use server'

/**
 * Server Actions de OPERARIOS — Capa 5.
 * Envuelven el service para poder llamarlas desde Client Components.
 * Todas devuelven { ok: true, ... } | { ok: false, error }.
 */

import { revalidatePath } from 'next/cache'

import {
  listarOperarios,
  obtenerOperario,
  crearOperario,
  actualizarOperario,
  eliminarOperario,
  type Operario,
  type OperarioInput,
} from '@/lib/services/operarios'

export async function accionListarOperarios(incluirInactivos = false) {
  try {
    const operarios = await listarOperarios(incluirInactivos)
    return { ok: true as const, operarios }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error cargando operarios',
      operarios: [] as Operario[],
    }
  }
}

export async function accionObtenerOperario(id: string) {
  try {
    const operario = await obtenerOperario(id)
    return { ok: true as const, operario }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Operario no encontrado',
    }
  }
}

export async function accionCrearOperario(input: OperarioInput) {
  try {
    const operario = await crearOperario(input)
    revalidatePath('/configuracion/operarios')
    return { ok: true as const, operario }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error creando operario',
    }
  }
}

export async function accionActualizarOperario(
  id: string,
  input: Partial<OperarioInput>
) {
  try {
    const operario = await actualizarOperario(id, input)
    revalidatePath('/configuracion/operarios')
    return { ok: true as const, operario }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error actualizando operario',
    }
  }
}

export async function accionEliminarOperario(id: string) {
  try {
    await eliminarOperario(id)
    revalidatePath('/configuracion/operarios')
    return { ok: true as const }
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message ?? 'Error eliminando operario',
    }
  }
}
