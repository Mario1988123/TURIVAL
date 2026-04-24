/**
 * lib/motor/planificador.ts
 * ================================================================
 * Motor PURO de planificación y Gantt. Creado en G1.
 *
 * Principios:
 *   - Sin imports de Supabase ni de servicios. Solo tipos y cálculo.
 *   - Sin efectos secundarios. Cada función toma inputs y devuelve
 *     un valor determinista.
 *   - Trabaja con `Date` nativo (los servicios convierten desde
 *     TIMESTAMPTZ de Supabase). Zona horaria implícita del runtime.
 *
 * QUÉ RESUELVE:
 *   1. Fin de una tarea respetando jornada laboral y secado post-operario.
 *   2. Orden topológico de las tareas de una pieza (campo `depende_de_secuencia`).
 *   3. Detección de solapes entre tareas del mismo operario.
 *   4. Validación de secuencia (FONDO no puede empezar antes de que LIJADO termine).
 *   5. Violaciones de plazo (pedido que se pasa de `fecha_entrega_estimada`).
 *   6. Ripple: mover una tarea empuja automáticamente las posteriores de su pieza.
 *   7. Ventanas libres de un operario en un día → base para detectar huecos.
 *   8. Sugerencias de huecos y horas extras bajo demanda.
 *   9. Agrupador por lote de color (optimizador): identifica tareas
 *      pendientes con el mismo `material_lacado_id` o `material_fondo_id`
 *      y sugiere lacarlas juntas para ahorrar setup y secado.
 *
 * QUÉ NO HACE (lo hará G2 en `lib/services/planificador.ts`):
 *   - Leer ni escribir en Supabase.
 *   - Aplicar cambios; solo los propone.
 *   - Gestionar zonas horarias distintas (se asume Europe/Madrid en servidor).
 *
 * DISTINCIÓN CLAVE jornada vs 24/7:
 *   - Tareas con `requiere_operario=true` consumen jornada laboral
 *     (ej. LIJADO, FONDO, LACADO, TERMINACION, PICKING, RECEPCION).
 *     Si la tarea empieza a las 16:30 y dura 60 min, termina al día
 *     siguiente a las 8:30 (cerramos a 17:00, 30 min + 30 min al día siguiente).
 *   - Tareas con `requiere_operario=false` corren 24/7 reloj continuo
 *     (ej. SECADO, COMPROB_MATERIAL tal como está configurado).
 *   - El `tiempo_secado_minutos` posterior a un proceso se añade siempre
 *     en reloj continuo 24/7 (secar pasa de noche también).
 * ================================================================
 */

// =================================================================
// TIPOS DE ENTRADA
// =================================================================

export type PrioridadPedido = 'baja' | 'normal' | 'alta' | 'urgente'

/**
 * Tarea de producción tal y como la manipula el motor. Se construye
 * en el servicio (G2) a partir de `tareas_produccion` joined con
 * `piezas`, `procesos_catalogo` y `pedidos`.
 */
export interface TareaPlanificable {
  id: string
  pieza_id: string
  pedido_id: string
  proceso_id: string

  /** Código del proceso: 'LIJADO', 'FONDO', 'LACADO', 'SECADO', etc. */
  proceso_codigo: string
  proceso_nombre: string

  /** Posición 1..N dentro de la pieza. */
  secuencia: number
  es_opcional: boolean

  /** Número de secuencia de la tarea predecesora dentro de la misma pieza. */
  depende_de_secuencia: number | null

  tiempo_estimado_minutos: number

  /** Si true, tras terminar la parte con operario hay que dejar secar. */
  requiere_secado: boolean
  tiempo_secado_minutos: number

  /** Si false, la tarea corre en reloj 24/7 (no consume jornada). */
  requiere_operario: boolean

  /** Rol requerido para asignar operario compatible. */
  rol_operario_requerido: string | null

  /** Materiales — clave para el optimizador de lote. */
  material_lacado_id: string | null
  material_fondo_id: string | null

  /** Planificación actual, si ya se asignó. */
  inicio_planificado: Date | null
  operario_id: string | null

