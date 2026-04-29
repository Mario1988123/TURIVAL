'use server'

/**
 * Server Actions de auth con roles. Llama al servicio que llama a Supabase.
 */

import { revalidatePath } from 'next/cache'
import {
  listarPerfiles,
  asignarRol,
  obtenerPerfilActual,
  type PerfilUsuario,
  type RolUsuario,
} from '@/lib/services/auth-roles'
import { obtenerSesion, esAdmin } from '@/lib/auth/permisos'
import { createAdminClient } from '@/lib/supabase/admin'

export async function accionListarPerfiles(): Promise<{
  ok: true
  perfiles: PerfilUsuario[]
} | { ok: false; error: string }> {
  try {
    const perfiles = await listarPerfiles()
    return { ok: true, perfiles }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionAsignarRol(params: {
  user_id: string
  rol: RolUsuario
  nombre: string
  email: string
  modulos: string[]
}): Promise<{ ok: true; perfil: PerfilUsuario } | { ok: false; error: string }> {
  try {
    const perfil = await asignarRol(params)
    revalidatePath('/configuracion/usuarios')
    return { ok: true, perfil }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function accionObtenerPerfilActual(): Promise<{
  ok: true
  perfil: PerfilUsuario | null
} | { ok: false; error: string }> {
  try {
    const perfil = await obtenerPerfilActual()
    return { ok: true, perfil }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

/**
 * Crea un usuario completo desde el CRM en una sola operación:
 *  1) Lo da de alta en auth.users (Supabase Admin API, email confirmado).
 *  2) Le asigna el rol y los módulos en usuario_perfiles.
 *
 * Solo admins pueden ejecutarla. Si la creación auth falla, se devuelve
 * el error sin haber tocado usuario_perfiles. Si la asignación de rol
 * falla después de crear el user, se intenta borrar el user para no
 * dejar cuentas huérfanas.
 */
export async function accionCrearUsuario(params: {
  email: string
  password: string
  nombre: string
  rol: RolUsuario
  modulos: string[]
}): Promise<{ ok: true; perfil: PerfilUsuario } | { ok: false; error: string }> {
  try {
    const sesion = await obtenerSesion()
    if (!esAdmin(sesion)) {
      return { ok: false, error: 'Solo un admin puede crear usuarios.' }
    }

    const email = params.email.trim().toLowerCase()
    const nombre = params.nombre.trim() || email.split('@')[0]
    if (!email || !params.password || params.password.length < 6) {
      return { ok: false, error: 'Email obligatorio y contraseña mínima de 6 caracteres.' }
    }

    const admin = createAdminClient()

    // 1) Crear en auth.users con email ya confirmado
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: params.password,
      email_confirm: true,
      user_metadata: { nombre },
    })
    if (authErr || !created?.user) {
      return { ok: false, error: authErr?.message ?? 'No se pudo crear el usuario en Auth.' }
    }
    const newUserId = created.user.id

    // 2) Asignar rol + módulos
    try {
      const modulosFinal = params.rol === 'admin' ? ['*'] : params.modulos
      const perfil = await asignarRol({
        user_id: newUserId,
        rol: params.rol,
        nombre,
        email,
        modulos: modulosFinal,
      })
      revalidatePath('/configuracion/usuarios')
      return { ok: true, perfil }
    } catch (e: unknown) {
      // Rollback: borrar el user de auth para no dejar huérfanos
      try { await admin.auth.admin.deleteUser(newUserId) } catch {}
      return {
        ok: false,
        error: 'Usuario creado en Auth pero falló asignar rol y se ha revertido. ' +
          (e instanceof Error ? e.message : 'Error desconocido'),
      }
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

/**
 * Elimina un usuario completamente: auth.users + usuario_perfiles.
 * Solo admins. NO permite borrarse a uno mismo (medida de seguridad).
 */
export async function accionEliminarUsuario(userIdABorrar: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const sesion = await obtenerSesion()
    if (!esAdmin(sesion)) return { ok: false, error: 'Solo un admin puede eliminar usuarios.' }
    if (sesion?.user_id === userIdABorrar) {
      return { ok: false, error: 'No puedes eliminarte a ti mismo.' }
    }
    const admin = createAdminClient()
    // Primero limpiar el perfil (FK)
    await admin.from('usuario_perfiles').delete().eq('user_id', userIdABorrar)
    // Después el user de auth
    const { error } = await admin.auth.admin.deleteUser(userIdABorrar)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/configuracion/usuarios')
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}
