/**
 * Servicios del modulo fichajes avanzado (Sesame-like).
 * Requiere scripts 039 y 040 ejecutados.
 *
 * Permisos: las funciones reservadas a admin (ajustarFichaje,
 * crearFestivo/eliminarFestivo, aprobarAusencia, eliminarAusencia)
 * lanzan ErrorAcceso si el usuario no es admin.
 */

import { createClient } from '@/lib/supabase/server'
import { obtenerSesion, esAdmin } from '@/lib/auth/permisos'

export class ErrorAcceso extends Error {
  constructor(msg = 'Acción reservada al administrador') {
    super(msg)
    this.name = 'ErrorAcceso'
  }
}

async function exigirAdmin() {
  const s = await obtenerSesion()
  if (!esAdmin(s)) throw new ErrorAcceso()
}

// =============================================================
// TIPOS
// =============================================================

export interface HorarioDia {
  id: string
  operario_id: string
  dia_semana: number
  hora_entrada: string
  hora_salida: string
  pausa_inicio: string | null
  pausa_fin: string | null
  horas_teoricas: number
  activo: boolean
}

export interface Festivo {
  id: string
  fecha: string
  nombre: string
  ambito: 'nacional' | 'autonomico' | 'local' | 'empresa'
  notas: string | null
}

export type TipoAusencia =
  | 'vacaciones' | 'permiso_retribuido' | 'permiso_no_retribuido'
  | 'baja_medica' | 'accidente_laboral' | 'asuntos_propios'
  | 'festivo_trabajado' | 'compensacion_festivo' | 'formacion' | 'otros'

export interface Ausencia {
  id: string
  operario_id: string
  tipo: TipoAusencia
  fecha_inicio: string
  fecha_fin: string
  horas_compensables: number | null
  notas: string | null
  aprobada: boolean
  aprobada_por: string | null
  aprobada_en: string | null
  created_at: string
}

export type CategoriaDoc =
  | 'nomina' | 'justificante_medico' | 'contrato' | 'baja_alta_ss'
  | 'ticket_dieta' | 'formacion' | 'otros'

export interface DocumentoOperario {
  id: string
  operario_id: string
  categoria: CategoriaDoc
  nombre: string
  storage_path: string
  mime_type: string | null
  tamano_bytes: number | null
  fecha_documento: string | null
  notas: string | null
  created_at: string
}

export interface SaldoHoras {
  fecha: string
  trabajadas_min: number
  teoricas_min: number
  saldo_min: number       // positivo = horas extra; negativo = deuda
  ausencia: TipoAusencia | null
  festivo: string | null
}

// =============================================================
// HORARIOS
// =============================================================

export async function listarHorariosOperario(operario_id: string): Promise<HorarioDia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('horarios_operario')
    .select('*')
    .eq('operario_id', operario_id)
    .order('dia_semana')
  if (error) throw new Error(error.message)
  return (data ?? []) as HorarioDia[]
}

export async function guardarHorarioDia(input: {
  operario_id: string
  dia_semana: number
  hora_entrada: string
  hora_salida: string
  pausa_inicio?: string | null
  pausa_fin?: string | null
}): Promise<HorarioDia> {
  await exigirAdmin()
  const supabase = await createClient()
  const horas_teoricas = calcularHorasTeoricas(input)
  const { data, error } = await supabase
    .from('horarios_operario')
    .upsert({
      operario_id: input.operario_id,
      dia_semana: input.dia_semana,
      hora_entrada: input.hora_entrada,
      hora_salida: input.hora_salida,
      pausa_inicio: input.pausa_inicio ?? null,
      pausa_fin: input.pausa_fin ?? null,
      horas_teoricas,
      activo: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'operario_id,dia_semana' })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HorarioDia
}

function calcularHorasTeoricas(h: { hora_entrada: string; hora_salida: string; pausa_inicio?: string | null; pausa_fin?: string | null }): number {
  const toMin = (s: string) => {
    const [h2, m] = s.split(':').map(Number)
    return h2 * 60 + m
  }
  const total = toMin(h.hora_salida) - toMin(h.hora_entrada)
  const pausa = h.pausa_inicio && h.pausa_fin ? toMin(h.pausa_fin) - toMin(h.pausa_inicio) : 0
  return Math.max(0, (total - pausa) / 60)
}

