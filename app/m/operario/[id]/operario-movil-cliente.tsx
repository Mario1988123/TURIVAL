'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play, Pause, Square, LogIn, LogOut, ArrowLeft, Loader2,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'

type EstadoOperario = 'fuera' | 'dentro' | 'en_pausa'

function inferirEstado(ultimo: { tipo: string } | null): EstadoOperario {
  if (!ultimo) return 'fuera'
  switch (ultimo.tipo) {
    case 'entrada': return 'dentro'
    case 'pausa_inicio': return 'en_pausa'
    case 'pausa_fin': return 'dentro'
    case 'salida': return 'fuera'
    default: return 'fuera'
  }
}

const ESTADO_LABEL: Record<EstadoOperario, { label: string; color: string }> = {
  fuera: { label: 'Fuera del taller', color: 'bg-slate-200 text-slate-700' },
  dentro: { label: 'Trabajando', color: 'bg-emerald-100 text-emerald-800' },
  en_pausa: { label: 'En pausa', color: 'bg-amber-100 text-amber-800' },
}

export default function OperarioMovilCliente({
  operario,
  tareasIniciales,
  ultimoFichaje,
}: {
  operario: { id: string; nombre: string; rol: string; color: string | null }
  tareasIniciales: any[]
  ultimoFichaje: { tipo: string; fecha_hora: string } | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [estado, setEstado] = useState<EstadoOperario>(inferirEstado(ultimoFichaje))
  const [enviando, setEnviando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [tareas] = useState(tareasIniciales)

  function avisar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 2200)
  }

  async function fichar(tipo: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin') {
    setEnviando(true)
    try {
      const { accionRegistrarFichaje } = await import('@/lib/actions/fichajes')
      const res = await accionRegistrarFichaje({ operario_id: operario.id, tipo })
      if (res.ok) {
        avisar(`✓ ${etiquetaTipo(tipo)}`)
        // Actualizar estado local segun la accion
        if (tipo === 'entrada') setEstado('dentro')
        else if (tipo === 'pausa_inicio') setEstado('en_pausa')
        else if (tipo === 'pausa_fin') setEstado('dentro')
        else if (tipo === 'salida') setEstado('fuera')
        startTransition(() => router.refresh())
      } else {
        avisar(`✗ ${res.error ?? 'Error'}`, 'error')
      }
    } finally {
      setEnviando(false)
    }
  }

  const horaAhora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const tareasHoy = tareas.filter((t) => {
    if (!t.fecha_inicio_planificada) return false
    const d = new Date(t.fecha_inicio_planificada)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fin = new Date(hoy); fin.setDate(fin.getDate() + 1)
    return d >= hoy && d < fin
  })
  const tareasOtros = tareas.filter((t) => !tareasHoy.includes(t))

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/m" className="rounded-md bg-white border border-slate-300 p-2">
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </Link>
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow"
          style={{ background: operario.color ?? '#64748b' }}
        >
          {operario.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 truncate">{operario.nombre}</div>
          <div className="text-xs text-slate-500">{operario.rol} · {horaAhora}</div>
        </div>
      </div>

      {/* Estado actual */}
      <Card>
        <CardContent className="p-4 text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${ESTADO_LABEL[estado].color}`}>
            {estado === 'dentro' && <CheckCircle2 className="h-4 w-4" />}
            {estado === 'en_pausa' && <Pause className="h-4 w-4" />}
            {estado === 'fuera' && <LogOut className="h-4 w-4" />}
            {ESTADO_LABEL[estado].label}
          </div>
        </CardContent>
      </Card>

      {/* Botones grandes de fichaje */}
      <div className="grid grid-cols-2 gap-3">
        {estado === 'fuera' && (
          <Button
            onClick={() => fichar('entrada')}
            disabled={enviando}
            className="col-span-2 h-20 text-lg bg-emerald-600 hover:bg-emerald-700"
          >
            {enviando ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              <span className="flex items-center gap-2">
                <LogIn className="h-6 w-6" /> Entrada
              </span>
            )}
          </Button>
        )}

        {estado === 'dentro' && (
          <>
            <Button
              onClick={() => fichar('pausa_inicio')}
              disabled={enviando}
              className="h-20 text-lg bg-amber-500 hover:bg-amber-600"
            >
              <span className="flex items-center gap-2"><Pause className="h-5 w-5" /> Pausa</span>
            </Button>
            <Button
              onClick={() => fichar('salida')}
              disabled={enviando}
              variant="destructive"
              className="h-20 text-lg"
            >
              <span className="flex items-center gap-2"><LogOut className="h-5 w-5" /> Salida</span>
            </Button>
          </>
        )}

        {estado === 'en_pausa' && (
          <>
            <Button
              onClick={() => fichar('pausa_fin')}
              disabled={enviando}
              className="h-20 text-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <span className="flex items-center gap-2"><Play className="h-5 w-5" /> Reanudar</span>
            </Button>
            <Button
              onClick={() => fichar('salida')}
              disabled={enviando}
              variant="destructive"
              className="h-20 text-lg"
            >
              <span className="flex items-center gap-2"><LogOut className="h-5 w-5" /> Salida</span>
            </Button>
          </>
        )}
      </div>

      {/* Tareas de hoy */}
      <section>
        <div className="flex items-center gap-2 px-1 mb-2">
          <Clock className="h-4 w-4 text-slate-600" />
          <h2 className="font-semibold text-slate-800">Mis tareas hoy</h2>
          <span className="text-xs text-slate-500 ml-auto">{tareasHoy.length}</span>
        </div>
        {tareasHoy.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-slate-500">
              No tienes tareas planificadas hoy.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tareasHoy.map((t) => <TareaCard key={t.id} tarea={t} />)}
          </div>
        )}
      </section>

      {/* Tareas próximos días */}
      {tareasOtros.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-1 mb-2 mt-6">
            <h2 className="font-semibold text-slate-700 text-sm">Próximos días</h2>
            <span className="text-xs text-slate-500 ml-auto">{tareasOtros.length}</span>
          </div>
          <div className="space-y-2">
            {tareasOtros.map((t) => <TareaCard key={t.id} tarea={t} compact />)}
          </div>
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md shadow-lg text-sm font-medium ${
          toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.tipo === 'error' && <AlertTriangle className="h-4 w-4 inline mr-1" />}
          {toast.texto}
        </div>
      )}
    </div>
  )
}

