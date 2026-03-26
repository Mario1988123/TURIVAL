'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Filter, Settings, Clock, Calendar as CalendarIcon } from 'lucide-react'

interface Pedido {
  id: string
  numero: string
  estado: string
  prioridad: string
  fecha_pedido: string
  fecha_entrega: string | null
  observaciones: string | null
  clientes?: { nombre_comercial: string }
}

const ESTADOS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-500',
  confirmado: 'bg-blue-500',
  en_produccion: 'bg-purple-500',
  completado: 'bg-green-500',
  entregado: 'bg-emerald-600',
  cancelado: 'bg-red-500',
}

const ESTADOS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_produccion: 'En Producción',
  completado: 'Completado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  baja: 'border-l-gray-400',
  normal: 'border-l-blue-400',
  alta: 'border-l-orange-400',
  urgente: 'border-l-red-500',
}

export default function AgendaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('all')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [horaInicio, setHoraInicio] = useState(5)
  const [horaFin, setHoraFin] = useState(22)
  const [showSettings, setShowSettings] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadPedidos()
  }, [])

  async function loadPedidos() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, estado, prioridad, fecha_pedido, fecha_entrega, observaciones, clientes(nombre_comercial)')
      .neq('estado', 'cancelado')
      .order('fecha_entrega', { ascending: true })

    setPedidos(data || [])
    setLoading(false)
  }

  const dateRange = useMemo(() => {
    const dates: Date[] = []
    const start = new Date(currentDate)
    
    if (viewMode === 'week') {
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      for (let i = 0; i < 7; i++) {
        dates.push(new Date(start))
        start.setDate(start.getDate() + 1)
      }
    } else {
      start.setDate(1)
      const month = start.getMonth()
      while (start.getMonth() === month) {
        dates.push(new Date(start))
        start.setDate(start.getDate() + 1)
      }
    }
    return dates
  }, [currentDate, viewMode])

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroEstado !== 'all' && p.estado !== filtroEstado) return false
      if (filtroPrioridad !== 'all' && p.prioridad !== filtroPrioridad) return false
      if (filtroCliente && !p.clientes?.nombre_comercial.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      return true
    })
  }, [pedidos, filtroEstado, filtroPrioridad, filtroCliente])

  const getSpanningPedidos = () => {
    return filteredPedidos.filter(p => p.fecha_entrega).map(p => {
      const start = new Date(p.fecha_pedido)
      const end = new Date(p.fecha_entrega!)
      return { ...p, startDate: start, endDate: end }
    })
  }

  const horasDelDia = useMemo(() => {
    const horas: number[] = []
    for (let h = horaInicio; h <= horaFin; h++) {
      horas.push(h)
    }
    return horas
  }, [horaInicio, horaFin])

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agenda</h1>
          <p className="text-slate-500">Visualiza todos los proyectos y entregas programadas</p>
        </div>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configurar Horarios
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuracion de Horarios</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-500">
                Configura el rango de horas que se mostrara en la agenda. 
                Ideal para turnos especiales desde las 5:00 AM.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hora de Inicio</Label>
                  <Select value={String(horaInicio)} onValueChange={v => setHoraInicio(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 24}, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hora de Fin</Label>
                  <Select value={String(horaFin)} onValueChange={v => setHoraFin(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 24}, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">
                  Horario configurado: {String(horaInicio).padStart(2, '0')}:00 - {String(horaFin).padStart(2, '0')}:00
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Total: {horaFin - horaInicio} horas de trabajo
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filtros:</span>
            </div>
            
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(ESTADOS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>

            <Input 
              placeholder="Buscar cliente..."
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              className="w-48"
            />

            <div className="flex-1"></div>

            <div className="flex items-center gap-1 border rounded-lg p-1 bg-slate-50">
              <Button 
                variant={viewMode === 'week' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Semana
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Mes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navegacion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Hoy
          </Button>
        </div>

        <h2 className="text-xl font-semibold text-slate-900">
          {viewMode === 'week' 
            ? `Semana del ${dateRange[0]?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${dateRange[6]?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          }
        </h2>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="w-4 h-4" />
          {String(horaInicio).padStart(2, '0')}:00 - {String(horaFin).padStart(2, '0')}:00
        </div>
      </div>

      {/* Gantt Chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header */}
              <div className="grid border-b bg-gradient-to-r from-slate-50 to-slate-100" style={{ gridTemplateColumns: `220px repeat(${dateRange.length}, 1fr)` }}>
                <div className="p-3 border-r font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Proyecto
                </div>
                {dateRange.map((date, i) => (
                  <div 
                    key={i} 
                    className={`p-3 text-center border-r text-sm font-medium transition-colors
                      ${isToday(date) ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-700'}`}
                  >
                    <div>{date.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                    <div className="text-lg">{date.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* Horas del dia (sidebar) */}
              {viewMode === 'week' && (
                <div className="border-b bg-slate-50 p-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto">
                    <span className="w-[220px] shrink-0 font-medium">Horario laboral:</span>
                    {horasDelDia.map(h => (
                      <span key={h} className="px-2 py-1 bg-white rounded border text-slate-600">
                        {String(h).padStart(2, '0')}:00
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rows */}
              {getSpanningPedidos().length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="font-medium">No hay pedidos para mostrar</p>
                  <p className="text-sm">Ajusta los filtros o navega a otras fechas</p>
                </div>
              ) : (
                getSpanningPedidos().map((pedido) => {
                  const startIdx = dateRange.findIndex(d => 
                    d.toISOString().split('T')[0] === pedido.startDate.toISOString().split('T')[0]
                  )
                  const endIdx = dateRange.findIndex(d => 
                    d.toISOString().split('T')[0] === pedido.endDate.toISOString().split('T')[0]
                  )
                  
                  return (
                    <div 
                      key={pedido.id} 
                      className="grid border-b hover:bg-slate-50/50 transition-colors group"
                      style={{ gridTemplateColumns: `220px repeat(${dateRange.length}, 1fr)` }}
                    >
                      <div className={`p-3 border-r border-l-4 ${PRIORIDAD_COLORS[pedido.prioridad] || 'border-l-gray-300'} bg-white group-hover:bg-slate-50`}>
                        <div className="font-semibold text-sm text-slate-900">{pedido.numero}</div>
                        <div className="text-xs text-slate-500 truncate">{pedido.clientes?.nombre_comercial || 'Sin cliente'}</div>
                        <Badge className={`mt-2 text-xs text-white ${ESTADOS_COLORS[pedido.estado]}`}>
                          {ESTADOS_LABELS[pedido.estado]}
                        </Badge>
                      </div>
                      
                      {dateRange.map((date, colIdx) => {
                        const dateStr = date.toISOString().split('T')[0]
                        const startStr = pedido.startDate.toISOString().split('T')[0]
                        const endStr = pedido.endDate.toISOString().split('T')[0]
                        const isInRange = dateStr >= startStr && dateStr <= endStr
                        const isStart = dateStr === startStr
                        const isEnd = dateStr === endStr
                        
                        return (
                          <div key={colIdx} className={`p-1 border-r min-h-[70px] relative ${isToday(date) ? 'bg-blue-50/30' : ''}`}>
                            {isInRange && (
                              <div 
                                className={`absolute top-1/2 -translate-y-1/2 h-10 ${ESTADOS_COLORS[pedido.estado]} 
                                  flex items-center px-2 shadow-sm
                                  ${isStart ? 'left-1 rounded-l-lg' : 'left-0'} 
                                  ${isEnd ? 'right-1 rounded-r-lg' : 'right-0'}
                                `}
                              >
                                {isStart && (
                                  <span className="text-xs text-white font-medium truncate">
                                    {pedido.numero}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Estados</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(ESTADOS_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${ESTADOS_COLORS[key]}`}></div>
                  <span className="text-sm text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Prioridad (borde izquierdo)</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded bg-red-500"></div>
                <span className="text-sm text-slate-600">Urgente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded bg-orange-400"></div>
                <span className="text-sm text-slate-600">Alta</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded bg-blue-400"></div>
                <span className="text-sm text-slate-600">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded bg-gray-400"></div>
                <span className="text-sm text-slate-600">Baja</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
