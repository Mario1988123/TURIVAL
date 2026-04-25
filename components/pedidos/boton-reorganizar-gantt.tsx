'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  accionProponerReorganizacion,
  accionAplicarReorganizacion,
} from '@/lib/actions/planificador'
import type { PropuestaReorganizacion } from '@/lib/services/planificador'

/**
 * Boton "Reorganizar Gantt" para meter este pedido lo antes posible
 * desplazando tareas de otros pedidos holgados.
 *
 * Flujo:
 *   1. Calcula propuesta (no toca BD).
 *   2. Muestra resumen (cuanto adelantamos vs cuanto desplazamos).
 *   3. Mario confirma — aplica los movimientos.
 */
export default function BotonReorganizarGantt({ pedidoId, pedidoNumero }: { pedidoId: string; pedidoNumero: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [propuesta, setPropuesta] = useState<PropuestaReorganizacion | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function calcular() {
    setCalculando(true)
    setError(null)
    setPropuesta(null)
    try {
      const res = await accionProponerReorganizacion(pedidoId)
      if (res.ok) setPropuesta(res.propuesta)
      else setError(res.error)
    } finally {
      setCalculando(false)
    }
  }

  async function aplicar() {
    if (!propuesta) return
    setAplicando(true)
    try {
      const res = await accionAplicarReorganizacion(propuesta)
      if (res.ok) {
        setAbierto(false)
        router.refresh()
      } else {
        setError(res.error ?? 'Error al aplicar')
      }
    } finally {
      setAplicando(false)
    }
  }

  function abrirYCalcular(open: boolean) {
    setAbierto(open)
    if (open && !propuesta && !calculando) calcular()
    if (!open) {
      setPropuesta(null)
      setError(null)
    }
  }

  const urgentes = propuesta?.movimientos.filter(m => m.motivo === 'urgente_avanzado') ?? []
  const desplazados = propuesta?.movimientos.filter(m => m.motivo === 'holgado_desplazado') ?? []

  return (
    <Dialog open={abierto} onOpenChange={abrirYCalcular}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50">
          <Sparkles className="h-4 w-4" />
          Reorganizar Gantt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reorganizar Gantt para {pedidoNumero}</DialogTitle>
          <DialogDescription>
            Adelanta este pedido desplazando tareas de pedidos con holgura ({'>'}2 dias laborables hasta entrega).
            Respeta secuencia de procesos y compatibilidad de operario.
          </DialogDescription>
        </DialogHeader>

        {calculando && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculando propuesta…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            {error}
          </div>
        )}

        {propuesta && !calculando && (
          <div className="space-y-3">
            {propuesta.movimientos.length === 0 ? (
              <div className="rounded-md bg-slate-50 p-4 text-center text-sm text-slate-600">
                No hay movimientos posibles. El pedido ya esta optimizado o no hay tareas desplazables.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700 font-medium">Adelanto del pedido</div>
                    <div className="text-xl font-bold text-emerald-900">
                      {Math.floor(propuesta.ahorro_minutos / 540)}d {Math.floor((propuesta.ahorro_minutos % 540) / 60)}h
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs text-amber-700 font-medium">Desplazamiento de holgados</div>
                    <div className="text-xl font-bold text-amber-900">
                      {Math.floor(propuesta.desplazamiento_total_minutos / 540)}d {Math.floor((propuesta.desplazamiento_total_minutos % 540) / 60)}h
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300">{urgentes.length}</Badge>
                    Tareas adelantadas (de este pedido)
                  </h4>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto rounded-md bg-emerald-50/50 p-2">
                    {urgentes.slice(0, 12).map((m) => (
                      <li key={m.tarea_id} className="font-mono">
                        {m.proceso_codigo} · {m.inicio_actual ? new Date(m.inicio_actual).toLocaleString('es-ES') : '—'} → {new Date(m.inicio_propuesto).toLocaleString('es-ES')}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Badge variant="outline" className="text-amber-700 border-amber-300">{desplazados.length}</Badge>
                    Tareas desplazadas (de pedidos holgados)
                  </h4>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto rounded-md bg-amber-50/50 p-2">
                    {desplazados.slice(0, 12).map((m) => (
                      <li key={m.tarea_id} className="font-mono">
                        {m.proceso_codigo} · {m.inicio_actual ? new Date(m.inicio_actual).toLocaleString('es-ES') : '—'} → {new Date(m.inicio_propuesto).toLocaleString('es-ES')}
                      </li>
                    ))}
                  </ul>
                </div>

                {propuesta.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    <strong>Avisos:</strong>
                    <ul className="list-disc pl-4 mt-1">
                      {propuesta.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={aplicando}>Cancelar</Button>
          <Button
            onClick={aplicar}
            disabled={!propuesta || propuesta.movimientos.length === 0 || aplicando}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {aplicando ? (
              <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Aplicando…</span>
            ) : (
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Aplicar movimientos</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
