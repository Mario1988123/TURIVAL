'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

interface Tarea {
  id: string
  nombre: string
  proceso_id: string
  fecha_programada_inicio: string
  fecha_programada_fin: string
  tiempo_estimado: number
  empleado_id: string
  pieza_id: string
  estado: string
}

interface Proceso {
  id: string
  nombre: string
}

interface Empleado {
  id: string
  nombre: string
  especialidad: string
}

export default function GanttCalendario() {
  const supabase = createClient()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [procesos, setProcesos] = useState<Map<string, Proceso>>(new Map())
  const [empleados, setEmpleados] = useState<Map<string, Empleado>>(new Map())
  const [semanaActual, setSemanaActual] = useState(new Date())
  const [draggedTarea, setDraggedTarea] = useState<Tarea | null>(null)

  const horaInicio = 7 // 7:00 AM
  const horaFin = 20 // 20:00 (8 PM)
  const horas = Array.from({ length: horaFin - horaInicio }, (_, i) => horaInicio + i)

  useEffect(() => {
    loadData()
  }, [semanaActual])

  async function loadData() {
    try {
      const inicio = startOfWeek(semanaActual, { weekStartsOn: 1 })
      const fin = addDays(inicio, 7)

      // Cargar tareas de la semana
      const { data: tareasData } = await supabase
        .from('tareas_produccion')
        .select('*')
        .gte('fecha_programada_inicio', inicio.toISOString())
        .lte('fecha_programada_fin', fin.toISOString())

      setTareas(tareasData || [])

      // Cargar procesos y empleados
      const { data: procesosData } = await supabase.from('procesos_catalogo').select('*')
      const { data: empleadosData } = await supabase.from('empleados').select('*')

      const procesosMap = new Map()
      procesosData?.forEach(p => procesosMap.set(p.id, p))
      setProcesos(procesosMap)

      const empleadosMap = new Map()
      empleadosData?.forEach(e => empleadosMap.set(e.id, e))
      setEmpleados(empleadosMap)
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  function handleDragStart(tarea: Tarea) {
    setDraggedTarea(tarea)
  }

  async function handleDrop(dia: Date, hora: number) {
    if (!draggedTarea) return

    const inicio = new Date(dia)
    inicio.setHours(hora, 0, 0, 0)
    const fin = new Date(inicio)
    fin.setMinutes(fin.getMinutes() + (draggedTarea.tiempo_estimado || 30))

    await supabase
      .from('tareas_produccion')
      .update({
        fecha_programada_inicio: inicio.toISOString(),
        fecha_programada_fin: fin.toISOString(),
      })
      .eq('id', draggedTarea.id)

    setDraggedTarea(null)
    loadData()
  }

  function getTareasEnHora(dia: Date, hora: number): Tarea[] {
    const horaInicio = new Date(dia)
    horaInicio.setHours(hora, 0, 0, 0)
    const horaFin = new Date(horaInicio)
    horaFin.setHours(hora + 1, 0, 0, 0)

    return tareas.filter(t => {
      if (!t.fecha_programada_inicio) return false
      const tInicio = new Date(t.fecha_programada_inicio)
      const tFin = new Date(t.fecha_programada_fin || t.fecha_programada_inicio)
      return tInicio < horaFin && tFin > horaInicio
    })
  }

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(semanaActual, { weekStartsOn: 1 }), i))

  const colores = ['bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-red-100', 'bg-purple-100', 'bg-pink-100', 'bg-indigo-100']

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario Gantt de Producción</CardTitle>
          <CardDescription>Planificación semanal por horas - Arrastra tareas para programarlas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Navegación de semanas */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}>
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="font-medium">
              Semana de {format(startOfWeek(semanaActual, { weekStartsOn: 1 }), 'd MMM', { locale: es })} a {format(addDays(startOfWeek(semanaActual, { weekStartsOn: 1 }), 6), 'd MMM yyyy', { locale: es })}
            </span>
            <Button variant="outline" onClick={() => setSemanaActual(addWeeks(semanaActual, 1))}>
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Grid de calendario */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Encabezado de días */}
              <div className="flex gap-1">
                <div className="w-24 flex-shrink-0 border-r" />
                {diasSemana.map(dia => (
                  <div key={dia.toISOString()} className="w-32 text-center border-r p-2">
                    <p className="font-semibold">{format(dia, 'EEEE', { locale: es })}</p>
                    <p className="text-sm text-muted-foreground">{format(dia, 'd MMM', { locale: es })}</p>
                  </div>
                ))}
              </div>

              {/* Filas de horas */}
              {horas.map(hora => (
                <div key={hora} className="flex gap-1 border-b" style={{ height: '80px' }}>
                  <div className="w-24 flex-shrink-0 border-r p-2 font-mono text-sm">
                    {String(hora).padStart(2, '0')}:00
                  </div>
                  {diasSemana.map(dia => (
                    <div
                      key={`${dia.toISOString()}-${hora}`}
                      className="w-32 border-r p-1 relative bg-slate-50 hover:bg-slate-100 transition-colors"
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDrop(dia, hora)}
                    >
                      {getTareasEnHora(dia, hora).map((tarea, idx) => (
                        <div
                          key={tarea.id}
                          draggable
                          onDragStart={() => handleDragStart(tarea)}
                          className={`${colores[idx % colores.length]} p-1 rounded text-xs cursor-move hover:shadow-md transition-shadow`}
                        >
                          <p className="font-semibold truncate">{procesos.get(tarea.proceso_id)?.nombre}</p>
                          {tarea.empleado_id && (
                            <p className="text-xs truncate">{empleados.get(tarea.empleado_id)?.nombre}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{tarea.tiempo_estimado}min</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Leyenda de procesos */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t">
            {Array.from(procesos.values()).map((proceso, idx) => (
              <div key={proceso.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colores[idx % colores.length]}`} />
                <span className="text-sm">{proceso.nombre}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
