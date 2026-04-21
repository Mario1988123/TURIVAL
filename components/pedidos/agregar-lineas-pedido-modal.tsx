'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, AlertCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  accionObtenerDatosParaConversion,
  accionAñadirLineasAPedido,
  type LineaParaConversion,
} from '@/lib/actions/pedidos'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  pedidoId: string
  presupuestoOrigenId: string
  onDone?: (ok: boolean, texto: string) => void
}

export function AgregarLineasPedidoModal({
  open,
  onOpenChange,
  pedidoId,
  presupuestoOrigenId,
  onDone,
}: Props) {
  const router = useRouter()

  const [cargando, setCargando] = useState(false)
  const [lineas, setLineas] = useState<LineaParaConversion[]>([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [seleccion, setSeleccion] = useState<Map<string, number>>(new Map())
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelado = false

    setCargando(true)
    setErrorCarga(null)
    setSeleccion(new Map())
    setErrorSubmit(null)

    accionObtenerDatosParaConversion(presupuestoOrigenId)
      .then((res) => {
        if (cancelado) return
        if (res.ok) {
          setLineas(res.lineas)
        } else {
          setErrorCarga(res.error ?? 'Error cargando datos')
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [open, presupuestoOrigenId])

  function toggle(id: string, pendiente: number) {
    setSeleccion((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, pendiente)
      return next
    })
  }

  function cambiarCantidad(id: string, cantidad: number) {
    setSeleccion((prev) => {
      const next = new Map(prev)
      if (cantidad <= 0) next.delete(id)
      else next.set(id, cantidad)
      return next
    })
  }

  function submit() {
    setErrorSubmit(null)
    const input = Array.from(seleccion.entries())
      .filter(([, c]) => c > 0)
      .map(([lineaPresupuestoId, cantidad]) => ({
        lineaPresupuestoId,
        cantidad,
      }))

    if (input.length === 0) {
      setErrorSubmit('Selecciona al menos una línea con cantidad > 0')
      return
    }

    const mapPend = new Map(lineas.map((l) => [l.id, l.cantidad_pendiente]))
    for (const sel of input) {
      const pend = mapPend.get(sel.lineaPresupuestoId) ?? 0
      if (sel.cantidad > pend) {
        setErrorSubmit(
          `Una línea pide ${sel.cantidad} unidades pero solo quedan ${pend} pendientes`
        )
        return
      }
    }

    startTransition(async () => {
      const res = await accionAñadirLineasAPedido({
        pedidoId,
        lineas: input,
      })
      if (res.ok) {
        onDone?.(
          true,
          `${res.lineasAñadidas} línea${res.lineasAñadidas === 1 ? '' : 's'} añadida${res.lineasAñadidas === 1 ? '' : 's'} al pedido`
        )
        onOpenChange(false)
        router.refresh()
      } else {
        setErrorSubmit(res.error ?? 'Error al añadir líneas')
      }
    })
  }

  const seleccionadas = Array.from(seleccion.values()).filter((c) => c > 0).length
  const totalUnidades = Array.from(seleccion.values()).reduce(
    (s, n) => s + (n > 0 ? n : 0),
    0
  )
  const haySinPendiente =
    lineas.length > 0 && lineas.every((l) => l.cantidad_pendiente <= 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir líneas al pedido</DialogTitle>
          <DialogDescription>
            Solo se muestran las líneas del presupuesto origen con cantidad
            pendiente. Las que ya están en este pedido no aparecen aquí:
            pendiente = cantidad original − ya pedida en otros pedidos no
            cancelados (incluyendo este).
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando líneas...
          </div>
        )}

        {errorCarga && (
          <Alert variant="destructive">
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && lineas.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Este presupuesto no tiene líneas.
          </div>
        )}

        {!cargando && !errorCarga && haySinPendiente && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Todas las líneas del presupuesto origen ya están completamente
              pedidas. No queda nada pendiente que añadir.
            </AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && lineas.length > 0 && !haySinPendiente && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-24 text-right">Pendiente</TableHead>
                    <TableHead className="w-32 text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l) => {
                    const disabled = l.cantidad_pendiente <= 0
                    const checked =
                      seleccion.has(l.id) && (seleccion.get(l.id) ?? 0) > 0
                    const valor = seleccion.get(l.id) ?? 0
                    return (
                      <TableRow
                        key={l.id}
                        className={disabled ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() =>
                              toggle(l.id, l.cantidad_pendiente)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.descripcion ?? '(sin descripción)'}
                          {disabled && (
                            <div className="text-xs text-muted-foreground">
                              Nada pendiente
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {l.cantidad_pendiente}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={l.cantidad_pendiente}
                            value={valor}
                            disabled={disabled}
                            onChange={(e) =>
                              cambiarCantidad(
                                l.id,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="ml-auto w-24 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">
              {seleccionadas} línea{seleccionadas === 1 ? '' : 's'} ·{' '}
              {totalUnidades} unidad{totalUnidades === 1 ? '' : 'es'}
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
          <Button
            onClick={submit}
            disabled={isPending || cargando || seleccionadas === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Añadiendo...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Añadir al pedido
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AgregarLineasPedidoModal
