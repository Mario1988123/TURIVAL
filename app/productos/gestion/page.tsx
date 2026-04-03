'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Save, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'

interface Proceso {
  id: string
  nombre: string
  tiempo_estimado_default: number
}

interface ProcesoProducto {
  proceso_id: string
  tiempo_estimado: number
  orden: number
  repeticiones: number
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  descripcion: string
  unidad_tarificacion: string
}

export default function GestionProductos() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [procesosDisponibles, setProcesosDisponibles] = useState<Proceso[]>([])
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null)
  const [procesosSeleccionados, setProcesosSeleccionados] = useState<ProcesoProducto[]>([])
  
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState('')
  const [nuevoProductoCategoria, setNuevoProductoCategoria] = useState('')
  const [nuevoProductoDescripcion, setNuevoProductoDescripcion] = useState('')
  const [nuevoProductoUnidad, setNuevoProductoUnidad] = useState('m2')
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [productosRes, procesosRes] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('procesos_catalogo').select('*').order('orden')
      ])

      setProductos(productosRes.data || [])
      setProcesosDisponibles(procesosRes.data || [])
    } catch (err) {
      setError('Error al cargar datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function crearProducto() {
    if (!nuevoProductoNombre || !nuevoProductoCategoria) {
      setError('Completa nombre y categoría')
      return
    }

    try {
      const { data: newProducto, error: err } = await supabase
        .from('productos')
        .insert({
          nombre: nuevoProductoNombre,
          categoria: nuevoProductoCategoria,
          descripcion: nuevoProductoDescripcion,
          unidad_tarificacion: nuevoProductoUnidad
        })
        .select()
        .single()

      if (err) throw err

      // Agregar procesos si están seleccionados
      if (procesosSeleccionados.length > 0) {
        const procesosParaInsertar = procesosSeleccionados.map((p, idx) => ({
          producto_id: newProducto.id,
          proceso_id: p.proceso_id,
          tiempo_estimado: p.tiempo_estimado,
          orden: idx + 1,
          repeticiones: p.repeticiones
        }))

        const { error: procErr } = await supabase
          .from('procesos_producto')
          .insert(procesosParaInsertar)

        if (procErr) throw procErr
      }

      setSuccess('Producto creado exitosamente')
      setNuevoProductoNombre('')
      setNuevoProductoCategoria('')
      setNuevoProductoDescripcion('')
      setNuevoProductoUnidad('m2')
      setProcesosSeleccionados([])
      loadData()
    } catch (err) {
      setError('Error al crear producto')
      console.error(err)
    }
  }

  async function editarProcesos(producto: Producto) {
    try {
      const { data: procesos } = await supabase
        .from('procesos_producto')
        .select('*')
        .eq('producto_id', producto.id)
        .order('orden')

      setEditandoProducto(producto)
      setProcesosSeleccionados(procesos?.map(p => ({
        proceso_id: p.proceso_id,
        tiempo_estimado: p.tiempo_estimado,
        orden: p.orden,
        repeticiones: p.repeticiones
      })) || [])
    } catch (err) {
      setError('Error al cargar procesos')
    }
  }

  async function guardarProcesos() {
    if (!editandoProducto) return

    try {
      // Eliminar procesos antiguos
      await supabase
        .from('procesos_producto')
        .delete()
        .eq('producto_id', editandoProducto.id)

      // Insertar nuevos
      if (procesosSeleccionados.length > 0) {
        const procesosParaInsertar = procesosSeleccionados.map((p, idx) => ({
          producto_id: editandoProducto.id,
          proceso_id: p.proceso_id,
          tiempo_estimado: p.tiempo_estimado,
          orden: idx + 1,
          repeticiones: p.repeticiones
        }))

        const { error: err } = await supabase
          .from('procesos_producto')
          .insert(procesosParaInsertar)

        if (err) throw err
      }

      setSuccess('Procesos guardados exitosamente')
      setEditandoProducto(null)
      loadData()
    } catch (err) {
      setError('Error al guardar procesos')
      console.error(err)
    }
  }

  function toggleProceso(procesoId: string) {
    const existe = procesosSeleccionados.find(p => p.proceso_id === procesoId)
    
    if (existe) {
      setProcesosSeleccionados(procesosSeleccionados.filter(p => p.proceso_id !== procesoId))
    } else {
      const proceso = procesosDisponibles.find(p => p.id === procesoId)
      if (proceso) {
        setProcesosSeleccionados([
          ...procesosSeleccionados,
          {
            proceso_id: procesoId,
            tiempo_estimado: proceso.tiempo_estimado_default,
            orden: procesosSeleccionados.length + 1,
            repeticiones: 1
          }
        ])
      }
    }
  }

  function actualizarTiempo(idx: number, tiempo: number) {
    const updated = [...procesosSeleccionados]
    updated[idx].tiempo_estimado = tiempo
    setProcesosSeleccionados(updated)
  }

  function actualizarRepeticiones(idx: number, rep: number) {
    const updated = [...procesosSeleccionados]
    updated[idx].repeticiones = Math.max(1, rep)
    setProcesosSeleccionados(updated)
  }

  function moverProceso(idx: number, direccion: 'arriba' | 'abajo') {
    const updated = [...procesosSeleccionados]
    if (direccion === 'arriba' && idx > 0) {
      [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]]
    } else if (direccion === 'abajo' && idx < updated.length - 1) {
      [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    }
    setProcesosSeleccionados(updated)
  }

  function eliminarProceso(idx: number) {
    setProcesosSeleccionados(procesosSeleccionados.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6 p-6">
      {error && <Alert className="bg-red-50"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50"><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Crear nuevo producto */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Producto</CardTitle>
          <CardDescription>Define el producto y sus procesos de producción</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre del Producto</Label>
              <Input
                placeholder="Ej: Puerta de madera"
                value={nuevoProductoNombre}
                onChange={e => setNuevoProductoNombre(e.target.value)}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input
                placeholder="Ej: Puertas"
                value={nuevoProductoCategoria}
                onChange={e => setNuevoProductoCategoria(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Descripción</Label>
            <Input
              placeholder="Descripción del producto"
              value={nuevoProductoDescripcion}
              onChange={e => setNuevoProductoDescripcion(e.target.value)}
            />
          </div>

          <div>
            <Label>Unidad de Tarificación</Label>
            <Select value={nuevoProductoUnidad} onValueChange={setNuevoProductoUnidad}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m2">Metro Cuadrado (m²)</SelectItem>
                <SelectItem value="pieza">Pieza</SelectItem>
                <SelectItem value="unidad">Unidad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Procesos */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-3 block">Procesos de Producción</Label>
            <p className="text-sm text-muted-foreground mb-3">Selecciona los procesos que necesita este producto y configura tiempos</p>

            <div className="space-y-3 mb-4">
              {procesosSeleccionados.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No hay procesos seleccionados</p>
              ) : (
                procesosSeleccionados.map((proc, idx) => {
                  const proceso = procesosDisponibles.find(p => p.id === proc.proceso_id)
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded border">
                      <span className="font-semibold text-sm w-6 text-center">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="font-medium">{proceso?.nombre}</p>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm">Tiempo (min):</label>
                            <Input
                              type="number"
                              min="1"
                              value={proc.tiempo_estimado}
                              onChange={e => actualizarTiempo(idx, parseInt(e.target.value))}
                              className="w-20"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm">Repeticiones:</label>
                            <Input
                              type="number"
                              min="1"
                              value={proc.repeticiones}
                              onChange={e => actualizarRepeticiones(idx, parseInt(e.target.value))}
                              className="w-20"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moverProceso(idx, 'arriba')}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moverProceso(idx, 'abajo')}
                          disabled={idx === procesosSeleccionados.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarProceso(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Selector de procesos disponibles */}
            <div className="bg-blue-50 p-3 rounded border border-blue-200 space-y-2">
              <p className="text-sm font-medium">Procesos disponibles:</p>
              <div className="space-y-2">
                {procesosDisponibles.map(proc => {
                  const isSelected = procesosSeleccionados.some(p => p.proceso_id === proc.id)
                  return (
                    <label key={proc.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleProceso(proc.id)}
                      />
                      <span className="text-sm">{proc.nombre}</span>
                      <span className="text-xs text-muted-foreground">({proc.tiempo_estimado_default}min default)</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <Button onClick={crearProducto} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Crear Producto
          </Button>
        </CardContent>
      </Card>

      {/* Listado de productos */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Productos Existentes</h2>
        {productos.map(prod => (
          <Card key={prod.id}>
            <CardContent className="pt-6 flex justify-between items-start">
              <div>
                <p className="font-semibold">{prod.nombre}</p>
                <p className="text-sm text-muted-foreground">{prod.categoria} • {prod.unidad_tarificacion}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => editarProcesos(prod)}
              >
                Editar Procesos
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de edición */}
      {editandoProducto && (
        <Card className="fixed inset-4 z-50 max-w-2xl mx-auto my-auto shadow-lg">
          <CardHeader>
            <CardTitle>Editar Procesos: {editandoProducto.nombre}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {procesosSeleccionados.length === 0 ? (
              <p className="text-muted-foreground">No hay procesos asignados</p>
            ) : (
              procesosSeleccionados.map((proc, idx) => {
                const proceso = procesosDisponibles.find(p => p.id === proc.proceso_id)
                return (
                  <div key={idx} className="bg-slate-50 p-3 rounded border">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{idx + 1}. {proceso?.nombre}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span>Tiempo: {proc.tiempo_estimado}min</span>
                          <span>Repeticiones: {proc.repeticiones}x</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarProceso(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={guardarProcesos} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </Button>
              <Button variant="outline" onClick={() => setEditandoProducto(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
