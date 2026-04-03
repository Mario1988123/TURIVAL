'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, Pause, CheckCircle, AlertCircle } from 'lucide-react'

interface TareaProduccion {
  id: string
  nombre: string
  estado: string
  empleado_id: string | null
  tiempo_estimado: number | null
  tiempo_real: number | null
  orden_secuencia: number
  empleados?: { nombre: string; especialidad: string } | null
}

interface Props {
  loteId: string
}

export function ListaTareas({ loteId }: Props) {
  const supabase = createClient()
  const [tareas, setTareas] = useState<TareaProduccion[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [loteId])

  async function loadData() {
    try {
      setLoading(true)
      
      // Cargar tareas
      const { data: tareasData } = await supabase
        .from('tareas_produccion')
        .select(`
          *,
          empleados (nombre, especialidad)
        `)
        .eq('lote_id', loteId)
        .order('orden_secuencia')

      setTareas(tareasData || [])

      // Cargar empleados
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('*')
        .eq('disponible', true)

      setEmpleados(empleadosData || [])
    } catch (err) {
      console.error('Error cargando tareas:', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateTareaEstado(tareaId: string, nuevoEstado: string) {
    try {
      const updates: any = { estado: nuevoEstado }
      if (nuevoEstado === 'en_progreso') {
        updates.fecha_inicio = new Date().toISOString()
      } else if (nuevoEstado === 'completada') {
        updates.fecha_fin = new Date().toISOString()
      }

      await supabase
        .from('tareas_produccion')
        .update(updates)
        .eq('id', tareaId)

      loadData()
    } catch (err) {
      console.error('Error actualizando tarea:', err)
    }
  }

  async function asignarEmpleado(tareaId: string, empleadoId: string) {
    try {
      await supabase
        .from('tareas_produccion')
        .update({ empleado_id: empleadoId })
        .eq('id', tareaId)

      loadData()
    } catch (err) {
      console.error('Error asignando empleado:', err)
    }
  }

  const estadoColor: Record<string, string> = {
    'pendiente': 'bg-gray-100 text-gray-800',
    'en_progreso': 'bg-blue-100 text-blue-800',
    'completada': 'bg-green-100 text-green-800',
    'pausada': 'bg-yellow-100 text-yellow-800',
  }

  const getStateIcon = (estado: string) => {
    switch (estado) {
      case 'en_progreso': return <Play className="w-4 h-4" />
      case 'completada': return <CheckCircle className="w-4 h-4" />
      case 'pausada': return <Pause className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando tareas...</div>
  }

  if (tareas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No hay tareas para este lote</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas de Producción ({tareas.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tiempo Est. (min)</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tareas.map((tarea) => (
                <TableRow key={tarea.id}>
                  <TableCell className="font-mono text-sm">{tarea.orden_secuencia}</TableCell>
                  <TableCell className="font-medium">{tarea.nombre}</TableCell>
                  <TableCell>
                    {tarea.empleado_id ? (
                      <div className="text-sm">
                        <p className="font-medium">{tarea.empleados?.nombre}</p>
                        <p className="text-xs text-muted-foreground">{tarea.empleados?.especialidad}</p>
                      </div>
                    ) : (
                      <Select onValueChange={(empleadoId) => asignarEmpleado(tarea.id, empleadoId)}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Asignar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {empleados.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={estadoColor[tarea.estado] || ''}>
                      <div className="flex items-center gap-1">
                        {getStateIcon(tarea.estado)}
                        {tarea.estado}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{tarea.tiempo_estimado || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {tarea.estado === 'pendiente' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateTareaEstado(tarea.id, 'en_progreso')}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {tarea.estado === 'en_progreso' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateTareaEstado(tarea.id, 'pausada')}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateTareaEstado(tarea.id, 'completada')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {tarea.estado === 'pausada' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateTareaEstado(tarea.id, 'en_progreso')}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
