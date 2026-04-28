/**
 * Helpers de permisos para Turiaval (mono-empresa).
 *
 * Roles (usuario_perfiles.rol):
 *   - admin    : Mario / oficina. Acceso total.
 *   - operario : taller. Fichar, pedir ausencias, ver calendarios y
 *                horarios propios. NO puede ajustar fichajes ni ver
 *                datos de otros operarios.
 *   - cliente  : portal externo (otra capa).
 *
 * Reglas para FICHAJES (Mario punto):
 *   - Solo admin: ajustar fichajes ajenos, auto-cerrar, exportar
 *     inspección, alta/baja festivos, gestión horarios de otros.
 *   - Operario: fichar entrada/salida/pausa, pedir ausencia (queda
 *     pendiente de aprobación), ver SU calendario, ver SU saldo.
 */

import { createClient } from '@/lib/supabase/server'

export interface SesionUsuario {
  user_id: string
  rol: 'admin' | 'operario' | 'cliente' | null
  operario_id: string | null
  nombre: string | null
}

export async function obtenerSesion(): Promise<SesionUsuario | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [perfilRes, opRes] = await Promise.all([
    supabase.from('usuario_perfiles').select('rol, nombre').eq('user_id', user.id).maybeSingle(),
    supabase.from('operarios').select('id, nombre').eq('user_id', user.id).maybeSingle(),
  ])

  const perfil = (perfilRes.data ?? null) as any
  const op = (opRes.data ?? null) as any

  return {
    user_id: user.id,
    rol: perfil?.rol ?? (op ? 'operario' : null),
    operario_id: op?.id ?? null,
    nombre: perfil?.nombre ?? op?.nombre ?? user.email ?? null,
  }
}

export function esAdmin(s: SesionUsuario | null): boolean {
  return s?.rol === 'admin'
}

export function esOperario(s: SesionUsuario | null): boolean {
  return s?.rol === 'operario' || (!!s && !!s.operario_id)
}

export function puedeAjustarFichaje(s: SesionUsuario | null): boolean {
  return esAdmin(s)
}

export function puedeVerFichajesDe(s: SesionUsuario | null, operario_id: string): boolean {
  if (esAdmin(s)) return true
  return s?.operario_id === operario_id
}

export function puedeGestionarFestivos(s: SesionUsuario | null): boolean {
  return esAdmin(s)
}

export function puedeAprobarAusencia(s: SesionUsuario | null): boolean {
  return esAdmin(s)
}

export function puedeSubirDocumento(s: SesionUsuario | null, operario_id: string): boolean {
  // Admin sube cualquier doc; operario solo sube los suyos
  if (esAdmin(s)) return true
  return s?.operario_id === operario_id
}
