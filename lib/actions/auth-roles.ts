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
 * Resetea la contraseña de un usuario y marca password_temporal=true
 * para que el próximo login le pida cambiarla. Solo admin.
 */
export async function accionResetearPassword(params: {
  user_id: string
  nueva_password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sesion = await obtenerSesion()
    if (!esAdmin(sesion)) return { ok: false, error: 'Solo un admin puede resetear contraseñas.' }
    if (params.nueva_password.length < 4) return { ok: false, error: 'Contraseña mínima de 4 caracteres.' }
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(params.user_id, { password: params.nueva_password })
    if (error) return { ok: false, error: error.message }
    await admin.from('usuario_perfiles').update({ password_temporal: true }).eq('user_id', params.user_id)
    revalidatePath('/configuracion/usuarios')
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

/**
 * El propio usuario cambia su contraseña. Limpia el flag
 * password_temporal para no seguir bloqueándole en /auth/cambiar-password.
 */
export async function accionCambiarMiPassword(nuevaPassword: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const sesion = await obtenerSesion()
    if (!sesion) return { ok: false, error: 'No hay sesión.' }
    if (nuevaPassword.length < 4) return { ok: false, error: 'Contraseña mínima de 4 caracteres.' }
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(sesion.user_id, { password: nuevaPassword })
    if (error) return { ok: false, error: error.message }
    await admin.from('usuario_perfiles').update({ password_temporal: false }).eq('user_id', sesion.user_id)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

/**
 * SEED: crea 7 operarios ficticios para pruebas, uno por especialidad.
 * Email: <nombre>@turiaval.es. Password: 1234. password_temporal=true
 * (les pedirá cambiarla al primer login).
 *
 * Es idempotente: si ya existe el email, lo salta.
 */
export async function accionCrearOperariosFicticios(): Promise<
  { ok: true; creados: number; omitidos: number } | { ok: false; error: string }
> {
  try {
    const sesion = await obtenerSesion()
    if (!esAdmin(sesion)) return { ok: false, error: 'Solo un admin puede crear datos de prueba.' }

    const admin = createAdminClient()

    // Cargar catalogo de especialidades para asignar la correspondiente
    const { data: especialidades } = await admin.from('especialidades').select('id, slug').eq('activo', true)
    const slugToId: Record<string, string> = {}
    ;(especialidades ?? []).forEach((e: any) => { slugToId[e.slug] = e.id })

    const FICTICIOS: { nombre: string; email: string; especialidades: string[]; color: string }[] = [
      { nombre: 'Juan',    email: 'juan@turiaval.es',    especialidades: ['lijador'],     color: '#2563eb' },
      { nombre: 'Pedro',   email: 'pedro@turiaval.es',   especialidades: ['masillador'],  color: '#0d9488' },
      { nombre: 'Luis',    email: 'luis@turiaval.es',    especialidades: ['fondeador'],   color: '#dc2626' },
      { nombre: 'Mario',   email: 'marito@turiaval.es',  especialidades: ['lacador'],     color: '#a855f7' },
      { nombre: 'Pepe',    email: 'pepe@turiaval.es',    especialidades: ['finalizado'],  color: '#f59e0b' },
      { nombre: 'Jose',    email: 'jose@turiaval.es',    especialidades: ['auxiliar'],    color: '#64748b' },
      { nombre: 'Antonio', email: 'antonio@turiaval.es', especialidades: ['encargado','lijador','masillador','fondeador','lacador','finalizado','auxiliar'], color: '#059669' },
    ]

    let creados = 0
    let omitidos = 0
    for (const op of FICTICIOS) {
      // ¿Ya existe?
      const { data: existing } = await admin.auth.admin.listUsers()
      const yaExiste = existing.users.some(u => u.email?.toLowerCase() === op.email.toLowerCase())
      if (yaExiste) { omitidos++; continue }

      // 1) Auth user
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email: op.email,
        password: '1234',
        email_confirm: true,
        user_metadata: { nombre: op.nombre },
      })
      if (authErr || !created?.user) { omitidos++; continue }
      const newUserId = created.user.id

      // 2) Perfil con password_temporal=true
      try {
        await asignarRol({
          user_id: newUserId,
          rol: 'operario',
          nombre: op.nombre,
          email: op.email,
          modulos: ['fichajes','planificador','agenda','produccion'],
        })
        await admin.from('usuario_perfiles').update({ password_temporal: true }).eq('user_id', newUserId)
      } catch {
        await admin.auth.admin.deleteUser(newUserId).catch(()=>{})
        omitidos++
        continue
      }

      // 3) Operario + especialidades
      const { data: opRow } = await admin
        .from('operarios')
        .insert({ nombre: op.nombre, color: op.color, activo: true, user_id: newUserId })
        .select('id')
        .single()
      if (opRow && op.especialidades.length > 0) {
        const filas = op.especialidades
          .map(slug => slugToId[slug])
          .filter(Boolean)
          .map(eid => ({ operario_id: (opRow as any).id, especialidad_id: eid }))
        if (filas.length > 0) await admin.from('operario_especialidades').insert(filas)
      }

      // 4) Horario default del taller (L-V, 7:00-16:00, pausas 10:00 (30m) y 14:00 (60m))
      if (opRow) {
        const horariosFilas = [1, 2, 3, 4, 5].map((dia_semana) => ({
          operario_id: (opRow as any).id,
          dia_semana,
          hora_entrada: '07:00',
          hora_salida: '16:00',
          pausa_inicio: '14:00',
          pausa_fin: '15:00',
          pausas: [
            { hora_inicio: '10:00', minutos: 30 },
            { hora_inicio: '14:00', minutos: 60 },
          ],
          horas_teoricas: 7.5,
          activo: true,
        }))
        await admin.from('horarios_operario').insert(horariosFilas)
          .then(({ error }) => { if (error) console.warn('[seed] horario_operario:', error.message) })
      }

      creados++
    }
    revalidatePath('/configuracion/usuarios')
    return { ok: true, creados, omitidos }
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
