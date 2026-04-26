'use client'

/**
 * Modal Planificar tareas del pedido (Mario punto 22).
 *
 * Tras pasar a producción o subir prioridad, abre este modal con todas
 * las tareas del pedido y deja editar operario y fecha de cada una.
 * Guarda en lote con accionMoverTarea respetando bloqueos de secuencia
 * y solapes (ya validados en el motor).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, CalendarRange, Save, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { accionMoverTarea } from '@/lib/actions/planificador'
// Shape mínimo de operario que usamos aquí (evita arrastrar
// lib/services/operarios.ts que importa supabase/server)
interface Operario {
  id: string
  nombre: string
  rol: string | null
  color?: string | null
  activo?: boolean
}

interface Tarea {
  id: string
  secuencia: number
  estado: string
  fecha_inicio_planificada: string | null
  operario_id: string | null
  tiempo_estimado_minutos: number
  proceso?: { codigo: string; nombre: string; abreviatura: string | null; rol_operario_requerido: string | null; color_gantt: string | null }
  pieza?: { numero: string }
}

export default function ModalPlanificarTareas({
  pedidoId,
  pedidoNumero,
  clienteNombre,
}: {
  pedidoId: string
  pedidoNumero: string
  clienteNombre: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [editado, setEditado] = useState<Map<string, { operario_id: string | null; fecha_iso: string | null }>>(new Map())
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  useEffect(() => {
    if (!abierto) return
    cargar()
  }, [abierto])

  async function cargar() {
    setCargando(true)
    try {
      const supabase = createClient()
      const { data: tareasData } = await supabase
        .from('tareas_produccion')
        .select(`
          id, secuencia, estado, fecha_inicio_planificada, operario_id, tiempo_estimado_minutos,
          proceso:procesos_catalogo(codigo, nombre, abreviatura, rol_operario_requerido, color_gantt),
          pieza:piezas!inner(numero, linea_pedido:lineas_pedido!inner(pedido_id))
        `)
        .eq('pieza.linea_pedido.pedido_id', pedidoId)
        .in('estado', ['pendiente', 'en_cola', 'en_progreso', 'en_secado'])
        .order('secuencia', { ascending: true })

      setTareas((tareasData ?? []) as any[])

      const { data: opsData } = await supabase
        .from('operarios')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setOperarios((opsData ?? []) as Operario[])
    } finally {
      setCargando(false)
    }
  }

  function actualizar(tareaId: string, campo: 'operario_id' | 'fecha_iso', valor: string | null) {
    setEditado((prev) => {
      const next = new Map(prev)
      const actual = next.get(tareaId) ?? { operario_id: null, fecha_iso: null }
      next.set(tareaId, { ...actual, [campo]: valor })
      return next
    })
  }

  async function guardar() {
    setGuardando(true)
    setErrores([])
    const errs: string[] = []
    for (const [tareaId, cambio] of editado) {
      if (!cambio.fecha_iso) continue
      const t = tareas.find((x) => x.id === tareaId)
      if (!t) continue
      const operarioFinal = cambio.operario_id ?? t.operario_id
      const res = await accionMoverTarea({
        tarea_id: tareaId,
        nuevo_inicio: cambio.fecha_iso,
        nuevo_operario_id: operarioFinal,
      })
      if (!res.ok) {
        errs.push(`${t.proceso?.codigo} ${t.pieza?.numero}: ${res.error}`)
      }
    }
    setErrores(errs)
    setGuardando(false)
    if (errs.length === 0) {
      setAbierto(false)
      setEditado(new Map())
      router.refresh()
    }
  }

  const compatibles = (rol: string | null | undefined): Operario[] => {
    if (!rol) return operarios
    return operarios.filter((o) => o.rol === rol || !o.rol)
  }

  const numEditados = editado.size

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
          <CalendarRange className="h-4 w-4" />
          Planificar tareas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Planificar tareas de {pedidoNumero}
            {clienteNombre && <span className="text-slate-500 font-normal"> · {clienteNombre}</span>}
          </DialogTitle>
          <DialogDescription>
            Asigna operario y fecha/hora a cada tarea. El motor bloquea movimientos
            que rompen la secuencia (no podrás iniciar lacado antes que termine fondo)
            o crean solapes en un mismo operario.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando…
          </div>
        ) : tareas.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-6">
            No hay tareas planificables. ¿Has confirmado el pedido?
          </div>
        ) : (
          <div className="space-y-2">
            {tareas.map((t) => {
              const cambio = editado.get(t.id) ?? { operario_id: null, fecha_iso: null }
              const operarioFinal = cambio.operario_id ?? t.operario_id ?? ''
              const fechaActual = cambio.fecha_iso ?? t.fecha_inicio_planificada ?? ''
              const fechaForLocal = fechaActual ? fechaActual.slice(0, 16) : ''
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 text-sm"
                  style={{ borderLeftWidth: 4, borderLeftColor: t.proceso?.color_gantt ?? '#64748b' }}
                >
                  <div className="col-span-3">
                    <div className="font-semibold">{t.proceso?.nombre}</div>
                    <div className="text-xs text-slate-500">{t.pieza?.numero} · {t.tiempo_estimado_minutos}min</div>
                  </div>
                  <div className="col-span-4">
                    <Select
                      value={operarioFinal}
                      onValueChange={(v) => actualizar(t.id, 'operario_id', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t.proceso?.rol_operario_requerido ? `Rol: ${t.proceso.rol_operario_requerido}` : 'Operario…'} />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibles(t.proceso?.rol_operario_requerido).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nombre} {o.rol ? <span className="text-slate-400 text-[10px]">({o.rol})</span> : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="datetime-local"
                      value={fechaForLocal}
                      onChange={(e) => actualizar(t.id, 'fecha_iso', e.target.value ? new Date(e.target.value).toISOString() : null)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-[10px]">
                      {t.estado.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {errores.length > 0 && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
            <div className="font-semibold mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Movimientos bloqueados:
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
          <Button
            onClick={guardar}
            disabled={guardando || numEditados === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {guardando ? (
              <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</span>
            ) : (
              <span className="flex items-center gap-1">
                <Save className="h-4 w-4" /> Guardar {numEditados > 0 ? `(${numEditados})` : ''}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
