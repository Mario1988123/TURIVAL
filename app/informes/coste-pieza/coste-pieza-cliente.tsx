'use client'

/**
 * UI del informe coste/consumo por pieza (R6b-3c).
 * Listado con KPIs por pieza y expansión al detalle por tarea.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TrendingUp, TrendingDown, Eye, Loader2, Download } from 'lucide-react'
import { accionDetalleCostePieza } from '@/lib/actions/informe-coste-pieza'
import type { ResumenCostePieza, DetalleCostePieza } from '@/lib/services/informe-coste-pieza'
import { exportarCsv } from '@/lib/utils/csv'

interface Props {
  items: ResumenCostePieza[]
}

function kg(n: number): string {
  if (!n) return '—'
  return `${n.toFixed(3).replace(/\.?0+$/, '')} kg`
}

function minutos(n: number): string {
  if (!n) return '—'
  if (n < 60) return `${Math.round(n)} min`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function pctBadge(pct: number | null) {
  if (pct == null) return <span className="text-slate-400">—</span>
  const color = pct > 10 ? 'text-red-700' : pct > 0 ? 'text-amber-700' : pct < -5 ? 'text-emerald-700' : 'text-slate-700'
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function CostePiezaCliente({ items }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [detalleData, setDetalleData] = useState<DetalleCostePieza | null>(null)
  const [cargando, setCargando] = useState(false)

  async function verDetalle(pieza_id: string) {
    setDetalleId(pieza_id)
    setDetalleData(null)
    setCargando(true)
    try {
      const res = await accionDetalleCostePieza(pieza_id)
      if (res.ok) setDetalleData(res.detalle)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Coste / consumo por pieza</h1>
          <p className="text-sm text-slate-600">
            Comparativa de consumo estimado vs real en piezas con tareas completadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportarCsv(items, [
              { header: 'Pieza', get: p => p.pieza_numero },
              { header: 'Pedido', get: p => p.pedido_numero },
              { header: 'Cliente', get: p => p.cliente_nombre },
              { header: 'Estado', get: p => p.estado },
              { header: 'Superficie m²', get: p => p.superficie_m2 },
              { header: 'Lacado estim kg', get: p => p.lacado_estim_kg },
              { header: 'Lacado real kg', get: p => p.lacado_real_kg },
              { header: 'Merma lacado %', get: p => p.merma_lacado_pct },
              { header: 'Fondo estim kg', get: p => p.fondo_estim_kg },
              { header: 'Fondo real kg', get: p => p.fondo_real_kg },
              { header: 'Merma fondo %', get: p => p.merma_fondo_pct },
              { header: 'Cata estim kg', get: p => p.cata_estim_kg },
              { header: 'Cata real kg', get: p => p.cata_real_kg },
              { header: 'Dis estim kg', get: p => p.dis_estim_kg },
              { header: 'Dis real kg', get: p => p.dis_real_kg },
              { header: 'Tiempo estim min', get: p => p.tiempo_estim_min },
              { header: 'Tiempo real min', get: p => p.tiempo_real_min },
              { header: 'Tareas con real', get: p => p.tareas_con_real },
              { header: 'Última fecha real', get: p => p.fecha_ultima_real },
            ], `coste-pieza-${new Date().toISOString().slice(0,10)}.csv`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => startTransition(() => router.refresh())}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>{items.length} pieza(s) con consumo real registrado.</span>
        <span className="ml-auto">Merma &gt; 10% aparece en rojo.</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Aún no hay piezas con consumo real registrado. Completa tareas en Producción para empezar a ver datos.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>Lacado estim/real</TableHead>
                  <TableHead>Merma lacado</TableHead>
                  <TableHead>Fondo estim/real</TableHead>
                  <TableHead>Merma fondo</TableHead>
                  <TableHead>Tiempo estim/real</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(p => (
                  <TableRow key={p.pieza_id}>
                    <TableCell className="font-mono text-xs font-semibold">{p.pieza_numero}</TableCell>
                    <TableCell className="text-sm">{p.pedido_numero}</TableCell>
                    <TableCell className="text-sm">{p.cliente_nombre}</TableCell>
                    <TableCell className="text-xs">{p.superficie_m2 ? `${p.superficie_m2.toFixed(4)} m²` : '—'}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-slate-600">{kg(p.lacado_estim_kg)}</span>
                      {' → '}
                      <span className="font-semibold">{kg(p.lacado_real_kg)}</span>
                    </TableCell>
                    <TableCell>{pctBadge(p.merma_lacado_pct)}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-slate-600">{kg(p.fondo_estim_kg)}</span>
                      {' → '}
                      <span className="font-semibold">{kg(p.fondo_real_kg)}</span>
                    </TableCell>
                    <TableCell>{pctBadge(p.merma_fondo_pct)}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-slate-600">{minutos(p.tiempo_estim_min)}</span>
                      {' → '}
                      <span className="font-semibold">{minutos(p.tiempo_real_min)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => verDetalle(p.pieza_id)}>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de coste por tarea</DialogTitle>
          </DialogHeader>
          {cargando && (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {detalleData && (
            <div className="flex flex-col gap-3">
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{detalleData.pieza_numero}</span>
                  <Badge variant="outline">{detalleData.estado}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {detalleData.pedido_numero} · {detalleData.cliente_nombre} · {detalleData.superficie_m2 ? `${detalleData.superficie_m2.toFixed(4)} m²` : 'sin superficie'}
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Proceso</TableHead>
                      <TableHead>Operario</TableHead>
                      <TableHead>Tiempo</TableHead>
                      <TableHead>Lacado</TableHead>
                      <TableHead>Fondo</TableHead>
                      <TableHead>Cata/Dis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleData.tareas.map(t => (
                      <TableRow key={t.tarea_id}>
                        <TableCell className="text-xs font-semibold">{t.secuencia}</TableCell>
                        <TableCell className="text-xs">{t.proceso_codigo}</TableCell>
                        <TableCell className="text-xs">{t.operario_nombre ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          {t.tiempo_estim_min ? minutos(t.tiempo_estim_min) : '—'}
                          {' → '}
                          {t.tiempo_real_min ? <span className="font-semibold">{minutos(t.tiempo_real_min)}</span> : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.lacado_estim_kg != null || t.lacado_real_kg != null ? (
                            <>
                              {kg(t.lacado_estim_kg ?? 0)} → <span className="font-semibold">{kg(t.lacado_real_kg ?? 0)}</span>
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.fondo_estim_kg != null || t.fondo_real_kg != null ? (
                            <>
                              {kg(t.fondo_estim_kg ?? 0)} → <span className="font-semibold">{kg(t.fondo_real_kg ?? 0)}</span>
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {(t.cata_real_kg ?? 0) > 0 || (t.dis_real_kg ?? 0) > 0
                            ? `${kg(t.cata_real_kg ?? 0)} / ${kg(t.dis_real_kg ?? 0)}`
                            : '—'}
                        </TableCell>
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
