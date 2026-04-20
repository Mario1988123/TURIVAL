'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, FileText } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type {
  EstadoPedido,
  PrioridadPedido,
} from '@/lib/services/pedidos'

// =============================================================
// Tipos del listado
// =============================================================

interface PedidoListItem {
  id: string
  numero: string
  fecha_creacion: string
  fecha_entrega_estimada: string | null
  estado: EstadoPedido
  prioridad: PrioridadPedido
  subtotal: number | null
  total: number | null
  cliente?: { id: string; nombre_comercial: string } | null
  presupuesto_origen?: { id: string; numero: string } | null
}

interface Props {
  pedidos: PedidoListItem[]
}

// =============================================================
// Mapas de labels y colores (badges)
// =============================================================

const ESTADOS_LABELS: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  en_produccion: 'En producción',
  completado: 'Completado',
  entregado: 'Entregado',
  facturado: 'Facturado',
  cancelado: 'Cancelado',
}

const ESTADOS_COLORS: Record<EstadoPedido, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-300',
  confirmado: 'bg-blue-100 text-blue-800 border-blue-300',
  en_produccion: 'bg-amber-100 text-amber-800 border-amber-300',
  completado: 'bg-teal-100 text-teal-800 border-teal-300',
  entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  facturado: 'bg-green-200 text-green-900 border-green-400',
  cancelado: 'bg-rose-100 text-rose-800 border-rose-300',
}

const PRIORIDADES_LABELS: Record<PrioridadPedido, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const PRIORIDADES_COLORS: Record<PrioridadPedido, string> = {
  baja: 'bg-slate-100 text-slate-600 border-slate-300',
  normal: 'bg-slate-50 text-slate-700 border-slate-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-300',
  urgente: 'bg-red-100 text-red-800 border-red-300',
}

// =============================================================
// Helpers de formato (locale es-ES)
// =============================================================

function formatoFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  try {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatoEuros(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(n))
}

// =============================================================
// Componente principal
// =============================================================

export function PedidosListaCliente({ pedidos }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | EstadoPedido>(
    'todos'
  )
  const [prioridadFiltro, setPrioridadFiltro] = useState<
    'todos' | PrioridadPedido
  >('todos')

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (estadoFiltro !== 'todos' && p.estado !== estadoFiltro) return false
      if (prioridadFiltro !== 'todos' && p.prioridad !== prioridadFiltro)
        return false
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase()
        const matchNumero = p.numero?.toLowerCase().includes(q)
        const matchCliente = p.cliente?.nombre_comercial
          ?.toLowerCase()
          .includes(q)
        if (!matchNumero && !matchCliente) return false
      }
      return true
    })
  }, [pedidos, busqueda, estadoFiltro, prioridadFiltro])

  const totalPedidos = pedidos.length
  const mostrandose = filtrados.length

  return (
    <div className="space-y-4">
      {/* Barra de filtros + acción */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número o cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={estadoFiltro}
            onValueChange={(v) => setEstadoFiltro(v as 'todos' | EstadoPedido)}
          >
            <SelectTrigger className="md:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {(Object.keys(ESTADOS_LABELS) as EstadoPedido[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {ESTADOS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={prioridadFiltro}
            onValueChange={(v) =>
              setPrioridadFiltro(v as 'todos' | PrioridadPedido)
            }
          >
            <SelectTrigger className="md:w-[170px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las prioridades</SelectItem>
              {(Object.keys(PRIORIDADES_LABELS) as PrioridadPedido[]).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {PRIORIDADES_LABELS[k]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <Button asChild>
          <Link href="/presupuestos">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pedido (desde presupuesto)
          </Link>
        </Button>
      </div>

      {/* Contador */}
      <div className="text-sm text-muted-foreground">
        Mostrando {mostrandose} de {totalPedidos}{' '}
        {totalPedidos === 1 ? 'pedido' : 'pedidos'}
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Entrega prev.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && pedidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <FileText className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                  <div className="font-medium">Aún no hay pedidos</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Convierte un presupuesto aceptado a pedido desde{' '}
                    <Link
                      className="underline hover:text-foreground"
                      href="/presupuestos"
                    >
                      /presupuestos
                    </Link>
                    .
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filtrados.length === 0 && pedidos.length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  Sin resultados para los filtros aplicados.
                </TableCell>
              </TableRow>
            )}

            {filtrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-medium">
                  {p.numero}
                </TableCell>
                <TableCell>{formatoFecha(p.fecha_creacion)}</TableCell>
                <TableCell>{p.cliente?.nombre_comercial ?? '—'}</TableCell>
                <TableCell>
                  {p.presupuesto_origen ? (
                    <Link
                      href={`/presupuestos/${p.presupuesto_origen.id}`}
                      className="font-mono text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      {p.presupuesto_origen.numero}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatoEuros(p.total)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={ESTADOS_COLORS[p.estado]}
                  >
                    {ESTADOS_LABELS[p.estado]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={PRIORIDADES_COLORS[p.prioridad]}
                  >
                    {PRIORIDADES_LABELS[p.prioridad]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatoFecha(p.fecha_entrega_estimada)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/pedidos/${p.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
