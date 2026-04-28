'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Edit3, Download, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  accionAjustarFichaje, accionAutoCerrar, accionCalcularSaldos,
} from '@/lib/actions/fichajes-avanzado'

interface FichajeRow {
  id: string
  operario_id: string
  tipo: string
  ocurrido_en: string
  notas: string | null
  ajustado_por: string | null
  motivo_ajuste: string | null
  auto_generado: boolean
}

export default function AdminPanel({ operarios }: { operarios: { id: string; nombre: string }[] }) {
  const [opId, setOpId] = useState(operarios[0]?.id ?? '')
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [fichajes, setFichajes] = useState<FichajeRow[]>([])
  const [editando, setEditando] = useState<FichajeRow | null>(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [motivo, setMotivo] = useState('')

  async function cargar() {
    if (!opId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('fichajes')
      .select('*')
      .eq('operario_id', opId)
      .gte('ocurrido_en', `${desde}T00:00:00Z`)
      .lte('ocurrido_en', `${hasta}T23:59:59Z`)
      .order('ocurrido_en', { ascending: false })
    setFichajes((data ?? []) as FichajeRow[])
  }
  useEffect(() => { cargar() }, [opId, desde, hasta])

  function abrirAjuste(f: FichajeRow) {
    setEditando(f)
    setNuevaFecha(f.ocurrido_en.slice(0, 16))
    setMotivo('')
  }
  async function guardarAjuste() {
    if (!editando || !nuevaFecha) return
    const r = await accionAjustarFichaje({
      fichaje_id: editando.id,
      nueva_fecha_hora: new Date(nuevaFecha).toISOString(),
      motivo: motivo || 'Ajuste admin',
    })
    if (r.ok) {
      setEditando(null)
      cargar()
    } else {
      alert('Error: ' + r.error)
    }
  }

  async function autoCerrar() {
    const r = await accionAutoCerrar(opId)
    if (r.ok) {
      alert(r.data ? 'Fichaje abierto cerrado automáticamente' : 'No había fichaje abierto que cerrar')
      cargar()
    }
  }

  async function exportarCSV() {
    if (!opId) return
    const r = await accionCalcularSaldos(opId, desde, hasta)
    if (!r.ok) return
    const op = operarios.find(o => o.id === opId)
    const filas = [
      ['Operario', 'Fecha', 'Trabajadas (min)', 'Teóricas (min)', 'Saldo (min)', 'Festivo', 'Ausencia'].join(','),
      ...r.data.map(s => [
        op?.nombre ?? '',
        s.fecha,
        s.trabajadas_min,
        s.teoricas_min,
        s.saldo_min,
        s.festivo ?? '',
        s.ausencia ?? '',
      ].join(',')),
    ].join('\n')
    const blob = new Blob([filas], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fichajes-${op?.nombre ?? 'op'}-${desde}-a-${hasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportarInspeccionTrabajo() {
    // JSON con TODO: fichajes crudos + saldos + ausencias + horarios
    if (!opId) return
    const supabase = createClient()
    const [saldosRes, fich, aus, hor] = await Promise.all([
      accionCalcularSaldos(opId, desde, hasta),
      supabase.from('fichajes').select('*').eq('operario_id', opId)
        .gte('ocurrido_en', `${desde}T00:00:00Z`).lte('ocurrido_en', `${hasta}T23:59:59Z`)
        .order('ocurrido_en'),
      supabase.from('ausencias').select('*').eq('operario_id', opId)
        .gte('fecha_fin', desde).lte('fecha_inicio', hasta),
      supabase.from('horarios_operario').select('*').eq('operario_id', opId),
    ])
    const op = operarios.find(o => o.id === opId)
    const dump = {
      operario: { id: opId, nombre: op?.nombre ?? '' },
      periodo: { desde, hasta },
      generado: new Date().toISOString(),
      fichajes: fich.data ?? [],
      ausencias: aus.data ?? [],
      horarios_teoricos: hor.data ?? [],
      saldos_diarios: saldosRes.ok ? saldosRes.data : [],
      total_trabajadas_min: saldosRes.ok ? saldosRes.data.reduce((a, s) => a + s.trabajadas_min, 0) : 0,
      total_teoricas_min: saldosRes.ok ? saldosRes.data.reduce((a, s) => a + s.teoricas_min, 0) : 0,
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspeccion-${op?.nombre ?? 'op'}-${desde}-a-${hasta}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin de fichajes</CardTitle>
          <CardDescription>Ajustar fichajes manualmente, auto-cerrar entradas olvidadas y exportar para Inspección de Trabajo.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Operario</Label>
            <Select value={opId} onValueChange={setOpId}>
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
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" onClick={autoCerrar}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Auto-cerrar olvido
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Fichajes en el rango</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button size="sm" onClick={exportarInspeccionTrabajo} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="h-3.5 w-3.5 mr-1" /> Inspección de Trabajo (JSON)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Marcas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichajes.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(f.ocurrido_en).toLocaleString('es-ES')}
                  </TableCell>
                  <TableCell><Badge variant="outline">{f.tipo}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[260px] truncate">{f.notas ?? '—'}</TableCell>
                  <TableCell>
                    {f.auto_generado && <Badge variant="outline" className="bg-amber-100 text-amber-800 mr-1">auto</Badge>}
                    {f.ajustado_por && <Badge variant="outline" className="bg-blue-100 text-blue-800">ajustado</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => abrirAjuste(f)} title="Ajustar">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {fichajes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sin fichajes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={v => !v && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar fichaje</DialogTitle>
            <DialogDescription>
              Cambiar la fecha/hora del fichaje. Queda registrado quién y por qué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nueva fecha y hora</Label>
              <Input type="datetime-local" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
            </div>
            <div>
              <Label>Motivo (obligatorio)</Label>
              <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: olvido de fichaje, error tablet…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardarAjuste} disabled={!nuevaFecha || !motivo.trim()}>Guardar ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
