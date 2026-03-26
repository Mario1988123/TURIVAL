'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Plus, Search, Eye, Edit2, Trash2 } from 'lucide-react'
import type { Presupuesto } from '@/lib/types/erp'

export default function PresupuestosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  useEffect(() => {
    async function cargarPresupuestos() {
      try {
        let query = supabase
          .from('presupuestos')
          .select('id, numero, estado, total, created_at, clientes(nombre_comercial)')
          .order('created_at', { ascending: false })

        if (busqueda) {
          query = query.or(`numero.ilike.%${busqueda}%,clientes.nombre_comercial.ilike.%${busqueda}%`)
        }

        if (filtroEstado) {
          query = query.eq('estado', filtroEstado)
        }

        const { data, error } = await query.limit(100)

        if (error) throw error
        setPresupuestos(data || [])
      } catch (error) {
        console.error('[v0] Error cargando presupuestos:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarPresupuestos()
  }, [busqueda, filtroEstado])

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      borrador: 'secondary',
      enviado: 'default',
      aceptado: 'default',
      rechazado: 'destructive',
      convertido_pedido: 'outline',
    }
    return variants[estado] || 'secondary'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      borrador: 'Borrador',
      enviado: 'Enviado',
      aceptado: 'Aceptado',
      rechazado: 'Rechazado',
      convertido_pedido: 'Convertido a Pedido',
    }
    return labels[estado] || estado
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este presupuesto?')) return

    try {
      const { error } = await supabase.from('presupuestos').delete().eq('id', id)
      if (error) throw error
      setPresupuestos(presupuestos.filter(p => p.id !== id))
    } catch (error) {
      console.error('[v0] Error eliminando presupuesto:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Presupuestos</h1>
          <p className="text-gray-600 mt-1">Gestiona presupuestos de clientes</p>
        </div>
        <Button onClick={() => router.push('/presupuestos/nuevo')} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por número o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
              <option value="convertido_pedido">Convertido a Pedido</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Presupuestos</CardTitle>
          <CardDescription>
            {presupuestos.length} presupuesto{presupuestos.length !== 1 ? 's' : ''} encontrado{presupuestos.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : presupuestos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay presupuestos que mostrar
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presupuestos.map((presupuesto) => (
                    <TableRow key={presupuesto.id}>
                      <TableCell className="font-semibold">{presupuesto.numero}</TableCell>
                      <TableCell>{presupuesto.clientes?.nombre_comercial || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getEstadoBadge(presupuesto.estado)}>
                          {getEstadoLabel(presupuesto.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell>{presupuesto.total?.toFixed(2)}€</TableCell>
                      <TableCell>
                        {new Date(presupuesto.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/presupuestos/${presupuesto.id}`)}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/presupuestos/${presupuesto.id}/editar`)}
                              className="gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(presupuesto.id)}
                              className="gap-2 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
