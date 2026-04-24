// lib/actions/informe-coste-pieza.ts
'use server'

/**
 * Server Actions del informe R6b-3c coste/consumo por pieza.
 */

import {
  listarCostesPorPieza,
  obtenerDetalleCostePieza,
  type ResumenCostePieza,
  type DetalleCostePieza,
} from '@/lib/services/informe-coste-pieza'

export async function accionListarCostesPieza():
  Promise<{ ok: true; items: ResumenCostePieza[] } | { ok: false; error: string }>
{
  try {
    const items = await listarCostesPorPieza()
    return { ok: true, items }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionDetalleCostePieza(pieza_id: string):
  Promise<{ ok: true; detalle: DetalleCostePieza } | { ok: false; error: string }>
{
  try {
    const detalle = await obtenerDetalleCostePieza(pieza_id)
    if (!detalle) return { ok: false, error: 'pieza no encontrada' }
    return { ok: true, detalle }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
