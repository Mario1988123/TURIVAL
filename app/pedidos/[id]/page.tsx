'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowLeft, FileText, Factory, Truck, Printer, Phone, Mail, 
  Calendar, CheckCircle, Clock, Play, Package, AlertTriangle,
  ChevronLeft, ChevronRight, GripVertical, Zap
} from 'lucide-react'
import Link from 'next/link'

interface Pedido {
  id: string
  numero: string
  estado: string
  prioridad: string
  fecha: string
  fecha_entrega: string | null
  subtotal: number
  impuestos: number
  total: number
  observaciones: string | null
  clientes: {
    id: string
    nombre_comercial: string
    razon_social: string
    email: string
    telefono: string
    direccion: string
  } | null
  presupuestos: {
    id: string
    numero: string
  } | null
}

interface LineaPedido {
  id: string
  numero_linea: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad: string
  producto_id: string
  productos: {
    id: string
    nombre: string
    categoria: string
  } | null
}

interface Proceso {
  id: string
  nombre: string
  orden: number
  tiempo_estimado_default: number
}

interface TareaExistente {
  id: string
  fecha_programada_inicio: string
  fecha_programada_fin: string
  nombre: string
  estado: string
  piezas?: { codigo_unico: string } | null
}

interface TareaProgramada {
  proceso_id: string
  proceso_nombre: string
  tiempo_estimado: number
  fecha_inicio: Date | null
  fecha_fin: Date | null
  orden: number
  colocada: boolean
}

interface Carro {
  id: string
  codigo: string
  descripcion: string
  ubicacion: string
}

const HORAS_LABORALES = Array.from({ length: 10 }, (_, i) => i + 8) // 8:00 - 17:00

// Colores para cada proceso
const COLORES_PROCESOS: Record<string, string> = {
  'Lijado 1': 'bg-yellow-400',
  'Fondo 1': 'bg-blue-400',
  'Lijado 2': 'bg-yellow-500',
  'Fondo 2': 'bg-blue-500',
  'Lacado': 'bg-green-500',
  'Final': 'bg-purple-500',
  'Revision': 'bg-orange-500',
  'Picking': 'bg-red-500',
}

