'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  CheckCircle,
  Play,
  XCircle,
  AlertCircle,
  Loader2,
  MapPin,
  Factory,
  Plus,
  Trash2,
  QrCode,
  Truck,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  accionConfirmarPedido,
  accionArrancarProduccion,
  accionCancelarPedido,
  accionListarUbicacionesActivas,
  accionEliminarLineaPedido,
  type UbicacionOpcion,
} from '@/lib/actions/pedidos'
import type { EstadoPedido, PrioridadPedido } from '@/lib/services/pedidos'
import MoverPiezaModal from '@/components/pedidos/mover-pieza-modal'
import AgregarLineasPedidoModal from '@/components/pedidos/agregar-lineas-pedido-modal'
import BotonRecomendarFechaPedido from '@/components/pedidos/boton-recomendar-fecha-pedido'
import BotonReorganizarGantt from '@/components/pedidos/boton-reorganizar-gantt'
import ModalPlanificarTareas from '@/components/pedidos/modal-planificar-tareas'
import { createClient } from '@/lib/supabase/client'
import ReservasPanel from '@/components/pedidos/reservas-panel'

// =============================================================
// Labels / colores
// =============================================================

const ESTADOS_LABELS: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  en_produccion: 'En producción',
  completado: 'Completado',
  entregado: 'Entregado',
  facturado: 'Facturado',
  cancelado: 'Cancelado',
}

const ESTADOS_COLORS: Record<EstadoPedido, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-300',
  confirmado: 'bg-blue-100 text-blue-800 border-blue-300',
  en_produccion: 'bg-amber-100 text-amber-800 border-amber-300',
  completado: 'bg-teal-100 text-teal-800 border-teal-300',
  entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  facturado: 'bg-green-200 text-green-900 border-green-400',
  cancelado: 'bg-rose-100 text-rose-800 border-rose-300',
}

const PRIORIDADES_LABELS: Record<PrioridadPedido, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const PRIORIDADES_COLORS: Record<PrioridadPedido, string> = {
  baja: 'bg-slate-100 text-slate-600 border-slate-300',
  normal: 'bg-slate-50 text-slate-700 border-slate-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-300',
  urgente: 'bg-red-100 text-red-800 border-red-300',
}

const ESTADOS_PIEZA_COLORS: Record<string, string> = {
  sin_producir: 'bg-slate-100 text-slate-700 border-slate-300',
  en_produccion: 'bg-amber-100 text-amber-800 border-amber-300',
  completada: 'bg-teal-100 text-teal-800 border-teal-300',
  en_almacen: 'bg-blue-100 text-blue-800 border-blue-300',
  entregada: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  incidencia: 'bg-orange-100 text-orange-800 border-orange-300',
  cancelada: 'bg-rose-100 text-rose-800 border-rose-300',
}

const ESTADOS_PIEZA_LABELS: Record<string, string> = {
  sin_producir: 'Sin producir',
  en_produccion: 'En producción',
  completada: 'Completada',
  en_almacen: 'En almacén',
  entregada: 'Entregada',
  incidencia: 'Incidencia',
  cancelada: 'Cancelada',
}

// =============================================================
// Helpers
// =============================================================

const euro = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })

