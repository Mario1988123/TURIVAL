'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2 } from 'lucide-react'

interface Linea {
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  unidad_tarificacion: string
}

interface Cliente {
  id: string
  nombre_comercial: string
}

interface Tarifa {
  id: string
  nombre: string
  precio_m2: number
  precio_pieza: number
  precio_minimo: number
}

export default function NuevoPresupuesto() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [validezDias, setValidezDias] = useState(30)
  const [observaciones, setObservaciones] = useState('')
  
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  
  const [lineas, setLineas] = useState<Linea[]>([])
  const [nuevoProductoId, setNuevoProductoId] = useState('')
  const [nuevaCantidad, setNuevaCantidad] = useState(1)
  const [nuevoPrecio, setNuevoPrecio] = useState(0)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

      const [clientesRes, productosRes, tarifasRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre_comercial'),
        supabase.from('productos').select('id, nombre, categoria, unidad_tarificacion'),
        supabase.from('tarifas').select('id, nombre, precio_m2, precio_pieza, precio_minimo'),
      ])

      setClientes(clientesRes.data || [])
      setProductos(productosRes.data || [])
      setTarifas(tarifasRes.data || [])

      // Pre-seleccionar cliente si viene desde URL
      const clienteIdParam = searchParams.get('cliente')
      if (clienteIdParam) {
        setClienteId(clienteIdParam)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Al seleccionar producto, obtener precio de tarifa
  function handleProductoChange(productoId: string) {
    setNuevoProductoId(productoId)
    
    // Buscar precio en tarifas - usar primera tarifa disponible
    if (tarifas.length > 0 && productoId) {
      const producto = productos.find(p => p.id === productoId)
      const tarifa = tarifas[0] // Usar tarifa por defecto
      
      if (producto && tarifa) {
        // Usar precio según unidad de tarificacion del producto
        const precio = producto.unidad_tarificacion === 'pieza' 
          ? (tarifa.precio_pieza || 0) 
          : (tarifa.precio_m2 || 0)
        setNuevoPrecio(precio)
      }
    }
  }

  function agregarLinea() {
    if (!nuevoProductoId || nuevaCantidad <= 0 || nuevoPrecio <= 0) {
      setError('Completa producto, cantidad y precio')
      return
    }

    const subtotal = nuevaCantidad * nuevoPrecio
    setLineas([...lineas, {
      producto_id: nuevoProductoId,
      cantidad: nuevaCantidad,
      precio_unitario: nuevoPrecio,
      subtotal
    }])

    setNuevoProductoId('')
    setNuevaCantidad(1)
    setNuevoPrecio(0)
    setError('')
  }

  function eliminarLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index))
  }

  async function handleGuardar() {
    if (!userId) {
      setError('Debes iniciar sesion')
      return
    }
    if (!clienteId || lineas.length === 0) {
      setError('Selecciona cliente y agrega al menos una línea')
      return
    }

    try {
      setSaving(true)
      setError('')

      const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
      const impuestos = subtotal * 0.21
      const total = subtotal + impuestos

      // Obtener siguiente número de secuencia de forma atómica usando RPC
      const { data: nuevoNumero, error: seqError } = await supabase
        .rpc('get_next_sequence', { seq_id: 'presupuesto' })
      
      if (seqError || !nuevoNumero) {
        setError('Error generando número de presupuesto')
        setSaving(false)
        return
      }

      const numero = `PRES-2026-${String(nuevoNumero).padStart(5, '0')}`

      const { data: presupuesto, error: presupuestoErr } = await supabase
        .from('presupuestos')
        .insert({
          numero,
          cliente_id: clienteId,
          user_id: userId,
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
      if (!presupuesto) throw new Error('No se creó el presupuesto')

      // Insertar líneas del presupuesto con numero_linea obligatorio
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i]
        const numeroLinea = i + 1
        
        const { error: lineaErr } = await supabase
          .from('lineas_presupuesto')
          .insert({
            presupuesto_id: presupuesto.id,
            producto_id: linea.producto_id,
            numero_linea: numeroLinea,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal: linea.subtotal,
            unidad: productos.find(p => p.id === linea.producto_id)?.unidad_tarificacion || 'm2',
          })

        if (lineaErr) {
          console.error('[v0] Error insertando linea:', numeroLinea, lineaErr)
          throw lineaErr
        }
      }

      router.push(`/presupuestos/${presupuesto.id}`)
    } catch (err) {
      console.error('Error guardando presupuesto:', err)
      setError('Error al guardar presupuesto')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Cargando...</div>

  const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
  const impuestos = subtotal * 0.21
  const total = subtotal + impuestos
  const productoSeleccionado = productos.find(p => p.id === nuevoProductoId)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Nuevo Presupuesto</h1>
        <p className="text-gray-600">Crea un nuevo presupuesto para un cliente</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
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
                  onChange={(e) => setValidezDias(Number(e.target.value))}
                  min="1"
                />
              </div>

              <div>
                <Label>Observaciones</Label>
                <Input
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Líneas del Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Producto *</Label>
                <Select value={nuevoProductoId} onValueChange={handleProductoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.filter(p => p.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Cantidad *</Label>
                  <Input
                    type="number"
                    value={nuevaCantidad}
                    onChange={(e) => setNuevaCantidad(Number(e.target.value))}
                    min="1"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Unidad</Label>
                  <Input
                    disabled
                    value={productoSeleccionado?.unidad_tarificacion || 'n/a'}
                  />
                </div>
                <div>
                  <Label>Precio/Unidad *</Label>
                  <Input
                    type="number"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <Button onClick={agregarLinea} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Línea
              </Button>

              {lineas.length > 0 && (
                <div className="space-y-2">
                  {lineas.map((linea, idx) => {
                    const producto = productos.find(p => p.id === linea.producto_id)
                    return (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{producto?.nombre}</p>
                          <p className="text-sm text-gray-600">
                            {linea.cantidad} x ${linea.precio_unitario.toFixed(2)} = ${linea.subtotal.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarLinea(idx)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>IVA (21%):</span>
                  <span>${impuestos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleGuardar}
                disabled={saving || lineas.length === 0 || !clienteId}
                className="w-full"
                size="lg"
              >
                {saving ? 'Guardando...' : 'Guardar Presupuesto'}
              </Button>

              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
