/**
 * Servicio de ROLES y permisos por modulo (Capa 9 — auth granular).
 *
 * Mario pidio el 25-abr: admin (mario.ortigueira@me.com) crea otros
 * admin u operarios, y a cada operario le marca solo los modulos que
 * pueda ver. Cliente entra por token y solo ve sus piezas.
 *
 * Tabla: usuario_perfiles (script 035).
 */

import { createClient } from '@/lib/supabase/server'

export type RolUsuario = 'admin' | 'operario' | 'cliente'

export interface PerfilUsuario {
  user_id: string
  rol: RolUsuario
  nombre: string | null
  email: string | null
  modulos_permitidos: string[]
  activo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Lista de modulos disponibles. El slug debe coincidir con el path
 * de la URL para que el filtrado del sidebar funcione.
 */
export const MODULOS_DISPONIBLES = [
  { slug: 'dashboard',     nombre: 'Dashboard' },
  { slug: 'presupuestos',  nombre: 'Presupuestos' },
  { slug: 'pedidos',       nombre: 'Pedidos' },
  { slug: 'planificador',  nombre: 'Planificador (Gantt)' },
  { slug: 'produccion',    nombre: 'Produccion' },
  { slug: 'agenda',        nombre: 'Agenda' },
  { slug: 'albaranes',     nombre: 'Albaranes' },
  { slug: 'etiquetas',     nombre: 'Etiquetas' },
  { slug: 'fichajes',      nombre: 'Fichajes' },
  { slug: 'materiales',    nombre: 'Materiales' },
  { slug: 'productos',     nombre: 'Productos' },
  { slug: 'tarifas',       nombre: 'Tarifas' },
  { slug: 'tratamientos',  nombre: 'Tratamientos' },
  { slug: 'trazabilidad',  nombre: 'Trazabilidad' },
  { slug: 'informes',      nombre: 'Informes' },
  { slug: 'configuracion', nombre: 'Configuracion' },
] as const

export const TODOS_LOS_MODULOS = MODULOS_DISPONIBLES.map(m => m.slug)

/**
 * Devuelve true si el perfil puede acceder al modulo `slug`.
 * Admin (modulos_permitidos contiene '*') siempre puede.
 */
export function puedeAccederAModulo(perfil: PerfilUsuario | null, slug: string): boolean {
  if (!perfil || !perfil.activo) return false
  if (perfil.rol === 'admin') return true
  if (perfil.modulos_permitidos.includes('*')) return true
  return perfil.modulos_permitidos.includes(slug)
}

/**
 * Recupera el perfil del usuario autenticado actual.
 * Devuelve null si no esta logueado o no tiene perfil aun.
 */
export async function obtenerPerfilActual(): Promise<PerfilUsuario | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('usuario_perfiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('activo', true)
    .maybeSingle()

  if (error || !data) return null
  return data as PerfilUsuario
}

/**
 * Lista todos los perfiles. Solo admin (la funcion SQL valida).
 */
export async function listarPerfiles(): Promise<PerfilUsuario[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('listar_perfiles_admin')
  if (error) throw new Error(error.message)
  return (data ?? []) as PerfilUsuario[]
}

/**
 * Asigna o actualiza el rol y los modulos de un usuario ya existente
 * en auth.users. Solo admin puede llamarla (SQL valida).
 */
export async function asignarRol(params: {
  user_id: string
  rol: RolUsuario
  nombre: string
  email: string
  modulos: string[]
}): Promise<PerfilUsuario> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('asignar_rol_usuario', {
    p_user_id: params.user_id,
    p_rol: params.rol,
    p_nombre: params.nombre,
    p_email: params.email,
    p_modulos: params.modulos,
  })
  if (error) throw new Error(error.message)
  return data as PerfilUsuario
}
