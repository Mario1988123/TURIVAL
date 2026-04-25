// lib/services/planificador.ts
/**
 * Service del PLANIFICADOR (Gantt) — Capa 6.
 *
 * Punto de entrada desde la UI. Lee Supabase, construye las estructuras
 * que espera el motor puro `lib/motor/planificador.ts` y devuelve
 * datos listos para pintar. No contiene lógica de cálculo; eso vive
 * en el motor.
 *
 * DECISIÓN DE BD (G2):
 *   La persistencia de la planificación se guarda directamente en
 *   `tareas_produccion.fecha_inicio_planificada` + `operario_id`
 *   (columnas ya existentes). La tabla heredada `planificacion`
 *   (de granularidad pieza+fase) NO se toca — es legado del sistema
 *   viejo. Esto evita una migración BD y aprovecha el schema actual.
 *
 * Estados relevantes de tarea que interesan al Gantt:
 *   pendiente, en_cola, en_progreso, en_secado
 * (las completadas y anuladas se excluyen).
 */

import { createClient } from '@/lib/supabase/server'
import {
  type TareaPlanificable,
  type TareaPlanificada,
  type OperarioDisponible,
  type JornadaLaboral,
  type PrioridadPedido,
  type Solape,
  type ViolacionSecuencia,
  type ViolacionPlazo,
  type CambioRipple,
  type SugerenciaHueco,
  type SugerenciaHorasExtra,
  type SugerenciaAgrupacion,
  type ResultadoAutogenerar,
  JORNADA_DEFAULT,
  calcularFinTarea,
  detectarSolapesEnPlanificacion,
  detectarViolacionesSecuencia,
  detectarViolacionesPlazo,
  rippleTareasDependientes,
  sugerirHuecos as motorSugerirHuecos,
  sugerirHorasExtra as motorSugerirHorasExtra,
  sugerirAgrupacionesPorMaterial,
  planificarTodas,
  autogenerarPlanificacion as motorAutogenerar,
} from '@/lib/motor/planificador'

// =============================================================
// TIPOS PÚBLICOS
// =============================================================

export interface FiltrosPlanificador {
  /** Desde qué fecha mirar (ISO). Default: hoy 00:00. */
  desde?: string
  /** Hasta qué fecha mirar (ISO). Default: +14 días desde `desde`. */
  hasta?: string
  /** Filtrar por un operario. */
  operario_id?: string
  /** Filtrar por un pedido. */
  pedido_id?: string
  /** Filtrar por prioridad. */
  prioridad?: PrioridadPedido
  /** Incluir tareas sin planificar (inicio_planificado null). Default true. */
  incluir_sin_planificar?: boolean
}

export interface FilaPlanificadorContexto {
  pieza_numero: string
  pedido_numero: string
  cliente_nombre: string | null
  color_gantt: string | null
  proceso_abreviatura: string | null
  operario_nombre: string | null
  operario_color: string | null
}

/** Estructura que recibe el componente UI — una tarea con todo lo necesario para pintar. */
export interface FilaPlanificador extends TareaPlanificada, FilaPlanificadorContexto {}

export interface VistaPlanificador {
  tareas: FilaPlanificador[]
  operarios: OperarioDisponible[]
  solapes: Solape[]
  violaciones_secuencia: ViolacionSecuencia[]
  violaciones_plazo: ViolacionPlazo[]
  rango: { desde: string; hasta: string }
  jornada: JornadaLaboral
}

export interface ResultadoMoverTarea {
  ok: boolean
  cambios: CambioRipple[]
  /** Solapes resultantes que el humano debería revisar. No impide el mov. */
  solapes_generados: Solape[]
  /** Violaciones de plazo tras el movimiento. */
  violaciones_plazo: ViolacionPlazo[]
  error?: string
}

// =============================================================
// HELPERS INTERNOS
// =============================================================

const MS_DIA = 86_400_000

