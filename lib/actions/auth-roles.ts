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
