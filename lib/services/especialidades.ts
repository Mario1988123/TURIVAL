/**
 * Servicio de especialidades de operario (script 043).
 *
 * Mono-empresa Turiaval: catalogo de especialidades (lijador,
 * fondeador, pintor...) que se asignan N:M a cada operario.
 */

import { createClient } from '@/lib/supabase/server'

export interface Especialidad {
  id: string
  slug: string
  nombre: string
  color: string
  orden: number
  activo: boolean
}

export async function listarEspecialidades(): Promise<Especialidad[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('especialidades')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) {
    // Tabla no existe aun (script 043 no aplicado)
    if ((error as any).code === '42P01') return []
    throw new Error(error.message)
  }
  return (data ?? []) as Especialidad[]
}

export async function asignarEspecialidadesAOperario(
  operarioId: string,
  especialidadIds: string[],
): Promise<void> {
  const supabase = await createClient()
  // Borrar las que tenia y reinsertar (mas simple que diff)
  await supabase.from('operario_especialidades').delete().eq('operario_id', operarioId)
  if (especialidadIds.length === 0) return
  const filas = especialidadIds.map((eid) => ({ operario_id: operarioId, especialidad_id: eid }))
  const { error } = await supabase.from('operario_especialidades').insert(filas)
  if (error) throw new Error(error.message)
}

export async function listarEspecialidadesDeOperario(operarioId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operario_especialidades')
    .select('especialidad_id')
    .eq('operario_id', operarioId)
  if (error) return []
  return (data ?? []).map((r: any) => r.especialidad_id)
}
