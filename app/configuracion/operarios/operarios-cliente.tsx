'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Users,
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
  accionCrearOperario,
  accionActualizarOperario,
  accionEliminarOperario,
} from '@/lib/actions/operarios'
import type { Operario } from '@/lib/services/operarios'

// =============================================================
// Constantes de UI
// =============================================================

// Roles que coinciden con rol_operario_requerido en procesos_catalogo.
// Si añades aquí un rol, recuerda que solo encaja con la auto-asignación
// si también lo pusiste en procesos_catalogo.rol_operario_requerido.
const ROLES_PREDEFINIDOS = [
  'Lijador',
  'Fondeador',
  'Lacador',
  'Oficina',
  'Taller',
] as const

// 10 colores tailwind representativos + gris (default)
const COLORES_SUGERIDOS: Array<{ nombre: string; hex: string }> = [
  { nombre: 'Gris',    hex: '#64748b' },
  { nombre: 'Azul',    hex: '#2563eb' },
  { nombre: 'Verde',   hex: '#16a34a' },
  { nombre: 'Naranja', hex: '#ea580c' },
  { nombre: 'Rojo',    hex: '#dc2626' },
  { nombre: 'Morado',  hex: '#9333ea' },
  { nombre: 'Rosa',    hex: '#ec4899' },
  { nombre: 'Teal',    hex: '#0d9488' },
  { nombre: 'Amarillo',hex: '#ca8a04' },
  { nombre: 'Cian',    hex: '#0891b2' },
]

const ROL_OTRO_VALUE = '__otro__'
const ROL_NINGUNO_VALUE = '__ninguno__'

// =============================================================
// Componente principal
// =============================================================

export default function OperariosCliente({
  operariosIniciales,
}: {
  operariosIniciales: Operario[]
}) {
  const router = useRouter()
  const [operarios, setOperarios] = useState<Operario[]>(operariosIniciales)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)
  const [editando, setEditando] = useState<Operario | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function notificar(tipo: 'ok' | 'error', texto: string) {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4500)
  }

  function abrirCrear() {
    setEditando(null)
    setDialogOpen(true)
  }

  function abrirEditar(o: Operario) {
    setEditando(o)
    setDialogOpen(true)
  }

  async function toggleActivo(o: Operario) {
    const res = await accionActualizarOperario(o.id, { activo: !o.activo })
    if (res.ok && res.operario) {
      setOperarios((prev) =>
        prev.map((x) => (x.id === o.id ? (res.operario as Operario) : x))
      )
      notificar(
        'ok',
        `${o.nombre} ${res.operario.activo ? 'activado' : 'desactivado'}`
      )
    } else {
      notificar('error', res.error ?? 'Error al actualizar')
    }
  }

  async function eliminar(o: Operario) {
    if (!confirm(`¿Eliminar operario "${o.nombre}"?\nEsta acción no se puede deshacer.`)) return
    const res = await accionEliminarOperario(o.id)
    if (res.ok) {
      setOperarios((prev) => prev.filter((x) => x.id !== o.id))
      notificar('ok', `Operario "${o.nombre}" eliminado`)
    } else {
      notificar('error', res.error ?? 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7" />
            Operarios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personas del taller. Se asignan a tareas como candidatas a ejecutarlas.
          </p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo operario
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
                <TableHead className="w-12">Color</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-36">Rol</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-40 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operarios.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay operarios todavía. Crea el primero pulsando "Nuevo operario".
                  </TableCell>
                </TableRow>
              )}
              {operarios.map((o) => (
                <TableRow key={o.id} className={o.activo ? '' : 'opacity-60'}>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded-full border border-slate-300"
                      style={{ backgroundColor: o.color }}
                      title={o.color}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.nombre}</div>
                  </TableCell>
                  <TableCell>
                    {o.rol ? (
                      <Badge variant="outline">{o.rol}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.activo ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-300"
                      >
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.notas ? (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
                        {o.notas}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActivo(o)}
                      title={o.activo ? 'Desactivar' : 'Activar'}
                    >
                      {o.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => abrirEditar(o)}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => eliminar(o)}
                      title="Eliminar"
                      className="text-red-600 hover:bg-red-50"
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

      <DialogOperario
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditando(null)
        }}
        operario={editando}
        onSaved={(op, esNuevo) => {
          setOperarios((prev) => {
            if (esNuevo) return [...prev, op].sort((a, b) => a.nombre.localeCompare(b.nombre))
            return prev.map((x) => (x.id === op.id ? op : x))
          })
          setDialogOpen(false)
          setEditando(null)
          notificar('ok', esNuevo ? `Operario "${op.nombre}" creado` : `Operario "${op.nombre}" actualizado`)
          router.refresh()
        }}
      />
    </div>
  )
}

