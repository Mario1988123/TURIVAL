'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, Plus, Eye, Package, CheckCircle, Clock, Truck } from 'lucide-react'

interface Pedido {
  id: string
  numero: string
  estado: string
  fecha: string
  fecha_entrega_estimada: string | null
  prioridad: string
  subtotal: number
  descuento: number
  impuestos: number
  total: number
  observaciones: string | null
  cliente_id: string
  clientes?: { nombre_comercial: string }
}

interface Cliente {
  id: string
  nombre_comercial: string
}

const ESTADOS_PEDIDO = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  { value: 'en_produccion', label: 'En Produccion', color: 'bg-purple-100 text-purple-800' },
  { value: 'completado', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'entregado', label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
]

const PRIORIDADES = [
  { value: 'baja', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800' },
]

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [formData, setFormData] = useState({
    cliente_id: '',
    fecha_entrega_estimada: '',
    prioridad: 'normal',
    observaciones: '',
  })

  const supabase = createClient()

  useEffect(() => {
    loadPedidos()
    loadClientes()
  }, [filtroEstado])

  async function loadPedidos() {
    setLoading(true)
    try {
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nombre_comercial)')
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query
      if (error) throw error
      setPedidos(data || [])
    } catch (error) {
      console.error('Error loading pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre_comercial')
      .order('nombre_comercial')
    setClientes(data || [])
  }

  async function getNextNumero(): Promise<string> {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('secuencias')
      .select('ultimo_numero')
      .eq('id', 'pedido')
      .single()

    const siguiente = (data?.ultimo_numero || 0) + 1
    
    await supabase
      .from('secuencias')
      .update({ ultimo_numero: siguiente })
      .eq('id', 'pedido')

    return `PED-${year}-${String(siguiente).padStart(5, '0')}`
  }

  async function handleCreatePedido() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const numero = await getNextNumero()

      const { error } = await supabase.from('pedidos').insert({
        numero,
        cliente_id: formData.cliente_id,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
        prioridad: formData.prioridad,
        observaciones: formData.observaciones || null,
        estado: 'pendiente',
        subtotal: 0,
        descuento: 0,
        impuestos: 0,
        total: 0,
        user_id: user.id,
      })

      if (error) throw error

      setDialogOpen(false)
      setFormData({ cliente_id: '', fecha_entrega_estimada: '', prioridad: 'normal', observaciones: '' })
      loadPedidos()
    } catch (error) {
      console.error('Error creating pedido:', error)
    }
  }

  async function handleUpdateEstado(pedidoId: string, nuevoEstado: string) {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('id', pedidoId)

      if (error) throw error
      loadPedidos()
    } catch (error) {
      console.error('Error updating estado:', error)
    }
  }

  const filteredPedidos = pedidos.filter(p => 
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.clientes?.nombre_comercial.toLowerCase().includes(search.toLowerCase())
  )

  const getEstadoBadge = (estado: string) => {
    const e = ESTADOS_PEDIDO.find(x => x.value === estado)
    return <Badge className={e?.color || ''}>{e?.label || estado}</Badge>
  }

  const getPrioridadBadge = (prioridad: string) => {
    const p = PRIORIDADES.find(x => x.value === prioridad)
    return <Badge variant="outline" className={p?.color || ''}>{p?.label || prioridad}</Badge>
  }

  const stats = {
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    en_produccion: pedidos.filter(p => p.estado === 'en_produccion').length,
    completados: pedidos.filter(p => p.estado === 'completado').length,
    total: pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0),
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Gestion de pedidos de produccion</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Pedido</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Pedido</DialogTitle>
              <DialogDescription>Introduce los datos del nuevo pedido</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <Select value={formData.cliente_id} onValueChange={v => setFormData({...formData, cliente_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre_comercial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fecha Entrega Estimada</Label>
                <Input 
                  type="date" 
                  value={formData.fecha_entrega_estimada}
                  onChange={e => setFormData({...formData, fecha_entrega_estimada: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prioridad</Label>
                <Select value={formData.prioridad} onValueChange={v => setFormData({...formData, prioridad: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Observaciones</Label>
                <Textarea 
                  value={formData.observaciones}
                  onChange={e => setFormData({...formData, observaciones: e.target.value})}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreatePedido} disabled={!formData.cliente_id}>Crear Pedido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En Produccion</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.en_produccion}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toFixed(2)} EUR</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por numero o cliente..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_PEDIDO.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando pedidos...</div>
          ) : filteredPedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay pedidos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entrega Est.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">{pedido.numero}</TableCell>
                    <TableCell>{pedido.clientes?.nombre_comercial || '-'}</TableCell>
                    <TableCell>{getEstadoBadge(pedido.estado)}</TableCell>
                    <TableCell>{getPrioridadBadge(pedido.prioridad)}</TableCell>
                    <TableCell>{new Date(pedido.fecha).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell>{pedido.fecha_entrega_estimada ? new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-ES') : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{Number(pedido.total).toFixed(2)} EUR</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedPedido(pedido); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {pedido.estado === 'pendiente' && (
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateEstado(pedido.id, 'confirmado')}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {pedido.estado === 'confirmado' && (
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateEstado(pedido.id, 'en_produccion')}>
                            <Package className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pedido {selectedPedido?.numero}</DialogTitle>
            <DialogDescription>Detalles del pedido</DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">Cliente</Label><p className="font-medium">{selectedPedido.clientes?.nombre_comercial}</p></div>
                <div><Label className="text-muted-foreground">Estado</Label><p>{getEstadoBadge(selectedPedido.estado)}</p></div>
                <div><Label className="text-muted-foreground">Prioridad</Label><p>{getPrioridadBadge(selectedPedido.prioridad)}</p></div>
                <div><Label className="text-muted-foreground">Fecha</Label><p>{new Date(selectedPedido.fecha).toLocaleDateString('es-ES')}</p></div>
                <div><Label className="text-muted-foreground">Entrega Estimada</Label><p>{selectedPedido.fecha_entrega_estimada ? new Date(selectedPedido.fecha_entrega_estimada).toLocaleDateString('es-ES') : 'No definida'}</p></div>
                <div><Label className="text-muted-foreground">Total</Label><p className="text-xl font-bold">{Number(selectedPedido.total).toFixed(2)} EUR</p></div>
              </div>
              {selectedPedido.observaciones && (<div><Label className="text-muted-foreground">Observaciones</Label><p className="mt-1 p-3 bg-muted rounded-md">{selectedPedido.observaciones}</p></div>)}
              <div className="flex gap-2 pt-4 border-t">
                <Label className="text-muted-foreground">Cambiar estado:</Label>
                <Select value={selectedPedido.estado} onValueChange={v => { handleUpdateEstado(selectedPedido.id, v); setSelectedPedido({...selectedPedido, estado: v}); }}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_PEDIDO.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