function etiquetaTipo(tipo: string): string {
  switch (tipo) {
    case 'entrada': return 'Entrada registrada'
    case 'salida': return 'Salida registrada'
    case 'pausa_inicio': return 'Pausa iniciada'
    case 'pausa_fin': return 'Reanudado'
    default: return 'Fichaje registrado'
  }
}

function TareaCard({ tarea, compact }: { tarea: any; compact?: boolean }) {
  const proceso = tarea.proceso
  const pieza = tarea.pieza
  const linea = pieza?.linea_pedido
  const pedido = linea?.pedido
  const cliente = pedido?.cliente
  const ini = tarea.fecha_inicio_planificada ? new Date(tarea.fecha_inicio_planificada) : null
  const horaIni = ini?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dia = ini?.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

  const colorBorde = proceso?.color_gantt ?? '#64748b'
  const tentativa = !!tarea.tentativa

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: colorBorde, borderStyle: tentativa ? 'dashed' : 'solid' }}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 truncate">
              {proceso?.nombre ?? proceso?.codigo ?? 'Tarea'}
              {tentativa && <span className="ml-1 text-amber-700 text-xs">⚠ tentativa</span>}
            </div>
            <div className="text-xs text-slate-600 truncate">
              {pieza?.numero} · {pedido?.numero ?? '—'}
            </div>
            {cliente?.nombre_comercial && (
              <div className="text-[11px] text-slate-500 truncate">{cliente.nombre_comercial}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {compact && dia && <div className="text-[11px] text-slate-500">{dia}</div>}
            {horaIni && <Badge variant="outline" className="font-mono text-[11px]">{horaIni}</Badge>}
            <div className="text-[10px] text-slate-500 mt-1">{tarea.tiempo_estimado_minutos}min</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
