// lib/services/fichajes.ts
/**
 * Service del MÓDULO DE FICHAJES (Capa operativa paralela).
 *
 * Persistencia: tabla `fichajes` creada por scripts/031_tabla_fichajes.sql.
 * Si la tabla no existe, las funciones devuelven un error amable con el
 * hint de ejecutar ese script primero (no revientan la UI).
 *
 * Tipos de fichaje soportados:
 *   - entrada / salida           → jornada individual por operario
 *   - pausa_inicio / pausa_fin   → pausas individuales (ej. café)
 *   - descanso_global_inicio/fin → pausa global del taller (botones del Planificador)
 *   - tarea_inicio / tarea_fin   → log fino por tarea (futuro; se mantiene schema)
 *
 * Reglas:
 *   · Un operario NO puede fichar entrada si ya tiene una entrada sin salida
 *     (se detecta mirando el último fichaje de entrada/salida).
 *   · Tampoco puede fichar salida sin una entrada previa abierta.
 *   · Pausa_inicio requiere estar "dentro" (entrada sin salida).
 *   · Pausa_fin requiere tener una pausa abierta.
 *   · Descanso_global no tiene estas reglas — es un evento informativo.
 *
 * Cálculo de horas:
 *   Para un día dado, ordenamos fichajes por `ocurrido_en` y sumamos
 *   intervalos (entrada → salida/fin de día) descontando pausas.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export type TipoFichaje =
  | 'entrada'
  | 'salida'
  | 'pausa_inicio'
  | 'pausa_fin'
  | 'descanso_global_inicio'
  | 'descanso_global_fin'
  | 'tarea_inicio'
  | 'tarea_fin'

export interface FichajeRow {
  id: string
  operario_id: string | null
  tipo: TipoFichaje
  ocurrido_en: string   // ISO
  duracion_minutos: number | null
  tarea_id: string | null
  notas: string | null
  creado_por: string | null
  created_at: string
}

export interface Resultado<T = void> {
  ok: boolean
  data?: T
  error?: string
  hint?: 'instalar_031'
}

export interface EstadoOperario {
  operario_id: string
  nombre: string
  rol: string
  // Estado actual inferido del último fichaje de hoy
  estado: 'fuera' | 'dentro' | 'en_pausa'
  fichado_desde: string | null   // ISO de entrada si 'dentro' o 'en_pausa'
  pausa_inicio: string | null    // ISO si 'en_pausa'
  minutos_trabajados_hoy: number
  minutos_pausado_hoy: number
  ultimo_fichaje: FichajeRow | null
}

export interface ResumenDiarioOperario {
  operario_id: string
  nombre: string
  rol: string
  fecha: string   // YYYY-MM-DD
  primera_entrada: string | null
  ultima_salida: string | null
  minutos_trabajados: number
  minutos_pausado: number
  num_entradas: number
  num_pausas: number
  fichajes: FichajeRow[]
}

export interface DescansoGlobalActivo {
  activo: boolean
  inicio: string | null
  minutos_transcurridos: number
}

// =============================================================
// HELPERS
// =============================================================

function hoyISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function diaISO(fecha: Date): string {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function finDiaISO(fecha: Date): string {
  const d = new Date(fecha)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function esErrorTablaFichajes(msg: string | undefined): boolean {
  if (!msg) return false
  const m = msg.toLowerCase()
  return m.includes('fichajes') && (m.includes('does not exist') || m.includes('no existe') || m.includes('relation') || m.includes('schema cache'))
}

function hintInstalar031<T = void>(err?: string): Resultado<T> {
  void err
  return {
    ok: false,
    error: 'La tabla "fichajes" aún no existe. Ejecuta scripts/031_tabla_fichajes.sql en Supabase.',
    hint: 'instalar_031',
  }
}

// =============================================================
// CONSULTAS
// =============================================================

export async function obtenerFichajesDia(operario_id: string, fecha: Date = new Date()): Promise<Resultado<FichajeRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fichajes')
    .select('*')
    .eq('operario_id', operario_id)
    .gte('ocurrido_en', diaISO(fecha))
    .lte('ocurrido_en', finDiaISO(fecha))
    .order('ocurrido_en', { ascending: true })
  if (error) {
    if (esErrorTablaFichajes(error.message)) return hintInstalar031(error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, data: (data ?? []) as FichajeRow[] }
}

/**
 * Lista operarios activos con su estado actual (dentro / fuera / en_pausa)
 * y minutos trabajados hoy. Pensado para el dashboard de fichajes.
 */
export async function listarEstadoOperariosHoy(): Promise<Resultado<EstadoOperario[]>> {
  const supabase = await createClient()

  const { data: operarios, error: errOps } = await supabase
    .from('operarios')
    .select('id, nombre, rol, activo')
    .eq('activo', true)
    .order('nombre')
  if (errOps) return { ok: false, error: errOps.message }

  const { data: fichajesHoy, error: errF } = await supabase
    .from('fichajes')
    .select('*')
    .gte('ocurrido_en', hoyISO())
    .order('ocurrido_en', { ascending: true })
  if (errF) {
    if (esErrorTablaFichajes(errF.message)) return hintInstalar031(errF.message)
    return { ok: false, error: errF.message }
  }

  const porOperario = new Map<string, FichajeRow[]>()
  for (const f of ((fichajesHoy ?? []) as FichajeRow[])) {
    if (!f.operario_id) continue
    const arr = porOperario.get(f.operario_id) ?? []
    arr.push(f)
    porOperario.set(f.operario_id, arr)
  }

  const resultado: EstadoOperario[] = (operarios ?? []).map((o: any) => {
    const fichajes = (porOperario.get(o.id) ?? []) as FichajeRow[]
    const calc = calcularEstadoYMinutos(fichajes)
    return {
      operario_id: o.id,
      nombre: o.nombre,
      rol: o.rol ?? '',
      estado: calc.estado,
      fichado_desde: calc.fichado_desde,
      pausa_inicio: calc.pausa_inicio,
      minutos_trabajados_hoy: calc.minutos_trabajados,
      minutos_pausado_hoy: calc.minutos_pausado,
      ultimo_fichaje: fichajes.length > 0 ? fichajes[fichajes.length - 1] : null,
    }
  })

  return { ok: true, data: resultado }
}

/**
 * Histórico de N días para un operario.
 */