  /** Contexto del pedido (para prioridad y plazo). */
  pedido_prioridad: PrioridadPedido
  pedido_fecha_entrega_estimada: Date | null
}

export interface OperarioDisponible {
  id: string
  nombre: string
  /** 'Lijador', 'Fondeador', 'Lacador', 'Oficina', 'Taller'. Debe coincidir con `rol_operario_requerido`. */
  rol: string
  activo: boolean
}

export interface JornadaLaboral {
  /** Hora de entrada en formato 'HH:MM' (24h). Ej. '08:00'. */
  hora_inicio: string
  /** Hora de salida en formato 'HH:MM'. Ej. '17:00'. */
  hora_fin: string
  /**
   * Descanso intermedio en minutos (ej. 60 para comida 13:00-14:00).
   * Si > 0, la jornada se parte en dos bloques iguales alrededor del
   * punto medio. Default 0 → jornada continua. Se afinará en G5.
   */
  minutos_descanso_intermedio: number
  /** Días laborables en formato ISO getDay() → 0=Dom, 1=Lun, ..., 6=Sáb. */
  dias_laborables: number[]
}

export const JORNADA_DEFAULT: JornadaLaboral = {
  hora_inicio: '08:00',
  hora_fin: '17:00',
  minutos_descanso_intermedio: 0,
  dias_laborables: [1, 2, 3, 4, 5],
}

// =================================================================
// TIPOS DE SALIDA
// =================================================================

export interface TareaPlanificada extends TareaPlanificable {
  /** Inicio efectivo. Si no estaba planificada aún, se calcula desde su predecesora. */
  inicio: Date
  /** Fin de la parte con operario (sin contar secado). */
  fin: Date
  /** Cuándo la siguiente tarea de la pieza puede empezar (fin + secado si aplica). */
  fin_con_secado: Date
}

export interface Ventana {
  operario_id: string
  inicio: Date
  fin: Date
  minutos: number
}

export interface Solape {
  tarea_a_id: string
  tarea_b_id: string
  operario_id: string
  inicio: Date
  fin: Date
  minutos_solapados: number
}

export type MotivoViolacionSecuencia =
  | 'previa_no_planificada'
  | 'previa_posterior_en_tiempo'
  | 'secado_previo_no_respetado'
  | 'ciclo_dependencia'

export interface ViolacionSecuencia {
  tarea_id: string
  motivo: MotivoViolacionSecuencia
  tarea_previa_id?: string
  detalle?: string
}

export interface ViolacionPlazo {
  pieza_id: string
  pedido_id: string
  fecha_entrega: Date
  fin_ultima_tarea: Date
  retraso_minutos: number
}

export interface CambioRipple {
  tarea_id: string
  inicio_anterior: Date | null
  inicio_nuevo: Date
  minutos_empujado: number
}

// --- Sugerencias ---

export type TipoSugerencia = 'hueco' | 'horas_extra' | 'agrupar_color'

interface SugerenciaBase {
  tipo: TipoSugerencia
  mensaje: string
}

export interface SugerenciaHueco extends SugerenciaBase {
  tipo: 'hueco'
  operario_id: string
  operario_nombre: string
  ventana: Ventana
  tareas_candidatas: Array<{ tarea_id: string; pieza_id: string; pedido_id: string; proceso_codigo: string }>
}

export interface SugerenciaHorasExtra extends SugerenciaBase {
  tipo: 'horas_extra'
  pedido_id: string
  minutos_necesarios: number
  fecha_entrega: Date
  roles_afectados: string[]
}

export interface SugerenciaAgrupacion extends SugerenciaBase {
  tipo: 'agrupar_color'
  proceso_codigo: 'LACADO' | 'FONDO'
  material_id: string
  tareas_ids: string[]
  piezas_ids: string[]
  pedidos_ids: string[]
  minutos_ahorrados_estimados: number
}

export type Sugerencia = SugerenciaHueco | SugerenciaHorasExtra | SugerenciaAgrupacion

// =================================================================
// HELPERS INTERNOS (fechas y jornada)
// =================================================================

const MS_POR_MIN = 60_000

function sumarMinutos(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * MS_POR_MIN)
}

function minutosEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_POR_MIN)
}

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

function conHora(base: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d
}

function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function esDiaLaborable(d: Date, jornada: JornadaLaboral): boolean {
  return jornada.dias_laborables.includes(d.getDay())
}

function siguienteInicioLaborable(d: Date, jornada: JornadaLaboral): Date {
  let cursor = conHora(d, jornada.hora_inicio)
  while (!esDiaLaborable(cursor, jornada)) {
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return cursor
}

/**
 * Dada una fecha+hora, devuelve el primer instante DENTRO de jornada igual o posterior.
 *   - Si es día laborable y hora < inicio jornada → mueve a inicio de ese día.
 *   - Si es día laborable y hora en jornada → devuelve tal cual.
 *   - Si es día laborable y hora > fin jornada → mueve a inicio del siguiente laborable.
 *   - Si es día no laborable → mueve a inicio del siguiente laborable.
 */
function normalizarDentroDeJornada(d: Date, jornada: JornadaLaboral): Date {
  const { h: hIni, m: mIni } = parseHHMM(jornada.hora_inicio)
  const { h: hFin, m: mFin } = parseHHMM(jornada.hora_fin)
  const inicioJ = conHora(d, jornada.hora_inicio)
  const finJ = conHora(d, jornada.hora_fin)

  if (!esDiaLaborable(d, jornada) || d >= finJ) {
    const siguiente = new Date(d.getTime() + 86_400_000)
    siguiente.setHours(hIni, mIni, 0, 0)
    return siguienteInicioLaborable(siguiente, jornada)
  }
  if (d < inicioJ) return inicioJ
  return d
  // hFin, mFin no se usan en el path normal; parseo conservado por si se amplía a descansos.
  void hFin; void mFin
}

/**
 * Avanza `minutosNeed` a partir de `inicio`, consumiendo SOLO jornada.
 * Si cae fin de jornada, salta al siguiente día laborable y continúa.
 * Usada para tareas con `requiere_operario=true`.
 */
function avanzarMinutosEnJornada(inicio: Date, minutosNeed: number, jornada: JornadaLaboral): Date {
  if (minutosNeed <= 0) return new Date(inicio)

  let cursor = normalizarDentroDeJornada(inicio, jornada)
  let restantes = minutosNeed

  while (restantes > 0) {
    const finJ = conHora(cursor, jornada.hora_fin)
    const minutosDelDia = minutosEntre(cursor, finJ)
    if (restantes <= minutosDelDia) {
      return sumarMinutos(cursor, restantes)
    }
    restantes -= minutosDelDia
    // Mover a inicio del siguiente día laborable
    const siguiente = new Date(cursor.getTime() + 86_400_000)
    cursor = siguienteInicioLaborable(siguiente, jornada)
  }
  return cursor
}

// =================================================================
// CÁLCULOS BÁSICOS
// =================================================================

/**
 * Calcula el fin (con y sin secado) de una tarea dado su inicio.
 * - Si requiere_operario: avanza por jornada.
 * - Si no: avanza en reloj continuo 24/7.
 * - El secado SIEMPRE se añade en reloj continuo (seca de noche también).
 */
export function calcularFinTarea(
  tarea: TareaPlanificable,
  inicio: Date,
  jornada: JornadaLaboral,
): { fin: Date; fin_con_secado: Date } {
  const fin = tarea.requiere_operario
    ? avanzarMinutosEnJornada(inicio, tarea.tiempo_estimado_minutos, jornada)
    : sumarMinutos(inicio, tarea.tiempo_estimado_minutos)

  const fin_con_secado = tarea.requiere_secado && tarea.tiempo_secado_minutos > 0
    ? sumarMinutos(fin, tarea.tiempo_secado_minutos)
    : fin

  return { fin, fin_con_secado }
}

/**
 * Orden topológico de las tareas de UNA pieza respetando
 * `depende_de_secuencia`. Si detecta ciclo, devuelve 'ciclo'.
 * En ausencia de dependencia explícita, usa `secuencia` como
 * orden lineal (tarea N depende de N-1).
 */
export function tareasOrdenadasTopologicamente(
  tareasDeUnaPieza: TareaPlanificable[],
): TareaPlanificable[] | 'ciclo' {
  const porSecuencia = new Map<number, TareaPlanificable>()
  for (const t of tareasDeUnaPieza) porSecuencia.set(t.secuencia, t)

  const gradoEntrada = new Map<number, number>()
  const sucesores = new Map<number, number[]>()
  for (const t of tareasDeUnaPieza) {
    gradoEntrada.set(t.secuencia, 0)
    sucesores.set(t.secuencia, [])
  }
  for (const t of tareasDeUnaPieza) {
    const previa = t.depende_de_secuencia ?? (t.secuencia > 1 ? t.secuencia - 1 : null)
    if (previa != null && porSecuencia.has(previa)) {
      sucesores.get(previa)!.push(t.secuencia)
      gradoEntrada.set(t.secuencia, (gradoEntrada.get(t.secuencia) ?? 0) + 1)
    }
  }

  const cola: number[] = []
  for (const [s, g] of gradoEntrada) if (g === 0) cola.push(s)
  cola.sort((a, b) => a - b)

  const ordenSecuencias: number[] = []
  while (cola.length > 0) {
    const s = cola.shift()!
    ordenSecuencias.push(s)
    for (const suc of sucesores.get(s) ?? []) {
      const g = (gradoEntrada.get(suc) ?? 0) - 1
      gradoEntrada.set(suc, g)
      if (g === 0) cola.push(suc)
    }
    cola.sort((a, b) => a - b)
  }

  if (ordenSecuencias.length !== tareasDeUnaPieza.length) return 'ciclo'
  return ordenSecuencias.map(s => porSecuencia.get(s)!)
}

// =================================================================
// DETECCIÓN DE PROBLEMAS
// =================================================================

export function detectarSolape(a: TareaPlanificada, b: TareaPlanificada): Solape | null {
  if (!a.operario_id || !b.operario_id) return null
  if (a.operario_id !== b.operario_id) return null
  if (a.id === b.id) return null

  const ini = a.inicio > b.inicio ? a.inicio : b.inicio
  const fin = a.fin < b.fin ? a.fin : b.fin
  const mins = minutosEntre(ini, fin)
  if (mins <= 0) return null

  return {
    tarea_a_id: a.id,
    tarea_b_id: b.id,
    operario_id: a.operario_id,
    inicio: ini,
    fin,
    minutos_solapados: mins,
  }
}

export function detectarSolapesEnPlanificacion(tareas: TareaPlanificada[]): Solape[] {
  const porOperario = new Map<string, TareaPlanificada[]>()
  for (const t of tareas) {
    if (!t.operario_id) continue
    const arr = porOperario.get(t.operario_id) ?? []
    arr.push(t)
    porOperario.set(t.operario_id, arr)
  }

  const solapes: Solape[] = []
  for (const arr of porOperario.values()) {
    arr.sort((x, y) => x.inicio.getTime() - y.inicio.getTime())
    // Barrido lineal: solo comparar con la siguiente que empieza antes del fin de la actual.
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j].inicio >= arr[i].fin) break
        const s = detectarSolape(arr[i], arr[j])
        if (s) solapes.push(s)
      }
    }
  }
  return solapes
}

