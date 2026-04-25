// lib/actions/simulador-entrega.ts
'use server'

import {
  simularEntregaPresupuesto,
  listarPresupuestosPendientes,
  type ResultadoSimulacion,
  type PresupuestoPendiente,
} from '@/lib/services/simulador-entrega'

export async function accionSimularEntrega(presupuesto_id: string): Promise<ResultadoSimulacion> {
  return simularEntregaPresupuesto(presupuesto_id)
}

export async function accionPresupuestosPendientes(): Promise<{
  ok: true; items: PresupuestoPendiente[]
} | { ok: false; error: string }> {
  try {
    const items = await listarPresupuestosPendientes()
    return { ok: true, items }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
