/**
 * Reorganizador del Gantt — propone movimientos para meter un pedido
 * urgente desplazando trabajos holgados, respetando secuencia y
 * compatibilidad de operario.
 *
 * Heuristica:
 *   1. El pedido objetivo necesita acabarse antes de su
 *      fecha_entrega_estimada (o lo antes posible).
 *   2. Para cada tarea del pedido objetivo, buscamos un hueco lo
 *      mas temprano posible (o desplazamos hacia atras tareas no-
 *      urgentes que esten ocupandolo).
 *   3. Una tarea es "no-urgente" si su pedido tiene fecha_entrega
 *      con holgura > 2 dias laborables tras desplazarla.
 *   4. NO rompemos secuencia: si tarea T1 va antes que T2 en la
 *      misma pieza, T2 sigue siendo despues de T1.
 *
 * Devuelve una lista de movimientos {tarea_id, antes, despues} para
 * que la UI los muestre como propuesta y Mario confirme.
 */

import {
  type TareaPlanificada,
  type TareaPlanificable,
  type OperarioDisponible,
  type JornadaLaboral,
  JORNADA_DEFAULT,
  calcularFinTarea,
  minutosJornadaEntre,
} from './planificador'

export interface MovimientoPropuesto {
  tarea_id: string
  pieza_numero?: string
  pedido_numero?: string
  proceso_codigo: string
  operario_id: string | null
  inicio_actual: Date | null
  inicio_propuesto: Date
  motivo: 'urgente_avanzado' | 'holgado_desplazado'
}

export interface PropuestaReorganizacion {
  pedido_objetivo_id: string
  movimientos: MovimientoPropuesto[]
  ahorro_minutos: number   // cuánto adelantamos el pedido urgente
  desplazamiento_total_minutos: number  // cuánto movemos de holgados
  warnings: string[]
}

const MS_DIA = 86400_000
const HOLGURA_MIN_DIAS = 2

/**
 * Busca tareas que podrian desplazarse para hacer hueco al pedido objetivo.
 * Estrategia conservadora: solo propone movimientos hacia ADELANTE en el
 * tiempo (nunca hacia atras), en pasos de un dia laborable.
 */
