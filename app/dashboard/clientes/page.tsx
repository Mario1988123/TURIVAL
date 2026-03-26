'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listarClientes, obtenerEstadisticasCliente, crearCliente } from '@/lib/services'
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
import { MoreHorizontal, Plus, Search, Filter } from 'lucide-react'
import type { Cliente } from '@/lib/types/erp'

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function cargarClientes() {
      try {
        const resultado = await listarClientes({
          busqueda: busqueda || undefined,
          tipo: filtroTipo as any || undefined,
          pagina,
        })
        setClientes(resultado.clientes)
        setTotal(resultado.total)
      } catch (error) {
        console.error('[v0] Error cargando clientes:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarClientes()
  }, [busqueda, filtroTipo, pagina])

  const getTipoBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      precliente: 'secondary',
      cliente_activo: 'default',
      cliente_recurrente: 'default',
    }
    return variants[tipo] || 'secondary'
  }

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      precliente: 'Pre-cliente',
      cliente_activo: 'Cliente Activo',
      cliente_recurrente: 'Cliente Recurrente',
    }
    return labels[tipo] || tipo
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-slate-600 mt-1">Gestiona tu cartera de clientes</p>
        </div>
        <Link href="/dashboard/clientes/crear">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre, email, teléfono..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    setPagina(0)
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => {
                setFiltroTipo(e.target.value)
                setPagina(0)
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg"
            >
              <option value="">Todos los tipos</option>
              <option value="precliente">Pre-cliente</option>
              <option value="cliente_activo">Cliente Activo</option>
              <option value="cliente_recurrente">Cliente Recurrente</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>{total} clientes encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : clientes.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => (
                    <TableRow key={cliente.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/clientes/${cliente.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {cliente.nombre_comercial}
                        </Link>
                      </TableCell>
                      <TableCell>{cliente.email || '-'}</TableCell>
                      <TableCell>{cliente.telefono || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getTipoBadge(cliente.tipo)}>
                          {getTipoLabel(cliente.tipo)}
                        </Badge>
                      </TableCell>
                      <TableCell>{cliente.ciudad || '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/clientes/${cliente.id}`)}
                            >
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/clientes/${cliente.id}/editar`)}
                            >
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/presupuestos/nuevo?cliente=${cliente.id}`)}
                            >
                              Crear presupuesto
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/pedidos/nuevo?cliente=${cliente.id}`)}
                            >
                              Crear pedido
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 mb-4">No hay clientes que coincidan con tu búsqueda</p>
              <Link href="/dashboard/clientes/crear">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primer cliente
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Mostrando {pagina * 20 + 1} a {Math.min((pagina + 1) * 20, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagina === 0}
              onClick={() => setPagina(Math.max(0, pagina - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={pagina * 20 + 20 >= total}
              onClick={() => setPagina(pagina + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
