// lib/services/informe-coste-pieza.ts
/**
 * Informe de coste/consumo por pieza (R6b-3c).
 *
 * Compara, para cada pieza:
 *   - Consumo ESTIMADO: suma de `consumo_*_estimado_kg` de sus tareas.
 *     Se calcula al arrancar la tarea y queda guardado.
 *   - Consumo REAL: suma de `consumo_*_real_kg` registrados al completar
 *     la tarea (diálogo de completar con merma).
 *   - Tiempo estimado vs real (por pieza y por proceso).
 *   - Merma %: (real - estimado) / estimado * 100.
 *
 * Se filtran piezas que tengan al menos una tarea completada con consumo
 * real registrado.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export interface ResumenCostePieza {
  pieza_id: string
  pieza_numero: string
  pedido_numero: string
  cliente_nombre: string
  estado: string
  superficie_m2: number | null

  lacado_estim_kg: number
  lacado_real_kg: number
  fondo_estim_kg: number
  fondo_real_kg: number
  cata_estim_kg: number
  cata_real_kg: number
  dis_estim_kg: number
  dis_real_kg: number

  tiempo_estim_min: number
  tiempo_real_min: number

  merma_lacado_pct: number | null
  merma_fondo_pct: number | null

  tareas_con_real: number
  fecha_ultima_real: string | null
}

export interface DetalleCostePiezaTarea {
  tarea_id: string
  secuencia: number
  proceso_codigo: string
  proceso_nombre: string
  estado: string
  operario_nombre: string | null
  tiempo_estim_min: number | null
  tiempo_real_min: number | null
  superficie_m2_aplicada: number | null
  lacado_estim_kg: number | null
  lacado_real_kg: number | null
  fondo_estim_kg: number | null
  fondo_real_kg: number | null
  cata_estim_kg: number | null
  cata_real_kg: number | null
  dis_estim_kg: number | null
  dis_real_kg: number | null
  consumo_registrado_at: string | null
}

export interface DetalleCostePieza extends ResumenCostePieza {
  tareas: DetalleCostePiezaTarea[]
}

// =============================================================
// HELPERS
// =============================================================

function num(x: unknown): number { return typeof x === 'number' ? x : Number(x ?? 0) || 0 }
function numOrNull(x: unknown): number | null {
  if (x == null) return null
  const n = Number(x)
  return isNaN(n) ? null : n
}

function mermaPct(estim: number, real: number): number | null {
  if (!estim || estim === 0) return null
  return Math.round(((real - estim) / estim) * 1000) / 10
}

// =============================================================
// CONSULTAS
// =============================================================

const SELECT_TAREA = `
  id, secuencia, estado, tiempo_estimado_minutos, tiempo_real_minutos,
  superficie_m2_aplicada, consumo_registrado_at,
  consumo_lacado_estimado_kg, consumo_lacado_real_kg,
  consumo_fondo_estimado_kg, consumo_fondo_real_kg,
  consumo_cata_estimado_kg, consumo_cata_real_kg,
  consumo_dis_estimado_kg, consumo_dis_real_kg,
  proceso:procesos_catalogo(codigo, nombre),
  operario:operarios(nombre)
`

export async function listarCostesPorPieza(): Promise<ResumenCostePieza[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('piezas')
    .select(`
      id, numero, estado, superficie_m2,
      linea_pedido:lineas_pedido(
        pedido:pedidos(numero, cliente:clientes(nombre_comercial))
      ),
      tareas:tareas_produccion(${SELECT_TAREA})
    `)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) throw error

  const out: ResumenCostePieza[] = []
  for (const p of ((data ?? []) as any[])) {
    const tareas = (p.tareas ?? []) as any[]
    const conReal = tareas.filter(t => t.consumo_registrado_at != null)
    if (conReal.length === 0) continue

    const sum = (k: string) => tareas.reduce((acc, t) => acc + num(t[k]), 0)

    const lacado_estim = sum('consumo_lacado_estimado_kg')
    const lacado_real  = sum('consumo_lacado_real_kg')
    const fondo_estim  = sum('consumo_fondo_estimado_kg')
    const fondo_real   = sum('consumo_fondo_real_kg')

    const linea = p.linea_pedido
    const pedido = linea?.pedido
    const cliente = pedido?.cliente

    out.push({
      pieza_id: p.id,
      pieza_numero: p.numero,
      pedido_numero: pedido?.numero ?? '',
      cliente_nombre: (Array.isArray(cliente) ? cliente[0]?.nombre_comercial : cliente?.nombre_comercial) ?? '',
      estado: p.estado,
      superficie_m2: numOrNull(p.superficie_m2),

      lacado_estim_kg: lacado_estim,
      lacado_real_kg: lacado_real,
      fondo_estim_kg: fondo_estim,
      fondo_real_kg: fondo_real,
      cata_estim_kg: sum('consumo_cata_estimado_kg'),
      cata_real_kg: sum('consumo_cata_real_kg'),
      dis_estim_kg: sum('consumo_dis_estimado_kg'),
      dis_real_kg: sum('consumo_dis_real_kg'),

      tiempo_estim_min: sum('tiempo_estimado_minutos'),
      tiempo_real_min: sum('tiempo_real_minutos'),

      merma_lacado_pct: mermaPct(lacado_estim, lacado_real),
      merma_fondo_pct: mermaPct(fondo_estim, fondo_real),

      tareas_con_real: conReal.length,
      fecha_ultima_real: conReal
        .map(t => t.consumo_registrado_at as string)
        .sort()
        .pop() ?? null,
    })
  }

  return out.sort((a, b) => (b.fecha_ultima_real ?? '').localeCompare(a.fecha_ultima_real ?? ''))
}

export async function obtenerDetalleCostePieza(pieza_id: string): Promise<DetalleCostePieza | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('piezas')
    .select(`
      id, numero, estado, superficie_m2,
      linea_pedido:lineas_pedido(
        pedido:pedidos(numero, cliente:clientes(nombre_comercial))
      ),
      tareas:tareas_produccion(${SELECT_TAREA})
    `)
    .eq('id', pieza_id)
    .single()
  if (error || !data) return null

  const p = data as any
  const tareas = (p.tareas ?? []) as any[]

  const tareasDetalle: DetalleCostePiezaTarea[] = tareas
    .sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0))
    .map(t => {
      const proc: any = Array.isArray(t.proceso) ? t.proceso[0] : t.proceso
      const op: any = Array.isArray(t.operario) ? t.operario[0] : t.operario
      return {
        tarea_id: t.id,
        secuencia: t.secuencia,
        proceso_codigo: proc?.codigo ?? '',
        proceso_nombre: proc?.nombre ?? '',
        estado: t.estado,
        operario_nombre: op?.nombre ?? null,
        tiempo_estim_min: numOrNull(t.tiempo_estimado_minutos),
        tiempo_real_min: numOrNull(t.tiempo_real_minutos),
        superficie_m2_aplicada: numOrNull(t.superficie_m2_aplicada),
        lacado_estim_kg: numOrNull(t.consumo_lacado_estimado_kg),
        lacado_real_kg: numOrNull(t.consumo_lacado_real_kg),
        fondo_estim_kg: numOrNull(t.consumo_fondo_estimado_kg),
        fondo_real_kg: numOrNull(t.consumo_fondo_real_kg),
        cata_estim_kg: numOrNull(t.consumo_cata_estimado_kg),
        cata_real_kg: numOrNull(t.consumo_cata_real_kg),
        dis_estim_kg: numOrNull(t.consumo_dis_estimado_kg),
        dis_real_kg: numOrNull(t.consumo_dis_real_kg),
        consumo_registrado_at: t.consumo_registrado_at,
      }
    })

  const sum = (k: keyof DetalleCostePiezaTarea) => tareasDetalle.reduce((a, t) => a + num(t[k]), 0)
  const lacado_estim = sum('lacado_estim_kg')
  const lacado_real  = sum('lacado_real_kg')
  const fondo_estim  = sum('fondo_estim_kg')
  const fondo_real   = sum('fondo_real_kg')

  const linea = p.linea_pedido
  const pedido = linea?.pedido
  const cliente = pedido?.cliente

  return {
    pieza_id: p.id,
    pieza_numero: p.numero,
    pedido_numero: pedido?.numero ?? '',
    cliente_nombre: (Array.isArray(cliente) ? cliente[0]?.nombre_comercial : cliente?.nombre_comercial) ?? '',
    estado: p.estado,
    superficie_m2: numOrNull(p.superficie_m2),

    lacado_estim_kg: lacado_estim,
    lacado_real_kg: lacado_real,
    fondo_estim_kg: fondo_estim,
    fondo_real_kg: fondo_real,
    cata_estim_kg: sum('cata_estim_kg'),
    cata_real_kg: sum('cata_real_kg'),
    dis_estim_kg: sum('dis_estim_kg'),
    dis_real_kg: sum('dis_real_kg'),

    tiempo_estim_min: sum('tiempo_estim_min'),
    tiempo_real_min: sum('tiempo_real_min'),

    merma_lacado_pct: mermaPct(lacado_estim, lacado_real),
    merma_fondo_pct: mermaPct(fondo_estim, fondo_real),

    tareas_con_real: tareasDetalle.filter(t => t.consumo_registrado_at).length,
    fecha_ultima_real: tareasDetalle
      .map(t => t.consumo_registrado_at)
      .filter((x): x is string => !!x)
      .sort()
      .pop() ?? null,

    tareas: tareasDetalle,
  }
}
