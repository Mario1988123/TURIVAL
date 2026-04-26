'use client'

/**
 * UI de albaranes (Capa 7). Listado con filtro por estado y
 * creación de albarán desde pedido.
 *
 * Interacciones:
 *   - Lista con filtro por estado (todos | borrador | impreso | entregado).
 *   - Dialog "Nuevo desde pedido" → elige pedido con piezas completadas.
 *   - Acciones por fila: marcar impreso, marcar entregado, eliminar (solo borrador).
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, FileText, Printer, Truck, Trash2, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import {
  accionCrearAlbaranDesdePedido,
  accionCambiarEstadoAlbaran,
  accionEliminarAlbaran,
} from '@/lib/actions/albaranes'
import type { AlbaranListado, EstadoAlbaran } from '@/lib/services/albaranes'

interface PedidoElegible {
  id: string
  numero: string
  cliente_id: string
  cliente_nombre: string
  piezas_completadas: number
}

interface Props {
  albaranes: AlbaranListado[]
  pedidosElegibles: PedidoElegible[]
}

const ESTADO_CLASES: Record<EstadoAlbaran, string> = {
  borrador:  'bg-slate-100 text-slate-700 border-slate-300',
  impreso:   'bg-blue-100 text-blue-800 border-blue-300',
  entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function AlbaranesCliente({ albaranes, pedidosElegibles }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pedidoIdParam = searchParams.get('pedido_id') ?? ''
  const [, startTransition] = useTransition()
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoAlbaran>('todos')
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [autoOpen, setAutoOpen] = useState<boolean>(!!pedidoIdParam)
  // si llegamos con ?pedido_id, abrimos el dialog auto y pre-rellenamos.
  // Mario punto 28+26: tras "PEDIDO TERMINADO" se va aqui directo

  const lista = filtroEstado === 'todos'
    ? albaranes
    : albaranes.filter(a => a.estado === filtroEstado)

  async function cambiarEstado(albaran_id: string, estado: EstadoAlbaran) {
    setEnviandoId(albaran_id)
    try {
      const res = await accionCambiarEstadoAlbaran({ albaran_id, estado })
      if (res.ok) startTransition(() => router.refresh())
      else alert(`Error: ${res.error}`)
    } finally {
      setEnviandoId(null)
    }
  }

  async function eliminar(albaran_id: string) {
    if (!confirm('¿Eliminar este albarán? Solo se puede si está en borrador.')) return
    setEnviandoId(albaran_id)
    try {
      const res = await accionEliminarAlbaran(albaran_id)
      if (res.ok) startTransition(() => router.refresh())
      else alert(`Error: ${res.error}`)
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos ({albaranes.length})</SelectItem>
              <SelectItem value="borrador">Borrador ({albaranes.filter(a => a.estado === 'borrador').length})</SelectItem>
              <SelectItem value="impreso">Impreso ({albaranes.filter(a => a.estado === 'impreso').length})</SelectItem>
              <SelectItem value="entregado">Entregado ({albaranes.filter(a => a.estado === 'entregado').length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogNuevoAlbaran
          pedidos={pedidosElegibles}
          pedidoIdInicial={pedidoIdParam}
          autoOpen={autoOpen}
          onCierre={() => setAutoOpen(false)}
          onCreado={() => startTransition(() => router.refresh())}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No hay albaranes {filtroEstado !== 'todos' ? `en estado "${filtroEstado}"` : ''}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha entrega</TableHead>
                  <TableHead className="text-center">Piezas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs font-semibold">{a.numero}</TableCell>
                    <TableCell className="text-sm">{a.pedido_numero}</TableCell>
                    <TableCell className="text-sm">{a.cliente_nombre}</TableCell>
                    <TableCell className="text-sm">{formatearFecha(a.fecha_entrega)}</TableCell>
                    <TableCell className="text-center text-sm">{a.piezas_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTADO_CLASES[a.estado]}>
                        {a.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/albaranes/${a.id}`}>
                          <Button size="sm" variant="ghost" title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {a.estado === 'borrador' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cambiarEstado(a.id, 'impreso')}
                              disabled={enviandoId === a.id}
                              title="Marcar impreso"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => eliminar(a.id)}
                              disabled={enviandoId === a.id}
                              title="Eliminar"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {a.estado === 'impreso' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cambiarEstado(a.id, 'entregado')}
                            disabled={enviandoId === a.id}
                            title="Marcar entregado"
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                        )}
                        {enviandoId === a.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- Dialog de creación ---

function DialogNuevoAlbaran({
  pedidos,
  pedidoIdInicial,
  autoOpen,
  onCierre,
  onCreado,
}: {
  pedidos: PedidoElegible[]
  pedidoIdInicial?: string
  autoOpen?: boolean
  onCierre?: () => void
  onCreado: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [pedidoId, setPedidoId] = useState<string>(pedidoIdInicial ?? '')
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [obs, setObs] = useState<string>('')
  const [enviando, setEnviando] = useState(false)

  // Auto-abrir dialog si el padre nos lo pide (Mario llegando con ?pedido_id=X)
  useEffect(() => {
    if (autoOpen) {
      setAbierto(true)
      if (pedidoIdInicial) setPedidoId(pedidoIdInicial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, pedidoIdInicial])

  const elegibles = pedidos.filter(p => p.piezas_completadas > 0)

  async function crear() {
    if (!pedidoId) return
    setEnviando(true)
    try {
      const res = await accionCrearAlbaranDesdePedido({
        pedido_id: pedidoId,
        fecha_entrega: fecha,
        observaciones: obs || undefined,
      })
      if (res.ok) {
        setAbierto(false)
        setPedidoId(''); setObs('')
        onCreado()
      } else {
        alert(`No se pudo crear: ${res.error}`)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) onCierre?.() }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo albarán
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo albarán</DialogTitle>
          <DialogDescription>
            Se crea desde un pedido incluyendo las piezas completadas o en almacén listas para entregar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Pedido</label>
            <Select value={pedidoId} onValueChange={setPedidoId}>
              <SelectTrigger><SelectValue placeholder={elegibles.length === 0 ? 'No hay pedidos con piezas listas' : 'Elige un pedido'} /></SelectTrigger>
              <SelectContent>
                {elegibles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.numero} · {p.cliente_nombre} · {p.piezas_completadas} pieza(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Fecha de entrega</label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Observaciones</label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Opcional" />
          </div>
          {elegibles.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <FileText className="mr-1 inline h-3 w-3" />
              No hay pedidos con piezas completadas. Completa piezas en Producción antes de crear un albarán.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={crear} disabled={!pedidoId || enviando}>
            {enviando ? 'Creando…' : 'Crear albarán'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