export function respetaSecuencia(
  tarea: TareaPlanificada,
  tareasMismaPieza: TareaPlanificada[],
): ViolacionSecuencia | null {
  const previaSec = tarea.depende_de_secuencia ?? (tarea.secuencia > 1 ? tarea.secuencia - 1 : null)
  if (previaSec == null) return null
  const previa = tareasMismaPieza.find(t => t.secuencia === previaSec)
  if (!previa) {
    return { tarea_id: tarea.id, motivo: 'previa_no_planificada', detalle: `Esperaba secuencia ${previaSec} de la pieza` }
  }
  if (tarea.inicio < previa.fin_con_secado) {
    const motivo: MotivoViolacionSecuencia = previa.requiere_secado && tarea.inicio < previa.fin_con_secado && tarea.inicio >= previa.fin
      ? 'secado_previo_no_respetado'
      : 'previa_posterior_en_tiempo'
    return { tarea_id: tarea.id, motivo, tarea_previa_id: previa.id }
  }
  return null
}

export function detectarViolacionesSecuencia(tareas: TareaPlanificada[]): ViolacionSecuencia[] {
  const porPieza = new Map<string, TareaPlanificada[]>()
  for (const t of tareas) {
    const arr = porPieza.get(t.pieza_id) ?? []
    arr.push(t)
    porPieza.set(t.pieza_id, arr)
  }
  const violaciones: ViolacionSecuencia[] = []
  for (const arr of porPieza.values()) {
    const orden = tareasOrdenadasTopologicamente(arr)
    if (orden === 'ciclo') {
      for (const t of arr) violaciones.push({ tarea_id: t.id, motivo: 'ciclo_dependencia' })
      continue
    }
    for (const t of arr) {
      const v = respetaSecuencia(t, arr)
      if (v) violaciones.push(v)
    }
  }
  return violaciones
}

