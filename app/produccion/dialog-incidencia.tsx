'use client'

import { useState, useTransition } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { accionReportarIncidencia } from '@/lib/actions/produccion'

export default function DialogIncidencia({
  open,
  onOpenChange,
  tareaId,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tareaId: string
  onDone: (ok: boolean, texto: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await accionReportarIncidencia({
        tareaId,
        motivo: motivo.trim() || null,
      })
      if (res.ok) {
        onDone(true, 'Incidencia reportada')
        onOpenChange(false)
      } else {
        setError(res.error ?? 'Error al reportar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Reportar incidencia
          </DialogTitle>
          <DialogDescription>
            La tarea pasará a estado "incidencia". Las tareas posteriores de
            esta pieza quedan bloqueadas hasta que decidas qué hacer. Desde el
            panel podrás pulsar <strong>Duplicar tarea</strong> para crear
            una nueva copia pendiente si necesitas rehacerla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo (opcional)</Label>
          <Textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej: el lacado salió con burbuja, hay que lijar y volver a lacar"
          />
          <p className="text-xs text-muted-foreground">
            Se añade al histórico de notas de la tarea con fecha y hora.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending} variant="destructive">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Reportar incidencia
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
