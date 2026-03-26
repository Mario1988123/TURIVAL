'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Search, Plus, Eye, Printer, Truck, CheckCircle, Clock, FileText } from 'lucide-react'

interface Albaran {
  id: string
  numero: string
  estado: string
  fecha: string
  fecha_entrega: string | null
  cantidad_piezas: number | null
  observaciones: string | null
  entregado_por: string | null
  recibido_por: string | null
  pedido_id: string
  lote_id: string | null
  pedidos?: { numero: string; clientes?: { nombre_comercial: string; direccion: string; telefono: string } }
  lotes?: { codigo_lote: string }
}

interface Pedido {
  id: string
  numero: string
  clientes?: { nombre_comercial: string }
}

interface Lote {
  id: string
  codigo_lote: string
  pedido_id: string
}

const ESTADOS_ALBARAN = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'entregado', label: 'Entregado', color: 'bg-green-100 text-green-800' },
  { value: 'parcial', label: 'Entrega Parcial', color: 'bg-orange-100 text-orange-800' },
  { value: 'devuelto', label: 'Devuelto', color: 'bg-red-100 text-red-800' },
]

export default function AlbaranesPage() {
  const [albaranes, setAlbaranes] = useState<Albaran[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [selectedAlbaran, setSelectedAlbaran] = useState<Albaran | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    pedido_id: '',
    lote_id: '',
    cantidad_piezas: 0,
    fecha_entrega: '',
    entregado_por: '',
    observaciones: '',
  })

  const supabase = createClient()

  useEffect(() => {
    loadAlbaranes()
    loadPedidos()
  }, [filtroEstado])

  async function loadAlbaranes() {
    setLoading(true)
    try {
      let query = supabase
        .from('albaranes')
        .select('*, pedidos(numero, clientes(nombre_comercial, direccion, telefono)), lotes(codigo_lote)')
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query
      if (error) throw error
      setAlbaranes(data || [])
    } catch (error) {
      console.error('Error loading albaranes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, clientes(nombre_comercial)')
      .in('estado', ['en_produccion', 'completado'])
      .order('numero', { ascending: false })
    setPedidos(data || [])
  }

  async function loadLotesForPedido(pedidoId: string) {
    const { data } = await supabase
      .from('lotes')
      .select('id, codigo_lote, pedido_id')
      .eq('pedido_id', pedidoId)
      .eq('estado', 'completado')
    setLotes(data || [])
  }

  async function getNextNumero(): Promise<string> {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('secuencias')
      .select('ultimo_numero')
      .eq('id', 'albaran')
      .single()

    const siguiente = (data?.ultimo_numero || 0) + 1
    
    await supabase
      .from('secuencias')
      .update({ ultimo_numero: siguiente })
      .eq('id', 'albaran')

    return `ALB-${year}-${String(siguiente).padStart(5, '0')}`
  }

  async function handleCreateAlbaran() {
    try {
      const numero = await getNextNumero()

      const { error } = await supabase.from('albaranes').insert({
        numero,
        pedido_id: formData.pedido_id,
        lote_id: formData.lote_id || null,
        cantidad_piezas: formData.cantidad_piezas || null,
        fecha_entrega: formData.fecha_entrega || null,
        entregado_por: formData.entregado_por || null,
        observaciones: formData.observaciones || null,
        estado: 'pendiente',
      })

      if (error) throw error

      setDialogOpen(false)
      setFormData({ pedido_id: '', lote_id: '', cantidad_piezas: 0, fecha_entrega: '', entregado_por: '', observaciones: '' })
      loadAlbaranes()
    } catch (error) {
      console.error('Error creating albaran:', error)
    }
  }

  async function handleUpdateEstado(albaranId: string, nuevoEstado: string) {
    try {
      const { error } = await supabase
        .from('albaranes')
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('id', albaranId)

      if (error) throw error
      loadAlbaranes()
    } catch (error) {
      console.error('Error updating estado:', error)
    }
  }

  function handlePrint(albaran: Albaran) {
    setSelectedAlbaran(albaran)
    setPrintDialogOpen(true)
  }

  function printAlbaran() {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Albaran ${selectedAlbaran?.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; color: #666; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-box { padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .info-box h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; }
            .info-box p { margin: 5px 0; }
            .details { margin-bottom: 30px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details th, .details td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .details th { background: #f5f5f5; }
            .firma { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
            .firma-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const filteredAlbaranes = albaranes.filter(a => 
    a.numero.toLowerCase().includes(search.toLowerCase()) ||
    a.pedidos?.numero.toLowerCase().includes(search.toLowerCase()) ||
    a.pedidos?.clientes?.nombre_comercial.toLowerCase().includes(search.toLowerCase())
  )

  const getEstadoBadge = (estado: string) => {
    const e = ESTADOS_ALBARAN.find(x => x.value === estado)
    return <Badge className={e?.color || ''}>{e?.label || estado}</Badge>
  }

  const stats = {
    pendientes: albaranes.filter(a => a.estado === 'pendiente').length,
    entregados: albaranes.filter(a => a.estado === 'entregado').length,
    parciales: albaranes.filter(a => a.estado === 'parcial').length,
    total: albaranes.length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Albaranes</h1>
          <p className="text-muted-foreground">Gestion de albaranes de entrega</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Albaran</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Albaran</DialogTitle>
              <DialogDescription>Genera un albaran de entrega</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Pedido *</Label>
                <Select value={formData.pedido_id} onValueChange={v => { setFormData({...formData, pedido_id: v, lote_id: ''}); loadLotesForPedido(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona pedido" /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map(p => (<SelectItem key={p.id} value={p.id}>{p.numero} - {p.clientes?.nombre_comercial}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {lotes.length > 0 && (
                <div className="grid gap-2">
                  <Label>Lote (opcional)</Label>
                  <Select value={formData.lote_id} onValueChange={v => setFormData({...formData, lote_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecciona lote" /></SelectTrigger>
                    <SelectContent>
                      {lotes.map(l => (<SelectItem key={l.id} value={l.id}>{l.codigo_lote}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cantidad Piezas</Label>
                  <Input type="number" min="0" value={formData.cantidad_piezas} onChange={e => setFormData({...formData, cantidad_piezas: parseInt(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha Entrega</Label>
                  <Input type="date" value={formData.fecha_entrega} onChange={e => setFormData({...formData, fecha_entrega: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Entregado Por</Label>
                <Input value={formData.entregado_por} onChange={e => setFormData({...formData, entregado_por: e.target.value})} placeholder="Nombre del repartidor..." />
              </div>
              <div className="grid gap-2">
                <Label>Observaciones</Label>
                <Textarea value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Notas adicionales..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateAlbaran} disabled={!formData.pedido_id}>Crear Albaran</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pendientes</CardTitle><Clock className="h-4 w-4 text-yellow-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pendientes}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Entregados</CardTitle><CheckCircle className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.entregados}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Parciales</CardTitle><Truck className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.parciales}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle><FileText className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Listado de Albaranes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por numero, pedido o cliente..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_ALBARAN.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (<div className="text-center py-8">Cargando...</div>) : filteredAlbaranes.length === 0 ? (<div className="text-center py-8 text-muted-foreground">No hay albaranes</div>) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Piezas</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlbaranes.map(albaran => (
                  <TableRow key={albaran.id}>
                    <TableCell className="font-medium">{albaran.numero}</TableCell>
                    <TableCell>{albaran.pedidos?.numero || '-'}</TableCell>
                    <TableCell>{albaran.pedidos?.clientes?.nombre_comercial || '-'}</TableCell>
                    <TableCell>{albaran.lotes?.codigo_lote || '-'}</TableCell>
                    <TableCell>{getEstadoBadge(albaran.estado)}</TableCell>
                    <TableCell>{albaran.cantidad_piezas || '-'}</TableCell>
                    <TableCell>{new Date(albaran.fecha).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handlePrint(albaran)} title="Imprimir">
                          <Printer className="h-4 w-4" />
                        </Button>
                        {albaran.estado === 'pendiente' && (
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateEstado(albaran.id, 'entregado')} title="Marcar entregado">
                            <CheckCircle className="h-4 w-4 text-green-600" />
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

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vista Previa - Albaran {selectedAlbaran?.numero}</DialogTitle>
          </DialogHeader>
          
          <div ref={printRef} className="p-4 bg-white">
            <div className="header">
              <h1>ALBARAN DE ENTREGA</h1>
              <p>Numero: <strong>{selectedAlbaran?.numero}</strong></p>
              <p>Fecha: {selectedAlbaran?.fecha ? new Date(selectedAlbaran.fecha).toLocaleDateString('es-ES') : '-'}</p>
            </div>

            <div className="info-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
              <div className="info-box" style={{padding: '15px', background: '#f5f5f5', borderRadius: '8px'}}>
                <h3 style={{margin: '0 0 10px 0', fontSize: '14px', color: '#666'}}>DATOS DEL PEDIDO</h3>
                <p><strong>Pedido:</strong> {selectedAlbaran?.pedidos?.numero}</p>
                <p><strong>Lote:</strong> {selectedAlbaran?.lotes?.codigo_lote || 'N/A'}</p>
                <p><strong>Piezas:</strong> {selectedAlbaran?.cantidad_piezas || 'N/A'}</p>
              </div>
              <div className="info-box" style={{padding: '15px', background: '#f5f5f5', borderRadius: '8px'}}>
                <h3 style={{margin: '0 0 10px 0', fontSize: '14px', color: '#666'}}>DATOS DEL CLIENTE</h3>
                <p><strong>{selectedAlbaran?.pedidos?.clientes?.nombre_comercial}</strong></p>
                <p>{selectedAlbaran?.pedidos?.clientes?.direccion || ''}</p>
                <p>Tel: {selectedAlbaran?.pedidos?.clientes?.telefono || ''}</p>
              </div>
            </div>

            {selectedAlbaran?.observaciones && (
              <div style={{marginBottom: '20px', padding: '10px', background: '#fff9e6', borderRadius: '4px'}}>
                <strong>Observaciones:</strong> {selectedAlbaran.observaciones}
              </div>
            )}

            <div className="firma" style={{marginTop: '60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px'}}>
              <div style={{borderTop: '1px solid #333', paddingTop: '10px', textAlign: 'center'}}>
                <p>Entregado por: {selectedAlbaran?.entregado_por || '_________________'}</p>
              </div>
              <div style={{borderTop: '1px solid #333', paddingTop: '10px', textAlign: 'center'}}>
                <p>Recibido por: {selectedAlbaran?.recibido_por || '_________________'}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>Cerrar</Button>
            <Button onClick={printAlbaran}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
