'use client'

/**
 * UI informe margen real (Capa 8).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TrendingUp, TrendingDown, Eye, Loader2, Target } from 'lucide-react'
import { accionDetalleMargenPedido } from '@/lib/actions/informe-margen'
import type { ResumenMargenPedido, DetalleMargenPedido } from '@/lib/services/informe-margen'

interface Props { items: ResumenMargenPedido[] }

function eur(n: number): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function pctDelta(actual: number | null, objetivo: number, delta: number | null) {
  if (actual == null || delta == null) return <span className="text-slate-400">—</span>
  // Color: verde si >= objetivo, ámbar si -5..0, rojo si <-5
  const color = delta >= 0
    ? 'text-emerald-700'
    : delta > -5
      ? 'text-amber-700'
      : 'text-red-700'
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Target
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {actual}% <span className="text-[10px] text-slate-500">/ {objetivo}%</span>
    </span>
  )
}

function badgeEstado(estado: string) {
  const cls = estado === 'entregado' || estado === 'facturado'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : estado === 'completado'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : estado === 'en_produccion'
        ? 'bg-purple-100 text-purple-800 border-purple-300'
        : 'bg-slate-100 text-slate-700 border-slate-300'
  return <Badge variant="outline" className={cls}>{estado}</Badge>
}

export default function MargenRealCliente({ items }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [detalleData, setDetalleData] = useState<DetalleMargenPedido | null>(null)
  const [cargando, setCargando] = useState(false)

  async function verDetalle(pedido_id: string) {
    setDetalleId(pedido_id)
    setDetalleData(null)
    setCargando(true)
    try {
      const res = await accionDetalleMargenPedido(pedido_id)
      if (res.ok) setDetalleData(res.detalle)
    } finally {
      setCargando(false)
    }
  }

  // KPIs agregados
  const totalIngresos = items.reduce((a, x) => a + x.ingresos_eur, 0)
  const totalCostes = items.reduce((a, x) => a + x.coste_total_real_eur, 0)
  const margenAgregado = totalIngresos - totalCostes
  const margenAgregadoPct = totalIngresos > 0 ? (margenAgregado / totalIngresos) * 100 : null
  const objetivo = items[0]?.margen_objetivo_porcentaje ?? 30

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Margen real por pedido</h1>
          <p className="text-sm text-slate-600">
            Comparativa ingresos vs coste MO real + coste material real. Margen objetivo {objetivo}%.
          </p>
        </div>
        <Button variant="outline" onClick={() => startTransition(() => router.refresh())}>
          Actualizar
        </Button>
      </div>

      {/* KPIs agregados */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Ingresos totales</div>
            <div className="text-xl font-bold">{eur(totalIngresos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Coste real total</div>
            <div className="text-xl font-bold">{eur(totalCostes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Margen real</div>
            <div className={`text-xl font-bold ${margenAgregado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {eur(margenAgregado)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Margen % (real / objetivo)</div>
            <div className="text-xl font-bold">
              {margenAgregadoPct != null ? `${margenAgregadoPct.toFixed(1)}%` : '—'}{' '}
              <span className="text-sm font-normal text-slate-500">/ {objetivo}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>{items.length} pedido(s) con actividad real.</span>
        <span className="ml-auto">Pedidos sin consumo real aún salen con coste 0 y margen = ingresos.</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No hay pedidos facturables aún. Confirma pedidos y completa tareas para empezar a ver márgenes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Coste MO</TableHead>
                  <TableHead className="text-right">Coste material</TableHead>
                  <TableHead className="text-right">Coste total</TableHead>
                  <TableHead className="text-right">Margen €</TableHead>
                  <TableHead>Margen %</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(p => (
                  <TableRow key={p.pedido_id}>
                    <TableCell className="font-mono text-xs font-semibold">{p.pedido_numero}</TableCell>
                    <TableCell className="text-sm">{p.cliente_nombre}</TableCell>
                    <TableCell>{badgeEstado(p.estado)}</TableCell>
                    <TableCell className="text-right text-sm">{eur(p.ingresos_eur)}</TableCell>
                    <TableCell className="text-right text-xs text-slate-600">{eur(p.coste_mo_real_eur)}</TableCell>
                    <TableCell className="text-right text-xs text-slate-600">{eur(p.coste_material_real_eur)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{eur(p.coste_total_real_eur)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${p.margen_real_eur >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {eur(p.margen_real_eur)}
                    </TableCell>
                    <TableCell>{pctDelta(p.margen_real_porcentaje, p.margen_objetivo_porcentaje, p.delta_vs_objetivo)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => verDetalle(p.pedido_id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog detalle */}
      <Dialog open={detalleId != null} onOpenChange={(o) => { if (!o) { setDetalleId(null); setDetalleData(null) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Margen detallado</DialogTitle>
          </DialogHeader>
          {cargando && (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {detalleData && (
            <div className="flex flex-col gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{detalleData.pedido_numero}</span>
                  {badgeEstado(detalleData.estado)}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {detalleData.cliente_nombre} · {detalleData.piezas_count} pieza(s) · {detalleData.tareas_con_real_count} tarea(s) con consumo real
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
                <div className="text-slate-600">Ingresos</div>
                <div className="text-right font-semibold">{eur(detalleData.ingresos_eur)}</div>
                <div className="text-slate-600">— Coste MO real</div>
                <div className="text-right">{eur(detalleData.coste_mo_real_eur)}</div>
                <div className="text-slate-600">— Coste material real</div>
                <div className="text-right">{eur(detalleData.coste_material_real_eur)}</div>
                <div className="text-slate-600 font-semibold border-t pt-1 mt-1">= Margen real</div>
                <div className={`text-right border-t pt-1 mt-1 font-bold ${detalleData.margen_real_eur >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {eur(detalleData.margen_real_eur)} ({detalleData.margen_real_porcentaje ?? '—'}%)
                </div>
              </div>

              <div className="max-h-[40vh] overflow-auto">
                <div className="mb-1 text-xs font-semibold text-slate-700">Por pieza</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pieza</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">MO</TableHead>
                      <TableHead className="text-right">Material</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleData.piezas.map(p => (
                      <TableRow key={p.pieza_id}>
                        <TableCell className="font-mono text-xs">{p.pieza_numero}</TableCell>
                        <TableCell className="text-xs">{p.estado}</TableCell>
                        <TableCell className="text-right text-xs">{eur(p.coste_mo_real_eur)}</TableCell>
                        <TableCell className="text-right text-xs">{eur(p.coste_material_real_eur)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{eur(p.coste_total_real_eur)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
