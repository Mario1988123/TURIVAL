'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { obtenerCliente, obtenerEstadisticasCliente } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, Producto, Color, Tratamiento, Tarifa, NivelComplejidad } from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft, Edit, Mail, Phone, MapPin, Building, FileText,
  Plus, Save, Pencil, Trash2, Package,
} from 'lucide-react'

// Tipo para la pieza guardada (referencias_cliente ampliada)
interface PiezaGuardada {
  id: string
  cliente_id: string
  referencia_cliente: string
  referencia_interna: string | null
  nombre_pieza: string | null
  descripcion: string | null
  producto_id: string | null
  dimensiones_habituales: { ancho?: number; alto?: number; grosor?: number } | null
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  acabado_texto: string | null
  nivel_complejidad: number | null
  precio_pactado: number | null
  superficie_m2_habitual: number | null
  notas_ia: string | null
  activo: boolean
  observaciones: string | null
  created_at: string
  // Joins
  producto_nombre?: string
  color_codigo?: string
  tratamiento_nombre?: string
}

export default function ClienteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCliente() {
      try {
        const [clienteData, statsData] = await Promise.all([
          obtenerCliente(clienteId),
          obtenerEstadisticasCliente(clienteId),
        ])
        setCliente(clienteData)
        setStats(statsData)
      } catch (error) {
        console.error('Error loading cliente:', error)
      } finally {
        setLoading(false)
      }
    }
    loadCliente()
  }, [clienteId])

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      precliente: 'Pre-cliente',
      cliente_activo: 'Cliente Activo',
      cliente_recurrente: 'Cliente Recurrente',
    }
    return labels[tipo] || tipo
  }

  const getTipoBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      precliente: 'secondary',
      cliente_activo: 'default',
      cliente_recurrente: 'default',
    }
    return variants[tipo] || 'secondary'
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="link" onClick={() => router.push('/dashboard/clientes')}>
          Volver a clientes
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{cliente.nombre_comercial}</h1>
              <Badge variant={getTipoBadge(cliente.tipo)}>{getTipoLabel(cliente.tipo)}</Badge>
            </div>
            {cliente.razon_social && (
              <p className="text-muted-foreground">{cliente.razon_social}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/presupuestos/nuevo?cliente=${clienteId}`)}>
            <FileText className="h-4 w-4 mr-2" /> Nuevo Presupuesto
          </Button>
          <Button onClick={() => router.push(`/dashboard/clientes/${clienteId}/editar`)}>
            <Edit className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_presupuestos || 0}</div>
            <p className="text-sm text-muted-foreground">Presupuestos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total_pedidos || 0}</div>
            <p className="text-sm text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{(stats?.facturacion_total || 0).toFixed(2)} €</div>
            <p className="text-sm text-muted-foreground">Facturación Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.pedidos_pendientes || 0}</div>
            <p className="text-sm text-muted-foreground">Pedidos Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="piezas">Piezas Guardadas</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Datos de Contacto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cliente.persona_contacto && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.persona_contacto}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.email}</span>
                  </div>
                )}
                {cliente.telefono && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.telefono}</span>
                  </div>
                )}
                {(cliente.direccion || cliente.ciudad) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[cliente.direccion, cliente.codigo_postal, cliente.ciudad, cliente.provincia].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {cliente.cif_nif && (
                  <div>
                    <p className="text-sm text-muted-foreground">CIF/NIF</p>
                    <p className="font-medium">{cliente.cif_nif}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Condiciones Comerciales</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Condiciones de Pago</p>
                  <p className="font-medium">{cliente.condiciones_pago}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Descuento General</p>
                  <p className="font-medium">{cliente.descuento_general || 0}%</p>
                </div>
                {cliente.notas && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{cliente.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="piezas">
          <PestañaPiezasGuardadas clienteId={clienteId} />
        </TabsContent>

        <TabsContent value="presupuestos">
          <Card>
            <CardHeader>
              <CardTitle>Presupuestos del Cliente</CardTitle>
              <CardDescription>Historial de presupuestos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Se completará en la iteración 3.3
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos del Cliente</CardTitle>
              <CardDescription>Historial de pedidos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Se completará en la Capa 4
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


// ============================================================
// PESTAÑA PIEZAS GUARDADAS
// ============================================================
function PestañaPiezasGuardadas({ clienteId }: { clienteId: string }) {
  const supabase = createClient()

  const [piezas, setPiezas] = useState<PiezaGuardada[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<Color[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [niveles, setNiveles] = useState<NivelComplejidad[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<PiezaGuardada | null>(null)
  const [form, setForm] = useState({
    referencia_cliente: '',
    nombre_pieza: '',
    descripcion: '',
    producto_id: '',
    ancho: '',
    alto: '',
    grosor: '',
    color_id: '',
    tratamiento_id: '',
    tarifa_id: '',
    acabado_texto: '',
    nivel_complejidad: 1,
    precio_pactado: '',
    observaciones: '',
    notas_ia: '',
  })

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    const [piezasRes, prodRes, colRes, tratRes, tarRes, nivRes] = await Promise.all([
      supabase
        .from('referencias_cliente')
        .select(`
          *,
          productos:producto_id(nombre),
          colores:color_id(codigo),
          tratamientos:tratamiento_id(nombre)
        `)
        .eq('cliente_id', clienteId)
        .order('referencia_cliente')
        .range(0, 499),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('colores').select('id, codigo, nombre, tipo').eq('activo', true).order('codigo').range(0, 4999),
      supabase.from('tratamientos').select('*').eq('activo', true).order('nombre'),
      supabase.from('tarifas').select('*').eq('activo', true).order('nombre'),
      supabase.from('niveles_complejidad').select('*').eq('activo', true).order('orden'),
    ])

    if (!piezasRes.error) {
      const datos = (piezasRes.data || []).map((p: any) => ({
        ...p,
        producto_nombre: p.productos?.nombre || null,
        color_codigo: p.colores?.codigo || null,
        tratamiento_nombre: p.tratamientos?.nombre || null,
      }))
      setPiezas(datos)
    }
    if (!prodRes.error) setProductos(prodRes.data as Producto[])
    if (!colRes.error) setColores(colRes.data as Color[])
    if (!tratRes.error) setTratamientos(tratRes.data as Tratamiento[])
    if (!tarRes.error) setTarifas(tarRes.data as Tarifa[])
    if (!nivRes.error) setNiveles(nivRes.data as NivelComplejidad[])

    setLoading(false)
  }

  useEffect(() => { cargar() }, [clienteId])

  function abrirNuevo() {
    setEditando(null)
    setForm({
      referencia_cliente: '', nombre_pieza: '', descripcion: '',
      producto_id: '', ancho: '', alto: '', grosor: '',
      color_id: '', tratamiento_id: '', tarifa_id: '',
      acabado_texto: '', nivel_complejidad: 1, precio_pactado: '',
      observaciones: '', notas_ia: '',
    })
    setDialogoAbierto(true)
  }

  function abrirEditar(p: PiezaGuardada) {
    setEditando(p)
    const dims = p.dimensiones_habituales || {}
    setForm({
      referencia_cliente: p.referencia_cliente,
      nombre_pieza: p.nombre_pieza || '',
      descripcion: p.descripcion || '',
      producto_id: p.producto_id || '',
      ancho: dims.ancho ? String(dims.ancho) : '',
      alto: dims.alto ? String(dims.alto) : '',
      grosor: dims.grosor ? String(dims.grosor) : '',
      color_id: p.color_id || '',
      tratamiento_id: p.tratamiento_id || '',
      tarifa_id: p.tarifa_id || '',
      acabado_texto: p.acabado_texto || '',
      nivel_complejidad: p.nivel_complejidad || 1,
      precio_pactado: p.precio_pactado != null ? String(p.precio_pactado) : '',
      observaciones: p.observaciones || '',
      notas_ia: p.notas_ia || '',
    })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.referencia_cliente.trim()) {
      setMensaje({ tipo: 'error', texto: 'La referencia es obligatoria.' })
      return
    }

    const dimensiones = (form.ancho || form.alto || form.grosor)
      ? {
          ancho: form.ancho ? parseFloat(form.ancho) : undefined,
          alto: form.alto ? parseFloat(form.alto) : undefined,
          grosor: form.grosor ? parseFloat(form.grosor) : undefined,
        }
      : null

    // Calcular superficie si hay dimensiones
    let superficie: number | null = null
    if (form.ancho && form.alto) {
      superficie = (parseFloat(form.ancho) / 1000) * (parseFloat(form.alto) / 1000)
    }

    const datos: any = {
      cliente_id: clienteId,
      referencia_cliente: form.referencia_cliente.trim(),
      nombre_pieza: form.nombre_pieza.trim() || null,
      descripcion: form.descripcion.trim() || null,
      producto_id: form.producto_id || null,
      dimensiones_habituales: dimensiones,
      color_id: form.color_id || null,
      tratamiento_id: form.tratamiento_id || null,
      tarifa_id: form.tarifa_id || null,
      acabado_texto: form.acabado_texto.trim() || null,
      nivel_complejidad: form.nivel_complejidad,
      precio_pactado: form.precio_pactado ? parseFloat(form.precio_pactado) : null,
      superficie_m2_habitual: superficie,
      observaciones: form.observaciones.trim() || null,
      notas_ia: form.notas_ia.trim() || null,
      activo: true,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('referencias_cliente')
          .update(datos)
          .eq('id', editando.id)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Pieza guardada actualizada.' })
      } else {
        const { error } = await supabase
          .from('referencias_cliente')
          .insert(datos)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Pieza guardada creada.' })
      }
      setDialogoAbierto(false)
      await cargar()
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setMensaje({ tipo: 'error', texto: `Ya existe una pieza con referencia "${form.referencia_cliente}" para este cliente.` })
      } else {
        setMensaje({ tipo: 'error', texto: `Error: ${msg}` })
      }
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta pieza guardada?')) return
    try {
      const { error } = await supabase.from('referencias_cliente').delete().eq('id', id)
      if (error) throw error
      setMensaje({ tipo: 'ok', texto: 'Pieza eliminada.' })
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${err.message || err}` })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Piezas Guardadas
            </CardTitle>
            <CardDescription>
              Piezas habituales de este cliente. Al crear un presupuesto, podrás
              seleccionar una pieza guardada y se auto-rellenará toda la línea.
            </CardDescription>
          </div>
          <Button onClick={abrirNuevo}>
            <Plus className="w-4 h-4 mr-2" /> Nueva pieza
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {mensaje && (
          <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'} className="mb-4">
            <AlertDescription>{mensaje.texto}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : piezas.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Este cliente no tiene piezas guardadas. Crea la primera para agilizar
            los presupuestos futuros.
          </p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Dimensiones</TableHead>
                  <TableHead className="text-right">Precio pactado</TableHead>
                  <TableHead className="text-right w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {piezas.map((p) => {
                  const dims = p.dimensiones_habituales
                  const dimStr = dims
                    ? [dims.ancho && `${dims.ancho}mm`, dims.alto && `${dims.alto}mm`, dims.grosor && `${dims.grosor}mm`]
                        .filter(Boolean).join(' × ')
                    : '—'

                  return (
                    <TableRow key={p.id} className={!p.activo ? 'opacity-50' : ''}>
                      <TableCell className="font-mono font-medium">{p.referencia_cliente}</TableCell>
                      <TableCell>{p.nombre_pieza || '—'}</TableCell>
                      <TableCell className="text-sm">{p.producto_nombre || '—'}</TableCell>
                      <TableCell className="text-sm">{p.color_codigo || '—'}</TableCell>
                      <TableCell className="text-sm font-mono">{dimStr}</TableCell>
                      <TableCell className="text-right font-mono">
                        {p.precio_pactado != null ? `${Number(p.precio_pactado).toFixed(2)} €` : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => abrirEditar(p)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => eliminar(p.id)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo crear/editar pieza guardada */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar pieza guardada' : 'Nueva pieza guardada'}</DialogTitle>
            <DialogDescription>
              Guarda una pieza habitual para reutilizarla en presupuestos futuros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Referencia del cliente *</Label>
                <Input
                  value={form.referencia_cliente}
                  onChange={(e) => setForm({ ...form, referencia_cliente: e.target.value })}
                  placeholder="Ej: LAT-AVE-A"
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre descriptivo</Label>
                <Input
                  value={form.nombre_pieza}
                  onChange={(e) => setForm({ ...form, nombre_pieza: e.target.value })}
                  placeholder="Ej: Lateral AVE tipo A"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Breve descripción de la pieza..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Producto</Label>
                <Select value={form.producto_id || 'ninguno'} onValueChange={(v) => setForm({ ...form, producto_id: v === 'ninguno' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin producto</SelectItem>
                    {productos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tratamiento</Label>
                <Select value={form.tratamiento_id || 'ninguno'} onValueChange={(v) => setForm({ ...form, tratamiento_id: v === 'ninguno' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin tratamiento</SelectItem>
                    {tratamientos.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Ancho (mm)</Label>
                <Input type="number" min="0" value={form.ancho} onChange={(e) => setForm({ ...form, ancho: e.target.value })} placeholder="mm" />
              </div>
              <div className="space-y-1">
                <Label>Alto (mm)</Label>
                <Input type="number" min="0" value={form.alto} onChange={(e) => setForm({ ...form, alto: e.target.value })} placeholder="mm" />
              </div>
              <div className="space-y-1">
                <Label>Grosor (mm)</Label>
                <Input type="number" min="0" value={form.grosor} onChange={(e) => setForm({ ...form, grosor: e.target.value })} placeholder="mm" />
              </div>
              <div className="space-y-1">
                <Label>Complejidad</Label>
                <Select value={String(form.nivel_complejidad)} onValueChange={(v) => setForm({ ...form, nivel_complejidad: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {niveles.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nombre} (×{n.multiplicador})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Color</Label>
                <Select value={form.color_id || 'ninguno'} onValueChange={(v) => setForm({ ...form, color_id: v === 'ninguno' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin color</SelectItem>
                    {colores.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Precio pactado (€)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.precio_pactado}
                  onChange={(e) => setForm({ ...form, precio_pactado: e.target.value })}
                  placeholder="Vacío = se calcula con tarifa"
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para usar tarifa automática.</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Acabado (texto libre)</Label>
              <Input
                value={form.acabado_texto}
                onChange={(e) => setForm({ ...form, acabado_texto: e.target.value })}
                placeholder="Ej: Mate, Brillo, Satinado..."
              />
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                rows={2}
                placeholder="Notas internas sobre esta pieza..."
              />
            </div>

            <div className="space-y-1">
              <Label>Notas para la IA (módulo futuro)</Label>
              <Textarea
                value={form.notas_ia}
                onChange={(e) => setForm({ ...form, notas_ia: e.target.value })}
                rows={2}
                placeholder="Ej: Esta pieza siempre va con doble fondo. El cliente la pide como 'lateral grande'."
              />
              <p className="text-xs text-muted-foreground">
                Estas notas las usará el agente de voz para entender mejor las piezas de este cliente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar}>
              <Save className="w-4 h-4 mr-2" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
