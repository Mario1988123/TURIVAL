'use client'

/**
 * Componente Gantt del planificador (G3 read-only + G4 drag & drop).
 *
 * Layout:
 *   - Toolbar (navegador fechas, modo carril, filtros)
 *   - Banners de violaciones (plazo / solapes / secuencia)
 *   - Gantt:
 *       · Columna izquierda: nombre del carril (operario / proceso / pedido)
 *       · Columnas: un día cada una
 *       · Cada celda día: contenedor relative con barras absolutas
 *   - Pool lateral "Sin planificar": lista de tareas pendientes de asignar
 *   - Toast flotante inferior (verde/naranja/rojo) para feedback de mutaciones
 *
 * Drag & drop (solo en modo carril = operario):
 *   - Cada barra es draggable (dnd-kit useDraggable).
 *   - Cada celda día-operario es droppable (useDroppable).
 *   - Al soltar, calcula nuevo_inicio a partir de la posición X dentro
 *     del droppable y llama `accionMoverTarea`, que aplica el ripple
 *     server-side.
 *   - Snap a 15 min.
 *
 * CSS: Tailwind + grid CSS puro. Sin librerías de calendario.
 */

import { useMemo, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
  Pause,
  Play,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { VistaPlanificador, FilaPlanificador } from '@/lib/services/planificador'
import { formatearMinutosJornada } from '@/lib/motor/planificador'
import type { PresupuestoPendiente, PedidoConFechaSinReservar } from '@/lib/services/simulador-entrega'
import { accionMoverTarea, accionAutogenerar } from '@/lib/actions/planificador'
import { accionDescansoGlobal, accionDescansoGlobalActivo } from '@/lib/actions/fichajes'
import PanelSugerencias from './panel-sugerencias'
import DialogAutogenerar from './dialog-autogenerar'
import DialogDetalleTarea from './dialog-detalle-tarea'
import Link from 'next/link'
import { FileWarning } from 'lucide-react'

// =============================================================
// CONSTANTES DE LAYOUT
// =============================================================

const ANCHO_LABEL_PX = 200
const ANCHO_DIA_PX = 160
const ALTO_FILA_PX = 64
const ALTO_HEADER_PX = 48
const MIN_JORNADA = 540 // 08:00–17:00
const SNAP_MINUTOS = 15

// =============================================================
// TIPOS
// =============================================================

type ModoCarril = 'operario' | 'proceso' | 'pedido'

interface Props {
  vista: VistaPlanificador
  desde: string
  dias: number
  modo: ModoCarril
  filtros: {
    operario_id?: string
    pedido_id?: string
    prioridad?: string
  }
  presupuestosPendientes?: PresupuestoPendiente[]
  pedidosFechaSinReservar?: PedidoConFechaSinReservar[]
}

interface Carril {
  id: string
  label: string
  sublabel?: string
  color?: string
}

type TipoToast = 'ok' | 'warn' | 'error'
interface Toast {
  id: number
  tipo: TipoToast
  texto: string
  detalle?: string
}

// =============================================================
// HELPERS
// =============================================================

const PRIORIDAD_CLASES: Record<string, string> = {
  urgente: 'bg-red-100 border-red-400 text-red-900',
  alta:    'bg-orange-100 border-orange-400 text-orange-900',
  normal:  'bg-blue-50 border-blue-300 text-blue-900',
  baja:    'bg-slate-100 border-slate-300 text-slate-700',
}

function dosDigitos(n: number): string { return n < 10 ? `0${n}` : `${n}` }

function fechaCorta(d: Date): string {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return `${dias[d.getDay()]} ${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`
}

function hora(d: Date): string {
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
}

function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function isoDia(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

function minutosDesdeInicioJornada(d: Date): number {
  const ini = new Date(d); ini.setHours(8, 0, 0, 0)
  return Math.round((d.getTime() - ini.getTime()) / 60_000)
}

function posicionEnDia(inicio: Date, fin: Date, dia: Date): { left: number; width: number } | null {
  const inicioDia = new Date(dia); inicioDia.setHours(8, 0, 0, 0)
  const finDia = new Date(dia); finDia.setHours(17, 0, 0, 0)
  if (fin <= inicioDia || inicio >= finDia) return null
  const ini = inicio < inicioDia ? inicioDia : inicio
  const fn = fin > finDia ? finDia : fin
  const minIni = Math.max(0, minutosDesdeInicioJornada(ini))
  const minFin = Math.min(MIN_JORNADA, minutosDesdeInicioJornada(fn))
  if (minFin <= minIni) return null
  return { left: (minIni / MIN_JORNADA) * 100, width: ((minFin - minIni) / MIN_JORNADA) * 100 }
}

function generarDias(desde: Date, dias: number): Date[] {
  const r: Date[] = []
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde); d.setDate(d.getDate() + i); r.push(d)
  }
  return r
}

function construirCarriles(vista: VistaPlanificador, modo: ModoCarril): Carril[] {
  if (modo === 'operario') {
    return vista.operarios.map(o => ({ id: o.id, label: o.nombre, sublabel: o.rol }))
  }
  if (modo === 'proceso') {
    const vistos = new Map<string, Carril>()
    for (const t of vista.tareas) {
      if (!vistos.has(t.proceso_codigo)) {
        vistos.set(t.proceso_codigo, { id: t.proceso_codigo, label: t.proceso_nombre, color: t.color_gantt ?? undefined })
      }
    }
    return Array.from(vistos.values())
  }
  const vistosPed = new Map<string, Carril>()
  for (const t of vista.tareas) {
    if (!vistosPed.has(t.pedido_id)) {
      vistosPed.set(t.pedido_id, { id: t.pedido_id, label: t.pedido_numero, sublabel: t.cliente_nombre ?? undefined })
    }
  }
  return Array.from(vistosPed.values())
}

