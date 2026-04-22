'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react'

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { accionReabrirTarea } from '@/lib/actions/produccion'
import type { Operario } from '@/lib/services/operarios'

export default function DialogReabrir({
  open,
  onOpenChange,
  tareaId,
  tareaProceso,
  piezaNumero,
  operariosActivos,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tareaId: string
  tareaProceso: string
  piezaNumero: string
  operariosActivos: Operario[]
  onDone: (ok: boolean, texto: string) => void
}) {
  const [operarioId, setOperarioId] = useState<string>(operariosActivos[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setOperarioId(operariosActivos[0]?.id ?? '')
      setError(null)
    }
  }, [open, operariosActivos])

  function submit() {
    setError(null)
    if (!operarioId) {
      setError('Selecciona un operario')
      return
    }
    startTransition(async () => {
      const res = await accionReabrirTarea({ tareaId, operarioId })
      if (res.ok) {
        const suf = res.movimientosRevertidos > 0
          ? ` · ${res.movimientosRevertidos} movimiento(s) revertido(s) en ${res.materialesAfectados} material(es)`
          : ''
        onDone(true, `Tarea reabierta${suf}`)
        onOpenChange(false)
      } else {
        setError(res.error ?? 'Error al reabrir')
      }
    })
  }

  const sinOperarios = operariosActivos.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            Reabrir tarea completada
          </DialogTitle>
          <DialogDescription>
            Pieza <span className="font-mono">{piezaNumero}</span>
            {tareaProceso ? ` · ${tareaProceso}` : ''}. La tarea volverá al estado
            "en progreso" y podrás volver a completarla.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-orange-50 border-orange-300 text-orange-900">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            Al reabrir: se revierten los consumos de stock de esta tarea
            (restaurando el stock físico), se rechazan los ajustes de rendimiento
            pendientes que hubiera generado, y se crean movimientos "ajuste"
            inversos para dejar auditoría completa en el histórico.
          </AlertDescription>
        </Alert>

        {sinOperarios ? (
          <Alert variant="destructive">
            <AlertDescription>
              No hay operarios activos.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="operario-reabrir">Operario que va a rehacer la tarea</Label>
            <Select value={operarioId} onValueChange={setOperarioId}>
              <SelectTrigger id="operario-reabrir">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operariosActivos.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: o.color }}
                    />
                    {o.nombre}
                    {o.rol ? ` · ${o.rol}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            disabled={isPending || sinOperarios || !operarioId}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Reabriendo...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reabrir tarea
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
