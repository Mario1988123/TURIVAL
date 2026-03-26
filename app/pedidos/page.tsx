'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Plus, Truck } from 'lucide-react'

interface Pedido {
  id: string
  numero: string
  estado: string
  total: number
  fecha: string
  cliente_id: string
  clientes?: { nombre_comercial: string }
}

interface Presupuesto {
  id: string
  numero: string
  total: number
  cliente_id: string
  clientes?: { nombre_comercial: string }
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  { value: 'en_produccion', label: 'En Produccion', color: 'bg-purple-100 text-purple-800' },
  { value: 'completado', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'entregado', label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
]

export default function PedidosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'pedidos' | 'presupuestos'>('pedidos')

  useEffect(() => {
    loadPedidos()
  }, [])

  async function loadPedidos() {
    try {
      setLoading(true)

      let query = supabase
        .from('pedidos')
        .select('id, numero, estado, total, fecha, cliente_id, clientes(nombre_comercial)')
        .order('fecha', { ascending: false })

      if (filtroEstado) {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error: err } = await query

      if (err) throw err
      setPedidos(data || [])

      // Cargar presupuestos
      const { data: presupData, error: presupErr } = await supabase
        .from('presupuestos')
        .select('id, numero, total, cliente_id, clientes(nombre_comercial)')
        .eq('estado', 'borrador')
        .order('created_at', { ascending: false })

      if (presupErr) throw presupErr
      setPresupuestos(presupData || [])
    } catch (err) {
      console.error('Error cargando pedidos:', err)
      setError('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  async function convertirPresupuestoAPedido(presupuestoId: string) {
    try {
      const { data: presupuesto, error: presupErr } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('id', presupuestoId)
        .single()

      if (presupErr) throw presupErr

      const { data: secuencia } = await supabase
        .from('secuencias')
        .select('ultimo_numero')
        .eq('id', 'pedido')
        .single()

      const numero = `PED-2026-${String((secuencia?.ultimo_numero || 0) + 1).padStart(5, '0')}`

      const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos')
        .insert({
          numero,
          cliente_id: presupuesto.cliente_id,
          presupuesto_id: presupuestoId,
          estado: 'pendiente',
          subtotal: presupuesto.subtotal,
          impuestos: presupuesto.impuestos,
          total: presupuesto.total,
          fecha: new Date().toISOString(),
        })
        .select()
        .single()

      if (pedidoErr) throw pedidoErr

      // Copiar lineas del presupuesto
      const { data: lineasPresup } = await supabase
        .from('lineas_presupuesto')
        .select('*')
        .eq('presupuesto_id', presupuestoId)

      for (const linea of lineasPresup || []) {
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

      await supabase
        .from('secuencias')
        .update({ ultimo_numero: (secuencia?.ultimo_numero || 0) + 1 })
        .eq('id', 'pedido')

      setError('')
      loadPedidos()
    } catch (err) {
      console.error('Error convirtiendo presupuesto:', err)
      setError('Error al convertir presupuesto')
    }
  }

  const pedidosFiltrados = pedidos.filter(p => {
    const texto = (p.numero + ' ' + (p.clientes?.nombre_comercial || '')).toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  if (loading) return <div className="p-6">Cargando...</div>

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-gray-600">Gestiona los pedidos de producción</p>
        </div>
        <Button onClick={() => router.push('/pedidos/nuevo')}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2 font-medium ${tab === 'pedidos' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Pedidos ({pedidos.length})
        </button>
        <button
          onClick={() => setTab('presupuestos')}
          className={`px-4 py-2 font-medium ${tab === 'presupuestos' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Convertir de Presupuesto ({presupuestos.length})
        </button>
      </div>

      {tab === 'pedidos' ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Listado de Pedidos</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por número o cliente..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {ESTADOS.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pedidosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay pedidos para mostrar
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFiltrados.map(pedido => {
                    const estadoInfo = ESTADOS.find(e => e.value === pedido.estado)
                    return (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-medium">{pedido.numero}</TableCell>
                        <TableCell>{pedido.clientes?.nombre_comercial}</TableCell>
                        <TableCell>
                          {estadoInfo && (
                            <Badge className={estadoInfo.color}>{estadoInfo.label}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">${pedido.total.toFixed(2)}</TableCell>
                        <TableCell>{new Date(pedido.fecha).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/pedidos/${pedido.id}`)}
                          >
                            <Truck className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Convertir Presupuestos a Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {presupuestos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay presupuestos disponibles
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presupuestos.map(presup => (
                    <TableRow key={presup.id}>
                      <TableCell className="font-medium">{presup.numero}</TableCell>
                      <TableCell>{presup.clientes?.nombre_comercial}</TableCell>
                      <TableCell className="text-right">${presup.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => convertirPresupuestoAPedido(presup.id)}
                        >
                          Convertir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
