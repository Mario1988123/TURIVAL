'use client'

import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  accionCrearUbicacion,
  accionActualizarUbicacion,
  accionEliminarUbicacion,
  type TipoUbicacion,
  type Ubicacion,
} from '@/lib/actions/ubicaciones'

// =============================================================
// Labels
// =============================================================

const TIPO_LABELS: Record<TipoUbicacion, string> = {
  carrito: 'Carrito',
  estanteria: 'Estantería',
  libre: 'Libre / puntual',
}

const TIPO_COLORS: Record<TipoUbicacion, string> = {
  carrito: 'bg-blue-100 text-blue-800 border-blue-300',
  estanteria: 'bg-purple-100 text-purple-800 border-purple-300',
  libre: 'bg-slate-100 text-slate-700 border-slate-300',
}

const ESTADO_PIEZA_LABEL: Record<string, { label: string; clase: string }> = {
  sin_producir:  { label: 'Sin producir',  clase: 'bg-slate-100 text-slate-700' },
  en_produccion: { label: 'En producción', clase: 'bg-amber-100 text-amber-800' },
  completada:    { label: 'Completada',    clase: 'bg-emerald-100 text-emerald-800' },
  en_almacen:    { label: 'En almacén',    clase: 'bg-blue-100 text-blue-800' },
  entregada:     { label: 'Entregada',     clase: 'bg-green-200 text-green-900' },
  incidencia:    { label: 'Incidencia',    clase: 'bg-red-100 text-red-800' },
  cancelada:     { label: 'Cancelada',     clase: 'bg-slate-100 text-slate-500' },
}

// =============================================================
// Componente principal
// =============================================================

