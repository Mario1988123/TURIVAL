/**
 * Notificaciones para la campanita del sidebar.
 *
 * Calcula al vuelo desde tablas existentes — no hay tabla de
 * notificaciones nueva. Cada llamada hace 4-5 queries y devuelve
 * un array de notificaciones. La UI puede llamarla cada 60 seg.
 *
 * Tipos:
 *   - pedido_urgente: pedido con fecha_entrega_estimada en menos de
 *     X dias y tareas sin planificar.
 *   - pieza_lista_secado: pieza en estado en_secado cuyo tiempo de
 *     secado terminó hace mas de Y minutos.
 *   - tarea_demora: tarea iniciada hace mas del doble de su tiempo
 *     estimado y aun no completada.
 *   - presupuesto_pendiente: presupuesto en estado enviado con mas
 *     de N dias sin respuesta.
 */

import { createClient } from '@/lib/supabase/server'

export type TipoNotificacion =
  | 'pedido_urgente'
  | 'pieza_lista_secado'
  | 'tarea_demora'
  | 'presupuesto_pendiente'
  | 'fecha_sin_reservar'
  | 'solape_operario'
  | 'dia_holgado'
  | 'retraso_planificado'

export interface Notificacion {
  id: string                    // string unico (sin tabla)
  tipo: TipoNotificacion
  titulo: string
  detalle: string
  href: string
  prioridad: 'baja' | 'media' | 'alta'
  fecha?: string
}

