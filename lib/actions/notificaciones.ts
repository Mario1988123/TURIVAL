'use server'

import {
  listarNotificaciones,
  obtenerResumenNotificaciones,
  type Notificacion,
  type ResumenNotificaciones,
} from '@/lib/services/notificaciones'

export async function accionListarNotificaciones(): Promise<{
  ok: true; items: Notificacion[]
} | { ok: false; error: string }> {
  try {
    const items = await listarNotificaciones()
    return { ok: true, items }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionResumenNotificaciones(): Promise<{
  ok: true; resumen: ResumenNotificaciones
} | { ok: false; error: string }> {
  try {
    const resumen = await obtenerResumenNotificaciones()
    return { ok: true, resumen }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
