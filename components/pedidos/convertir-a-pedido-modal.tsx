'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FilePlus2, AlertCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  accionConvertirPresupuestoAPedido,
  accionObtenerDatosParaConversion,
  type LineaParaConversion,
  type PresupuestoParaConversion,
} from '@/lib/actions/pedidos'
import type { PrioridadPedido } from '@/lib/services/pedidos'

// =============================================================
// Props
// =============================================================

interface Props {
  presupuestoId: string
  /** Número del presupuesto, para mostrar en el título */
  presupuestoNumero?: string
  /** Trigger custom. Si no se pasa, se usa un botón por defecto. */
  children?: React.ReactNode
}

// =============================================================
// Helpers
// =============================================================

function formatoEuros(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

/**
 * Construye una dirección de entrega por defecto a partir del cliente.
 * Devuelve string vacío si el cliente no tiene datos.
 */
function direccionDefectoCliente(
  cli: PresupuestoParaConversion['cliente']
): string {
  if (!cli) return ''
  const partes = [
    cli.direccion,
    cli.codigo_postal,
    cli.ciudad,
    cli.provincia,
  ].filter(Boolean)
  return partes.join(', ')
}

// =============================================================
// Componente
// =============================================================

export function ConvertirAPedidoModal({
  presupuestoId,
  presupuestoNumero,
  children,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Carga de datos
  const [cargando, setCargando] = useState(false)
  const [presupuesto, setPresupuesto] =
    useState<PresupuestoParaConversion | null>(null)
  const [lineas, setLineas] = useState<LineaParaConversion[]>([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Form state
  const [seleccion, setSeleccion] = useState<Map<string, number>>(new Map())
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadPedido>('normal')
  const [obsComerciales, setObsComerciales] = useState('')
  const [obsInternas, setObsInternas] = useState('')
  const [direccionEntrega, setDireccionEntrega] = useState('')
  const [contactoEntrega, setContactoEntrega] = useState('')
  const [telefonoEntrega, setTelefonoEntrega] = useState('')

  // Submit
  const [isPending, startTransition] = useTransition()
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)

  // =============================================================
  // Cargar datos al abrir + PRECARGA
  // =============================================================

  useEffect(() => {
    if (!open) return
    let cancelado = false

    setCargando(true)
    setErrorCarga(null)

    accionObtenerDatosParaConversion(presupuestoId)
      .then((res) => {
        if (cancelado) return
        if (res.ok && res.presupuesto) {
          setPresupuesto(res.presupuesto)
          setLineas(res.lineas)

          // PRECARGA de campos con los datos del presupuesto/cliente
          if (res.presupuesto.fecha_entrega_estimada) {
            setFechaEntrega(res.presupuesto.fecha_entrega_estimada)
          }
          if (res.presupuesto.observaciones_comerciales) {
            setObsComerciales(res.presupuesto.observaciones_comerciales)
          }
          if (res.presupuesto.observaciones_internas) {
            setObsInternas(res.presupuesto.observaciones_internas)
          }
          const cli = res.presupuesto.cliente
          if (cli) {
            setDireccionEntrega(direccionDefectoCliente(cli))
            setContactoEntrega(cli.persona_contacto ?? '')
            setTelefonoEntrega(cli.telefono ?? '')
          }
        } else if (!res.ok) {
          setErrorCarga(res.error ?? 'Error cargando datos')
        }
      })
      .catch((e) => {
        if (!cancelado) setErrorCarga(e?.message ?? 'Error de red')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [open, presupuestoId])

  // =============================================================
  // Handlers
  // =============================================================

  function toggleLinea(lineaId: string, pendiente: number) {
    setSeleccion((prev) => {
      const next = new Map(prev)
      if (next.has(lineaId)) {
        next.delete(lineaId)
      } else {
        next.set(lineaId, pendiente)
      }
      return next
    })
  }

  function cambiarCantidad(lineaId: string, cantidad: number) {
    setSeleccion((prev) => {
      const next = new Map(prev)
      if (cantidad <= 0) {
        next.delete(lineaId)
      } else {
        next.set(lineaId, cantidad)
      }
      return next
    })
  }

  function resetForm() {
    setSeleccion(new Map())
    setFechaEntrega('')
    setPrioridad('normal')
    setObsComerciales('')
    setObsInternas('')
    setDireccionEntrega('')
    setContactoEntrega('')
    setTelefonoEntrega('')
    setErrorSubmit(null)
    setErrorCarga(null)
    setPresupuesto(null)
    setLineas([])
  }

  function submit() {
    setErrorSubmit(null)

    const lineasInput = Array.from(seleccion.entries())
      .filter(([, c]) => c > 0)
      .map(([lineaPresupuestoId, cantidad]) => ({
        lineaPresupuestoId,
        cantidad,
      }))

    if (lineasInput.length === 0) {
      setErrorSubmit('Selecciona al menos una línea con cantidad mayor que 0')
      return
    }

    const mapPend = new Map(lineas.map((l) => [l.id, l.cantidad_pendiente]))
    for (const sel of lineasInput) {
      const pend = mapPend.get(sel.lineaPresupuestoId) ?? 0
      if (sel.cantidad > pend) {
        setErrorSubmit(
          `Una línea solicita ${sel.cantidad} unidades pero solo quedan ${pend} pendientes`
        )
        return
      }
    }

    startTransition(async () => {
      const res = await accionConvertirPresupuestoAPedido({
        presupuestoId,
        lineas: lineasInput,
        fechaEntregaEstimada: fechaEntrega || null,
        prioridad,
        observacionesComerciales: obsComerciales.trim() || null,
        observacionesInternas: obsInternas.trim() || null,
        direccionEntrega: direccionEntrega.trim() || null,
        contactoEntrega: contactoEntrega.trim() || null,
        telefonoEntrega: telefonoEntrega.trim() || null,
      })

      if (res.ok) {
        setOpen(false)
        resetForm()
        router.push(`/pedidos/${res.pedido.id}`)
        router.refresh()
      } else {
        setErrorSubmit(res.error ?? 'Error al crear el pedido')
      }
    })
  }

  // =============================================================
  // Derivados
  // =============================================================

  const lineasSeleccionadas = Array.from(seleccion.values()).filter(
    (c) => c > 0
  ).length

  const totalUnidades = Array.from(seleccion.values()).reduce(
    (s, n) => s + (n > 0 ? n : 0),
    0
  )

  const totalEstimado = Array.from(seleccion.entries()).reduce(
    (sum, [lineaId, cant]) => {
      if (cant <= 0) return sum
      const linea = lineas.find((l) => l.id === lineaId)
      if (!linea) return sum
      return sum + linea.precio_unitario * cant
    },
    0
  )

  const haySinPendiente =
    lineas.length > 0 && lineas.every((l) => l.cantidad_pendiente <= 0)

  // =============================================================
  // Render
  // =============================================================

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) resetForm()
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Convertir a pedido
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convertir presupuesto a pedido</DialogTitle>
          <DialogDescription>
            {presupuestoNumero && (
              <>
                Presupuesto{' '}
                <span className="font-mono">{presupuestoNumero}</span>
                {presupuesto?.cliente?.nombre_comercial && (
                  <> · Cliente: <strong>{presupuesto.cliente.nombre_comercial}</strong></>
                )}
                {'. '}
              </>
            )}
            Selecciona las líneas y cantidades a pedir. Puedes hacer pedidos
            parciales.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando líneas del presupuesto...
          </div>
        )}

        {errorCarga && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{errorCarga}</div>
          </div>
        )}

        {!cargando && !errorCarga && lineas.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Este presupuesto no tiene líneas.
          </div>
        )}

        {!cargando && !errorCarga && haySinPendiente && (
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Todas las líneas de este presupuesto ya están completamente pedidas.
              No hay cantidades pendientes para generar un nuevo pedido.
            </div>
          </div>
        )}

        {!cargando && !errorCarga && lineas.length > 0 && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-24 text-right">Original</TableHead>
                    <TableHead className="w-24 text-right">Pendiente</TableHead>
                    <TableHead className="w-32 text-right">
                      Cantidad a pedir
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l) => {
                    const checked =
                      seleccion.has(l.id) && (seleccion.get(l.id) ?? 0) > 0
                    const disabled = l.cantidad_pendiente <= 0
                    const valor = seleccion.get(l.id) ?? 0
                    return (
                      <TableRow key={l.id} className={disabled ? 'opacity-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() =>
                              toggleLinea(l.id, l.cantidad_pendiente)
                            }
                            aria-label="Incluir línea"
                          />
                        </TableCell>
                        <TableCell className="max-w-[400px]">
                          <div className="truncate text-sm">
                            {l.descripcion ?? '(sin descripción)'}
                          </div>
                          {disabled && (
                            <div className="text-xs text-muted-foreground">
                              Nada pendiente de pedir
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {l.cantidad_original}
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
              {lineasSeleccionadas} línea
              {lineasSeleccionadas === 1 ? '' : 's'} · {totalUnidades} unidad
              {totalUnidades === 1 ? '' : 'es'}
              {totalEstimado > 0 && (
                <>
                  {' '}
                  · Subtotal estimado:{' '}
                  <span className="font-medium text-foreground">
                    {formatoEuros(totalEstimado)}
                  </span>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fechaEntrega">Fecha entrega estimada</Label>
                <Input
                  id="fechaEntrega"
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prioridad">Prioridad</Label>
                <Select
                  value={prioridad}
                  onValueChange={(v) => setPrioridad(v as PrioridadPedido)}
                >
                  <SelectTrigger id="prioridad">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="direccionEntrega">
                  Dirección entrega
                </Label>
                <Input
                  id="direccionEntrega"
                  value={direccionEntrega}
                  onChange={(e) => setDireccionEntrega(e.target.value)}
                  placeholder="Se rellena con la del cliente. Edítala si la entrega es a otro sitio."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactoEntrega">Contacto entrega</Label>
                <Input
                  id="contactoEntrega"
                  value={contactoEntrega}
                  onChange={(e) => setContactoEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefonoEntrega">Teléfono entrega</Label>
                <Input
                  id="telefonoEntrega"
                  value={telefonoEntrega}
                  onChange={(e) => setTelefonoEntrega(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="obsComerciales">
                  Observaciones comerciales
                </Label>
                <Textarea
                  id="obsComerciales"
                  value={obsComerciales}
                  onChange={(e) => setObsComerciales(e.target.value)}
                  rows={2}
                  placeholder="Visibles para el cliente"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="obsInternas">Observaciones internas</Label>
                <Textarea
                  id="obsInternas"
                  value={obsInternas}
                  onChange={(e) => setObsInternas(e.target.value)}
                  rows={2}
                  placeholder="Notas solo visibles para ti"
                />
              </div>
            </div>

            {errorSubmit && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{errorSubmit}</div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              isPending ||
              cargando ||
              !!errorCarga ||
              lineasSeleccionadas === 0
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando pedido...
              </>
            ) : (
              <>
                <FilePlus2 className="mr-2 h-4 w-4" />
                Crear pedido
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConvertirAPedidoModal
