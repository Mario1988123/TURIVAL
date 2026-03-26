'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, QrCode } from 'lucide-react'

interface Pieza {
  id: string
  codigo_unico: string
  codigo_qr: string
  estado: string
  pedido_id: string
  lote_id: string
  color_id: string | null
  tratamiento_id: string | null
  dimensiones: string | null
  fecha_inicio_produccion: string | null
  fecha_fin_produccion: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
  colores?: { nombre: string; codigo: string }
  tratamientos?: { nombre: string }
  pedidos?: { numero: string }
  lotes?: { numero: string }
}

interface FaseProduccion {
  id: string
  pieza_id: string
  numero_fase: number
  descripcion: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  usuario_id: string | null
  observaciones: string | null
}

export default function TrazabilidadPage() {
  const supabase = createClient()

  const [busqueda, setBusqueda] = useState('')
  const [pieza, setPieza] = useState<Pieza | null>(null)
  const [fases, setFases] = useState<FaseProduccion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tipoSearch, setTipoSearch] = useState<'codigo' | 'qr'>('codigo')

  async function buscarPieza() {
    if (!busqueda.trim()) {
      setError('Ingresa un código para buscar')
      return
    }

    try {
      setLoading(true)
      setError('')
      setPieza(null)
      setFases([])

      let query = supabase
        .from('piezas')
        .select(`
          *,
          colores(nombre, codigo),
          tratamientos(nombre),
          pedidos(numero),
          lotes(numero)
        `)

      if (tipoSearch === 'codigo') {
        query = query.eq('codigo_unico', busqueda.trim())
      } else {
        query = query.eq('codigo_qr', busqueda.trim())
      }

      const { data: piezaData, error: piezaErr } = await query.single()

      if (piezaErr || !piezaData) {
        setError('Pieza no encontrada')
        return
      }

      setPieza(piezaData)

      const { data: fasesData, error: fasesErr } = await supabase
        .from('fases_produccion')
        .select('*')
        .eq('pieza_id', piezaData.id)
        .order('numero_fase', { ascending: true })

      if (!fasesErr) {
        setFases(fasesData || [])
      }
    } catch (err) {
      console.error('Error buscando pieza:', err)
      setError('Error al buscar pieza')
    } finally {
      setLoading(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    const estadoMap: Record<string, string> = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'en_proceso': 'bg-blue-100 text-blue-800',
      'completada': 'bg-green-100 text-green-800',
      'pausada': 'bg-orange-100 text-orange-800',
      'cancelada': 'bg-red-100 text-red-800',
    }
    return estadoMap[estado] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Trazabilidad</h1>
        <p className="text-gray-600">Busca piezas por código único o código QR</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Pieza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tipoSearch} onValueChange={(v) => setTipoSearch(v as 'codigo' | 'qr')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="codigo">Código Único</TabsTrigger>
              <TabsTrigger value="qr">Código QR</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder={tipoSearch === 'codigo' ? 'Ej: PIEZA-2026-00001' : 'Escanea código QR...'}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarPieza()}
                className="pl-8"
                autoFocus
              />
            </div>
            <Button onClick={buscarPieza} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {pieza && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Información de la Pieza</CardTitle>
                  <p className="text-sm text-gray-600">Código: {pieza.codigo_unico}</p>
                </div>
                {pieza.codigo_qr && (
                  <div className="flex items-center gap-2">
                    <QrCode className="w-6 h-6" />
                    <code className="text-xs">{pieza.codigo_qr}</code>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <Badge className={getEstadoColor(pieza.estado)}>{pieza.estado}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pedido</p>
                  <p className="font-medium">{pieza.pedidos?.numero || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lote</p>
                  <p className="font-medium">{pieza.lotes?.numero || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Color</p>
                  <p className="font-medium">{pieza.colores?.nombre || 'Sin color'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tratamiento</p>
                  <p className="font-medium">{pieza.tratamientos?.nombre || 'Sin tratamiento'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dimensiones</p>
                  <p className="font-medium">{pieza.dimensiones || 'N/A'}</p>
                </div>
              </div>

              {pieza.observaciones && (
                <div>
                  <p className="text-sm text-gray-600">Observaciones</p>
                  <p className="bg-gray-50 p-2 rounded text-sm">{pieza.observaciones}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600">Inicio Producción</p>
                  <p className="font-medium">
                    {pieza.fecha_inicio_produccion
                      ? new Date(pieza.fecha_inicio_produccion).toLocaleString()
                      : 'Pendiente'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fin Producción</p>
                  <p className="font-medium">
                    {pieza.fecha_fin_produccion
                      ? new Date(pieza.fecha_fin_produccion).toLocaleString()
                      : 'En proceso'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {fases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Fases de Producción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fases.map((fase, idx) => (
                    <div key={fase.id} className="flex gap-4 pb-4 border-b last:border-0">
                      <div className="min-w-12">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-800">
                          {fase.numero_fase}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{fase.descripcion}</p>
                            <Badge className={getEstadoColor(fase.estado)} className="mt-1">
                              {fase.estado}
                            </Badge>
                          </div>
                          <div className="text-right text-sm text-gray-600">
                            {fase.fecha_inicio && (
                              <p>Inicio: {new Date(fase.fecha_inicio).toLocaleString()}</p>
                            )}
                            {fase.fecha_fin && (
                              <p>Fin: {new Date(fase.fecha_fin).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        {fase.observaciones && (
                          <p className="text-sm text-gray-600 mt-2">{fase.observaciones}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
