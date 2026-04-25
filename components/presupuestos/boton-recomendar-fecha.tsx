'use client'

/**
 * Botón "Recomendar fecha" con dialog propio (sin alert/confirm nativos).
 *
 * Llama al simulador del Gantt, muestra resultado en un dialog con
 * tarjetas verdes/ámbar/rojas según el caso, y permite guardar la
 * fecha propuesta en el presupuesto.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { accionSimularEntrega } from '@/lib/actions/simulador-entrega'
import type { ResultadoSimulacion } from '@/lib/services/simulador-entrega'

export default function BotonRecomendarFecha({ presupuesto_id }: { presupuesto_id: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null)
  const [errorFatal, setErrorFatal] = useState<string | null>(null)

  async function abrirYSimular() {
    setAbierto(true)
    setResultado(null)
    setErrorFatal(null)
    setCargando(true)
    try {
      const r = await accionSimularEntrega(presupuesto_id)
      setResultado(r)
      if (!r.ok) setErrorFatal(r.error ?? 'No se pudo simular')
    } catch (e) {
      setErrorFatal(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  async function guardarFecha() {
    if (!resultado?.recomendado_iso) return
    setGuardando(true)
    try {
      const supabase = createClient()
      await supabase
        .from('presupuestos')
        .update({ fecha_entrega_estimada: resultado.recomendado_iso })
        .eq('id', presupuesto_id)
      setAbierto(false)
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  // Determinar tipo de aviso
  const tipo: 'ok' | 'advertencia' | 'error' =
    errorFatal || (resultado && !resultado.ok)
      ? 'error'
      : resultado && resultado.sin_hueco_count > 0
      ? 'advertencia'
      : 'ok'

  const fechaFmt = resultado?.recomendado_iso
    ? new Date(resultado.recomendado_iso).toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={abrirYSimular}
        title="Simula en el Gantt cuándo podría estar listo"
      >
        <CalendarRange className="w-4 h-4 mr-2" />
        Recomendar fecha
      </Button>

      <Dialog open={abierto} onOpenChange={(o) => { if (!o) setAbierto(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fecha de entrega recomendada</DialogTitle>
            <DialogDescription>
              Simulador basado en tareas ya planificadas y huecos libres de operarios (rango de 60 días).
            </DialogDescription>
          </DialogHeader>

          {cargando && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Calculando…</span>
            </div>
          )}

          {!cargando && errorFatal && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">No se pudo simular</div>
                <div className="mt-1">{errorFatal}</div>
              </div>
            </div>
          )}

          {!cargando && !errorFatal && resultado && (
            <div className="flex flex-col gap-3">
              {tipo === 'ok' && fechaFmt && (
                <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Listo el {fechaFmt}</div>
                    <div className="mt-1 text-xs">
                      Se encaja en los huecos disponibles respetando las tareas ya planificadas.
                    </div>
                  </div>
                </div>
              )}

              {tipo === 'advertencia' && fechaFmt && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Listo el {fechaFmt} (con matices)</div>
                    <div className="mt-1 text-xs">
                      {resultado.sin_hueco_count} tarea(s) no caben en los próximos 60 días. La fecha
                      propuesta es la mejor posible, pero tendrás que mover otras tareas o añadir horas
                      extra si quieres entregarlo antes.
                    </div>
                  </div>
                </div>
              )}

              {tipo === 'advertencia' && !fechaFmt && (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">No cabe en 60 días</div>
                    <div className="mt-1 text-xs">
                      Ninguna tarea virtual encontró hueco libre. Libera operarios, amplía el rango
                      o reconsidera el volumen.
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-slate-500">Piezas totales</span>
                  <span className="text-right font-semibold">{resultado.piezas_simuladas}</span>
                  <span className="text-slate-500">Tareas a encajar</span>
                  <span className="text-right font-semibold">{resultado.tareas_simuladas}</span>
                  <span className="text-slate-500">Tareas sin hueco</span>
                  <span className={`text-right font-semibold ${resultado.sin_hueco_count > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {resultado.sin_hueco_count}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cerrar</Button>
            {!cargando && resultado?.recomendado_iso && (
              <Button onClick={guardarFecha} disabled={guardando}>
                {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar esta fecha
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
