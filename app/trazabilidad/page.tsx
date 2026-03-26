'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, QrCode, Package, Clock, CheckCircle, AlertTriangle, Truck, FileText, User, Calendar, MapPin } from 'lucide-react'

interface PiezaDetail {
  id: string
  codigo_unico: string
  codigo_qr: string
  estado: string
  fecha_inicio_produccion: string | null
  fecha_fin_produccion: string | null
  observaciones: string | null
  lotes?: {
    numero: string
    codigo_lote: string
    estado: string
    cantidad_piezas: number
    pedidos?: {
      numero: string
      estado: string
      fecha: string
      clientes?: {
        nombre_comercial: string
        nif: string
        email: string
        telefono: string
      }
    }
  }
  colores?: { codigo: string; nombre: string }
  tratamientos?: { nombre: string }
  acabados?: { nombre: string }
  productos?: { codigo: string; nombre: string }
}

interface LoteDetail {
  id: string
  numero: string
  codigo_lote: string
  estado: string
  cantidad_piezas: number
  fecha_inicio: string
  fecha_estimada_fin: string | null
  observaciones: string | null
  pedidos?: {
    numero: string
    estado: string
    clientes?: { nombre_comercial: string }
  }
  piezas?: Array<{
    id: string
    codigo_unico: string
    codigo_qr: string
    estado: string
  }>
}

interface FaseProduccion {
  id: string
  fase: string
  estado: string
  fecha_inicio: string
  fecha_fin: string | null
  operario: string | null
  observaciones: string | null
}

