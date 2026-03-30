'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, FileText, Factory, Truck, Printer } from 'lucide-react'
import Link from 'next/link'

interface Pedido {
  id: string
  numero: string
  estado: string
  prioridad: string
  fecha: string
  fecha_entrega: string | null
  subtotal: number
  impuestos: number
  total: number
  observaciones: string | null
  clientes: {
    id: string
    nombre_comercial: string
    razon_social: string
    email: string
    telefono: string
    direccion: string
  } | null
  presupuestos: {
    id: string
    numero: string
  } | null
}

interface LineaPedido {
  id: string
  numero_linea: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad: string
  productos: {
    id: string
    nombre: string
    codigo: string
  } | null
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  { value: 'en_produccion', label: 'En Producción', color: 'bg-purple-100 text-purple-800' },
  { value: 'completado', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'entregado', label: 'Entregado', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
]

export default function PedidoDetalle() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPedido()
  }, [id])

  async function loadPedido() {
    try {
      setLoading(true)

      const { data: pedidoData, error: pedidoErr } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes (id, nombre_comercial, razon_social, email, telefono, direccion),
          presupuestos (id, numero)
        `)
        .eq('id', id)
        .single()

      if (pedidoErr) throw pedidoErr
      setPedido(pedidoData)

      const { data: lineasData } = await supabase
        .from('lineas_pedido')
        .select(`
          *,
          productos (id, nombre, codigo)
        `)
        .eq('pedido_id', id)
        .order('numero_linea')

      setLineas(lineasData || [])
    } catch (err) {
      console.error('Error cargando pedido:', err)
      setError('Error al cargar pedido')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(nuevoEstado: string) {
    if (!pedido) return

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id)

      if (error) throw error

      setPedido({ ...pedido, estado: nuevoEstado })
    } catch (err) {
      console.error('Error actualizando estado:', err)
      setError('Error al actualizar estado')
    } finally {
      setSaving(false)
    }
  }

  async function pasarAProduccion() {
    if (!pedido) return

    try {
      setSaving(true)

      // Cambiar estado a en_produccion
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: 'en_produccion' })
        .eq('id', id)

      if (error) throw error

      setPedido({ ...pedido, estado: 'en_produccion' })
      
      // Redirigir a producción
      router.push('/produccion')
    } catch (err) {
      console.error('Error pasando a producción:', err)
      setError('Error al pasar a producción')
    } finally {
      setSaving(false)
    }
  }

  function getEstadoBadge(estado: string) {
    const estadoInfo = ESTADOS.find(e => e.value === estado)
    return estadoInfo ? (
      <Badge className={estadoInfo.color}>{estadoInfo.label}</Badge>
    ) : (
      <Badge>{estado}</Badge>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>Pedido no encontrado</AlertDescription>
        </Alert>
        <Link href="/pedidos">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a pedidos
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pedidos">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{pedido.numero}</h1>
            <p className="text-sm text-muted-foreground">
              Creado el {new Date(pedido.fecha).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getEstadoBadge(pedido.estado)}
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos del pedido */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Datos del Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{pedido.clientes?.nombre_comercial || 'Sin cliente'}</p>
                {pedido.clientes?.razon_social && (
                  <p className="text-sm text-muted-foreground">{pedido.clientes.razon_social}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto origen</p>
                {pedido.presupuestos ? (
                  <Link href={`/presupuestos/${pedido.presupuestos.id}`} className="text-blue-600 hover:underline">
                    {pedido.presupuestos.numero}
                  </Link>
                ) : (
                  <p className="text-muted-foreground">Pedido directo</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prioridad</p>
                <p className="font-medium capitalize">{pedido.prioridad || 'Normal'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de entrega</p>
                <p className="font-medium">
                  {pedido.fecha_entrega 
                    ? new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')
                    : 'Sin definir'
                  }
                </p>
              </div>
            </div>

            {pedido.clientes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Contacto</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {pedido.clientes.email && <p>Email: {pedido.clientes.email}</p>}
                  {pedido.clientes.telefono && <p>Tel: {pedido.clientes.telefono}</p>}
                  {pedido.clientes.direccion && <p className="col-span-2">Dir: {pedido.clientes.direccion}</p>}
                </div>
              </div>
            )}

            {pedido.observaciones && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
                <p>{pedido.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones y totales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{pedido.subtotal?.toFixed(2) || '0.00'}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (21%)</span>
                <span>{pedido.impuestos?.toFixed(2) || '0.00'}€</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-blue-600">{pedido.total?.toFixed(2) || '0.00'}€</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Cambiar estado</label>
                <Select 
                  value={pedido.estado} 
                  onValueChange={cambiarEstado}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pedido.estado === 'confirmado' && (
                <Button 
                  className="w-full" 
                  onClick={pasarAProduccion}
                  disabled={saving}
                >
                  <Factory className="w-4 h-4 mr-2" />
                  Pasar a Producción
                </Button>
              )}

              {pedido.estado === 'completado' && (
                <Link href={`/albaranes?pedido=${pedido.id}`}>
                  <Button className="w-full" variant="outline">
                    <Truck className="w-4 h-4 mr-2" />
                    Generar Albarán
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Líneas del pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Líneas del Pedido ({lineas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Este pedido no tiene líneas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell className="text-muted-foreground">{linea.numero_linea}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{linea.productos?.nombre || 'Producto eliminado'}</p>
                        {linea.productos?.codigo && (
                          <p className="text-xs text-muted-foreground">{linea.productos.codigo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {linea.cantidad} {linea.unidad}
                    </TableCell>
                    <TableCell className="text-right">{linea.precio_unitario?.toFixed(2)}€</TableCell>
                    <TableCell className="text-right font-medium">{linea.subtotal?.toFixed(2)}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
