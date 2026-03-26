'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Package, Users, FileText, Euro, Calendar, Download } from 'lucide-react'

interface Stats {
  totalPresupuestos: number
  totalPedidos: number
  totalClientes: number
  totalPiezas: number
  ingresosMes: number
  presupuestosAceptados: number
  pedidosCompletados: number
  tasaConversion: number
}

interface MonthlyData {
  mes: string
  presupuestos: number
  pedidos: number
  ingresos: number
}

interface ClienteTop {
  nombre: string
  pedidos: number
  total: number
}

interface ProduccionStats {
  estado: string
  cantidad: number
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function InformesPage() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [stats, setStats] = useState<Stats>({
    totalPresupuestos: 0,
    totalPedidos: 0,
    totalClientes: 0,
    totalPiezas: 0,
    ingresosMes: 0,
    presupuestosAceptados: 0,
    pedidosCompletados: 0,
    tasaConversion: 0,
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [topClientes, setTopClientes] = useState<ClienteTop[]>([])
  const [produccionStats, setProduccionStats] = useState<ProduccionStats[]>([])
  const [recentPresupuestos, setRecentPresupuestos] = useState<any[]>([])
  const [recentPedidos, setRecentPedidos] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadStats()
  }, [periodo])

  async function loadStats() {
    setLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
      const startDate = periodo === 'mes' ? startOfMonth : startOfYear

      // Counts generales
      const [presupuestosCount, pedidosCount, clientesCount, piezasCount] = await Promise.all([
        supabase.from('presupuestos').select('*', { count: 'exact', head: true }),
        supabase.from('pedidos').select('*', { count: 'exact', head: true }),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('piezas').select('*', { count: 'exact', head: true }),
      ])

      // Presupuestos aceptados
      const { count: aceptados } = await supabase
        .from('presupuestos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'aceptado')

      // Pedidos completados
      const { count: completados } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'completado')

      // Ingresos del periodo
      const { data: pagos } = await supabase
        .from('pagos')
        .select('importe')
        .eq('estado', 'pagado')
        .gte('fecha', startDate)

      const ingresos = pagos?.reduce((sum, p) => sum + Number(p.importe || 0), 0) || 0

      // Tasa de conversion
      const totalPres = presupuestosCount.count || 1
      const tasaConversion = ((aceptados || 0) / totalPres) * 100

      setStats({
        totalPresupuestos: presupuestosCount.count || 0,
        totalPedidos: pedidosCount.count || 0,
        totalClientes: clientesCount.count || 0,
        totalPiezas: piezasCount.count || 0,
        ingresosMes: ingresos,
        presupuestosAceptados: aceptados || 0,
        pedidosCompletados: completados || 0,
        tasaConversion,
      })

      // Datos mensuales (ultimos 6 meses)
      const monthlyStats: MonthlyData[] = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const monthName = monthStart.toLocaleDateString('es-ES', { month: 'short' })

        const { count: presCount } = await supabase
          .from('presupuestos')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())

