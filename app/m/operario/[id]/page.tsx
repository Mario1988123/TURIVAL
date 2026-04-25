import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OperarioMovilCliente from './operario-movil-cliente'

export const dynamic = 'force-dynamic'

interface PageProps { params: Promise<{ id: string }> }

export default async function OperarioMovilPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: operario } = await supabase
    .from('operarios')
    .select('id, nombre, rol, color, activo')
    .eq('id', id)
    .maybeSingle()
  if (!operario || !operario.activo) notFound()

  // Cargar tareas del operario para hoy y proximos 2 dias
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(hoy)
  fin.setDate(fin.getDate() + 3)

  const { data: tareas } = await supabase
    .from('tareas_produccion')
    .select(`
      id, secuencia, estado, tiempo_estimado_minutos, fecha_inicio_planificada, tentativa,
      proceso:procesos_catalogo(codigo, nombre, abreviatura, color_gantt),
      pieza:piezas(
        numero,
        linea_pedido:lineas_pedido(
          descripcion,
          pedido:pedidos(numero, prioridad, cliente:clientes(nombre_comercial))
        )
      )
    `)
    .eq('operario_id', id)
    .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
    .gte('fecha_inicio_planificada', hoy.toISOString())
    .lt('fecha_inicio_planificada', fin.toISOString())
    .order('fecha_inicio_planificada', { ascending: true })

  // Estado actual fichaje
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
  const { data: fichajesHoy } = await supabase
    .from('fichajes')
    .select('id, tipo, fecha_hora')
    .eq('operario_id', id)
    .gte('fecha_hora', inicioDia.toISOString())
    .order('fecha_hora', { ascending: false })
    .limit(1)
  const ultimoFichaje = fichajesHoy?.[0] ?? null

  return (
    <OperarioMovilCliente
      operario={operario}
      tareasIniciales={(tareas ?? []) as any[]}
      ultimoFichaje={ultimoFichaje as any}
    />
  )
}
