'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { obtenerCliente, obtenerEstadisticasCliente, cambiarTipoCliente } from '@/lib/services'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building, FileText, ShoppingCart } from 'lucide-react'
import type { Cliente } from '@/lib/types/erp'

export default function ClienteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string
  
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCliente() {
      try {
        const [clienteData, statsData] = await Promise.all([
          obtenerCliente(clienteId),
          obtenerEstadisticasCliente(clienteId),
        ])
        setCliente(clienteData)
        setStats(statsData)
      } catch (error) {
        console.error('Error loading cliente:', error)
      } finally {
        setLoading(false)
      }
    }
    loadCliente()
  }, [clienteId])

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      precliente: 'Pre-cliente',
      cliente_activo: 'Cliente Activo',
      cliente_recurrente: 'Cliente Recurrente',
    }
    return labels[tipo] || tipo
  }

  const getTipoBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      precliente: 'secondary',
      cliente_activo: 'default',
      cliente_recurrente: 'default',
    }
    return variants[tipo] || 'secondary'
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="link" onClick={() => router.push('/dashboard/clientes')}>
          Volver a clientes
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{cliente.nombre_comercial}</h1>
              <Badge variant={getTipoBadge(cliente.tipo)}>{getTipoLabel(cliente.tipo)}</Badge>
            </div>
            {cliente.razon_social && (
              <p className="text-muted-foreground">{cliente.razon_social}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/presupuestos/nuevo?cliente=${clienteId}`)}>
            <FileText className="h-4 w-4 mr-2" /> Nuevo Presupuesto
          </Button>
          <Button onClick={() => router.push(`/dashboard/clientes/${clienteId}/editar`)}>
            <Edit className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_presupuestos || 0}</div>
            <p className="text-sm text-muted-foreground">Presupuestos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_pedidos || 0}</div>
            <p className="text-sm text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{(stats?.facturacion_total || 0).toFixed(2)} EUR</div>
            <p className="text-sm text-muted-foreground">Facturacion Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.pedidos_pendientes || 0}</div>
            <p className="text-sm text-muted-foreground">Pedidos Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informacion</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="referencias">Referencias</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Datos de contacto */}
            <Card>
              <CardHeader>
                <CardTitle>Datos de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cliente.persona_contacto && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.persona_contacto}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline">{cliente.email}</a>
                  </div>
                )}
                {cliente.telefono && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${cliente.telefono}`} className="text-blue-600 hover:underline">{cliente.telefono}</a>
                  </div>
                )}
                {cliente.direccion && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <p>{cliente.direccion}</p>
                      <p>{cliente.codigo_postal} {cliente.ciudad}</p>
                      {cliente.provincia && <p>{cliente.provincia}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Datos fiscales y comerciales */}
            <Card>
              <CardHeader>
                <CardTitle>Datos Comerciales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cliente.cif_nif && (
                  <div>
                    <p className="text-sm text-muted-foreground">CIF/NIF</p>
                    <p className="font-medium">{cliente.cif_nif}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Condiciones de Pago</p>
                  <p className="font-medium">{cliente.condiciones_pago || '30 dias'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Descuento General</p>
                  <p className="font-medium">{cliente.descuento_general || 0}%</p>
                </div>
                {cliente.notas && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{cliente.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="presupuestos">
          <Card>
            <CardHeader>
              <CardTitle>Presupuestos del Cliente</CardTitle>
              <CardDescription>Historial de presupuestos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Funcionalidad en desarrollo
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos del Cliente</CardTitle>
              <CardDescription>Historial de pedidos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Funcionalidad en desarrollo
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referencias">
          <Card>
            <CardHeader>
              <CardTitle>Referencias del Cliente</CardTitle>
              <CardDescription>Productos y referencias habituales</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Funcionalidad en desarrollo
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
