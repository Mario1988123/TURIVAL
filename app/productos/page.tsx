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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Save, Clock, Package, Palette, Euro } from 'lucide-react'
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

interface ProcesoConfig {
  proceso_id: string
  nombre: string
  tiempo_estimado: number
  orden: number
  activo: boolean
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  descripcion: string
  unidad_tarificacion: string
  color_id: string | null
  tarifa_id: string | null
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
  
  // Estados de formulario de producto
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null)
  const [formProducto, setFormProducto] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    unidad_tarificacion: 'm2',
    color_id: '',
    tarifa_id: ''
  })
  
  // Estados de procesos dentro del producto
  const [procesosConfig, setProcesosConfig] = useState<ProcesoConfig[]>([])
  
  // Estados de formulario de color
  const [editandoColor, setEditandoColor] = useState<Color | null>(null)
  const [formColor, setFormColor] = useState({
    codigo: '',
    nombre: '',
    tipo: 'RAL',
    hex_aproximado: '#000000',
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
  
  // Cargar datos
  useEffect(() => {
    loadData()
  }, [])
  
  async function loadData() {
    setLoading(true)
    try {
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
      setError('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }
  
  // Inicializar procesos config cuando se abra el dialog de producto
  function initProcesosConfig(productoProcesos?: ProcesoConfig[]) {
    const config = procesosDisponibles.map(p => {
      const existente = productoProcesos?.find(pp => pp.proceso_id === p.id)
      return {
        proceso_id: p.id,
        nombre: p.nombre,
        tiempo_estimado: existente?.tiempo_estimado || p.tiempo_estimado_default,
        orden: p.orden,
        activo: existente ? true : false
      }
    })
    setProcesosConfig(config)
  }
  
  // Abrir dialog nuevo producto
  function openNuevoProducto() {
    setEditandoProducto(null)
    setFormProducto({ nombre: '', categoria: '', descripcion: '', unidad_tarificacion: 'm2', color_id: '', tarifa_id: '' })
    initProcesosConfig()
    setDialogProducto(true)
  }
  
  // Abrir dialog editar producto
  async function openEditarProducto(producto: Producto) {
    setEditandoProducto(producto)
    setFormProducto({
      nombre: producto.nombre,
      categoria: producto.categoria || '',
      descripcion: producto.descripcion || '',
      unidad_tarificacion: producto.unidad_tarificacion || 'm2',
      color_id: producto.color_id || '',
      tarifa_id: producto.tarifa_id || ''
    })
    
    // Cargar procesos existentes del producto
    const { data: procesosExistentes } = await supabase
      .from('procesos_producto')
      .select('proceso_id, tiempo_estimado, orden')
      .eq('producto_id', producto.id)
    
    const config = procesosDisponibles.map(p => {
      const existente = procesosExistentes?.find(pe => pe.proceso_id === p.id)
      return {
        proceso_id: p.id,
        nombre: p.nombre,
        tiempo_estimado: existente?.tiempo_estimado || p.tiempo_estimado_default,
        orden: p.orden,
        activo: existente ? true : false
      }
    })
    setProcesosConfig(config)
    setDialogProducto(true)
  }
  
  // Guardar producto con procesos
  async function handleGuardarProducto() {
    if (!formProducto.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    
    try {
      let productoId: string
      
      if (editandoProducto) {
        // Actualizar producto existente
        const { error: updateErr } = await supabase
          .from('productos')
          .update({
            nombre: formProducto.nombre,
            categoria: formProducto.categoria,
            descripcion: formProducto.descripcion,
            unidad_tarificacion: formProducto.unidad_tarificacion,
            color_id: formProducto.color_id || null,
            tarifa_id: formProducto.tarifa_id || null
          })
          .eq('id', editandoProducto.id)
        
        if (updateErr) throw updateErr
        productoId = editandoProducto.id
        
        // Eliminar procesos anteriores
        await supabase.from('procesos_producto').delete().eq('producto_id', productoId)
      } else {
        // Crear nuevo producto
        const { data: newProd, error: insertErr } = await supabase
          .from('productos')
          .insert({
            nombre: formProducto.nombre,
            categoria: formProducto.categoria,
            descripcion: formProducto.descripcion,
            unidad_tarificacion: formProducto.unidad_tarificacion,
            color_id: formProducto.color_id || null,
            tarifa_id: formProducto.tarifa_id || null,
            activo: true
          })
          .select()
          .single()
        
        if (insertErr) throw insertErr
        productoId = newProd.id
      }
      
      // Insertar procesos activos
      const procesosActivos = procesosConfig.filter(p => p.activo)
      if (procesosActivos.length > 0) {
        const procesosInsert = procesosActivos.map(p => ({
          producto_id: productoId,
          proceso_id: p.proceso_id,
          tiempo_estimado: p.tiempo_estimado,
          orden: p.orden,
          repeticiones: 1
        }))
        
        const { error: procErr } = await supabase.from('procesos_producto').insert(procesosInsert)
        if (procErr) throw procErr
      }
      
      setSuccess(editandoProducto ? 'Producto actualizado' : 'Producto creado')
      setDialogProducto(false)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Error guardando producto')
    }
  }
  
  // Eliminar producto
  async function handleEliminarProducto(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    
    try {
      await supabase.from('procesos_producto').delete().eq('producto_id', id)
      await supabase.from('productos').delete().eq('id', id)
      setSuccess('Producto eliminado')
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Error eliminando producto')
    }
  }
  
  // Guardar color
  async function handleGuardarColor() {
    if (!formColor.codigo.trim() || !formColor.nombre.trim()) {
      setError('Codigo y nombre son obligatorios')
      return
    }
    
    try {
      if (editandoColor) {
        await supabase.from('colores').update(formColor).eq('id', editandoColor.id)
      } else {
        await supabase.from('colores').insert({ ...formColor, activo: true })
      }
      setSuccess(editandoColor ? 'Color actualizado' : 'Color creado')
      setDialogColor(false)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Error guardando color')
    }
  }
  
  // Guardar tarifa
  async function handleGuardarTarifa() {
    if (!formTarifa.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    
    try {
      if (editandoTarifa) {
        await supabase.from('tarifas').update(formTarifa).eq('id', editandoTarifa.id)
      } else {
        await supabase.from('tarifas').insert({ ...formTarifa, activo: true })
      }
      setSuccess(editandoTarifa ? 'Tarifa actualizada' : 'Tarifa creada')
      setDialogTarifa(false)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Error guardando tarifa')
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-muted-foreground">Gestiona productos, colores y tarifas</p>
        </div>
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
      
      <Tabs defaultValue="productos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="productos" className="gap-2">
            <Package className="w-4 h-4" />
            Productos ({productos.length})
          </TabsTrigger>
          <TabsTrigger value="colores" className="gap-2">
            <Palette className="w-4 h-4" />
            Colores ({colores.length})
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="gap-2">
            <Euro className="w-4 h-4" />
            Tarifas ({tarifas.length})
          </TabsTrigger>
        </TabsList>
        
        {/* TAB PRODUCTOS */}
        <TabsContent value="productos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lista de Productos</CardTitle>
                <CardDescription>Productos con sus procesos de produccion configurados</CardDescription>
              </div>
              <Button onClick={openNuevoProducto}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tarifa</TableHead>
                    <TableHead>Procesos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay productos. Crea el primero.
                      </TableCell>
                    </TableRow>
                  ) : (
                    productos.map(prod => {
                      const colorProd = colores.find(c => c.id === prod.color_id)
                      const tarifaProd = tarifas.find(t => t.id === prod.tarifa_id)
                      return (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">{prod.nombre}</TableCell>
                          <TableCell>{prod.categoria || '-'}</TableCell>
                          <TableCell>
                            {colorProd ? (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded border" 
                                  style={{ backgroundColor: colorProd.hex_aproximado }}
                                />
                                <span className="text-sm">{colorProd.codigo}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {tarifaProd ? (
                              <span className="text-sm">
                                {tarifaProd.modo_precio === 'm2' ? `${tarifaProd.precio_m2}€/m2` : `${tarifaProd.precio_pieza}€/ud`}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <ProductoProcesosCount productoId={prod.id} supabase={supabase} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={prod.activo ? "default" : "secondary"}>
                              {prod.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => openEditarProducto(prod)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEliminarProducto(prod.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB COLORES */}
        <TabsContent value="colores">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Colores RAL</CardTitle>
                <CardDescription>Catalogo de colores disponibles</CardDescription>
              </div>
              <Button onClick={() => {
                setEditandoColor(null)
                setFormColor({ codigo: '', nombre: '', tipo: 'RAL', hex_aproximado: '#000000', sobrecoste: 0 })
                setDialogColor(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Color
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sobrecoste</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay colores. Crea el primero.
                      </TableCell>
                    </TableRow>
                  ) : (
                    colores.map(color => (
                      <TableRow key={color.id}>
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded border" 
                            style={{ backgroundColor: color.hex_aproximado }}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{color.codigo}</TableCell>
                        <TableCell>{color.nombre}</TableCell>
                        <TableCell><Badge variant="outline">{color.tipo}</Badge></TableCell>
                        <TableCell>{color.sobrecoste > 0 ? `+${color.sobrecoste}%` : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditandoColor(color)
                              setFormColor({
                                codigo: color.codigo,
                                nombre: color.nombre,
                                tipo: color.tipo,
                                hex_aproximado: color.hex_aproximado,
                                sobrecoste: color.sobrecoste
                              })
                              setDialogColor(true)
                            }}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={async () => {
                              if (confirm('¿Eliminar este color?')) {
                                await supabase.from('colores').delete().eq('id', color.id)
                                loadData()
                              }
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB TARIFAS */}
        <TabsContent value="tarifas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tarifas</CardTitle>
                <CardDescription>Precios por m2 o por pieza</CardDescription>
              </div>
              <Button onClick={() => {
                setEditandoTarifa(null)
                setFormTarifa({ nombre: '', modo_precio: 'm2', precio_m2: 0, precio_pieza: 0, precio_minimo: 0 })
                setDialogTarifa(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Tarifa
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Precio m2</TableHead>
                    <TableHead>Precio pieza</TableHead>
                    <TableHead>Minimo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarifas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay tarifas. Crea la primera.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tarifas.map(tarifa => (
                      <TableRow key={tarifa.id}>
                        <TableCell className="font-medium">{tarifa.nombre}</TableCell>
                        <TableCell><Badge variant="outline">{tarifa.modo_precio}</Badge></TableCell>
                        <TableCell>{tarifa.precio_m2?.toFixed(2)}€</TableCell>
                        <TableCell>{tarifa.precio_pieza?.toFixed(2)}€</TableCell>
                        <TableCell>{tarifa.precio_minimo?.toFixed(2)}€</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditandoTarifa(tarifa)
                              setFormTarifa({
                                nombre: tarifa.nombre,
                                modo_precio: tarifa.modo_precio,
                                precio_m2: tarifa.precio_m2,
                                precio_pieza: tarifa.precio_pieza,
                                precio_minimo: tarifa.precio_minimo
                              })
                              setDialogTarifa(true)
                            }}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={async () => {
                              if (confirm('¿Eliminar esta tarifa?')) {
                                await supabase.from('tarifas').delete().eq('id', tarifa.id)
                                loadData()
                              }
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* DIALOG PRODUCTO CON PROCESOS INTEGRADOS */}
      <Dialog open={dialogProducto} onOpenChange={setDialogProducto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoProducto ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription>
              Configura los datos del producto y sus procesos de produccion
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Datos basicos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre del producto *</Label>
                <Input 
                  value={formProducto.nombre}
                  onChange={e => setFormProducto({ ...formProducto, nombre: e.target.value })}
                  placeholder="Ej: Puerta lacada"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select 
                  value={formProducto.categoria} 
                  onValueChange={v => setFormProducto({ ...formProducto, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Puertas">Puertas</SelectItem>
                    <SelectItem value="Ventanas">Ventanas</SelectItem>
                    <SelectItem value="Muebles">Muebles</SelectItem>
                    <SelectItem value="Perfileria">Perfileria</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad de tarificacion</Label>
                <Select 
                  value={formProducto.unidad_tarificacion} 
                  onValueChange={v => setFormProducto({ ...formProducto, unidad_tarificacion: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">Por m2</SelectItem>
                    <SelectItem value="pieza">Por pieza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color (RAL)</Label>
                <Select 
                  value={formProducto.color_id} 
                  onValueChange={v => setFormProducto({ ...formProducto, color_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar color..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colores.filter(c => c.activo).map(color => (
                      <SelectItem key={color.id} value={color.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded border" 
                            style={{ backgroundColor: color.hex_aproximado }}
                          />
                          {color.codigo} - {color.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tarifa</Label>
                <Select 
                  value={formProducto.tarifa_id} 
                  onValueChange={v => setFormProducto({ ...formProducto, tarifa_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tarifa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tarifas.filter(t => t.activo).map(tarifa => (
                      <SelectItem key={tarifa.id} value={tarifa.id}>
                        {tarifa.nombre} - {tarifa.modo_precio === 'm2' ? `${tarifa.precio_m2}€/m2` : `${tarifa.precio_pieza}€/pieza`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descripcion</Label>
                <Textarea 
                  value={formProducto.descripcion}
                  onChange={e => setFormProducto({ ...formProducto, descripcion: e.target.value })}
                  placeholder="Descripcion opcional..."
                  rows={2}
                />
              </div>
            </div>
            
            {/* Procesos de produccion */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Procesos de Produccion
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Activa los procesos que aplican a este producto y define el tiempo estimado en minutos
              </p>
              
              <div className="space-y-3">
                {procesosConfig.map((proc, idx) => (
                  <div 
                    key={proc.proceso_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${proc.activo ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <Switch 
                        checked={proc.activo}
                        onCheckedChange={(checked) => {
                          const updated = [...procesosConfig]
                          updated[idx].activo = checked
                          setProcesosConfig(updated)
                        }}
                      />
                      <div>
                        <p className="font-medium">{proc.nombre}</p>
                        <p className="text-xs text-muted-foreground">Orden: {proc.orden}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Tiempo (min):</Label>
                      <Input 
                        type="number"
                        className="w-20"
                        value={proc.tiempo_estimado}
                        onChange={e => {
                          const updated = [...procesosConfig]
                          updated[idx].tiempo_estimado = parseInt(e.target.value) || 0
                          setProcesosConfig(updated)
                        }}
                        disabled={!proc.activo}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                <p className="text-sm">
                  <strong>Tiempo total estimado:</strong>{' '}
                  {procesosConfig.filter(p => p.activo).reduce((acc, p) => acc + p.tiempo_estimado, 0)} minutos
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogProducto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarProducto}>
              <Save className="w-4 h-4 mr-2" />
              {editandoProducto ? 'Actualizar' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* DIALOG COLOR */}
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
                  onChange={e => setFormColor({ ...formColor, codigo: e.target.value })}
                  placeholder="RAL 9010"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={formColor.tipo} onValueChange={v => setFormColor({ ...formColor, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAL">RAL</SelectItem>
                    <SelectItem value="NCS">NCS</SelectItem>
                    <SelectItem value="Pantone">Pantone</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input 
                value={formColor.nombre}
                onChange={e => setFormColor({ ...formColor, nombre: e.target.value })}
                placeholder="Blanco puro"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color aproximado</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color"
                    className="w-12 h-10 p-1"
                    value={formColor.hex_aproximado}
                    onChange={e => setFormColor({ ...formColor, hex_aproximado: e.target.value })}
                  />
                  <Input 
                    value={formColor.hex_aproximado}
                    onChange={e => setFormColor({ ...formColor, hex_aproximado: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              <div>
                <Label>Sobrecoste (%)</Label>
                <Input 
                  type="number"
                  value={formColor.sobrecoste}
                  onChange={e => setFormColor({ ...formColor, sobrecoste: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogColor(false)}>Cancelar</Button>
            <Button onClick={handleGuardarColor}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* DIALOG TARIFA */}
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
                onChange={e => setFormTarifa({ ...formTarifa, nombre: e.target.value })}
                placeholder="Tarifa estandar"
              />
            </div>
            <div>
              <Label>Modo de precio</Label>
              <Select value={formTarifa.modo_precio} onValueChange={v => setFormTarifa({ ...formTarifa, modo_precio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">Por m2</SelectItem>
                  <SelectItem value="pieza">Por pieza</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
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
                  onChange={e => setFormTarifa({ ...formTarifa, precio_m2: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Precio pieza (€)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formTarifa.precio_pieza}
                  onChange={e => setFormTarifa({ ...formTarifa, precio_pieza: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Minimo (€)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formTarifa.precio_minimo}
                  onChange={e => setFormTarifa({ ...formTarifa, precio_minimo: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTarifa(false)}>Cancelar</Button>
            <Button onClick={handleGuardarTarifa}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente auxiliar para mostrar el conteo de procesos
function ProductoProcesosCount({ productoId, supabase }: { productoId: string, supabase: any }) {
  const [count, setCount] = useState<number | null>(null)
  
  useEffect(() => {
    async function load() {
      const { count: c } = await supabase
        .from('procesos_producto')
        .select('*', { count: 'exact', head: true })
        .eq('producto_id', productoId)
      setCount(c || 0)
    }
    load()
  }, [productoId])
  
  if (count === null) return <span className="text-muted-foreground">...</span>
  
  return <Badge variant="secondary">{count} procesos</Badge>
}