function claveCarril(tarea: FilaPlanificador, modo: ModoCarril): string[] {
  if (modo === 'operario') return tarea.operario_id ? [tarea.operario_id] : []
  if (modo === 'proceso') return [tarea.proceso_codigo]
  return [tarea.pedido_id]
}

/** Convierte un id de droppable 'operarioId__YYYY-MM-DD' a sus partes. */
function parseDroppableId(id: string): { operario_id: string; dia: Date } | null {
  const [op, diaStr] = id.split('__')
  if (!op || !diaStr) return null
  const dia = new Date(`${diaStr}T00:00:00`)
  if (isNaN(dia.getTime())) return null
  return { operario_id: op, dia }
}

function snapTo(mins: number, step: number): number {
  return Math.round(mins / step) * step
}

// =============================================================
// COMPONENTE PRINCIPAL
// =============================================================

export default function PlanificadorCliente({ vista, desde, dias, modo, filtros: _filtros, presupuestosPendientes = [], pedidosFechaSinReservar = [] }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [tareaActiva, setTareaActiva] = useState<FilaPlanificador | null>(null)
  const [detalleTarea, setDetalleTarea] = useState<FilaPlanificador | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [descansoActivo, setDescansoActivo] = useState<boolean>(false)
  const [operariosEnPausa, setOperariosEnPausa] = useState<Set<string>>(new Set())
  const [diaAmpliado, setDiaAmpliado] = useState<Date | null>(null)

  // Cargar estado del descanso global y operarios en pausa al montar
  useEffect(() => {
    accionDescansoGlobalActivo().then(res => {
      if (res.ok && res.data) setDescansoActivo(res.data.activo)
    }).catch(() => undefined)
    // Cargar estado operarios (quiénes están en pausa ahora)
    import('@/lib/actions/fichajes').then(({ accionEstadoOperariosHoy }) => {
      accionEstadoOperariosHoy().then(res => {
        if (res.ok && res.data) {
          const set = new Set<string>()
          for (const op of res.data) if (op.estado === 'en_pausa') set.add(op.operario_id)
          setOperariosEnPausa(set)
        }
      }).catch(() => undefined)
    })
  }, [])

  const tareasPlanificadas = useMemo(
    () => vista.tareas.filter(t => t.inicio_planificado != null),
    [vista.tareas],
  )
  const tareasSinPlanificar = useMemo(
    () => vista.tareas.filter(t => t.inicio_planificado == null),
    [vista.tareas],
  )

  const fechaDesde = useMemo(() => new Date(desde), [desde])
  const listaDias = useMemo(() => generarDias(fechaDesde, dias), [fechaDesde, dias])
  const carriles = useMemo(() => construirCarriles(vista, modo), [vista, modo])

  const tareasPorCarril = useMemo(() => {
    const map = new Map<string, FilaPlanificador[]>()
    for (const t of tareasPlanificadas) {
      for (const k of claveCarril(t, modo)) {
        const arr = map.get(k) ?? []
        arr.push(t)
        map.set(k, arr)
      }
    }
    return map
  }, [tareasPlanificadas, modo])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const dragActivado = modo === 'operario' && !enviando

  // -------- Toast helpers --------
  function pushToast(t: Omit<Toast, 'id'>) {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4500)
  }

  // -------- Navegación --------
  function navegar(delta: number) {
    const d = new Date(fechaDesde); d.setDate(d.getDate() + delta)
    const url = new URL(window.location.href)
    url.searchParams.set('desde', isoDia(d))
    startTransition(() => router.push(url.pathname + url.search))
  }
  function cambiarModo(nuevoModo: ModoCarril) {
    const url = new URL(window.location.href); url.searchParams.set('modo', nuevoModo)
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

  // -------- DnD --------
  function handleDragStart(e: DragStartEvent) {
    const t = tareasPlanificadas.find(x => x.id === e.active.id)
    if (t) setTareaActiva(t)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setTareaActiva(null)
    const { active, over } = e
    if (!over) return

    const tarea = tareasPlanificadas.find(t => t.id === active.id)
    const destino = parseDroppableId(String(over.id))
    if (!tarea || !destino) return

    // Calcular minuto del día a partir de la posición relativa del dragged sobre el droppable.
    const overRect = over.rect
    const translatedRect = active.rect.current.translated
    if (!overRect || !translatedRect) return

    const offsetPx = translatedRect.left - overRect.left
    const anchoDia = overRect.width
    const minCrudo = (offsetPx / anchoDia) * MIN_JORNADA
    const minSnap = Math.max(0, Math.min(MIN_JORNADA - 1, snapTo(minCrudo, SNAP_MINUTOS)))

    const nuevoInicio = new Date(destino.dia)
    nuevoInicio.setHours(8, 0, 0, 0)
    nuevoInicio.setMinutes(minSnap)

    // Si no cambia nada (mismo operario + misma hora snap), skip.
    const iniActual = tarea.inicio_planificado
    if (
      iniActual
      && tarea.operario_id === destino.operario_id
      && iniActual.getTime() === nuevoInicio.getTime()
    ) {
      return
    }

    setEnviando(true)
    try {
      const res = await accionMoverTarea({
        tarea_id: tarea.id,
        nuevo_inicio: nuevoInicio.toISOString(),
        nuevo_operario_id: destino.operario_id,
      })
      if (res.ok) {
        const n = res.cambios.length
        const solapes = res.solapes_generados.length
        const plazo = res.violaciones_plazo.length
        let tipo: TipoToast = 'ok'
        let detalle = `${n - 1} tarea(s) reprogramada(s) por ripple.`
        if (solapes > 0 || plazo > 0) {
          tipo = 'warn'
          detalle = `Ripple aplicado (${n - 1}). ${solapes ? `${solapes} solape(s). ` : ''}${plazo ? `${plazo} pieza(s) pasan de plazo.` : ''}`
        }
        pushToast({
          tipo,
          texto: `Tarea movida a ${fechaCorta(nuevoInicio)} ${hora(nuevoInicio)}`,
          detalle,
        })
        router.refresh()
      } else {
        pushToast({ tipo: 'error', texto: 'No se pudo mover la tarea', detalle: res.error })
      }
    } catch (err) {
      pushToast({ tipo: 'error', texto: 'Error al mover', detalle: err instanceof Error ? err.message : String(err) })
    } finally {
      setEnviando(false)
    }
  }

  const totalAncho = ANCHO_LABEL_PX + listaDias.length * ANCHO_DIA_PX

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col gap-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navegar(-7)} disabled={enviando}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={hoy} disabled={enviando}>Hoy</Button>
            <Button variant="outline" size="sm" onClick={() => navegar(7)} disabled={enviando}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Calendar className="h-4 w-4" />
            {fechaCorta(listaDias[0])} – {fechaCorta(listaDias[listaDias.length - 1])}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <PanelSugerencias
              desde={vista.rango.desde}
              hasta={vista.rango.hasta}
              operarios={vista.operarios}
              onAfterApply={() => router.refresh()}
            />
            <DialogAutogenerar
              desde={vista.rango.desde}
              hasta={vista.rango.hasta}
              onAfterApply={() => router.refresh()}
            />
            <Button
              variant={descansoActivo ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              title={descansoActivo ? 'Reanudar taller (cierra descanso global)' : 'Iniciar descanso global del taller'}
              onClick={async () => {
                setEnviando(true)
                try {
                  const res = await accionDescansoGlobal(!descansoActivo)
                  if (!res.ok) {
                    pushToast({
                      tipo: res.hint === 'instalar_031' ? 'warn' : 'error',
                      texto: res.hint === 'instalar_031' ? 'Falta ejecutar SQL 031' : 'No se pudo registrar',
                      detalle: res.error,
                    })
                  } else {
                    setDescansoActivo(!descansoActivo)
                    pushToast({
                      tipo: 'ok',
                      texto: descansoActivo ? 'Taller reanudado' : 'Descanso iniciado',
                    })
                  }
                } finally { setEnviando(false) }
              }}
              disabled={enviando}
            >
              {descansoActivo ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {descansoActivo ? 'Reanudar' : 'Descanso'}
            </Button>
            <Select value={String(dias)} onValueChange={cambiarDias}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-md border bg-slate-50 p-0.5 text-sm">
              <button className={`rounded px-3 py-1 ${modo === 'operario' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`} onClick={() => cambiarModo('operario')}>Operario</button>
              <button className={`rounded px-3 py-1 ${modo === 'proceso' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`} onClick={() => cambiarModo('proceso')}>Proceso</button>
              <button className={`rounded px-3 py-1 ${modo === 'pedido' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`} onClick={() => cambiarModo('pedido')}>Pedido</button>
            </div>
          </div>
        </div>

        {/* Aviso cuando drag no disponible */}
        {modo !== 'operario' && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Para arrastrar tareas, cambia a modo <strong>Operario</strong>.
          </div>
        )}

        {/* Banners de violaciones + operarios parados + presupuestos pendientes */}
        <BannersViolaciones vista={vista} />
        <BannerOperariosParados vista={vista} />
        {pedidosFechaSinReservar.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-orange-400 bg-orange-50 px-3 py-2 text-sm text-orange-900">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {pedidosFechaSinReservar.length} pedido(s) con fecha acordada pero sin reservar hueco
              </div>
              <div className="mt-0.5 text-xs">
                Fecha comprometida con cliente pero las tareas aún no están planificadas en el Gantt. Si metes otros trabajos en esos huecos, habrá que renegociar.
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pedidosFechaSinReservar.slice(0, 8).map((p) => (
                  <BotonReservarPedido key={p.id} pedido={p} />
                ))}
                {pedidosFechaSinReservar.length > 8 && (
                  <span className="text-xs text-orange-800">+{pedidosFechaSinReservar.length - 8} más</span>
                )}
              </div>
            </div>
          </div>
        )}
        {presupuestosPendientes.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {presupuestosPendientes.length} presupuesto(s) pendientes de aceptar
              </div>
              <div className="mt-0.5 text-xs">
                Si llenas los huecos con otros trabajos y luego aceptan, habrá que recalcular fechas.
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {presupuestosPendientes.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/presupuestos/${p.id}`}
                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-mono hover:bg-amber-100"
                    title={`${p.cliente_nombre} · ${p.piezas_count} pieza(s) · ${p.total.toFixed(0)}€`}
                  >
                    <span className="font-semibold">{p.numero}</span>
                    <span className="text-slate-600">· {p.cliente_nombre}</span>
                    {p.fecha_entrega_estimada && (
                      <span className="text-slate-500">
                        · {new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </Link>
                ))}
                {presupuestosPendientes.length > 6 && (
                  <span className="text-xs text-amber-800">+{presupuestosPendientes.length - 6} más</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span>Prioridad:</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-red-400 bg-red-100" />urgente</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-orange-400 bg-orange-100" />alta</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-blue-300 bg-blue-50" />normal</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-100" />baja</span>
          <span className="ml-auto text-slate-500">Jornada 08:00–17:00 · {tareasPlanificadas.length} planificadas · {tareasSinPlanificar.length} sin planificar · snap {SNAP_MINUTOS} min</span>
        </div>

        {/* Gantt */}
        <div className="flex-1 overflow-auto rounded-lg border bg-white">
          <div style={{ width: totalAncho, minWidth: '100%' }}>
            <div
              className="sticky top-0 z-20 grid border-b bg-white"
              style={{ gridTemplateColumns: `${ANCHO_LABEL_PX}px repeat(${listaDias.length}, ${ANCHO_DIA_PX}px)`, height: ALTO_HEADER_PX }}
            >
              <div className="flex items-center justify-center border-r bg-slate-50 text-xs font-semibold text-slate-700">
                {modo === 'operario' ? 'Operario' : modo === 'proceso' ? 'Proceso' : 'Pedido'}
              </div>
              {listaDias.map((d, i) => {
                const finSemana = d.getDay() === 0 || d.getDay() === 6
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDiaAmpliado(d)}
                    className={`flex flex-col items-center justify-center border-r text-xs hover:bg-blue-50 transition-colors ${finSemana ? 'bg-slate-100 text-slate-500' : 'text-slate-700'}`}
                    title="Click para ver el día ampliado"
                  >
                    <div className="font-medium underline-offset-2 hover:underline">{fechaCorta(d)}</div>
                    <div className="text-[10px] text-slate-500">08:00–17:00 · ampliar</div>
                  </button>
                )
              })}
            </div>

            {carriles.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No hay tareas planificadas en este rango. Prueba otras fechas o cambia el modo de carril.
              </div>
            ) : (
              carriles.map((c, idx) => (
                <FilaCarril
                  key={c.id}
                  carril={c}
                  dias={listaDias}
                  tareas={(tareasPorCarril.get(c.id) ?? [])}
                  alternado={idx % 2 === 1}
                  modo={modo}
                  dragActivado={dragActivado}
                  onVerDetalles={setDetalleTarea}
                  operarioEnPausa={modo === 'operario' && operariosEnPausa.has(c.id)}
                  onToggleOperarioPausa={modo === 'operario' ? async (operario_id, pausar) => {
                    const { accionRegistrarFichaje } = await import('@/lib/actions/fichajes')
                    const tipo = pausar ? 'pausa_inicio' : 'pausa_fin'
                    // Si no está "dentro" hay que meter entrada antes
                    if (pausar) {
                      // Asegurar entrada
                      const resEntrada = await accionRegistrarFichaje({ operario_id, tipo: 'entrada' })
                      if (!resEntrada.ok && !resEntrada.error?.includes('Ya hay una entrada')) {
                        pushToast({ tipo: 'error', texto: 'Error', detalle: resEntrada.error })
                        return
                      }
                    }
                    const res = await accionRegistrarFichaje({ operario_id, tipo })
                    if (res.ok) {
                      setOperariosEnPausa(prev => {
                        const next = new Set(prev)
                        if (pausar) next.add(operario_id); else next.delete(operario_id)
                        return next
                      })
                      pushToast({ tipo: 'ok', texto: pausar ? 'Operario pausado' : 'Operario reanudado' })
                    } else {
                      pushToast({ tipo: 'error', texto: 'Error', detalle: res.error })
                    }
                  } : undefined}
                />
              ))
            )}
          </div>
        </div>

        {tareasSinPlanificar.length > 0 && <PoolSinPlanificar tareas={tareasSinPlanificar} />}

        {/* Toast flotante */}
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
          {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
        </div>
      </div>

      {/* Overlay que sigue al cursor mientras arrastras */}
      <DragOverlay>
        {tareaActiva ? <BarraFantasma tarea={tareaActiva} /> : null}
      </DragOverlay>

      {/* Dialog de detalle (doble click) */}
      <DialogDetalleTarea
        tarea={detalleTarea}
        onClose={() => setDetalleTarea(null)}
        onAfterAction={() => setDetalleTarea(null)}
      />

      {/* Dialog del día ampliado (clic en cabecera del día) */}
      {diaAmpliado && (
        <DialogDiaAmpliado
          dia={diaAmpliado}
          carriles={carriles}
          tareasPorCarril={tareasPorCarril}
          modo={modo}
          onClose={() => setDiaAmpliado(null)}
          onVerDetalles={(t) => { setDiaAmpliado(null); setDetalleTarea(t) }}
        />
      )}
    </DndContext>
  )
}

// Context para que BarraTareaDraggable pueda abrir el dialog sin prop-drilling
function usePlanificadorSetDetalle(): (t: FilaPlanificador) => void {
  // Placeholder — se sobreescribe via contexto si hiciera falta.
  // En G4 lo pasábamos por props; aquí lo dejamos como prop directa.
  return () => undefined
}
void usePlanificadorSetDetalle

// =============================================================
// SUB-COMPONENTES
// =============================================================

function FilaCarril({
  carril,
  dias,
  tareas,
  alternado,
  modo,
  dragActivado,
  onVerDetalles,
  operarioEnPausa,
  onToggleOperarioPausa,
}: {
  carril: Carril
  dias: Date[]
  tareas: FilaPlanificador[]
  alternado: boolean
  modo: ModoCarril
  dragActivado: boolean
  onVerDetalles: (t: FilaPlanificador) => void
  operarioEnPausa?: boolean
  onToggleOperarioPausa?: (operario_id: string, pausar: boolean) => void
}) {
  return (
    <div
      className={`grid border-b ${alternado ? 'bg-slate-50/50' : 'bg-white'} ${operarioEnPausa ? 'bg-amber-50/60' : ''}`}
      style={{ gridTemplateColumns: `${ANCHO_LABEL_PX}px repeat(${dias.length}, ${ANCHO_DIA_PX}px)`, minHeight: ALTO_FILA_PX }}
    >
      <div className="flex items-center gap-2 border-r px-3 text-sm">
        {carril.color && <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: carril.color }} />}
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium text-slate-800">{carril.label}</div>
          {carril.sublabel && <div className="truncate text-xs text-slate-500">{carril.sublabel}</div>}
        </div>
        {modo === 'operario' && onToggleOperarioPausa && (
          <button
            onClick={() => onToggleOperarioPausa(carril.id, !operarioEnPausa)}
            className={`flex-shrink-0 rounded p-1 text-xs ${operarioEnPausa ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
            title={operarioEnPausa ? 'Reanudar este operario' : 'Pausar este operario'}
          >
            {operarioEnPausa ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
        )}
      </div>
      {dias.map((dia, i) => (
        <CeldaDia
          key={i}
          dia={dia}
          tareas={tareas}
          droppableId={modo === 'operario' ? `${carril.id}__${isoDia(dia)}` : undefined}
          dragActivado={dragActivado}
          onVerDetalles={onVerDetalles}
        />
      ))}
    </div>
  )
}