        const { count: pedCount } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())

        const { data: monthPagos } = await supabase
          .from('pagos')
          .select('importe')
          .eq('estado', 'pagado')
          .gte('fecha', monthStart.toISOString())
          .lte('fecha', monthEnd.toISOString())

        const monthIngresos = monthPagos?.reduce((sum, p) => sum + Number(p.importe || 0), 0) || 0

        monthlyStats.push({
          mes: monthName,
          presupuestos: presCount || 0,
          pedidos: pedCount || 0,
          ingresos: monthIngresos,
        })
      }
      setMonthlyData(monthlyStats)

      // Top clientes
      const { data: clientesData } = await supabase
        .from('pedidos')
        .select('cliente_id, total, clientes(nombre_comercial)')
        .eq('estado', 'completado')
        .limit(100)

      const clienteMap = new Map<string, { nombre: string; pedidos: number; total: number }>()
      clientesData?.forEach(p => {
        const id = p.cliente_id
        const nombre = (p.clientes as any)?.nombre_comercial || 'Desconocido'
        const current = clienteMap.get(id) || { nombre, pedidos: 0, total: 0 }
        current.pedidos += 1
        current.total += Number(p.total || 0)
        clienteMap.set(id, current)
      })
      
      const topList = Array.from(clienteMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
      setTopClientes(topList)

      // Produccion por estado
      const estados = ['por_procesar', 'en_preparacion', 'en_lacado', 'en_secado', 'completada', 'rechazada']
      const prodStats: ProduccionStats[] = []
      for (const estado of estados) {
        const { count } = await supabase
          .from('piezas')
          .select('*', { count: 'exact', head: true })
          .eq('estado', estado)
        prodStats.push({ estado, cantidad: count || 0 })
      }
      setProduccionStats(prodStats.filter(p => p.cantidad > 0))

      // Ultimos presupuestos
      const { data: presData } = await supabase
        .from('presupuestos')
        .select('numero, estado, total, created_at, clientes(nombre_comercial)')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentPresupuestos(presData || [])

      // Ultimos pedidos
      const { data: pedData } = await supabase
        .from('pedidos')
        .select('numero, estado, total, created_at, clientes(nombre_comercial)')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentPedidos(pedData || [])

    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportToCSV(data: any[], filename: string) {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      borrador: 'bg-gray-100 text-gray-800',
      enviado: 'bg-blue-100 text-blue-800',
      aceptado: 'bg-green-100 text-green-800',
      rechazado: 'bg-red-100 text-red-800',
      pendiente: 'bg-yellow-100 text-yellow-800',
      en_produccion: 'bg-purple-100 text-purple-800',
      completado: 'bg-green-100 text-green-800',
    }
    return colors[estado] || 'bg-gray-100'
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando informes...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Informes</h1>
          <p className="text-muted-foreground">Analisis y reportes del negocio</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este Mes</SelectItem>
            <SelectItem value="ano">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ingresosMes.toFixed(2)} EUR</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {periodo === 'mes' ? 'Este mes' : 'Este ano'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasaConversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats.presupuestosAceptados} de {stats.totalPresupuestos} presupuestos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClientes}</div>
            <p className="text-xs text-muted-foreground">Clientes registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Piezas Producidas</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPiezas}</div>
            <p className="text-xs text-muted-foreground">{stats.pedidosCompletados} pedidos completados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="produccion">Produccion</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolucion Mensual</CardTitle>
                <CardDescription>Presupuestos y pedidos por mes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="presupuestos" fill="#3b82f6" name="Presupuestos" />
                    <Bar dataKey="pedidos" fill="#22c55e" name="Pedidos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ingresos Mensuales</CardTitle>
                <CardDescription>Evolucion de ingresos</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)} EUR`} />
                    <Line type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} name="Ingresos" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="produccion" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Estado de Piezas</CardTitle>
                <CardDescription>Distribucion por estado de produccion</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={produccionStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ estado, cantidad }) => `${estado}: ${cantidad}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="cantidad"
                      nameKey="estado"
                    >
                      {produccionStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Produccion</CardTitle>
                <CardDescription>Estadisticas generales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {produccionStats.map((stat, index) => (
                    <div key={stat.estado} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="capitalize">{stat.estado.replace('_', ' ')}</span>
                      </div>
                      <span className="font-medium">{stat.cantidad}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Top Clientes</CardTitle>
                <CardDescription>Clientes con mayor volumen de pedidos</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(topClientes, 'top-clientes')}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {topClientes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay datos de clientes</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-right">Total Facturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClientes.map((cliente, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{cliente.nombre}</TableCell>
                        <TableCell className="text-center">{cliente.pedidos}</TableCell>
                        <TableCell className="text-right">{cliente.total.toFixed(2)} EUR</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ultimos Presupuestos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPresupuestos.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell className="font-mono text-sm">{p.numero}</TableCell>
                        <TableCell>{p.clientes?.nombre_comercial || '-'}</TableCell>
                        <TableCell><Badge className={getEstadoColor(p.estado)}>{p.estado}</Badge></TableCell>
                        <TableCell className="text-right">{Number(p.total || 0).toFixed(2)} EUR</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ultimos Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPedidos.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell className="font-mono text-sm">{p.numero}</TableCell>
                        <TableCell>{p.clientes?.nombre_comercial || '-'}</TableCell>
                        <TableCell><Badge className={getEstadoColor(p.estado)}>{p.estado}</Badge></TableCell>
                        <TableCell className="text-right">{Number(p.total || 0).toFixed(2)} EUR</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
