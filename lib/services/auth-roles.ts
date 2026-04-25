/**
 * Servicio de ROLES y permisos por modulo (Capa 9 — auth granular).
 *
 * SOLO SE USA DESDE SERVIDOR (importa lib/supabase/server). Los Client
 * Components deben importar tipos de '@/lib/types/auth-roles' y llamar
 * a las server actions de '@/lib/actions/auth-roles'.
 */

import { createClient } from '@/lib/supabase/server'
import type { PerfilUsuario, RolUsuario } from '@/lib/types/auth-roles'

export type {
  PerfilUsuario,
  RolUsuario,
} from '@/lib/types/auth-roles'

export {
  MODULOS_DISPONIBLES,
  TODOS_LOS_MODULOS,
  puedeAccederAModulo,
} from '@/lib/types/auth-roles'

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

export async function listarPerfiles(): Promise<PerfilUsuario[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('listar_perfiles_admin')
  if (error) throw new Error(error.message)
  return (data ?? []) as PerfilUsuario[]
}

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
