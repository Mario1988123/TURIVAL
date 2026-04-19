'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tarifa, Producto } from '@/lib/types/erp'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Save, Pencil, Euro } from 'lucide-react'

export default function TarifasPage() {
  const supabase = createClient()

  const [tarifas, setTarifas] = useState<(Tarifa & { producto_nombre?: string })[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Filtro
  const [filtroProducto, setFiltroProducto] = useState<string>('todos')

  // Diálogo
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Tarifa | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    producto_id: '',
    modo_precio: 'm2' as 'm2' | 'pieza' | 'ambos',
    precio_m2: '',
    precio_pieza: '',
    precio_minimo: '',
    coste_adicional_color: '0',
    coste_adicional_tratamiento: '0',
    coste_adicional_embalaje: '0',
    activo: true,
  })

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    const [tarifasRes, productosRes] = await Promise.all([
      supabase
        .from('tarifas')
        .select('*, productos:producto_id(nombre)')
        .order('nombre', { ascending: true })
        .range(0, 499),
      supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre'),
    ])

    if (tarifasRes.error) {
      setMensaje({ tipo: 'error', texto: `Error: ${tarifasRes.error.message}` })
    } else {
      const datos = (tarifasRes.data || []).map((t: any) => ({
        ...t,
        producto_nombre: t.productos?.nombre || null,
      }))
      setTarifas(datos)
    }

    if (!productosRes.error) {
      setProductos((productosRes.data || []) as Producto[])
    }

    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const tarifasFiltradas = filtroProducto === 'todos'
    ? tarifas
    : tarifas.filter(t => t.producto_id === filtroProducto)

  function abrirNuevo() {
    setEditando(null)
    setForm({
      nombre: '',
      producto_id: '',
      modo_precio: 'm2',
      precio_m2: '',
      precio_pieza: '',
      precio_minimo: '0',
      coste_adicional_color: '0',
      coste_adicional_tratamiento: '0',
      coste_adicional_embalaje: '0',
      activo: true,
    })
    setDialogoAbierto(true)
  }

  function abrirEditar(t: Tarifa) {
    setEditando(t)
    setForm({
      nombre: t.nombre,
      producto_id: t.producto_id || '',
      modo_precio: t.modo_precio,
      precio_m2: t.precio_m2 != null ? String(t.precio_m2) : '',
      precio_pieza: t.precio_pieza != null ? String(t.precio_pieza) : '',
      precio_minimo: String(t.precio_minimo || 0),
      coste_adicional_color: String(t.coste_adicional_color || 0),
      coste_adicional_tratamiento: String(t.coste_adicional_tratamiento || 0),
      coste_adicional_embalaje: String(t.coste_adicional_embalaje || 0),
      activo: t.activo,
    })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }

    const datos = {
      nombre: form.nombre.trim(),
      producto_id: form.producto_id || null,
      modo_precio: form.modo_precio,
      precio_m2: form.precio_m2 ? parseFloat(form.precio_m2) : null,
      precio_pieza: form.precio_pieza ? parseFloat(form.precio_pieza) : null,
      precio_minimo: parseFloat(form.precio_minimo) || 0,
      coste_adicional_color: parseFloat(form.coste_adicional_color) || 0,
      coste_adicional_tratamiento: parseFloat(form.coste_adicional_tratamiento) || 0,
      coste_adicional_embalaje: parseFloat(form.coste_adicional_embalaje) || 0,
      activo: form.activo,
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('tarifas')
          .update({ ...datos, updated_at: new Date().toISOString() })
          .eq('id', editando.id)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Tarifa actualizada.' })
      } else {
        const { error } = await supabase.from('tarifas').insert(datos)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Tarifa creada.' })
      }
      setDialogoAbierto(false)
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${err.message || err}` })
    }
  }

  async function toggleActivo(t: Tarifa) {
    try {
      const { error } = await supabase
        .from('tarifas')
        .update({ activo: !t.activo, updated_at: new Date().toISOString() })
        .eq('id', t.id)
      if (error) throw error
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${err.message || err}` })
    }
  }

  function formatoPrecio(valor: number | null): string {
    if (valor == null) return '—'
    return `${Number(valor).toFixed(2)} €`
  }

  function modoLabel(modo: string): string {
    switch (modo) {
      case 'm2': return 'Por m²'
      case 'pieza': return 'Por pieza'
      case 'ambos': return 'Ambos'
      default: return modo
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Euro className="w-8 h-8" />
          Tarifas
        </h1>
        <p className="text-muted-foreground">
          Precios base por producto. Se usan al crear presupuestos para calcular
          el coste automáticamente.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Lista de tarifas</CardTitle>
              <CardDescription>
                {tarifasFiltradas.length} tarifa{tarifasFiltradas.length !== 1 ? 's' : ''} 
                {filtroProducto !== 'todos' ? ' (filtradas)' : ''}
              </CardDescription>
            </div>
            <div className="flex gap-3 items-end">
              <div className="w-56">
                <Label className="text-xs mb-1 block">Filtrar por producto</Label>
                <Select value={filtroProducto} onValueChange={setFiltroProducto}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los productos</SelectItem>
                    {productos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={abrirNuevo}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva tarifa
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : tarifasFiltradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay tarifas{filtroProducto !== 'todos' ? ' para este producto' : ''}. 
              Crea la primera con el botón de arriba.
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Modo</TableHead>
                    <TableHead className="text-right">€/m²</TableHead>
                    <TableHead className="text-right">€/pieza</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right w-44">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarifasFiltradas.map((t) => (
                    <TableRow key={t.id} className={!t.activo ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{t.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(t as any).producto_nombre || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{modoLabel(t.modo_precio)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatoPrecio(t.precio_m2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatoPrecio(t.precio_pieza)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatoPrecio(t.precio_minimo)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={t.activo ? 'default' : 'secondary'}>
                          {t.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => abrirEditar(t)}>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActivo(t)}>
                          {t.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo crear/editar */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar tarifa' : 'Nueva tarifa'}</DialogTitle>
            <DialogDescription>
              Define el precio base para un producto. Los costes adicionales se suman
              automáticamente al presupuesto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nombre de la tarifa *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Tablero MDF - Lacado estándar"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Producto</Label>
                <Select
                  value={form.producto_id || 'ninguno'}
                  onValueChange={(v) => setForm({ ...form, producto_id: v === 'ninguno' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin producto específico</SelectItem>
                    {productos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Modo de precio</Label>
                <Select
                  value={form.modo_precio}
                  onValueChange={(v: 'm2' | 'pieza' | 'ambos') =>
                    setForm({ ...form, modo_precio: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">Por metro cuadrado</SelectItem>
                    <SelectItem value="pieza">Por pieza</SelectItem>
                    <SelectItem value="ambos">Ambos (m² y pieza)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(form.modo_precio === 'm2' || form.modo_precio === 'ambos') && (
                <div className="space-y-1">
                  <Label>Precio / m² (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio_m2}
                    onChange={(e) => setForm({ ...form, precio_m2: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
              {(form.modo_precio === 'pieza' || form.modo_precio === 'ambos') && (
                <div className="space-y-1">
                  <Label>Precio / pieza (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio_pieza}
                    onChange={(e) => setForm({ ...form, precio_pieza: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label>Precio mínimo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_minimo}
                  onChange={(e) => setForm({ ...form, precio_minimo: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Si el cálculo da menos, se aplica este.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Coste extra color (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.coste_adicional_color}
                  onChange={(e) => setForm({ ...form, coste_adicional_color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Coste extra tratamiento (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.coste_adicional_tratamiento}
                  onChange={(e) => setForm({ ...form, coste_adicional_tratamiento: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Coste extra embalaje (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.coste_adicional_embalaje}
                  onChange={(e) => setForm({ ...form, coste_adicional_embalaje: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo" className="cursor-pointer mb-0">
                Activa (disponible para presupuestos)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
