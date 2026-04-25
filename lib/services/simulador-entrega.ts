// lib/services/simulador-entrega.ts
/**
 * Simulador de fecha de entrega para un presupuesto.
 *
 * Genera TAREAS VIRTUALES (sin persistir) a partir de:
 *   - Líneas del presupuesto con procesos_codigos, categoria_pieza_id,
 *     cantidad, superficie_m2, longitud_ml.
 *   - config_tiempos_proceso (por categoría, fallback global).
 *   - procesos_catalogo (códigos → id + rol + secado).
 *
 * Encaja las tareas virtuales en los huecos libres del Gantt actual usando
 * `autogenerarPlanificacion` del motor puro y devuelve:
 *   - fin_estimado: última fecha fin_con_secado encontrada.
 *   - piezas_simuladas: cuántas se pudieron acomodar.
 *   - sin_hueco: tareas que no cupieron en el rango.
 *   - recomendado_iso: YYYY-MM-DD para pintar en el Input type="date".
 */

import { createClient } from '@/lib/supabase/server'
import {
  autogenerarPlanificacion,
  type TareaPlanificable,
  type OperarioDisponible,
  JORNADA_DEFAULT,
} from '@/lib/motor/planificador'

export interface ResultadoSimulacion {
  ok: boolean
  fin_estimado: string | null
  recomendado_iso: string | null  // YYYY-MM-DD
  piezas_simuladas: number
  tareas_simuladas: number
  sin_hueco_count: number
  desde: string
  hasta: string
  error?: string
}

/**
 * Simula la entrega de un presupuesto. No escribe en BD.
 *
 * Algoritmo:
 * 1. Carga líneas del presupuesto + cliente + prioridad (asumida 'normal').
 * 2. Para cada línea, por cada unidad de cantidad, genera tareas virtuales
 *    según procesos_codigos.
 * 3. Carga operarios activos + tareas reales ya planificadas en [hoy, hoy+60d]
 *    como "ocupación previa".
 * 4. Ejecuta autogenerarPlanificacion en modo simulación (tareas virtuales
 *    con pedido_fecha_entrega_estimada = null → menor prioridad).
 * 5. El fin_estimado es el max(fin_con_secado) de las tareas virtuales
 *    asignadas. Si alguna no cupo, devolver sin_hueco_count y el fin parcial.
 */