// =============================================================
// FESTIVOS
// =============================================================

export async function listarFestivos(anio?: number): Promise<Festivo[]> {
  const supabase = await createClient()
  let q = supabase.from('festivos').select('*').order('fecha')
  if (anio) {
    q = q.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Festivo[]
}

export async function crearFestivo(f: Omit<Festivo, 'id'>): Promise<Festivo> {
  await exigirAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('festivos')
    .insert({ fecha: f.fecha, nombre: f.nombre, ambito: f.ambito, notas: f.notas })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Festivo
}

export async function eliminarFestivo(id: string): Promise<void> {
  await exigirAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('festivos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// =============================================================
// AUSENCIAS
// =============================================================

export async function listarAusencias(operario_id?: string): Promise<Ausencia[]> {
  const supabase = await createClient()
  let q = supabase.from('ausencias').select('*').order('fecha_inicio', { ascending: false })
  if (operario_id) q = q.eq('operario_id', operario_id)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Ausencia[]
}

export async function crearAusencia(input: {
  operario_id: string
  tipo: TipoAusencia
  fecha_inicio: string
  fecha_fin: string
  horas_compensables?: number | null
  notas?: string | null
  aprobada?: boolean
}): Promise<Ausencia> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('ausencias')
    .insert({
      operario_id: input.operario_id,
      tipo: input.tipo,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      horas_compensables: input.horas_compensables ?? null,
      notas: input.notas ?? null,
      aprobada: input.aprobada ?? false,
      aprobada_por: input.aprobada ? user?.id ?? null : null,
      aprobada_en: input.aprobada ? new Date().toISOString() : null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Ausencia
}

export async function aprobarAusencia(id: string): Promise<void> {
  await exigirAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('ausencias')
    .update({ aprobada: true, aprobada_por: user?.id ?? null, aprobada_en: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function eliminarAusencia(id: string): Promise<void> {
  await exigirAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('ausencias').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// =============================================================
// SALDO DE HORAS (diario / mensual)
// =============================================================

export async function calcularSaldosOperario(
  operario_id: string,
  desde: string,    // YYYY-MM-DD
  hasta: string,
): Promise<SaldoHoras[]> {
  const supabase = await createClient()
  const [horarios, festivos, ausencias, fichajes] = await Promise.all([
    listarHorariosOperario(operario_id),
    supabase.from('festivos').select('fecha, nombre').gte('fecha', desde).lte('fecha', hasta).then(r => (r.data ?? []) as { fecha: string; nombre: string }[]),
    supabase.from('ausencias').select('*').eq('operario_id', operario_id)
      .gte('fecha_fin', desde).lte('fecha_inicio', hasta)
      .then(r => (r.data ?? []) as Ausencia[]),
    supabase.from('fichajes').select('*').eq('operario_id', operario_id)
      .gte('ocurrido_en', `${desde}T00:00:00Z`).lte('ocurrido_en', `${hasta}T23:59:59Z`)
      .order('ocurrido_en')
      .then(r => (r.data ?? []) as any[]),
  ])

  const horarioPorDia = new Map<number, HorarioDia>()
  for (const h of horarios) horarioPorDia.set(h.dia_semana, h)
  const festivoPorFecha = new Map<string, string>()
  for (const f of festivos) festivoPorFecha.set(f.fecha, f.nombre)

  // Fichajes agrupados por día
  const fichajesPorDia = new Map<string, any[]>()
  for (const f of fichajes) {
    const dia = f.ocurrido_en.slice(0, 10)
    if (!fichajesPorDia.has(dia)) fichajesPorDia.set(dia, [])
    fichajesPorDia.get(dia)!.push(f)
  }

  const saldos: SaldoHoras[] = []
  const cursor = new Date(desde)
  const fin = new Date(hasta)
  while (cursor <= fin) {
    const fechaStr = cursor.toISOString().slice(0, 10)
    const horario = horarioPorDia.get(cursor.getDay())
    const teoricas_min = horario ? Math.round(Number(horario.horas_teoricas) * 60) : 0
    const trabajadas_min = calcularMinutosTrabajados(fichajesPorDia.get(fechaStr) ?? [])
    const ausencia = ausencias.find(a => fechaStr >= a.fecha_inicio && fechaStr <= a.fecha_fin)?.tipo ?? null
    const festivo = festivoPorFecha.get(fechaStr) ?? null
    saldos.push({
      fecha: fechaStr,
      trabajadas_min,
      teoricas_min: ausencia || festivo ? 0 : teoricas_min,
      saldo_min: trabajadas_min - (ausencia || festivo ? 0 : teoricas_min),
      ausencia,
      festivo,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return saldos
}

function calcularMinutosTrabajados(fichajes: any[]): number {
  // Pares entrada → salida, descontando pausas. Si quedan abiertos, contar hasta NOW.
  let total = 0
  let entradaActiva: Date | null = null
  let pausaActiva: Date | null = null
  for (const f of fichajes) {
    const t = new Date(f.ocurrido_en)
    if (f.tipo === 'entrada') {
      entradaActiva = t
    } else if (f.tipo === 'salida' && entradaActiva) {
      total += (t.getTime() - entradaActiva.getTime()) / 60_000
      entradaActiva = null
    } else if (f.tipo === 'pausa_inicio') {
      pausaActiva = t
    } else if (f.tipo === 'pausa_fin' && pausaActiva) {
      total -= (t.getTime() - pausaActiva.getTime()) / 60_000
      pausaActiva = null
    }
  }
  return Math.max(0, Math.round(total))
}

// =============================================================
// AJUSTE DE FICHAJE (admin)
// =============================================================

export async function ajustarFichaje(input: {
  fichaje_id: string
  nueva_fecha_hora: string
  motivo: string
}): Promise<void> {
  await exigirAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('fichajes')
    .update({
      ocurrido_en: input.nueva_fecha_hora,
      ajustado_por: user?.id ?? null,
      ajustado_en: new Date().toISOString(),
      motivo_ajuste: input.motivo,
    })
    .eq('id', input.fichaje_id)
  if (error) throw new Error(error.message)
}

export async function autoCerrarFichajeAbierto(operario_id: string): Promise<boolean> {
  // Si el operario lleva >12h con entrada sin salida, cerrar automáticamente
  // a la hora de salida teórica de su horario.
  const supabase = await createClient()
  const haceMucho = new Date()
  haceMucho.setHours(haceMucho.getHours() - 12)
  const { data: ult } = await supabase
    .from('fichajes')
    .select('id, tipo, ocurrido_en')
    .eq('operario_id', operario_id)
    .order('ocurrido_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ult || (ult as any).tipo !== 'entrada') return false
  const ini = new Date((ult as any).ocurrido_en)
  if (ini > haceMucho) return false
  // Cerrar en hora_salida teórica del día de la entrada
  const horarios = await listarHorariosOperario(operario_id)
  const dia = ini.getDay()
  const horario = horarios.find(h => h.dia_semana === dia)
  const cierre = new Date(ini)
  if (horario) {
    const [hh, mm] = horario.hora_salida.split(':').map(Number)
    cierre.setHours(hh, mm, 0, 0)
  } else {
    cierre.setHours(17, 0, 0, 0)
  }
  await supabase.from('fichajes').insert({
    operario_id,
    tipo: 'salida',
    ocurrido_en: cierre.toISOString(),
    auto_generado: true,
    notas: 'Salida auto-generada por olvido (>12h sin cerrar)',
  })
  return true
}

// =============================================================
// DOCUMENTOS
// =============================================================

export async function listarDocumentosOperario(operario_id: string): Promise<DocumentoOperario[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos_operario')
    .select('*')
    .eq('operario_id', operario_id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as DocumentoOperario[]
}

export async function registrarDocumento(input: {
  operario_id: string
  categoria: CategoriaDoc
  nombre: string
  storage_path: string
  mime_type?: string | null
  tamano_bytes?: number | null
  fecha_documento?: string | null
  notas?: string | null
}): Promise<DocumentoOperario> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('documentos_operario')
    .insert({ ...input, subido_por: user?.id ?? null })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as DocumentoOperario
}

export async function urlFirmadaDocumento(storage_path: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('documentos-operarios')
    .createSignedUrl(storage_path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function eliminarDocumento(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('documentos_operario')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()
  if (doc?.storage_path) {
    await supabase.storage.from('documentos-operarios').remove([doc.storage_path])
  }
  await supabase.from('documentos_operario').delete().eq('id', id)
}
