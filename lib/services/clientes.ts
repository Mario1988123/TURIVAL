import { createClient } from './client'
import type { Cliente, ReferenciaCliente } from '../types/erp'

/**
 * Crear nuevo cliente
 */
export async function crearCliente(datos: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>): Promise<Cliente> {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No authenticated user')

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      ...datos,
      user_id: session.user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

/**
 * Actualizar cliente
 */
export async function actualizarCliente(
  cliente_id: string,
  datos: Partial<Omit<Cliente, 'id' | 'user_id' | 'created_at'>>
): Promise<Cliente> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clientes')
    .update({
      ...datos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cliente_id)
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

/**
 * Obtener cliente por ID
 */
export async function obtenerCliente(cliente_id: string): Promise<Cliente> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', cliente_id)
    .single()

  if (error) throw error
  return data as Cliente
}

/**
 * Listar clientes con filtros
 */
export interface FiltrosCliente {
  tipo?: 'precliente' | 'cliente_activo' | 'cliente_recurrente'
  activo?: boolean
  busqueda?: string
  limite?: number
  pagina?: number
}

export async function listarClientes(filtros: FiltrosCliente = {}) {
  const supabase = createClient()
  const limite = filtros.limite || 20
  const pagina = filtros.pagina || 0
  const offset = pagina * limite

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' })
    .order('nombre_comercial')
    .range(offset, offset + limite - 1)

  if (filtros.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros.busqueda) {
    query = query.or(
      `nombre_comercial.ilike.%${filtros.busqueda}%,razon_social.ilike.%${filtros.busqueda}%,email.ilike.%${filtros.busqueda}%`
    )
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    clientes: data as Cliente[],
    total: count || 0,
    pagina,
    paginas: Math.ceil((count || 0) / limite),
  }
}

/**
 * Cambiar tipo de cliente
 */
export async function cambiarTipoCliente(
  cliente_id: string,
  tipo: 'precliente' | 'cliente_activo' | 'cliente_recurrente'
): Promise<Cliente> {
  return actualizarCliente(cliente_id, { tipo })
}

/**
 * Crear referencia de cliente
 */
export async function crearReferenciaCliente(
  datos: Omit<ReferenciaCliente, 'id' | 'created_at' | 'updated_at'>
): Promise<ReferenciaCliente> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('referencias_cliente')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as ReferenciaCliente
}

/**
 * Obtener referencias de un cliente
 */
export async function obtenerReferenciasCliente(cliente_id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('referencias_cliente')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('referencia_cliente')

  if (error) throw error
  return data as ReferenciaCliente[]
}

/**
 * Obtener referencia específica
 */
export async function obtenerReferencia(referencia_id: string): Promise<ReferenciaCliente> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('referencias_cliente')
    .select('*')
    .eq('id', referencia_id)
    .single()

  if (error) throw error
  return data as ReferenciaCliente
}

/**
 * Actualizar referencia
 */
export async function actualizarReferencia(
  referencia_id: string,
  datos: Partial<Omit<ReferenciaCliente, 'id' | 'cliente_id' | 'created_at'>>
): Promise<ReferenciaCliente> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('referencias_cliente')
    .update({
      ...datos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', referencia_id)
    .select()
    .single()

  if (error) throw error
  return data as ReferenciaCliente
}

/**
 * Eliminar referencia
 */
export async function eliminarReferencia(referencia_id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('referencias_cliente')
    .delete()
    .eq('id', referencia_id)

  if (error) throw error
}

/**
 * Obtener estadísticas de cliente
 */
export async function obtenerEstadisticasCliente(cliente_id: string) {
  const supabase = createClient()

  // Presupuestos
  const { count: total_presupuestos } = await supabase
    .from('presupuestos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', cliente_id)

  // Pedidos totales
  const { count: total_pedidos } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', cliente_id)

  // Pedidos pendientes (no entregados)
  const { count: pedidos_pendientes } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', cliente_id)
    .neq('estado', 'entregado')
    .neq('estado', 'cancelado')

  // Facturacion total: suma todos los pedidos en estados que ya son
  // "trabajo realizado y vendido": completado, entregado, facturado.
  // (Antes solo contaba 'entregado' y por eso pedidos completados sin
  // entregar todavia no aparecian en la cuenta.)
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('total')
    .eq('cliente_id', cliente_id)
    .in('estado', ['completado', 'entregado', 'facturado'])

  const facturacion_total = pedidos?.reduce((sum, p) => sum + Number(p.total || 0), 0) || 0

  return {
    total_presupuestos: total_presupuestos || 0,
    total_pedidos: total_pedidos || 0,
    pedidos_pendientes: pedidos_pendientes || 0,
    facturacion_total,
  }
}
