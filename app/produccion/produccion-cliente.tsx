'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Factory,
  LayoutGrid,
  List,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { Operario } from '@/lib/services/operarios'
import TareaCard from './tarea-card'

// =============================================================
// Constantes
// =============================================================

type Vista = 'kanban' | 'lista'

const ESTADOS_COLUMNAS: Array<{
  key: string
  label: string
  includes: string[]
  colorClase: string
}> = [
  {
    key: 'en_cola',
    label: 'En cola',
    includes: ['pendiente', 'en_cola'],
    colorClase: 'border-slate-300 bg-slate-50',
  },
  {
    key: 'en_progreso',
    label: 'En progreso',
    includes: ['en_progreso'],
    colorClase: 'border-amber-300 bg-amber-50',
  },
  {
    key: 'en_secado',
    label: 'En secado',
    includes: ['en_secado'],
    colorClase: 'border-purple-300 bg-purple-50',
  },
  {
    key: 'completada',
    label: 'Completadas hoy',
    includes: ['completada'],
    colorClase: 'border-emerald-300 bg-emerald-50',
  },
  {
    key: 'incidencia',
    label: 'Incidencias',
    includes: ['incidencia'],
    colorClase: 'border-red-300 bg-red-50',
  },
]

const SIN_FILTRO = '__todos__'

// =============================================================
// Componente principal
// =============================================================

