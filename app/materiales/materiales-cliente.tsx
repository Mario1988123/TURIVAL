'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listarMateriales,
  crearMaterial,
  actualizarMaterial,
  cambiarActivoMaterial,
  resolverPrecioKg,
} from '@/lib/services/materiales'
import { listarProveedores } from '@/lib/services/proveedores'
import {
  entradaManualStock,
  ajusteManualStock,
  registrarMerma,
  obtenerStockActual,
  listarMovimientos,
  type MovimientoStockEnriquecido,
} from '@/lib/services/stock'
import type {
  MaterialConProveedor, Proveedor, TipoMaterial,
} from '@/lib/types/erp'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package, Plus, Pencil, Save, Loader2, Search,
  TrendingUp, TrendingDown, AlertTriangle, History,
} from 'lucide-react'

const TIPO_LABEL: Record<TipoMaterial, string> = {
  lacado: 'Lacado', fondo: 'Fondo', catalizador: 'Catalizador', disolvente: 'Disolvente',
}

interface FormMaterial {
  tipo: TipoMaterial
  codigo: string
  nombre: string
  familia: string
  hex_aproximado: string
  proveedor_id: string | null
  precio_kg_sobrescrito: number | null
  formato_compra_kg: number | null
  rendimiento_kg_m2_sobrescrito: number | null
  stock_minimo_kg: number
  observaciones: string
  activo: boolean
}

const FORM_VACIO: FormMaterial = {
  tipo: 'lacado',
  codigo: '',
  nombre: '',
  familia: 'referencia_interna',
  hex_aproximado: '#FFFFFF',
  proveedor_id: null,
  precio_kg_sobrescrito: null,
  formato_compra_kg: null,
  rendimiento_kg_m2_sobrescrito: null,
  stock_minimo_kg: 0,
  observaciones: '',
  activo: true,
}

