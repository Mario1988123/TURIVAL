'use client'

import { useEffect, useState } from 'react'
import {
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  cambiarActivoProveedor,
} from '@/lib/services/proveedores'
import type { Proveedor, TipoMaterial } from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Truck, Plus, Pencil, Save, Loader2 } from 'lucide-react'

const TIPO_LABEL: Record<TipoMaterial, string> = {
  lacado:      'Lacado',
  fondo:       'Fondo',
  catalizador: 'Catalizador',
  disolvente:  'Disolvente',
}

const TIPO_COLOR: Record<TipoMaterial, string> = {
  lacado:      'bg-blue-100 text-blue-800 border-blue-300',
  fondo:       'bg-green-100 text-green-800 border-green-300',
  catalizador: 'bg-amber-100 text-amber-800 border-amber-300',
  disolvente:  'bg-purple-100 text-purple-800 border-purple-300',
}

interface FormState {
  nombre: string
  tipo_material: TipoMaterial
  precio_base_kg: number
  telefono: string
  email: string
  notas: string
  activo: boolean
}

const FORM_VACIO: FormState = {
  nombre: '',
  tipo_material: 'lacado',
  precio_base_kg: 0,
  telefono: '',
  email: '',
  notas: '',
  activo: true,
}

export default function ProveedoresCliente() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<TipoMaterial | 'todos'>('todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const data = await listarProveedores({ activos_solo: !mostrarInactivos })
      setProveedores(data)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [mostrarInactivos])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setDialogoAbierto(true)
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      tipo_material: p.tipo_material,
      precio_base_kg: Number(p.precio_base_kg) || 0,
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      notas: p.notas ?? '',
      activo: p.activo,
    })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }
    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo_material: form.tipo_material,
        precio_base_kg: form.precio_base_kg,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        notas: form.notas.trim() || null,
        activo: form.activo,
      }
      if (editando) {
        await actualizarProveedor(editando.id, payload)
        setMensaje({ tipo: 'ok', texto: 'Proveedor actualizado.' })
      } else {
        await crearProveedor(payload)
        setMensaje({ tipo: 'ok', texto: 'Proveedor creado.' })
      }
      setDialogoAbierto(false)
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(p: Proveedor) {
    try {
      await cambiarActivoProveedor(p.id, !p.activo)
      setMensaje({ tipo: 'ok', texto: `Proveedor ${p.activo ? 'desactivado' : 'activado'}.` })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    }
  }

  const filtrados = filtroTipo === 'todos'
    ? proveedores
    : proveedores.filter(p => p.tipo_material === filtroTipo)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-8 h-8" />
          Proveedores
        </h1>
        <p className="text-muted-foreground">
          Proveedores de pintura, fondo, catalizador y disolvente.
          Cada uno con su precio base por kg.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-52">
              <Label className="text-xs mb-1 block">Tipo de material</Label>
              <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="lacado">Lacado</SelectItem>
                  <SelectItem value="fondo">Fondo</SelectItem>
                  <SelectItem value="catalizador">Catalizador</SelectItem>
                  <SelectItem value="disolvente">Disolvente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={mostrarInactivos ? 'default' : 'outline'}
              onClick={() => setMostrarInactivos(v => !v)}
            >
              {mostrarInactivos ? 'Ocultar inactivos' : 'Mostrar inactivos'}
            </Button>

            <Button onClick={abrirNuevo}><Plus className="w-4 h-4 mr-2" />Nuevo proveedor</Button>

            <p className="text-xs text-muted-foreground ml-auto">
              {filtrados.length} de {proveedores.length} proveedores
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Sin proveedores.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Precio base (€/kg)</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => (
                  <TableRow key={p.id} className={!p.activo ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell>
                      <Badge className={`${TIPO_COLOR[p.tipo_material]} border`}>
                        {TIPO_LABEL[p.tipo_material]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(p.precio_base_kg).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-sm">{p.telefono || '—'}</TableCell>
                    <TableCell className="text-sm">{p.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? 'default' : 'secondary'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => abrirEditar(p)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActivo(p)}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DIALOG ALTA/EDICIÓN */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              Datos del proveedor y precio base por kg que se aplicará a sus materiales
              (a menos que cada material lo sobrescriba).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Pinturas Valtecno S.L."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de material *</Label>
                <Select
                  value={form.tipo_material}
                  onValueChange={(v: TipoMaterial) => setForm({ ...form, tipo_material: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lacado">Lacado</SelectItem>
                    <SelectItem value="fondo">Fondo</SelectItem>
                    <SelectItem value="catalizador">Catalizador</SelectItem>
                    <SelectItem value="disolvente">Disolvente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio base (€/kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_base_kg}
                  onChange={(e) =>
                    setForm({ ...form, precio_base_kg: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                rows={2}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo" className="cursor-pointer mb-0">Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</>
                : <><Save className="w-4 h-4 mr-2" />Guardar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={mensaje.tipo === 'ok' ? 'bg-green-50 border-green-300 text-green-900' : ''}
          >
            <AlertDescription className="font-medium">{mensaje.texto}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
