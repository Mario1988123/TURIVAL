'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Search, Plus, Package, Clock, CheckCircle, AlertTriangle, Play, Pause, RotateCcw } from 'lucide-react'

interface Lote {
  id: string
  numero: string
  codigo_lote: string
  estado: string
  cantidad_piezas: number
  fecha_inicio: string
  fecha_estimada_fin: string | null
  observaciones: string | null
  pedido_id: string
  pedidos?: { numero: string; clientes?: { nombre_comercial: string } }
}

interface Pieza {
  id: string
  codigo_unico: string
  codigo_qr: string
  estado: string
  fecha_inicio_produccion: string | null
  fecha_fin_produccion: string | null
  observaciones: string | null
  lote_id: string
  pedido_id: string
  lotes?: { numero: string; codigo_lote: string }
  colores?: { codigo: string; nombre: string }
  tratamientos?: { nombre: string }
}

const ESTADOS_LOTE = [
  { value: 'creado', label: 'Creado', color: 'bg-gray-100 text-gray-800' },
  { value: 'en_produccion', label: 'En Produccion', color: 'bg-blue-100 text-blue-800' },
  { value: 'en_inspeccion', label: 'En Inspeccion', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completado', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'enviado', label: 'Enviado', color: 'bg-emerald-100 text-emerald-800' },
]

const ESTADOS_PIEZA = [
  { value: 'por_procesar', label: 'Por Procesar', color: 'bg-gray-100 text-gray-800' },
  { value: 'en_preparacion', label: 'En Preparacion', color: 'bg-blue-100 text-blue-800' },
  { value: 'en_lacado', label: 'En Lacado', color: 'bg-purple-100 text-purple-800' },
  { value: 'en_secado', label: 'En Secado', color: 'bg-orange-100 text-orange-800' },
  { value: 'en_inspeccion', label: 'En Inspeccion', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completada', label: 'Completada', color: 'bg-green-100 text-green-800' },
  { value: 'rechazada', label: 'Rechazada', color: 'bg-red-100 text-red-800' },
]

export default function ProduccionPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [pedidos, setPedidos] = useState<{id: string; numero: string; clientes?: {nombre_comercial: string}}[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstadoLote, setFiltroEstadoLote] = useState<string>('todos')
  const [filtroEstadoPieza, setFiltroEstadoPieza] = useState<string>('todos')
  const [dialogLoteOpen, setDialogLoteOpen] = useState(false)
  const [dialogPiezaOpen, setDialogPiezaOpen] = useState(false)
  const [selectedLote, setSelectedLote] = useState<string>('')
  
  const [formLote, setFormLote] = useState({ pedido_id: '', cantidad_piezas: 1, observaciones: '' })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [filtroEstadoLote, filtroEstadoPieza])

  async function loadData() {
    setLoading(true)
    try {
      // Cargar lotes
      let queryLotes = supabase
        .from('lotes')
        .select('*, pedidos(numero, clientes(nombre_comercial))')
        .order('created_at', { ascending: false })
      if (filtroEstadoLote !== 'todos') queryLotes = queryLotes.eq('estado', filtroEstadoLote)
      const { data: lotesData } = await queryLotes
      setLotes(lotesData || [])

      // Cargar piezas
      let queryPiezas = supabase
        .from('piezas')
        .select('*, lotes(numero, codigo_lote), colores(codigo, nombre), tratamientos(nombre)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (filtroEstadoPieza !== 'todos') queryPiezas = queryPiezas.eq('estado', filtroEstadoPieza)
      const { data: piezasData } = await queryPiezas
      setPiezas(piezasData || [])

      // Cargar pedidos en produccion para crear lotes
      const { data: pedidosData } = await supabase
        .from('pedidos')
        .select('id, numero, clientes(nombre_comercial)')
        .eq('estado', 'en_produccion')
        .order('numero', { ascending: false })
      setPedidos(pedidosData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function getNextNumeroLote(): Promise<{numero: string; codigo: string}> {
    const year = new Date().getFullYear()
    const { data } = await supabase.from('secuencias').select('ultimo_numero').eq('id', 'lote').single()
    const siguiente = (data?.ultimo_numero || 0) + 1
    await supabase.from('secuencias').update({ ultimo_numero: siguiente }).eq('id', 'lote')
    return {
      numero: `LOT-${year}-${String(siguiente).padStart(5, '0')}`,
      codigo: `L${year}${String(siguiente).padStart(5, '0')}`
    }
  }

  async function getNextNumeroPieza(): Promise<{codigo: string; qr: string}> {
    const year = new Date().getFullYear()
    const { data } = await supabase.from('secuencias').select('ultimo_numero').eq('id', 'pieza').single()
    const siguiente = (data?.ultimo_numero || 0) + 1
    await supabase.from('secuencias').update({ ultimo_numero: siguiente }).eq('id', 'pieza')
    return {
      codigo: `PIE-${year}-${String(siguiente).padStart(6, '0')}`,
      qr: `QR${year}${String(siguiente).padStart(6, '0')}`
    }
  }

  async function handleCreateLote() {
    try {
      const nums = await getNextNumeroLote()
      const { error } = await supabase.from('lotes').insert({
        numero: nums.numero,
        codigo_lote: nums.codigo,
        pedido_id: formLote.pedido_id,
        cantidad_piezas: formLote.cantidad_piezas,
        observaciones: formLote.observaciones || null,
        estado: 'creado',
      })
      if (error) throw error

      // Crear las piezas del lote
      const { data: loteData } = await supabase.from('lotes').select('id').eq('numero', nums.numero).single()
      if (loteData) {
        const piezasToInsert = []
        for (let i = 0; i < formLote.cantidad_piezas; i++) {
          const piezaNums = await getNextNumeroPieza()
          piezasToInsert.push({
            codigo_unico: piezaNums.codigo,
            codigo_qr: piezaNums.qr,
            lote_id: loteData.id,
            pedido_id: formLote.pedido_id,
            estado: 'por_procesar',
          })
        }
        await supabase.from('piezas').insert(piezasToInsert)
      }

      setDialogLoteOpen(false)
      setFormLote({ pedido_id: '', cantidad_piezas: 1, observaciones: '' })
      loadData()
    } catch (error) {
      console.error('Error creating lote:', error)
    }
  }

  async function handleUpdateEstadoLote(loteId: string, nuevoEstado: string) {
    try {
      await supabase.from('lotes').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', loteId)
      loadData()
    } catch (error) {
      console.error('Error updating lote:', error)
    }
  }

  async function handleUpdateEstadoPieza(piezaId: string, nuevoEstado: string) {
    try {
      const updates: Record<string, string | null> = { estado: nuevoEstado, updated_at: new Date().toISOString() }
      if (nuevoEstado === 'en_preparacion' || nuevoEstado === 'en_lacado') {
        updates.fecha_inicio_produccion = new Date().toISOString()
      }
      if (nuevoEstado === 'completada' || nuevoEstado === 'rechazada') {
        updates.fecha_fin_produccion = new Date().toISOString()
      }
      await supabase.from('piezas').update(updates).eq('id', piezaId)
      loadData()
    } catch (error) {
      console.error('Error updating pieza:', error)
    }
  }

  async function handleIniciarLote(loteId: string) {
    await handleUpdateEstadoLote(loteId, 'en_produccion')
    // Actualizar todas las piezas del lote a en_preparacion
    await supabase.from('piezas').update({ estado: 'en_preparacion', fecha_inicio_produccion: new Date().toISOString() }).eq('lote_id', loteId)
    loadData()
  }

  const getEstadoLoteBadge = (estado: string) => {
    const e = ESTADOS_LOTE.find(x => x.value === estado)
    return <Badge className={e?.color || ''}>{e?.label || estado}</Badge>
  }

  const getEstadoPiezaBadge = (estado: string) => {
    const e = ESTADOS_PIEZA.find(x => x.value === estado)
    return <Badge className={e?.color || ''}>{e?.label || estado}</Badge>
  }

  const statsLotes = {
    creados: lotes.filter(l => l.estado === 'creado').length,
    en_produccion: lotes.filter(l => l.estado === 'en_produccion').length,
    completados: lotes.filter(l => l.estado === 'completado').length,
    total_piezas: lotes.reduce((sum, l) => sum + l.cantidad_piezas, 0),
  }

  const statsPiezas = {
    por_procesar: piezas.filter(p => p.estado === 'por_procesar').length,
    en_proceso: piezas.filter(p => ['en_preparacion', 'en_lacado', 'en_secado'].includes(p.estado)).length,
    completadas: piezas.filter(p => p.estado === 'completada').length,
    rechazadas: piezas.filter(p => p.estado === 'rechazada').length,
  }

  const filteredLotes = lotes.filter(l => 
    l.numero.toLowerCase().includes(search.toLowerCase()) ||
    l.codigo_lote.toLowerCase().includes(search.toLowerCase()) ||
    l.pedidos?.numero.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPiezas = piezas.filter(p => 
    p.codigo_unico.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo_qr.toLowerCase().includes(search.toLowerCase()) ||
    p.lotes?.codigo_lote.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produccion</h1>
          <p className="text-muted-foreground">Gestion de lotes y piezas en produccion</p>
        </div>
        <Dialog open={dialogLoteOpen} onOpenChange={setDialogLoteOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Lote</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Lote</DialogTitle>
              <DialogDescription>Crea un lote de produccion con sus piezas</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Pedido *</Label>
                <Select value={formLote.pedido_id} onValueChange={v => setFormLote({...formLote, pedido_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecciona pedido" /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map(p => (<SelectItem key={p.id} value={p.id}>{p.numero}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cantidad de Piezas *</Label>
                <Input type="number" min="1" value={formLote.cantidad_piezas} onChange={e => setFormLote({...formLote, cantidad_piezas: parseInt(e.target.value) || 1})} />
              </div>
              <div className="grid gap-2">
                <Label>Observaciones</Label>
                <Input value={formLote.observaciones} onChange={e => setFormLote({...formLote, observaciones: e.target.value})} placeholder="Notas del lote..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogLoteOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateLote} disabled={!formLote.pedido_id}>Crear Lote</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="lotes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lotes">Lotes ({lotes.length})</TabsTrigger>
          <TabsTrigger value="piezas">Piezas ({piezas.length})</TabsTrigger>
          <TabsTrigger value="panel">Panel de Control</TabsTrigger>
        </TabsList>

        <TabsContent value="lotes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Creados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{statsLotes.creados}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">En Produccion</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{statsLotes.en_produccion}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Completados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{statsLotes.completados}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Piezas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{statsLotes.total_piezas}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Lotes de Produccion</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar lote..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filtroEstadoLote} onValueChange={setFiltroEstadoLote}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTADOS_LOTE.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (<div className="text-center py-8">Cargando...</div>) : filteredLotes.length === 0 ? (<div className="text-center py-8 text-muted-foreground">No hay lotes</div>) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Fecha Inicio</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLotes.map(lote => (
                      <TableRow key={lote.id}>
                        <TableCell className="font-mono font-medium">{lote.codigo_lote}</TableCell>
                        <TableCell>{lote.pedidos?.numero || '-'}</TableCell>
                        <TableCell>{lote.pedidos?.clientes?.nombre_comercial || '-'}</TableCell>
                        <TableCell>{getEstadoLoteBadge(lote.estado)}</TableCell>
                        <TableCell>{lote.cantidad_piezas}</TableCell>
                        <TableCell>{new Date(lote.fecha_inicio).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {lote.estado === 'creado' && (
                              <Button variant="ghost" size="sm" onClick={() => handleIniciarLote(lote.id)} title="Iniciar produccion">
                                <Play className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {lote.estado === 'en_produccion' && (
                              <Button variant="ghost" size="sm" onClick={() => handleUpdateEstadoLote(lote.id, 'en_inspeccion')} title="Enviar a inspeccion">
                                <CheckCircle className="h-4 w-4 text-yellow-600" />
                              </Button>
                            )}
                            {lote.estado === 'en_inspeccion' && (
                              <Button variant="ghost" size="sm" onClick={() => handleUpdateEstadoLote(lote.id, 'completado')} title="Marcar completado">
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
        </TabsContent>

        <TabsContent value="piezas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Por Procesar</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{statsPiezas.por_procesar}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">En Proceso</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{statsPiezas.en_proceso}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Completadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{statsPiezas.completadas}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Rechazadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{statsPiezas.rechazadas}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Piezas en Produccion</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar pieza o QR..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filtroEstadoPieza} onValueChange={setFiltroEstadoPieza}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTADOS_PIEZA.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (<div className="text-center py-8">Cargando...</div>) : filteredPiezas.length === 0 ? (<div className="text-center py-8 text-muted-foreground">No hay piezas</div>) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Tratamiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPiezas.map(pieza => (
                      <TableRow key={pieza.id}>
                        <TableCell className="font-mono text-sm">{pieza.codigo_unico}</TableCell>
                        <TableCell className="font-mono text-xs">{pieza.codigo_qr}</TableCell>
                        <TableCell>{pieza.lotes?.codigo_lote || '-'}</TableCell>
                        <TableCell>{pieza.colores ? `${pieza.colores.codigo} - ${pieza.colores.nombre}` : '-'}</TableCell>
                        <TableCell>{pieza.tratamientos?.nombre || '-'}</TableCell>
                        <TableCell>{getEstadoPiezaBadge(pieza.estado)}</TableCell>
                        <TableCell>
                          <Select value={pieza.estado} onValueChange={v => handleUpdateEstadoPieza(pieza.id, v)}>
                            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{ESTADOS_PIEZA.map(e => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}</SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="panel" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Produccion</CardTitle>
                <CardDescription>Estado actual de la planta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Lotes en produccion</span>
                    <span>{statsLotes.en_produccion} / {lotes.length}</span>
                  </div>
                  <Progress value={lotes.length > 0 ? (statsLotes.en_produccion / lotes.length) * 100 : 0} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Piezas completadas</span>
                    <span>{statsPiezas.completadas} / {piezas.length}</span>
                  </div>
                  <Progress value={piezas.length > 0 ? (statsPiezas.completadas / piezas.length) * 100 : 0} className="bg-green-100" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tasa de rechazo</span>
                    <span>{piezas.length > 0 ? ((statsPiezas.rechazadas / piezas.length) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <Progress value={piezas.length > 0 ? (statsPiezas.rechazadas / piezas.length) * 100 : 0} className="bg-red-100" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas</CardTitle>
                <CardDescription>Situaciones que requieren atencion</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLotes.creados > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-md mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">{statsLotes.creados} lotes pendientes de iniciar</span>
                  </div>
                )}
                {statsPiezas.rechazadas > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">{statsPiezas.rechazadas} piezas rechazadas</span>
                  </div>
                )}
                {statsLotes.creados === 0 && statsPiezas.rechazadas === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Sin alertas activas</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
