'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Save } from 'lucide-react'
import {
  accionListarHorarios, accionGuardarHorario,
} from '@/lib/actions/fichajes-avanzado'
import type { HorarioDia } from '@/lib/services/fichajes-avanzado'

const DIAS = [
  { v: 1, l: 'Lunes' }, { v: 2, l: 'Martes' }, { v: 3, l: 'Miércoles' },
  { v: 4, l: 'Jueves' }, { v: 5, l: 'Viernes' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' },
]

interface FilaHorario {
  hora_entrada: string
  hora_salida: string
  pausa_inicio: string
  pausa_fin: string
}
const FILA_VACIA: FilaHorario = { hora_entrada: '', hora_salida: '', pausa_inicio: '', pausa_fin: '' }

export default function HorariosPanel({ operarios }: { operarios: { id: string; nombre: string }[] }) {
  const [opId, setOpId] = useState(operarios[0]?.id ?? '')
  const [filas, setFilas] = useState<Record<number, FilaHorario>>({})
  const [guardando, setGuardando] = useState<number | null>(null)

  async function cargar() {
    if (!opId) return
    const res = await accionListarHorarios(opId)
    if (res.ok) {
      const m: Record<number, FilaHorario> = {}
      for (const h of res.data) {
        m[h.dia_semana] = {
          hora_entrada: h.hora_entrada.slice(0, 5),
          hora_salida: h.hora_salida.slice(0, 5),
          pausa_inicio: h.pausa_inicio?.slice(0, 5) ?? '',
          pausa_fin: h.pausa_fin?.slice(0, 5) ?? '',
        }
      }
      setFilas(m)
    }
  }
  useEffect(() => { cargar() }, [opId])

  function actualizar(dia: number, campo: keyof FilaHorario, valor: string) {
    setFilas(f => ({
      ...f,
      [dia]: { ...(f[dia] ?? FILA_VACIA), [campo]: valor },
    }))
  }

  async function guardar(dia: number) {
    const f = filas[dia]
    if (!f || !f.hora_entrada || !f.hora_salida) return
    setGuardando(dia)
    const r = await accionGuardarHorario({
      operario_id: opId,
      dia_semana: dia,
      hora_entrada: f.hora_entrada,
      hora_salida: f.hora_salida,
      pausa_inicio: f.pausa_inicio || null,
      pausa_fin: f.pausa_fin || null,
    })
    setGuardando(null)
    if (r.ok) cargar()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horario teórico semanal</CardTitle>
          <CardDescription>
            Define la jornada de cada operario por día. El sistema usa estos valores para
            calcular el saldo (horas trabajadas vs teóricas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Operario</Label>
            <Select value={opId} onValueChange={setOpId}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {operarios.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {DIAS.map(d => {
              const f = filas[d.v] ?? FILA_VACIA
              return (
                <div key={d.v} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center border rounded p-2">
                  <div className="md:col-span-1 font-semibold">{d.l}</div>
                  <div>
                    <Label className="text-[10px]">Entrada</Label>
                    <Input type="time" value={f.hora_entrada} onChange={e => actualizar(d.v, 'hora_entrada', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Pausa inicio</Label>
                    <Input type="time" value={f.pausa_inicio} onChange={e => actualizar(d.v, 'pausa_inicio', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Pausa fin</Label>
                    <Input type="time" value={f.pausa_fin} onChange={e => actualizar(d.v, 'pausa_fin', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Salida</Label>
                    <Input type="time" value={f.hora_salida} onChange={e => actualizar(d.v, 'hora_salida', e.target.value)} />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button size="sm" onClick={() => guardar(d.v)} disabled={guardando === d.v || !f.hora_entrada || !f.hora_salida}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {guardando === d.v ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
