'use client'

/**
 * Panel histórico de movimientos del Gantt (Mario punto 33).
 * Lista los últimos 50 cambios persistidos en gantt_movimientos.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { History, Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Movimiento {
  id: string
  tarea_id: string
  fecha_anterior: string | null
  fecha_nueva: string
  motivo: string
  created_at: string
  // joins
  tarea?: { proceso?: { codigo: string; nombre: string }; pieza?: { numero: string; linea_pedido?: { pedido?: { numero: string; cliente?: { nombre_comercial: string } } } } }
  operario_anterior?: { nombre: string } | null
  operario_nuevo?: { nombre: string } | null
}

export default function PanelHistorico() {
  const [abierto, setAbierto] = useState(false)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('gantt_movimientos')
        .select(`
          id, tarea_id, fecha_anterior, fecha_nueva, motivo, created_at,
          operario_anterior:operarios!gantt_movimientos_operario_anterior_id_fkey(nombre),
          operario_nuevo:operarios!gantt_movimientos_operario_nuevo_id_fkey(nombre),
          tarea:tareas_produccion(
            proceso:procesos_catalogo(codigo, nombre),
            pieza:piezas(numero, linea_pedido:lineas_pedido(pedido:pedidos(numero, cliente:clientes(nombre_comercial))))
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      setMovimientos((data ?? []) as any[])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (abierto) cargar()
  }, [abierto, cargar])

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
          Histórico Gantt
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Histórico de movimientos</SheetTitle>
          <SheetDescription>
            Últimos 50 cambios manuales en el Gantt. Cada movimiento queda
            registrado con su tarea, fecha anterior y nueva.
          </SheetDescription>
        </SheetHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 mt-4">
            No hay movimientos registrados todavía.
          </div>
        ) : (
          <ul className="divide-y mt-4">
            {movimientos.map((m) => {
              const proc = m.tarea?.proceso
              const pieza = m.tarea?.pieza
              const pedido = pieza?.linea_pedido?.pedido
              const fechaA = m.fecha_anterior ? new Date(m.fecha_anterior) : null
              const fechaN = new Date(m.fecha_nueva)
              return (
                <li key={m.id} className="py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">
                        {proc?.codigo ?? 'Tarea'} · {pedido?.numero ?? '?'}
                      </div>
                      <div className="text-slate-600 truncate">
                        {pedido?.cliente?.nombre_comercial ?? '—'} · pieza {pieza?.numero ?? '?'}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-700">
                        <span>{fechaA ? fechaA.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '— sin planificar'}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold">
                          {fechaN.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {(m.operario_anterior || m.operario_nuevo) && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.operario_anterior?.nombre ?? '—'} → {m.operario_nuevo?.nombre ?? '—'}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.motivo === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {m.motivo}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleString('es-ES')}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