export default function PedidoDetalle() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Vista del Gantt
  const [vistaGantt, setVistaGantt] = useState(false)
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaPedido | null>(null)
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [tareasProgramadas, setTareasProgramadas] = useState<TareaProgramada[]>([])
  const [tareasExistentes, setTareasExistentes] = useState<TareaExistente[]>([])
  const [semanaActual, setSemanaActual] = useState(new Date())
  const [carros, setCarros] = useState<Carro[]>([])
  
  // Drag and drop
  const [draggingProceso, setDraggingProceso] = useState<TareaProgramada | null>(null)
  
  // Modal carro
  const [dialogCarro, setDialogCarro] = useState(false)
  const [carroSeleccionado, setCarroSeleccionado] = useState('')

  const id = params.id as string

  // Cargar datos del pedido
  const loadPedido = useCallback(async () => {
    setLoading(true)
    try {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes (id, nombre_comercial, razon_social, email, telefono, direccion),
          presupuestos (id, numero)
        `)
        .eq('id', id)
        .single()

      if (pedidoError) throw pedidoError
      setPedido(pedidoData)

      const { data: lineasData } = await supabase
        .from('lineas_pedido')
        .select(`*, productos (id, nombre, categoria)`)
        .eq('pedido_id', id)
        .order('numero_linea')

      setLineas(lineasData || [])
    } catch {
      setError('Error al cargar el pedido')
    } finally {
      setLoading(false)
    }
  }, [id, supabase])

  useEffect(() => {
    loadPedido()
  }, [loadPedido])

  // Cargar procesos y tareas existentes cuando se abre Gantt
  async function abrirGantt(linea: LineaPedido) {
    setLineaSeleccionada(linea)
    setVistaGantt(true)

    // Cargar procesos del catalogo
    const { data: procesosData } = await supabase
      .from('procesos_catalogo')
      .select('*')
      .eq('activo', true)
      .order('orden')

    setProcesos(procesosData || [])

    // Inicializar tareas sin colocar
    const tareasInit: TareaProgramada[] = (procesosData || []).map(p => ({
      proceso_id: p.id,
      proceso_nombre: p.nombre,
      tiempo_estimado: p.tiempo_estimado_default,
      fecha_inicio: null,
      fecha_fin: null,
      orden: p.orden,
      colocada: false
    }))
    setTareasProgramadas(tareasInit)

    // Cargar tareas existentes de la semana
    await cargarTareasExistentes()

    // Cargar carros
    const { data: carrosData } = await supabase
      .from('carros')
      .select('*')
      .eq('activo', true)

    setCarros(carrosData || [])
  }

  async function cargarTareasExistentes() {
    const inicioSemana = getInicioSemana(semanaActual)
    const finSemana = new Date(inicioSemana)
    finSemana.setDate(finSemana.getDate() + 5)

    const { data } = await supabase
      .from('tareas_produccion')
      .select('*, piezas(codigo_unico)')
      .gte('fecha_programada_inicio', inicioSemana.toISOString())
      .lte('fecha_programada_fin', finSemana.toISOString())

    setTareasExistentes(data || [])
  }

  useEffect(() => {
    if (vistaGantt) {
      cargarTareasExistentes()
    }
  }, [semanaActual, vistaGantt])

  // Utilidades de fecha
  function getInicioSemana(fecha: Date): Date {
    const d = new Date(fecha)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function getDiasSemana(fecha: Date): Date[] {
    const inicio = getInicioSemana(fecha)
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  // Drag and drop handlers
  function handleDragStart(tarea: TareaProgramada) {
    if (tarea.colocada) return
    setDraggingProceso(tarea)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(dia: Date, hora: number) {
    if (!draggingProceso) return

    // Validar orden: no puede colocar si hay procesos anteriores sin colocar
    const procesosAnteriores = tareasProgramadas.filter(t => t.orden < draggingProceso.orden && !t.colocada)
    if (procesosAnteriores.length > 0) {
      setError(`Primero debes colocar: ${procesosAnteriores.map(p => p.proceso_nombre).join(', ')}`)
      setDraggingProceso(null)
      return
    }

    // Calcular fecha inicio y fin
    const fechaInicio = new Date(dia)
    fechaInicio.setHours(hora, 0, 0, 0)
    
    const fechaFin = new Date(fechaInicio)
    fechaFin.setMinutes(fechaFin.getMinutes() + draggingProceso.tiempo_estimado)

    // Verificar que no se salga del horario laboral
    if (fechaFin.getHours() > 17 || (fechaFin.getHours() === 17 && fechaFin.getMinutes() > 0)) {
      setError('La tarea se sale del horario laboral (hasta las 17:00)')
      setDraggingProceso(null)
      return
    }

    // Verificar colision con tareas existentes
    const hayColision = tareasExistentes.some(te => {
      const teInicio = new Date(te.fecha_programada_inicio)
      const teFin = new Date(te.fecha_programada_fin)
      return (fechaInicio < teFin && fechaFin > teInicio)
    })

    if (hayColision) {
      setError('Hay una tarea existente en ese horario')
      setDraggingProceso(null)
      return
    }

    // Actualizar la tarea
    setTareasProgramadas(prev => prev.map(t => 
      t.proceso_id === draggingProceso.proceso_id 
        ? { ...t, fecha_inicio: fechaInicio, fecha_fin: fechaFin, colocada: true }
        : t
    ))

    setDraggingProceso(null)
    setError('')
  }

  // Programacion automatica
  function programarAutomatico() {
    const dias = getDiasSemana(semanaActual)
    let diaIndex = 0
    let horaActual = 8
    let minutosActuales = 0

    const nuevasTareas = [...tareasProgramadas]

    for (let i = 0; i < nuevasTareas.length; i++) {
      const tarea = nuevasTareas[i]
      if (tarea.colocada) continue

      // Buscar hueco disponible
      let encontrado = false
      while (!encontrado && diaIndex < dias.length) {
        const fechaInicio = new Date(dias[diaIndex])
        fechaInicio.setHours(horaActual, minutosActuales, 0, 0)
        
        const fechaFin = new Date(fechaInicio)
        fechaFin.setMinutes(fechaFin.getMinutes() + tarea.tiempo_estimado)

        // Verificar que no se salga del horario
        if (fechaFin.getHours() > 17 || (fechaFin.getHours() === 17 && fechaFin.getMinutes() > 0)) {
          diaIndex++
          horaActual = 8
          minutosActuales = 0
          continue
        }

        // Verificar colision
        const hayColision = tareasExistentes.some(te => {
          const teInicio = new Date(te.fecha_programada_inicio)
          const teFin = new Date(te.fecha_programada_fin)
          return fechaInicio.toDateString() === teInicio.toDateString() &&
                 (fechaInicio < teFin && fechaFin > teInicio)
        })

        if (hayColision) {
          minutosActuales += 30
          if (minutosActuales >= 60) {
            horaActual++
            minutosActuales = 0
          }
          continue
        }

        // Asignar tarea
        nuevasTareas[i] = {
          ...tarea,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          colocada: true
        }

        // Avanzar tiempo
        horaActual = fechaFin.getHours()
        minutosActuales = fechaFin.getMinutes()
        encontrado = true
      }
    }

    setTareasProgramadas(nuevasTareas)
  }

  // Confirmar programacion
  async function confirmarProgramacion() {
    const tareasNoColocadas = tareasProgramadas.filter(t => !t.colocada)
    if (tareasNoColocadas.length > 0) {
      setError(`Faltan por colocar: ${tareasNoColocadas.map(t => t.proceso_nombre).join(', ')}`)
      return
    }
    setDialogCarro(true)
  }

  async function confirmarConCarro() {
    if (!carroSeleccionado) {
      setError('Selecciona un carro')
      return
    }

    setSaving(true)
    try {
      if (!pedido || !lineaSeleccionada) return

      // Crear lote
      const codigoLote = `LOT-${pedido.numero}-${Date.now()}`
      const { data: lote, error: loteErr } = await supabase
        .from('lotes')
        .insert({
          codigo_lote: codigoLote,
          numero: codigoLote,
          pedido_id: pedido.id,
          estado: 'creado',
          cantidad_piezas: 1
        })
        .select()
        .single()

      if (loteErr) throw loteErr

      // Crear pieza
      const timestamp = Date.now()
      const codigoUnico = `PIE-${timestamp}`
      const qrCode = `QR-${pedido.numero}-${lineaSeleccionada.numero_linea}-${timestamp}`

      const { data: pieza, error: piezaErr } = await supabase
        .from('piezas')
        .insert({
          codigo_unico: codigoUnico,
          codigo_qr: qrCode,
          qr_code: qrCode,
          lote_id: lote.id,
          pedido_id: pedido.id,
          carro_id: carroSeleccionado,
          estado: 'por_procesar'
        })
        .select()
        .single()

      if (piezaErr) throw piezaErr

      // Crear tareas de produccion
      for (const tarea of tareasProgramadas) {
        if (!tarea.fecha_inicio || !tarea.fecha_fin) continue

        await supabase.from('tareas_produccion').insert({
          lote_id: lote.id,
          pieza_id: pieza.id,
          proceso_id: tarea.proceso_id,
          nombre: tarea.proceso_nombre,
          tiempo_estimado: tarea.tiempo_estimado,
          fecha_programada_inicio: tarea.fecha_inicio.toISOString(),
          fecha_programada_fin: tarea.fecha_fin.toISOString(),
          orden_secuencia: tarea.orden,
          estado: 'pendiente'
        })
      }

      // Calcular fecha de entrega (ultimo proceso)
      const ultimaTarea = tareasProgramadas[tareasProgramadas.length - 1]
      if (ultimaTarea.fecha_fin) {
        await supabase
          .from('pedidos')
          .update({ 
            fecha_entrega: ultimaTarea.fecha_fin.toISOString().split('T')[0],
            estado: 'en_produccion'
          })
          .eq('id', pedido.id)
      }

      setDialogCarro(false)
      setVistaGantt(false)
      loadPedido()
    } catch (err) {
      console.error('Error confirmando programacion:', err)
      setError('Error al confirmar programacion')
    } finally {
      setSaving(false)
    }
  }

  // Render del estado con iconos
  function renderEstadoButtons() {
    if (!pedido) return null

    const estados = [
      { estado: 'pendiente', label: 'Pendiente', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
      { estado: 'en_produccion', label: 'Produccion', icon: Factory, color: 'bg-blue-100 text-blue-800' },
      { estado: 'completado', label: 'Completado', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
      { estado: 'entregado', label: 'Entregado', icon: Truck, color: 'bg-purple-100 text-purple-800' },
    ]

    const estadoActualIndex = estados.findIndex(e => e.estado === pedido.estado)

    return (
      <div className="flex items-center gap-2">
        {estados.map((e, i) => {
          const Icon = e.icon
          const isActive = e.estado === pedido.estado
          const isPast = i < estadoActualIndex
          const isNext = i === estadoActualIndex + 1

          return (
            <Button
              key={e.estado}
              variant={isActive ? "default" : "outline"}
              size="sm"
              disabled={!isNext && !isActive}
              onClick={async () => {
                if (isNext) {
                  await supabase.from('pedidos').update({ estado: e.estado }).eq('id', pedido.id)
                  loadPedido()
                }
              }}
              className={`${isActive ? e.color : ''} ${isPast ? 'opacity-50' : ''}`}
            >
              <Icon className="w-4 h-4 mr-1" />
              {e.label}
            </Button>
          )
        })}
      </div>
    )
  }

  // Calcular posicion y tamaño de tarea en el calendario
  function getTareaStyle(fechaInicio: Date, fechaFin: Date, diaIndex: number) {
    const horaInicio = fechaInicio.getHours() + fechaInicio.getMinutes() / 60
    const horaFin = fechaFin.getHours() + fechaFin.getMinutes() / 60
    const duracion = horaFin - horaInicio

    const top = (horaInicio - 8) * 60 // 60px por hora
    const height = duracion * 60

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${diaIndex * 20}%`,
      width: '19%'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Pedido no encontrado</AlertDescription>
        </Alert>
      </div>
    )
  }

  // VISTA GANTT
  if (vistaGantt) {
    const dias = getDiasSemana(semanaActual)
    const tareasNoColocadas = tareasProgramadas.filter(t => !t.colocada)
    const tareasColocadas = tareasProgramadas.filter(t => t.colocada)

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setVistaGantt(false)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al pedido
              </Button>
              <div>
                <h1 className="text-xl font-bold">Programar Gantt - {pedido.numero}</h1>
                <p className="text-sm text-muted-foreground">
                  Linea: {lineaSeleccionada?.productos?.nombre} ({lineaSeleccionada?.cantidad} {lineaSeleccionada?.unidad})
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={programarAutomatico}>
                <Zap className="w-4 h-4 mr-2" />
                Automatico
              </Button>
              <Button 
                onClick={confirmarProgramacion}
                disabled={tareasNoColocadas.length > 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Programacion
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mx-6 mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-6 p-6">
          {/* Panel izquierdo: Procesos a colocar */}
          <div className="w-64 flex-shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Procesos a programar</CardTitle>
                <CardDescription>Arrastra cada proceso al calendario</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {tareasProgramadas.map(tarea => (
                  <div
                    key={tarea.proceso_id}
                    draggable={!tarea.colocada}
                    onDragStart={() => handleDragStart(tarea)}
                    className={`
                      p-3 rounded-lg border flex items-center gap-2 cursor-grab
                      ${tarea.colocada 
                        ? 'bg-green-50 border-green-200 opacity-50' 
                        : `${COLORES_PROCESOS[tarea.proceso_nombre] || 'bg-gray-200'} text-white`
                      }
                    `}
                  >
                    {!tarea.colocada && <GripVertical className="w-4 h-4" />}
                    {tarea.colocada && <CheckCircle className="w-4 h-4 text-green-600" />}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{tarea.proceso_nombre}</p>
                      <p className={`text-xs ${tarea.colocada ? 'text-muted-foreground' : 'text-white/80'}`}>
                        {tarea.tiempo_estimado} min
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Calendario Gantt */}
          <div className="flex-1">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Calendario Semanal</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const prev = new Date(semanaActual)
                        prev.setDate(prev.getDate() - 7)
                        setSemanaActual(prev)
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[200px] text-center">
                      {dias[0]?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {dias[4]?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const next = new Date(semanaActual)
                        next.setDate(next.getDate() + 7)
                        setSemanaActual(next)
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Header dias */}
                <div className="grid grid-cols-6 gap-px bg-slate-200 rounded-t-lg overflow-hidden">
                  <div className="bg-slate-100 p-2 text-xs font-medium text-center">Hora</div>
                  {dias.map((dia, i) => (
                    <div key={i} className="bg-slate-100 p-2 text-xs font-medium text-center">
                      {dia.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                    </div>
                  ))}
                </div>

                {/* Grid de horas */}
                <div className="relative border border-t-0 rounded-b-lg overflow-hidden" style={{ height: '600px' }}>
                  {/* Lineas de hora */}
                  {HORAS_LABORALES.map(hora => (
                    <div 
                      key={hora} 
                      className="absolute w-full border-b border-slate-100 flex"
                      style={{ top: `${(hora - 8) * 60}px`, height: '60px' }}
                    >
                      <div className="w-[16.66%] text-xs text-muted-foreground p-1 border-r bg-slate-50">
                        {hora}:00
                      </div>
                      {dias.map((dia, diaIndex) => (
                        <div
                          key={diaIndex}
                          className="flex-1 border-r border-slate-100 hover:bg-blue-50/50 transition-colors"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(dia, hora)}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Tareas existentes (grises) */}
                  {tareasExistentes.map(tarea => {
                    const fechaInicio = new Date(tarea.fecha_programada_inicio)
                    const fechaFin = new Date(tarea.fecha_programada_fin)
                    const diaIndex = dias.findIndex(d => d.toDateString() === fechaInicio.toDateString())
                    if (diaIndex === -1) return null

                    const style = getTareaStyle(fechaInicio, fechaFin, diaIndex)
                    return (
                      <div
                        key={tarea.id}
                        className="absolute bg-slate-300 rounded p-1 text-xs overflow-hidden"
                        style={{ ...style, marginLeft: '16.66%' }}
                      >
                        <p className="font-medium truncate">{tarea.nombre}</p>
                        <p className="text-slate-600 truncate">{tarea.piezas?.codigo_unico}</p>
                      </div>
                    )
                  })}

                  {/* Tareas programadas (coloreadas) */}
                  {tareasColocadas.map(tarea => {
                    if (!tarea.fecha_inicio || !tarea.fecha_fin) return null
                    const diaIndex = dias.findIndex(d => d.toDateString() === tarea.fecha_inicio!.toDateString())
                    if (diaIndex === -1) return null

                    const style = getTareaStyle(tarea.fecha_inicio, tarea.fecha_fin, diaIndex)
                    return (
                      <div
                        key={tarea.proceso_id}
                        className={`absolute ${COLORES_PROCESOS[tarea.proceso_nombre] || 'bg-gray-400'} rounded p-1 text-xs text-white overflow-hidden shadow-sm`}
                        style={{ ...style, marginLeft: '16.66%' }}
                      >
                        <p className="font-medium truncate">{tarea.proceso_nombre}</p>
                        <p className="text-white/80 truncate">
                          {tarea.fecha_inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialog seleccionar carro */}
        <Dialog open={dialogCarro} onOpenChange={setDialogCarro}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Carro</DialogTitle>
              <DialogDescription>
                Selecciona el carro donde se ubicara la pieza para su trazabilidad
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Carro</Label>
              <Select value={carroSeleccionado} onValueChange={setCarroSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un carro..." />
                </SelectTrigger>
                <SelectContent>
                  {carros.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.ubicacion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogCarro(false)}>Cancelar</Button>
              <Button onClick={confirmarConCarro} disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // VISTA NORMAL DEL PEDIDO
  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/pedidos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{pedido.numero}</h1>
            <p className="text-muted-foreground">
              Creado el {new Date(pedido.fecha).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderEstadoButtons()}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Datos del Pedido */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Datos del Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{pedido.clientes?.nombre_comercial || 'Sin cliente'}</p>
                {pedido.clientes?.razon_social && (
                  <p className="text-sm text-muted-foreground">{pedido.clientes.razon_social}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto origen</p>
                {pedido.presupuestos ? (
                  <Link href={`/presupuestos/${pedido.presupuestos.id}`} className="text-blue-600 hover:underline">
                    {pedido.presupuestos.numero}
                  </Link>
                ) : (
                  <p className="text-muted-foreground">Pedido directo</p>
                )}
              </div>
            </div>

            {/* Contacto */}
            {pedido.clientes && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-2">Contacto</p>
                <div className="flex flex-wrap gap-4">
                  {pedido.clientes.telefono && (
                    <a href={`tel:${pedido.clientes.telefono}`} className="flex items-center gap-2 text-sm hover:text-blue-600">
                      <Phone className="w-4 h-4" />
                      {pedido.clientes.telefono}
                    </a>
                  )}
                  {pedido.clientes.email && (
                    <a href={`mailto:${pedido.clientes.email}`} className="flex items-center gap-2 text-sm hover:text-blue-600">
                      <Mail className="w-4 h-4" />
                      {pedido.clientes.email}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Prioridad y Fecha entrega */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Prioridad</p>
                <Badge variant="outline" className="capitalize">{pedido.prioridad || 'Normal'}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de entrega</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {pedido.fecha_entrega 
                    ? new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')
                    : <span className="text-muted-foreground">Por programar en Gantt</span>
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{pedido.subtotal?.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA (21%)</span>
              <span>{pedido.impuestos?.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="font-bold">Total</span>
              <span className="font-bold text-lg text-blue-600">{pedido.total?.toFixed(2)}€</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lineas del Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Lineas del Pedido ({lineas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Este pedido no tiene lineas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map(linea => (
                  <TableRow key={linea.id}>
                    <TableCell className="text-blue-600 font-medium">{linea.numero_linea}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{linea.productos?.nombre || 'Producto eliminado'}</p>
                        {linea.productos?.categoria && (
                          <p className="text-xs text-muted-foreground">{linea.productos.categoria}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{linea.cantidad} {linea.unidad}</TableCell>
                    <TableCell className="text-right">{linea.precio_unitario?.toFixed(2)}€</TableCell>
                    <TableCell className="text-right font-medium">{linea.subtotal?.toFixed(2)}€</TableCell>
                    <TableCell className="text-right">
                      {pedido.estado === 'pendiente' && (
                        <Button size="sm" onClick={() => abrirGantt(linea)}>
                          <Calendar className="w-4 h-4 mr-1" />
                          Programar Gantt
                        </Button>
                      )}
                      {pedido.estado === 'en_produccion' && (
                        <Badge variant="outline" className="bg-blue-50">
                          <Play className="w-3 h-3 mr-1" />
                          En produccion
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