export default function MaterialesCliente() {
  const [tipo, setTipo] = useState<TipoMaterial>('lacado')
  const [materiales, setMateriales] = useState<MaterialConProveedor[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const [dialogo, setDialogo] = useState(false)
  const [editando, setEditando] = useState<MaterialConProveedor | null>(null)
  const [form, setForm] = useState<FormMaterial>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  // Stock: diálogos
  const [stockDialog, setStockDialog] = useState<
    | null
    | {
        material: MaterialConProveedor
        modo: 'entrada' | 'ajuste' | 'merma' | 'historico'
      }
  >(null)
  const [stockCantidad, setStockCantidad] = useState<number>(0)
  const [stockMotivo, setStockMotivo] = useState<string>('')
  const [stockProcesando, setStockProcesando] = useState(false)
  const [movimientos, setMovimientos] = useState<MovimientoStockEnriquecido[]>([])

  async function cargar() {
    setLoading(true)
    try {
      const [mats, provs] = await Promise.all([
        listarMateriales({ tipo, activos_solo: !mostrarInactivos, busqueda }),
        listarProveedores({ tipo, activos_solo: true }),
      ])
      setMateriales(mats)
      setProveedores(provs)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [tipo, mostrarInactivos])
  useEffect(() => {
    const t = setTimeout(() => cargar(), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...FORM_VACIO, tipo })
    setDialogo(true)
  }

  function abrirEditar(m: MaterialConProveedor) {
    setEditando(m)
    setForm({
      tipo: m.tipo,
      codigo: m.codigo ?? '',
      nombre: m.nombre,
      familia: m.familia ?? 'referencia_interna',
      hex_aproximado: m.hex_aproximado ?? '#FFFFFF',
      proveedor_id: m.proveedor_id,
      precio_kg_sobrescrito: m.precio_kg_sobrescrito,
      formato_compra_kg: m.formato_compra_kg,
      rendimiento_kg_m2_sobrescrito: m.rendimiento_kg_m2_sobrescrito,
      stock_minimo_kg: Number(m.stock_minimo_kg) || 0,
      observaciones: m.observaciones ?? '',
      activo: m.activo,
    })
    setDialogo(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }
    setGuardando(true)
    try {
      const payload = {
        tipo: form.tipo,
        codigo: form.codigo.trim() || null,
        nombre: form.nombre.trim(),
        familia: form.familia || null,
        hex_aproximado: form.hex_aproximado || null,
        proveedor_id: form.proveedor_id,
        precio_kg_sobrescrito: form.precio_kg_sobrescrito,
        formato_compra_kg: form.formato_compra_kg,
        rendimiento_kg_m2_sobrescrito: form.rendimiento_kg_m2_sobrescrito,
        stock_minimo_kg: form.stock_minimo_kg,
        observaciones: form.observaciones.trim() || null,
        activo: form.activo,
      }
      if (editando) {
        await actualizarMaterial(editando.id, payload)
        setMensaje({ tipo: 'ok', texto: 'Material actualizado.' })
      } else {
        await crearMaterial(payload as any)
        setMensaje({ tipo: 'ok', texto: 'Material creado.' })
      }
      setDialogo(false)
      await cargar()
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setMensaje({ tipo: 'error', texto: `Código duplicado: "${form.codigo}"` })
      } else {
        setMensaje({ tipo: 'error', texto: `Error: ${msg}` })
      }
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(m: MaterialConProveedor) {
    try {
      await cambiarActivoMaterial(m.id, !m.activo)
      setMensaje({ tipo: 'ok', texto: `Material ${m.activo ? 'desactivado' : 'activado'}.` })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    }
  }

  function abrirStock(
    material: MaterialConProveedor,
    modo: 'entrada' | 'ajuste' | 'merma' | 'historico'
  ) {
    setStockDialog({ material, modo })
    setStockCantidad(0)
    setStockMotivo('')
    if (modo === 'historico') {
      listarMovimientos({ material_id: material.id, limite: 50 })
        .then(setMovimientos)
        .catch((e) => setMensaje({ tipo: 'error', texto: e.message }))
    }
  }

  async function aplicarStock() {
    if (!stockDialog) return
    const { material, modo } = stockDialog
    setStockProcesando(true)
    try {
      if (modo === 'entrada') {
        if (stockCantidad <= 0) throw new Error('Cantidad debe ser > 0')
        await entradaManualStock({
          material_id: material.id,
          cantidad_kg: stockCantidad,
          motivo: stockMotivo.trim() || 'Entrada manual',
        })
      } else if (modo === 'ajuste') {
        if (!stockMotivo.trim()) throw new Error('El motivo es obligatorio')
        await ajusteManualStock({
          material_id: material.id,
          delta_kg: stockCantidad,
          motivo: stockMotivo.trim(),
        })
      } else if (modo === 'merma') {
        if (stockCantidad <= 0) throw new Error('Cantidad de merma debe ser > 0')
        if (!stockMotivo.trim()) throw new Error('El motivo es obligatorio')
        await registrarMerma({
          material_id: material.id,
          cantidad_kg: stockCantidad,
          motivo: stockMotivo.trim(),
        })
      }
      setMensaje({ tipo: 'ok', texto: 'Movimiento registrado.' })
      setStockDialog(null)
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error' })
    } finally {
      setStockProcesando(false)
    }
  }

  const materialesBajoMinimo = useMemo(() =>
    materiales.filter((m) =>
      Number(m.stock_minimo_kg) > 0 &&
      Number(m.stock_fisico_kg) < Number(m.stock_minimo_kg)
    ), [materiales])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-8 h-8" />
          Materiales
        </h1>
        <p className="text-muted-foreground">
          Lacados, fondos, catalizadores y disolventes.
          Cada material con su proveedor, precio, rendimiento y stock.
        </p>
      </div>

      {materialesBajoMinimo.length > 0 && (
        <Alert className="bg-orange-50 border-orange-300 text-orange-900">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="font-medium">
            {materialesBajoMinimo.length} material
            {materialesBajoMinimo.length === 1 ? '' : 'es'} bajo stock mínimo en "{TIPO_LABEL[tipo]}":
            {' '}{materialesBajoMinimo.slice(0, 5).map(m => m.nombre).join(', ')}
            {materialesBajoMinimo.length > 5 ? '…' : ''}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tipo} onValueChange={(v: any) => setTipo(v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="lacado">Lacados</TabsTrigger>
          <TabsTrigger value="fondo">Fondos</TabsTrigger>
          <TabsTrigger value="catalizador">Catalizadores</TabsTrigger>
          <TabsTrigger value="disolvente">Disolventes</TabsTrigger>
        </TabsList>

        {/* Misma UI para los 4 tipos, cambia solo el filtro */}
        {(['lacado','fondo','catalizador','disolvente'] as TipoMaterial[]).map(t => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3 items-end mb-4">
                  <div className="flex-1 min-w-60 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar código, nombre o familia…"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant={mostrarInactivos ? 'default' : 'outline'}
                    onClick={() => setMostrarInactivos(v => !v)}
                  >
                    {mostrarInactivos ? 'Ocultar inactivos' : 'Mostrar inactivos'}
                  </Button>
                  <Button onClick={abrirNuevo}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo {TIPO_LABEL[t].toLowerCase()}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />Cargando…
                  </div>
                ) : materiales.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">
                    Sin materiales. Pulsa "Nuevo" para empezar.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          {tipo === 'lacado' || tipo === 'fondo'
                            ? <TableHead className="w-12"></TableHead>
                            : null}
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead className="text-right">€/kg</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right w-56">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materiales.map((m) => {
                          const precio = resolverPrecioKg(m)
                          const fisico = Number(m.stock_fisico_kg)
                          const minimo = Number(m.stock_minimo_kg)
                          const bajoMinimo = minimo > 0 && fisico < minimo
                          return (
                            <TableRow key={m.id} className={!m.activo ? 'opacity-60' : ''}>
                              {(tipo === 'lacado' || tipo === 'fondo') && (
                                <TableCell>
                                  <div
                                    className="w-8 h-8 rounded border"
                                    style={{ backgroundColor: m.hex_aproximado || '#DDD' }}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="font-mono text-xs">{m.codigo || '—'}</TableCell>
                              <TableCell className="font-medium">{m.nombre}</TableCell>
                              <TableCell className="text-sm">
                                {m.proveedor?.nombre ?? <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {precio.toFixed(2)} €
                                {m.precio_kg_sobrescrito != null && (
                                  <span className="text-xs text-blue-600 ml-1">(sobrescrito)</span>
                                )}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${bajoMinimo ? 'text-red-600 font-bold' : ''}`}>
                                {fisico.toFixed(2)} kg
                                {bajoMinimo && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {minimo.toFixed(2)} kg
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button
                                  size="sm" variant="ghost" title="Entrada de stock"
                                  onClick={() => abrirStock(m, 'entrada')}
                                >
                                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost" title="Ajuste / merma"
                                  onClick={() => abrirStock(m, 'ajuste')}
                                >
                                  <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost" title="Histórico"
                                  onClick={() => abrirStock(m, 'historico')}
                                >
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => abrirEditar(m)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={() => toggleActivo(m)}
                                >
                                  {m.activo ? 'Desact.' : 'Activ.'}
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
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* DIALOG ALTA/EDICIÓN MATERIAL */}
      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar material' : `Nuevo ${TIPO_LABEL[form.tipo].toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              Los campos con sobrescrito sólo se rellenan si este material se desvía del
              proveedor o del valor global. Si se dejan vacíos, se usa el valor heredado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej: RAL 9010"
              />
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            {(form.tipo === 'lacado' || form.tipo === 'fondo') && (
              <>
                <div>
                  <Label>Familia</Label>
                  <Select
                    value={form.familia}
                    onValueChange={(v) => setForm({ ...form, familia: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RAL">RAL</SelectItem>
                      <SelectItem value="NCS">NCS</SelectItem>
                      <SelectItem value="referencia_interna">Referencia interna</SelectItem>
                      <SelectItem value="muestra_cliente">Muestra cliente</SelectItem>
                      <SelectItem value="generico">Genérico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Color aproximado (hex)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.hex_aproximado}
                      onChange={(e) =>
                        setForm({ ...form, hex_aproximado: e.target.value.toUpperCase() })
                      }
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.hex_aproximado}
                      onChange={(e) =>
                        setForm({ ...form, hex_aproximado: e.target.value.toUpperCase() })
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label>Proveedor</Label>
              <Select
                value={form.proveedor_id ?? '__ninguno__'}
                onValueChange={(v) =>
                  setForm({ ...form, proveedor_id: v === '__ninguno__' ? null : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ninguno__">(sin proveedor)</SelectItem>
                  {proveedores.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} — {Number(p.precio_base_kg).toFixed(2)} €/kg base
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Precio €/kg sobrescrito</Label>
              <Input
                type="number" step="0.01" min="0"
                value={form.precio_kg_sobrescrito ?? ''}
                onChange={(e) => setForm({
                  ...form,
                  precio_kg_sobrescrito: e.target.value === '' ? null : parseFloat(e.target.value),
                })}
                placeholder="Vacío = usa el del proveedor"
              />
            </div>
            <div>
              <Label>Formato de compra (kg)</Label>
              <Input
                type="number" step="0.1" min="0"
                value={form.formato_compra_kg ?? ''}
                onChange={(e) => setForm({
                  ...form,
                  formato_compra_kg: e.target.value === '' ? null : parseFloat(e.target.value),
                })}
                placeholder="Ej: 5 (bote de 5 kg)"
              />
            </div>

            {(form.tipo === 'lacado' || form.tipo === 'fondo') && (
              <div className="col-span-2">
                <Label>Rendimiento kg/m² sobrescrito</Label>
                <Input
                  type="number" step="0.001" min="0"
                  value={form.rendimiento_kg_m2_sobrescrito ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    rendimiento_kg_m2_sobrescrito: e.target.value === '' ? null : parseFloat(e.target.value),
                  })}
                  placeholder="Vacío = usa el valor global de configuración"
                />
              </div>
            )}

            <div>
              <Label>Stock mínimo (kg)</Label>
              <Input
                type="number" step="0.1" min="0"
                value={form.stock_minimo_kg}
                onChange={(e) => setForm({ ...form, stock_minimo_kg: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="activo" className="cursor-pointer mb-0">Activo</Label>
              </div>
            </div>

            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</>
                : <><Save className="w-4 h-4 mr-2" />Guardar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG STOCK (entrada / ajuste / merma / histórico) */}
      <Dialog
        open={stockDialog !== null}
        onOpenChange={(o) => { if (!o) setStockDialog(null) }}
      >
        <DialogContent className="max-w-lg">
          {stockDialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {stockDialog.modo === 'entrada' && 'Entrada de stock'}
                  {stockDialog.modo === 'ajuste'  && 'Ajuste manual de stock'}
                  {stockDialog.modo === 'merma'   && 'Registrar merma'}
                  {stockDialog.modo === 'historico' && 'Histórico de movimientos'}
                </DialogTitle>
                <DialogDescription>
                  <strong>{stockDialog.material.nombre}</strong> — Stock actual:{' '}
                  {Number(stockDialog.material.stock_fisico_kg).toFixed(2)} kg
                </DialogDescription>
              </DialogHeader>

              {stockDialog.modo === 'historico' ? (
                <div className="max-h-96 overflow-y-auto border rounded">
                  {movimientos.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">
                      Sin movimientos registrados.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs text-right">Cant.</TableHead>
                          <TableHead className="text-xs">Origen</TableHead>
                          <TableHead className="text-xs text-right">Stock después</TableHead>
                          <TableHead className="text-xs">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(m.fecha).toLocaleString('es-ES', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{m.tipo}</Badge></TableCell>
                            <TableCell className={`text-xs text-right font-mono ${m.cantidad_kg >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {m.cantidad_kg >= 0 ? '+' : ''}{Number(m.cantidad_kg).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.pieza || m.pedido ? (
                                <div className="leading-tight">
                                  {m.pieza && (
                                    <div className="font-mono text-slate-700">
                                      {m.pieza.numero}
                                    </div>
                                  )}
                                  {m.pedido?.cliente && (
                                    <div className="text-slate-500">
                                      {m.pedido.cliente.nombre}
                                    </div>
                                  )}
                                  {!m.pieza && m.pedido && (
                                    <div className="font-mono text-slate-700">
                                      {m.pedido.numero}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {Number(m.stock_despues_kg).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs">{m.motivo || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <div>
                    <Label>
                      {stockDialog.modo === 'entrada' && 'Cantidad recibida (kg)'}
                      {stockDialog.modo === 'ajuste'  && 'Delta (kg, signo incluido)'}
                      {stockDialog.modo === 'merma'   && 'Cantidad perdida (kg)'}
                    </Label>
                    <Input
                      type="number" step="0.001"
                      value={stockCantidad}
                      onChange={(e) => setStockCantidad(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                    {stockDialog.modo === 'ajuste' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Positivo = suma al stock. Negativo = resta.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Motivo {stockDialog.modo !== 'entrada' && '*'}</Label>
                    <Textarea
                      rows={2}
                      value={stockMotivo}
                      onChange={(e) => setStockMotivo(e.target.value)}
                      placeholder={
                        stockDialog.modo === 'entrada'
                          ? 'Albarán 2026-123 (opcional)'
                          : stockDialog.modo === 'ajuste'
                            ? 'Recuento de inventario'
                            : 'Bote caducado, spray fallido, etc.'
                      }
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setStockDialog(null)}>
                  {stockDialog.modo === 'historico' ? 'Cerrar' : 'Cancelar'}
                </Button>
                {stockDialog.modo !== 'historico' && (
                  <Button onClick={aplicarStock} disabled={stockProcesando}>
                    {stockProcesando
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando…</>
                      : <><Save className="w-4 h-4 mr-2" />Registrar</>}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={mensaje.tipo === 'ok' ? 'bg-green-50 border-green-300 text-green-900' : ''}
          >
            <AlertDescription className="font-medium">{mensaje.texto}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
