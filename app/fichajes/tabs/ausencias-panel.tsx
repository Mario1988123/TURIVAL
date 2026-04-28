'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, Trash2, Plus } from 'lucide-react'
import {
  accionListarAusencias, accionCrearAusencia, accionAprobarAusencia, accionEliminarAusencia,
} from '@/lib/actions/fichajes-avanzado'
import type { Ausencia, TipoAusencia } from '@/lib/services/fichajes-avanzado'

const TIPOS: Array<{ valor: TipoAusencia; label: string; color: string }> = [
  { valor: 'vacaciones', label: 'Vacaciones', color: 'bg-blue-100 text-blue-800' },
  { valor: 'permiso_retribuido', label: 'Permiso retribuido', color: 'bg-emerald-100 text-emerald-800' },
  { valor: 'permiso_no_retribuido', label: 'Permiso no retribuido', color: 'bg-slate-100 text-slate-700' },
  { valor: 'baja_medica', label: 'Baja médica', color: 'bg-red-100 text-red-800' },
  { valor: 'accidente_laboral', label: 'Accidente laboral', color: 'bg-orange-100 text-orange-800' },
  { valor: 'asuntos_propios', label: 'Asuntos propios', color: 'bg-amber-100 text-amber-800' },
  { valor: 'festivo_trabajado', label: 'Festivo trabajado', color: 'bg-purple-100 text-purple-800' },
  { valor: 'compensacion_festivo', label: 'Compensación festivo', color: 'bg-indigo-100 text-indigo-800' },
  { valor: 'formacion', label: 'Formación', color: 'bg-cyan-100 text-cyan-800' },
  { valor: 'otros', label: 'Otros', color: 'bg-slate-100 text-slate-700' },
]

export default function AusenciasPanel({ operarios }: { operarios: { id: string; nombre: string }[] }) {
  const [filtroOp, setFiltroOp] = useState<string>('')
  const [ausencias, setAusencias] = useState<Ausencia[]>([])

  // Form
  const [opForm, setOpForm] = useState(operarios[0]?.id ?? '')
  const [tipo, setTipo] = useState<TipoAusencia>('vacaciones')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [horas, setHoras] = useState('')
  const [notas, setNotas] = useState('')

  async function cargar() {
    const res = await accionListarAusencias(filtroOp || undefined)
    if (res.ok) setAusencias(res.data)
  }
  useEffect(() => { cargar() }, [filtroOp])

  async function crear() {
    if (!opForm || !desde || !hasta) return
    const r = await accionCrearAusencia({
      operario_id: opForm,
      tipo,
      fecha_inicio: desde,
      fecha_fin: hasta,
      horas_compensables: horas ? parseFloat(horas) : null,
      notas: notas || null,
    })
    if (r.ok) {
      setDesde(''); setHasta(''); setHoras(''); setNotas('')
      cargar()
    }
  }
  async function aprobar(id: string) {
    const r = await accionAprobarAusencia(id)
    if (r.ok) cargar()
  }
  async function quitar(id: string) {
    if (!confirm('¿Eliminar ausencia?')) return
    const r = await accionEliminarAusencia(id)
    if (r.ok) cargar()
  }

  const tipoBadge = (t: TipoAusencia) => TIPOS.find(x => x.valor === t) ?? TIPOS[TIPOS.length - 1]
  const nombreOp = (id: string) => operarios.find(o => o.id === id)?.nombre ?? '—'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva ausencia / permiso</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label>Operario</Label>
            <Select value={opForm} onValueChange={setOpForm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoAusencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
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
          {(tipo === 'festivo_trabajado' || tipo === 'compensacion_festivo') && (
            <div>
              <Label>Horas a compensar</Label>
              <Input type="number" step="0.5" value={horas} onChange={e => setHoras(e.target.value)} placeholder="Ej: 8" />
            </div>
          )}
          <div className="md:col-span-6">
            <Label>Notas</Label>
            <Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <Button onClick={crear}><Plus className="h-4 w-4 mr-1" /> Crear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ausencias registradas</CardTitle>
          <Select value={filtroOp || 'all'} onValueChange={v => setFiltroOp(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todos los operarios" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ausencias.map(a => {
                const tb = tipoBadge(a.tipo)
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{nombreOp(a.operario_id)}</TableCell>
                    <TableCell><Badge variant="outline" className={tb.color}>{tb.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {a.fecha_inicio} — {a.fecha_fin}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.horas_compensables ?? '—'}</TableCell>
                    <TableCell>
                      {a.aprobada
                        ? <Badge className="bg-emerald-100 text-emerald-800">Aprobada</Badge>
                        : <Badge variant="outline" className="text-amber-700 border-amber-300">Pendiente</Badge>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={a.notas ?? ''}>{a.notas ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!a.aprobada && (
                          <Button size="icon" variant="ghost" onClick={() => aprobar(a.id)} title="Aprobar">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => quitar(a.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {ausencias.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">Sin ausencias</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
