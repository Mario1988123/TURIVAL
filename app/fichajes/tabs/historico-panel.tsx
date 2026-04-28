'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { accionCalcularSaldos } from '@/lib/actions/fichajes-avanzado'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import type { SaldoHoras } from '@/lib/services/fichajes-avanzado'

const HOY = new Date().toISOString().slice(0, 10)
const HACE_30 = (() => {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
})()

export default function HistoricoPanel({ operarios }: { operarios: { id: string; nombre: string }[] }) {
  const [operarioId, setOperarioId] = useState<string>(operarios[0]?.id ?? '')
  const [desde, setDesde] = useState(HACE_30)
  const [hasta, setHasta] = useState(HOY)
  const [saldos, setSaldos] = useState<SaldoHoras[]>([])
  const [cargando, setCargando] = useState(false)

  async function cargar() {
    if (!operarioId) return
    setCargando(true)
    const res = await accionCalcularSaldos(operarioId, desde, hasta)
    if (res.ok) setSaldos(res.data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [operarioId])

  const totalTrabajadas = saldos.reduce((a, b) => a + b.trabajadas_min, 0)
  const totalTeoricas = saldos.reduce((a, b) => a + b.teoricas_min, 0)
  const totalSaldo = totalTrabajadas - totalTeoricas

  const fmtMin = (m: number) => {
    const h = Math.floor(Math.abs(m) / 60)
    const mm = Math.abs(m) % 60
    const sign = m < 0 ? '-' : ''
    return `${sign}${h}h ${mm}m`
  }
  const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short',
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Operario</Label>
            <Select value={operarioId} onValueChange={setOperarioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={cargar} disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Trabajadas</div>
          <div className="text-2xl font-bold">{fmtMin(totalTrabajadas)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Teóricas</div>
          <div className="text-2xl font-bold">{fmtMin(totalTeoricas)}</div>
        </CardContent></Card>
        <Card className={totalSaldo >= 0 ? 'border-emerald-300' : 'border-red-300'}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Saldo</div>
            <div className={`text-2xl font-bold flex items-center gap-1 ${totalSaldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {totalSaldo >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {fmtMin(totalSaldo)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalle por día</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Trabajadas</TableHead>
                <TableHead className="text-right">Teóricas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Marca</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saldos.map(s => (
                <TableRow key={s.fecha}>
                  <TableCell className="font-medium">{fmtFecha(s.fecha)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMin(s.trabajadas_min)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMin(s.teoricas_min)}</TableCell>
                  <TableCell className={`text-right font-mono ${s.saldo_min < 0 ? 'text-red-700' : s.saldo_min > 0 ? 'text-emerald-700' : ''}`}>
                    {fmtMin(s.saldo_min)}
                  </TableCell>
                  <TableCell>
                    {s.festivo && <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 mr-1">{s.festivo}</Badge>}
                    {s.ausencia && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">{s.ausencia.replace('_', ' ')}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {saldos.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sin datos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