export async function simularEntregaPresupuesto(presupuesto_id: string): Promise<ResultadoSimulacion> {
  const supabase = await createClient()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hasta = new Date(hoy.getTime() + 60 * 86_400_000)

  const resultadoBase: ResultadoSimulacion = {
    ok: false,
    fin_estimado: null,
    recomendado_iso: null,
    piezas_simuladas: 0,
    tareas_simuladas: 0,
    sin_hueco_count: 0,
    desde: hoy.toISOString(),
    hasta: hasta.toISOString(),
  }

  // 1. Cargar presupuesto + líneas
  const { data: pres, error: errP } = await supabase
    .from('presupuestos')
    .select(`
      id, numero, cliente_id,
      lineas:lineas_presupuesto(
        id, cantidad, superficie_m2, longitud_ml,
        procesos_codigos, categoria_pieza_id,
        material_lacado_id, material_fondo_id
      )
    `)
    .eq('id', presupuesto_id)
    .single()
  if (errP || !pres) return { ...resultadoBase, error: errP?.message ?? 'presupuesto no encontrado' }

  const lineas = ((pres as any).lineas ?? []) as any[]
  if (lineas.length === 0) return { ...resultadoBase, error: 'El presupuesto no tiene líneas' }

  // 2. Cargar procesos_catalogo por todos los códigos implicados
  const codigos = new Set<string>()
  for (const l of lineas) {
    if (Array.isArray(l.procesos_codigos)) for (const c of l.procesos_codigos) if (c) codigos.add(c)
  }
  if (codigos.size === 0) {
    return {
      ...resultadoBase,
      ok: true,
      error: 'Las líneas no tienen procesos_codigos. Vuelve a editar con el flujo v2 para recomendar fecha.',
    }
  }

  const { data: catProcs } = await supabase
    .from('procesos_catalogo')
    .select('id, codigo, activo, rol_operario_requerido, requiere_secado, tiempo_secado_minutos, requiere_operario, nombre')
    .in('codigo', Array.from(codigos))
  const mapaProceso = new Map<string, any>()
  for (const pc of ((catProcs ?? []) as any[])) mapaProceso.set(pc.codigo, pc)

  // 3. Cargar config_tiempos_proceso
  const procesoIds = Array.from(mapaProceso.values()).map((p: any) => p.id)
  const { data: tiempos } = procesoIds.length > 0
    ? await supabase
        .from('config_tiempos_proceso')
        .select('proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min')
        .in('proceso_id', procesoIds)
    : { data: [] as any[] }
  const clave = (procesoId: string, catId: string | null) => `${procesoId}__${catId ?? 'null'}`
  const mapaT = new Map<string, any>()
  for (const t of ((tiempos ?? []) as any[])) mapaT.set(clave(t.proceso_id, t.categoria_pieza_id), t)

  function tiempoMin(procesoId: string, catId: string | null, sup: number, lng: number): number {
    const elegido = (catId ? mapaT.get(clave(procesoId, catId)) : null) ?? mapaT.get(clave(procesoId, null))
    if (!elegido) return 0
    return Math.round(
      (Number(elegido.tiempo_base_min) || 0) +
      (Number(elegido.tiempo_por_m2_min) || 0) * sup +
      (Number(elegido.tiempo_por_ml_min) || 0) * lng,
    )
  }

  // 4. Construir tareas virtuales POR LÍNEA (no por pieza).
  //    Consistente con confirmarPedido: cuando lijamos/lacamos un lote de
  //    piezas iguales, es UNA tarea con duración del lote completo, no
  //    N tareas iguales. Las piezas se cuentan para trazabilidad pero la
  //    planificación opera a nivel de línea.
  const virtuales: TareaPlanificable[] = []
  const pseudoPedidoId = `sim-${presupuesto_id}`
  let piezaCounter = 0

  for (const l of lineas) {
    const codigosL: string[] = Array.isArray(l.procesos_codigos) ? l.procesos_codigos.filter(Boolean) : []
    if (codigosL.length === 0) continue
    const n = Math.max(1, Number(l.cantidad) || 1)
    piezaCounter += n
    // Una pseudo-pieza representa el LOTE completo de la línea.
    const pseudoPiezaId = `simp-${presupuesto_id}-${l.id}`
    codigosL.forEach((codigo, idx) => {
      const pc = mapaProceso.get(codigo)
      if (!pc || pc.activo === false) return
      virtuales.push({
        id: `simt-${presupuesto_id}-${l.id}-${idx}`,
        pieza_id: pseudoPiezaId,
        pedido_id: pseudoPedidoId,
        proceso_id: pc.id,
        proceso_codigo: pc.codigo,
        proceso_nombre: pc.nombre ?? pc.codigo,
        secuencia: idx + 1,
        es_opcional: false,
        depende_de_secuencia: idx > 0 ? idx : null,
        // Superficie/longitud son TOTALES de la línea (ya en BD), no por unidad.
        tiempo_estimado_minutos: tiempoMin(
          pc.id,
          l.categoria_pieza_id ?? null,
          Number(l.superficie_m2) || 0,
          Number(l.longitud_ml) || 0,
        ),
        requiere_secado: !!pc.requiere_secado,
        tiempo_secado_minutos: Number(pc.tiempo_secado_minutos) || 0,
        requiere_operario: pc.requiere_operario !== false,
        rol_operario_requerido: pc.rol_operario_requerido ?? null,
        material_lacado_id: l.material_lacado_id ?? null,
        material_fondo_id: l.material_fondo_id ?? null,
        inicio_planificado: null,
        operario_id: null,
        pedido_prioridad: 'normal',
        pedido_fecha_entrega_estimada: null,
      })
    })
  }

  // 5. Cargar ocupación real actual (tareas_produccion ya planificadas)
  const { data: tareasReales } = await supabase
    .from('tareas_produccion')
    .select(`
      id, secuencia, estado, es_opcional, depende_de_secuencia,
      tiempo_estimado_minutos, fecha_inicio_planificada, operario_id,
      proceso:procesos_catalogo(
        id, codigo, nombre, activo, requiere_secado, tiempo_secado_minutos,
        requiere_operario, rol_operario_requerido
      ),
      pieza:piezas(
        id, material_lacado_id, material_fondo_id,
        linea_pedido:lineas_pedido(
          pedido:pedidos(id, prioridad, fecha_entrega_estimada)
        )
      )
    `)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
    .not('fecha_inicio_planificada', 'is', null)

  const reales: TareaPlanificable[] = ((tareasReales ?? []) as any[]).map((t) => {
    const proc = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
    const pz = Array.isArray(t.pieza) ? t.pieza[0] : t.pieza
    const lp = Array.isArray(pz?.linea_pedido) ? pz?.linea_pedido?.[0] : pz?.linea_pedido
    const ped = Array.isArray(lp?.pedido) ? lp?.pedido?.[0] : lp?.pedido
    return {
      id: t.id,
      pieza_id: pz?.id ?? '',
      pedido_id: ped?.id ?? '',
      proceso_id: proc?.id ?? '',
      proceso_codigo: proc?.codigo ?? '',
      proceso_nombre: proc?.nombre ?? '',
      secuencia: t.secuencia,
      es_opcional: !!t.es_opcional,
      depende_de_secuencia: t.depende_de_secuencia,
      tiempo_estimado_minutos: Number(t.tiempo_estimado_minutos) || 0,
      requiere_secado: !!proc?.requiere_secado,
      tiempo_secado_minutos: Number(proc?.tiempo_secado_minutos) || 0,
      requiere_operario: proc?.requiere_operario !== false,
      rol_operario_requerido: proc?.rol_operario_requerido ?? null,
      material_lacado_id: pz?.material_lacado_id ?? null,
      material_fondo_id: pz?.material_fondo_id ?? null,
      inicio_planificado: t.fecha_inicio_planificada ? new Date(t.fecha_inicio_planificada) : null,
      operario_id: t.operario_id ?? null,
      pedido_prioridad: (ped?.prioridad ?? 'normal') as any,
      pedido_fecha_entrega_estimada: ped?.fecha_entrega_estimada ? new Date(ped.fecha_entrega_estimada) : null,
    }
  })

  // 6. Cargar operarios activos
  const { data: ops } = await supabase
    .from('operarios')
    .select('id, nombre, rol, activo')
    .eq('activo', true)
  const operarios: OperarioDisponible[] = ((ops ?? []) as any[]).map((o) => ({
    id: o.id, nombre: o.nombre, rol: o.rol ?? '', activo: true,
  }))

  // 7. Ejecutar autogenerador con universo = reales + virtuales,
  //    extendiendo rango automaticamente si no caben todas (Mario punto 10)
  const universo = [...reales, ...virtuales]
  const escalones = [14, 30, 60, 120]
  let r = autogenerarPlanificacion({
    tareasUniverso: universo,
    operarios,
    rangoFechas: { desde: hoy, hasta },
    jornada: JORNADA_DEFAULT,
  })
  for (const dias of escalones) {
    const sinHuecoEnRango = r.sin_asignar.filter((s) => s.razon === 'sin_huecos_en_rango').length
    if (sinHuecoEnRango === 0) break
    const hastaIntento = new Date(hoy.getTime() + dias * 86_400_000)
    if (hastaIntento <= hasta) continue
    r = autogenerarPlanificacion({
      tareasUniverso: universo,
      operarios,
      rangoFechas: { desde: hoy, hasta: hastaIntento },
      jornada: JORNADA_DEFAULT,
    })
  }

  // 8. Extraer fin_estimado del presupuesto virtual
  const asignadasVirtuales = r.asignaciones.filter((a) => a.pedido_id === pseudoPedidoId)
  let finMax: Date | null = null
  for (const a of asignadasVirtuales) {
    const t = virtuales.find((v) => v.id === a.tarea_id)
    if (!t) continue
    const finTarea = new Date(a.inicio.getTime() + t.tiempo_estimado_minutos * 60_000 + (t.requiere_secado ? t.tiempo_secado_minutos * 60_000 : 0))
    if (!finMax || finTarea > finMax) finMax = finTarea
  }

  const sinHuecoVirtuales = r.sin_asignar.filter((s) =>
    virtuales.some((v) => v.id === s.tarea_id),
  ).length

  const recomendadoIso = finMax ? finMax.toISOString().slice(0, 10) : null

  return {
    ok: true,
    fin_estimado: finMax ? finMax.toISOString() : null,
    recomendado_iso: recomendadoIso,
    piezas_simuladas: piezaCounter,
    tareas_simuladas: virtuales.length,
    sin_hueco_count: sinHuecoVirtuales,
    desde: hoy.toISOString(),
    hasta: hasta.toISOString(),
  }
}

