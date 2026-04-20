'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listarCategoriasProducto,
  crearCategoriaProducto,
  actualizarCategoriaProducto,
  eliminarCategoriaProducto,
  type CategoriaProducto,
} from '@/lib/services/categorias-producto'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tags,
} from 'lucide-react'

const COLORES_SUGERIDOS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#f97316', '#06b6d4', '#ec4899', '#64748b', '#84cc16',
]

export default function CategoriasProductoCliente() {
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [editando, setEditando] = useState<CategoriaProducto | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    color: COLORES_SUGERIDOS[0],
    orden: 0,
    activo: true,
  })

  useEffect(() => { cargar() }, [])
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    try {
      const data = await listarCategoriasProducto(false)
      setCategorias(data)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setLoading(false)
    }
  }

  function abrirNueva() {
    setEditando(null)
    setForm({
      nombre: '',
      descripcion: '',
      color: COLORES_SUGERIDOS[categorias.length % COLORES_SUGERIDOS.length],
      orden: categorias.length + 1,
      activo: true,
    })
    setAbierto(true)
  }

  function abrirEditar(cat: CategoriaProducto) {
    setEditando(cat)
    setForm({
      nombre: cat.nombre,
      descripcion: cat.descripcion ?? '',
      color: cat.color,
      orden: cat.orden,
      activo: cat.activo,
    })
    setAbierto(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await actualizarCategoriaProducto(editando.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          color: form.color,
          orden: form.orden,
          activo: form.activo,
        })
        setMensaje({ tipo: 'ok', texto: 'Categoría actualizada.' })
      } else {
        await crearCategoriaProducto({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          color: form.color,
          orden: form.orden,
          activo: form.activo,
        })
        setMensaje({ tipo: 'ok', texto: 'Categoría creada.' })
      }
      setAbierto(false)
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(cat: CategoriaProducto) {
    if (!confirm(
      `¿Eliminar la categoría "${cat.nombre}"? Los productos con esta categoría quedarán sin categoría asignada.`
    )) return
    try {
      await eliminarCategoriaProducto(cat.id)
      setMensaje({ tipo: 'ok', texto: `Categoría "${cat.nombre}" eliminada.` })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracion"
            className="p-2 hover:bg-slate-100 rounded-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Tags className="w-8 h-8" />
              Categorías de productos
            </h1>
            <p className="text-muted-foreground mt-1">
              Organiza tus productos en categorías (ej: Muebles cocina, Carpintería, Baño...)
            </p>
          </div>
        </div>
        <Button onClick={abrirNueva}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva categoría
        </Button>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aún no hay categorías. Crea la primera con el botón de arriba.
                    </TableCell>
                  </TableRow>
                ) : (
                  categorias.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{ borderColor: c.color, color: c.color }}
                          className="font-semibold"
                        >
                          {c.nombre}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.descripcion || '—'}
                      </TableCell>
                      <TableCell>{c.orden}</TableCell>
                      <TableCell>
                        {c.activo ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => eliminar(c)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MODAL CREAR/EDITAR */}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar categoría' : 'Nueva categoría'}
            </DialogTitle>
            <DialogDescription>
              Las categorías te ayudan a organizar productos y filtrarlos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Muebles cocina"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción opcional..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Orden de visualización</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.orden}
                  onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="mb-2.5"
                />
                <Label htmlFor="activa" className="cursor-pointer pb-2.5">Categoría activa</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Color identificativo</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORES_SUGERIDOS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-md border-2 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-900' : 'border-slate-300'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-2">
                <Badge variant="outline" style={{ borderColor: form.color, color: form.color }}>
                  {form.nombre || 'Vista previa'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