export default function UbicacionesCliente({
  ubicacionesIniciales,
  piezasPorUbicacion,
}: {
  ubicacionesIniciales: Ubicacion[]
  piezasPorUbicacion: Record<string, any[]>
}) {
  const router = useRouter()
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>(
    ubicacionesIniciales
  )
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)
  const [editando, setEditando] = useState<Ubicacion | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

  // Toast verde/rojo fijo abajo centrado, autocierre 3s (regla UX #13)
  function notificar(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 3000)
  }

  function abrirCrear() {
    setEditando(null)
    setDialogOpen(true)
  }

  function abrirEditar(u: Ubicacion) {
    setEditando(u)
    setDialogOpen(true)
  }

  function toggleExpand(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleActivo(u: Ubicacion) {
    const res = await accionActualizarUbicacion(u.id, { activo: !u.activo })
    if (res.ok && res.ubicacion) {
      setUbicaciones((prev) =>
        prev.map((x) => (x.id === u.id ? (res.ubicacion as Ubicacion) : x))
      )
      notificar(
        'ok',
        `Ubicación ${u.codigo} ${res.ubicacion.activo ? 'activada' : 'desactivada'}`
      )
    } else {
      notificar('error', res.error ?? 'Error al actualizar')
    }
  }

  async function eliminar(u: Ubicacion) {
    if (
      !confirm(
        `¿Eliminar la ubicación ${u.codigo} "${u.nombre}"?\nEsta acción no se puede deshacer.`
      )
    )
      return
    const res = await accionEliminarUbicacion(u.id)
    if (res.ok) {
      setUbicaciones((prev) => prev.filter((x) => x.id !== u.id))
      notificar('ok', `Ubicación ${u.codigo} eliminada`)
    } else {
      notificar('error', res.error ?? 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="w-7 h-7" />
            Ubicaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Carritos, estanterías y zonas donde se colocan las piezas.
          </p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva ubicación
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="w-28">Piezas</TableHead>
                <TableHead className="w-28 text-right">Capacidad</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-40 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ubicaciones.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay ubicaciones. Crea la primera con el botón de arriba.
                  </TableCell>
                </TableRow>
              )}
              {ubicaciones.map((u) => {
                const piezas = piezasPorUbicacion[u.id] ?? []
                const tienePiezas = piezas.length > 0
                const estaExpandida = expandidas.has(u.id)
                return (
                  <Fragment key={u.id}>
                    <TableRow className={u.activo ? '' : 'opacity-60'}>
                      <TableCell>
                        {tienePiezas ? (
                          <button
                            onClick={() => toggleExpand(u.id)}
                            className="p-1 hover:bg-slate-100 rounded transition"
                            aria-label={estaExpandida ? 'Colapsar' : 'Expandir'}
                          >
                            {estaExpandida ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block w-6" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {u.codigo}
                      </TableCell>
                      <TableCell>
                        <div>{u.nombre}</div>
                        {u.notas && (
                          <div className="text-xs text-muted-foreground truncate max-w-md">
                            {u.notas}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIPO_COLORS[u.tipo]}>
                          {TIPO_LABELS[u.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tienePiezas ? (
                          <button
                            onClick={() => toggleExpand(u.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium hover:bg-blue-200 transition"
                          >
                            <Package className="w-3 h-3" />
                            {piezas.length}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Vacía
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {u.capacidad_aprox ?? '—'}
                      </TableCell>
                      <TableCell>
                        {u.activo ? (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 border-green-300"
                          >
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActivo(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                        >
                          {u.activo ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirEditar(u)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => eliminar(u)}
                          title="Eliminar"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {estaExpandida && tienePiezas && (
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableCell colSpan={8} className="p-0">
                          <DetallePiezas piezas={piezas} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DialogUbicacion
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditando(null)
        }}
        ubicacion={editando}
        onSaved={(u, esNueva) => {
          setUbicaciones((prev) => {
            if (esNueva) return [...prev, u].sort((a, b) => a.codigo.localeCompare(b.codigo))
            return prev.map((x) => (x.id === u.id ? u : x))
          })
          setDialogOpen(false)
          setEditando(null)
          notificar(
            'ok',
            esNueva
              ? `Ubicación ${u.codigo} creada`
              : `Ubicación ${u.codigo} actualizada`
          )
          router.refresh()
        }}
      />

      {/* Toast inferior verde/rojo, autocierre 3s */}
      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={
              mensaje.tipo === 'ok'
                ? 'bg-green-50 border-green-300 text-green-900'
                : ''
            }
          >
            <AlertDescription className="font-medium">
              {mensaje.texto}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

// =============================================================
// Detalle de piezas (fila expandida)
// =============================================================

function DetallePiezas({ piezas }: { piezas: any[] }) {
  return (
    <div className="px-6 py-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Piezas en esta ubicación ({piezas.length})
      </div>
      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Nº Pieza</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-40">Pedido</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {piezas.map((p) => {
              const lp = p?.linea_pedido ?? {}
              const pedido = lp?.pedido ?? null
              const cliente = pedido?.cliente ?? null
              const producto = lp?.producto ?? null
              const descripcion =
                (typeof lp?.descripcion === 'string' && lp.descripcion.trim()) ||
                producto?.nombre ||
                '—'
              const estadoInfo = ESTADO_PIEZA_LABEL[p.estado] ?? {
                label: p.estado,
                clase: 'bg-slate-100 text-slate-700',
              }
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-semibold text-sm">
                    {p.numero}
                  </TableCell>
                  <TableCell className="text-sm">{descripcion}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full ${estadoInfo.clase}`}
                    >
                      {estadoInfo.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {pedido ? (
                      <Link
                        href={`/pedidos/${pedido.id}`}
                        className="font-mono text-sm text-blue-700 hover:underline"
                      >
                        {pedido.numero}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {cliente?.nombre_comercial ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// =============================================================
// Dialog crear/editar
// =============================================================

function DialogUbicacion({
  open,
  onOpenChange,
  ubicacion,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  ubicacion: Ubicacion | null
  onSaved: (u: Ubicacion, esNueva: boolean) => void
}) {
  const esEdicion = ubicacion !== null
  const [codigo, setCodigo] = useState(ubicacion?.codigo ?? '')
  const [nombre, setNombre] = useState(ubicacion?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoUbicacion>(ubicacion?.tipo ?? 'carrito')
  const [capacidad, setCapacidad] = useState<string>(
    ubicacion?.capacidad_aprox != null ? String(ubicacion.capacidad_aprox) : ''
  )
  const [notas, setNotas] = useState(ubicacion?.notas ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetFromProp() {
    setCodigo(ubicacion?.codigo ?? '')
    setNombre(ubicacion?.nombre ?? '')
    setTipo(ubicacion?.tipo ?? 'carrito')
    setCapacidad(
      ubicacion?.capacidad_aprox != null ? String(ubicacion.capacidad_aprox) : ''
    )
    setNotas(ubicacion?.notas ?? '')
    setError(null)
  }

  function handleOpen(o: boolean) {
    if (o) resetFromProp()
    onOpenChange(o)
  }

  function submit() {
    setError(null)
    if (!codigo.trim()) {
      setError('El código es obligatorio')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    const capNum = capacidad.trim() === '' ? null : Number(capacidad)
    if (capNum != null && (!Number.isFinite(capNum) || capNum < 0)) {
      setError('La capacidad debe ser un número positivo')
      return
    }

    startTransition(async () => {
      const payload = {
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        tipo,
        capacidad_aprox: capNum,
        notas: notas.trim() || null,
      }

      const res = esEdicion && ubicacion
        ? await accionActualizarUbicacion(ubicacion.id, payload)
        : await accionCrearUbicacion(payload)

      if (res.ok && res.ubicacion) {
        onSaved(res.ubicacion as Ubicacion, !esEdicion)
      } else {
        setError(res.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar ubicación' : 'Nueva ubicación'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Modifica los datos de la ubicación.'
              : 'Añade un nuevo carrito, estantería o zona.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="C-01"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Corto y único (ej: C-01, E-03)
              </p>
            </div>
            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoUbicacion)}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carrito">Carrito</SelectItem>
                  <SelectItem value="estanteria">Estantería</SelectItem>
                  <SelectItem value="libre">Libre / puntual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carrito azul taller"
            />
          </div>

          <div>
            <Label htmlFor="capacidad">Capacidad aproximada (opcional)</Label>
            <Input
              id="capacidad"
              type="number"
              min={0}
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              placeholder="Ej: 20"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Número orientativo de piezas que caben
            </p>
          </div>

          <div>
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ubicación física, observaciones..."
            />
          </div>
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
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : esEdicion ? (
              'Guardar cambios'
            ) : (
              'Crear ubicación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
