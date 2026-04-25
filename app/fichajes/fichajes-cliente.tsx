'use client'

/**
 * Panel de fichajes. Vista principal con:
 *   - Tarjetas por operario: estado actual, minutos trabajados, botones.
 *   - Botones globales "Descanso" / "Reanudar" del taller.
 *   - Dialog histórico por operario con tabla de días.
 *
 * Polling cada 30s para refrescar minutos.
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  LogIn,
  LogOut,
  Pause,
  Play,
  History,
  Coffee,
  CircleDot,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react'
import {
  accionRegistrarFichaje,
  accionDescansoGlobal,
  accionEstadoOperariosHoy,
  accionResumenOperario,
  accionDescansoGlobalActivo,
} from '@/lib/actions/fichajes'
import type { EstadoOperario, DescansoGlobalActivo, ResumenDiarioOperario } from '@/lib/services/fichajes'

interface Props {
  operariosIniciales: EstadoOperario[]
  descansoInicial: DescansoGlobalActivo
  errorInicial: string | null
}

function formatMin(n: number): string {
  if (!n) return '—'
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function soloHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function soloFecha(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FichajesCliente({ operariosIniciales, descansoInicial, errorInicial }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [operarios, setOperarios] = useState<EstadoOperario[]>(operariosIniciales)
  const [descanso, setDescanso] = useState<DescansoGlobalActivo>(descansoInicial)
  const [error, setError] = useState<string | null>(errorInicial)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [detalleOp, setDetalleOp] = useState<EstadoOperario | null>(null)

  // Polling 30s
  useEffect(() => {
    const interval = setInterval(refrescar, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function refrescar() {
    const [e, d] = await Promise.all([
      accionEstadoOperariosHoy(),
      accionDescansoGlobalActivo(),
    ])
    if (e.ok && e.data) setOperarios(e.data)
    else if (!e.ok) setError(e.error ?? null)
    if (d.ok && d.data) setDescanso(d.data)
  }

  async function ficharOperario(operario_id: string, tipo: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin') {
    setEnviandoId(operario_id)
    try {
      const res = await accionRegistrarFichaje({ operario_id, tipo })
      if (!res.ok) {
        alert(res.error ?? 'Error')
      } else {
        await refrescar()
      }
    } finally {
      setEnviandoId(null)
    }
  }

  async function toggleDescansoGlobal() {
    const res = await accionDescansoGlobal(!descanso.activo)
    if (!res.ok) alert(res.error ?? 'Error')
    await refrescar()
    startTransition(() => router.refresh())
  }

  const dentroCount = operarios.filter(o => o.estado === 'dentro').length
  const enPausaCount = operarios.filter(o => o.estado === 'en_pausa').length
  const fueraCount = operarios.filter(o => o.estado === 'fuera').length

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + descanso global */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Fichajes</h1>
          <p className="text-sm text-slate-600">
            Entrada, salida y pausas por operario · control global del taller.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {descanso.activo && (
            <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
              <Coffee className="mr-1 h-3 w-3" />
              Descanso activo hace {formatMin(descanso.minutos_transcurridos)}
            </Badge>
          )}
          <Button
            variant={descanso.activo ? 'default' : 'outline'}
            onClick={toggleDescansoGlobal}
            className="gap-1.5"
          >
            {descanso.activo ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {descanso.activo ? 'Reanudar taller' : 'Descanso taller'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>{error}</div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">Dentro</div>
          <div className="text-2xl font-bold text-emerald-700">{dentroCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">En pausa</div>
          <div className="text-2xl font-bold text-amber-700">{enPausaCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">Fuera</div>
          <div className="text-2xl font-bold text-slate-700">{fueraCount}</div>
        </CardContent></Card>
      </div>

      {/* Grid operarios */}
      {operarios.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-500">
          <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
          No hay operarios activos dados de alta.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {operarios.map(op => (
            <TarjetaOperario
              key={op.operario_id}
              op={op}
              enviando={enviandoId === op.operario_id}
              onFichar={ficharOperario}
              onVerHistorico={() => setDetalleOp(op)}
            />
          ))}
        </div>
      )}

      {/* Dialog histórico */}
      <DialogHistorico op={detalleOp} onClose={() => setDetalleOp(null)} />
    </div>
  )
}

// =============================================================
// TARJETA OPERARIO
// =============================================================

function TarjetaOperario({
  op,
  enviando,
  onFichar,
  onVerHistorico,
}: {
  op: EstadoOperario
  enviando: boolean
  onFichar: (id: string, tipo: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin') => void
  onVerHistorico: () => void
}) {
  const colorBorde =
    op.estado === 'dentro' ? 'border-l-emerald-500'
    : op.estado === 'en_pausa' ? 'border-l-amber-500'
    : 'border-l-slate-300'

  const estadoLabel =
    op.estado === 'dentro' ? 'Dentro'
    : op.estado === 'en_pausa' ? 'En pausa'
    : 'Fuera'

  const estadoClase =
    op.estado === 'dentro' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : op.estado === 'en_pausa' ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-slate-100 text-slate-700 border-slate-300'

  return (
    <Card className={`border-l-4 ${colorBorde}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-slate-800">{op.nombre}</div>
            <div className="text-xs text-slate-500">{op.rol || '—'}</div>
          </div>
          <Badge variant="outline" className={estadoClase}>
            <CircleDot className="mr-1 h-3 w-3" />
            {estadoLabel}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2 text-xs">
          <div>
            <div className="text-slate-500">Trabajado hoy</div>
            <div className="font-semibold">{formatMin(op.minutos_trabajados_hoy)}</div>
          </div>
          <div>
            <div className="text-slate-500">Pausas hoy</div>
            <div className="font-semibold">{formatMin(op.minutos_pausado_hoy)}</div>
          </div>
          {op.fichado_desde && (
            <div className="col-span-2">
              <div className="text-slate-500">Fichado desde</div>
              <div className="font-semibold">{soloHora(op.fichado_desde)}</div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {op.estado === 'fuera' && (
            <Button size="sm" variant="default" onClick={() => onFichar(op.operario_id, 'entrada')} disabled={enviando} className="gap-1">
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
              Entrada
            </Button>
          )}
          {op.estado === 'dentro' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onFichar(op.operario_id, 'pausa_inicio')} disabled={enviando} className="gap-1">
                <Pause className="h-3 w-3" />
                Pausar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onFichar(op.operario_id, 'salida')} disabled={enviando} className="gap-1">
                <LogOut className="h-3 w-3" />
                Salida
              </Button>
            </>
          )}
          {op.estado === 'en_pausa' && (
            <Button size="sm" variant="default" onClick={() => onFichar(op.operario_id, 'pausa_fin')} disabled={enviando} className="gap-1">
              <Play className="h-3 w-3" />
              Reanudar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onVerHistorico} className="gap-1 ml-auto">
            <History className="h-3 w-3" />
            Histórico
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================
// DIALOG HISTÓRICO
// =============================================================

function DialogHistorico({ op, onClose }: { op: EstadoOperario | null; onClose: () => void }) {
  const [cargando, setCargando] = useState(false)
  const [dias, setDias] = useState<ResumenDiarioOperario[]>([])
  const [rango, setRango] = useState<{ desde: string; hasta: string }>(() => {
    const hasta = new Date()
    const desde = new Date()
    desde.setDate(desde.getDate() - 13)
    return { desde: isoDia(desde), hasta: isoDia(hasta) }
  })

  useEffect(() => {
    if (!op) return
    let cancelado = false
    async function cargar() {
      setCargando(true)
      try {
        if (!op) return
        const res = await accionResumenOperario(op.operario_id, rango.desde, rango.hasta)
        if (!cancelado && res.ok && res.data) setDias(res.data)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [op, rango])

  if (!op) return null

  const totalMin = dias.reduce((a, d) => a + d.minutos_trabajados, 0)
  const totalPausa = dias.reduce((a, d) => a + d.minutos_pausado, 0)

  return (
    <Dialog open={!!op} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{op.nombre} · Histórico fichajes</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <span>Desde</span>
          <Input type="date" value={rango.desde} onChange={e => setRango({ ...rango, desde: e.target.value })} className="w-auto" />
          <span>hasta</span>
          <Input type="date" value={rango.hasta} onChange={e => setRango({ ...rango, hasta: e.target.value })} className="w-auto" />
        </div>

        <div className="flex gap-3 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex-1">
            <div className="text-xs text-slate-500">Trabajado total</div>
            <div className="font-semibold">{formatMin(totalMin)}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-500">Pausas total</div>
            <div className="font-semibold">{formatMin(totalPausa)}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-500">Días con fichaje</div>
            <div className="font-semibold">{dias.filter(d => d.num_entradas > 0).length} / {dias.length}</div>
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-6 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead className="text-right">Trabajado</TableHead>
                  <TableHead className="text-right">Pausa</TableHead>
                  <TableHead className="text-center">#Entradas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dias.slice().reverse().map(d => (
                  <TableRow key={d.fecha}>
                    <TableCell className="text-xs font-mono">{soloFecha(d.fecha + 'T00:00:00')}</TableCell>
                    <TableCell className="text-xs">{soloHora(d.primera_entrada)}</TableCell>
                    <TableCell className="text-xs">{soloHora(d.ultima_salida)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatMin(d.minutos_trabajados)}</TableCell>
                    <TableCell className="text-right text-xs">{formatMin(d.minutos_pausado)}</TableCell>
                    <TableCell className="text-center text-xs">{d.num_entradas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