export default function ProduccionCliente({
  tareasIniciales,
  operarios,
}: {
  tareasIniciales: any[]
  operarios: Operario[]
}) {
  const router = useRouter()
  const [tareas, setTareas] = useState<any[]>(tareasIniciales)
  const [vista, setVista] = useState<Vista>('kanban')
  const [filtroProceso, setFiltroProceso] = useState<string>(SIN_FILTRO)
  const [filtroOperario, setFiltroOperario] = useState<string>(SIN_FILTRO)
  const [filtroPedido, setFiltroPedido] = useState<string>(SIN_FILTRO)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)
  const [refrescando, setRefrescando] = useState(false)

  useEffect(() => {
    setTareas(tareasIniciales)
  }, [tareasIniciales])

  const [ahora, setAhora] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const notificar = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 3000)
  }, [])

  async function refrescar() {
    setRefrescando(true)
    router.refresh()
    setTimeout(() => setRefrescando(false), 600)
  }

  // =========================================================
  // Derivadas: procesos únicos, pedidos únicos (con cliente)
  // =========================================================
  const procesosDisponibles = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; abrev: string | null }>()
    for (const t of tareas) {
      const p = t?.proceso
      if (!p?.id) continue
      if (!m.has(p.id)) {
        m.set(p.id, {
          id: p.id,
          nombre: p.nombre ?? p.codigo ?? '?',
          abrev: p.abreviatura ?? null,
        })
      }
    }
    return Array.from(m.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [tareas])

  const pedidosDisponibles = useMemo(() => {
    const m = new Map<
      string,
      { id: string; numero: string; cliente: string | null }
    >()
    for (const t of tareas) {
      const p = t?.pieza?.linea_pedido?.pedido
      if (!p?.id) continue
      const cliente = p?.cliente?.nombre_comercial ?? null
      if (!m.has(p.id)) {
        m.set(p.id, { id: p.id, numero: p.numero ?? '?', cliente })
      }
    }
    return Array.from(m.values()).sort((a, b) => a.numero.localeCompare(b.numero))
  }, [tareas])

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtroProceso !== SIN_FILTRO && t?.proceso?.id !== filtroProceso) {
        return false
      }
      if (filtroOperario !== SIN_FILTRO) {
        if (t?.operario_id !== filtroOperario) return false
      }
      if (filtroPedido !== SIN_FILTRO) {
        const pedId = t?.pieza?.linea_pedido?.pedido?.id
        if (pedId !== filtroPedido) return false
      }
      return true
    })
  }, [tareas, filtroProceso, filtroOperario, filtroPedido])

  const filtrosActivos =
    filtroProceso !== SIN_FILTRO ||
    filtroOperario !== SIN_FILTRO ||
    filtroPedido !== SIN_FILTRO

  function limpiarFiltros() {
    setFiltroProceso(SIN_FILTRO)
    setFiltroOperario(SIN_FILTRO)
    setFiltroPedido(SIN_FILTRO)
  }

  const tareasPorColumna = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const col of ESTADOS_COLUMNAS) map.set(col.key, [])
    for (const t of tareasFiltradas) {
      const col = ESTADOS_COLUMNAS.find((c) => c.includes.includes(t.estado))
      if (col) map.get(col.key)!.push(t)
    }
    return map
  }, [tareasFiltradas])

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-7 h-7" />
            Producción
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tareasFiltradas.length} tarea{tareasFiltradas.length === 1 ? '' : 's'}
            {filtrosActivos && ` · filtros activos`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refrescar} disabled={refrescando}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refrescando ? 'animate-spin' : ''}`}
            />
            Refrescar
          </Button>

          <div className="inline-flex rounded-lg border bg-white p-0.5">
            <button
              onClick={() => setVista('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${
                vista === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${
                vista === 'lista'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Filtrar:</span>

            <Select value={filtroProceso} onValueChange={setFiltroProceso}>
              <SelectTrigger className="h-8 w-auto min-w-[150px]">
                <SelectValue placeholder="Proceso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos los procesos</SelectItem>
                {procesosDisponibles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.abrev ? `${p.abrev} · ` : ''}{p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroOperario} onValueChange={setFiltroOperario}>
              <SelectTrigger className="h-8 w-auto min-w-[150px]">
                <SelectValue placeholder="Operario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos los operarios</SelectItem>
                {operarios.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nombre}
                    {o.rol ? ` · ${o.rol}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPedido} onValueChange={setFiltroPedido}>
              <SelectTrigger className="h-8 w-auto min-w-[200px]">
                <SelectValue placeholder="Pedido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos los pedidos</SelectItem>
                {pedidosDisponibles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.numero}
                    {p.cliente ? ` · ${p.cliente}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtrosActivos && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarFiltros}
                className="h-8"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contenido */}
      {tareas.length === 0 && (
        <EstadoVacio
          titulo="No hay tareas todavía"
          mensaje="Confirma un pedido y arranca producción desde /pedidos para ver sus tareas aquí."
        />
      )}

      {tareas.length > 0 && tareasFiltradas.length === 0 && (
        <EstadoVacio
          titulo="Sin resultados"
          mensaje="Los filtros aplicados no devuelven ninguna tarea. Límpialos para ver todo."
        />
      )}

      {tareasFiltradas.length > 0 && vista === 'kanban' && (
        <VistaKanban
          tareasPorColumna={tareasPorColumna}
          operarios={operarios}
          ahora={ahora}
          onNotificar={notificar}
        />
      )}

      {tareasFiltradas.length > 0 && vista === 'lista' && (
        <VistaLista
          tareas={tareasFiltradas}
          operarios={operarios}
          ahora={ahora}
          onNotificar={notificar}
        />
      )}

      {/* Toast inferior verde/rojo, autocierre 3s */}
      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={
              mensaje.tipo === 'ok'
                ? 'bg-green-50 border-green-300 text-green-900'
                : ''
            }
          >
            <AlertDescription className="font-medium">
              {mensaje.texto}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

function EstadoVacio({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center gap-2">
        <Factory className="w-10 h-10 text-muted-foreground" />
        <div className="font-semibold text-lg">{titulo}</div>
        <div className="text-sm text-muted-foreground max-w-md">{mensaje}</div>
      </CardContent>
    </Card>
  )
}

function VistaKanban({
  tareasPorColumna,
  operarios,
  ahora,
  onNotificar,
}: {
  tareasPorColumna: Map<string, any[]>
  operarios: Operario[]
  ahora: number
  onNotificar: (tipo: 'ok' | 'error', texto: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {ESTADOS_COLUMNAS.map((col) => {
        const tareasCol = tareasPorColumna.get(col.key) ?? []
        const agrupadas = agruparPorProceso(tareasCol)
        return (
          <div
            key={col.key}
            className={`flex-shrink-0 w-80 rounded-lg border-2 ${col.colorClase}`}
          >
            <div className="px-3 py-2 border-b bg-white/50 flex items-center justify-between">
              <span className="font-semibold text-sm">{col.label}</span>
              <Badge variant="outline" className="bg-white">
                {tareasCol.length}
              </Badge>
            </div>

            <div className="p-2 space-y-3 max-h-[70vh] overflow-y-auto">
              {tareasCol.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  —
                </div>
              )}
              {Array.from(agrupadas.entries()).map(([procNombre, lista]) => (
                <div key={procNombre} className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                    {procNombre} ({lista.length})
                  </div>
                  {lista.map((t: any) => (
                    <TareaCard
                      key={t.id}
                      tarea={t}
                      operarios={operarios}
                      ahora={ahora}
                      onNotificar={onNotificar}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function agruparPorProceso(tareas: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>()
  for (const t of tareas) {
    const nombre = t?.proceso?.nombre ?? t?.proceso?.codigo ?? 'Sin proceso'
    if (!m.has(nombre)) m.set(nombre, [])
    m.get(nombre)!.push(t)
  }
  return m
}

function VistaLista({
  tareas,
  operarios,
  ahora,
  onNotificar,
}: {
  tareas: any[]
  operarios: Operario[]
  ahora: number
  onNotificar: (tipo: 'ok' | 'error', texto: string) => void
}) {
  const ordenadas = useMemo(() => {
    const pesos: Record<string, number> = {
      urgente: 0,
      alta: 1,
      normal: 2,
      baja: 3,
    }
    return [...tareas].sort((a, b) => {
      const pa = pesos[a?.pieza?.linea_pedido?.pedido?.prioridad ?? 'normal'] ?? 2
      const pb = pesos[b?.pieza?.linea_pedido?.pedido?.prioridad ?? 'normal'] ?? 2
      if (pa !== pb) return pa - pb
      const fa = a?.pieza?.linea_pedido?.pedido?.fecha_entrega_estimada ?? '~'
      const fb = b?.pieza?.linea_pedido?.pedido?.fecha_entrega_estimada ?? '~'
      return fa.localeCompare(fb)
    })
  }, [tareas])

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {ordenadas.map((t) => (
        <TareaCard
          key={t.id}
          tarea={t}
          operarios={operarios}
          ahora={ahora}
          onNotificar={onNotificar}
          modoCompacto={false}
        />
      ))}
    </div>
  )
}
