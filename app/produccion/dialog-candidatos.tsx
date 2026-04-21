'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Users } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'

import { accionAsignarCandidatos } from '@/lib/actions/produccion'
import type { Operario } from '@/lib/services/operarios'

export default function DialogCandidatos({
  open,
  onOpenChange,
  tareaId,
  operariosActivos,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tareaId: string
  operariosActivos: Operario[]
  onDone: (ok: boolean, texto: string) => void
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Cargar candidatos actuales de la tarea
  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)

    const supabase = createClient()
    supabase
      .from('operarios_tareas_candidatos')
      .select('operario_id')
      .eq('tarea_id', tareaId)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          setErrorCarga(error.message)
        } else {
          const ids = new Set(
            ((data ?? []) as Array<{ operario_id: string }>).map(
              (c) => c.operario_id
            )
          )
          setSeleccion(ids)
        }
        setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [open, tareaId])

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccion(new Set(operariosActivos.map((o) => o.id)))
  }

  function deseleccionarTodos() {
    setSeleccion(new Set())
  }

  function submit() {
    setErrorSubmit(null)
    startTransition(async () => {
      const res = await accionAsignarCandidatos({
        tareaId,
        operarioIds: Array.from(seleccion),
      })
      if (res.ok) {
        onDone(
          true,
          res.insertados === 0
            ? 'Tarea abierta (sin candidatos concretos)'
            : `${res.insertados} operario${res.insertados === 1 ? '' : 's'} asignado${res.insertados === 1 ? '' : 's'} como candidato${res.insertados === 1 ? '' : 's'}`
        )
        onOpenChange(false)
      } else {
        setErrorSubmit(res.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Operarios candidatos
          </DialogTitle>
          <DialogDescription>
            Marca los operarios que pueden hacer esta tarea. Solo uno de
            ellos la ejecutará al pulsar Iniciar. Si no marcas ninguno, la
            tarea queda abierta para cualquier operario.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando candidatos actuales...
          </div>
        )}

        {errorCarga && (
          <Alert variant="destructive">
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && operariosActivos.length === 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              No hay operarios activos. Ve a /configuracion/operarios.
            </AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && operariosActivos.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                {seleccion.size} de {operariosActivos.length} seleccionados
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={seleccionarTodos}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deseleccionarTodos}
                  className="h-7 text-xs"
                >
                  Ninguno
                </Button>
              </div>
            </div>

            <div className="space-y-1 max-h-[40vh] overflow-y-auto border rounded-md p-2">
              {operariosActivos.map((o) => {
                const checked = seleccion.has(o.id)
                return (
                  <label
                    key={o.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(o.id)}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: o.color }}
                    />
                    <span className="font-medium text-sm">{o.nombre}</span>
                    {o.rol && (
                      <span className="text-xs text-muted-foreground">
                        · {o.rol}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </>
        )}

        {errorSubmit && (
          <Alert variant="destructive">
            <AlertDescription>{errorSubmit}</AlertDescription>
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
          <Button onClick={submit} disabled={isPending || cargando}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar candidatos'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