export function detectarViolacionesPlazo(tareas: TareaPlanificada[]): ViolacionPlazo[] {
  const porPieza = new Map<string, TareaPlanificada[]>()
  for (const t of tareas) {
    const arr = porPieza.get(t.pieza_id) ?? []
    arr.push(t)
    porPieza.set(t.pieza_id, arr)
  }
  const violaciones: ViolacionPlazo[] = []
  for (const [pieza_id, arr] of porPieza) {
    const fechaEntrega = arr[0].pedido_fecha_entrega_estimada
    if (!fechaEntrega) continue
    const finUltima = arr.reduce((max, t) => t.fin_con_secado > max ? t.fin_con_secado : max, arr[0].fin_con_secado)
    if (finUltima > fechaEntrega) {
      violaciones.push({
        pieza_id,
        pedido_id: arr[0].pedido_id,
        fecha_entrega: fechaEntrega,
        fin_ultima_tarea: finUltima,
        retraso_minutos: minutosEntre(fechaEntrega, finUltima),
      })
    }
  }
  return violaciones
}

// =================================================================
// RIPPLE
// =================================================================

/**
 * Mueve la tarea `tareaMovidaId` a `nuevoInicio` y empuja todas las
 * tareas dependientes de su pieza para respetar secuencia + secado.
 * Las tareas de OTRAS piezas no se tocan (aunque pueda crear solapes
 * de operario; eso lo reporta después `detectarSolapesEnPlanificacion`).
 *
 * No muta el array original — devuelve uno nuevo y la lista de cambios.
 */
