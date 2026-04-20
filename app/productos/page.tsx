'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listarProductos, crearProducto, eliminarProducto } from '@/lib/services/productos'
import type { Producto } from '@/lib/types/erp'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  Package,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'

export default function ProductosPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Modal nuevo producto
  const [abiertoNuevo, setAbiertoNuevo] = useState(false)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    unidad_tarificacion: 'm2' as 'm2' | 'pieza',
  })

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarProductos(false)
      setProductos(data)
    } catch (e: any) {
      setError(e.message || 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  async function onCrear() {
    if (!nuevo.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }
    setGuardandoNuevo(true)
    try {
      const creado = await crearProducto({
        nombre: nuevo.nombre.trim(),
        categoria: nuevo.categoria.trim() || null,
        descripcion: nuevo.descripcion.trim() || null,
        unidad_tarificacion: nuevo.unidad_tarificacion,
        activo: true,
      })
      setAbiertoNuevo(false)
      setNuevo({ nombre: '', categoria: '', descripcion: '', unidad_tarificacion: 'm2' })
      setMensaje({ tipo: 'ok', texto: `Producto "${creado.nombre}" creado.` })
      router.push(`/productos/${creado.id}`)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error al crear' })
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function onEliminar(p: Producto) {
    if (
      !confirm(
        `¿Eliminar el producto "${p.nombre}"? Esto también elimina sus procesos asociados. No se puede deshacer.`
      )
    ) {
      return
    }
    try {
      await eliminarProducto(p.id)
      setMensaje({ tipo: 'ok', texto: `Producto "${p.nombre}" eliminado.` })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error al eliminar' })
    }
  }

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Cargando productos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-8 h-8" />
            Productos
          </h1>
          <p className="text-muted-foreground mt-1">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'} en
            catálogo
          </p>
        </div>
        <Button onClick={() => setAbiertoNuevo(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo producto
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* BÚSQUEDA */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o categoría..."
          className="pl-10"
        />
      </div>

      {/* TABLA */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {productos.length === 0
                      ? 'Aún no hay productos. Pulsa "Nuevo producto" para crear el primero.'
                      : 'No hay productos que coincidan con la búsqueda.'}
                  </TableCell>
                </TableRow>
              ) : (
                productosFiltrados.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell>
                      <Link
                        href={`/productos/${p.id}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {p.nombre}
                      </Link>
                      {p.descripcion && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {p.descripcion}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.categoria ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {p.unidad_tarificacion === 'm2' ? 'por m²' : 'por pieza'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.activo ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/productos/${p.id}`)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onEliminar(p)}
                          title="Eliminar"
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
        </CardContent>
      </Card>

      {/* MODAL NUEVO PRODUCTO */}
      <Dialog open={abiertoNuevo} onOpenChange={setAbiertoNuevo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Crea un producto y luego podrás configurar sus procesos de producción.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Ej: Puerta, Frente, Moldura..."
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Input
                value={nuevo.categoria}
                onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
                placeholder="Ej: Muebles cocina, Carpintería..."
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={nuevo.descripcion}
                onChange={(e) =>
                  setNuevo({ ...nuevo, descripcion: e.target.value })
                }
                placeholder="Descripción técnica..."
              />
            </div>
            <div className="space-y-1">
              <Label>Unidad de tarificación por defecto</Label>
              <Select
                value={nuevo.unidad_tarificacion}
                onValueChange={(v: 'm2' | 'pieza') =>
                  setNuevo({ ...nuevo, unidad_tarificacion: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">Por m²</SelectItem>
                  <SelectItem value="pieza">Por pieza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAbiertoNuevo(false)}
              disabled={guardandoNuevo}
            >
              Cancelar
            </Button>
            <Button onClick={onCrear} disabled={guardandoNuevo}>
              {guardandoNuevo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear y configurar procesos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
