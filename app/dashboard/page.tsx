'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    presupuestos_pendientes: 0,
    pedidos_en_produccion: 0,
    piezas_completadas_hoy: 0,
    ingresos_mes: 0,
  })
  const [recentItems, setRecentItems] = useState({
    presupuestos: [],
    pedidos: [],
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const today = new Date().toISOString().split('T')[0]

      try {
        // Presupuestos pendientes
        const { count: presupuestos_count } = await supabase
          .from('presupuestos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'borrador')

        // Pedidos en producción
        const { count: pedidos_count } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'en_produccion')

        // Piezas completadas hoy
        const { count: piezas_count } = await supabase
          .from('piezas')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'completada')
          .gte('updated_at', `${today}T00:00:00`)
          .lt('updated_at', `${today}T23:59:59`)

        // Ingresos del mes
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split('T')[0]

        const { data: pagos } = await supabase
          .from('pagos')
          .select('importe')
          .eq('estado', 'pagado')
          .gte('fecha', monthStart)

        const total_pagos = pagos?.reduce((sum, p) => sum + Number(p.importe || 0), 0) || 0

        // Ultimos presupuestos
        const { data: ultimos_presupuestos } = await supabase
          .from('presupuestos')
          .select('id, numero, estado, total, created_at, clientes(nombre_comercial)')
          .order('created_at', { ascending: false })
          .limit(5)

        // Ultimos pedidos
        const { data: ultimos_pedidos } = await supabase
          .from('pedidos')
          .select('id, numero, estado, total, created_at, clientes(nombre_comercial)')
          .order('created_at', { ascending: false })
          .limit(5)

        setStats({
          presupuestos_pendientes: presupuestos_count || 0,
          pedidos_en_produccion: pedidos_count || 0,
          piezas_completadas_hoy: piezas_count || 0,
          ingresos_mes: total_pagos,
        })

        setRecentItems({
          presupuestos: ultimos_presupuestos || [],
          pedidos: ultimos_pedidos || [],
        })
      } catch (error) {
        console.error('[v0] Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuestos Pendientes</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.presupuestos_pendientes}</div>
            <p className="text-xs text-slate-500">Requieren revisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos en Producción</CardTitle>
            <ShoppingCart className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pedidos_en_produccion}</div>
            <p className="text-xs text-slate-500">En proceso activo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Piezas Hoy</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.piezas_completadas_hoy}</div>
            <p className="text-xs text-slate-500">Completadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ingresos_mes.toFixed(0)}€</div>
            <p className="text-xs text-slate-500">Pagos recibidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Presupuestos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Últimos Presupuestos</CardTitle>
                <CardDescription>Últimas 5 solicitudes</CardDescription>
              </div>
              <Link href="/presupuestos">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : recentItems.presupuestos.length > 0 ? (
              <div className="space-y-3">
                {recentItems.presupuestos.map((pres: any) => (
                  <div
                    key={pres.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{pres.numero}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {pres.clientes?.nombre_comercial}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge
                        variant={
                          pres.estado === 'aceptado'
                            ? 'default'
                            : pres.estado === 'rechazado'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {pres.estado}
                      </Badge>
                      <span className="font-semibold text-sm">
                        {pres.total?.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No hay presupuestos</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Pedidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Últimos Pedidos</CardTitle>
                <CardDescription>Últimas 5 órdenes</CardDescription>
              </div>
              <Link href="/pedidos">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : recentItems.pedidos.length > 0 ? (
              <div className="space-y-3">
                {recentItems.pedidos.map((ped: any) => (
                  <div
                    key={ped.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ped.numero}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {ped.clientes?.nombre_comercial}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge
                        variant={
                          ped.estado === 'entregado'
                            ? 'default'
                            : ped.estado === 'cancelado'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {ped.estado}
                      </Badge>
                      <span className="font-semibold text-sm">
                        {ped.total?.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No hay pedidos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Link href="/presupuestos/crear">
              <Button className="w-full" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Nuevo Presupuesto
              </Button>
            </Link>
            <Link href="/pedidos/crear">
              <Button className="w-full" variant="outline">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </Link>
            <Link href="/produccion">
              <Button className="w-full" variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Producción
              </Button>
            </Link>
            <Link href="/ocr">
              <Button className="w-full" variant="outline">
                <AlertCircle className="h-4 w-4 mr-2" />
                Subir OCR
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
