// lib/actions/albaranes.ts
'use server'

/**
 * Server Actions de ALBARANES — Capa 7.
 *
 * Envuelven las funciones de `lib/services/albaranes.ts`.
 * Convención: devuelven { ok: true, ... } o { ok: false, error }.
 */

import { revalidatePath } from 'next/cache'
import {
  listarAlbaranes,
  obtenerAlbaran,
  listarPedidosElegibles,
  crearAlbaranDesdePedido,
  cambiarEstadoAlbaran,
  eliminarAlbaran,
  type EstadoAlbaran,
  type AlbaranListado,
  type AlbaranDetalle,
} from '@/lib/services/albaranes'

export async function accionListarAlbaranes(filtros?: { estado?: EstadoAlbaran; pedido_id?: string }):
  Promise<{ ok: true; albaranes: AlbaranListado[] } | { ok: false; error: string }>
{
  try {
    const albaranes = await listarAlbaranes(filtros)
    return { ok: true, albaranes }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionObtenerAlbaran(id: string):
  Promise<{ ok: true; albaran: AlbaranDetalle } | { ok: false; error: string }>
{
  try {
    const albaran = await obtenerAlbaran(id)
    if (!albaran) return { ok: false, error: 'no encontrado' }
    return { ok: true, albaran }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionPedidosElegibles():
  Promise<{ ok: true; pedidos: Awaited<ReturnType<typeof listarPedidosElegibles>> } | { ok: false; error: string }>
{
  try {
    const pedidos = await listarPedidosElegibles()
    return { ok: true, pedidos }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionCrearAlbaranDesdePedido(params: {
  pedido_id: string
  fecha_entrega?: string
  observaciones?: string
  piezas_ids?: string[]
}) {
  const res = await crearAlbaranDesdePedido(params)
  if (res.ok) revalidatePath('/albaranes')
  return res
}

export async function accionCambiarEstadoAlbaran(params: {
  albaran_id: string
  estado: EstadoAlbaran
  firma_cliente?: string
}) {
  const res = await cambiarEstadoAlbaran(params)
  if (res.ok) revalidatePath('/albaranes')
  return res
}

export async function accionEliminarAlbaran(albaran_id: string) {
  const res = await eliminarAlbaran(albaran_id)
  if (res.ok) revalidatePath('/albaranes')
  return res
}

import { crearAlbaranRecepcion } from '@/lib/services/albaranes'
export async function accionCrearAlbaranRecepcion(params: {
  cliente_id: string
  pedido_id?: string
  observaciones?: string
}) {
  const res = await crearAlbaranRecepcion(params)
  if (res.ok) revalidatePath('/albaranes')
  return res
}
