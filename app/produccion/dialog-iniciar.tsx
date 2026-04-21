'use client'

import { useState, useTransition } from 'react'
import { Loader2, Play } from 'lucide-react'

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

import { accionIniciarTarea } from '@/lib/actions/produccion'
import type { Operario } from '@/lib/services/operarios'

export default function DialogIniciar({
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
  const [operarioId, setOperarioId] = useState<string>(
    operariosActivos[0]?.id ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!operarioId) {
      setError('Selecciona un operario')
      return
    }
    startTransition(async () => {
      const res = await accionIniciarTarea({ tareaId, operarioId })
      if (res.ok) {
        onDone(true, 'Tarea iniciada')
        onOpenChange(false)
      } else {
        setError(res.error ?? 'Error al iniciar')
      }
    })
  }

  const sinOperarios = operariosActivos.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar tarea</DialogTitle>
          <DialogDescription>
            Pieza <span className="font-mono">{piezaNumero}</span>
            {tareaProceso ? ` · ${tareaProceso}` : ''}. Selecciona quién la
            va a hacer.
          </DialogDescription>
        </DialogHeader>

        {sinOperarios ? (
          <Alert variant="destructive">
            <AlertDescription>
              No hay operarios activos. Ve a /configuracion/operarios y crea
              o activa alguno antes de iniciar tareas.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="operario">Operario que ejecuta</Label>
            <Select value={operarioId} onValueChange={setOperarioId}>
              <SelectTrigger id="operario">
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
            <p className="text-xs text-muted-foreground">
              Si el operario tiene el rol adecuado aparece como candidato
              automático. Puedes elegir cualquiera activo igualmente.
            </p>
          </div>
        )}

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
          <Button
            onClick={submit}
            disabled={isPending || sinOperarios || !operarioId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Iniciando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Iniciar tarea
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
