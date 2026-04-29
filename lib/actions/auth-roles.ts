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
import {
  listarEspecialidades,
  type Especialidad,
} from '@/lib/services/especialidades'

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
export async function accionListarEspecialidades(): Promise<
  { ok: true; especialidades: Especialidad[] } | { ok: false; error: string }
> {
  try {
    const e = await listarEspecialidades()
    return { ok: true, especialidades: e }
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function accionCrearUsuario(params: {
  email: string
  password: string
  nombre: string
  rol: RolUsuario
  modulos: string[]
  /** Solo aplica si rol='operario': IDs de especialidades del catalogo. */
  especialidadIds?: string[]
  /** Solo aplica si rol='operario': color del operario para el planificador. */
  colorOperario?: string
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

    let admin
    try {
      admin = createAdminClient()
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'No se pudo inicializar el cliente admin.' }
    }

    // 1) Crear en auth.users con email ya confirmado
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: params.password,
      email_confirm: true,
      user_metadata: { nombre },
    })
    if (authErr || !created?.user) {
      const m = (authErr?.message ?? '').toLowerCase()
      if (m.includes('invalid api key') || m.includes('invalid jwt')) {
        return {
          ok: false,
          error: 'Invalid API key: la SUPABASE_SERVICE_ROLE_KEY no es válida. Verifica que has copiado la "service_role" (no la "anon") en Supabase Dashboard > Settings > API, la has pegado en Vercel > Settings > Environment Variables como SUPABASE_SERVICE_ROLE_KEY, y has hecho Redeploy.',
        }
      }
      return { ok: false, error: authErr?.message ?? 'No se pudo crear el usuario en Auth.' }
    }
    const newUserId = created.user.id

    // 2) Asignar rol + módulos
    let perfil: PerfilUsuario
    try {
      const modulosFinal = params.rol === 'admin' ? ['*'] : params.modulos
      perfil = await asignarRol({
        user_id: newUserId,
        rol: params.rol,
        nombre,
        email,
        modulos: modulosFinal,
      })
    } catch (e: unknown) {
      // Rollback: borrar el user de auth para no dejar huérfanos
      try { await admin.auth.admin.deleteUser(newUserId) } catch {}
      return {
        ok: false,
        error: 'Usuario creado en Auth pero falló asignar rol y se ha revertido. ' +
          (e instanceof Error ? e.message : 'Error desconocido'),
      }
    }

    // 3) Si es operario, dar de alta tambien en la tabla `operarios` y
    //    asignar especialidades. Si esto falla, el user/perfil ya creados
    //    se mantienen (no es critico — Mario puede completar despues).
    if (params.rol === 'operario') {
      try {
        const colores = ['#2563eb','#0d9488','#dc2626','#a855f7','#f59e0b','#10b981']
        const color = params.colorOperario || colores[Math.floor(Math.random()*colores.length)]
        const { data: opRow, error: opErr } = await admin
          .from('operarios')
          .insert({ nombre, color, activo: true, user_id: newUserId })
          .select('id')
          .single()
        if (opErr) {
          console.warn('[crearUsuario] no se pudo crear operario:', opErr.message)
        } else if (params.especialidadIds && params.especialidadIds.length > 0) {
          const filas = params.especialidadIds.map((eid) => ({
            operario_id: (opRow as any).id,
            especialidad_id: eid,
          }))
          const { error: espErr } = await admin.from('operario_especialidades').insert(filas)
          if (espErr) console.warn('[crearUsuario] no se pudieron asignar especialidades:', espErr.message)
        }
      } catch (e) {
        console.warn('[crearUsuario] error montando operario:', (e as Error).message)
      }
    }

    revalidatePath('/configuracion/usuarios')
    return { ok: true, perfil }
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