/**
 * Lista presupuestos PENDIENTES (borrador + enviado) con líneas v2,
 * para que el Planificador los pinte como aviso.
 */
export interface PresupuestoPendiente {
  id: string
  numero: string
  estado: string
  cliente_nombre: string
  total: number
  fecha_entrega_estimada: string | null
  piezas_count: number
}

/**
 * Versión para PEDIDOS: las líneas están en `lineas_pedido` en lugar de
 * `lineas_presupuesto`. Permite recomendar fecha después de convertir
 * presupuesto→pedido, aunque siga en borrador.
 */
export async function simularEntregaPedido(pedido_id: string): Promise<ResultadoSimulacion> {
  const supabase = await createClient()
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const hasta = new Date(hoy.getTime() + 60 * 86_400_000)
  const base: ResultadoSimulacion = {
    ok: false, fin_estimado: null, recomendado_iso: null,
    piezas_simuladas: 0, tareas_simuladas: 0, sin_hueco_count: 0,
    desde: hoy.toISOString(), hasta: hasta.toISOString(),
  }

  const { data: ped, error: errP } = await supabase
    .from('pedidos')
    .select(`
      id, numero,
      lineas:lineas_pedido(
        id, cantidad, superficie_m2, longitud_ml,
        procesos_codigos, categoria_pieza_id,
        material_lacado_id, material_fondo_id
      )
    `)
    .eq('id', pedido_id)
    .single()
  if (errP || !ped) return { ...base, error: errP?.message ?? 'pedido no encontrado' }
  const lineas = ((ped as any).lineas ?? []) as any[]
  if (lineas.length === 0) return { ...base, error: 'El pedido no tiene líneas' }

  const codigos = new Set<string>()
  for (const l of lineas) if (Array.isArray(l.procesos_codigos)) for (const c of l.procesos_codigos) if (c) codigos.add(c)
  if (codigos.size === 0) return { ...base, ok: true, error: 'Líneas sin procesos_codigos (flujo v2).' }

  const { data: catProcs } = await supabase
    .from('procesos_catalogo')
    .select('id, codigo, activo, rol_operario_requerido, requiere_secado, tiempo_secado_minutos, requiere_operario, nombre')
    .in('codigo', Array.from(codigos))
  const mapaProceso = new Map<string, any>()
  for (const pc of ((catProcs ?? []) as any[])) mapaProceso.set(pc.codigo, pc)

  const procesoIds = Array.from(mapaProceso.values()).map((p: any) => p.id)
  const { data: tiempos } = procesoIds.length > 0
    ? await supabase.from('config_tiempos_proceso').select('proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min').in('proceso_id', procesoIds)
    : { data: [] as any[] }
  const k = (pid: string, cid: string | null) => `${pid}__${cid ?? 'null'}`
  const mt = new Map<string, any>()
  for (const t of ((tiempos ?? []) as any[])) mt.set(k(t.proceso_id, t.categoria_pieza_id), t)
  const tMin = (pid: string, cid: string | null, sup: number, lng: number) => {
    const e = (cid ? mt.get(k(pid, cid)) : null) ?? mt.get(k(pid, null))
    if (!e) return 0
    return Math.round((Number(e.tiempo_base_min)||0) + (Number(e.tiempo_por_m2_min)||0)*sup + (Number(e.tiempo_por_ml_min)||0)*lng)
  }

  // Tareas virtuales POR LÍNEA (una por proceso)
  const virtuales: TareaPlanificable[] = []
  const pseudoPedidoId = `sim-ped-${pedido_id}`
  let piezasTotal = 0
  for (const l of lineas) {
    const codigosL: string[] = Array.isArray(l.procesos_codigos) ? l.procesos_codigos.filter(Boolean) : []
    if (codigosL.length === 0) continue
    piezasTotal += Math.max(1, Number(l.cantidad) || 1)
    const pseudoPiezaId = `simp-ped-${pedido_id}-${l.id}`
    codigosL.forEach((codigo, idx) => {
      const pc = mapaProceso.get(codigo)
      if (!pc || pc.activo === false) return
      virtuales.push({
        id: `simt-ped-${pedido_id}-${l.id}-${idx}`,
        pieza_id: pseudoPiezaId,
        pedido_id: pseudoPedidoId,
        proceso_id: pc.id,
        proceso_codigo: pc.codigo,
        proceso_nombre: pc.nombre ?? pc.codigo,
        secuencia: idx + 1,
        es_opcional: false,
        depende_de_secuencia: idx > 0 ? idx : null,
        tiempo_estimado_minutos: tMin(pc.id, l.categoria_pieza_id ?? null, Number(l.superficie_m2)||0, Number(l.longitud_ml)||0),
        requiere_secado: !!pc.requiere_secado,
        tiempo_secado_minutos: Number(pc.tiempo_secado_minutos) || 0,
        requiere_operario: pc.requiere_operario !== false,
        rol_operario_requerido: pc.rol_operario_requerido ?? null,
        material_lacado_id: l.material_lacado_id ?? null,
        material_fondo_id: l.material_fondo_id ?? null,
        inicio_planificado: null,
        operario_id: null,
        pedido_prioridad: 'normal',
        pedido_fecha_entrega_estimada: null,
      })
    })
  }

  const { data: tareasReales } = await supabase
    .from('tareas_produccion')
    .select(`id, secuencia, estado, es_opcional, depende_de_secuencia, tiempo_estimado_minutos, fecha_inicio_planificada, operario_id, proceso:procesos_catalogo(id, codigo, nombre, activo, requiere_secado, tiempo_secado_minutos, requiere_operario, rol_operario_requerido), pieza:piezas(id, material_lacado_id, material_fondo_id, linea_pedido:lineas_pedido(pedido:pedidos(id, prioridad, fecha_entrega_estimada)))`)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
    .not('fecha_inicio_planificada', 'is', null)

  const reales: TareaPlanificable[] = ((tareasReales ?? []) as any[]).map((t) => {
    const proc = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
    const pz = Array.isArray(t.pieza) ? t.pieza[0] : t.pieza
    const lp = Array.isArray(pz?.linea_pedido) ? pz?.linea_pedido?.[0] : pz?.linea_pedido
    const pe = Array.isArray(lp?.pedido) ? lp?.pedido?.[0] : lp?.pedido
    return {
      id: t.id, pieza_id: pz?.id ?? '', pedido_id: pe?.id ?? '',
      proceso_id: proc?.id ?? '', proceso_codigo: proc?.codigo ?? '', proceso_nombre: proc?.nombre ?? '',
      secuencia: t.secuencia, es_opcional: !!t.es_opcional, depende_de_secuencia: t.depende_de_secuencia,
      tiempo_estimado_minutos: Number(t.tiempo_estimado_minutos) || 0,
      requiere_secado: !!proc?.requiere_secado, tiempo_secado_minutos: Number(proc?.tiempo_secado_minutos)||0,
      requiere_operario: proc?.requiere_operario !== false,
      rol_operario_requerido: proc?.rol_operario_requerido ?? null,
      material_lacado_id: pz?.material_lacado_id ?? null, material_fondo_id: pz?.material_fondo_id ?? null,
      inicio_planificado: t.fecha_inicio_planificada ? new Date(t.fecha_inicio_planificada) : null,
      operario_id: t.operario_id ?? null,
      pedido_prioridad: (pe?.prioridad ?? 'normal') as any,
      pedido_fecha_entrega_estimada: pe?.fecha_entrega_estimada ? new Date(pe.fecha_entrega_estimada) : null,
    }
  })

  const { data: ops } = await supabase.from('operarios').select('id, nombre, rol, activo').eq('activo', true)
  const operarios: OperarioDisponible[] = ((ops ?? []) as any[]).map((o) => ({ id: o.id, nombre: o.nombre, rol: o.rol ?? '', activo: true }))

  const r = autogenerarPlanificacion({
    tareasUniverso: [...reales, ...virtuales],
    operarios, rangoFechas: { desde: hoy, hasta }, jornada: JORNADA_DEFAULT,
  })

  const asigs = r.asignaciones.filter((a) => a.pedido_id === pseudoPedidoId)
  let finMax: Date | null = null
  for (const a of asigs) {
    const t = virtuales.find((v) => v.id === a.tarea_id)
    if (!t) continue
    const finT = new Date(a.inicio.getTime() + t.tiempo_estimado_minutos * 60_000 + (t.requiere_secado ? t.tiempo_secado_minutos * 60_000 : 0))
    if (!finMax || finT > finMax) finMax = finT
  }
  const sinHueco = r.sin_asignar.filter((s) => virtuales.some((v) => v.id === s.tarea_id)).length

  return {
    ok: true,
    fin_estimado: finMax ? finMax.toISOString() : null,
    recomendado_iso: finMax ? finMax.toISOString().slice(0, 10) : null,
    piezas_simuladas: piezasTotal,
    tareas_simuladas: virtuales.length,
    sin_hueco_count: sinHueco,
    desde: hoy.toISOString(),
    hasta: hasta.toISOString(),
  }
}