export function rippleTareasDependientes(
  tareaMovidaId: string,
  nuevoInicio: Date,
  operarioAsignado: string | null,
  todasLasTareas: TareaPlanificable[],
  jornada: JornadaLaboral,
): { cambios: CambioRipple[]; tareasResultantes: TareaPlanificada[] } {
  const movida = todasLasTareas.find(t => t.id === tareaMovidaId)
  if (!movida) return { cambios: [], tareasResultantes: planificarTodas(todasLasTareas, jornada) }

  // Construyo un mapa mutable {tarea_id -> {inicio, operario}} con la planificación actual.
  const estado = new Map<string, { inicio: Date | null; operario: string | null }>()
  for (const t of todasLasTareas) {
    estado.set(t.id, { inicio: t.inicio_planificado, operario: t.operario_id })
  }
  estado.set(movida.id, { inicio: nuevoInicio, operario: operarioAsignado ?? movida.operario_id })

  const cambios: CambioRipple[] = [{
    tarea_id: movida.id,
    inicio_anterior: movida.inicio_planificado,
    inicio_nuevo: nuevoInicio,
    minutos_empujado: movida.inicio_planificado ? minutosEntre(movida.inicio_planificado, nuevoInicio) : 0,
  }]

  // Empujar tareas posteriores de la misma pieza en orden topológico.
  const tareasPieza = todasLasTareas.filter(t => t.pieza_id === movida.pieza_id)
  const orden = tareasOrdenadasTopologicamente(tareasPieza)
  if (orden !== 'ciclo') {
    // Indexar fin_con_secado por secuencia a medida que avanzamos.
    const finPorSec = new Map<number, Date>()
    for (const t of orden) {
      const currentState = estado.get(t.id)!
      const previaSec = t.depende_de_secuencia ?? (t.secuencia > 1 ? t.secuencia - 1 : null)
      const finPredecesora = previaSec != null ? finPorSec.get(previaSec) : null

      let inicioDesdePredecesora = currentState.inicio
      if (finPredecesora && (!currentState.inicio || currentState.inicio < finPredecesora)) {
        inicioDesdePredecesora = finPredecesora
      }

      // Si la tarea es la movida, ya tiene su inicio fijado (y fue el disparador del ripple).
      if (t.id !== movida.id && inicioDesdePredecesora && inicioDesdePredecesora !== currentState.inicio) {
        const anterior = currentState.inicio
        estado.set(t.id, { ...currentState, inicio: inicioDesdePredecesora })
        cambios.push({
          tarea_id: t.id,
          inicio_anterior: anterior,
          inicio_nuevo: inicioDesdePredecesora,
          minutos_empujado: anterior ? minutosEntre(anterior, inicioDesdePredecesora) : 0,
        })
      }

      const inicioFinal = estado.get(t.id)!.inicio ?? inicioDesdePredecesora
      if (inicioFinal) {
        const { fin_con_secado } = calcularFinTarea(t, inicioFinal, jornada)
        finPorSec.set(t.secuencia, fin_con_secado)
      }
    }
  }

  // Construir resultado con TareaPlanificada completa.
  const tareasResultantes: TareaPlanificada[] = todasLasTareas.map(t => {
    const st = estado.get(t.id)!
    const inicio = st.inicio ?? new Date(0)
    const { fin, fin_con_secado } = calcularFinTarea(t, inicio, jornada)
    return {
      ...t,
      inicio_planificado: st.inicio,
      operario_id: st.operario,
      inicio,
      fin,
      fin_con_secado,
    }
  })

  return { cambios, tareasResultantes }
}

/**
 * Helper: convierte array de TareaPlanificable (con inicio_planificado
 * posiblemente null) en TareaPlanificada calculando fin/fin_con_secado.
 * Las que no tengan inicio_planificado se devuelven con inicio = epoch
 * y el consumidor decide.
 */
export function planificarTodas(
  tareas: TareaPlanificable[],
  jornada: JornadaLaboral,
): TareaPlanificada[] {
  return tareas.map(t => {
    const inicio = t.inicio_planificado ?? new Date(0)
    const { fin, fin_con_secado } = calcularFinTarea(t, inicio, jornada)
    return { ...t, inicio, fin, fin_con_secado }
  })
}

// =================================================================
// VENTANAS LIBRES Y SUGERENCIAS
// =================================================================

/**
 * Calcula los huecos libres de un operario en un día concreto
 * (dentro de su jornada) descontando las tareas que ya tiene asignadas.
 */
export function calcularVentanasLibresDia(
  operario: OperarioDisponible,
  fecha: Date,
  tareasDelOperario: TareaPlanificada[],
  jornada: JornadaLaboral,
): Ventana[] {
  if (!esDiaLaborable(fecha, jornada)) return []
  const inicioJ = conHora(fecha, jornada.hora_inicio)
  const finJ = conHora(fecha, jornada.hora_fin)

  const ocupadas = tareasDelOperario
    .filter(t => t.operario_id === operario.id && t.requiere_operario)
    .filter(t => t.fin > inicioJ && t.inicio < finJ)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())

  const libres: Ventana[] = []
  let cursor = inicioJ

  for (const ocu of ocupadas) {
    const iniOcu = ocu.inicio < inicioJ ? inicioJ : ocu.inicio
    const finOcu = ocu.fin > finJ ? finJ : ocu.fin
    if (iniOcu > cursor) {
      const mins = minutosEntre(cursor, iniOcu)
      if (mins > 0) {
        libres.push({ operario_id: operario.id, inicio: cursor, fin: iniOcu, minutos: mins })
      }
    }
    if (finOcu > cursor) cursor = finOcu
  }
  if (cursor < finJ) {
    libres.push({ operario_id: operario.id, inicio: cursor, fin: finJ, minutos: minutosEntre(cursor, finJ) })
  }
  return libres
}

