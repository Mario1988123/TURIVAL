'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, Calendar as CalIcon } from 'lucide-react'
import {
  accionListarFestivos, accionCrearFestivo, accionEliminarFestivo,
} from '@/lib/actions/fichajes-avanzado'
import type { Festivo } from '@/lib/services/fichajes-avanzado'

const ANIO_ACTUAL = new Date().getFullYear()

export default function CalendarioPanel() {
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [festivos, setFestivos] = useState<Festivo[]>([])
  const [nuevoFecha, setNuevoFecha] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoAmbito, setNuevoAmbito] = useState<Festivo['ambito']>('nacional')

  async function cargar() {
    const res = await accionListarFestivos(anio)
    if (res.ok) setFestivos(res.data)
  }
  useEffect(() => { cargar() }, [anio])

  async function crear() {
    if (!nuevoFecha || !nuevoNombre.trim()) return
    const r = await accionCrearFestivo({ fecha: nuevoFecha, nombre: nuevoNombre.trim(), ambito: nuevoAmbito, notas: null })
    if (r.ok) {
      setNuevoFecha(''); setNuevoNombre('')
      cargar()
    }
  }
  async function quitar(id: string) {
    if (!confirm('¿Eliminar festivo?')) return
    const r = await accionEliminarFestivo(id)
    if (r.ok) cargar()
  }

  // Render mini-calendario por meses
  const meses = Array.from({ length: 12 }).map((_, m) => ({
    nombre: new Date(anio, m, 1).toLocaleDateString('es-ES', { month: 'long' }),
    festivos: festivos.filter(f => new Date(f.fecha).getMonth() === m),
  }))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalIcon className="h-4 w-4" /> Calendario laboral {anio}
          </CardTitle>
          <CardDescription>Festivos nacionales, autonómicos, locales o de empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div>
              <Label>Año</Label>
              <Input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value) || ANIO_ACTUAL)} />
            </div>
            <div>
              <Label>Fecha festivo</Label>
              <Input type="date" value={nuevoFecha} onChange={e => setNuevoFecha(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Nombre</Label>
              <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: 9 d'Octubre" />
            </div>
            <div>
              <Label>Ámbito</Label>
              <div className="flex gap-2">
                <Select value={nuevoAmbito} onValueChange={v => setNuevoAmbito(v as Festivo['ambito'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="autonomico">Autonómico</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={crear} size="icon"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {meses.map((m, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="capitalize font-semibold mb-2">{m.nombre}</div>
              {m.festivos.length === 0 ? (
                <div className="text-xs text-slate-400">— sin festivos</div>
              ) : (
                <ul className="space-y-1">
                  {m.festivos.map(f => (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-slate-500">{f.fecha.slice(8, 10)}</div>
                        <div className="truncate">{f.nombre}</div>
                        <Badge variant="outline" className="text-[9px] mt-0.5">{f.ambito}</Badge>
                      </div>
                      <button onClick={() => quitar(f.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
