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

/**
 * Auto-bootstrap del primer admin (mono-empresa Turiaval).
 *
 * Si el user actual no tiene fila en `usuario_perfiles` Y la tabla no
 * tiene NINGUN admin activo, se inserta a si mismo como admin con todos
 * los modulos. Idempotente: no hace nada si ya hay admin o si ya tiene
 * perfil.
 *
 * Usa el cliente admin (service_role) para SALTAR las RLS — la lectura
 * con cliente anon también la hacemos con admin client porque la RLS de
 * usuario_perfiles puede bloquear incluso el SELECT al user no formal.
 *
 * Si la SUPABASE_SERVICE_ROLE_KEY no está configurada en env vars, el
 * bootstrap falla silenciosamente y la UI muestra SQL listo para pegar.
 */
export async function bootstrapAdminPropio(): Promise<PerfilUsuario | null> {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return null

  // Cargar admin client. Si no hay key, abort silencioso.
  let admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
  try {
    const mod = await import('@/lib/supabase/admin')
    admin = mod.createAdminClient()
  } catch (e: any) {
    console.warn('[bootstrapAdminPropio] admin client no disponible:', e?.message)
    return null
  }

  // Si ya tiene perfil, no hace nada (idempotente)
  const { data: existente } = await admin
    .from('usuario_perfiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existente) return existente as PerfilUsuario

  // Solo se auto-promociona si NO hay ningun admin activo aun
  const { count } = await admin
    .from('usuario_perfiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('rol', 'admin')
    .eq('activo', true)
  if ((count ?? 0) > 0) return null

  // Nombre amistoso a partir del email: "mario.ortigueira@..." → "Mario"
  const local = user.email?.split('@')[0] ?? 'Admin'
  const primer = local.split(/[._-]/)[0]
  const nombre = primer.charAt(0).toUpperCase() + primer.slice(1)

  const { data, error } = await admin
    .from('usuario_perfiles')
    .insert({
      user_id: user.id,
      rol: 'admin',
      nombre,
      email: user.email ?? '',
      modulos_permitidos: ['*'],
      activo: true,
    })
    .select()
    .single()
  if (error) {
    console.warn('[bootstrapAdminPropio] no se pudo auto-crear admin:', error.message)
    return null
  }
  return data as PerfilUsuario
}
