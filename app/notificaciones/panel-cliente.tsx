'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, AlertTriangle, Clock, FileText, Package, Calendar,
  Users, Sparkles, Loader2, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { accionResumenNotificaciones } from '@/lib/actions/notificaciones'
import type { Notificacion, ResumenNotificaciones, TipoNotificacion } from '@/lib/services/notificaciones'

const SECCIONES: Array<{
  tipo: TipoNotificacion
  titulo: string
  descripcion: string
  icon: any
  color: string
}> = [
  {
    tipo: 'pedido_urgente',
    titulo: 'Pedidos urgentes',
    descripcion: 'Entrega comprometida en menos de 3 dias',
    icon: AlertTriangle,
    color: 'border-red-300 bg-red-50/40',
  },
  {
    tipo: 'tarea_demora',
    titulo: 'Tareas en demora',
    descripcion: 'Llevan mas del doble del tiempo estimado',
    icon: Clock,
    color: 'border-red-300 bg-red-50/40',
  },
  {
    tipo: 'solape_operario',
    titulo: 'Solapes en planificación',
    descripcion: 'Tareas del mismo operario que se pisan',
    icon: Users,
    color: 'border-red-300 bg-red-50/40',
  },
  {
    tipo: 'fecha_sin_reservar',
    titulo: 'Pedidos sin reservar hueco',
    descripcion: 'Fecha comprometida pero tareas sin planificar',
    icon: Calendar,
    color: 'border-amber-300 bg-amber-50/40',
  },
  {
    tipo: 'pieza_lista_secado',
    titulo: 'Piezas listas tras secado',
    descripcion: 'Secado terminado, hay que pasarlas a la siguiente fase',
    icon: Package,
    color: 'border-amber-300 bg-amber-50/40',
  },
  {
    tipo: 'presupuesto_pendiente',
    titulo: 'Presupuestos sin respuesta',
    descripcion: 'Enviados hace +7 dias, recordatorio comercial',
    icon: FileText,
    color: 'border-slate-300 bg-slate-50/40',
  },
  {
    tipo: 'dia_holgado',
    titulo: 'Días con poca carga',
    descripcion: 'Oportunidad comercial: huecos para nuevos pedidos',
    icon: Sparkles,
    color: 'border-emerald-300 bg-emerald-50/40',
  },
]

export default function PanelNotificacionesCliente({
  resumenInicial,
}: { resumenInicial: ResumenNotificaciones }) {
  const [resumen, setResumen] = useState<ResumenNotificaciones>(resumenInicial)
  const [recargando, setRecargando] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date())

  const recargar = useCallback(async () => {
    setRecargando(true)
    try {
      const res = await accionResumenNotificaciones()
      if (res.ok) {
        setResumen(res.resumen)
        setUltimaActualizacion(new Date())
      }
    } finally {
      setRecargando(false)
    }
  }, [])

  // Auto-refresh cada 90s
  useEffect(() => {
    const t = setInterval(recargar, 90_000)
    return () => clearInterval(t)
  }, [recargar])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Centro de notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calculado al vuelo desde tus datos · auto-refresca cada 90s · ultima: {ultimaActualizacion.toLocaleTimeString('es-ES')}
          </p>
        </div>
        <Button onClick={recargar} disabled={recargando} variant="outline" size="sm">
          {recargando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Recargar
        </Button>
      </div>

      {/* Resumen por prioridad */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resumen.por_prioridad.alta}</div>
              <div className="text-xs text-muted-foreground">Alta prioridad</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resumen.por_prioridad.media}</div>
              <div className="text-xs text-muted-foreground">Media</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resumen.por_prioridad.baja}</div>
              <div className="text-xs text-muted-foreground">Baja</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resumen.total}</div>
              <div className="text-xs text-muted-foreground">Total pendientes</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secciones por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECCIONES.map((s) => {
          const items = resumen.por_tipo[s.tipo] ?? []
          if (items.length === 0) return null
          const Icon = s.icon
          return (
            <Card key={s.tipo} className={`border-2 ${s.color}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {s.titulo}
                  <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">{s.descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {items.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        className="block rounded-md border bg-white px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="font-medium text-sm text-slate-900 truncate">{n.titulo}</div>
                        <div className="text-xs text-slate-500 truncate">{n.detalle}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {resumen.total === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Todo al dia</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No hay notificaciones pendientes. Buen trabajo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