function CeldaDia({
  dia,
  tareas,
  droppableId,
  dragActivado,
  onVerDetalles,
}: {
  dia: Date
  tareas: FilaPlanificador[]
  droppableId?: string
  dragActivado: boolean
  onVerDetalles: (t: FilaPlanificador) => void
}) {
  const finSemana = dia.getDay() === 0 || dia.getDay() === 6
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const esHoy = esMismoDia(dia, hoy)

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? `__disabled__${Math.random()}`,
    disabled: !dragActivado || !droppableId,
  })

  const barras = tareas
    .map(t => {
      const pos = posicionEnDia(t.inicio, t.fin, dia)
      if (!pos) return null
      return { tarea: t, ...pos }
    })
    .filter((x): x is { tarea: FilaPlanificador; left: number; width: number } => x != null)

  return (
    <div
      ref={setNodeRef}
      className={`relative border-r ${finSemana ? 'bg-slate-100' : ''} ${esHoy ? 'bg-yellow-50' : ''} ${isOver ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-400' : ''}`}
      style={{ minHeight: ALTO_FILA_PX }}
    >
      <div className="pointer-events-none absolute inset-0">
        {[2, 4, 6, 8].map(h => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${(h * 60 / MIN_JORNADA) * 100}%` }} />
        ))}
      </div>
      {barras.map(({ tarea, left, width }) => (
        <BarraTareaDraggable
          key={tarea.id}
          tarea={tarea}
          left={left}
          width={width}
          dragActivado={dragActivado}
          onVerDetalles={onVerDetalles}
        />
      ))}
    </div>
  )
}

function BarraTareaDraggable({
  tarea,
  left,
  width,
  dragActivado,
  onVerDetalles,
}: {
  tarea: FilaPlanificador
  left: number
  width: number
  dragActivado: boolean
  onVerDetalles: (t: FilaPlanificador) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tarea.id,
    disabled: !dragActivado,
  })

  const claseFondo = PRIORIDAD_CLASES[tarea.pedido_prioridad] ?? PRIORIDAD_CLASES.normal
  const bordeIzquierdo = tarea.color_gantt ?? '#64748b'
  // Reservas tentativas: tareas creadas desde un presupuesto sin confirmar.
  // Se pintan difuminadas + borde punteado para que Mario sepa que hay que
  // validarlas antes de tomarlas como ocupadas firmes.
  const esTentativa = (tarea as any).tentativa === true
  const titulo = `${tarea.pedido_numero} · ${tarea.proceso_nombre} · ${tarea.pieza_numero}\n`
    + `${hora(tarea.inicio)} – ${hora(tarea.fin)}`
    + (tarea.requiere_secado ? ` (+${tarea.tiempo_secado_minutos}m secado)` : '')
    + (tarea.operario_nombre ? `\nOperario: ${tarea.operario_nombre}` : '')
    + (esTentativa ? '\n⚠️ Reserva tentativa (presupuesto sin confirmar)' : '')
    + `\n\nDoble clic: ver detalle${dragActivado ? ' · Arrastra: reprogramar' : ''}`

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={(e) => { e.stopPropagation(); onVerDetalles(tarea) }}
      className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded border text-xs ${claseFondo} ${isDragging ? 'opacity-30' : ''} ${esTentativa ? 'opacity-60' : ''} ${dragActivado ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        left: `${left}%`,
        width: `${Math.max(0.5, width)}%`,
        borderLeftColor: bordeIzquierdo,
        borderLeftWidth: 4,
        borderStyle: esTentativa ? 'dashed' : 'solid',
      }}
      title={titulo}
    >
      <div className="flex h-full flex-col justify-center gap-0.5 px-1.5">
        <div className="truncate font-semibold">
          {esTentativa && '⚠️ '}
          {tarea.proceso_abreviatura || tarea.proceso_codigo} · {tarea.pieza_numero}
        </div>
        <div className="truncate text-[10px] opacity-80">
          {tarea.pedido_numero}
          {tarea.operario_nombre ? ` · ${tarea.operario_nombre}` : ''}
          {tarea.requiere_secado ? ' · 🕓' : ''}
        </div>
      </div>
    </div>
  )
}

function BarraFantasma({ tarea }: { tarea: FilaPlanificador }) {
  const claseFondo = PRIORIDAD_CLASES[tarea.pedido_prioridad] ?? PRIORIDAD_CLASES.normal
  const bordeIzquierdo = tarea.color_gantt ?? '#64748b'
  return (
    <div
      className={`pointer-events-none h-12 rounded border shadow-lg ${claseFondo}`}
      style={{ width: 180, borderLeftColor: bordeIzquierdo, borderLeftWidth: 4 }}
    >
      <div className="flex h-full flex-col justify-center gap-0.5 px-2 text-xs">
        <div className="truncate font-semibold">
          {tarea.proceso_abreviatura || tarea.proceso_codigo} · {tarea.pieza_numero}
        </div>
        <div className="truncate text-[10px] opacity-80">{tarea.pedido_numero}</div>
      </div>
    </div>
  )
}

function BannerOperariosParados({ vista }: { vista: VistaPlanificador }) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const limite = new Date(hoy); limite.setDate(limite.getDate() + 3)
  const MINIMO_CARGA_MIN = 180 // 3h

  const cargaPorOperario = new Map<string, number>()
  for (const t of vista.tareas) {
    if (!t.operario_id || t.inicio_planificado == null) continue
    if (t.inicio_planificado < hoy || t.inicio_planificado >= limite) continue
    cargaPorOperario.set(t.operario_id, (cargaPorOperario.get(t.operario_id) ?? 0) + t.tiempo_estimado_minutos)
  }

  const parados = vista.operarios
    .filter(o => o.activo)
    .map(o => ({ operario: o, carga: cargaPorOperario.get(o.id) ?? 0 }))
    .filter(x => x.carga < MINIMO_CARGA_MIN)

  if (parados.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      <Users className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <div className="font-medium">{parados.length} operario(s) con poca carga en los próximos 3 días</div>
        <div className="text-xs">
          {parados.slice(0, 3).map(p => `${p.operario.nombre}: ${p.carga} min`).join(' · ')}
          {parados.length > 3 ? '…' : ''}
        </div>
      </div>
    </div>
  )
}

function BannersViolaciones({ vista }: { vista: VistaPlanificador }) {
  const { solapes, violaciones_plazo, violaciones_secuencia } = vista
  const hayAlgo = solapes.length + violaciones_plazo.length + violaciones_secuencia.length > 0
  if (!hayAlgo) return null

  return (
    <div className="flex flex-wrap gap-2">
      {violaciones_plazo.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-medium">{violaciones_plazo.length} pieza(s) pasan de plazo</div>
            <div className="text-xs">
              {violaciones_plazo.slice(0, 3).map(v => `+${formatearMinutosJornada(v.retraso_minutos)}`).join(', ')}
              {violaciones_plazo.length > 3 ? '…' : ''}
              <span className="ml-1 text-slate-500">(horas de jornada laboral)</span>
            </div>
          </div>
        </div>
      )}
      {solapes.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-medium">{solapes.length} solape(s) de operario</div>
            <div className="text-xs">dos tareas asignadas al mismo operario en la misma franja</div>
          </div>
        </div>
      )}
      {violaciones_secuencia.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-medium">{violaciones_secuencia.length} tarea(s) violan secuencia</div>
            <div className="text-xs">empiezan antes de terminar su predecesora</div>
          </div>
        </div>
      )}
    </div>
  )
}

function PoolSinPlanificar({ tareas }: { tareas: FilaPlanificador[] }) {
  const [expandido, setExpandido] = useState(false)
  const mostrar = expandido ? tareas : tareas.slice(0, 6)

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">Sin planificar ({tareas.length})</div>
        {tareas.length > 6 && (
          <Button variant="ghost" size="sm" onClick={() => setExpandido(v => !v)}>
            {expandido ? 'Ver menos' : `Ver todas (${tareas.length})`}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {mostrar.map(t => (
          <div
            key={t.id}
            className={`rounded border px-2 py-1 text-xs ${PRIORIDAD_CLASES[t.pedido_prioridad] ?? PRIORIDAD_CLASES.normal}`}
            title={`${t.pedido_numero} · ${t.proceso_nombre} · ${t.pieza_numero}${t.tiempo_estimado_minutos ? ` · ${t.tiempo_estimado_minutos}m` : ''}`}
          >
            <span className="font-medium">{t.proceso_abreviatura || t.proceso_codigo}</span>
            <span className="text-slate-600"> · {t.pieza_numero}</span>
            <span className="ml-1 text-[10px] text-slate-500">{t.pedido_numero}</span>
          </div>
        ))}
      </div>
      {tareas.length === 0 && <div className="text-xs text-slate-500">No hay tareas pendientes de asignar.</div>}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const clases = toast.tipo === 'ok'
    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
    : toast.tipo === 'warn'
      ? 'border-orange-400 bg-orange-50 text-orange-900'
      : 'border-red-400 bg-red-50 text-red-900'
  const Icon = toast.tipo === 'ok' ? CheckCircle2 : toast.tipo === 'warn' ? AlertTriangle : XCircle
  return (
    <div className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-4 py-3 shadow-lg ${clases}`}>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{toast.texto}</div>
        {toast.detalle && <div className="mt-0.5 text-xs opacity-80">{toast.detalle}</div>}
      </div>
    </div>
  )
}

