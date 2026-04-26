'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Clock, AlertTriangle, Users } from 'lucide-react'
import type { VistaPlanificador, FilaPlanificador } from '@/lib/services/planificador'

const PRIORIDAD_BG: Record<string, string> = {
  urgente: 'bg-red-50 border-red-300',
  alta:    'bg-orange-50 border-orange-300',
  normal:  'bg-blue-50 border-blue-200',
  baja:    'bg-slate-50 border-slate-200',
}

export default function PlanificadorMovilCliente({ vista }: { vista: VistaPlanificador }) {
  const router = useRouter()
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  )

  // Agrupar tareas por dia
  const porDia = new Map<string, FilaPlanificador[]>()
  for (const t of vista.tareas) {
    if (!t.inicio_planificado) continue
    const k = new Date(t.inicio_planificado).toISOString().slice(0, 10)
    if (!porDia.has(k)) porDia.set(k, [])
    porDia.get(k)!.push(t)
  }
  const dias = Array.from(porDia.keys()).sort()

  const tareasDia = porDia.get(diaSeleccionado) ?? []
  const ordenadas = tareasDia.sort((a, b) =>
    (a.inicio_planificado!.getTime()) - (b.inicio_planificado!.getTime())
  )

  // Carga total del día (sumar minutos)
  const cargaMin = ordenadas.reduce((acc, t) => acc + (t.tiempo_estimado_minutos ?? 0), 0)
  const cargaH = Math.floor(cargaMin / 60)
  const cargaM = cargaMin % 60

  return (
    <div className="p-4 max-w-md mx-auto pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/m" className="rounded-md bg-white border border-slate-300 p-2">
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planificador
          </h1>
          <div className="text-xs text-slate-500">{vista.tareas.length} tareas próximos 7 días</div>
        </div>
      </div>

      {/* Selector de día (carrusel horizontal) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {dias.length === 0 && (
          <div className="text-xs text-slate-500 py-2">No hay tareas planificadas</div>
        )}
        {dias.map((d) => {
          const fecha = new Date(d)
          const sel = d === diaSeleccionado
          const dia = fecha.toLocaleDateString('es-ES', { weekday: 'short' })
          const dnum = fecha.getDate()
          const cargaTotal = (porDia.get(d) ?? []).reduce((s, t) => s + (t.tiempo_estimado_minutos ?? 0), 0)
          return (
            <button
              key={d}
              onClick={() => setDiaSeleccionado(d)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg border-2 flex-shrink-0 ${
                sel ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <span className="text-[10px] uppercase">{dia}</span>
              <span className="text-lg font-bold leading-tight">{dnum}</span>
              <span className={`text-[10px] ${sel ? 'text-blue-100' : 'text-slate-500'}`}>
                {Math.round(cargaTotal / 60)}h
              </span>
            </button>
          )
        })}
      </div>

      {/* Resumen del día */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              {new Date(diaSeleccionado).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-xs text-slate-500">
              {ordenadas.length} tareas · {cargaH}h {cargaM}m de carga
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {Math.round(cargaMin / 540 * 100)}% jornada
          </Badge>
        </CardContent>
      </Card>

      {/* Lista de tareas del día */}
      <div className="space-y-1.5">
        {ordenadas.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-slate-500">
              Sin tareas hoy.
            </CardContent>
          </Card>
        ) : ordenadas.map((t) => {
          const ini = new Date(t.inicio_planificado!)
          const fin = new Date(ini.getTime() + (t.tiempo_estimado_minutos ?? 0) * 60_000)
          const horaIni = ini.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          const horaFin = fin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          const prio = (t.pedido_prioridad as string) ?? 'normal'
          const tentativa = (t as any).tentativa
          return (
            <Link
              key={t.id}
              href={`/pedidos/${t.pedido_id}`}
              className={`block rounded-md border-l-4 ${PRIORIDAD_BG[prio]} px-3 py-2`}
              style={{
                borderLeftColor: t.color_gantt ?? '#64748b',
                borderStyle: tentativa ? 'dashed' : 'solid',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 truncate">
                    {t.proceso_abreviatura || t.proceso_codigo} · {t.pedido_numero}
                  </div>
                  {t.cliente_nombre && (
                    <div className="text-[11px] text-slate-600 truncate">{t.cliente_nombre}</div>
                  )}
                  <div className="text-[11px] text-slate-500 truncate">{t.pieza_numero}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {horaIni}–{horaFin}
                  </Badge>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {t.tiempo_estimado_minutos}min
                  </div>
                  {t.operario_nombre && (
                    <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-0.5 justify-end">
                      <Users className="h-2.5 w-2.5" />
                      {t.operario_nombre}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Aviso violaciones plazo */}
      {vista.violaciones_plazo.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <div className="font-semibold text-red-900">{vista.violaciones_plazo.length} pieza(s) pasan de plazo</div>
              <div className="text-red-700">Ver detalle en el planificador completo.</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
