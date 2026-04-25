'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle, Clock, FileText, Package, Calendar, X, Users, Sparkles } from 'lucide-react'
import { accionListarNotificaciones } from '@/lib/actions/notificaciones'
import type { Notificacion, TipoNotificacion } from '@/lib/services/notificaciones'

const ICON_TIPO: Record<TipoNotificacion, any> = {
  pedido_urgente: AlertTriangle,
  pieza_lista_secado: Package,
  tarea_demora: Clock,
  presupuesto_pendiente: FileText,
  fecha_sin_reservar: Calendar,
  solape_operario: Users,
  dia_holgado: Sparkles,
  retraso_planificado: AlertTriangle,
}

const COLOR_PRIORIDAD: Record<Notificacion['prioridad'], string> = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baja: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function CampanitaNotificaciones() {
  const [items, setItems] = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await accionListarNotificaciones()
      if (res.ok) setItems(res.items)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    // Refresca cada 90 segundos
    const t = setInterval(cargar, 90_000)
    return () => clearInterval(t)
  }, [cargar])

  const cantidadAlta = items.filter((n) => n.prioridad === 'alta').length

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="relative rounded-md p-2 text-slate-300 hover:bg-white/10 transition-colors"
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
              cantidadAlta > 0 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAbierto(false)}
          />
          <div className="fixed top-16 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </div>
                <div className="text-[11px] text-slate-500">
                  {items.length} pendiente{items.length === 1 ? '' : 's'} · refresca cada 90s
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/notificaciones"
                  onClick={() => setAbierto(false)}
                  className="text-[11px] text-blue-700 hover:underline"
                >
                  Ver panel completo →
                </Link>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cargando && items.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">Cargando…</div>
              )}
              {!cargando && items.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Todo al dia. No hay nada pendiente.
                </div>
              )}
              <ul className="divide-y">
                {items.map((n) => {
                  const Icon = ICON_TIPO[n.tipo] ?? Bell
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setAbierto(false)}
                        className="block px-4 py-3 hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0 ${COLOR_PRIORIDAD[n.prioridad]} border`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 truncate">{n.titulo}</div>
                            <div className="text-xs text-slate-500 truncate">{n.detalle}</div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  )
}