/**
 * Pedidos confirmados con fecha_entrega_estimada pero SIN tareas planificadas.
 * Para el banner "Fecha acordada pero no reservada" del Gantt.
 */
export interface PedidoConFechaSinReservar {
  id: string
  numero: string
  cliente_nombre: string
  fecha_entrega_estimada: string
  estado: string
  piezas_count: number
  tareas_planificadas: number
}

export async function listarPedidosFechaSinReservar(): Promise<PedidoConFechaSinReservar[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pedidos')
    .select(`
      id, numero, estado, fecha_entrega_estimada,
      cliente:clientes(nombre_comercial),
      lineas_pedido(id, piezas(id, tareas:tareas_produccion(id, fecha_inicio_planificada)))
    `)
    .in('estado', ['borrador', 'confirmado'])
    .not('fecha_entrega_estimada', 'is', null)
    .order('fecha_entrega_estimada', { ascending: true })
    .limit(30)

  return ((data ?? []) as any[]).map((p) => {
    const cli: any = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
    const piezas = ((p.lineas_pedido ?? []) as any[]).flatMap((lp: any) => lp.piezas ?? [])
    const tareasPlanif = piezas.flatMap((pz: any) => pz.tareas ?? []).filter((t: any) => t.fecha_inicio_planificada != null)
    return {
      id: p.id, numero: p.numero, estado: p.estado,
      cliente_nombre: cli?.nombre_comercial ?? '',
      fecha_entrega_estimada: p.fecha_entrega_estimada,
      piezas_count: piezas.length,
      tareas_planificadas: tareasPlanif.length,
    }
  }).filter((p) => p.tareas_planificadas === 0) // sin reservas en Gantt
}

export async function listarPresupuestosPendientes(): Promise<PresupuestoPendiente[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('presupuestos')
    .select(`
      id, numero, estado, total, fecha_entrega_estimada,
      cliente:clientes(nombre_comercial),
      lineas:lineas_presupuesto(id, cantidad)
    `)
    .in('estado', ['borrador', 'enviado'])
    .order('fecha_entrega_estimada', { ascending: true })
    .limit(50)
  if (error) return []
  return ((data ?? []) as any[]).map((p) => {
    const cli: any = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
    const piezas = ((p.lineas ?? []) as any[]).reduce((a, l) => a + (Number(l.cantidad) || 1), 0)
    return {
      id: p.id,
      numero: p.numero,
      estado: p.estado,
      cliente_nombre: cli?.nombre_comercial ?? '',
      total: Number(p.total) || 0,
      fecha_entrega_estimada: p.fecha_entrega_estimada,
      piezas_count: piezas,
    }
  })
}
