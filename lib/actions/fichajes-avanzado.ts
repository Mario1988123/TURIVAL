'use server'

import { revalidatePath } from 'next/cache'
import {
  listarHorariosOperario,
  guardarHorarioDia,
  listarFestivos,
  crearFestivo as svcCrearFestivo,
  eliminarFestivo as svcEliminarFestivo,
  listarAusencias,
  crearAusencia as svcCrearAusencia,
  aprobarAusencia as svcAprobarAusencia,
  eliminarAusencia as svcEliminarAusencia,
  calcularSaldosOperario,
  ajustarFichaje as svcAjustarFichaje,
  autoCerrarFichajeAbierto,
  listarDocumentosOperario,
  registrarDocumento,
  urlFirmadaDocumento,
  eliminarDocumento as svcEliminarDocumento,
  type Festivo, type Ausencia, type HorarioDia, type DocumentoOperario,
  type SaldoHoras, type TipoAusencia, type CategoriaDoc,
} from '@/lib/services/fichajes-avanzado'

const wrap = <T>(fn: () => Promise<T>) =>
  fn().then(d => ({ ok: true as const, data: d })).catch((e: any) => ({ ok: false as const, error: e?.message ?? 'Error' }))

export async function accionListarHorarios(operario_id: string) {
  return wrap(() => listarHorariosOperario(operario_id))
}
export async function accionGuardarHorario(input: { operario_id: string; dia_semana: number; hora_entrada: string; hora_salida: string; pausa_inicio?: string | null; pausa_fin?: string | null }) {
  const r = await wrap(() => guardarHorarioDia(input))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

export async function accionListarFestivos(anio?: number) {
  return wrap(() => listarFestivos(anio))
}
export async function accionCrearFestivo(f: Omit<Festivo, 'id'>) {
  const r = await wrap(() => svcCrearFestivo(f))
  if (r.ok) revalidatePath('/fichajes')
  return r
}
export async function accionEliminarFestivo(id: string) {
  const r = await wrap(() => svcEliminarFestivo(id))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

export async function accionListarAusencias(operario_id?: string) {
  return wrap(() => listarAusencias(operario_id))
}
export async function accionCrearAusencia(input: { operario_id: string; tipo: TipoAusencia; fecha_inicio: string; fecha_fin: string; horas_compensables?: number | null; notas?: string | null; aprobada?: boolean }) {
  const r = await wrap(() => svcCrearAusencia(input))
  if (r.ok) revalidatePath('/fichajes')
  return r
}
export async function accionAprobarAusencia(id: string) {
  const r = await wrap(() => svcAprobarAusencia(id))
  if (r.ok) revalidatePath('/fichajes')
  return r
}
export async function accionEliminarAusencia(id: string) {
  const r = await wrap(() => svcEliminarAusencia(id))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

export async function accionCalcularSaldos(operario_id: string, desde: string, hasta: string) {
  return wrap(() => calcularSaldosOperario(operario_id, desde, hasta))
}

export async function accionAjustarFichaje(input: { fichaje_id: string; nueva_fecha_hora: string; motivo: string }) {
  const r = await wrap(() => svcAjustarFichaje(input))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

export async function accionAutoCerrar(operario_id: string) {
  const r = await wrap(() => autoCerrarFichajeAbierto(operario_id))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

export async function accionListarDocumentos(operario_id: string) {
  return wrap(() => listarDocumentosOperario(operario_id))
}
export async function accionRegistrarDocumento(input: Parameters<typeof registrarDocumento>[0]) {
  const r = await wrap(() => registrarDocumento(input))
  if (r.ok) revalidatePath('/fichajes')
  return r
}
export async function accionUrlFirmada(storage_path: string) {
  return wrap(() => urlFirmadaDocumento(storage_path))
}
export async function accionEliminarDocumento(id: string) {
  const r = await wrap(() => svcEliminarDocumento(id))
  if (r.ok) revalidatePath('/fichajes')
  return r
}

// Re-export types
export type { Festivo, Ausencia, HorarioDia, DocumentoOperario, SaldoHoras, TipoAusencia, CategoriaDoc }
