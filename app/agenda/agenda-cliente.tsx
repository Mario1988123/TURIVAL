'use client'

/**
 * Agenda read-only: calendario con las tareas planificadas agrupadas por día.
 *
 * Layout: una columna por día en el rango. Dentro de cada día, la lista de
 * tareas ordenada por hora. Cada item muestra hora, operario, proceso,
 * pedido, pieza y duración. Click → abre /planificador en ese día.
 */

import { useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarRange, ArrowRight } from 'lucide-react'
import type { VistaPlanificador, FilaPlanificador } from '@/lib/services/planificador'

interface Props {
  vista: VistaPlanificador
  desde: string
  dias: number
}

const PRIORIDAD_CLASES: Record<string, string> = {
  urgente: 'border-l-red-500',
  alta:    'border-l-orange-500',
  normal:  'border-l-blue-400',
  baja:    'border-l-slate-400',
}

function dosDigitos(n: number): string { return n < 10 ? `0${n}` : `${n}` }

function fechaCorta(d: Date): string {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return `${dias[d.getDay()]} ${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`
}
function hora(d: Date): string { return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}` }
function isoDia(d: Date): string { return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` }
function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function AgendaCliente({ vista, desde, dias }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const fechaDesde = useMemo(() => new Date(desde), [desde])
  const listaDias = useMemo(() => {
    const r: Date[] = []
    for (let i = 0; i < dias; i++) {
      const d = new Date(fechaDesde); d.setDate(d.getDate() + i); r.push(d)
    }
    return r
  }, [fechaDesde, dias])

  // Agrupar tareas por día ISO
  const tareasPorDia = useMemo(() => {
    const map = new Map<string, FilaPlanificador[]>()
    for (const t of vista.tareas) {
      if (!t.inicio_planificado) continue
      const key = isoDia(t.inicio_planificado)
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    for (const [k, v] of map) {
      v.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      map.set(k, v)
    }
    return map
  }, [vista.tareas])

  function navegar(delta: number) {
    const d = new Date(fechaDesde); d.setDate(d.getDate() + delta)
    const url = new URL(window.location.href)
    url.searchParams.set('desde', isoDia(d))
    startTransition(() => router.push(url.pathname + url.search))
  }
  function cambiarDias(n: string) {
    const url = new URL(window.location.href); url.searchParams.set('dias', n)
    startTransition(() => router.push(url.pathname + url.search))
  }
  function hoy() {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const url = new URL(window.location.href); url.searchParams.set('desde', isoDia(d))
    startTransition(() => router.push(url.pathname + url.search))
  }
  function irAlPlanificador(d?: Date) {
    const url = new URL(window.location.origin + '/planificador')
    if (d) url.searchParams.set('desde', isoDia(d))
    router.push(url.pathname + url.search)
  }

  const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => navegar(-7)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={hoy}>Hoy</Button>
          <Button variant="outline" size="sm" onClick={() => navegar(7)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <CalendarRange className="h-4 w-4" />
          {fechaCorta(listaDias[0])} – {fechaCorta(listaDias[listaDias.length - 1])}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={String(dias)} onValueChange={cambiarDias}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="default" size="sm" onClick={() => irAlPlanificador(fechaDesde)} className="gap-1.5">
            Abrir en Planificador <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Vista solo lectura de lo planificado. Para reprogramar tareas, abre el Planificador.
      </div>

      {/* Rejilla de días */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(dias, 7)}, minmax(220px, 1fr))` }}>
        {listaDias.slice(0, Math.min(dias, 7)).map((d, i) => {
          const key = isoDia(d)
          const tareas = tareasPorDia.get(key) ?? []
          const esHoy = esMismoDia(d, hoyDate)
          const finSemana = d.getDay() === 0 || d.getDay() === 6
          return (
            <div
              key={i}
              className={`flex flex-col rounded-lg border bg-white shadow-sm ${esHoy ? 'ring-2 ring-blue-300' : ''} ${finSemana ? 'opacity-70' : ''}`}
            >
              <div className={`flex items-center justify-between border-b px-3 py-2 ${esHoy ? 'bg-blue-50' : finSemana ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="text-sm font-semibold text-slate-800">{fechaCorta(d)}</div>
                <button
                  className="text-xs text-slate-500 hover:text-blue-700"
                  onClick={() => irAlPlanificador(d)}
                >
                  {tareas.length} tareas
                </button>
              </div>
              <div className="flex flex-1 flex-col divide-y text-sm">
                {tareas.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400">Sin tareas</div>
                ) : (
                  tareas.map(t => (
                    <div
                      key={t.id}
                      className={`border-l-4 px-3 py-2 ${PRIORIDAD_CLASES[t.pedido_prioridad] ?? PRIORIDAD_CLASES.normal}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-800">
                          {hora(t.inicio)}–{hora(t.fin)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          {t.proceso_abreviatura || t.proceso_codigo}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-700">
                        {t.pedido_numero} · {t.pieza_numero}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {t.operario_nombre && (
                          <span className="flex items-center gap-1">
                            {t.operario_color && (
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.operario_color }} />
                            )}
                            {t.operario_nombre}
                          </span>
                        )}
                        {t.requiere_secado && <span>🕓 {t.tiempo_secado_minutos}m secado</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Si dias > 7, mostramos el resto en segunda fila */}
      {dias > 7 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(7, minmax(220px, 1fr))` }}>
          {listaDias.slice(7).map((d, i) => {
            const key = isoDia(d)
            const tareas = tareasPorDia.get(key) ?? []
            const esHoy = esMismoDia(d, hoyDate)
            const finSemana = d.getDay() === 0 || d.getDay() === 6
            return (
              <div
                key={i + 7}
                className={`flex flex-col rounded-lg border bg-white shadow-sm ${esHoy ? 'ring-2 ring-blue-300' : ''} ${finSemana ? 'opacity-70' : ''}`}
              >
                <div className={`flex items-center justify-between border-b px-3 py-2 ${esHoy ? 'bg-blue-50' : finSemana ? 'bg-slate-50' : 'bg-white'}`}>
                  <div className="text-sm font-semibold text-slate-800">{fechaCorta(d)}</div>
                  <button className="text-xs text-slate-500 hover:text-blue-700" onClick={() => irAlPlanificador(d)}>
                    {tareas.length} tareas
                  </button>
                </div>
                <div className="flex flex-1 flex-col divide-y text-sm">
                  {tareas.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400">Sin tareas</div>
                  ) : (
                    tareas.slice(0, 4).map(t => (
                      <div
                        key={t.id}
                        className={`border-l-4 px-3 py-2 ${PRIORIDAD_CLASES[t.pedido_prioridad] ?? PRIORIDAD_CLASES.normal}`}
                      >
                        <div className="text-xs font-semibold text-slate-800">
                          {hora(t.inicio)} · {t.proceso_abreviatura || t.proceso_codigo}
                        </div>
                        <div className="truncate text-[11px] text-slate-600">{t.pedido_numero} · {t.pieza_numero}</div>
                      </div>
                    ))
                  )}
                  {tareas.length > 4 && (
                    <div className="px-3 py-1 text-xs text-slate-500">+{tareas.length - 4} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
