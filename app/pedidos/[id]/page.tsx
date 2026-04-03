'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowLeft, FileText, Factory, Truck, Printer, Phone, Mail, 
  Calendar, CheckCircle, Clock, Play, Package, AlertTriangle,
  ChevronLeft, ChevronRight
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

interface ProcesoProducto {
  id: string
  proceso_id: string
  tiempo_estimado: number
  orden: number
  procesos_catalogo: Proceso
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
  fecha_inicio: Date
  fecha_fin: Date
  orden: number
}

const HORAS_LABORALES = Array.from({ length: 10 }, (_, i) => i + 8) // 8:00 - 17:00

export default function PedidoDetalle() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Gantt Modal
  const [showGanttModal, setShowGanttModal] = useState(false)
  const [procesosProducto, setProcesosProducto] = useState<ProcesoProducto[]>([])
  const [tareasExistentes, setTareasExistentes] = useState<TareaExistente[]>([])
  const [tareasProgramadas, setTareasProgramadas] = useState<TareaProgramada[]>([])
  const [fechaGantt, setFechaGantt] = useState(new Date())
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaPedido | null>(null)
  const [carros, setCarros] = useState<{id: string, codigo: string}[]>([])
  const [carroSeleccionado, setCarroSeleccionado] = useState('')
  const [showCarroModal, setShowCarroModal] = useState(false)

  useEffect(() => {
    loadPedido()
    loadCarros()
  }, [id])

  async function loadPedido() {
    try {
      setLoading(true)
      const { data: pedidoData, error: pedidoErr } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes (id, nombre_comercial, razon_social, email, telefono, direccion),
          presupuestos (id, numero)
        `)
        .eq('id', id)
        .single()

      if (pedidoErr) throw pedidoErr
      setPedido(pedidoData)

      const { data: lineasData } = await supabase
        .from('lineas_pedido')
        .select(`*, productos (id, nombre, categoria)`)
        .eq('pedido_id', id)
        .order('numero_linea')

      setLineas(lineasData || [])
    } catch (err) {
      console.error('Error cargando pedido:', err)
      setError('Error al cargar pedido')
    } finally {
      setLoading(false)
    }
  }

  async function loadCarros() {
    const { data } = await supabase.from('carros').select('id, codigo').eq('activo', true)
    setCarros(data || [])
  }

  async function loadProcesosParaProducto(productoId: string) {
    // Cargar procesos configurados para este producto
    const { data: procesosData } = await supabase
      .from('procesos_producto')
      .select(`*, procesos_catalogo (id, nombre, orden, tiempo_estimado_default)`)
      .eq('producto_id', productoId)
      .order('orden')

    if (procesosData && procesosData.length > 0) {
      setProcesosProducto(procesosData)
    } else {
      // Si no hay procesos configurados, cargar los 8 por defecto
      const { data: defaultProcesos } = await supabase
        .from('procesos_catalogo')
        .select('*')
        .eq('activo', true)
        .order('orden')

      const procDefault = (defaultProcesos || []).map(p => ({
        id: p.id,
        proceso_id: p.id,
        tiempo_estimado: p.tiempo_estimado_default,
        orden: p.orden,
        procesos_catalogo: p
      }))
      setProcesosProducto(procDefault)
    }

    // Cargar tareas existentes en el calendario para ver ocupacion
    const startOfWeek = new Date(fechaGantt)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)

    const { data: tareasData } = await supabase
      .from('tareas_produccion')
      .select(`*, piezas (codigo_unico)`)
      .gte('fecha_programada_inicio', startOfWeek.toISOString())
      .lte('fecha_programada_inicio', endOfWeek.toISOString())
      .not('fecha_programada_inicio', 'is', null)

    setTareasExistentes(tareasData || [])
  }

  function abrirGanttParaLinea(linea: LineaPedido) {
    setLineaSeleccionada(linea)
    loadProcesosParaProducto(linea.producto_id)
    
    // Inicializar tareas programadas con hora de inicio del dia actual
    const ahora = new Date()
    ahora.setHours(8, 0, 0, 0)
    
    setTareasProgramadas([])
    setShowGanttModal(true)
  }

  function programarTareasAutomaticas() {
    if (procesosProducto.length === 0) return

    const tareas: TareaProgramada[] = []
    let horaActual = new Date(fechaGantt)
    horaActual.setHours(8, 0, 0, 0)

    for (const pp of procesosProducto) {
      const duracionMinutos = pp.tiempo_estimado
      const fechaInicio = new Date(horaActual)
      const fechaFin = new Date(horaActual.getTime() + duracionMinutos * 60000)

      // Si pasa de las 18:00, mover al dia siguiente
      if (fechaFin.getHours() >= 18) {
        horaActual.setDate(horaActual.getDate() + 1)
        horaActual.setHours(8, 0, 0, 0)
        fechaFin.setTime(horaActual.getTime() + duracionMinutos * 60000)
      }

      tareas.push({
        proceso_id: pp.proceso_id,
        proceso_nombre: pp.procesos_catalogo.nombre,
        tiempo_estimado: duracionMinutos,
        fecha_inicio: new Date(horaActual),
        fecha_fin: fechaFin,
        orden: pp.orden
      })

      horaActual = new Date(fechaFin)
    }

    setTareasProgramadas(tareas)
  }

  function getFechaEntregaEstimada(): Date | null {
    if (tareasProgramadas.length === 0) return null
    const ultimaTarea = tareasProgramadas[tareasProgramadas.length - 1]
    return ultimaTarea.fecha_fin
  }

  async function confirmarProgramacion() {
    if (!lineaSeleccionada || tareasProgramadas.length === 0) return

    // Mostrar modal de seleccion de carro
    setShowCarroModal(true)
  }

  async function confirmarConCarro() {
    if (!lineaSeleccionada || !pedido || !carroSeleccionado) return

    try {
      setSaving(true)

      // Crear pieza para esta linea
      const codigoUnico = `PIE-${Date.now()}`
      const qrCode = `QR-${pedido.numero}-${lineaSeleccionada.numero_linea}`

      const { data: pieza, error: piezaErr } = await supabase
        .from('piezas')
        .insert({
          codigo_unico: codigoUnico,
          codigo_qr: qrCode,
          qr_code: qrCode,
          pedido_id: pedido.id,
          carro_id: carroSeleccionado,
          estado: 'programada'
        })
        .select()
        .single()

      if (piezaErr) throw piezaErr

      // Crear tareas de produccion
      for (const tarea of tareasProgramadas) {
        await supabase.from('tareas_produccion').insert({
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

      // Actualizar fecha de entrega del pedido
      const fechaEntrega = getFechaEntregaEstimada()
      if (fechaEntrega) {
        await supabase
          .from('pedidos')
          .update({ 
            fecha_entrega: fechaEntrega.toISOString(),
            estado: 'confirmado'
          })
          .eq('id', pedido.id)

        setPedido({ ...pedido, fecha_entrega: fechaEntrega.toISOString(), estado: 'confirmado' })
      }

      setShowCarroModal(false)
      setShowGanttModal(false)
      setTareasProgramadas([])
      
    } catch (err) {
      console.error('Error confirmando programacion:', err)
      setError('Error al confirmar programacion')
    } finally {
      setSaving(false)
    }
  }

  async function pasarAProduccion() {
    if (!pedido) return
    try {
      setSaving(true)
      await supabase.from('pedidos').update({ estado: 'en_produccion' }).eq('id', id)
      setPedido({ ...pedido, estado: 'en_produccion' })
      router.push('/produccion')
    } catch (err) {
      setError('Error al pasar a produccion')
    } finally {
      setSaving(false)
    }
  }

  async function marcarCompletado() {
    if (!pedido) return
    try {
      setSaving(true)
      await supabase.from('pedidos').update({ estado: 'completado' }).eq('id', id)
      setPedido({ ...pedido, estado: 'completado' })
    } catch (err) {
      setError('Error al marcar como completado')
    } finally {
      setSaving(false)
    }
  }

  async function marcarEntregado() {
    if (!pedido) return
    try {
      setSaving(true)
      await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', id)
      setPedido({ ...pedido, estado: 'entregado' })
    } catch (err) {
      setError('Error al marcar como entregado')
    } finally {
      setSaving(false)
    }
  }

  function getEstadoBadge(estado: string) {
    const colores: Record<string, string> = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'confirmado': 'bg-blue-100 text-blue-800',
      'en_produccion': 'bg-purple-100 text-purple-800',
      'completado': 'bg-green-100 text-green-800',
      'entregado': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800'
    }
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'confirmado': 'Confirmado',
      'en_produccion': 'En Produccion',
      'completado': 'Completado',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado'
    }
    return <Badge className={colores[estado] || ''}>{labels[estado] || estado}</Badge>
  }

  // Gantt helpers
  function getDiaSemana(offset: number) {
    const dia = new Date(fechaGantt)
    const startOfWeek = dia.getDate() - dia.getDay() + 1 + offset
    dia.setDate(startOfWeek)
    return dia
  }

  function formatDia(date: Date) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
    return `${dias[date.getDay()]} ${date.getDate()}`
  }

  function getTareaEnSlot(dia: Date, hora: number): TareaProgramada | TareaExistente | null {
    // Primero buscar en tareas programadas (nuevas)
    for (const t of tareasProgramadas) {
      if (t.fecha_inicio.getDate() === dia.getDate() &&
          t.fecha_inicio.getMonth() === dia.getMonth() &&
          t.fecha_inicio.getHours() <= hora &&
          t.fecha_fin.getHours() > hora) {
        return t
      }
    }
    // Luego buscar en tareas existentes
    for (const t of tareasExistentes) {
      const inicio = new Date(t.fecha_programada_inicio)
      const fin = new Date(t.fecha_programada_fin)
      if (inicio.getDate() === dia.getDate() &&
          inicio.getMonth() === dia.getMonth() &&
          inicio.getHours() <= hora &&
          fin.getHours() > hora) {
        return t
      }
    }
    return null
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>Pedido no encontrado</AlertDescription>
        </Alert>
        <Link href="/pedidos">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a pedidos
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pedidos">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{pedido.numero}</h1>
            <p className="text-sm text-muted-foreground">
              Creado el {new Date(pedido.fecha).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getEstadoBadge(pedido.estado)}
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos del pedido */}
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

            {/* Prioridad y Fecha de entrega */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridad</Label>
                <Select 
                  value={pedido.prioridad || 'normal'} 
                  onValueChange={async (value) => {
                    await supabase.from('pedidos').update({ prioridad: value }).eq('id', pedido.id)
                    setPedido({ ...pedido, prioridad: value })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de entrega</Label>
                <div className="flex items-center gap-2 mt-1">
                  {pedido.fecha_entrega ? (
                    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Se define al programar en Gantt</span>
                  )}
                </div>
              </div>
            </div>

            {pedido.observaciones && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm">{pedido.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen y Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{pedido.subtotal?.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (21%)</span>
                <span>{pedido.impuestos?.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span className="text-blue-600">{pedido.total?.toFixed(2)}€</span>
              </div>
            </div>

            {/* Botones de accion con iconos */}
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">Acciones</p>
              
              {pedido.estado === 'pendiente' && (
                <Button 
                  className="w-full" 
                  onClick={() => {
                    if (lineas.length > 0) {
                      abrirGanttParaLinea(lineas[0])
                    }
                  }}
                  disabled={lineas.length === 0}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Programar en Gantt
                </Button>
              )}

              {pedido.estado === 'confirmado' && (
                <Button className="w-full" variant="default" onClick={pasarAProduccion} disabled={saving}>
                  <Factory className="w-4 h-4 mr-2" />
                  Pasar a Produccion
                </Button>
              )}

              {pedido.estado === 'en_produccion' && (
                <Button className="w-full" variant="default" onClick={marcarCompletado} disabled={saving}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar Completado
                </Button>
              )}

              {pedido.estado === 'completado' && (
                <Button className="w-full" variant="default" onClick={marcarEntregado} disabled={saving}>
                  <Truck className="w-4 h-4 mr-2" />
                  Marcar Entregado
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lineas del pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Lineas del Pedido ({lineas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Este pedido no tiene lineas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
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
                    <TableCell className="text-center">
                      {linea.cantidad} {linea.unidad || 'm2'}
                    </TableCell>
                    <TableCell className="text-right">{linea.precio_unitario?.toFixed(2)}€</TableCell>
                    <TableCell className="text-right font-medium">{linea.subtotal?.toFixed(2)}€</TableCell>
                    <TableCell className="text-center">
                      {pedido.estado === 'pendiente' && (
                        <Button size="sm" variant="outline" onClick={() => abrirGanttParaLinea(linea)}>
                          <Calendar className="w-4 h-4 mr-1" />
                          Programar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Gantt */}
      <Dialog open={showGanttModal} onOpenChange={setShowGanttModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Programar Produccion - {lineaSeleccionada?.productos?.nombre}
            </DialogTitle>
            <DialogDescription>
              Programa los procesos de produccion en el calendario. Las casillas grises estan ocupadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Navegacion semana */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => {
                const newDate = new Date(fechaGantt)
                newDate.setDate(newDate.getDate() - 7)
                setFechaGantt(newDate)
              }}>
                <ChevronLeft className="w-4 h-4" />
                Semana anterior
              </Button>
              <span className="font-medium">
                Semana del {getDiaSemana(0).toLocaleDateString('es-ES')}
              </span>
              <Button variant="outline" size="sm" onClick={() => {
                const newDate = new Date(fechaGantt)
                newDate.setDate(newDate.getDate() + 7)
                setFechaGantt(newDate)
              }}>
                Semana siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Procesos a programar */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Procesos:</span>
              {procesosProducto.map(pp => (
                <Badge key={pp.id} variant="outline">
                  {pp.procesos_catalogo.nombre} ({pp.tiempo_estimado} min)
                </Badge>
              ))}
              <Button size="sm" variant="default" onClick={programarTareasAutomaticas}>
                <Play className="w-4 h-4 mr-1" />
                Programar automaticamente
              </Button>
            </div>

            {/* Calendario Gantt */}
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 border-r w-16">Hora</th>
                    {[0, 1, 2, 3, 4].map(offset => (
                      <th key={offset} className="p-2 border-r min-w-[120px]">
                        {formatDia(getDiaSemana(offset))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HORAS_LABORALES.map(hora => (
                    <tr key={hora} className="border-t">
                      <td className="p-2 border-r text-center font-medium bg-slate-50">
                        {hora}:00
                      </td>
                      {[0, 1, 2, 3, 4].map(offset => {
                        const dia = getDiaSemana(offset)
                        const tarea = getTareaEnSlot(dia, hora)
                        const esProgramada = tarea && 'proceso_nombre' in tarea
                        const esExistente = tarea && !('proceso_nombre' in tarea)
                        
                        return (
                          <td 
                            key={offset} 
                            className={`p-1 border-r h-10 ${
                              esExistente ? 'bg-gray-200' : 
                              esProgramada ? 'bg-blue-100' : 
                              'bg-white hover:bg-blue-50 cursor-pointer'
                            }`}
                          >
                            {esProgramada && (
                              <div className="text-xs p-1 bg-blue-500 text-white rounded truncate">
                                {(tarea as TareaProgramada).proceso_nombre}
                              </div>
                            )}
                            {esExistente && (
                              <div className="text-xs p-1 bg-gray-400 text-white rounded truncate">
                                {(tarea as TareaExistente).nombre}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen */}
            {tareasProgramadas.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-800">Programacion lista</p>
                    <p className="text-sm text-green-700">
                      {tareasProgramadas.length} procesos programados. 
                      Fecha de entrega estimada: {getFechaEntregaEstimada()?.toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <Button onClick={confirmarProgramacion} disabled={saving}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Seleccion Carro */}
      <Dialog open={showCarroModal} onOpenChange={setShowCarroModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Asignar Carro
            </DialogTitle>
            <DialogDescription>
              Selecciona el carro donde ubicar las piezas de este pedido
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Carro</Label>
              <Select value={carroSeleccionado} onValueChange={setCarroSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar carro..." />
                </SelectTrigger>
                <SelectContent>
                  {carros.map(carro => (
                    <SelectItem key={carro.id} value={carro.id}>
                      {carro.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCarroModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarConCarro} disabled={!carroSeleccionado || saving}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar y Crear Pieza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
