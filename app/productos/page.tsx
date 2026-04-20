'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listarProductos, crearProducto, eliminarProducto } from '@/lib/services/productos'
import { listarCategoriasProducto, type CategoriaProducto } from '@/lib/services/categorias-producto'
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
  Sparkles,
  Settings,
  Info,
} from 'lucide-react'

type ProductoExtendido = Producto & {
  categoria_id?: string | null
}

export default function ProductosPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<ProductoExtendido[]>([])
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')

  const [abiertoNuevo, setAbiertoNuevo] = useState(false)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState({
    nombre: '',
    categoria_id: '',
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
      const [prods, cats] = await Promise.all([
        listarProductos(false),
        listarCategoriasProducto(true),
      ])
      setProductos(prods as ProductoExtendido[])
      setCategorias(cats)
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
      const cat = categorias.find((c) => c.id === nuevo.categoria_id)
      const creado = await crearProducto(
        {
          nombre: nuevo.nombre.trim(),
          categoria: cat?.nombre ?? null, // retrocompatibilidad con campo texto
          categoria_id: nuevo.categoria_id || null,
          descripcion: nuevo.descripcion.trim() || null,
          unidad_tarificacion: nuevo.unidad_tarificacion,
          activo: true,
        },
        { auto_cargar_procesos: true }
      )
      setAbiertoNuevo(false)
      setNuevo({ nombre: '', categoria_id: '', descripcion: '', unidad_tarificacion: 'm2' })
      setMensaje({
        tipo: 'ok',
        texto: `"${creado.nombre}" creado con los 9 procesos estándar precargados.`,
      })
      router.push(`/productos/${creado.id}`)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error al crear' })
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function onEliminar(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esto elimina también sus procesos. No se deshace.`)) {
      return
    }
    try {
      await eliminarProducto(p.id)
      setMensaje({ tipo: 'ok', texto: `"${p.nombre}" eliminado.` })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    }
  }

  function getCategoria(p: ProductoExtendido): CategoriaProducto | null {
    if (p.categoria_id) {
      return categorias.find((c) => c.id === p.categoria_id) ?? null
    }
    // Fallback al texto
    if (p.categoria) {
      return categorias.find((c) => c.nombre === p.categoria) ?? null
    }
    return null
  }

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.trim().toLowerCase()
    if (q && !p.nombre.toLowerCase().includes(q) && !(p.categoria ?? '').toLowerCase().includes(q)) {
      return false
    }
    if (filtroCategoria !== 'all') {
      if (filtroCategoria === 'sin') {
        return !p.categoria_id && !p.categoria
      }
      return p.categoria_id === filtroCategoria
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'} en catálogo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/configuracion/categorias')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Gestionar categorías
          </Button>
          <Button onClick={() => setAbiertoNuevo(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* FILTROS */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="pl-10"
          />
        </div>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectItem value="sin">Sin categoría</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                      ? 'Aún no hay productos. Pulsa "Nuevo producto".'
                      : 'No hay productos que coincidan.'}
                  </TableCell>
                </TableRow>
              ) : (
                productosFiltrados.map((p) => {
                  const cat = getCategoria(p)
                  return (
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
                      <TableCell>
                        {cat ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: cat.color, color: cat.color }}
                          >
                            {cat.nombre}
                          </Badge>
                        ) : p.categoria ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {p.categoria}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onEliminar(p)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL NUEVO */}
      <Dialog open={abiertoNuevo} onOpenChange={setAbiertoNuevo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Crea un producto y se le asignarán automáticamente los 9 procesos estándar
              de Turiaval (luego los ajustas).
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
              {categorias.length === 0 ? (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    No hay categorías creadas.{' '}
                    <Link
                      href="/configuracion/categorias"
                      className="underline text-blue-700 font-medium"
                    >
                      Crea una primero →
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={nuevo.categoria_id}
                  onValueChange={(v) => setNuevo({ ...nuevo, categoria_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin categoría</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
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

            <Alert className="bg-blue-50 border-blue-200">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <AlertDescription className="text-xs text-blue-900">
                <strong>Se precargarán 9 procesos</strong>: Comprobación material, Lijado,
                Fondo, Lijado 2 (opcional), Fondeado 2 (opcional), Lacado, Terminación,
                Recepción material y Picking. Podrás ajustar tiempos y desactivar los que
                no apliquen.
              </AlertDescription>
            </Alert>
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
                  Crear con procesos estándar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