const DIAS_URGENTE = 3
const DIAS_PRESUPUESTO_PENDIENTE = 7
const FACTOR_DEMORA = 2

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const ahora = new Date()
  const limiteUrgente = new Date(ahora)
  limiteUrgente.setDate(limiteUrgente.getDate() + DIAS_URGENTE)
  const limitePresupuesto = new Date(ahora)
  limitePresupuesto.setDate(limitePresupuesto.getDate() - DIAS_PRESUPUESTO_PENDIENTE)

  const notificaciones: Notificacion[] = []

  // 1) Pedidos urgentes (fecha_entrega < hoy+3d, tareas pendientes)
  const { data: pedidosUrg } = await supabase
    .from('pedidos')
    .select(`
      id, numero, fecha_entrega_estimada, prioridad,
      cliente:clientes(nombre_comercial)
    `)
    .eq('estado', 'en_produccion')
    .lte('fecha_entrega_estimada', limiteUrgente.toISOString())
    .gte('fecha_entrega_estimada', ahora.toISOString().slice(0, 10))
  for (const p of (pedidosUrg ?? []) as any[]) {
    notificaciones.push({
      id: `pedido_urgente_${p.id}`,
      tipo: 'pedido_urgente',
      titulo: `Pedido ${p.numero} entrega cerca`,
      detalle: `${p.cliente?.nombre_comercial ?? '—'} · ${new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES')}`,
      href: `/pedidos/${p.id}`,
      prioridad: 'alta',
      fecha: p.fecha_entrega_estimada,
    })
  }

  // 2) Piezas listas tras secado (en_secado, fecha_inicio + tiempo + secado < ahora)
  const { data: tareasSecado } = await supabase
    .from('tareas_produccion')
    .select(`
      id, fecha_inicio_planificada, tiempo_estimado_minutos,
      proceso:procesos_catalogo(tiempo_secado_minutos),
      pieza:piezas(numero, linea_pedido:lineas_pedido(pedido:pedidos(numero, id)))
    `)
    .eq('estado', 'en_secado')
    .limit(50)
  for (const t of (tareasSecado ?? []) as any[]) {
    if (!t.fecha_inicio_planificada) continue
    const ini = new Date(t.fecha_inicio_planificada).getTime()
    const finSecado = ini + (Number(t.tiempo_estimado_minutos ?? 0) + Number(t.proceso?.tiempo_secado_minutos ?? 0)) * 60_000
    if (finSecado > ahora.getTime()) continue
    const pedido = t.pieza?.linea_pedido?.pedido
    notificaciones.push({
      id: `pieza_secado_${t.id}`,
      tipo: 'pieza_lista_secado',
      titulo: `Pieza ${t.pieza?.numero} lista`,
      detalle: `Secado terminado · ${pedido?.numero ?? '—'}`,
      href: pedido?.id ? `/pedidos/${pedido.id}` : '/produccion',
      prioridad: 'media',
    })
  }

  // 3) Presupuestos enviados sin respuesta hace mas de 7 dias
  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('id, numero, created_at, cliente:clientes(nombre_comercial)')
    .eq('estado', 'enviado')
    .lte('created_at', limitePresupuesto.toISOString())
    .limit(20)
  for (const p of (presupuestos ?? []) as any[]) {
    notificaciones.push({
      id: `presupuesto_pendiente_${p.id}`,
      tipo: 'presupuesto_pendiente',
      titulo: `Presupuesto ${p.numero} sin respuesta`,
      detalle: `${p.cliente?.nombre_comercial ?? '—'} · enviado hace +${DIAS_PRESUPUESTO_PENDIENTE} dias`,
      href: `/presupuestos/${p.id}`,
      prioridad: 'baja',
      fecha: p.created_at,
    })
  }

  // 4) Tareas en demora (>2x del tiempo estimado en estado en_progreso)
  const { data: tareasProgreso } = await supabase
    .from('tareas_produccion')
    .select(`
      id, fecha_inicio_real, tiempo_estimado_minutos,
      proceso:procesos_catalogo(nombre),
      pieza:piezas(numero, linea_pedido:lineas_pedido(pedido:pedidos(numero, id)))
    `)
    .eq('estado', 'en_progreso')
    .limit(30)
  for (const t of (tareasProgreso ?? []) as any[]) {
    if (!t.fecha_inicio_real) continue
    const inicio = new Date(t.fecha_inicio_real).getTime()
    const transcurridos = (ahora.getTime() - inicio) / 60_000
    const estimado = Number(t.tiempo_estimado_minutos ?? 0)
    if (estimado > 0 && transcurridos > FACTOR_DEMORA * estimado) {
      const pedido = t.pieza?.linea_pedido?.pedido
      notificaciones.push({
        id: `demora_${t.id}`,
        tipo: 'tarea_demora',
        titulo: `${t.proceso?.nombre ?? 'Tarea'} en demora`,
        detalle: `${t.pieza?.numero} · ${Math.round(transcurridos)}min vs ${estimado}min estimado`,
        href: pedido?.id ? `/pedidos/${pedido.id}` : '/produccion',
        prioridad: 'alta',
      })
    }
  }

  // 5) Pedidos con fecha acordada sin reservar hueco (reusa logica)
  const { data: sinReservar } = await supabase
    .from('pedidos')
    .select(`
      id, numero, fecha_entrega_estimada,
      cliente:clientes(nombre_comercial)
    `)
    .eq('estado', 'en_produccion')
    .not('fecha_entrega_estimada', 'is', null)
    .limit(20)
  for (const p of (sinReservar ?? []) as any[]) {
    // Heuristica: contamos tareas con fecha planificada cuyo pedido sea este.
    // Hacemos la consulta con un join indirecto: piezas -> linea -> pedido.
    const { data: tareasPlan } = await supabase
      .from('tareas_produccion')
      .select('id, pieza:piezas(linea_pedido:lineas_pedido(pedido_id))')
      .not('fecha_inicio_planificada', 'is', null)
      .limit(2000)
    const enPedido = ((tareasPlan ?? []) as any[]).filter(
      (t) => t.pieza?.linea_pedido?.pedido_id === p.id,
    )
    if (enPedido.length === 0) {
      notificaciones.push({
        id: `sin_reservar_${p.id}`,
        tipo: 'fecha_sin_reservar',
        titulo: `${p.numero} sin reservar hueco`,
        detalle: `${p.cliente?.nombre_comercial ?? '—'} · entrega ${new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES')}`,
        href: `/planificador`,
        prioridad: 'media',
      })
    }
  }

  // 6) Solapes de operario: dos tareas en_progreso del mismo operario que se pisan
  const { data: solapesData } = await supabase
    .from('tareas_produccion')
    .select(`
      id, operario_id, fecha_inicio_planificada, tiempo_estimado_minutos,
      operario:operarios(nombre),
      pieza:piezas(numero, linea_pedido:lineas_pedido(pedido:pedidos(numero, id)))
    `)
    .not('operario_id', 'is', null)
    .not('fecha_inicio_planificada', 'is', null)
    .in('estado', ['en_progreso', 'en_cola'])
    .gte('fecha_inicio_planificada', ahora.toISOString().slice(0, 10))
    .lte('fecha_inicio_planificada', new Date(ahora.getTime() + 14 * 86400_000).toISOString())
    .limit(200)
  const porOperario = new Map<string, any[]>()
  for (const t of (solapesData ?? []) as any[]) {
    const arr = porOperario.get(t.operario_id) ?? []
    arr.push(t)
    porOperario.set(t.operario_id, arr)
  }
  const yaAvisados = new Set<string>()
  for (const [opId, tareas] of porOperario) {
    tareas.sort((a, b) => new Date(a.fecha_inicio_planificada).getTime() - new Date(b.fecha_inicio_planificada).getTime())
    for (let i = 0; i < tareas.length - 1; i++) {
      const t1 = tareas[i]
      const t2 = tareas[i + 1]
      const fin1 = new Date(t1.fecha_inicio_planificada).getTime() + Number(t1.tiempo_estimado_minutos ?? 0) * 60_000
      const ini2 = new Date(t2.fecha_inicio_planificada).getTime()
      if (fin1 > ini2) {
        const claveSolape = `solape_${opId}_${t1.id}_${t2.id}`
        if (yaAvisados.has(claveSolape)) continue
        yaAvisados.add(claveSolape)
        notificaciones.push({
          id: claveSolape,
          tipo: 'solape_operario',
          titulo: `Solape en ${t1.operario?.nombre ?? 'operario'}`,
          detalle: `${t1.pieza?.numero} pisa con ${t2.pieza?.numero}`,
          href: '/planificador',
          prioridad: 'alta',
        })
      }
    }
  }

  // 7) Días holgados (poca carga = oportunidad comercial)
  // Cargar carga horaria por dia laborable proximos 14 dias
  const cargaPorDia = new Map<string, number>()
  const operariosActivos: number = await supabase
    .from('operarios')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .then((r) => r.count ?? 0)
  const capacidadDiaria = operariosActivos * 540 // 9h × N operarios

  const inicioRango = new Date(ahora); inicioRango.setHours(0, 0, 0, 0)
  const finRango = new Date(inicioRango); finRango.setDate(finRango.getDate() + 14)
  const { data: tareasRango } = await supabase
    .from('tareas_produccion')
    .select('fecha_inicio_planificada, tiempo_estimado_minutos')
    .gte('fecha_inicio_planificada', inicioRango.toISOString())
    .lt('fecha_inicio_planificada', finRango.toISOString())
    .not('fecha_inicio_planificada', 'is', null)
  for (const t of (tareasRango ?? []) as any[]) {
    const dia = t.fecha_inicio_planificada.slice(0, 10)
    cargaPorDia.set(dia, (cargaPorDia.get(dia) ?? 0) + Number(t.tiempo_estimado_minutos ?? 0))
  }

  for (let d = 0; d < 14; d++) {
    const fecha = new Date(inicioRango); fecha.setDate(fecha.getDate() + d)
    const dow = fecha.getDay()
    if (dow === 0 || dow === 6) continue // sin domingo/sabado
    const clave = fecha.toISOString().slice(0, 10)
    const carga = cargaPorDia.get(clave) ?? 0
    const ratio = capacidadDiaria > 0 ? carga / capacidadDiaria : 0
    // Holgado: menos del 25% de capacidad
    if (capacidadDiaria > 0 && ratio < 0.25) {
      notificaciones.push({
        id: `holgado_${clave}`,
        tipo: 'dia_holgado',
        titulo: `${fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} con poca carga`,
        detalle: `${Math.round(ratio * 100)}% ocupacion · ${Math.round((capacidadDiaria - carga) / 60)}h libres. Buena oportunidad comercial.`,
        href: '/planificador',
        prioridad: 'baja',
        fecha: clave,
      })
    }
  }

  // Ordenar por prioridad y fecha
  const peso = { alta: 3, media: 2, baja: 1 }
  notificaciones.sort((a, b) => {
    const p = peso[b.prioridad] - peso[a.prioridad]
    if (p !== 0) return p
    return (b.fecha ?? '').localeCompare(a.fecha ?? '')
  })

  return notificaciones
}

/**
 * Resumen agregado para el panel completo: cuenta por tipo + lista por categoria.
 */
export interface ResumenNotificaciones {
  total: number
  por_prioridad: { alta: number; media: number; baja: number }
  por_tipo: Record<TipoNotificacion, Notificacion[]>
}

export async function obtenerResumenNotificaciones(): Promise<ResumenNotificaciones> {
  const items = await listarNotificaciones()
  const por_tipo = {
    pedido_urgente: [], pieza_lista_secado: [], tarea_demora: [],
    presupuesto_pendiente: [], fecha_sin_reservar: [], solape_operario: [],
    dia_holgado: [], retraso_planificado: [],
  } as Record<TipoNotificacion, Notificacion[]>
  for (const n of items) por_tipo[n.tipo].push(n)
  return {
    total: items.length,
    por_prioridad: {
      alta: items.filter((i) => i.prioridad === 'alta').length,
      media: items.filter((i) => i.prioridad === 'media').length,
      baja: items.filter((i) => i.prioridad === 'baja').length,
    },
    por_tipo,
  }
}
