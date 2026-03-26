'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Plus, Trash2, FileText, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

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

interface Presupuesto {
  id: string
  numero: string
  total: number
  cliente_id: string
  clientes: { nombre_comercial: string }
}

interface Linea {
  producto_id: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad: string
}

export default function NuevoPedidoPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  
  const [modo, setModo] = useState<'nuevo' | 'presupuesto'>('nuevo')
  const [clienteId, setClienteId] = useState('')
  const [presupuestoId, setPresupuestoId] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  
  const [nuevaLinea, setNuevaLinea] = useState({
    producto_id: '',
    cantidad: 1,
    precio_unitario: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Debes iniciar sesion')
        return
      }
      setUserId(user.id)

      const [clientesRes, productosRes, presupuestosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre_comercial').eq('activo', true).order('nombre_comercial'),
        supabase.from('productos').select('id, nombre, categoria, unidad_tarificacion').eq('activo', true).order('nombre'),
        supabase.from('presupuestos').select('id, numero, total, cliente_id, clientes(nombre_comercial)').eq('estado', 'aceptado').order('numero', { ascending: false })
      ])

      setClientes(clientesRes.data || [])
      setProductos(productosRes.data || [])
      setPresupuestos(presupuestosRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  async function handleSeleccionarPresupuesto(presId: string) {
    setPresupuestoId(presId)
    
    const pres = presupuestos.find(p => p.id === presId)
    if (pres) {
      setClienteId(pres.cliente_id)
      
      // Cargar lineas del presupuesto
      const { data: lineasPres } = await supabase
        .from('lineas_presupuesto')
        .select('producto_id, cantidad, precio_unitario, subtotal, unidad, productos(nombre)')
        .eq('presupuesto_id', presId)
      
      if (lineasPres) {
        setLineas(lineasPres.map(l => ({
          producto_id: l.producto_id,
          producto_nombre: (l.productos as any)?.nombre || 'Producto',
          cantidad: l.cantidad,
          precio_unitario: Number(l.precio_unitario),
          subtotal: Number(l.subtotal),
          unidad: l.unidad || 'm2'
        })))
      }
    }
  }

  function handleAgregarLinea() {
    if (!nuevaLinea.producto_id || nuevaLinea.cantidad <= 0) {
      setError('Selecciona un producto y cantidad')
      return
    }

    const producto = productos.find(p => p.id === nuevaLinea.producto_id)
    if (!producto) return

    const subtotal = nuevaLinea.cantidad * nuevaLinea.precio_unitario

    setLineas([...lineas, {
      producto_id: nuevaLinea.producto_id,
      producto_nombre: producto.nombre,
      cantidad: nuevaLinea.cantidad,
      precio_unitario: nuevaLinea.precio_unitario,
      subtotal,
      unidad: producto.unidad_tarificacion || 'm2'
    }])

    setNuevaLinea({ producto_id: '', cantidad: 1, precio_unitario: 0 })
    setError('')
  }

  function handleEliminarLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index))
  }

  async function handleGuardar() {
    if (!userId) {
      setError('Debes iniciar sesion')
      return
    }
    if (!clienteId) {
      setError('Selecciona un cliente')
      return
    }
    if (lineas.length === 0) {
      setError('Agrega al menos una linea')
      return
    }

    try {
      setSaving(true)
      setError('')

      const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
      const impuestos = subtotal * 0.21
      const total = subtotal + impuestos

      // Obtener y actualizar secuencia
      const nuevoNumero = await (async () => {
        const { data: secuencia } = await supabase
          .from('secuencias')
          .select('ultimo_numero')
          .eq('id', 'pedido')
          .single()
        
        const siguiente = (secuencia?.ultimo_numero || 0) + 1
        
        await supabase
          .from('secuencias')
          .update({ ultimo_numero: siguiente })
          .eq('id', 'pedido')
        
        return siguiente
      })()

      const numero = `PED-2026-${String(nuevoNumero).padStart(5, '0')}`

      const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos')
        .insert({
          numero,
          cliente_id: clienteId,
          presupuesto_id: modo === 'presupuesto' ? presupuestoId : null,
          user_id: userId,
          estado: 'pendiente',
          prioridad,
          fecha_entrega: fechaEntrega || null,
          subtotal,
          impuestos,
          total,
          observaciones,
        })
        .select()
        .single()

      if (pedidoErr) throw pedidoErr
      if (!pedido) throw new Error('No se creo el pedido')

      // Insertar lineas
      for (const linea of lineas) {
        await supabase
          .from('lineas_pedido')
          .insert({
            pedido_id: pedido.id,
            producto_id: linea.producto_id,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal: linea.subtotal,
            unidad: linea.unidad,
          })
      }

      // Si viene de presupuesto, actualizar estado
      if (modo === 'presupuesto' && presupuestoId) {
        await supabase
          .from('presupuestos')
          .update({ estado: 'convertido' })
          .eq('id', presupuestoId)
      }

      router.push('/pedidos')
    } catch (err) {
      console.error('Error guardando pedido:', err)
      setError('Error al guardar pedido')
    } finally {
      setSaving(false)
    }
  }

  const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
  const impuestos = subtotal * 0.21
  const total = subtotal + impuestos

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/pedidos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Pedido</h1>
          <p className="text-muted-foreground">Crear nuevo pedido o convertir presupuesto</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={modo} onValueChange={(v) => setModo(v as 'nuevo' | 'presupuesto')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="nuevo" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Nuevo Pedido
          </TabsTrigger>
          <TabsTrigger value="presupuesto" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Desde Presupuesto
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Pedido</CardTitle>
            <CardDescription>Informacion general</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modo === 'presupuesto' ? (
              <div>
                <Label>Presupuesto Aceptado *</Label>
                <Select value={presupuestoId} onValueChange={handleSeleccionarPresupuesto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona presupuesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {presupuestos.filter(p => p.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero} - {(p.clientes as any)?.nombre_comercial} - {Number(p.total).toFixed(2)}€
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridad</Label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha Entrega</Label>
                <Input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                placeholder="Notas adicionales..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Totales del pedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Lineas:</span>
                <span className="font-medium">{lineas.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{subtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA (21%):</span>
                <span className="font-medium">{impuestos.toFixed(2)}€</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-blue-600">{total.toFixed(2)}€</span>
              </div>
            </div>

            <Button
              onClick={handleGuardar}
              disabled={saving || !clienteId || lineas.length === 0}
              className="w-full mt-6"
            >
              {saving ? 'Guardando...' : 'Crear Pedido'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {modo === 'nuevo' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lineas del Pedido</CardTitle>
            <CardDescription>Agrega productos al pedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <Label className="text-sm">Producto</Label>
                <Select value={nuevaLinea.producto_id} onValueChange={v => setNuevaLinea({...nuevaLinea, producto_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.filter(p => p.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-sm">Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={nuevaLinea.cantidad}
                  onChange={(e) => setNuevaLinea({...nuevaLinea, cantidad: Number(e.target.value)})}
                />
              </div>
              <div className="w-28">
                <Label className="text-sm">Precio/ud</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={nuevaLinea.precio_unitario}
                  onChange={(e) => setNuevaLinea({...nuevaLinea, precio_unitario: Number(e.target.value)})}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAgregarLinea} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {lineas.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3">Producto</th>
                      <th className="text-right p-3">Cantidad</th>
                      <th className="text-right p-3">Precio</th>
                      <th className="text-right p-3">Subtotal</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((linea, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3">{linea.producto_nombre}</td>
                        <td className="text-right p-3">{linea.cantidad} {linea.unidad}</td>
                        <td className="text-right p-3">{linea.precio_unitario.toFixed(2)}€</td>
                        <td className="text-right p-3 font-medium">{linea.subtotal.toFixed(2)}€</td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" onClick={() => handleEliminarLinea(i)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {modo === 'presupuesto' && lineas.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lineas del Presupuesto</CardTitle>
            <CardDescription>Se copiaran al pedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3">Producto</th>
                    <th className="text-right p-3">Cantidad</th>
                    <th className="text-right p-3">Precio</th>
                    <th className="text-right p-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{linea.producto_nombre}</td>
                      <td className="text-right p-3">{linea.cantidad} {linea.unidad}</td>
                      <td className="text-right p-3">{linea.precio_unitario.toFixed(2)}€</td>
                      <td className="text-right p-3 font-medium">{linea.subtotal.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
