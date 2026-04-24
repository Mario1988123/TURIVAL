'use client'

/**
 * Panel lateral (Sheet) con las sugerencias del planificador:
 *   - Huecos libres de operarios (con tareas candidatas).
 *   - Agrupaciones por color de lacado/fondo (ahorro estimado).
 *   - Pedidos que se pasan de plazo (aviso de horas extra).
 *
 * Carga las sugerencias sólo cuando el panel se abre (on-demand).
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Lightbulb, Clock, Palette, AlertTriangle, Loader2 } from 'lucide-react'
import {
  accionSugerenciasHuecos,
  accionSugerenciasAgrupacion,
  accionSugerenciasHorasExtra,
  accionAplicarAgrupacion,
} from '@/lib/actions/planificador'
import type {
  SugerenciaHueco,
  SugerenciaHorasExtra,
  SugerenciaAgrupacion,
} from '@/lib/motor/planificador'
import type { OperarioDisponible } from '@/lib/motor/planificador'

interface Props {
  desde: string
  hasta: string
  operarios: OperarioDisponible[]
  onAfterApply: () => void
}

export default function PanelSugerencias({ desde, hasta, operarios, onAfterApply }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [huecos, setHuecos] = useState<SugerenciaHueco[]>([])
  const [agrupaciones, setAgrupaciones] = useState<SugerenciaAgrupacion[]>([])
  const [horasExtra, setHorasExtra] = useState<SugerenciaHorasExtra[]>([])

  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    async function cargar() {
      setCargando(true)
      try {
        const [h, a, he] = await Promise.all([
          accionSugerenciasHuecos({ desde, hasta }),
          accionSugerenciasAgrupacion({ desde, hasta }),
          accionSugerenciasHorasExtra({ desde, hasta }),
        ])
        if (cancelado) return
        setHuecos(h.ok ? h.sugerencias : [])
        setAgrupaciones(a.ok ? a.sugerencias : [])
        setHorasExtra(he.ok ? he.sugerencias : [])
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [abierto, desde, hasta])

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Lightbulb className="h-4 w-4" />
          Sugerencias
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Sugerencias del planificador</SheetTitle>
          <SheetDescription>
            Agrupaciones por color, huecos libres y avisos de plazo para el rango visible.
          </SheetDescription>
        </SheetHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <SeccionAgrupaciones
              agrupaciones={agrupaciones}
              operarios={operarios}
              onAfterApply={() => {
                setAbierto(false)
                onAfterApply()
              }}
            />
            <SeccionHuecos huecos={huecos} />
            <SeccionHorasExtra horasExtra={horasExtra} />

            {agrupaciones.length + huecos.length + horasExtra.length === 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No hay sugerencias en este rango.
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------

function SeccionAgrupaciones({
  agrupaciones,
  operarios,
  onAfterApply,
}: {
  agrupaciones: SugerenciaAgrupacion[]
  operarios: OperarioDisponible[]
  onAfterApply: () => void
}) {
  if (agrupaciones.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Palette className="h-4 w-4" /> Agrupaciones por color
      </h3>
      <div className="flex flex-col gap-2">
        {agrupaciones.map((s, i) => (
          <TarjetaAgrupacion key={i} sugerencia={s} operarios={operarios} onAfterApply={onAfterApply} />
        ))}
      </div>
    </section>
  )
}

function TarjetaAgrupacion({
  sugerencia,
  operarios,
  onAfterApply,
}: {
  sugerencia: SugerenciaAgrupacion
  operarios: OperarioDisponible[]
  onAfterApply: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Operario compatible por defecto: Lacador si LACADO, Fondeador si FONDO.
  const rolObjetivo = sugerencia.proceso_codigo === 'LACADO' ? 'Lacador' : 'Fondeador'
  const operarioDefault = operarios.find(o => o.activo && o.rol === rolObjetivo)

  async function aplicar() {
    if (!operarioDefault) return
    setEnviando(true)
    try {
      // Inicio = mañana 08:00 por defecto (el operario puede reubicarlo después)
      const inicio = new Date()
      inicio.setDate(inicio.getDate() + 1)
      inicio.setHours(8, 0, 0, 0)

      const res = await accionAplicarAgrupacion({
        tareas_ids: sugerencia.tareas_ids,
        operario_id: operarioDefault.id,
        inicio: inicio.toISOString(),
      })
      if (res.ok) {
        startTransition(() => {
          router.refresh()
          onAfterApply()
        })
      } else {
        alert(`No se pudo aplicar: ${res.error}`)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-1 text-xs font-medium text-slate-700">{sugerencia.mensaje}</div>
        <div className="text-xs text-slate-500">
          {sugerencia.tareas_ids.length} tareas · {sugerencia.pedidos_ids.length} pedido(s) · ahorro {sugerencia.minutos_ahorrados_estimados} min
        </div>
        {operarioDefault ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={aplicar}
            disabled={enviando}
          >
            {enviando ? 'Aplicando…' : `Agrupar con ${operarioDefault.nombre} mañana 08:00`}
          </Button>
        ) : (
          <div className="mt-2 text-xs text-red-700">No hay operario activo con rol {rolObjetivo}</div>
        )}
      </CardContent>
    </Card>
  )
}

function SeccionHuecos({ huecos }: { huecos: SugerenciaHueco[] }) {
  if (huecos.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Clock className="h-4 w-4" /> Huecos libres y tareas candidatas
      </h3>
      <div className="flex flex-col gap-2">
        {huecos.slice(0, 10).map((s, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="text-xs font-medium text-slate-700">{s.mensaje}</div>
              {s.tareas_candidatas.length > 0 && (
                <div className="mt-1 text-xs text-slate-500">
                  Candidatas: {s.tareas_candidatas.slice(0, 3).map(c => `${c.proceso_codigo}/${c.pedido_id.slice(0, 8)}`).join(', ')}
                  {s.tareas_candidatas.length > 3 ? '…' : ''}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {huecos.length > 10 && (
          <div className="text-xs text-slate-500">+{huecos.length - 10} sugerencias más</div>
        )}
      </div>
    </section>
  )
}

function SeccionHorasExtra({ horasExtra }: { horasExtra: SugerenciaHorasExtra[] }) {
  if (horasExtra.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <AlertTriangle className="h-4 w-4" /> Pedidos que pasan de plazo
      </h3>
      <div className="flex flex-col gap-2">
        {horasExtra.map((s, i) => (
          <Card key={i} className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <div className="text-xs font-medium text-red-900">{s.mensaje}</div>
              <div className="text-xs text-red-700">
                +{Math.round(s.minutos_necesarios)} min · {s.roles_afectados.length ? `roles: ${s.roles_afectados.join(', ')}` : 'sin rol específico'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
