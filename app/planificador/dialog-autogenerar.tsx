'use client'

/**
 * Dialog de "Autogenerar Gantt":
 *   1. Click → dry_run → muestra preview (asignaciones, agrupaciones, sin_asignar).
 *   2. Botón confirmar → aplica → persiste.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { accionAutogenerar } from '@/lib/actions/planificador'
import type { ResultadoAutogenerarServicio } from '@/lib/services/planificador'

interface Props {
  desde: string
  hasta: string
  onAfterApply: () => void
}

export default function DialogAutogenerar({ desde, hasta, onAfterApply }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [preview, setPreview] = useState<ResultadoAutogenerarServicio | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function abrirYCalcular(open: boolean) {
    setAbierto(open)
    if (!open) { setPreview(null); return }
    setCalculando(true)
    setPreview(null)
    try {
      const res = await accionAutogenerar({ rango: { desde, hasta }, dry_run: true })
      setPreview(res)
    } finally {
      setCalculando(false)
    }
  }

  async function aplicar() {
    setAplicando(true)
    try {
      const res = await accionAutogenerar({ rango: { desde, hasta }, dry_run: false })
      if (res.ok) {
        startTransition(() => {
          router.refresh()
          onAfterApply()
        })
        setAbierto(false)
      } else {
        alert(`No se pudo autogenerar: ${res.error}`)
      }
    } finally {
      setAplicando(false)
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={abrirYCalcular}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          Autogenerar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Autogenerar Gantt</AlertDialogTitle>
          <AlertDialogDescription>
            Coloca automáticamente todas las tareas sin planificar en los huecos libres de los operarios, respetando secuencia, rol y agrupando por color cuando es posible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-3 rounded-md border bg-slate-50 p-3 text-sm">
          {calculando || !preview ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando propuesta…
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Tareas a asignar</span>
                <span className="font-semibold">{preview.sin_asignar_count + (preview.agrupaciones_aplicadas + (preview.asignaciones_aplicadas || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Agrupaciones por color</span>
                <span className="font-semibold text-emerald-700">{preview.agrupaciones_aplicadas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ahorro estimado</span>
                <span className="font-semibold text-emerald-700">~{preview.minutos_ahorrados_estimados} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Sin asignar (operario o secuencia)</span>
                <span className={`font-semibold ${preview.sin_asignar_count > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                  {preview.sin_asignar_count}
                </span>
              </div>
              {preview.rango_extendido && preview.rango_efectivo && (
                <div className="mt-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900">
                  El motor extendió automáticamente el rango hasta el{' '}
                  <strong>
                    {new Date(preview.rango_efectivo.hasta).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </strong>{' '}
                  para colocar todas las tareas (las que no cabían en el rango pedido se desplazaron a días posteriores, no se descartan).
                </div>
              )}
              {preview.sin_asignar_count > 0 && (
                <div className="mt-1 text-xs text-amber-700">
                  Las tareas sin asignar son por falta de operario compatible o
                  predecesora aún no planificada. Revisa la sección «Sin
                  planificar» del Gantt para resolverlas.
                </div>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); aplicar() }} disabled={calculando || aplicando || !preview?.ok}>
            {aplicando ? 'Aplicando…' : 'Aplicar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
