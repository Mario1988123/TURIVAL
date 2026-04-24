'use client'

/**
 * Dialog de detalle de una tarea en el Gantt.
 * Se abre al hacer doble click en una barra.
 *
 * Muestra info completa y permite:
 *   - Ir al pedido.
 *   - Desasignar la tarea (volver al pool sin planificar).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Unlink, Loader2 } from 'lucide-react'
import { accionDesasignarTarea } from '@/lib/actions/planificador'
import type { FilaPlanificador } from '@/lib/services/planificador'

interface Props {
  tarea: FilaPlanificador | null
  onClose: () => void
  onAfterAction: () => void
}

function dosDigitos(n: number): string { return n < 10 ? `0${n}` : `${n}` }
function hora(d: Date): string { return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}` }
function fechaCompleta(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function DialogDetalleTarea({ tarea, onClose, onAfterAction }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [enviando, setEnviando] = useState(false)

  async function desasignar() {
    if (!tarea) return
    if (!confirm(`¿Desasignar la tarea "${tarea.proceso_nombre}" de ${tarea.pieza_numero}?\nVolverá al pool sin planificar.`)) return
    setEnviando(true)
    try {
      const res = await accionDesasignarTarea(tarea.id)
      if (res.ok) {
        startTransition(() => {
          router.refresh()
          onAfterAction()
        })
      } else {
        alert(`Error: ${res.error}`)
      }
    } finally {
      setEnviando(false)
    }
  }

  function irAlPedido() {
    if (!tarea) return
    router.push(`/pedidos/${tarea.pedido_id}`)
  }

  const abierto = tarea != null

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tarea?.proceso_nombre}
            <Badge variant="outline" className="text-xs">
              {tarea?.proceso_abreviatura || tarea?.proceso_codigo}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {tarea && (
          <div className="flex flex-col gap-3 text-sm">
            <Row etiqueta="Pedido" valor={tarea.pedido_numero} />
            {tarea.cliente_nombre && <Row etiqueta="Cliente" valor={tarea.cliente_nombre} />}
            <Row etiqueta="Pieza" valor={tarea.pieza_numero} />
            <Row etiqueta="Prioridad" valor={<Badge variant="outline">{tarea.pedido_prioridad}</Badge>} />
            {tarea.pedido_fecha_entrega_estimada && (
              <Row etiqueta="Entrega prevista" valor={fechaCompleta(tarea.pedido_fecha_entrega_estimada)} />
            )}
            <div className="my-1 border-t" />
            {tarea.inicio_planificado ? (
              <>
                <Row etiqueta="Inicio planificado" valor={`${fechaCompleta(tarea.inicio)} · ${hora(tarea.inicio)}`} />
                <Row etiqueta="Fin estimado" valor={hora(tarea.fin)} />
                {tarea.requiere_secado && (
                  <Row etiqueta="Fin con secado" valor={`${hora(tarea.fin_con_secado)} (+${tarea.tiempo_secado_minutos} min)`} />
                )}
                <Row etiqueta="Operario" valor={tarea.operario_nombre ?? '—'} />
              </>
            ) : (
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">Sin planificar.</div>
            )}
            <Row etiqueta="Duración estimada" valor={`${tarea.tiempo_estimado_minutos} min`} />
            {tarea.rol_operario_requerido && (
              <Row etiqueta="Rol requerido" valor={tarea.rol_operario_requerido} />
            )}
            <Row etiqueta="Secuencia" valor={`${tarea.secuencia}${tarea.es_opcional ? ' (opcional)' : ''}`} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {tarea?.inicio_planificado && (
            <Button variant="outline" onClick={desasignar} disabled={enviando} className="gap-1.5">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Desasignar
            </Button>
          )}
          <Button variant="default" onClick={irAlPedido} className="gap-1.5">
            <ExternalLink className="h-4 w-4" /> Ir al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{etiqueta}</span>
      <span className="text-sm font-medium text-slate-800">{valor}</span>
    </div>
  )
}
