'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Empleado {
  id: string
  nombre: string
  especialidad: string
  disponible: boolean
}

interface TareaProduccion {
  id: string
  nombre: string
  empleado_id: string | null
  tiempo_estimado: number | null
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  orden_secuencia: number
}

interface Props {
  loteId: string
}

export function GanttCarga({ loteId }: Props) {
  const supabase = createClient()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [tareas, setTareas] = useState<TareaProduccion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [loteId])

  async function loadData() {
    try {
      setLoading(true)

      // Cargar empleados
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('*')

      setEmpleados(empleadosData || [])

      // Cargar tareas del lote
      const { data: tareasData } = await supabase
        .from('tareas_produccion')
        .select('*')
        .eq('lote_id', loteId)

      setTareas(tareasData || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando carga de empleados...</div>
  }

  // Calcular carga por empleado
  const calcularCargaEmpleado = (empleadoId: string) => {
    return tareas
      .filter(t => t.empleado_id === empleadoId && t.estado === 'en_progreso')
      .reduce((sum, t) => sum + (t.tiempo_estimado || 0), 0)
  }

  const maxCarga = Math.max(
    ...empleados.map(e => calcularCargaEmpleado(e.id)),
    480
  )

  const estadoColor: Record<string, string> = {
    'pendiente': 'bg-gray-200',
    'en_progreso': 'bg-blue-500',
    'completada': 'bg-green-500',
    'pausada': 'bg-yellow-500',
  }

  return (
    <div className="space-y-6">
      {/* Vista Gantt de carga */}
      <Card>
        <CardHeader>
          <CardTitle>Carga de Empleados (minutos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {empleados.map((empleado) => {
              const carga = calcularCargaEmpleado(empleado.id)
              const porcentaje = (carga / maxCarga) * 100

              return (
                <div key={empleado.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-32">
                      <p className="font-medium text-sm">{empleado.nombre}</p>
                      <p className="text-xs text-muted-foreground">{empleado.especialidad}</p>
                    </div>
                    <Badge variant={carga > 480 ? 'destructive' : 'default'}>
                      {carga} min
                    </Badge>
                  </div>
                  <div className="flex-1 bg-gray-200 rounded h-6 overflow-hidden">
                    <div
                      className={`h-full ${porcentaje > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-300`}
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detalle de tareas asignadas */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas Asignadas por Empleado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {empleados.map((empleado) => {
              const tareasEmpleado = tareas.filter(t => t.empleado_id === empleado.id)

              if (tareasEmpleado.length === 0) {
                return (
                  <div key={empleado.id}>
                    <p className="font-medium">{empleado.nombre}</p>
                    <p className="text-sm text-muted-foreground">Sin tareas asignadas</p>
                  </div>
                )
              }

              return (
                <div key={empleado.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium">{empleado.nombre}</p>
                    <Badge variant="outline">{tareasEmpleado.length} tareas</Badge>
                  </div>
                  <div className="space-y-2 ml-4">
                    {tareasEmpleado.map((tarea) => (
                      <div key={tarea.id} className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-3 h-3 rounded-full ${estadoColor[tarea.estado] || 'bg-gray-300'}`}
                        />
                        <span>{tarea.nombre}</span>
                        <span className="text-muted-foreground">({tarea.tiempo_estimado} min)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