/**
 * Sugiere qué tareas pendientes podrían encajar en los huecos libres
 * detectados. Criterio:
 *   - Hueco ≥ tiempo_estimado de la tarea.
 *   - `rol_operario_requerido` coincide con `operario.rol` (o null = cualquiera).
 *   - La tarea no está aún planificada (inicio_planificado == null).
 *   - Se respeta la secuencia: solo se sugieren tareas cuya predecesora
 *     ya termina antes del hueco.
 */
export function sugerirHuecos(
  operarios: OperarioDisponible[],
  fechas: Date[],
  tareasPlanificadas: TareaPlanificada[],
  tareasPendientes: TareaPlanificable[],
  jornada: JornadaLaboral,
): SugerenciaHueco[] {
  const sugerencias: SugerenciaHueco[] = []

  // Indexar fin_con_secado de la predecesora de cada tarea pendiente.
  const finPredecesoraPorTarea = new Map<string, Date | null>()
  for (const pend of tareasPendientes) {
    const prev = pend.depende_de_secuencia ?? (pend.secuencia > 1 ? pend.secuencia - 1 : null)
    if (prev == null) {
      finPredecesoraPorTarea.set(pend.id, null)
      continue
    }
    const hallada = tareasPlanificadas.find(tp => tp.pieza_id === pend.pieza_id && tp.secuencia === prev)
    finPredecesoraPorTarea.set(pend.id, hallada ? hallada.fin_con_secado : null)
  }

  for (const op of operarios.filter(o => o.activo)) {
    for (const fecha of fechas) {
      const tareasOp = tareasPlanificadas.filter(t => t.operario_id === op.id)
      const ventanas = calcularVentanasLibresDia(op, fecha, tareasOp, jornada)
      for (const v of ventanas) {
        const candidatas = tareasPendientes
          .filter(p => p.requiere_operario)
          .filter(p => p.inicio_planificado == null)
          .filter(p => p.tiempo_estimado_minutos <= v.minutos)
          .filter(p => !p.rol_operario_requerido || p.rol_operario_requerido === op.rol)
          .filter(p => {
            const finPrev = finPredecesoraPorTarea.get(p.id)
            return finPrev == null || finPrev <= v.inicio
          })
          .slice(0, 5)
        if (candidatas.length === 0) continue
        sugerencias.push({
          tipo: 'hueco',
          mensaje: `${op.nombre} libre ${formatearRango(v.inicio, v.fin)} (${v.minutos} min)`,
          operario_id: op.id,
          operario_nombre: op.nombre,
          ventana: v,
          tareas_candidatas: candidatas.map(c => ({
            tarea_id: c.id,
            pieza_id: c.pieza_id,
            pedido_id: c.pedido_id,
            proceso_codigo: c.proceso_codigo,
          })),
        })
      }
    }
  }
  return sugerencias
}

/**
 * Estima si un pedido necesita horas extra para cumplir su fecha de entrega.
 * Heurística: suma los minutos que se pasan del plazo y lo propone como
 * minutos de refuerzo. El rol afectado es el de la(s) tarea(s) que violan plazo.
 */
export function sugerirHorasExtra(
  pedido_id: string,
  tareasPedido: TareaPlanificada[],
  fechaEntrega: Date,
): SugerenciaHorasExtra | null {
  const violaciones = tareasPedido.filter(t => t.fin_con_secado > fechaEntrega)
  if (violaciones.length === 0) return null
  const minutos = violaciones.reduce((acc, t) => acc + minutosEntre(fechaEntrega, t.fin_con_secado), 0)
  const roles = Array.from(new Set(violaciones.map(t => t.rol_operario_requerido).filter((x): x is string => !!x)))
  return {
    tipo: 'horas_extra',
    mensaje: `Pedido ${pedido_id} se pasa de plazo en ${Math.round(minutos)} min acumulados`,
    pedido_id,
    minutos_necesarios: minutos,
    fecha_entrega: fechaEntrega,
    roles_afectados: roles,
  }
}