const ESTADOS_PIEZA = [
  { value: 'por_procesar', label: 'Por Procesar', color: 'bg-gray-100 text-gray-800', icon: Clock },
  { value: 'en_preparacion', label: 'En Preparacion', color: 'bg-blue-100 text-blue-800', icon: Package },
  { value: 'en_lacado', label: 'En Lacado', color: 'bg-purple-100 text-purple-800', icon: Package },
  { value: 'en_secado', label: 'En Secado', color: 'bg-orange-100 text-orange-800', icon: Clock },
  { value: 'en_inspeccion', label: 'En Inspeccion', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  { value: 'completada', label: 'Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  { value: 'rechazada', label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
]

export default function TrazabilidadPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'pieza' | 'lote'>('pieza')
  const [loading, setLoading] = useState(false)
  const [pieza, setPieza] = useState<PiezaDetail | null>(null)
  const [lote, setLote] = useState<LoteDetail | null>(null)
  const [fases, setFases] = useState<FaseProduccion[]>([])
  const [notFound, setNotFound] = useState(false)

  const supabase = createClient()

  async function handleSearch() {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setNotFound(false)
    setPieza(null)
    setLote(null)
    setFases([])

    try {
      if (searchType === 'pieza') {
        // Buscar pieza por codigo o QR
        const { data: piezaData, error } = await supabase
          .from('piezas')
          .select(`
            *,
            lotes(numero, codigo_lote, estado, cantidad_piezas, pedidos(numero, estado, fecha, clientes(nombre_comercial, nif, email, telefono))),
            colores(codigo, nombre),
            tratamientos(nombre),
            acabados(nombre),
            productos(codigo, nombre)
          `)
          .or(`codigo_unico.ilike.%${searchQuery}%,codigo_qr.ilike.%${searchQuery}%`)
          .single()

        if (error || !piezaData) {
          setNotFound(true)
        } else {
          setPieza(piezaData)
          // Cargar fases de produccion
          const { data: fasesData } = await supabase
            .from('fases_produccion')
            .select('*')
            .eq('pieza_id', piezaData.id)
            .order('fecha_inicio', { ascending: true })
          setFases(fasesData || [])
        }
      } else {
        // Buscar lote por codigo
        const { data: loteData, error } = await supabase
          .from('lotes')
          .select(`
            *,
            pedidos(numero, estado, clientes(nombre_comercial)),
            piezas(id, codigo_unico, codigo_qr, estado)
          `)
          .or(`numero.ilike.%${searchQuery}%,codigo_lote.ilike.%${searchQuery}%`)
          .single()

        if (error || !loteData) {
          setNotFound(true)
        } else {
          setLote(loteData)
        }
      }
    } catch (error) {
      console.error('Error searching:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const e = ESTADOS_PIEZA.find(x => x.value === estado)
    return <Badge className={e?.color || 'bg-gray-100'}>{e?.label || estado}</Badge>
  }

  const getEstadoIcon = (estado: string) => {
    const e = ESTADOS_PIEZA.find(x => x.value === estado)
    const Icon = e?.icon || Clock
    return <Icon className="h-5 w-5" />
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trazabilidad</h1>
        <p className="text-muted-foreground">Consulta el estado y historial de piezas y lotes</p>
      </div>

      {/* Buscador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Buscar por Codigo
          </CardTitle>
          <CardDescription>Introduce el codigo de la pieza, QR o codigo de lote</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'pieza' | 'lote')} className="w-auto">
              <TabsList>
                <TabsTrigger value="pieza">Pieza/QR</TabsTrigger>
                <TabsTrigger value="lote">Lote</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={searchType === 'pieza' ? "Codigo pieza o QR..." : "Codigo de lote..."}
                className="pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado: No encontrado */}
      {notFound && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-medium text-red-800">No se encontraron resultados</p>
                <p className="text-sm text-red-600">Verifica el codigo e intenta de nuevo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado: Pieza */}
      {pieza && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Pieza: {pieza.codigo_unico}
                  </CardTitle>
                  <CardDescription>QR: {pieza.codigo_qr}</CardDescription>
                </div>
                {getEstadoBadge(pieza.estado)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Informacion de la Pieza</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Producto:</strong> {pieza.productos?.nombre || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full" style={{backgroundColor: pieza.colores?.codigo || '#ccc'}} />
                      <span className="text-sm"><strong>Color:</strong> {pieza.colores ? `${pieza.colores.codigo} - ${pieza.colores.nombre}` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Tratamiento:</strong> {pieza.tratamientos?.nombre || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Acabado:</strong> {pieza.acabados?.nombre || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Tiempos de Produccion</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Inicio:</strong> {pieza.fecha_inicio_produccion ? new Date(pieza.fecha_inicio_produccion).toLocaleString('es-ES') : 'No iniciado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Fin:</strong> {pieza.fecha_fin_produccion ? new Date(pieza.fecha_fin_produccion).toLocaleString('es-ES') : 'En proceso'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Lote y Pedido</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Lote:</strong> {pieza.lotes?.codigo_lote || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Pedido:</strong> {pieza.lotes?.pedidos?.numero || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><strong>Cliente:</strong> {pieza.lotes?.pedidos?.clientes?.nombre_comercial || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {pieza.observaciones && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <strong>Observaciones:</strong> {pieza.observaciones}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline de Fases */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Produccion</CardTitle>
              <CardDescription>Fases completadas en el proceso de produccion</CardDescription>
            </CardHeader>
            <CardContent>
              {fases.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No hay fases registradas</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {fases.map((fase, index) => (
                      <div key={fase.id} className="relative pl-10">
                        <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${fase.estado === 'completada' ? 'bg-green-500' : fase.estado === 'en_proceso' ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                        <div className="bg-muted p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{fase.fase}</span>
                            <Badge variant="outline">{fase.estado}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>Inicio: {new Date(fase.fecha_inicio).toLocaleString('es-ES')}</span>
                            {fase.fecha_fin && <span className="ml-4">Fin: {new Date(fase.fecha_fin).toLocaleString('es-ES')}</span>}
                          </div>
                          {fase.operario && <p className="text-sm mt-1">Operario: {fase.operario}</p>}
                          {fase.observaciones && <p className="text-sm text-muted-foreground mt-1">{fase.observaciones}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultado: Lote */}
      {lote && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Lote: {lote.codigo_lote}
                  </CardTitle>
                  <CardDescription>Numero: {lote.numero}</CardDescription>
                </div>
                {getEstadoBadge(lote.estado)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Informacion del Lote</h4>
                  <p><strong>Piezas:</strong> {lote.cantidad_piezas}</p>
                  <p><strong>Inicio:</strong> {new Date(lote.fecha_inicio).toLocaleDateString('es-ES')}</p>
                  {lote.fecha_estimada_fin && <p><strong>Fin estimado:</strong> {new Date(lote.fecha_estimada_fin).toLocaleDateString('es-ES')}</p>}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Pedido</h4>
                  <p><strong>Numero:</strong> {lote.pedidos?.numero || 'N/A'}</p>
                  <p><strong>Estado:</strong> {lote.pedidos?.estado || 'N/A'}</p>
                  <p><strong>Cliente:</strong> {lote.pedidos?.clientes?.nombre_comercial || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Progreso</h4>
                  <p><strong>Completadas:</strong> {lote.piezas?.filter(p => p.estado === 'completada').length || 0} / {lote.cantidad_piezas}</p>
                  <p><strong>En proceso:</strong> {lote.piezas?.filter(p => ['en_preparacion', 'en_lacado', 'en_secado', 'en_inspeccion'].includes(p.estado)).length || 0}</p>
                  <p><strong>Rechazadas:</strong> {lote.piezas?.filter(p => p.estado === 'rechazada').length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Piezas del lote */}
          <Card>
            <CardHeader>
              <CardTitle>Piezas del Lote</CardTitle>
              <CardDescription>{lote.piezas?.length || 0} piezas en total</CardDescription>
            </CardHeader>
            <CardContent>
              {!lote.piezas || lote.piezas.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No hay piezas en este lote</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lote.piezas.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.codigo_unico}</TableCell>
                        <TableCell className="font-mono text-sm">{p.codigo_qr}</TableCell>
                        <TableCell>{getEstadoBadge(p.estado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
