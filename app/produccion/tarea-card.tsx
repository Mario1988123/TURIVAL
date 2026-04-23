'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Users,
  Zap,
  Clock,
  Package,
  RotateCcw,
  Printer,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { Operario } from '@/lib/services/operarios'
import {
  accionCompletarTarea,
  accionForzarSeco,
  accionDuplicarTarea,
} from '@/lib/actions/produccion'

import DialogIniciar from './dialog-iniciar'
import DialogIncidencia from './dialog-incidencia'
import DialogCandidatos from './dialog-candidatos'
import DialogCompletar from './dialog-completar'
import DialogReabrir from './dialog-reabrir'

// Procesos que requieren modal de mezcla al iniciar y al completar
const PROCESOS_MEZCLA = ['LACADO', 'FONDO', 'FONDEADO_2']

// =============================================================
// Colores por estado
// =============================================================

const ESTADO_BADGE: Record<
  string,
  { label: string; clase: string }
> = {
  pendiente:    { label: 'Pendiente',    clase: 'bg-slate-100 text-slate-700 border-slate-300' },
  en_cola:      { label: 'En cola',      clase: 'bg-slate-200 text-slate-800 border-slate-400' },
  en_progreso:  { label: 'En progreso',  clase: 'bg-amber-100 text-amber-800 border-amber-400' },
  en_secado:    { label: 'En secado',    clase: 'bg-purple-100 text-purple-800 border-purple-400' },
  completada:   { label: 'Completada',   clase: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
  incidencia:   { label: 'Incidencia',   clase: 'bg-red-100 text-red-800 border-red-400' },
  anulada:      { label: 'Anulada',      clase: 'bg-slate-50 text-slate-500 border-slate-200' },
}

const PRIORIDAD_BADGE: Record<
  string,
  { label: string; clase: string }
> = {
  urgente: { label: 'URGENTE', clase: 'bg-red-600 text-white border-red-700' },
  alta:    { label: 'Alta',    clase: 'bg-orange-100 text-orange-800 border-orange-300' },
  normal:  { label: 'Normal',  clase: 'bg-slate-100 text-slate-700 border-slate-300' },
  baja:    { label: 'Baja',    clase: 'bg-slate-50 text-slate-500 border-slate-200' },
}

// =============================================================
// Helpers
// =============================================================

function formatearMinutos(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '—'
  const m = Math.abs(Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}min`
}

function formatearDiferencia(ms: number): string {
  const abs = Math.abs(ms)
  const mins = Math.floor(abs / 60000)
  if (mins < 1) return 'menos de 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const r = mins % 60
  return r === 0 ? `${h}h` : `${h}h ${r}min`
}

// =============================================================
// Componente
// =============================================================

export default function TareaCard({
  tarea,
  operarios,
  ahora,
  onNotificar,
  modoCompacto = true,
}: {
  tarea: any
  operarios: Operario[]
  ahora: number
  onNotificar: (tipo: 'ok' | 'error', texto: string) => void
  modoCompacto?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [iniciarOpen, setIniciarOpen] = useState(false)
  const [incidenciaOpen, setIncidenciaOpen] = useState(false)
  const [candidatosOpen, setCandidatosOpen] = useState(false)
  const [completarOpen, setCompletarOpen] = useState(false)
  const [reabrirOpen, setReabrirOpen] = useState(false)

  const proceso = tarea?.proceso ?? {}
  const procesoCodigo: string = proceso?.codigo ?? ''
  const esProcesoMezcla = PROCESOS_MEZCLA.includes(procesoCodigo)
  const pieza = tarea?.pieza ?? {}
  const linea = pieza?.linea_pedido ?? {}
  const pedido = linea?.pedido ?? {}
  const cliente = pedido?.cliente ?? {}
  const producto = linea?.producto ?? null
  const color = pieza?.color ?? null
  const operarioAsignado: Operario | null = tarea?.operario ?? null
  const estado: string = tarea?.estado
  const estadoInfo = ESTADO_BADGE[estado] ?? ESTADO_BADGE.pendiente
  const prioridad = pedido?.prioridad ?? 'normal'
  const prioridadInfo = PRIORIDAD_BADGE[prioridad] ?? PRIORIDAD_BADGE.normal

  // Descripción visible de la pieza: prefiere descripción de la línea,
  // si no hay, el nombre del producto
  const descripcionPieza =
    (typeof linea?.descripcion === 'string' && linea.descripcion.trim()) ||
    producto?.nombre ||
    null

  const finSecadoMs =
    estado === 'en_secado' && tarea?.fecha_fin_secado
      ? new Date(tarea.fecha_fin_secado).getTime() - ahora
      : null
  const secadoListo = finSecadoMs != null && finSecadoMs <= 0

  const transcurridoMs =
    estado === 'en_progreso' && tarea?.fecha_inicio_real
      ? ahora - new Date(tarea.fecha_inicio_real).getTime()
      : null

  function completar() {
    startTransition(async () => {
      const res = await accionCompletarTarea(tarea.id)
      if (res.ok) {
        if (res.estado === 'en_secado') {
          const fs = res.finSecado ? new Date(res.finSecado) : null
          const hora = fs
            ? fs.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : null
          onNotificar(
            'ok',
            hora
              ? `Tarea completada. Pasa a secado hasta las ${hora}`
              : 'Tarea completada y pasa a secado'
          )
        } else {
          onNotificar('ok', 'Tarea completada')
        }
        router.refresh()
      } else {
        onNotificar('error', res.error ?? 'Error al completar')
      }
    })
  }

  function forzarSeco() {
    if (!confirm('¿Marcar la pieza como ya seca y completar la tarea?')) return
    startTransition(async () => {
      const res = await accionForzarSeco(tarea.id)
      if (res.ok) {
        onNotificar('ok', 'Secado forzado. Tarea completada')
        router.refresh()
      } else {
        onNotificar('error', res.error ?? 'Error al forzar secado')
      }
    })
  }

  function duplicar() {
    if (!confirm('¿Duplicar esta tarea? Se creará una nueva pendiente para rehacer.')) return
    startTransition(async () => {
      const res = await accionDuplicarTarea(tarea.id)
      if (res.ok) {
        onNotificar('ok', 'Tarea duplicada')
        router.refresh()
      } else {
        onNotificar('error', res.error ?? 'Error al duplicar')
      }
    })
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-3 space-y-2 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-bold text-white"
          style={{ backgroundColor: proceso?.color_gantt || '#475569' }}
          title={proceso?.nombre}
        >
          <span className="text-base">{proceso?.abreviatura ?? '?'}</span>
          <span className="text-xs font-normal">
            {proceso?.nombre ?? ''}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={`text-xs ${estadoInfo.clase}`}>
            {estadoInfo.label}
          </Badge>
          {prioridad !== 'normal' && (
            <Badge variant="outline" className={`text-[10px] ${prioridadInfo.clase}`}>
              {prioridadInfo.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-0.5 text-xs">
        <div className="font-mono font-semibold text-sm flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          {pieza?.numero ?? '—'}
          {pieza?.id && (
            <Link
              href={`/etiquetas/pieza/${pieza.id}`}
              target="_blank"
              title="Imprimir etiqueta de esta pieza"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
            >
              <Printer className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        {descripcionPieza && (
          <div className="text-sm text-slate-800 font-medium leading-tight">
            {descripcionPieza}
          </div>
        )}
        {pedido?.numero && (
          <div>
            Pedido <span className="font-mono">{pedido.numero}</span>
            {cliente?.nombre_comercial && (
              <span className="text-muted-foreground"> · {cliente.nombre_comercial}</span>
            )}
          </div>
        )}
        {color?.nombre && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: color.hex_aproximado || '#ccc' }}
            />
            <span>{color.nombre}</span>
          </div>
        )}
        {pieza?.superficie_m2 != null && Number(pieza.superficie_m2) > 0 && (
          <div className="text-muted-foreground">
            {Number(pieza.superficie_m2).toFixed(3)} m²
          </div>
        )}
      </div>

      {operarioAsignado && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="w-4 h-4 rounded-full border border-slate-300"
            style={{ backgroundColor: operarioAsignado.color }}
          />
          <span className="font-medium">{operarioAsignado.nombre}</span>
          {operarioAsignado.rol && (
            <span className="text-muted-foreground">· {operarioAsignado.rol}</span>
          )}
        </div>
      )}

      {estado === 'en_progreso' && transcurridoMs != null && (
        <div className="flex items-center gap-1.5 text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-amber-900 font-medium">
            Trabajando {formatearDiferencia(transcurridoMs)}
          </span>
          {tarea?.tiempo_estimado_minutos && (
            <span className="text-amber-700">
              / est. {formatearMinutos(tarea.tiempo_estimado_minutos)}
            </span>
          )}
        </div>
      )}

      {estado === 'en_secado' && finSecadoMs != null && (
        <div
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
            secadoListo
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">
            {secadoListo
              ? `Listo (${formatearDiferencia(finSecadoMs)} de más)`
              : `Secando — quedan ${formatearDiferencia(finSecadoMs)}`}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {(estado === 'pendiente' || estado === 'en_cola') && (
          <>
            <Button
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => setIniciarOpen(true)}
              disabled={isPending}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Iniciar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setCandidatosOpen(true)}
              disabled={isPending}
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              Operarios
            </Button>
          </>
        )}

        {estado === 'en_progreso' && (
          <>
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (esProcesoMezcla) {
                  setCompletarOpen(true)
                } else {
                  completar()
                }
              }}
              disabled={isPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Completar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-700 hover:bg-red-50"
              onClick={() => setIncidenciaOpen(true)}
              disabled={isPending}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Incidencia
            </Button>
          </>
        )}

        {estado === 'en_secado' && (
          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            onClick={forzarSeco}
            disabled={isPending}
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            Forzar seco
          </Button>
        )}

        {estado === 'incidencia' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={duplicar}
            disabled={isPending}
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Duplicar tarea
          </Button>
        )}

        {(estado === 'completada' || estado === 'en_secado') && esProcesoMezcla && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-orange-700 hover:bg-orange-50 border-orange-300"
            onClick={() => setReabrirOpen(true)}
            disabled={isPending}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reabrir
          </Button>
        )}
      </div>

      {iniciarOpen && (
        <DialogIniciar
          open={iniciarOpen}
          onOpenChange={setIniciarOpen}
          tareaId={tarea.id}
          tareaProceso={proceso?.nombre ?? ''}
          tareaProcesoCodigo={procesoCodigo}
          piezaNumero={pieza?.numero ?? ''}
          operariosActivos={operarios}
          onDone={(ok, texto) => {
            onNotificar(ok ? 'ok' : 'error', texto)
            if (ok) router.refresh()
          }}
        />
      )}

      {completarOpen && (
        <DialogCompletar
          open={completarOpen}
          onOpenChange={setCompletarOpen}
          tareaId={tarea.id}
          tareaProceso={proceso?.nombre ?? ''}
          piezaNumero={pieza?.numero ?? ''}
          onDone={(ok, texto) => {
            onNotificar(ok ? 'ok' : 'error', texto)
            if (ok) router.refresh()
          }}
        />
      )}

      {reabrirOpen && (
        <DialogReabrir
          open={reabrirOpen}
          onOpenChange={setReabrirOpen}
          tareaId={tarea.id}
          tareaProceso={proceso?.nombre ?? ''}
          piezaNumero={pieza?.numero ?? ''}
          operariosActivos={operarios}
          onDone={(ok, texto) => {
            onNotificar(ok ? 'ok' : 'error', texto)
            if (ok) router.refresh()
          }}
        />
      )}

      {incidenciaOpen && (
        <DialogIncidencia
          open={incidenciaOpen}
          onOpenChange={setIncidenciaOpen}
          tareaId={tarea.id}
          onDone={(ok, texto) => {
            onNotificar(ok ? 'ok' : 'error', texto)
            if (ok) router.refresh()
          }}
        />
      )}

      {candidatosOpen && (
        <DialogCandidatos
          open={candidatosOpen}
          onOpenChange={setCandidatosOpen}
          tareaId={tarea.id}
          operariosActivos={operarios}
          onDone={(ok, texto) => {
            onNotificar(ok ? 'ok' : 'error', texto)
            if (ok) router.refresh()
          }}
        />
      )}
    </div>
  )
}
