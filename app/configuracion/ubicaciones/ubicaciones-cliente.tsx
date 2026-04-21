'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  MapPin,
  Check,
  X,
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

// =============================================================
// Componente principal
// =============================================================

export default function UbicacionesCliente({
  ubicacionesIniciales,
}: {
  ubicacionesIniciales: Ubicacion[]
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

  function notificar(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4500)
  }

  function abrirCrear() {
    setEditando(null)
    setDialogOpen(true)
  }

  function abrirEditar(u: Ubicacion) {
    setEditando(u)
    setDialogOpen(true)
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
    <div className="space-y-4">
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

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="w-28 text-right">Capacidad</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-40 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ubicaciones.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay ubicaciones. Crea la primera con el botón de arriba.
                  </TableCell>
                </TableRow>
              )}
              {ubicaciones.map((u) => (
                <TableRow key={u.id} className={u.activo ? '' : 'opacity-60'}>
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
              ))}
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
          notificar('ok', esNueva ? `Ubicación ${u.codigo} creada` : `Ubicación ${u.codigo} actualizada`)
          router.refresh()
        }}
      />
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

  // Reset cuando se abre con otra ubicación
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetFromProp() {
    setCodigo(ubicacion?.codigo ?? '')
    setNombre(ubicacion?.nombre ?? '')
    setTipo(ubicacion?.tipo ?? 'carrito')
    setCapacidad(
      ubicacion?.capacidad_aprox != null
        ? String(ubicacion.capacidad_aprox)
        : ''
    )
    setNotas(ubicacion?.notas ?? '')
    setError(null)
  }

  // Cambio de ubicación → reset
  const ubicId = ubicacion?.id ?? null
  useState(() => {
    resetFromProp()
  })
  // useEffect equivalente inline para este componente simple
  // (evita useEffect explícito para dependencias)
  if (open && ubicId !== (ubicacion?.id ?? null)) {
    resetFromProp()
  }

  function submit() {
    setError(null)

    startTransition(async () => {
      const payload = {
        codigo,
        nombre,
        tipo,
        capacidad_aprox:
          capacidad.trim() === ''
            ? null
            : parseInt(capacidad, 10) || null,
        notas,
      }

      if (esEdicion && ubicacion) {
        const res = await accionActualizarUbicacion(ubicacion.id, payload)
        if (res.ok && res.ubicacion) {
          onSaved(res.ubicacion, false)
          resetFromProp()
        } else {
          setError(res.error ?? 'Error al guardar')
        }
      } else {
        const res = await accionCrearUbicacion(payload)
        if (res.ok && res.ubicacion) {
          onSaved(res.ubicacion, true)
          setCodigo('')
          setNombre('')
          setTipo('carrito')
          setCapacidad('')
          setNotas('')
        } else {
          setError(res.error ?? 'Error al crear')
        }
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) resetFromProp()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? `Editar ubicación ${ubicacion?.codigo}` : 'Nueva ubicación'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Modifica los datos de esta ubicación.'
              : 'Crea un nuevo carrito, estantería o zona puntual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código *</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="C-04"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5">
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

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carrito 4"
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="capacidad">Capacidad aproximada (opcional)</Label>
            <Input
              id="capacidad"
              type="number"
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              placeholder="20 piezas"
              min={0}
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Detrás del compresor, pasillo A..."
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
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