// =============================================================
// Dialog crear/editar
// =============================================================

function DialogOperario({
  open,
  onOpenChange,
  operario,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  operario: Operario | null
  onSaved: (op: Operario, esNuevo: boolean) => void
}) {
  const esEdicion = operario !== null

  const [nombre, setNombre] = useState('')
  const [rolSelect, setRolSelect] = useState<string>(ROL_NINGUNO_VALUE)
  const [rolOtroTexto, setRolOtroTexto] = useState('')
  const [color, setColor] = useState('#64748b')
  const [notas, setNotas] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Reset cuando cambia el operario que se edita o se abre/cierra
  useEffect(() => {
    if (!open) return
    if (operario) {
      setNombre(operario.nombre)
      // Si rol actual está entre los predefinidos → seleccionarlo.
      // Si no → "Otro" + texto.
      if (!operario.rol) {
        setRolSelect(ROL_NINGUNO_VALUE)
        setRolOtroTexto('')
      } else if ((ROLES_PREDEFINIDOS as readonly string[]).includes(operario.rol)) {
        setRolSelect(operario.rol)
        setRolOtroTexto('')
      } else {
        setRolSelect(ROL_OTRO_VALUE)
        setRolOtroTexto(operario.rol)
      }
      setColor(operario.color ?? '#64748b')
      setNotas(operario.notas ?? '')
      setActivo(operario.activo)
    } else {
      setNombre('')
      setRolSelect(ROL_NINGUNO_VALUE)
      setRolOtroTexto('')
      setColor('#64748b')
      setNotas('')
      setActivo(true)
    }
    setError(null)
  }, [open, operario])

  function rolFinal(): string | null {
    if (rolSelect === ROL_NINGUNO_VALUE) return null
    if (rolSelect === ROL_OTRO_VALUE) {
      const v = rolOtroTexto.trim()
      return v === '' ? null : v
    }
    return rolSelect
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const payload = {
        nombre,
        rol: rolFinal(),
        color,
        notas,
        activo,
      }

      if (esEdicion && operario) {
        const res = await accionActualizarOperario(operario.id, payload)
        if (res.ok && res.operario) {
          onSaved(res.operario, false)
        } else {
          setError(res.error ?? 'Error al guardar')
        }
      } else {
        const res = await accionCrearOperario(payload)
        if (res.ok && res.operario) {
          onSaved(res.operario, true)
        } else {
          setError(res.error ?? 'Error al crear')
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? `Editar operario ${operario?.nombre}` : 'Nuevo operario'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Modifica los datos del operario.'
              : 'Añade una persona del taller para asignarle tareas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan"
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="rol">Rol</Label>
            <Select value={rolSelect} onValueChange={setRolSelect}>
              <SelectTrigger id="rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROL_NINGUNO_VALUE}>(Sin rol)</SelectItem>
                {ROLES_PREDEFINIDOS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                <SelectItem value={ROL_OTRO_VALUE}>Otro...</SelectItem>
              </SelectContent>
            </Select>
            {rolSelect === ROL_OTRO_VALUE && (
              <Input
                value={rolOtroTexto}
                onChange={(e) => setRolOtroTexto(e.target.value)}
                placeholder="Escribe el rol..."
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              El rol enlaza con el proceso que puede hacer. Por ejemplo, un
              "Lijador" será candidato automático en tareas de Lijado.
            </p>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Color para el badge</Label>
            <div className="flex flex-wrap gap-2">
              {COLORES_SUGERIDOS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c.hex
                      ? 'border-slate-900 scale-110'
                      : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.nombre}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {color}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Horario, especialidades, etc."
            />
          </div>

          {esEdicion && (
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="activo"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="activo" className="cursor-pointer">
                Operario activo (aparece en las asignaciones)
              </Label>
            </div>
          )}
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
          <Button onClick={submit} disabled={isPending || !nombre.trim()}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : esEdicion ? (
              'Guardar cambios'
            ) : (
              'Crear operario'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
