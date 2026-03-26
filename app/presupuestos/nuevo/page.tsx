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
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'

interface Cliente {
  id: string
  nombre_comercial: string
}

interface Producto {
  id: string
  codigo: string
  nombre: string
  precio_base: number
}

interface Color {
  id: string
  codigo: string
  nombre: string
}

interface Tratamiento {
  id: string
  nombre: string
  factor_precio: number
}

interface LineaPresupuesto {
  producto_id: string
  producto_nombre: string
  color_id: string
  color_nombre: string
  tratamiento_id: string
  tratamiento_nombre: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
}

export default function NuevoPresupuestoPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<Color[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  
  const [clienteId, setClienteId] = useState('')
  const [validezDias, setValidezDias] = useState(30)
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([])
  
  const [nuevaLinea, setNuevaLinea] = useState({
    producto_id: '',
    color_id: '',
    tratamiento_id: '',
    cantidad: 1,
    descuento: 0,
  })

  useEffect(() => {
    loadCatalogos()
  }, [])

  async function loadCatalogos() {
    const [clientesRes, productosRes, coloresRes, tratamientosRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre_comercial').order('nombre_comercial'),
      supabase.from('productos').select('id, codigo, nombre, precio_base').eq('activo', true).order('nombre'),
      supabase.from('colores').select('id, codigo, nombre').eq('activo', true).order('codigo'),
      supabase.from('tratamientos').select('id, nombre, factor_precio').eq('activo', true).order('nombre'),
    ])
    
    setClientes(clientesRes.data || [])
    setProductos(productosRes.data || [])
    setColores(coloresRes.data || [])
    setTratamientos(tratamientosRes.data || [])
  }

  function calcularPrecioLinea(productoId: string, tratamientoId: string, cantidad: number, descuento: number): number {
    const producto = productos.find(p => p.id === productoId)
    const tratamiento = tratamientos.find(t => t.id === tratamientoId)
    
    if (!producto) return 0
    
    const precioBase = Number(producto.precio_base)
    const factor = tratamiento ? Number(tratamiento.factor_precio) : 1
    const precioUnitario = precioBase * factor
    const subtotal = precioUnitario * cantidad * (1 - descuento / 100)
    
    return subtotal
  }

  function handleAddLinea() {
    if (!nuevaLinea.producto_id || !nuevaLinea.color_id) return

    const producto = productos.find(p => p.id === nuevaLinea.producto_id)
    const color = colores.find(c => c.id === nuevaLinea.color_id)
    const tratamiento = tratamientos.find(t => t.id === nuevaLinea.tratamiento_id)

    if (!producto || !color) return

    const precioBase = Number(producto.precio_base)
    const factor = tratamiento ? Number(tratamiento.factor_precio) : 1
    const precioUnitario = precioBase * factor
    const subtotal = precioUnitario * nuevaLinea.cantidad * (1 - nuevaLinea.descuento / 100)

    const linea: LineaPresupuesto = {
      producto_id: nuevaLinea.producto_id,
      producto_nombre: `${producto.codigo} - ${producto.nombre}`,
      color_id: nuevaLinea.color_id,
      color_nombre: `${color.codigo} - ${color.nombre}`,
      tratamiento_id: nuevaLinea.tratamiento_id,
      tratamiento_nombre: tratamiento?.nombre || 'Sin tratamiento',
      cantidad: nuevaLinea.cantidad,
      precio_unitario: precioUnitario,
      descuento: nuevaLinea.descuento,
      subtotal,
    }

    setLineas([...lineas, linea])
    setNuevaLinea({ producto_id: '', color_id: '', tratamiento_id: '', cantidad: 1, descuento: 0 })
  }

  function handleRemoveLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index))
  }

  async function getNextNumero(): Promise<string> {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('secuencias')
      .select('ultimo_numero')
      .eq('id', 'presupuesto')
      .single()

    const siguiente = (data?.ultimo_numero || 0) + 1
    
    await supabase
      .from('secuencias')
      .update({ ultimo_numero: siguiente })
      .eq('id', 'presupuesto')

    return `PRE-${year}-${String(siguiente).padStart(5, '0')}`
  }

  async function handleGuardar() {
    if (!clienteId || lineas.length === 0) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const numero = await getNextNumero()
      const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
      const impuestos = subtotal * 0.21 // 21% IVA
      const total = subtotal + impuestos

      // Crear presupuesto
      const { data: presupuesto, error: presError } = await supabase
        .from('presupuestos')
        .insert({
          numero,
          cliente_id: clienteId,
          estado: 'borrador',
          validez_dias: validezDias,
          observaciones: observaciones || null,
          subtotal,
          descuento: 0,
          impuestos,
          total,
          user_id: user.id,
        })
        .select()
        .single()

      if (presError) throw presError

      // Crear lineas
      const lineasInsert = lineas.map((l, index) => ({
        presupuesto_id: presupuesto.id,
        producto_id: l.producto_id,
        color_id: l.color_id,
        tratamiento_id: l.tratamiento_id || null,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        descuento: l.descuento,
        subtotal: l.subtotal,
        orden: index + 1,
      }))

      const { error: lineasError } = await supabase
        .from('lineas_presupuesto')
        .insert(lineasInsert)

      if (lineasError) throw lineasError

      router.push('/presupuestos')
    } catch (error) {
      console.error('Error creating presupuesto:', error)
    } finally {
      setLoading(false)
    }
  }

  const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
  const impuestos = subtotal * 0.21
  const total = subtotal + impuestos

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Presupuesto</h1>
          <p className="text-muted-foreground">Crea un nuevo presupuesto para un cliente</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Datos del presupuesto */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Datos Generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.filter(c => c.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre_comercial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Validez (dias)</Label>
              <Input type="number" min="1" value={validezDias} onChange={e => setValidezDias(parseInt(e.target.value) || 30)} />
            </div>
            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales..." />
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{subtotal.toFixed(2)} EUR</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA (21%):</span>
                <span>{impuestos.toFixed(2)} EUR</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{total.toFixed(2)} EUR</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleGuardar} disabled={loading || !clienteId || lineas.length === 0}>
              <Save className="h-4 w-4 mr-2" /> {loading ? 'Guardando...' : 'Guardar Presupuesto'}
            </Button>
          </CardContent>
        </Card>

        {/* Lineas del presupuesto */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Lineas del Presupuesto</CardTitle>
            <CardDescription>Agrega los productos y servicios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Formulario nueva linea */}
            <div className="grid gap-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <Label>Producto *</Label>
                  <Select value={nuevaLinea.producto_id} onValueChange={v => setNuevaLinea({...nuevaLinea, producto_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger>
                    <SelectContent>
                      {productos.filter(p => p.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Color *</Label>
                  <Select value={nuevaLinea.color_id} onValueChange={v => setNuevaLinea({...nuevaLinea, color_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                    <SelectContent>
                      {colores.filter(c => c.id).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tratamiento</Label>
                  <Select value={nuevaLinea.tratamiento_id || 'none'} onValueChange={v => setNuevaLinea({...nuevaLinea, tratamiento_id: v === 'none' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin tratamiento</SelectItem>
                      {tratamientos.filter(t => t.id).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Cantidad</Label>
                    <Input type="number" min="1" value={nuevaLinea.cantidad} onChange={e => setNuevaLinea({...nuevaLinea, cantidad: parseInt(e.target.value) || 1})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Dto %</Label>
                    <Input type="number" min="0" max="100" value={nuevaLinea.descuento} onChange={e => setNuevaLinea({...nuevaLinea, descuento: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
              <Button onClick={handleAddLinea} disabled={!nuevaLinea.producto_id || !nuevaLinea.color_id}>
                <Plus className="h-4 w-4 mr-2" /> Agregar Linea
              </Button>
            </div>

            {/* Tabla de lineas */}
            {lineas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay lineas agregadas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Dto %</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((linea, index) => (
                    <TableRow key={index}>
                      <TableCell>{linea.producto_nombre}</TableCell>
                      <TableCell>{linea.color_nombre}</TableCell>
                      <TableCell>{linea.tratamiento_nombre}</TableCell>
                      <TableCell className="text-center">{linea.cantidad}</TableCell>
                      <TableCell className="text-right">{linea.precio_unitario.toFixed(2)} EUR</TableCell>
                      <TableCell className="text-center">{linea.descuento}%</TableCell>
                      <TableCell className="text-right font-medium">{linea.subtotal.toFixed(2)} EUR</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveLinea(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
