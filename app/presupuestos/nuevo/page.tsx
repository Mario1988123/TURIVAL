'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Plus, Trash2, Save, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Cliente {
  id: string
  nombre_comercial: string
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  unidad_tarificacion: string
}

interface Color {
  id: string
  codigo: string
  nombre: string
  sobrecoste: number
}

interface Tratamiento {
  id: string
  nombre: string
  multiplicador_coste: number
}

interface Tarifa {
  id: string
  nombre: string
  producto_id: string
  precio_m2: number | null
  precio_pieza: number | null
  precio_minimo: number
  coste_adicional_color: number
  coste_adicional_tratamiento: number
}

interface LineaPresupuesto {
  producto_id: string
  producto_nombre: string
  color_id: string
  color_nombre: string
  tratamiento_id: string
  tratamiento_nombre: string
  tarifa_id: string
  cantidad: number
  unidad: string
  precio_unitario: number
  descuento_linea: number
  subtotal: number
}

export default function NuevoPresupuestoPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<Color[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  
  const [clienteId, setClienteId] = useState('')
  const [validezDias, setValidezDias] = useState(30)
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([])
  
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState('')
  const [nuevoProductoCategoria, setNuevoProductoCategoria] = useState('')
  const [nuevoProductoUnidad, setNuevoProductoUnidad] = useState('m2')
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  
  const [nuevaLinea, setNuevaLinea] = useState({
    producto_id: '',
    color_id: '',
    tratamiento_id: '',
    tarifa_id: '',
    cantidad: 1,
    descuento: 0,
  })

  useEffect(() => {
    loadCatalogos()
  }, [])

  async function loadCatalogos() {
    try {
      setLoading(true)
      const [clientesRes, productosRes, coloresRes, tratamientosRes, tarifasRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre_comercial').order('nombre_comercial'),
        supabase.from('productos').select('id, nombre, categoria, unidad_tarificacion').eq('activo', true).order('nombre'),
        supabase.from('colores').select('id, codigo, nombre, sobrecoste').eq('activo', true).order('codigo'),
        supabase.from('tratamientos').select('id, nombre, multiplicador_coste').eq('activo', true).order('nombre'),
        supabase.from('tarifas').select('id, nombre, producto_id, precio_m2, precio_pieza, precio_minimo, coste_adicional_color, coste_adicional_tratamiento').eq('activo', true).order('nombre'),
      ])
      
      setClientes(clientesRes.data || [])
      setProductos(productosRes.data || [])
      setColores(coloresRes.data || [])
      setTratamientos(tratamientosRes.data || [])
      setTarifas(tarifasRes.data || [])
      setError(null)
    } catch (err) {
      console.error('Error cargando catálogos:', err)
      setError('Error al cargar catálogos')
    } finally {
      setLoading(false)
    }
  }

  async function handleCrearProducto() {
    if (!nuevoProductoNombre) {
      setError('El nombre del producto es obligatorio')
      return
    }

    try {
      const { data, error: err } = await supabase
        .from('productos')
        .insert({
          nombre: nuevoProductoNombre,
          categoria: nuevoProductoCategoria,
          unidad_tarificacion: nuevoProductoUnidad,
          activo: true,
        })
        .select()
        .single()

      if (err) throw err

      setProductos([...productos, data])
      setNuevoProductoNombre('')
      setNuevoProductoCategoria('')
      setNuevoProductoUnidad('m2')
      setShowNuevoProducto(false)
      setError(null)
    } catch (err) {
      console.error('Error creando producto:', err)
      setError('Error al crear producto')
    }
  }

  function handleAddLinea() {
    if (!nuevaLinea.producto_id || !nuevaLinea.color_id || !nuevaLinea.tarifa_id) {
      setError('Por favor completa todos los campos requeridos')
      return
    }

    const producto = productos.find(p => p.id === nuevaLinea.producto_id)
    const color = colores.find(c => c.id === nuevaLinea.color_id)
    const tratamiento = tratamientos.find(t => t.id === nuevaLinea.tratamiento_id)
    const tarifa = tarifas.find(t => t.id === nuevaLinea.tarifa_id)

    if (!producto || !color || !tarifa) return

    let precioBase = 0
    if (producto.unidad_tarificacion === 'm2' && tarifa.precio_m2) {
      precioBase = tarifa.precio_m2
    } else if (producto.unidad_tarificacion === 'pieza' && tarifa.precio_pieza) {
      precioBase = tarifa.precio_pieza
    }

    const costosAdicionales = (color.sobrecoste || 0) + (tarifa.coste_adicional_color || 0) + (tratamiento ? tarifa.coste_adicional_tratamiento * tratamiento.multiplicador_coste : 0)
    
    const precioUnitario = precioBase + costosAdicionales
    const subtotal = Math.max(
      precioUnitario * nuevaLinea.cantidad * (1 - nuevaLinea.descuento / 100),
      tarifa.precio_minimo
    )

    const linea: LineaPresupuesto = {
      producto_id: nuevaLinea.producto_id,
      producto_nombre: producto.nombre,
      color_id: nuevaLinea.color_id,
      color_nombre: `${color.codigo} - ${color.nombre}`,
      tratamiento_id: nuevaLinea.tratamiento_id,
      tratamiento_nombre: tratamiento?.nombre || 'Sin tratamiento',
      tarifa_id: nuevaLinea.tarifa_id,
      cantidad: nuevaLinea.cantidad,
      unidad: producto.unidad_tarificacion,
      precio_unitario: precioUnitario,
      descuento_linea: nuevaLinea.descuento,
      subtotal,
    }

    setLineas([...lineas, linea])
    setNuevaLinea({ producto_id: '', color_id: '', tratamiento_id: '', tarifa_id: '', cantidad: 1, descuento: 0 })
    setError(null)
  }

  function handleRemoveLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index))
  }

  async function handleGuardarPresupuesto() {
    if (!clienteId || lineas.length === 0) {
      setError('Selecciona un cliente y agrega al menos una línea')
      return
    }

    try {
      setLoading(true)

      const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
      const impuestos = subtotal * 0.21
      const total = subtotal + impuestos

      const year = new Date().getFullYear()
      const { data: secuencia } = await supabase
        .from('secuencias')
        .select('ultimo_numero')
        .eq('id', 'presupuesto')
        .eq('anio', year)
        .single()

      const siguienteNumero = (secuencia?.ultimo_numero || 0) + 1
      const numero = `PRES-${year}-${String(siguienteNumero).padStart(5, '0')}`

      const { data: presupuesto, error: presupuestoErr } = await supabase
        .from('presupuestos')
        .insert({
          numero,
          cliente_id: clienteId,
          estado: 'borrador',
          subtotal,
          impuestos,
          total,
          validez_dias: validezDias,
          observaciones,
        })
        .select()
        .single()

      if (presupuestoErr) throw presupuestoErr

      const lineasData = lineas.map((l, idx) => ({
        presupuesto_id: presupuesto.id,
        numero_linea: idx + 1,
        producto_id: l.producto_id,
        color_id: l.color_id,
        tratamiento_id: l.tratamiento_id,
        cantidad: l.cantidad,
        unidad: l.unidad,
        precio_unitario: l.precio_unitario,
        descuento_linea: l.descuento_linea,
        subtotal: l.subtotal,
      }))

      const { error: lineasErr } = await supabase
        .from('lineas_presupuesto')
        .insert(lineasData)

      if (lineasErr) throw lineasErr

      await supabase
        .from('secuencias')
        .update({ ultimo_numero: siguienteNumero })
        .eq('id', 'presupuesto')
        .eq('anio', year)

      router.push(`/presupuestos/${presupuesto.id}`)
    } catch (err) {
      console.error('Error guardando presupuesto:', err)
      setError('Error al guardar presupuesto')
    } finally {
      setLoading(false)
    }
  }

  if (loading && productos.length === 0) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Datos Generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.filter(c => c.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre_comercial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Validez (días)</Label>
              <Input
                type="number"
                value={validezDias}
                onChange={e => setValidezDias(Number(e.target.value))}
              />
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                className="h-24"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Líneas del Presupuesto</CardTitle>
            <CardDescription>Agrega los productos y servicios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Producto *</Label>
                <div className="flex gap-2">
                  <Select value={nuevaLinea.producto_id} onValueChange={v => setNuevaLinea({...nuevaLinea, producto_id: v})}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.filter(p => p.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNuevoProducto(!showNuevoProducto)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Color *</Label>
                <Select value={nuevaLinea.color_id} onValueChange={v => setNuevaLinea({...nuevaLinea, color_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {colores.filter(c => c.id).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Tratamiento</Label>
                <Select value={nuevaLinea.tratamiento_id || ''} onValueChange={v => setNuevaLinea({...nuevaLinea, tratamiento_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional - Sin tratamiento" />
                  </SelectTrigger>
                  <SelectContent>
                    {tratamientos.filter(t => t.id).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Tarifa *</Label>
                <Select value={nuevaLinea.tarifa_id} onValueChange={v => setNuevaLinea({...nuevaLinea, tarifa_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {tarifas.filter(t => t.id && t.producto_id === nuevaLinea.producto_id).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Cantidad</Label>
                <Input
                  type="number"
                  value={nuevaLinea.cantidad}
                  onChange={e => setNuevaLinea({...nuevaLinea, cantidad: Number(e.target.value)})}
                  min="1"
                />
              </div>

              <div>
                <Label className="text-sm">Descuento (%)</Label>
                <Input
                  type="number"
                  value={nuevaLinea.descuento}
                  onChange={e => setNuevaLinea({...nuevaLinea, descuento: Number(e.target.value)})}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {showNuevoProducto && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold">Crear Nuevo Producto</h4>
                <Input
                  placeholder="Nombre"
                  value={nuevoProductoNombre}
                  onChange={e => setNuevoProductoNombre(e.target.value)}
                />
                <Input
                  placeholder="Categoría"
                  value={nuevoProductoCategoria}
                  onChange={e => setNuevoProductoCategoria(e.target.value)}
                />
                <Select value={nuevoProductoUnidad} onValueChange={setNuevoProductoUnidad}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">m2</SelectItem>
                    <SelectItem value="pieza">Pieza</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCrearProducto} disabled={!nuevoProductoNombre}>Crear Producto</Button>
              </div>
            )}

            <Button onClick={handleAddLinea} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Línea
            </Button>

            {lineas.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>P. Unitario</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{l.producto_nombre} ({l.color_nombre})</TableCell>
                        <TableCell>{l.cantidad} {l.unidad}</TableCell>
                        <TableCell>€{l.precio_unitario.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">€{l.subtotal.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLinea(idx)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>€{lineas.reduce((sum, l) => sum + l.subtotal, 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (21%):</span>
                        <span>€{(lineas.reduce((sum, l) => sum + l.subtotal, 0) * 0.21).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>€{(lineas.reduce((sum, l) => sum + l.subtotal, 0) * 1.21).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleGuardarPresupuesto} disabled={loading || !clienteId || lineas.length === 0}>
          <Save className="w-4 h-4 mr-2" />
          Guardar Presupuesto
        </Button>
      </div>
    </div>
  )
}