// =============================================================
// Botón "Reservar hueco" del banner de pedidos sin planificar.
// Llama al autogenerar filtrado por pedido_id y refresca la vista.
// =============================================================

// =============================================================
// Dialog "Día ampliado" — vista detallada de un día concreto
// con todas las tareas de todos los carriles, sin solapes.
// =============================================================

function DialogDiaAmpliado({
  dia,
  carriles,
  tareasPorCarril,
  modo,
  onClose,
  onVerDetalles,
}: {
  dia: Date
  carriles: Carril[]
  tareasPorCarril: Map<string, FilaPlanificador[]>
  modo: ModoCarril
  onClose: () => void
  onVerDetalles: (t: FilaPlanificador) => void
}) {
  const inicioDia = new Date(dia); inicioDia.setHours(0, 0, 0, 0)
  const finDia = new Date(dia); finDia.setHours(23, 59, 59, 999)

  // Granularidad de la cuadrícula del Gantt ampliado: 15 ó 30 min.
  // Mario lo pidió así (25-abr noche).
  const [granularidadMin, setGranularidadMin] = useState<15 | 30>(15)

  // Jornada visible: 08:00–17:00 = 540 min
  const HORA_INI = 8
  const HORA_FIN = 17
  const minutosJornada = (HORA_FIN - HORA_INI) * 60

  // Agrupar tareas del día por carril (incluye tareas que entran ese día,
  // aunque hayan empezado el día anterior).
  const filasConTareas: Array<{ carril: Carril; tareas: FilaPlanificador[] }> = []
  let totalDia = 0
  for (const c of carriles) {
    const todas = tareasPorCarril.get(c.id) ?? []
    const delDia = todas.filter((t) => {
      if (!t.inicio_planificado) return false
      const ini = new Date(t.inicio_planificado).getTime()
      const dur = (t.tiempo_estimado_minutos ?? 0) * 60_000
      const fin = ini + dur
      // Cruza el día si: empieza antes del finDia y acaba después del inicioDia
      return ini <= finDia.getTime() && fin >= inicioDia.getTime()
    }).sort((a, b) =>
      new Date(a.inicio_planificado!).getTime() - new Date(b.inicio_planificado!).getTime()
    )
    if (delDia.length > 0) {
      filasConTareas.push({ carril: c, tareas: delDia })
      totalDia += delDia.length
    }
  }

  // Helpers para posicionar barras en la cuadrícula
  function minutosDesdeInicioJornada(d: Date): number {
    const h = d.getHours() + d.getMinutes() / 60
    return Math.round((h - HORA_INI) * 60)
  }

  // Marcas de tiempo verticales (cada `granularidadMin`)
  const totalSlots = Math.ceil(minutosJornada / granularidadMin)
  const slots: number[] = Array.from({ length: totalSlots + 1 }, (_, i) => i * granularidadMin)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {dia.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-xs text-slate-500">
              {totalDia} {totalDia === 1 ? 'tarea' : 'tareas'} · jornada 08:00–17:00 · vista por {modo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Cuadricula:</span>
            <button
              type="button"
              onClick={() => setGranularidadMin(15)}
              className={`rounded px-2 py-1 text-xs ${granularidadMin === 15 ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              15 min
            </button>
            <button
              type="button"
              onClick={() => setGranularidadMin(30)}
              className={`rounded px-2 py-1 text-xs ${granularidadMin === 30 ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              30 min
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* === VISTA 1: GANTT AMPLIADO (cuadrícula 15/30 min) === */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">
              Gantt ampliado · cuadricula de {granularidadMin} min
            </h3>
            {filasConTareas.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                No hay tareas planificadas en este día.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-white">
                <div style={{ minWidth: 64 + totalSlots * Math.max(8, 28 - granularidadMin / 2) }}>
                  {/* Header de horas */}
                  <div
                    className="sticky top-0 z-10 grid border-b bg-slate-50"
                    style={{ gridTemplateColumns: `120px repeat(${totalSlots}, minmax(0, 1fr))` }}
                  >
                    <div className="border-r px-2 py-1 text-[10px] font-semibold text-slate-600">
                      Operario / proceso
                    </div>
                    {slots.slice(0, -1).map((min, i) => {
                      const h = HORA_INI + Math.floor(min / 60)
                      const m = min % 60
                      // Mostrar etiqueta solo cada 30 min para no apelmazar cuando es 15min
                      const mostrarLabel = granularidadMin === 30 || m === 0 || m === 30
                      const esHora = m === 0
                      return (
                        <div
                          key={i}
                          className={`border-r px-0.5 py-1 text-center text-[9px] ${esHora ? 'font-semibold text-slate-700 bg-white' : 'text-slate-400'}`}
                        >
                          {mostrarLabel ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : ''}
                        </div>
                      )
                    })}
                  </div>

                  {/* Filas con barras posicionadas */}
                  {filasConTareas.map(({ carril, tareas }) => (
                    <div
                      key={carril.id}
                      className="grid border-b last:border-b-0 hover:bg-slate-50/40"
                      style={{ gridTemplateColumns: `120px 1fr` }}
                    >
                      <div className="border-r px-2 py-2 text-xs">
                        <div className="font-semibold text-slate-800 truncate">{carril.label}</div>
                        {carril.sublabel && <div className="text-[10px] text-slate-500 truncate">{carril.sublabel}</div>}
                      </div>
                      {/* Pista con barras absolutas */}
                      <div className="relative h-12">
                        {/* Líneas verticales de la cuadrícula */}
                        {slots.slice(1, -1).map((min, i) => {
                          const left = (min / minutosJornada) * 100
                          const esHora = min % 60 === 0
                          return (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 border-l"
                              style={{
                                left: `${left}%`,
                                borderColor: esHora ? '#cbd5e1' : '#e2e8f0',
                              }}
                            />
                          )
                        })}
                        {/* Barras de tareas */}
                        {tareas.map((t) => {
                          const ini = new Date(t.inicio_planificado!)
                          const dur = t.tiempo_estimado_minutos ?? 0
                          const minDesdeJornada = minutosDesdeInicioJornada(ini)
                          // Recortar al rango visible
                          const startMin = Math.max(0, minDesdeJornada)
                          const endMin = Math.min(minutosJornada, minDesdeJornada + dur)
                          if (endMin <= 0 || startMin >= minutosJornada) return null
                          const left = (startMin / minutosJornada) * 100
                          const width = ((endMin - startMin) / minutosJornada) * 100
                          const horaIni = ini.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                          const finReal = new Date(ini.getTime() + dur * 60_000)
                          const horaFin = finReal.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                          const claseFondo = PRIORIDAD_CLASES[t.pedido_prioridad] ?? PRIORIDAD_CLASES.normal
                          const borde = t.color_gantt ?? '#64748b'
                          return (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => onVerDetalles(t)}
                              title={`${t.pedido_numero} · ${t.proceso_nombre} · ${t.pieza_numero}\n${horaIni}–${horaFin}`}
                              className={`absolute top-1 bottom-1 overflow-hidden rounded border text-[10px] hover:ring-2 hover:ring-blue-400 transition-shadow ${claseFondo}`}
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(0.5, width)}%`,
                                borderLeftColor: borde,
                                borderLeftWidth: 3,
                              }}
                            >
                              <div className="flex h-full flex-col justify-center px-1">
                                <div className="truncate font-semibold">
                                  {t.proceso_abreviatura || t.proceso_codigo} · {t.pieza_numero}
                                </div>
                                <div className="truncate opacity-80">
                                  {horaIni}–{horaFin} · {dur}min
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* === VISTA 2: LISTA DETALLADA (la que ya tenia) === */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Lista detallada</h3>
            {filasConTareas.length === 0 ? null : (
              <div className="space-y-3">
                {filasConTareas.map(({ carril, tareas }) => (
                  <div key={carril.id} className="rounded-md border bg-white">
                    <div
                      className="border-b bg-slate-50 px-3 py-2"
                      style={{ borderLeft: carril.color ? `4px solid ${carril.color}` : undefined }}
                    >
                      <div className="text-sm font-semibold text-slate-800">{carril.label}</div>
                      {carril.sublabel && <div className="text-xs text-slate-500">{carril.sublabel}</div>}
                    </div>
                    <ul className="divide-y">
                      {tareas.map((t) => {
                        const ini = new Date(t.inicio_planificado!)
                        const finMs = ini.getTime() + (t.tiempo_estimado_minutos ?? 0) * 60_000
                        const fin = new Date(finMs)
                        const horaIni = ini.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                        const horaFin = fin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => onVerDetalles(t)}
                              className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-blue-50"
                            >
                              <div className="font-mono text-xs font-semibold text-slate-700 w-28 flex-shrink-0">
                                {horaIni}–{horaFin}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">
                                  {t.proceso_codigo} · {t.pedido_numero ?? '—'}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {t.cliente_nombre ?? '—'} · {t.tiempo_estimado_minutos ?? 0} min
                                </div>
                              </div>
                              <div className="text-xs text-slate-400">→ ver</div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function BotonReservarPedido({ pedido }: { pedido: PedidoConFechaSinReservar }) {
  const router = useRouter()
  const [aplicando, setAplicando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reservar() {
    setAplicando(true)
    setError(null)
    try {
      const res = await accionAutogenerar({ pedido_id: pedido.id, dry_run: false })
      if (res.ok) {
        setHecho(true)
        router.refresh()
      } else {
        setError(res.error ?? 'Error desconocido')
      }
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded border border-orange-300 bg-white px-2 py-0.5 text-[11px]">
      <Link href={`/pedidos/${pedido.id}`} className="font-mono font-semibold hover:underline">
        {pedido.numero}
      </Link>
      <span className="text-slate-600">· {pedido.cliente_nombre}</span>
      <span className="font-mono font-semibold text-red-700">
        {new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
      </span>
      {hecho ? (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> reservado
        </span>
      ) : (
        <button
          type="button"
          onClick={reservar}
          disabled={aplicando}
          className="ml-1 rounded bg-orange-600 px-1.5 py-0.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          title={error ?? 'Planificar este pedido en huecos libres'}
        >
          {aplicando ? '…' : 'Reservar hueco'}
        </button>
      )}
    </div>
  )
}
