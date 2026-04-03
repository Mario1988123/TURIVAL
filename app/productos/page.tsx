'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Save, Clock, Settings } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Proceso {
  id: string
  nombre: string
  tiempo_estimado_default: number
  orden: number
}

interface ProcesoProducto {
  proceso_id: string
  nombre: string
  tiempo_estimado: number
  orden: number
  repeticiones: number
  activo: boolean
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  descripcion: string
  unidad_tarificacion: string
  activo: boolean
}

interface Color {
  id: string
  codigo: string
  nombre: string
  tipo: string
  hex_aproximado: string
  sobrecoste: number
  activo: boolean
}

interface Tarifa {
  id: string
  nombre: string
  modo_precio: string
  precio_m2: number
  precio_pieza: number
  precio_minimo: number
  activo: boolean
}

export default function ProductosPage() {
  const supabase = createClient()
  
  // Estados principales
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<Color[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [procesosDisponibles, setProcesosDisponibles] = useState<Proceso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Estados de dialogs
  const [dialogProducto, setDialogProducto] = useState(false)
  const [dialogColor, setDialogColor] = useState(false)
  const [dialogTarifa, setDialogTarifa] = useState(false)
  const [dialogProcesos, setDialogProcesos] = useState(false)
  
  // Estados de formulario de producto
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null)
  const [formProducto, setFormProducto] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    unidad_tarificacion: 'm2'
  })
  
  // Estados de procesos del producto
  const [productoParaProcesos, setProductoParaProcesos] = useState<Producto | null>(null)
  const [procesosProducto, setProcesosProducto] = useState<ProcesoProducto[]>([])
  
  // Estados de formulario de color
  const [editandoColor, setEditandoColor] = useState<Color | null>(null)
  const [formColor, setFormColor] = useState({
    codigo: '',
    nombre: '',
    tipo: 'RAL',
    hex_aproximado: '#ffffff',
    sobrecoste: 0
  })
  
  // Estados de formulario de tarifa
  const [editandoTarifa, setEditandoTarifa] = useState<Tarifa | null>(null)
  const [formTarifa, setFormTarifa] = useState({
    nombre: '',
    modo_precio: 'm2',
    precio_m2: 0,
    precio_pieza: 0,
    precio_minimo: 0
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      setLoading(true)
      
      const [prodRes, colRes, tarRes, procRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('colores').select('*').order('codigo'),
        supabase.from('tarifas').select('*').order('nombre'),
        supabase.from('procesos_catalogo').select('*').order('orden')
      ])
      
      setProductos(prodRes.data || [])
      setColores(colRes.data || [])
      setTarifas(tarRes.data || [])
      setProcesosDisponibles(procRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // ==================== PRODUCTOS ====================
  
  function abrirNuevoProducto() {
    setEditandoProducto(null)
    setFormProducto({ nombre: '', categoria: '', descripcion: '', unidad_tarificacion: 'm2' })
    setDialogProducto(true)
  }
  
  function abrirEditarProducto(prod: Producto) {
    setEditandoProducto(prod)
    setFormProducto({
      nombre: prod.nombre,
      categoria: prod.categoria || '',
      descripcion: prod.descripcion || '',
      unidad_tarificacion: prod.unidad_tarificacion || 'm2'
    })
    setDialogProducto(true)
  }
  
  async function guardarProducto() {
    if (!formProducto.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    
    try {
      if (editandoProducto) {
        const { error: err } = await supabase
          .from('productos')
          .update({
            nombre: formProducto.nombre,
            categoria: formProducto.categoria,
            descripcion: formProducto.descripcion,
            unidad_tarificacion: formProducto.unidad_tarificacion
          })
          .eq('id', editandoProducto.id)
        
        if (err) throw err
        setSuccess('Producto actualizado')
      } else {
        const { error: err } = await supabase
          .from('productos')
          .insert({
            nombre: formProducto.nombre,
            categoria: formProducto.categoria,
            descripcion: formProducto.descripcion,
            unidad_tarificacion: formProducto.unidad_tarificacion,
            activo: true
          })
        
        if (err) throw err
        setSuccess('Producto creado')
      }
      
      setDialogProducto(false)
      cargarDatos()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }
  
  async function toggleProductoActivo(prod: Producto) {
    await supabase.from('productos').update({ activo: !prod.activo }).eq('id', prod.id)
    cargarDatos()
  }
  
  // ==================== PROCESOS DE PRODUCTO ====================
  
  async function abrirConfigProcesos(prod: Producto) {
    setProductoParaProcesos(prod)
    
    // Cargar procesos actuales del producto
    const { data: procProd } = await supabase
      .from('procesos_producto')
      .select('*, procesos_catalogo(nombre)')
      .eq('producto_id', prod.id)
      .order('orden')
    
    // Crear lista de procesos con estado activo/inactivo
    const lista: ProcesoProducto[] = procesosDisponibles.map(p => {
      const existente = procProd?.find(pp => pp.proceso_id === p.id)
      return {
        proceso_id: p.id,
        nombre: p.nombre,
        tiempo_estimado: existente?.tiempo_estimado || p.tiempo_estimado_default,
        orden: existente?.orden || p.orden,
        repeticiones: existente?.repeticiones || 1,
        activo: !!existente
      }
    })
    
    setProcesosProducto(lista)
    setDialogProcesos(true)
  }
  
  async function guardarProcesosProducto() {
    if (!productoParaProcesos) return
    
    try {
      // Eliminar procesos existentes
      await supabase
        .from('procesos_producto')
        .delete()
        .eq('producto_id', productoParaProcesos.id)
      
      // Insertar los activos
      const activos = procesosProducto.filter(p => p.activo)
      if (activos.length > 0) {
        const toInsert = activos.map((p, idx) => ({
          producto_id: productoParaProcesos.id,
          proceso_id: p.proceso_id,
          tiempo_estimado: p.tiempo_estimado,
          orden: idx + 1,
          repeticiones: p.repeticiones
        }))
        
        const { error: err } = await supabase.from('procesos_producto').insert(toInsert)
        if (err) throw err
      }
      
      setSuccess('Procesos guardados')
      setDialogProcesos(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }
  
  function toggleProceso(procesoId: string) {
    setProcesosProducto(prev => prev.map(p => 
      p.proceso_id === procesoId ? { ...p, activo: !p.activo } : p
    ))
  }
  
  function updateTiempoProceso(procesoId: string, tiempo: number) {
    setProcesosProducto(prev => prev.map(p => 
      p.proceso_id === procesoId ? { ...p, tiempo_estimado: tiempo } : p
    ))
  }
  
  function updateRepeticionesProceso(procesoId: string, rep: number) {
    setProcesosProducto(prev => prev.map(p => 
      p.proceso_id === procesoId ? { ...p, repeticiones: rep } : p
    ))
  }

  // ==================== COLORES ====================
  
  function abrirNuevoColor() {
    setEditandoColor(null)
    setFormColor({ codigo: '', nombre: '', tipo: 'RAL', hex_aproximado: '#ffffff', sobrecoste: 0 })
    setDialogColor(true)
  }
  
  function abrirEditarColor(col: Color) {
    setEditandoColor(col)
    setFormColor({
      codigo: col.codigo,
      nombre: col.nombre,
      tipo: col.tipo || 'RAL',
      hex_aproximado: col.hex_aproximado || '#ffffff',
      sobrecoste: col.sobrecoste || 0
    })
    setDialogColor(true)
  }
  
  async function guardarColor() {
    if (!formColor.codigo.trim() || !formColor.nombre.trim()) {
      setError('Codigo y nombre son obligatorios')
      return
    }
    
    try {
      if (editandoColor) {
        const { error: err } = await supabase
          .from('colores')
          .update(formColor)
          .eq('id', editandoColor.id)
        
        if (err) throw err
        setSuccess('Color actualizado')
      } else {
        const { error: err } = await supabase
          .from('colores')
          .insert({ ...formColor, activo: true })
        
        if (err) throw err
        setSuccess('Color creado')
      }
      
      setDialogColor(false)
      cargarDatos()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // ==================== TARIFAS ====================
  
  function abrirNuevaTarifa() {
    setEditandoTarifa(null)
    setFormTarifa({ nombre: '', modo_precio: 'm2', precio_m2: 0, precio_pieza: 0, precio_minimo: 0 })
    setDialogTarifa(true)
  }
  
  function abrirEditarTarifa(tar: Tarifa) {
    setEditandoTarifa(tar)
    setFormTarifa({
      nombre: tar.nombre,
      modo_precio: tar.modo_precio || 'm2',
      precio_m2: tar.precio_m2 || 0,
      precio_pieza: tar.precio_pieza || 0,
      precio_minimo: tar.precio_minimo || 0
    })
    setDialogTarifa(true)
  }
  
  async function guardarTarifa() {
    if (!formTarifa.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    
    try {
      if (editandoTarifa) {
        const { error: err } = await supabase
          .from('tarifas')
          .update(formTarifa)
          .eq('id', editandoTarifa.id)
        
        if (err) throw err
        setSuccess('Tarifa actualizada')
      } else {
        const { error: err } = await supabase
          .from('tarifas')
          .insert({ ...formTarifa, activo: true })
        
        if (err) throw err
        setSuccess('Tarifa creada')
      }
      
      setDialogTarifa(false)
      cargarDatos()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Productos</h1>
        <p className="text-slate-600 mt-1">Gestiona productos, colores, procesos y tarifas</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="productos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="productos">Productos ({productos.length})</TabsTrigger>
          <TabsTrigger value="colores">Colores ({colores.length})</TabsTrigger>
          <TabsTrigger value="tarifas">Tarifas ({tarifas.length})</TabsTrigger>
          <TabsTrigger value="procesos">Procesos ({procesosDisponibles.length})</TabsTrigger>
        </TabsList>

        {/* ==================== TAB PRODUCTOS ==================== */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Productos / Tipos de Pieza</h2>
              <p className="text-sm text-slate-600">Define productos con sus procesos de produccion</p>
            </div>
            <Button onClick={abrirNuevoProducto}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : productos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.map((prod) => (
                      <TableRow key={prod.id}>
                        <TableCell className="font-medium">{prod.nombre}</TableCell>
                        <TableCell>{prod.categoria || '-'}</TableCell>
                        <TableCell>{prod.unidad_tarificacion}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={prod.activo ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => toggleProductoActivo(prod)}
                          >
                            {prod.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => abrirEditarProducto(prod)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => abrirConfigProcesos(prod)}>
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 mb-4">No hay productos</p>
                  <Button onClick={abrirNuevoProducto}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primer producto
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB COLORES ==================== */}
        <TabsContent value="colores" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Colores RAL</h2>
              <p className="text-sm text-slate-600">Define colores disponibles para lacado</p>
            </div>
            <Button onClick={abrirNuevoColor}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Color
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              {colores.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sobrecoste</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colores.map((col) => (
                      <TableRow key={col.id}>
                        <TableCell className="font-mono font-bold">{col.codigo}</TableCell>
                        <TableCell>{col.nombre}</TableCell>
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded border shadow-sm"
                            style={{ backgroundColor: col.hex_aproximado || '#ccc' }}
                          />
                        </TableCell>
                        <TableCell>{col.tipo}</TableCell>
                        <TableCell>{col.sobrecoste > 0 ? `+${col.sobrecoste}€` : '-'}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => abrirEditarColor(col)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 mb-4">No hay colores</p>
                  <Button onClick={abrirNuevoColor}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primer color
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB TARIFAS ==================== */}
        <TabsContent value="tarifas" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Tarifas de Precio</h2>
              <p className="text-sm text-slate-600">Define precios por m2 o por pieza</p>
            </div>
            <Button onClick={abrirNuevaTarifa}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarifa
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              {tarifas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Precio m2</TableHead>
                      <TableHead>Precio Pieza</TableHead>
                      <TableHead>Minimo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tarifas.map((tar) => (
                      <TableRow key={tar.id}>
                        <TableCell className="font-medium">{tar.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tar.modo_precio}</Badge>
                        </TableCell>
                        <TableCell>{tar.precio_m2 ? `${tar.precio_m2}€` : '-'}</TableCell>
                        <TableCell>{tar.precio_pieza ? `${tar.precio_pieza}€` : '-'}</TableCell>
                        <TableCell>{tar.precio_minimo ? `${tar.precio_minimo}€` : '-'}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => abrirEditarTarifa(tar)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 mb-4">No hay tarifas</p>
                  <Button onClick={abrirNuevaTarifa}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primera tarifa
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB PROCESOS ==================== */}
        <TabsContent value="procesos" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Procesos de Produccion</h2>
              <p className="text-sm text-slate-600">Procesos disponibles para asignar a productos</p>
            </div>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              {procesosDisponibles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tiempo Default (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesosDisponibles.map((proc) => (
                      <TableRow key={proc.id}>
                        <TableCell>{proc.orden}</TableCell>
                        <TableCell className="font-medium">{proc.nombre}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            {proc.tiempo_estimado_default} min
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay procesos definidos</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOG PRODUCTO ==================== */}
      <Dialog open={dialogProducto} onOpenChange={setDialogProducto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoProducto ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription>
              Define un producto con su categoria y unidad de tarificacion
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formProducto.nombre}
                onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })}
                placeholder="Ej: Chapa metalica"
              />
            </div>
            
            <div>
              <Label>Categoria</Label>
              <Select
                value={formProducto.categoria}
                onValueChange={(v) => setFormProducto({ ...formProducto, categoria: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Perfileria">Perfileria</SelectItem>
                  <SelectItem value="Chapa">Chapa</SelectItem>
                  <SelectItem value="Estructural">Estructural</SelectItem>
                  <SelectItem value="Mobiliario">Mobiliario</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={formProducto.descripcion}
                onChange={(e) => setFormProducto({ ...formProducto, descripcion: e.target.value })}
                placeholder="Descripcion opcional del producto"
              />
            </div>
            
            <div>
              <Label>Unidad de Tarificacion</Label>
              <Select
                value={formProducto.unidad_tarificacion}
                onValueChange={(v) => setFormProducto({ ...formProducto, unidad_tarificacion: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">Metro cuadrado (m2)</SelectItem>
                  <SelectItem value="pieza">Por pieza</SelectItem>
                  <SelectItem value="ml">Metro lineal (ml)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogProducto(false)}>Cancelar</Button>
            <Button onClick={guardarProducto}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG PROCESOS PRODUCTO ==================== */}
      <Dialog open={dialogProcesos} onOpenChange={setDialogProcesos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Procesos: {productoParaProcesos?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona los procesos y define tiempos estimados para este producto
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {procesosProducto.map((proc) => (
              <div key={proc.proceso_id} className="flex items-center gap-4 p-4 rounded-lg border bg-slate-50">
                <Switch
                  checked={proc.activo}
                  onCheckedChange={() => toggleProceso(proc.proceso_id)}
                />
                
                <div className="flex-1">
                  <p className="font-medium">{proc.nombre}</p>
                </div>
                
                {proc.activo && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-slate-600">Tiempo:</Label>
                      <Input
                        type="number"
                        className="w-20"
                        value={proc.tiempo_estimado}
                        onChange={(e) => updateTiempoProceso(proc.proceso_id, parseInt(e.target.value) || 0)}
                      />
                      <span className="text-sm text-slate-500">min</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-slate-600">Repeticiones:</Label>
                      <Input
                        type="number"
                        className="w-16"
                        min={1}
                        max={5}
                        value={proc.repeticiones}
                        onChange={(e) => updateRepeticionesProceso(proc.proceso_id, parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogProcesos(false)}>Cancelar</Button>
            <Button onClick={guardarProcesosProducto}>
              <Save className="w-4 h-4 mr-2" />
              Guardar Procesos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG COLOR ==================== */}
      <Dialog open={dialogColor} onOpenChange={setDialogColor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoColor ? 'Editar Color' : 'Nuevo Color'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codigo RAL *</Label>
                <Input
                  value={formColor.codigo}
                  onChange={(e) => setFormColor({ ...formColor, codigo: e.target.value })}
                  placeholder="Ej: RAL 9010"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formColor.tipo}
                  onValueChange={(v) => setFormColor({ ...formColor, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAL">RAL</SelectItem>
                    <SelectItem value="NCS">NCS</SelectItem>
                    <SelectItem value="Pantone">Pantone</SelectItem>
                    <SelectItem value="Personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formColor.nombre}
                onChange={(e) => setFormColor({ ...formColor, nombre: e.target.value })}
                placeholder="Ej: Blanco puro"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color Aproximado</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-16 h-10 p-1"
                    value={formColor.hex_aproximado}
                    onChange={(e) => setFormColor({ ...formColor, hex_aproximado: e.target.value })}
                  />
                  <Input
                    value={formColor.hex_aproximado}
                    onChange={(e) => setFormColor({ ...formColor, hex_aproximado: e.target.value })}
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              <div>
                <Label>Sobrecoste (€)</Label>
                <Input
                  type="number"
                  value={formColor.sobrecoste}
                  onChange={(e) => setFormColor({ ...formColor, sobrecoste: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogColor(false)}>Cancelar</Button>
            <Button onClick={guardarColor}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG TARIFA ==================== */}
      <Dialog open={dialogTarifa} onOpenChange={setDialogTarifa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formTarifa.nombre}
                onChange={(e) => setFormTarifa({ ...formTarifa, nombre: e.target.value })}
                placeholder="Ej: Tarifa General"
              />
            </div>
            
            <div>
              <Label>Modo de Precio</Label>
              <Select
                value={formTarifa.modo_precio}
                onValueChange={(v) => setFormTarifa({ ...formTarifa, modo_precio: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">Por metro cuadrado</SelectItem>
                  <SelectItem value="pieza">Por pieza</SelectItem>
                  <SelectItem value="ml">Por metro lineal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio m2 (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formTarifa.precio_m2}
                  onChange={(e) => setFormTarifa({ ...formTarifa, precio_m2: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Precio Pieza (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formTarifa.precio_pieza}
                  onChange={(e) => setFormTarifa({ ...formTarifa, precio_pieza: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Minimo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formTarifa.precio_minimo}
                  onChange={(e) => setFormTarifa({ ...formTarifa, precio_minimo: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTarifa(false)}>Cancelar</Button>
            <Button onClick={guardarTarifa}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