function fechaES(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

// =============================================================
// Componente principal
// =============================================================

export default function PedidoDetalleCliente({
  pedidoInicial,
}: {
  pedidoInicial: any
}) {
  const router = useRouter()
  // Usamos pedidoInicial directamente en vez de useState. Al llamar
  // router.refresh() tras una acción, el Server Component padre vuelve
  // a fetchear y nos pasa una nueva prop pedidoInicial — así la UI
  // refleja el nuevo estado (confirmado → en_produccion, etc.). Con
  // useState nos quedábamos congelados en el valor inicial (bug G).
  const pedido = pedidoInicial
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)

  // Dialogs de acciones sobre pedido
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [arrancarOpen, setArrancarOpen] = useState(false)
  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [añadirLineasOpen, setAñadirLineasOpen] = useState(false)

  // Dialog mover pieza
  const [moverState, setMoverState] = useState<{
    open: boolean
    piezaId: string
    piezaNumero: string
    ubicacionActualId: string | null
    ubicacionActualCodigo?: string
  } | null>(null)

  const estadoActual: EstadoPedido = pedido.estado
  const prioridadActual: PrioridadPedido = pedido.prioridad ?? 'normal'

  const puedeConfirmar = estadoActual === 'borrador'
  const puedeArrancar = estadoActual === 'confirmado'
  const puedeCancelar = !['entregado', 'facturado', 'cancelado'].includes(
    estadoActual
  )
  const puedeEditarLineas =
    estadoActual === 'borrador' && pedido.presupuesto_origen?.id
  const puedeMoverPiezas = !['cancelado'].includes(estadoActual)

  const totalPiezasEstimado = useMemo(() => {
    if (!pedido.lineas) return 0
    return pedido.lineas.reduce(
      (s: number, l: any) => s + Number(l.cantidad ?? 0),
      0
    )
  }, [pedido.lineas])

  const totalPiezasReales = useMemo(() => {
    if (!pedido.lineas) return 0
    return pedido.lineas.reduce(
      (s: number, l: any) => s + (l.piezas?.length ?? 0),
      0
    )
  }, [pedido.lineas])

  // Para mostrar el botón de Albarán solo si hay piezas YA terminadas
  const piezasListasParaAlbaran = useMemo(() => {
    if (!pedido.lineas) return 0
    return pedido.lineas.reduce(
      (s: number, l: any) =>
        s + (l.piezas?.filter((p: any) => p.estado === 'completada' || p.estado === 'lista').length ?? 0),
      0
    )
  }, [pedido.lineas])

  function notificar(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 5000)
  }

  function abrirMoverPieza(pieza: any) {
    setMoverState({
      open: true,
      piezaId: pieza.id,
      piezaNumero: pieza.numero,
      ubicacionActualId: pieza.ubicacion_id,
      ubicacionActualCodigo: pieza.ubicacion?.codigo,
    })
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/pedidos')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
              <Package className="w-8 h-8" />
              {pedido.numero}
              <Badge className={`text-xs border ${ESTADOS_COLORS[estadoActual]}`}>
                {ESTADOS_LABELS[estadoActual]}
              </Badge>
              <SelectorPrioridadInline
                pedidoId={pedido.id}
                pedidoNumero={pedido.numero}
                prioridadActual={prioridadActual}
                onCambiada={(nueva) => {
                  // local refresh — el motor lo aplica al recargar
                  router.refresh()
                }}
              />
            </h1>
            <p className="text-muted-foreground mt-1">
              Creado {fechaES(pedido.fecha_creacion)}
              {pedido.fecha_entrega_estimada && (
                <>
                  {' · Entrega prevista '}
                  {fechaES(pedido.fecha_entrega_estimada)}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {puedeConfirmar && (
            <Button
              onClick={() => setConfirmOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg ring-4 ring-amber-300/50"
            >
              <Play className="w-4 h-4 mr-2" />
              Pasar a producción
            </Button>
          )}
          {puedeArrancar && (
            <Button
              onClick={() => setArrancarOpen(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Arrancar producción
            </Button>
          )}
          {puedeCancelar && (
            <Button
              variant="outline"
              onClick={() => setCancelarOpen(true)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar pedido
            </Button>
          )}
          {pedido.estado === 'borrador' && (
            <BotonRecomendarFechaPedido pedido_id={pedido.id} />
          )}
          <BotonReorganizarGantt pedidoId={pedido.id} pedidoNumero={pedido.numero} />
          {pedido.estado === 'en_produccion' && (
            <ModalPlanificarTareas
              pedidoId={pedido.id}
              pedidoNumero={pedido.numero}
              clienteNombre={pedido.cliente?.nombre_comercial ?? null}
            />
          )}
          {totalPiezasReales > 0 && (
            <Link href={`/etiquetas/pedido/${pedido.id}`}>
              <Button variant="outline" size="default" title="Imprimir etiquetas/QR de las piezas">
                <QrCode className="w-4 h-4 mr-2" />
                Imprimir etiquetas
              </Button>
            </Link>
          )}
          {/* Albarán solo si hay piezas YA terminadas/listas (punto 15) */}
          {piezasListasParaAlbaran > 0 && (
            <Link href={`/albaranes?pedido_id=${pedido.id}`}>
              <Button variant="outline" size="default" title={`Crear albarán (${piezasListasParaAlbaran} pieza(s) listas)`}>
                <Truck className="w-4 h-4 mr-2" />
                Albarán ({piezasListasParaAlbaran})
              </Button>
            </Link>
          )}
          {/* Botón directo a producción (punto 18) */}
          {pedido.estado === 'en_produccion' && (
            <Link href={`/produccion?pedido_id=${pedido.id}`}>
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                <Factory className="w-4 h-4 mr-2" />
                Ver producción
              </Button>
            </Link>
          )}
        </div>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* AVISO GORDO: pedido en borrador sin piezas */}
      {puedeConfirmar && (
        <div className="rounded-xl border-4 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-md">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900">
                ⚠️ Este pedido NO está en producción todavía
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                Está en <strong>borrador</strong>. Las piezas (QR, etiquetas, tareas de producción) se crean al pasarlo a producción.
              </p>
              <p className="mt-2 text-sm text-amber-800">
                👉 Pulsa <strong>&quot;Pasar a producción&quot;</strong> de arriba. Elige una ubicación inicial (ej. Carrito 1) y de un solo click: se crean las piezas, se generan las tareas y el pedido arranca (tareas a la cola del Gantt).
              </p>
              <p className="mt-2 text-xs text-amber-700">
                Mientras no lo hagas: etiquetas vacías, producción no ve tareas, Gantt no pinta nada de este pedido.
              </p>
              <Button
                onClick={() => setConfirmOpen(true)}
                size="lg"
                className="mt-3 bg-amber-500 hover:bg-amber-600 text-white shadow-md"
              >
                <Play className="mr-2 h-5 w-5" />
                Pasar a producción ahora
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENTE + PRESUPUESTO ORIGEN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {pedido.cliente ? (
              <>
                <div className="font-semibold text-base">
                  {pedido.cliente.nombre_comercial}
                </div>
                {pedido.cliente.razon_social && (
                  <div className="text-muted-foreground">
                    {pedido.cliente.razon_social}
                  </div>
                )}
                {pedido.cliente.cif_nif && (
                  <div className="text-muted-foreground">
                    CIF/NIF: {pedido.cliente.cif_nif}
                  </div>
                )}
                {pedido.cliente.persona_contacto && (
                  <div>
                    <span className="text-muted-foreground">Contacto:</span>{' '}
                    {pedido.cliente.persona_contacto}
                  </div>
                )}
                {pedido.cliente.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>{' '}
                    {pedido.cliente.email}
                  </div>
                )}
                {pedido.cliente.telefono && (
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>{' '}
                    {pedido.cliente.telefono}
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">Sin cliente</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Presupuesto de origen</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {pedido.presupuesto_origen ? (
              <>
                <div>
                  <span className="text-muted-foreground">Número:</span>{' '}
                  <Link
                    href={`/presupuestos/${pedido.presupuesto_origen.id}`}
                    className="font-mono font-semibold text-blue-700 hover:underline"
                  >
                    {pedido.presupuesto_origen.numero}
                  </Link>
                </div>
                {pedido.presupuesto_origen.fecha && (
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>{' '}
                    {fechaES(pedido.presupuesto_origen.fecha)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">
                Pedido creado manualmente (sin presupuesto de origen)
              </div>
            )}
            <div className="pt-2 text-xs text-muted-foreground">
              Piezas estimadas al confirmar:{' '}
              <strong>{totalPiezasEstimado}</strong>
              {totalPiezasReales > 0 && (
                <>
                  {' · Piezas actuales: '}
                  <strong>{totalPiezasReales}</strong>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DIRECCIÓN ENTREGA */}
      {(pedido.direccion_entrega ||
        pedido.contacto_entrega ||
        pedido.telefono_entrega) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {pedido.direccion_entrega && (
              <div>
                <span className="text-muted-foreground">Dirección:</span>{' '}
                {pedido.direccion_entrega}
              </div>
            )}
            {pedido.contacto_entrega && (
              <div>
                <span className="text-muted-foreground">Contacto:</span>{' '}
                {pedido.contacto_entrega}
              </div>
            )}
            {pedido.telefono_entrega && (
              <div>
                <span className="text-muted-foreground">Teléfono:</span>{' '}
                {pedido.telefono_entrega}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RESERVAS DE MATERIAL (R6) — solo en estados post-confirmación */}
      {['confirmado', 'en_produccion', 'completado'].includes(estadoActual) && (
        <ReservasPanel pedidoId={pedido.id} />
      )}

      {/* LÍNEAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Líneas{' '}
            <span className="text-muted-foreground font-normal">
              ({pedido.lineas?.length ?? 0})
            </span>
          </CardTitle>
          {puedeEditarLineas && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAñadirLineasOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir líneas
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!pedido.lineas || pedido.lineas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Este pedido no tiene líneas.
              {puedeEditarLineas && ' Pulsa "Añadir líneas" arriba.'}
            </div>
          ) : (
            <div className="space-y-4">
              {pedido.lineas.map((l: any) => (
                <LineaCard
                  key={l.id}
                  linea={l}
                  pedidoId={pedido.id}
                  permiteEliminar={estadoActual === 'borrador'}
                  permiteMoverPiezas={puedeMoverPiezas}
                  onEliminada={(texto) => notificar('ok', texto)}
                  onError={(texto) => notificar('error', texto)}
                  onMoverPieza={abrirMoverPieza}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TOTALES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md ml-auto space-y-1 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {euro(Number(pedido.subtotal))}
              </span>
            </div>
            {Number(pedido.descuento_porcentaje) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">
                  Descuento ({pedido.descuento_porcentaje}%)
                </span>
                <span className="font-medium text-red-600">
                  −{euro(Number(pedido.descuento_importe))}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Base imponible</span>
              <span className="font-medium">
                {euro(Number(pedido.base_imponible))}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">
                IVA ({pedido.iva_porcentaje}%)
              </span>
              <span className="font-medium">
                {euro(Number(pedido.iva_importe))}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t mt-2 text-lg">
              <span className="font-bold">TOTAL</span>
              <span className="font-bold text-blue-700">
                {euro(Number(pedido.total))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OBSERVACIONES */}
      {(pedido.observaciones_comerciales ||
        pedido.observaciones_internas) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pedido.observaciones_comerciales && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Para el cliente
                </div>
                <div className="bg-slate-50 rounded p-3 whitespace-pre-wrap">
                  {pedido.observaciones_comerciales}
                </div>
              </div>
            )}
            {pedido.observaciones_internas && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Internas (no se imprimen)
                </div>
                <div className="bg-amber-50 rounded p-3 whitespace-pre-wrap">
                  {pedido.observaciones_internas}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DIALOGS */}
      <DialogConfirmarPedido
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pedidoId={pedido.id}
        totalPiezas={totalPiezasEstimado}
        onDone={(ok, texto) => {
          notificar(ok ? 'ok' : 'error', texto)
          if (ok) router.refresh()
        }}
      />

      <DialogArrancarProduccion
        open={arrancarOpen}
        onOpenChange={setArrancarOpen}
        pedidoId={pedido.id}
        totalPiezas={totalPiezasReales}
        onDone={(ok, texto) => {
          notificar(ok ? 'ok' : 'error', texto)
          if (ok) router.refresh()
        }}
      />

      <DialogCancelarPedido
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        pedidoId={pedido.id}
        numero={pedido.numero}
        onDone={(ok, texto) => {
          notificar(ok ? 'ok' : 'error', texto)
          if (ok) router.refresh()
        }}
      />

      {pedido.presupuesto_origen?.id && (
        <AgregarLineasPedidoModal
          open={añadirLineasOpen}
          onOpenChange={setAñadirLineasOpen}
          pedidoId={pedido.id}
          presupuestoOrigenId={pedido.presupuesto_origen.id}
          onDone={(ok, texto) => notificar(ok ? 'ok' : 'error', texto)}
        />
      )}

      {moverState && (
        <MoverPiezaModal
          open={moverState.open}
          onOpenChange={(o) =>
            setMoverState((prev) => (prev ? { ...prev, open: o } : null))
          }
          piezaId={moverState.piezaId}
          piezaNumero={moverState.piezaNumero}
          ubicacionActualId={moverState.ubicacionActualId}
          ubicacionActualCodigo={moverState.ubicacionActualCodigo}
          onDone={(ok, texto) => notificar(ok ? 'ok' : 'error', texto)}
        />
      )}
    </div>
  )
}

// =============================================================
// LineaCard — con botón eliminar (borrador) y botón mover por pieza
// =============================================================

function LineaCard({
  linea,
  pedidoId,
  permiteEliminar,
  permiteMoverPiezas,
  onEliminada,
  onError,
  onMoverPieza,
}: {
  linea: any
  pedidoId: string
  permiteEliminar: boolean
  permiteMoverPiezas: boolean
  onEliminada: (texto: string) => void
  onError: (texto: string) => void
  onMoverPieza: (pieza: any) => void
}) {
  const tipoPieza = linea.tipo_pieza ?? 'tablero'
  const piezas = (linea.piezas ?? []) as any[]
  const [eliminando, setEliminando] = useState(false)

  async function eliminar() {
    if (
      !confirm(
        `¿Quitar esta línea del pedido? (${linea.cantidad} unidades × ${linea.descripcion ?? 'sin descripción'})`
      )
    ) {
      return
    }
    setEliminando(true)
    const res = await accionEliminarLineaPedido({
      pedidoId,
      lineaPedidoId: linea.id,
    })
    setEliminando(false)
    if (res.ok) {
      onEliminada('Línea eliminada del pedido')
      // La revalidación del server action refresca; forzar refresh del router
      // se hace arriba en el onDone principal vía router.refresh.
      // Aquí basta con notificar.
      window.location.reload()
    } else {
      onError(res.error ?? 'Error al eliminar')
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-slate-50">
      <div className="flex items-start gap-2 flex-wrap mb-2">
        <Badge variant="outline" className="bg-white">
          {tipoPieza}
        </Badge>
        <div className="font-medium flex-1 min-w-40">
          {linea.descripcion ?? '(sin descripción)'}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            Cantidad: <strong>{linea.cantidad}</strong>
          </div>
          <div className="text-sm font-bold text-blue-700">
            {euro(Number(linea.total_linea))}
          </div>
        </div>
        {permiteEliminar && (
          <Button
            size="sm"
            variant="ghost"
            onClick={eliminar}
            disabled={eliminando}
            title="Quitar línea del pedido"
            className="text-red-600 hover:bg-red-50"
          >
            {eliminando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 mb-2">
        {tipoPieza === 'moldura' ? (
          <>
            <div>
              Longitud:{' '}
              <strong>{Number(linea.longitud_ml ?? 0).toFixed(2)} m</strong>
            </div>
            <div>
              Perfil:{' '}
              <strong>
                {linea.ancho ?? '?'} × {linea.grosor ?? '?'} mm
              </strong>
            </div>
          </>
        ) : tipoPieza === 'irregular' ? (
          <div className="col-span-full">
            Pieza irregular — precio pactado
          </div>
        ) : (
          <>
            <div>
              Dimensiones:{' '}
              <strong>
                {linea.ancho ?? 0} × {linea.alto ?? 0} × {linea.grosor ?? 0} mm
              </strong>
            </div>
            <div>
              Superficie:{' '}
              <strong>{Number(linea.superficie_m2 ?? 0).toFixed(3)} m²</strong>
            </div>
          </>
        )}
        {linea.color && (
          <div>
            Color: <strong>{linea.color.nombre}</strong>
          </div>
        )}
        {linea.tratamiento && (
          <div>
            Tratamiento: <strong>{linea.tratamiento.nombre}</strong>
          </div>
        )}
        {linea.cantidad != null && (
          <div>
            Cantidad: <strong>{linea.cantidad}</strong>
          </div>
        )}
        {linea.tiempo_estimado != null && Number(linea.tiempo_estimado) > 0 && (
          <div>
            Tiempo estim.: <strong>{Math.round(Number(linea.tiempo_estimado))} min</strong>
          </div>
        )}
        {linea.precio_unitario != null && (
          <div>
            Precio ud.: <strong>{Number(linea.precio_unitario).toFixed(2)} €</strong>
          </div>
        )}
        {linea.total_linea != null && (
          <div>
            Total línea: <strong>{Number(linea.total_linea).toFixed(2)} €</strong>
          </div>
        )}
      </div>

      {/* Procesos a aplicar (flujo v2) */}
      {Array.isArray(linea.procesos_codigos) && linea.procesos_codigos.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-slate-700">Procesos: </span>
          {linea.procesos_codigos.map((c: string, i: number) => (
            <Badge key={i} variant="outline" className="mr-1 text-[10px]">
              {c.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      )}

      {/* Materiales reservados */}
      {(linea.material_lacado_id || linea.material_fondo_id) && (
        <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {linea.material_lacado_id && (
            <div>
              Lacado: <span className="font-mono">{linea.material_lacado_id.slice(0, 8)}…</span>
            </div>
          )}
          {linea.material_fondo_id && (
            <div>
              Fondo: <span className="font-mono">{linea.material_fondo_id.slice(0, 8)}…</span>
            </div>
          )}
          {linea.categoria_pieza_id && (
            <div>
              Categoría: <span className="font-mono">{linea.categoria_pieza_id.slice(0, 8)}…</span>
            </div>
          )}
        </div>
      )}

      {piezas.length > 0 && (
        <div className="mt-3 pt-3 border-t bg-white -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Factory className="w-3.5 h-3.5" />
            {piezas.length} {piezas.length === 1 ? 'pieza' : 'piezas'}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Entrega prev.</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {piezas.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.numero}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ESTADOS_PIEZA_COLORS[p.estado] ?? ''}
                    >
                      {ESTADOS_PIEZA_LABELS[p.estado] ?? p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.ubicacion ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono">{p.ubicacion.codigo}</span>
                        <span className="text-muted-foreground">
                          {p.ubicacion.nombre}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {fechaES(p.fecha_prevista_fabricacion)}
                  </TableCell>
                  <TableCell className="text-right">
                    {permiteMoverPiezas && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onMoverPieza(p)}
                        title="Mover pieza"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// =============================================================
// Dialog Confirmar Pedido
// =============================================================

function DialogConfirmarPedido({
  open,
  onOpenChange,
  pedidoId,
  totalPiezas,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pedidoId: string
  totalPiezas: number
  onDone: (ok: boolean, texto: string) => void
}) {
  const [ubicaciones, setUbicaciones] = useState<UbicacionOpcion[]>([])
  const [ubicacionId, setUbicacionId] = useState<string>('')
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    accionListarUbicacionesActivas()
      .then((res) => {
        if (cancelado) return
        if (res.ok) {
          setUbicaciones(res.ubicaciones)
          if (res.ubicaciones.length > 0) {
            setUbicacionId(res.ubicaciones[0].id)
          }
        } else {
          setErrorCarga(res.error ?? 'Error cargando ubicaciones')
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [open])

  function submit() {
    setErrorSubmit(null)
    if (!ubicacionId) {
      setErrorSubmit('Selecciona una ubicación')
      return
    }
    startTransition(async () => {
      // Paso 1: confirmar (crea piezas + tareas)
      const res = await accionConfirmarPedido({ pedidoId, ubicacionId })
      if (!res.ok) {
        setErrorSubmit(res.error ?? 'Error al confirmar')
        return
      }
      // Paso 2: arrancar producción automáticamente → pedido pasa a 'en_produccion'
      //         y las tareas pendiente → en_cola. Así desbloqueamos el flujo
      //         que Mario pedía: un solo click = piezas + producción.
      const resArr = await accionArrancarProduccion(pedidoId)
      if (!resArr.ok) {
        // Las piezas ya están creadas. Mostramos aviso pero no bloqueamos.
        onOpenChange(false)
        onDone(
          true,
          `Pedido confirmado con ${res.piezasCreadas} pieza${res.piezasCreadas === 1 ? '' : 's'}. ⚠️ No se pudo arrancar producción automáticamente: ${resArr.error}. Pulsa "Arrancar producción" manualmente.`
        )
        return
      }
      onOpenChange(false)
      onDone(
        true,
        `✅ Pedido en producción. ${res.piezasCreadas} pieza${res.piezasCreadas === 1 ? '' : 's'} creada${res.piezasCreadas === 1 ? '' : 's'} · ${res.tareasCreadas} tarea${res.tareasCreadas === 1 ? '' : 's'} en cola de producción.`
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pasar a producción</DialogTitle>
          <DialogDescription>
            Se van a crear <strong>{totalPiezas}</strong> pieza
            {totalPiezas === 1 ? '' : 's'}, sus tareas de producción y se
            <strong> arrancará la producción</strong> automáticamente (las tareas
            pasan a la cola). Indica dónde se dejan físicamente las piezas al iniciar.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando ubicaciones...
          </div>
        )}

        {errorCarga && (
          <Alert variant="destructive">
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && ubicaciones.length === 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              No hay ubicaciones activas. Ve a /configuracion/ubicaciones y
              crea o activa alguna antes de confirmar pedidos.
            </AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && ubicaciones.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="ubicacion">Ubicación inicial</Label>
            <Select value={ubicacionId} onValueChange={setUbicacionId}>
              <SelectTrigger id="ubicacion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="font-mono">{u.codigo}</span> — {u.nombre}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({u.tipo})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Todas las piezas se asignarán a esta ubicación inicialmente.
              Luego podrás moverlas individualmente.
            </p>
          </div>
        )}

        {errorSubmit && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
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
            disabled={isPending || !ubicacionId || cargando}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Pasando a producción...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Pasar a producción
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================
// Dialog Arrancar Producción
// =============================================================

function DialogArrancarProduccion({
  open,
  onOpenChange,
  pedidoId,
  totalPiezas,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pedidoId: string
  totalPiezas: number
  onDone: (ok: boolean, texto: string) => void
}) {
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setErrorSubmit(null)
    startTransition(async () => {
      const res = await accionArrancarProduccion(pedidoId)
      if (res.ok) {
        onOpenChange(false)
        onDone(true, 'Producción arrancada. Las tareas están ahora en cola.')
      } else {
        setErrorSubmit(res.error ?? 'Error al arrancar producción')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arrancar producción</DialogTitle>
          <DialogDescription>
            Las <strong>{totalPiezas}</strong> pieza
            {totalPiezas === 1 ? '' : 's'} pasarán a estado "En producción" y
            todas sus tareas pendientes entrarán en cola de trabajo.
          </DialogDescription>
        </DialogHeader>

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
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Arrancando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Arrancar producción
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================
// Dialog Cancelar Pedido
// =============================================================

function DialogCancelarPedido({
  open,
  onOpenChange,
  pedidoId,
  numero,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pedidoId: string
  numero: string
  onDone: (ok: boolean, texto: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setMotivo('')
      setErrorSubmit(null)
    }
  }, [open])

  function submit() {
    setErrorSubmit(null)
    startTransition(async () => {
      const res = await accionCancelarPedido(pedidoId, motivo.trim() || null)
      if (res.ok) {
        onOpenChange(false)
        onDone(
          true,
          `Pedido ${numero} cancelado. Sus cantidades vuelven a estar disponibles en el presupuesto de origen.`
        )
      } else {
        setErrorSubmit(res.error ?? 'Error al cancelar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar pedido {numero}</DialogTitle>
          <DialogDescription>
            Las piezas no entregadas pasarán a "Cancelada" y las tareas no
            completadas a "Anulada". Las cantidades vuelven a estar
            disponibles en el presupuesto de origen. Esta acción no borra
            datos (trazabilidad intacta).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo (opcional)</Label>
          <Textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: cliente canceló el encargo"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Se añadirá a las observaciones internas del pedido.
          </p>
        </div>

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
            Volver
          </Button>
          <Button onClick={submit} disabled={isPending} variant="destructive">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Confirmar cancelación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Selector de prioridad inline (Mario punto 11)
// Si sube a 'urgente', ofrece reorganizar Gantt automáticamente.
// ============================================================
type PrioridadAux = 'baja' | 'normal' | 'alta' | 'urgente'

function SelectorPrioridadInline({
  pedidoId,
  pedidoNumero,
  prioridadActual,
  onCambiada,
}: {
  pedidoId: string
  pedidoNumero: string
  prioridadActual: PrioridadAux
  onCambiada: (n: PrioridadAux) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [proponiendo, setProponiendo] = useState(false)

  const opciones: Array<{ key: PrioridadAux; label: string; clase: string }> = [
    { key: 'baja',    label: 'Baja',    clase: 'bg-slate-100 text-slate-700 border-slate-300' },
    { key: 'normal',  label: 'Normal',  clase: 'bg-blue-100 text-blue-800 border-blue-300' },
    { key: 'alta',    label: 'Alta',    clase: 'bg-orange-100 text-orange-800 border-orange-300' },
    { key: 'urgente', label: 'Urgente', clase: 'bg-red-100 text-red-800 border-red-300' },
  ]
  const actual = opciones.find((o) => o.key === prioridadActual) ?? opciones[1]

  async function cambiar(nueva: PrioridadAux) {
    setAbierto(false)
    if (nueva === prioridadActual) return
    const supabase = createClient()
    const { error } = await supabase.from('pedidos').update({ prioridad: nueva }).eq('id', pedidoId)
    if (error) return
    onCambiada(nueva)

    // Si subimos prioridad, ofrecer replanificar
    const orden = { baja: 0, normal: 1, alta: 2, urgente: 3 }
    if (orden[nueva] > orden[prioridadActual]) {
      setProponiendo(true)
    }
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={`text-xs px-2 py-1 rounded-md border hover:brightness-95 ${actual.clase}`}
        >
          Prioridad: {actual.label} ▾
        </button>
        {abierto && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
            <div className="absolute z-40 top-full mt-1 left-0 min-w-[140px] rounded-md border bg-white shadow-lg overflow-hidden">
              {opciones.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => cambiar(o.key)}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${o.key === prioridadActual ? 'bg-blue-50 font-semibold' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={proponiendo} onOpenChange={setProponiendo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Has subido la prioridad de {pedidoNumero}</DialogTitle>
            <DialogDescription>
              ¿Quieres replanificar el Gantt para adelantar este pedido
              desplazando otros con holgura? El motor respeta secuencia y rol
              de operario.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProponiendo(false)}>Más tarde</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setProponiendo(false)
                // Disparar evento que abre el modal de Reorganizar Gantt
                document.querySelector<HTMLButtonElement>('[data-trigger-reorganizar]')?.click()
              }}
            >
              Sí, replanificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