function hoyInicio(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(d: Date): string {
  return d.toISOString()
}

function fromISO(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function prioridadDePedido(raw: string | null | undefined): PrioridadPedido {
  const v = (raw ?? 'normal').toLowerCase()
  if (v === 'baja' || v === 'alta' || v === 'urgente') return v
  return 'normal'
}

/**
 * Construye un TareaPlanificable desde una fila de Supabase embebida.
 * La forma de `row` es la que devuelve el SELECT con joins de
 * `obtenerVistaPlanificador`.
 */
function construirTareaPlanificable(row: any): TareaPlanificable | null {
  const proceso = row.proceso
  const pieza = row.pieza
  const linea = pieza?.linea_pedido
  const pedido = linea?.pedido
  if (!proceso || !pieza || !linea || !pedido) return null

  return {
    id: row.id,
    pieza_id: pieza.id,
    pedido_id: pedido.id,
    proceso_id: proceso.id,
    proceso_codigo: proceso.codigo,
    proceso_nombre: proceso.nombre,
    secuencia: row.secuencia,
    es_opcional: !!row.es_opcional,
    depende_de_secuencia: row.depende_de_secuencia,
    tiempo_estimado_minutos: Number(row.tiempo_estimado_minutos ?? 0),
    requiere_secado: !!proceso.requiere_secado,
    tiempo_secado_minutos: Number(proceso.tiempo_secado_minutos ?? 0),
    requiere_operario: proceso.requiere_operario !== false,
    rol_operario_requerido: proceso.rol_operario_requerido ?? null,
    material_lacado_id: pieza.material_lacado_id ?? null,
    material_fondo_id: pieza.material_fondo_id ?? null,
    inicio_planificado: fromISO(row.fecha_inicio_planificada),
    operario_id: row.operario_id ?? null,
    pedido_prioridad: prioridadDePedido(pedido.prioridad),
    pedido_fecha_entrega_estimada: fromISO(pedido.fecha_entrega_estimada),
  }
}

function construirContexto(row: any): FilaPlanificadorContexto {
  const proceso = row.proceso
  const pieza = row.pieza
  const linea = pieza?.linea_pedido
  const pedido = linea?.pedido
  const operario = row.operario
  return {
    pieza_numero: pieza?.numero ?? '',
    pedido_numero: pedido?.numero ?? '',
    cliente_nombre: pedido?.cliente?.nombre_comercial ?? null,
    color_gantt: proceso?.color_gantt ?? null,
    proceso_abreviatura: proceso?.abreviatura ?? null,
    operario_nombre: operario?.nombre ?? null,
    operario_color: operario?.color ?? null,
  }
}

/** Select compartido para todas las consultas del planificador. */
const SELECT_GANTT = `
  id, secuencia, estado, es_opcional, depende_de_secuencia,
  tiempo_estimado_minutos, fecha_inicio_planificada, operario_id,
  operario:operarios(id, nombre, rol, color, activo),
  proceso:procesos_catalogo(
    id, codigo, nombre, abreviatura, color_gantt,
    requiere_secado, tiempo_secado_minutos, requiere_operario,
    rol_operario_requerido, escala_por_m2
  ),
  pieza:piezas(
    id, numero, material_lacado_id, material_fondo_id,
    linea_pedido:lineas_pedido(
      id, pedido_id,
      pedido:pedidos(
        id, numero, prioridad, fecha_entrega_estimada, estado,
        cliente:clientes(id, nombre_comercial)
      )
    )
  )
`

// =============================================================
// VISTA PRINCIPAL
// =============================================================

/**
 * Devuelve toda la foto del planificador para el rango y filtros dados.
 * Esta es la función que llamará la UI /planificador en server component.
 */
export async function obtenerVistaPlanificador(
  filtros: FiltrosPlanificador = {},
  jornada: JornadaLaboral = JORNADA_DEFAULT,
): Promise<VistaPlanificador> {
  const supabase = await createClient()

  const desde = filtros.desde ? new Date(filtros.desde) : hoyInicio()
  const hasta = filtros.hasta
    ? new Date(filtros.hasta)
    : new Date(desde.getTime() + 14 * MS_DIA)
  const incluirSinPlanificar = filtros.incluir_sin_planificar ?? true

  let q = supabase
    .from('tareas_produccion')
    .select(SELECT_GANTT)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])

  if (filtros.operario_id) q = q.eq('operario_id', filtros.operario_id)

  // Rango: tareas cuya fecha_inicio_planificada cae en el rango
  // o tareas sin planificar (si incluir_sin_planificar).
  if (!incluirSinPlanificar) {
    q = q
      .gte('fecha_inicio_planificada', toISO(desde))
      .lt('fecha_inicio_planificada', toISO(hasta))
  }

  const { data, error } = await q.order('secuencia', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as any[]
  const filtradas = filtros.pedido_id
    ? rows.filter((r) => r?.pieza?.linea_pedido?.pedido?.id === filtros.pedido_id)
    : rows

  const filtradasPrioridad = filtros.prioridad
    ? filtradas.filter((r) => prioridadDePedido(r?.pieza?.linea_pedido?.pedido?.prioridad) === filtros.prioridad)
    : filtradas

  // Aplicar rango a nivel cliente cuando incluir_sin_planificar=true:
  // mostramos las no planificadas siempre + las planificadas en rango.
  const rangoAplicado = filtradasPrioridad.filter((r) => {
    const ini = fromISO(r.fecha_inicio_planificada)
    if (!ini) return incluirSinPlanificar
    return ini >= desde && ini < hasta
  })

  const tareasPlanif = rangoAplicado
    .map(construirTareaPlanificable)
    .filter((t): t is TareaPlanificable => t != null)

  // Para el cálculo de fin/solapes necesitamos que TODAS tengan un inicio real.
  // Las que aún no están planificadas se pintan en el "pool pendiente" del Gantt
  // y no participan en solapes/violaciones.
  const conInicio = tareasPlanif.filter((t) => t.inicio_planificado != null)
  const sinInicio = tareasPlanif.filter((t) => t.inicio_planificado == null)

  const conInicioCalc: TareaPlanificada[] = conInicio.map((t) => {
    const inicio = t.inicio_planificado!
    const { fin, fin_con_secado } = calcularFinTarea(t, inicio, jornada)
    return { ...t, inicio, fin, fin_con_secado }
  })

  // Las sin inicio entran en el array final con inicio/fin = epoch (flag de "pool")
  const sinInicioCalc: TareaPlanificada[] = sinInicio.map((t) => ({
    ...t,
    inicio: new Date(0),
    fin: new Date(0),
    fin_con_secado: new Date(0),
  }))

  // Unir contexto de UI
  const contextoPorId = new Map<string, FilaPlanificadorContexto>()
  for (const r of rangoAplicado) contextoPorId.set(r.id, construirContexto(r))

  const filas: FilaPlanificador[] = [...conInicioCalc, ...sinInicioCalc].map((t) => ({
    ...t,
    ...(contextoPorId.get(t.id) ?? {
      pieza_numero: '',
      pedido_numero: '',
      cliente_nombre: null,
      color_gantt: null,
      proceso_abreviatura: null,
      operario_nombre: null,
      operario_color: null,
    }),
  }))

  const solapes = detectarSolapesEnPlanificacion(conInicioCalc)
  const violaciones_secuencia = detectarViolacionesSecuencia(conInicioCalc)
  const violaciones_plazo = detectarViolacionesPlazo(conInicioCalc)

  const operarios = await obtenerOperariosDisponibles()

  return {
    tareas: filas,
    operarios,
    solapes,
    violaciones_secuencia,
    violaciones_plazo,
    rango: { desde: toISO(desde), hasta: toISO(hasta) },
    jornada,
  }
}

// =============================================================
// OPERARIOS
// =============================================================

export async function obtenerOperariosDisponibles(): Promise<OperarioDisponible[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operarios')
    .select('id, nombre, rol, activo')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return (data ?? []).map((o: any) => ({
    id: o.id,
    nombre: o.nombre,
    rol: o.rol ?? '',
    activo: o.activo ?? true,
  }))
}

// =============================================================
// PLANIFICAR / MOVER UNA TAREA
// =============================================================

/**
 * Asigna una tarea a un hueco concreto (operario + inicio) sin ripple previo.
 * Es el "primer movimiento": planificar una tarea que aún no lo estaba.
 * Si ya estaba planificada en otro sitio, se reasigna y se dispara el ripple.
 */
export async function planificarTareaManual(params: {
  tarea_id: string
  inicio: string
  operario_id: string | null
}): Promise<ResultadoMoverTarea> {
  return moverTarea({
    tarea_id: params.tarea_id,
    nuevo_inicio: params.inicio,
    nuevo_operario_id: params.operario_id,
  })
}

/**
 * Mueve una tarea a un nuevo inicio y opcionalmente cambia el operario.
 * Aplica ripple automático sobre las tareas de la misma pieza y persiste
 * todos los cambios en Supabase. Devuelve los cambios aplicados + solapes
 * y violaciones de plazo resultantes para que la UI los pinte.
 */
export async function moverTarea(params: {
  tarea_id: string
  nuevo_inicio: string
  nuevo_operario_id: string | null | undefined
  jornada?: JornadaLaboral
}): Promise<ResultadoMoverTarea> {
  const supabase = await createClient()
  const jornada = params.jornada ?? JORNADA_DEFAULT
  const nuevoInicio = new Date(params.nuevo_inicio)
  if (isNaN(nuevoInicio.getTime())) {
    return { ok: false, cambios: [], solapes_generados: [], violaciones_plazo: [], error: 'fecha_inicio inválida' }
  }

  // Necesitamos el universo entero para detectar solapes globales.
  // Optimización posible: traer solo tareas de la misma pieza + operario, pero
  // para el ripple a nivel pieza con validación global de solapes, traemos todo.
  const { data, error } = await supabase
    .from('tareas_produccion')
    .select(SELECT_GANTT)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
  if (error) return { ok: false, cambios: [], solapes_generados: [], violaciones_plazo: [], error: error.message }

  const rows = (data ?? []) as any[]
  const universo = rows
    .map(construirTareaPlanificable)
    .filter((t): t is TareaPlanificable => t != null)

  const movida = universo.find((t) => t.id === params.tarea_id)
  if (!movida) {
    return { ok: false, cambios: [], solapes_generados: [], violaciones_plazo: [], error: 'tarea no encontrada' }
  }

  const operarioAsignado = params.nuevo_operario_id ?? movida.operario_id ?? null

  const { cambios, tareasResultantes } = rippleTareasDependientes(
    params.tarea_id,
    nuevoInicio,
    operarioAsignado,
    universo,
    jornada,
  )

  // Persistir cambios: para cada cambio → UPDATE tareas_produccion.
  const updates = cambios.map((c) => {
    const tareaResultante = tareasResultantes.find((t) => t.id === c.tarea_id)
    return supabase
      .from('tareas_produccion')
      .update({
        fecha_inicio_planificada: c.inicio_nuevo.toISOString(),
        operario_id: tareaResultante?.operario_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.tarea_id)
  })

  const results = await Promise.all(updates)
  const primerError = results.find((r) => r.error)
  if (primerError?.error) {
    return { ok: false, cambios, solapes_generados: [], violaciones_plazo: [], error: primerError.error.message }
  }

  // Calcular solapes y plazo tras el movimiento
  const resultadosConInicio = tareasResultantes.filter((t) => t.inicio_planificado != null)
  const solapes_generados = detectarSolapesEnPlanificacion(resultadosConInicio)
  const violaciones_plazo = detectarViolacionesPlazo(resultadosConInicio)

  return { ok: true, cambios, solapes_generados, violaciones_plazo }
}

/**
 * Agrupa y planifica consecutivamente un conjunto de tareas (mismo color,
 * normalmente). Las coloca en el operario indicado a partir de `inicio`,
 * en el orden de la lista. Dispara ripple si hace falta.
 */
/**
 * Desasigna una tarea: pone fecha_inicio_planificada = null y operario_id = null.
 * Vuelve al pool "sin planificar". No aplica ripple sobre las posteriores
 * (quedan donde estaban; el usuario decide si las mueve).
 */
export async function desasignarTarea(tarea_id: string): Promise<ResultadoMoverTarea> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tareas_produccion')
    .update({
      fecha_inicio_planificada: null,
      operario_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tarea_id)
  if (error) {
    return { ok: false, cambios: [], solapes_generados: [], violaciones_plazo: [], error: error.message }
  }
  return { ok: true, cambios: [{ tarea_id, inicio_anterior: null, inicio_nuevo: new Date(0), minutos_empujado: 0 }], solapes_generados: [], violaciones_plazo: [] }
}

export async function aplicarAgrupacion(params: {
  tareas_ids: string[]
  operario_id: string
  inicio: string
  jornada?: JornadaLaboral
}): Promise<ResultadoMoverTarea> {
  const supabase = await createClient()
  const jornada = params.jornada ?? JORNADA_DEFAULT
  const iniBase = new Date(params.inicio)

  const { data, error } = await supabase
    .from('tareas_produccion')
    .select(SELECT_GANTT)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
  if (error) return { ok: false, cambios: [], solapes_generados: [], violaciones_plazo: [], error: error.message }

  const universo = ((data ?? []) as any[])
    .map(construirTareaPlanificable)
    .filter((t): t is TareaPlanificable => t != null)

  // Aplicar moverTarea en cadena: cada siguiente empieza donde termina la anterior
  // con su fin_con_secado. Acumula cambios.
  let cursor = iniBase
  const cambiosAcumulados: CambioRipple[] = []
  let universoMutable = universo

  for (const tid of params.tareas_ids) {
    const tarea = universoMutable.find((t) => t.id === tid)
    if (!tarea) continue
    const { cambios, tareasResultantes } = rippleTareasDependientes(
      tid,
      cursor,
      params.operario_id,
      universoMutable,
      jornada,
    )
    cambiosAcumulados.push(...cambios)
    universoMutable = tareasResultantes.map((t) => ({
      ...t,
      inicio_planificado: t.inicio_planificado,
    }))
    const tareaMovida = tareasResultantes.find((t) => t.id === tid)
    if (tareaMovida) cursor = tareaMovida.fin_con_secado
  }

  // Persistir agrupando por tarea el último inicio_nuevo.
  const ultimoPorTarea = new Map<string, CambioRipple>()
  for (const c of cambiosAcumulados) ultimoPorTarea.set(c.tarea_id, c)

  const updates = Array.from(ultimoPorTarea.values()).map((c) =>
    supabase
      .from('tareas_produccion')
      .update({
        fecha_inicio_planificada: c.inicio_nuevo.toISOString(),
        operario_id:
          params.tareas_ids.includes(c.tarea_id)
            ? params.operario_id
            : universoMutable.find((t) => t.id === c.tarea_id)?.operario_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.tarea_id),
  )
  const results = await Promise.all(updates)
  const primerError = results.find((r) => r.error)
  if (primerError?.error) {
    return { ok: false, cambios: cambiosAcumulados, solapes_generados: [], violaciones_plazo: [], error: primerError.error.message }
  }

  const planif = planificarTodas(universoMutable, jornada).filter((t) => t.inicio_planificado != null)
  const solapes_generados = detectarSolapesEnPlanificacion(planif)
  const violaciones_plazo = detectarViolacionesPlazo(planif)

  return {
    ok: true,
    cambios: Array.from(ultimoPorTarea.values()),
    solapes_generados,
    violaciones_plazo,
  }
}

// =============================================================
// SUGERENCIAS (wrappers del motor)
// =============================================================

/**
 * Devuelve sugerencias de huecos libres en el rango dado.
 * Usa el motor puro; este wrapper solo carga los datos.
 */
export async function obtenerSugerenciasHuecos(
  filtros: FiltrosPlanificador = {},
  jornada: JornadaLaboral = JORNADA_DEFAULT,
): Promise<SugerenciaHueco[]> {
  const vista = await obtenerVistaPlanificador(filtros, jornada)
  const conInicio = vista.tareas.filter((t) => t.inicio_planificado != null)
  const sinInicio = vista.tareas.filter((t) => t.inicio_planificado == null)

  // Generar lista de fechas del rango (un día cada uno)
  const desde = new Date(vista.rango.desde)
  const hasta = new Date(vista.rango.hasta)
  const fechas: Date[] = []
  for (let d = new Date(desde); d < hasta; d = new Date(d.getTime() + MS_DIA)) {
    fechas.push(new Date(d))
  }

  return motorSugerirHuecos(vista.operarios, fechas, conInicio, sinInicio, jornada)
}

export async function obtenerSugerenciasAgrupacion(
  filtros: FiltrosPlanificador = {},
): Promise<SugerenciaAgrupacion[]> {
  const vista = await obtenerVistaPlanificador(filtros)
  const desde = new Date(vista.rango.desde)
  const hasta = new Date(vista.rango.hasta)
  return sugerirAgrupacionesPorMaterial(vista.tareas, { desde, hasta })
}

export async function obtenerSugerenciasHorasExtra(
  filtros: FiltrosPlanificador = {},
  jornada: JornadaLaboral = JORNADA_DEFAULT,
): Promise<SugerenciaHorasExtra[]> {
  const vista = await obtenerVistaPlanificador(filtros, jornada)

  // Agrupar por pedido
  const porPedido = new Map<string, TareaPlanificada[]>()
  for (const t of vista.tareas) {
    if (t.inicio_planificado == null) continue
    const arr = porPedido.get(t.pedido_id) ?? []
    arr.push(t)
    porPedido.set(t.pedido_id, arr)
  }

  const resultados: SugerenciaHorasExtra[] = []
  for (const [pedido_id, tareas] of porPedido) {
    const fechaEntrega = tareas[0].pedido_fecha_entrega_estimada
    if (!fechaEntrega) continue
    const s = motorSugerirHorasExtra(pedido_id, tareas, fechaEntrega)
    if (s) resultados.push(s)
  }
  return resultados
}

// =============================================================
// AUTOGENERADOR (G7a)
// =============================================================

export interface ResultadoAutogenerarServicio {
  ok: boolean
  asignaciones_aplicadas: number
  sin_asignar_count: number
  sin_asignar: ResultadoAutogenerar['sin_asignar']
  agrupaciones_aplicadas: number
  minutos_ahorrados_estimados: number
  /** Rango realmente usado para colocar todas las tareas (puede ser mayor al pedido). */
  rango_efectivo?: { desde: string; hasta: string }
  /** true si tuvo que extenderse el rango automáticamente. */
  rango_extendido?: boolean
  error?: string
}

/**
 * Ejecuta la heurística de autogenerar y persiste las asignaciones.
 *
 * `dry_run=true` (default false): calcula pero NO escribe en BD. Sirve para
 * previsualizar en un modal de confirmación antes de aplicar.
 *
 * Si quedan tareas con razón `sin_huecos_en_rango`, se extiende automáticamente
 * el rango (14 → 60 → 180 → 365 días) hasta colocarlas todas o tope de 365.
 * Mario lo pidió así (25-abr): "las que no caben pasan al día siguiente, no
 * se quedan fuera".
 */
export async function autogenerar(params: {
  rango?: { desde: string; hasta: string }
  jornada?: JornadaLaboral
  dry_run?: boolean
  /** Si se pasa, solo planifica las tareas de este pedido. */
  pedido_id?: string
}): Promise<ResultadoAutogenerarServicio> {
  const supabase = await createClient()
  const jornada = params.jornada ?? JORNADA_DEFAULT
  const desde = params.rango?.desde ? new Date(params.rango.desde) : hoyInicio()
  const hastaUsuario = params.rango?.hasta
    ? new Date(params.rango.hasta)
    : new Date(desde.getTime() + 14 * MS_DIA)

  let query = supabase
    .from('tareas_produccion')
    .select(SELECT_GANTT)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
  if (params.pedido_id) query = query.eq('pedido_id', params.pedido_id)
  const { data, error } = await query
  if (error) {
    return {
      ok: false,
      asignaciones_aplicadas: 0,
      sin_asignar_count: 0,
      sin_asignar: [],
      agrupaciones_aplicadas: 0,
      minutos_ahorrados_estimados: 0,
      error: error.message,
    }
  }
  const universo = ((data ?? []) as any[])
    .map(construirTareaPlanificable)
    .filter((t): t is TareaPlanificable => t != null)
  const operarios = await obtenerOperariosDisponibles()

  // Auto-extensión del rango si quedan tareas por falta de huecos.
  // Pasos: el rango pedido por el usuario, luego +60d, +180d, +365d (tope).
  const escalonesDias = [
    Math.max(14, Math.round((hastaUsuario.getTime() - desde.getTime()) / MS_DIA)),
    60, 180, 365,
  ]
  let resultado: ResultadoAutogenerar | null = null
  let hastaUsado = hastaUsuario
  let rangoExtendido = false
  for (const dias of escalonesDias) {
    const hastaIntento = new Date(desde.getTime() + dias * MS_DIA)
    resultado = motorAutogenerar({
      tareasUniverso: universo,
      operarios,
      rangoFechas: { desde, hasta: hastaIntento },
      jornada,
    })
    hastaUsado = hastaIntento
    const sinHueco = resultado.sin_asignar.filter(s => s.razon === 'sin_huecos_en_rango').length
    if (sinHueco === 0) break
    rangoExtendido = true
  }
  if (!resultado) {
    return {
      ok: false,
      asignaciones_aplicadas: 0,
      sin_asignar_count: 0,
      sin_asignar: [],
      agrupaciones_aplicadas: 0,
      minutos_ahorrados_estimados: 0,
      error: 'motor no devolvió resultado',
    }
  }

  const rangoEfectivoIso = {
    desde: desde.toISOString(),
    hasta: hastaUsado.toISOString(),
  }

  if (params.dry_run) {
    return {
      ok: true,
      asignaciones_aplicadas: 0,
      sin_asignar_count: resultado.sin_asignar.length,
      sin_asignar: resultado.sin_asignar,
      agrupaciones_aplicadas: resultado.agrupaciones_aplicadas,
      minutos_ahorrados_estimados: resultado.minutos_ahorrados_estimados,
      rango_efectivo: rangoEfectivoIso,
      rango_extendido: rangoExtendido,
    }
  }

  // Persistir asignaciones en paralelo
  const nowIso = new Date().toISOString()
  const updates = resultado.asignaciones.map(a =>
    supabase
      .from('tareas_produccion')
      .update({
        fecha_inicio_planificada: a.inicio.toISOString(),
        operario_id: a.operario_id,
        updated_at: nowIso,
      })
      .eq('id', a.tarea_id),
  )
  const res = await Promise.all(updates)
  const primerError = res.find(r => r.error)
  if (primerError?.error) {
    return {
      ok: false,
      asignaciones_aplicadas: 0,
      sin_asignar_count: resultado.sin_asignar.length,
      sin_asignar: resultado.sin_asignar,
      agrupaciones_aplicadas: resultado.agrupaciones_aplicadas,
      minutos_ahorrados_estimados: resultado.minutos_ahorrados_estimados,
      rango_efectivo: rangoEfectivoIso,
      rango_extendido: rangoExtendido,
      error: primerError.error.message,
    }
  }

  return {
    ok: true,
    asignaciones_aplicadas: resultado.asignaciones.length,
    sin_asignar_count: resultado.sin_asignar.length,
    sin_asignar: resultado.sin_asignar,
    agrupaciones_aplicadas: resultado.agrupaciones_aplicadas,
    minutos_ahorrados_estimados: resultado.minutos_ahorrados_estimados,
    rango_efectivo: rangoEfectivoIso,
    rango_extendido: rangoExtendido,
  }
}
