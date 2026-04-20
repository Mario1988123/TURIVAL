'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  actualizarProducto,
  listarProcesosCatalogo,
  listarProcesosDeProducto,
  guardarProcesosDeProducto,
  type ProcesoProductoDetalle,
  type ProcesoProductoForm,
} from '@/lib/services/productos'
import type { Producto, ProcesoCatalogo } from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Package,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Info,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

type Linea = ProcesoProductoForm & {
  _uid: string
  nombre_proceso?: string
  codigo_proceso?: string
  orden_tipico?: number
  color_gantt?: string
}

const uid = () => Math.random().toString(36).slice(2, 11)

export default function ProductoDetalleCliente({
  productoInicial,
}: {
  productoInicial: Producto
}) {
  const router = useRouter()
  const [producto, setProducto] = useState<Producto>(productoInicial)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null
  )

  // Tab Datos
  const [form, setForm] = useState({
    nombre: productoInicial.nombre,
    categoria: productoInicial.categoria || '',
    descripcion: productoInicial.descripcion || '',
    unidad_tarificacion: productoInicial.unidad_tarificacion,
    activo: productoInicial.activo,
  })
  const [guardandoDatos, setGuardandoDatos] = useState(false)

  // Tab Procesos
  const [catalogo, setCatalogo] = useState<ProcesoCatalogo[]>([])
  const [lineas, setLineas] = useState<Linea[]>([])
  const [cargandoProcesos, setCargandoProcesos] = useState(true)
  const [guardandoProcesos, setGuardandoProcesos] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [cat, asignados] = await Promise.all([
          listarProcesosCatalogo(),
          listarProcesosDeProducto(producto.id),
        ])
        setCatalogo(cat)
        setLineas(
          asignados.map((a) => ({
            _uid: uid(),
            proceso_id: a.proceso_id,
            secuencia: a.secuencia,
            tiempo_base_minutos: Number(a.tiempo_base_minutos),
            tiempo_por_m2_minutos: Number(a.tiempo_por_m2_minutos),
            factor_simple: Number(a.factor_simple),
            factor_media: Number(a.factor_media),
            factor_compleja: Number(a.factor_compleja),
            es_opcional: a.es_opcional,
            depende_de_secuencia: a.depende_de_secuencia,
            notas: a.notas,
            nombre_proceso: a.proceso.nombre,
            codigo_proceso: a.proceso.codigo,
            orden_tipico: a.proceso.orden_tipico,
            color_gantt: a.proceso.color_gantt,
          }))
        )
      } catch (e: any) {
        setMensaje({ tipo: 'error', texto: e.message })
      } finally {
        setCargandoProcesos(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 5000)
    return () => clearTimeout(t)
  }, [mensaje])

  // ============================================================
  // TAB DATOS
  // ============================================================

  async function guardarDatos() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }
    setGuardandoDatos(true)
    try {
      const actualizado = await actualizarProducto(producto.id, {
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim() || null,
        descripcion: form.descripcion.trim() || null,
        unidad_tarificacion: form.unidad_tarificacion,
        activo: form.activo,
      })
      setProducto(actualizado)
      setMensaje({ tipo: 'ok', texto: 'Datos guardados.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardandoDatos(false)
    }
  }

  // ============================================================
  // TAB PROCESOS
  // ============================================================

  function anadirLinea(procesoId: string) {
    const proc = catalogo.find((c) => c.id === procesoId)
    if (!proc) return
    // Calcular siguiente secuencia
    const maxSec = lineas.reduce((m, l) => Math.max(m, l.secuencia), 0)
    const nueva: Linea = {
      _uid: uid(),
      proceso_id: procesoId,
      secuencia: maxSec + 1,
      tiempo_base_minutos: 0,
      tiempo_por_m2_minutos: 0,
      factor_simple: 0.8,
      factor_media: 1.0,
      factor_compleja: 1.3,
      es_opcional: false,
      depende_de_secuencia: maxSec > 0 ? maxSec : null,
      notas: null,
      nombre_proceso: proc.nombre,
      codigo_proceso: proc.codigo,
      orden_tipico: proc.orden_tipico,
      color_gantt: proc.color_gantt,
    }
    setLineas((prev) => [...prev, nueva])
  }

  function actualizarLinea(uidL: string, cambios: Partial<Linea>) {
    setLineas((prev) =>
      prev.map((l) => (l._uid === uidL ? { ...l, ...cambios } : l))
    )
  }

  function eliminarLinea(uidL: string) {
    setLineas((prev) => prev.filter((l) => l._uid !== uidL))
  }

  function moverLinea(uidL: string, direccion: 'arriba' | 'abajo') {
    setLineas((prev) => {
      const sorted = [...prev].sort((a, b) => a.secuencia - b.secuencia)
      const idx = sorted.findIndex((l) => l._uid === uidL)
      if (idx === -1) return prev
      const otroIdx = direccion === 'arriba' ? idx - 1 : idx + 1
      if (otroIdx < 0 || otroIdx >= sorted.length) return prev
      const seqA = sorted[idx].secuencia
      const seqB = sorted[otroIdx].secuencia
      sorted[idx].secuencia = seqB
      sorted[otroIdx].secuencia = seqA
      return sorted
    })
  }

  async function guardarProcesos() {
    // Validar secuencias únicas
    const seqs = lineas.map((l) => l.secuencia)
    const duplicadas = seqs.filter((s, i) => seqs.indexOf(s) !== i)
    if (duplicadas.length > 0) {
      setMensaje({
        tipo: 'error',
        texto: `Hay secuencias duplicadas: ${duplicadas.join(', ')}`,
      })
      return
    }
    setGuardandoProcesos(true)
    try {
      await guardarProcesosDeProducto(
        producto.id,
        lineas.map((l) => ({
          proceso_id: l.proceso_id,
          secuencia: l.secuencia,
          tiempo_base_minutos: l.tiempo_base_minutos,
          tiempo_por_m2_minutos: l.tiempo_por_m2_minutos,
          factor_simple: l.factor_simple,
          factor_media: l.factor_media,
          factor_compleja: l.factor_compleja,
          es_opcional: l.es_opcional,
          depende_de_secuencia: l.depende_de_secuencia,
          notas: l.notas,
        }))
      )
      setMensaje({ tipo: 'ok', texto: 'Procesos guardados correctamente.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardandoProcesos(false)
    }
  }

  // Procesos del catálogo que aún no están asignados
  const procesosDisponibles = catalogo.filter(
    (c) => !lineas.some((l) => l.proceso_id === c.id && !c.permite_repetir)
  )

  // Ordenar líneas por secuencia para mostrar
  const lineasOrdenadas = [...lineas].sort((a, b) => a.secuencia - b.secuencia)

  // Tiempo total estimado con complejidad media + 1m² (aprox)
  const tiempoTotalMin = lineasOrdenadas.reduce((sum, l) => {
    return (
      sum +
      (l.tiempo_base_minutos + l.tiempo_por_m2_minutos * 1) * l.factor_media
    )
  }, 0)

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/productos')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
              <Package className="w-8 h-8" />
              {producto.nombre}
              {!producto.activo && (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactivo
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {producto.categoria || 'Sin categoría'} ·{' '}
              {producto.unidad_tarificacion === 'm2' ? 'por m²' : 'por pieza'}
            </p>
          </div>
        </div>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* TABS */}
      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="procesos">
            Procesos ({lineas.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB DATOS */}
        <TabsContent value="datos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Input
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({ ...form, categoria: e.target.value })
                    }
                    placeholder="Ej: Muebles cocina"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unidad de tarificación</Label>
                  <Select
                    value={form.unidad_tarificacion}
                    onValueChange={(v: 'm2' | 'pieza') =>
                      setForm({ ...form, unidad_tarificacion: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m2">Por m²</SelectItem>
                      <SelectItem value="pieza">Por pieza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm({ ...form, activo: e.target.checked })
                  }
                />
                <Label htmlFor="activo" className="cursor-pointer">
                  Producto activo
                </Label>
              </div>
              <div className="pt-2">
                <Button onClick={guardarDatos} disabled={guardandoDatos}>
                  <Save className="w-4 h-4 mr-2" />
                  {guardandoDatos ? 'Guardando...' : 'Guardar datos'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB PROCESOS */}
        <TabsContent value="procesos" className="mt-4 space-y-4">
          {/* Info */}
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Configura la <strong>secuencia de procesos</strong> que sigue este
              producto en producción. Cada proceso tiene un tiempo base (minutos)
              y un tiempo por m² (si aplica). Los factores simple/media/compleja
              ajustan el tiempo según complejidad de la pieza. Los pasos{' '}
              <strong>opcionales</strong> pueden saltarse en producción según la
              pieza (ej: Lijado 2, Fondeado 2).
            </AlertDescription>
          </Alert>

          {cargandoProcesos ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Añadir proceso */}
              <Card>
                <CardContent className="flex items-center gap-3 py-4 flex-wrap">
                  <div className="flex-1 min-w-60">
                    <Label className="text-xs">Añadir proceso al flujo</Label>
                    <Select
                      onValueChange={(v) => {
                        if (v) anadirLinea(v)
                      }}
                      value=""
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proceso..." />
                      </SelectTrigger>
                      <SelectContent>
                        {procesosDisponibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.orden_tipico}. {p.nombre}{' '}
                            {p.permite_repetir && (
                              <span className="text-muted-foreground text-xs">
                                (repetible)
                              </span>
                            )}
                          </SelectItem>
                        ))}
                        {catalogo
                          .filter((c) => c.permite_repetir)
                          .map((p) => (
                            <SelectItem key={`rep-${p.id}`} value={p.id}>
                              {p.orden_tipico}. {p.nombre} (repetir)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={guardarProcesos}
                    disabled={guardandoProcesos}
                    size="default"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {guardandoProcesos
                      ? 'Guardando...'
                      : 'Guardar flujo de procesos'}
                  </Button>
                </CardContent>
              </Card>

              {/* Listado de procesos del producto */}
              {lineasOrdenadas.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-10 text-sm text-muted-foreground">
                    Este producto aún no tiene procesos asignados.
                    <br />
                    Añade uno desde el selector de arriba.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {lineasOrdenadas.map((l, idx) => (
                    <Card key={l._uid}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Número secuencia + color */}
                          <div
                            className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{
                              backgroundColor: l.color_gantt || '#64748b',
                            }}
                          >
                            {l.secuencia}
                          </div>

                          {/* Info proceso */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                              <div>
                                <div className="font-semibold flex items-center gap-2 flex-wrap">
                                  {l.nombre_proceso}
                                  {l.es_opcional && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-900 border-amber-300 text-xs"
                                    >
                                      Opcional
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {l.codigo_proceso}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => moverLinea(l._uid, 'arriba')}
                                  disabled={idx === 0}
                                  title="Subir"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => moverLinea(l._uid, 'abajo')}
                                  disabled={idx === lineasOrdenadas.length - 1}
                                  title="Bajar"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700"
                                  onClick={() => eliminarLinea(l._uid)}
                                  title="Quitar del flujo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Tiempos */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Tiempo base (min)
                                </Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  className="h-8"
                                  value={l.tiempo_base_minutos}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      tiempo_base_minutos: Number(
                                        e.target.value
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Tiempo por m² (min)
                                </Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  className="h-8"
                                  value={l.tiempo_por_m2_minutos}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      tiempo_por_m2_minutos: Number(
                                        e.target.value
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Secuencia</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-8"
                                  value={l.secuencia}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      secuencia: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Depende de (sec.)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8"
                                  placeholder="—"
                                  value={l.depende_de_secuencia ?? ''}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      depende_de_secuencia:
                                        e.target.value === ''
                                          ? null
                                          : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Factores complejidad */}
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Factor simple ×</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  className="h-8 bg-green-50"
                                  value={l.factor_simple}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      factor_simple: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Factor media ×</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  className="h-8 bg-blue-50"
                                  value={l.factor_media}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      factor_media: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Factor compleja ×</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  className="h-8 bg-red-50"
                                  value={l.factor_compleja}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      factor_compleja: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Opciones extra */}
                            <div className="flex items-center gap-4 flex-wrap mb-2">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={l.es_opcional}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      es_opcional: e.target.checked,
                                    })
                                  }
                                />
                                <span>Paso opcional (puede saltarse)</span>
                              </label>
                            </div>

                            {/* Notas */}
                            <div className="space-y-1">
                              <Label className="text-xs">Notas internas</Label>
                              <Input
                                className="h-8"
                                value={l.notas ?? ''}
                                onChange={(e) =>
                                  actualizarLinea(l._uid, {
                                    notas: e.target.value || null,
                                  })
                                }
                                placeholder="Indicaciones para el operario..."
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Resumen tiempo total */}
                  <Card className="bg-slate-50">
                    <CardContent className="py-4 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">
                          Tiempo estimado total (complejidad media, 1 m²)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Estimación orientativa. El sistema aprenderá con datos reales
                          cuando se completen tareas.
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-700">
                        {tiempoTotalMin.toFixed(0)} min
                      </div>
                    </CardContent>
                  </Card>

                  {/* Botón guardar abajo también */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={guardarProcesos}
                      disabled={guardandoProcesos}
                      size="lg"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {guardandoProcesos
                        ? 'Guardando...'
                        : 'Guardar flujo de procesos'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