export async function resumenOperarioRango(params: {
  operario_id: string
  desde: Date
  hasta: Date
}): Promise<Resultado<ResumenDiarioOperario[]>> {
  const supabase = await createClient()
  const { data: operario, error: errO } = await supabase
    .from('operarios')
    .select('id, nombre, rol')
    .eq('id', params.operario_id)
    .single()
  if (errO) return { ok: false, error: errO.message }

  const { data, error } = await supabase
    .from('fichajes')
    .select('*')
    .eq('operario_id', params.operario_id)
    .gte('ocurrido_en', diaISO(params.desde))
    .lte('ocurrido_en', finDiaISO(params.hasta))
    .order('ocurrido_en', { ascending: true })
  if (error) {
    if (esErrorTablaFichajes(error.message)) return hintInstalar031(error.message)
    return { ok: false, error: error.message }
  }

  // Agrupar por día YYYY-MM-DD
  const porDia = new Map<string, FichajeRow[]>()
  for (const f of ((data ?? []) as FichajeRow[])) {
    const dia = f.ocurrido_en.slice(0, 10)
    const arr = porDia.get(dia) ?? []
    arr.push(f)
    porDia.set(dia, arr)
  }

  const resumenes: ResumenDiarioOperario[] = []
  // Recorrer día a día del rango para incluir días sin fichaje
  const cursor = new Date(params.desde)
  cursor.setHours(0, 0, 0, 0)
  const hasta = new Date(params.hasta)
  hasta.setHours(0, 0, 0, 0)
  while (cursor <= hasta) {
    const diaKey = cursor.toISOString().slice(0, 10)
    const fichajes = porDia.get(diaKey) ?? []
    const calc = calcularEstadoYMinutos(fichajes)
    const entradas = fichajes.filter(f => f.tipo === 'entrada')
    const salidas = fichajes.filter(f => f.tipo === 'salida')
    resumenes.push({
      operario_id: params.operario_id,
      nombre: (operario as any).nombre,
      rol: (operario as any).rol ?? '',
      fecha: diaKey,
      primera_entrada: entradas[0]?.ocurrido_en ?? null,
      ultima_salida: salidas[salidas.length - 1]?.ocurrido_en ?? null,
      minutos_trabajados: calc.minutos_trabajados,
      minutos_pausado: calc.minutos_pausado,
      num_entradas: entradas.length,
      num_pausas: fichajes.filter(f => f.tipo === 'pausa_inicio').length,
      fichajes,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return { ok: true, data: resumenes }
}

export async function obtenerDescansoGlobalActivo(): Promise<Resultado<DescansoGlobalActivo>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fichajes')
    .select('*')
    .in('tipo', ['descanso_global_inicio', 'descanso_global_fin'])
    .order('ocurrido_en', { ascending: false })
    .limit(1)
  if (error) {
    if (esErrorTablaFichajes(error.message)) return hintInstalar031(error.message)
    return { ok: false, error: error.message }
  }
  const ultimo = (data ?? [])[0] as FichajeRow | undefined
  if (!ultimo || ultimo.tipo === 'descanso_global_fin') {
    return { ok: true, data: { activo: false, inicio: null, minutos_transcurridos: 0 } }
  }
  const inicio = new Date(ultimo.ocurrido_en).getTime()
  const transcurridos = Math.round((Date.now() - inicio) / 60_000)
  return { ok: true, data: { activo: true, inicio: ultimo.ocurrido_en, minutos_transcurridos: transcurridos } }
}

// =============================================================
// MUTACIONES
// =============================================================

export async function registrarFichaje(params: {
  operario_id: string
  tipo: TipoFichaje
  notas?: string
  tarea_id?: string
}): Promise<Resultado<FichajeRow>> {
  const supabase = await createClient()

  // Validaciones de estado
  if (['entrada', 'salida', 'pausa_inicio', 'pausa_fin'].includes(params.tipo)) {
    const estado = await listarEstadoOperariosHoy()
    if (estado.ok && estado.data) {
      const op = estado.data.find(e => e.operario_id === params.operario_id)
      if (op) {
        if (params.tipo === 'entrada' && (op.estado === 'dentro' || op.estado === 'en_pausa')) {
          return { ok: false, error: 'Ya hay una entrada abierta sin salida hoy' }
        }
        if (params.tipo === 'salida' && op.estado === 'fuera') {
          return { ok: false, error: 'No hay entrada abierta para cerrar' }
        }
        if (params.tipo === 'pausa_inicio' && op.estado !== 'dentro') {
          return { ok: false, error: 'Solo se puede iniciar pausa estando "dentro"' }
        }
        if (params.tipo === 'pausa_fin' && op.estado !== 'en_pausa') {
          return { ok: false, error: 'No hay pausa abierta que cerrar' }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('fichajes')
    .insert({
      operario_id: params.operario_id,
      tipo: params.tipo,
      tarea_id: params.tarea_id ?? null,
      notas: params.notas ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (esErrorTablaFichajes(error.message)) return hintInstalar031(error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data as FichajeRow }
}

export async function registrarDescansoGlobal(params: {
  inicio: boolean
  notas?: string
}): Promise<Resultado<FichajeRow>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fichajes')
    .insert({
      operario_id: null,
      tipo: params.inicio ? 'descanso_global_inicio' : 'descanso_global_fin',
      notas: params.notas ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (esErrorTablaFichajes(error.message)) return hintInstalar031(error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data as FichajeRow }
}

// =============================================================
// CÁLCULO PURO
// =============================================================

/**
 * A partir de los fichajes ORDENADOS por fecha de un operario en un día,
 * devuelve estado actual y minutos trabajados/pausados.
 */
function calcularEstadoYMinutos(fichajes: FichajeRow[]): {
  estado: 'fuera' | 'dentro' | 'en_pausa'
  fichado_desde: string | null
  pausa_inicio: string | null
  minutos_trabajados: number
  minutos_pausado: number
} {
  let estado: 'fuera' | 'dentro' | 'en_pausa' = 'fuera'
  let fichadoDesde: string | null = null
  let pausaInicio: string | null = null
  let minutosTrabajados = 0
  let minutosPausado = 0

  let entradaActual: Date | null = null
  let pausaActual: Date | null = null

  for (const f of fichajes) {
    const t = new Date(f.ocurrido_en)
    switch (f.tipo) {
      case 'entrada':
        entradaActual = t
        fichadoDesde = f.ocurrido_en
        estado = 'dentro'
        break
      case 'salida':
        if (entradaActual) {
          minutosTrabajados += Math.round((t.getTime() - entradaActual.getTime()) / 60_000)
          entradaActual = null
        }
        estado = 'fuera'
        fichadoDesde = null
        break
      case 'pausa_inicio':
        pausaActual = t
        pausaInicio = f.ocurrido_en
        estado = 'en_pausa'
        // Cortar el segmento trabajado en la pausa
        if (entradaActual) {
          minutosTrabajados += Math.round((t.getTime() - entradaActual.getTime()) / 60_000)
          entradaActual = null
        }
        break
      case 'pausa_fin':
        if (pausaActual) {
          minutosPausado += Math.round((t.getTime() - pausaActual.getTime()) / 60_000)
          pausaActual = null
        }
        pausaInicio = null
        entradaActual = t  // retomar trabajo
        estado = 'dentro'
        break
      default:
        break
    }
  }

  // Si al final del día quedó abierto (p.ej. aún trabajando), contar hasta ahora.
  const ahora = new Date()
  if (entradaActual) {
    minutosTrabajados += Math.round((ahora.getTime() - entradaActual.getTime()) / 60_000)
  }
  if (pausaActual) {
    minutosPausado += Math.round((ahora.getTime() - pausaActual.getTime()) / 60_000)
  }

  return {
    estado,
    fichado_desde: fichadoDesde,
    pausa_inicio: pausaInicio,
    minutos_trabajados: minutosTrabajados,
    minutos_pausado: minutosPausado,
  }
}
