'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Loader2,
  CheckCircle2,
  Minus,
  Plus,
  Equal,
  AlertTriangle,
  Beaker,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { accionCompletarTarea } from '@/lib/actions/produccion'

type EstadoMezcla = 'exacto' | 'sobro' | 'falto'

export default function DialogCompletar({
  open,
  onOpenChange,
  tareaId,
  tareaProceso,
  piezaNumero,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tareaId: string
  tareaProceso: string
  piezaNumero: string
  onDone: (ok: boolean, texto: string) => void
}) {
  const [estado, setEstado] = useState<EstadoMezcla>('exacto')
  const [kgMerma, setKgMerma] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setEstado('exacto')
      setKgMerma('')
      setError(null)
    }
  }, [open])

  function submit() {
    setError(null)
    const necesitaKg = estado !== 'exacto'
    const kgNum = parseFloat(kgMerma)

    if (necesitaKg) {
      if (!Number.isFinite(kgNum) || kgNum <= 0) {
        setError('Introduce los kg que sobraron o faltaron (mayor que 0)')
        return
      }
    }

    startTransition(async () => {
      const res = await accionCompletarTarea({
        tareaId,
        mezcla: {
          estado,
          kg_merma_total: necesitaKg ? kgNum : undefined,
        },
      })
      if (res.ok) {
        let texto = 'Tarea completada'
        if (res.estado === 'en_secado' && res.finSecado) {
          const fs = new Date(res.finSecado as unknown as string)
          const hora = fs.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          texto = `Tarea completada. Pasa a secado hasta las ${hora}`
        }
        if (res.consumo?.ajuste_rendimiento_generado) {
          texto += ` · Merma ${res.consumo.merma_porcentaje}% supera umbral, ajuste pendiente de confirmar en /configuracion`
        }
        onDone(true, texto)
        onOpenChange(false)
      } else {
        setError(res.error ?? 'Error al completar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-emerald-600" />
            Completar tarea de mezcla
          </DialogTitle>
          <DialogDescription>
            Pieza <span className="font-mono">{piezaNumero}</span>
            {tareaProceso ? ` · ${tareaProceso}` : ''}. ¿Cómo fue la mezcla
            respecto a lo que se preparó?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tres opciones como botones grandes */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setEstado('exacto')}
              className={`rounded-lg border-2 p-3 text-center transition ${
                estado === 'exacto'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Equal className="w-6 h-6 mx-auto mb-1 text-emerald-700" />
              <div className="font-semibold text-sm">Exacto</div>
              <div className="text-xs text-slate-600">Se usó todo, nada sobró</div>
            </button>

            <button
              type="button"
              onClick={() => setEstado('sobro')}
              className={`rounded-lg border-2 p-3 text-center transition ${
                estado === 'sobro'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Minus className="w-6 h-6 mx-auto mb-1 text-blue-700" />
              <div className="font-semibold text-sm">Sobró</div>
              <div className="text-xs text-slate-600">Preparamos de más</div>
            </button>

            <button
              type="button"
              onClick={() => setEstado('falto')}
              className={`rounded-lg border-2 p-3 text-center transition ${
                estado === 'falto'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Plus className="w-6 h-6 mx-auto mb-1 text-amber-700" />
              <div className="font-semibold text-sm">Faltó</div>
              <div className="text-xs text-slate-600">Hubo que hacer más</div>
            </button>
          </div>

          {/* Input de kg si no es exacto */}
          {estado !== 'exacto' && (
            <div className="pt-1">
              <Label htmlFor="kg-merma">
                {estado === 'sobro' ? 'Kg de mezcla que sobraron en total' : 'Kg de mezcla que faltaron en total'}
              </Label>
              <Input
                id="kg-merma"
                type="number"
                step="0.001"
                min="0"
                value={kgMerma}
                onChange={(e) => setKgMerma(e.target.value)}
                placeholder="Ej. 0,300"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Suma todos los componentes (lacado/fondo + catalizador + disolvente).
                Se repartirá proporcionalmente entre los 3 materiales.
              </p>
            </div>
          )}

          <Alert className="bg-slate-50 border-slate-200 text-slate-700">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Si la merma supera el umbral configurado en /configuracion (15% por
              defecto), se creará un ajuste pendiente para revisar si el
              rendimiento global está bien calibrado.
            </AlertDescription>
          </Alert>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Completando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar y completar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