/**
 * Optimizador por lote de color. Agrupa tareas pendientes del mismo
 * material (lacado o fondo) en el rango de fechas dado y calcula
 * un ahorro estimado por agrupación.
 *
 * Heurística de ahorro:
 *   - Cada cambio de color en LACADO/FONDO evitado ahorra setup ≈
 *     20 min (limpieza de pistola + preparación). Parametrizable
 *     cuando tengamos dato real.
 *   - Se agrupa solo si hay ≥2 tareas con el mismo material.
 */
export function sugerirAgrupacionesPorMaterial(
  tareasPendientes: TareaPlanificable[],
  rangoFechas: { desde: Date; hasta: Date },
  minutosAhorroPorAgrupacion: number = 20,
): SugerenciaAgrupacion[] {
  const enRango = tareasPendientes.filter(t => {
    // Si aún no está planificada, entra en el radar (se sugiere fecha).
    if (!t.inicio_planificado) return true
    return t.inicio_planificado >= rangoFechas.desde && t.inicio_planificado <= rangoFechas.hasta
  })

  const sugerencias: SugerenciaAgrupacion[] = []

  // LACADO por material_lacado_id
  const gruposLacado = agruparPor(enRango.filter(t => t.proceso_codigo === 'LACADO' && t.material_lacado_id), t => t.material_lacado_id!)
  for (const [mat_id, tareas] of gruposLacado) {
    if (tareas.length < 2) continue
    sugerencias.push({
      tipo: 'agrupar_color',
      mensaje: `${tareas.length} piezas en LACADO comparten color — agrupar ahorra ~${(tareas.length - 1) * minutosAhorroPorAgrupacion} min`,
      proceso_codigo: 'LACADO',
      material_id: mat_id,
      tareas_ids: tareas.map(t => t.id),
      piezas_ids: Array.from(new Set(tareas.map(t => t.pieza_id))),
      pedidos_ids: Array.from(new Set(tareas.map(t => t.pedido_id))),
      minutos_ahorrados_estimados: (tareas.length - 1) * minutosAhorroPorAgrupacion,
    })
  }

  // FONDO por material_fondo_id
  const gruposFondo = agruparPor(enRango.filter(t => t.proceso_codigo === 'FONDO' && t.material_fondo_id), t => t.material_fondo_id!)
  for (const [mat_id, tareas] of gruposFondo) {
    if (tareas.length < 2) continue
    sugerencias.push({
      tipo: 'agrupar_color',
      mensaje: `${tareas.length} piezas en FONDO comparten material — agrupar ahorra ~${(tareas.length - 1) * minutosAhorroPorAgrupacion} min`,
      proceso_codigo: 'FONDO',
      material_id: mat_id,
      tareas_ids: tareas.map(t => t.id),
      piezas_ids: Array.from(new Set(tareas.map(t => t.pieza_id))),
      pedidos_ids: Array.from(new Set(tareas.map(t => t.pedido_id))),
      minutos_ahorrados_estimados: (tareas.length - 1) * minutosAhorroPorAgrupacion,
    })
  }

  return sugerencias
}

// =================================================================
// HELPERS de presentación
// =================================================================

function agruparPor<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const it of arr) {
    const k = keyFn(it)
    const bucket = m.get(k) ?? []
    bucket.push(it)
    m.set(k, bucket)
  }
  return m
}

function dosDigitos(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatearRango(a: Date, b: Date): string {
  const mismoDia = esMismoDia(a, b)
  const hhmmA = `${dosDigitos(a.getHours())}:${dosDigitos(a.getMinutes())}`
  const hhmmB = `${dosDigitos(b.getHours())}:${dosDigitos(b.getMinutes())}`
  if (mismoDia) {
    const fecha = `${dosDigitos(a.getDate())}/${dosDigitos(a.getMonth() + 1)}`
    return `${fecha} ${hhmmA}–${hhmmB}`
  }
  return `${a.toISOString().slice(0, 16)} → ${b.toISOString().slice(0, 16)}`
}