export function proponerReorganizacion(params: {
  pedido_objetivo_id: string
  todasLasTareas: TareaPlanificable[]
  operarios: OperarioDisponible[]
  jornada?: JornadaLaboral
}): PropuestaReorganizacion {
  const jornada = params.jornada ?? JORNADA_DEFAULT
  const warnings: string[] = []

  const tareasObjetivo = params.todasLasTareas.filter(
    (t) => t.pedido_id === params.pedido_objetivo_id,
  )
  if (tareasObjetivo.length === 0) {
    return {
      pedido_objetivo_id: params.pedido_objetivo_id,
      movimientos: [],
      ahorro_minutos: 0,
      desplazamiento_total_minutos: 0,
      warnings: ['Pedido objetivo no tiene tareas.'],
    }
  }

  // Tareas planificadas como "ocupadas" en el calendario
  const planificadas: TareaPlanificada[] = params.todasLasTareas
    .filter((t) => t.inicio_planificado != null)
    .map((t) => {
      const { fin, fin_con_secado } = calcularFinTarea(t, t.inicio_planificado!, jornada)
      return { ...t, inicio: t.inicio_planificado!, fin, fin_con_secado }
    })

  // Mapa operario_id -> ocupaciones (excluye tareas del pedido objetivo)
  const ocupacionesAjenas = new Map<string, TareaPlanificada[]>()
  for (const op of params.operarios) ocupacionesAjenas.set(op.id, [])
  for (const t of planificadas) {
    if (t.pedido_id === params.pedido_objetivo_id) continue
    if (!t.operario_id) continue
    const arr = ocupacionesAjenas.get(t.operario_id) ?? []
    arr.push(t)
    ocupacionesAjenas.set(t.operario_id, arr)
  }
  for (const [k, v] of ocupacionesAjenas) {
    v.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  }

  // Calcular nueva planificación tareas objetivo, una a una en orden de secuencia.
  const tareasObjOrdenadas = [...tareasObjetivo].sort((a, b) => {
    if (a.pieza_id !== b.pieza_id) return a.pieza_id.localeCompare(b.pieza_id)
    return a.secuencia - b.secuencia
  })
  const finPorPiezaSec = new Map<string, Date>()
  // Hereda los fines ya planificados de tareas objetivo (las que ya tenian fecha)
  for (const t of planificadas) {
    if (t.pedido_id !== params.pedido_objetivo_id) continue
    finPorPiezaSec.set(`${t.pieza_id}:${t.secuencia}`, t.fin_con_secado)
  }

  const movimientos: MovimientoPropuesto[] = []
  let ahorroAcumulado = 0
  const desplazadosVisitados = new Set<string>()
  let desplazamientoTotal = 0

  for (const tarea of tareasObjOrdenadas) {
    // 1) inicio minimo segun predecesora
    const previaSec = tarea.depende_de_secuencia ?? (tarea.secuencia > 1 ? tarea.secuencia - 1 : null)
    let inicioMinimo = new Date()
    if (previaSec != null) {
      const finPrev = finPorPiezaSec.get(`${tarea.pieza_id}:${previaSec}`)
      if (finPrev && finPrev > inicioMinimo) inicioMinimo = finPrev
    }
    if (tarea.inicio_planificado && tarea.inicio_planificado < inicioMinimo) {
      // Ya estaba después de su predecesora, mantén
    }

    // 2) Operario candidato
    const candidatos = params.operarios.filter(
      (op) => op.activo && (!tarea.rol_operario_requerido || op.rol === tarea.rol_operario_requerido),
    )
    if (candidatos.length === 0 && tarea.requiere_operario) {
      warnings.push(`Tarea ${tarea.id}: no hay operario con rol ${tarea.rol_operario_requerido}`)
      continue
    }

    // 3) Buscar hueco mas temprano: para cada candidato, encontrar
    //    el primer slot disponible >= inicioMinimo. Si en ese slot
    //    hay una tarea ajena Y esa tarea es desplazable, marcamos
    //    desplazamiento.
    let mejor: { operario_id: string; inicio: Date; desplazadas: TareaPlanificada[] } | null = null
    for (const op of (tarea.requiere_operario ? candidatos : params.operarios.slice(0, 1))) {
      const ocupaciones = ocupacionesAjenas.get(op.id) ?? []
      const inicioPropuesto = new Date(inicioMinimo)
      const desplazadas: TareaPlanificada[] = []
      for (const oc of ocupaciones) {
        if (oc.fin <= inicioPropuesto) continue
        if (oc.inicio >= new Date(inicioPropuesto.getTime() + tarea.tiempo_estimado_minutos * 60_000)) break
        // Hay solape — verificar si oc se puede desplazar
        if (esDesplazable(oc, jornada)) {
          desplazadas.push(oc)
          // En la propuesta, esa oc se moverá a despues de nuestra tarea
        } else {
          // No desplazable -> saltamos despues de oc
          inicioPropuesto.setTime(oc.fin.getTime())
          desplazadas.length = 0
        }
      }
      if (!mejor || inicioPropuesto < mejor.inicio) {
        mejor = { operario_id: op.id, inicio: inicioPropuesto, desplazadas }
      }
    }

    if (!mejor) {
      warnings.push(`Tarea ${tarea.id}: no se encontro hueco`)
      continue
    }

    // 4) Movimiento de la tarea objetivo
    if (!tarea.inicio_planificado || tarea.inicio_planificado.getTime() !== mejor.inicio.getTime()) {
      const ahorro = tarea.inicio_planificado
        ? minutosJornadaEntre(mejor.inicio, tarea.inicio_planificado, jornada)
        : 0
      ahorroAcumulado += ahorro
      movimientos.push({
        tarea_id: tarea.id,
        proceso_codigo: tarea.proceso_codigo,
        operario_id: mejor.operario_id,
        inicio_actual: tarea.inicio_planificado,
        inicio_propuesto: mejor.inicio,
        motivo: 'urgente_avanzado',
      })
    }

    // 5) Desplazamiento de tareas ajenas hacia adelante (mismo dia siguiente al de la tarea objetivo)
    let cursorDesplazamiento = new Date(mejor.inicio.getTime() + tarea.tiempo_estimado_minutos * 60_000)
    for (const oc of mejor.desplazadas) {
      if (desplazadosVisitados.has(oc.id)) continue
      desplazadosVisitados.add(oc.id)
      const nuevoIni = new Date(cursorDesplazamiento)
      const desplazamiento = minutosJornadaEntre(oc.inicio, nuevoIni, jornada)
      desplazamientoTotal += desplazamiento
      movimientos.push({
        tarea_id: oc.id,
        proceso_codigo: oc.proceso_codigo,
        operario_id: oc.operario_id,
        inicio_actual: oc.inicio,
        inicio_propuesto: nuevoIni,
        motivo: 'holgado_desplazado',
      })
      cursorDesplazamiento.setTime(nuevoIni.getTime() + oc.tiempo_estimado_minutos * 60_000)
    }

    // 6) Actualizar fin de la tarea para la siguiente secuencia de la pieza
    const finTarea = new Date(mejor.inicio.getTime() + tarea.tiempo_estimado_minutos * 60_000)
    finPorPiezaSec.set(`${tarea.pieza_id}:${tarea.secuencia}`, finTarea)
  }

  return {
    pedido_objetivo_id: params.pedido_objetivo_id,
    movimientos,
    ahorro_minutos: ahorroAcumulado,
    desplazamiento_total_minutos: desplazamientoTotal,
    warnings,
  }
}

/**
 * Una tarea es desplazable si:
 *   - Su pedido tiene fecha_entrega_estimada (o no la tiene = sin compromiso)
 *   - Y queda al menos HOLGURA_MIN_DIAS dias laborables entre su nuevo
 *     inicio y la fecha_entrega.
 */
function esDesplazable(t: TareaPlanificada, jornada: JornadaLaboral): boolean {
  if (!t.pedido_fecha_entrega_estimada) return true // sin compromiso, libre
  const minutos = minutosJornadaEntre(t.inicio, t.pedido_fecha_entrega_estimada, jornada)
  return minutos >= HOLGURA_MIN_DIAS * (jornada.dias_laborables.length > 0 ? 540 : 540)
}
