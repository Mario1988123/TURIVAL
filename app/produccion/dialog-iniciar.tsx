'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Play, Beaker, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  accionIniciarTarea,
  accionCalcularMezclaTeorica,
} from '@/lib/actions/produccion'
import type { Operario } from '@/lib/services/operarios'

// Procesos que requieren pantalla previa de mezcla
const PROCESOS_MEZCLA = ['LACADO', 'FONDO', 'FONDEADO_2']

export default function DialogIniciar({
  open,
  onOpenChange,
  tareaId,
  tareaProceso,
  tareaProcesoCodigo,
  piezaNumero,
  operariosActivos,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tareaId: string
  tareaProceso: string
  tareaProcesoCodigo?: string
  piezaNumero: string
  operariosActivos: Operario[]
  onDone: (ok: boolean, texto: string) => void
}) {
  const [operarioId, setOperarioId] = useState<string>(
    operariosActivos[0]?.id ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const esProcesoMezcla = tareaProcesoCodigo
    ? PROCESOS_MEZCLA.includes(tareaProcesoCodigo)
    : false

  const [paso, setPaso] = useState<'operario' | 'mezcla'>('operario')
  const [mezcla, setMezcla] = useState<any>(null)
  const [cargandoMezcla, setCargandoMezcla] = useState(false)

  useEffect(() => {
    if (open) {
      setPaso('operario')
      setMezcla(null)
      setError(null)
      setOperarioId(operariosActivos[0]?.id ?? '')
    }
  }, [open, operariosActivos])

  async function continuarAMezcla() {
    if (!operarioId) {
      setError('Selecciona un operario')
      return
    }
    setError(null)

    if (!esProcesoMezcla) {
      submitIniciar()
      return
    }

    setCargandoMezcla(true)
    try {
      const res = await accionCalcularMezclaTeorica(tareaId)
      if (res.ok) {
        setMezcla(res.mezcla)
        setPaso('mezcla')
      } else {
        setError(res.error ?? 'Error calculando mezcla')
      }
    } finally {
      setCargandoMezcla(false)
    }
  }

  function submitIniciar() {
    setError(null)
    startTransition(async () => {
      const res = await accionIniciarTarea({ tareaId, operarioId })
      if (res.ok) {
        onDone(true, 'Tarea iniciada')
        onOpenChange(false)
      } else {
        setError(res.error ?? 'Error al iniciar')
      }
    })
  }

  const sinOperarios = operariosActivos.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {paso === 'mezcla' ? (
              <span className="flex items-center gap-2">
                <Beaker className="w-5 h-5 text-blue-600" />
                Prepara la mezcla
              </span>
            ) : (
              'Iniciar tarea'
            )}
          </DialogTitle>
          <DialogDescription>
            Pieza <span className="font-mono">{piezaNumero}</span>
            {tareaProceso ? ` · ${tareaProceso}` : ''}
            {paso === 'mezcla' && ' · Antes de empezar, prepara estas cantidades.'}
            {paso === 'operario' && '. Selecciona quién la va a hacer.'}
          </DialogDescription>
        </DialogHeader>

        {paso === 'operario' && (
          <>
            {sinOperarios ? (
              <Alert variant="destructive">
                <AlertDescription>
                  No hay operarios activos. Ve a /configuracion/operarios y crea
                  o activa alguno antes de iniciar tareas.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="operario">Operario que ejecuta</Label>
                <Select value={operarioId} onValueChange={setOperarioId}>
                  <SelectTrigger id="operario">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operariosActivos.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: o.color }}
                        />
                        {o.nombre}
                        {o.rol ? ` · ${o.rol}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {esProcesoMezcla && (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                    <Beaker className="w-3.5 h-3.5 inline mr-1" />
                    Al continuar te mostraremos la mezcla que tienes que preparar.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {paso === 'mezcla' && mezcla && (
          <div className="space-y-3">
            <div className="rounded-md border bg-blue-50 border-blue-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">
                  Superficie {mezcla.tipo === 'lacado' ? 'a lacar' : 'a fondear'}
                </span>
                <span className="font-mono text-blue-900">
                  {Number(mezcla.superficie_m2).toFixed(3)} m²
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-blue-700">Rendimiento aplicado</span>
                <span className="font-mono text-xs text-blue-700">
                  {Number(mezcla.rendimiento_kg_m2).toFixed(3)} kg/m²
                </span>
              </div>
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-700">
                  <tr>
                    <th className="text-left p-2 font-semibold">Material</th>
                    <th className="text-right p-2 font-semibold">kg a preparar</th>
                    <th className="text-right p-2 font-semibold">Stock</th>
                    <th className="text-right p-2 font-semibold">Coste</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mezcla.materiales.map((m: any) => (
                    <tr key={m.material_id}>
                      <td className="p-2">
                        <div className="font-medium">{m.nombre}</div>
                        <div className="text-xs text-slate-500">
                          {m.codigo ?? m.tipo}
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono">
                        {Number(m.kg_teoricos).toFixed(4)}
                      </td>
                      <td className="p-2 text-right">
                        <span className={m.suficiente ? 'text-emerald-700' : 'text-red-700 font-medium'}>
                          {Number(m.stock_fisico_kg).toFixed(3)}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono">
                        {Number(m.coste_eur).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-xs">
                  <tr>
                    <td className="p-2 font-semibold">Total</td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {Number(mezcla.total_kg).toFixed(4)} kg
                    </td>
                    <td></td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {Number(mezcla.total_coste_eur).toFixed(2)} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!mezcla.todos_suficientes ? (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Stock insuficiente en algún material. Puedes iniciar igualmente
                  (si vas a traer material ahora) o cancelar y hacer una entrada
                  de stock antes.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-emerald-50 border-emerald-300 text-emerald-900">
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  Stock suficiente. Prepara la mezcla indicada y pulsa Iniciar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {paso === 'mezcla' && (
            <Button
              variant="outline"
              onClick={() => setPaso('operario')}
              disabled={isPending}
            >
              Volver
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          {paso === 'operario' ? (
            <Button
              onClick={continuarAMezcla}
              disabled={isPending || cargandoMezcla || sinOperarios || !operarioId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {cargandoMezcla || isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {esProcesoMezcla ? 'Calculando...' : 'Iniciando...'}
                </>
              ) : esProcesoMezcla ? (
                <>
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar tarea
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={submitIniciar}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar tarea
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
