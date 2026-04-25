/**
 * Tipos puros del sistema de roles. Sin imports de servidor para que
 * los Client Components puedan importarlos sin arrastrar lib/supabase/server.
 */

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

export function puedeAccederAModulo(perfil: PerfilUsuario | null, slug: string): boolean {
  if (!perfil || !perfil.activo) return false
  if (perfil.rol === 'admin') return true
  if (perfil.modulos_permitidos.includes('*')) return true
  return perfil.modulos_permitidos.includes(slug)
}
