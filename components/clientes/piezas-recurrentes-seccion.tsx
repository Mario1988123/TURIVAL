'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listarReferenciasPorCliente,
  crearReferencia,
  actualizarReferencia,
  borrarReferencia,
  toggleActivoReferencia,
  recalcularCosteReferencia,
  type ReferenciaCliente,
} from '@/lib/services/referencias-cliente'
import { listarCategoriasPieza } from '@/lib/services/categorias-pieza'
import { listarMateriales } from '@/lib/services/materiales'
import { getProcesoDefault, PROCESOS_ORDEN } from '@/lib/motor/procesos-defaults'
import type {
  CategoriaPieza, MaterialConProveedor,
} from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  Plus, Pencil, Trash2, Save, Loader2, RefreshCw,
  Layers, X, ArrowUp, ArrowDown,
} from 'lucide-react'

type ModoPrecio = 'm2' | 'pieza' | 'ml' | 'manual'
type Complejidad = 'simple' | 'media' | 'compleja'

interface FormPieza {
  referencia_cliente: string
  nombre_pieza: string
  descripcion: string
  categoria_pieza_id: string | null
  modo_precio: ModoPrecio
  ancho: number | null
  alto: number | null
  grosor: number | null
  longitud_ml: number | null
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  contabilizar_grosor: boolean
  material_lacado_id: string | null
  material_fondo_id: string | null
  factor_complejidad: Complejidad
  descuento_porcentaje: number
  precio_aproximado: boolean
  precio_pactado: number | null
  observaciones: string
  procesos: Array<{
    proceso_codigo: string
    orden: number
    tiempo_base_min: number
    tiempo_por_m2_min: number
  }>
  activo: boolean
}

const FORM_VACIO: FormPieza = {
  referencia_cliente: '',
  nombre_pieza: '',
  descripcion: '',
  categoria_pieza_id: null,
  modo_precio: 'm2',
  ancho: null,
  alto: null,
  grosor: null,
  longitud_ml: null,
  cara_frontal: true,
  cara_trasera: true,
  canto_superior: true,
  canto_inferior: true,
  canto_izquierdo: true,
  canto_derecho: true,
  contabilizar_grosor: false,
  material_lacado_id: null,
  material_fondo_id: null,
  factor_complejidad: 'media',
  descuento_porcentaje: 0,
  precio_aproximado: false,
  precio_pactado: null,
  observaciones: '',
  procesos: [],
  activo: true,
}

const EURO = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default function PiezasRecurrentesSeccion({ clienteId }: { clienteId: string }) {
  const [refs, setRefs] = useState<ReferenciaCliente[]>([])
  const [categorias, setCategorias] = useState<CategoriaPieza[]>([])
  const [lacados, setLacados] = useState<MaterialConProveedor[]>([])
  const [fondos, setFondos] = useState<MaterialConProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [dialogo, setDialogo] = useState(false)
  const [editando, setEditando] = useState<ReferenciaCliente | null>(null)
  const [form, setForm] = useState<FormPieza>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const [recalculando, setRecalculando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [rf, cat, lac, fnd] = await Promise.all([
        listarReferenciasPorCliente(clienteId, false),
        listarCategoriasPieza(true),
        listarMateriales({ tipo: 'lacado', activos_solo: true }),
        listarMateriales({ tipo: 'fondo',  activos_solo: true }),
      ])
      setRefs(rf)
      setCategorias(cat)
      setLacados(lac)
      setFondos(fnd)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [clienteId])
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setDialogo(true)
  }

  function abrirEditar(r: ReferenciaCliente) {
    setEditando(r)
    setForm({
      referencia_cliente: r.referencia_cliente,
      nombre_pieza: r.nombre_pieza ?? '',
      descripcion: r.descripcion ?? '',
      categoria_pieza_id: r.categoria_pieza_id,
      modo_precio: r.modo_precio,
      ancho: r.ancho,
      alto: r.alto,
      grosor: r.grosor,
      longitud_ml: r.longitud_ml,
      cara_frontal: r.cara_frontal,
      cara_trasera: r.cara_trasera,
      canto_superior: r.canto_superior,
      canto_inferior: r.canto_inferior,
      canto_izquierdo: r.canto_izquierdo,
      canto_derecho: r.canto_derecho,
      contabilizar_grosor: r.contabilizar_grosor,
      material_lacado_id: r.material_lacado_id,
      material_fondo_id: r.material_fondo_id,
      factor_complejidad: r.factor_complejidad,
      descuento_porcentaje: r.descuento_porcentaje,
      precio_aproximado: r.precio_aproximado,
      precio_pactado: r.precio_pactado,
      observaciones: r.observaciones ?? '',
      procesos: (r.procesos ?? []).map(p => ({
        proceso_codigo: p.proceso_codigo,
        orden: p.orden,
        tiempo_base_min:   p.tiempo_base_min   ?? getProcesoDefault(p.proceso_codigo)?.tiempo_base_min   ?? 0,
        tiempo_por_m2_min: p.tiempo_por_m2_min ?? getProcesoDefault(p.proceso_codigo)?.tiempo_por_m2_min ?? 0,
      })),
      activo: r.activo,
    })
    setDialogo(true)
  }

  /**
   * Cuando cambia la categoría, heredamos sus defaults como punto de partida
   * (caras, grosor, modo_precio, procesos).
   */
  function onCambioCategoria(id: string) {
    const cat = categorias.find(c => c.id === id)
    if (!cat) {
      setForm(f => ({ ...f, categoria_pieza_id: id }))
      return
    }

    // Derivar caras desde caras_default
    const c: Partial<FormPieza> = {}
    if (cat.caras_default === 1) {
      c.cara_frontal = true
      c.cara_trasera = false
      c.canto_superior = false
      c.canto_inferior = false
      c.canto_izquierdo = false
      c.canto_derecho = false
    } else if (cat.caras_default === 2) {
      c.cara_frontal = true
      c.cara_trasera = true
      c.canto_superior = false
      c.canto_inferior = false
      c.canto_izquierdo = false
      c.canto_derecho = false
    } else if (cat.caras_default === 4) {
      c.cara_frontal = true
      c.cara_trasera = true
      c.canto_superior = false
      c.canto_inferior = false
      c.canto_izquierdo = true
      c.canto_derecho = true
    } else {
      c.cara_frontal = true
      c.cara_trasera = true
      c.canto_superior = true
      c.canto_inferior = true
      c.canto_izquierdo = true
      c.canto_derecho = true
    }

    const procesos = (cat.procesos_default ?? []).map((p: any, idx) => {
      const def = getProcesoDefault(p.proceso_codigo)
      return {
        proceso_codigo:    p.proceso_codigo,
        orden:             p.orden ?? idx + 1,
        tiempo_base_min:   def?.tiempo_base_min ?? 0,
        tiempo_por_m2_min: def?.tiempo_por_m2_min ?? 0,
      }
    })

    setForm(f => ({
      ...f,
      categoria_pieza_id: id,
      modo_precio: cat.modo_precio_default,
      contabilizar_grosor: cat.contabilizar_grosor_default,
      procesos,
      ...c,
    }))
  }

  function moverProceso(idx: number, dir: -1 | 1) {
    setForm(f => {
      const arr = [...f.procesos]
      const tgt = idx + dir
      if (tgt < 0 || tgt >= arr.length) return f
      ;[arr[idx], arr[tgt]] = [arr[tgt], arr[idx]]
      arr.forEach((p, i) => (p.orden = i + 1))
      return { ...f, procesos: arr }
    })
  }

  function quitarProceso(idx: number) {
    setForm(f => {
      const arr = f.procesos.filter((_, i) => i !== idx)
      arr.forEach((p, i) => (p.orden = i + 1))
      return { ...f, procesos: arr }
    })
  }

  function añadirProceso(codigo: string) {
    const def = getProcesoDefault(codigo)
    if (!def) return
    setForm(f => ({
      ...f,
      procesos: [
        ...f.procesos,
        {
          proceso_codigo: codigo,
          orden: f.procesos.length + 1,
          tiempo_base_min: def.tiempo_base_min,
          tiempo_por_m2_min: def.tiempo_por_m2_min,
        },
      ],
    }))
  }

  function actProceso(idx: number, campo: 'tiempo_base_min' | 'tiempo_por_m2_min', valor: number) {
    setForm(f => {
      const arr = [...f.procesos]
      arr[idx] = { ...arr[idx], [campo]: valor }
      return { ...f, procesos: arr }
    })
  }

  async function guardar() {
    if (!form.referencia_cliente.trim()) {
      setMensaje({ tipo: 'error', texto: 'La referencia del cliente es obligatoria.' })
      return
    }
    if (!form.nombre_pieza.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre de la pieza es obligatorio.' })
      return
    }
    setGuardando(true)
    try {
      const datos = {
        cliente_id: clienteId,
        referencia_cliente: form.referencia_cliente.trim(),
        nombre_pieza: form.nombre_pieza.trim(),
        descripcion: form.descripcion.trim() || null,
        categoria_pieza_id: form.categoria_pieza_id,
        modo_precio: form.modo_precio,
        ancho: form.ancho,
        alto: form.alto,
        grosor: form.grosor,
        longitud_ml: form.longitud_ml,
        cara_frontal: form.cara_frontal,
        cara_trasera: form.cara_trasera,
        canto_superior: form.canto_superior,
        canto_inferior: form.canto_inferior,
        canto_izquierdo: form.canto_izquierdo,
        canto_derecho: form.canto_derecho,
        contabilizar_grosor: form.contabilizar_grosor,
        material_lacado_id: form.material_lacado_id,
        material_fondo_id: form.material_fondo_id,
        factor_complejidad: form.factor_complejidad,
        descuento_porcentaje: form.descuento_porcentaje,
        precio_aproximado: form.precio_aproximado,
        precio_pactado: form.precio_pactado,
        observaciones: form.observaciones.trim() || null,
        procesos: form.procesos,
        activo: form.activo,
        // campos legacy vacíos (siguen existiendo en BD, sin usar)
        referencia_interna: null,
      } as any

      let id: string
      if (editando) {
        await actualizarReferencia(editando.id, datos)
        id = editando.id
        setMensaje({ tipo: 'ok', texto: 'Referencia actualizada.' })
      } else {
        const nuevo = await crearReferencia(datos)
        id = nuevo.id
        setMensaje({ tipo: 'ok', texto: 'Referencia creada.' })
      }

      // Recalcular coste en background
      try {
        await recalcularCosteReferencia(id)
      } catch (e: any) {
        console.warn('[referencias] No se pudo recalcular al guardar:', e)
      }

      setDialogo(false)
      await cargar()
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setMensaje({ tipo: 'error', texto: `Ya existe una referencia con código "${form.referencia_cliente}"` })
      } else {
        setMensaje({ tipo: 'error', texto: `Error: ${msg}` })
      }
    } finally {
      setGuardando(false)
    }
  }

  async function recalcular(r: ReferenciaCliente) {
    setRecalculando(r.id)
    try {
      await recalcularCosteReferencia(r.id)
      setMensaje({ tipo: 'ok', texto: 'Coste recalculado.' })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setRecalculando(null)
    }
  }

  async function borrar(r: ReferenciaCliente) {
    if (!confirm(`¿Borrar referencia "${r.referencia_cliente}"? Esta acción es irreversible.`)) return
    try {
      await borrarReferencia(r.id)
      setMensaje({ tipo: 'ok', texto: 'Referencia borrada.' })
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    }
  }

  async function toggleActivo(r: ReferenciaCliente) {
    try {
      await toggleActivoReferencia(r.id, !r.activo)
      await cargar()
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    }
  }

  const procesosNoUsados = useMemo(() => {
    const usados = new Set(form.procesos.map(p => p.proceso_codigo))
    return PROCESOS_ORDEN.filter(c => !usados.has(c))
  }, [form.procesos])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Piezas recurrentes
          </CardTitle>
          <CardDescription>
            Piezas que este cliente pide habitualmente. Al presupuestar, podrás
            cargar una y rellenar el presupuesto sin tener que introducir medidas.
          </CardDescription>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="w-4 h-4 mr-2" />Nueva pieza
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />Cargando…
          </div>
        ) : refs.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">
            Este cliente todavía no tiene piezas recurrentes. Pulsa "Nueva pieza" para crear una.
          </p>
        ) : (
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Desc. %</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right w-44">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refs.map(r => (
                  <TableRow key={r.id} className={!r.activo ? 'opacity-60' : ''}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {r.referencia_cliente}
                    </TableCell>
                    <TableCell>
                      <div>{r.nombre_pieza ?? r.descripcion ?? '—'}</div>
                      {r.precio_aproximado && (
                        <Badge variant="outline" className="text-xs mt-1">Aproximado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.modo_precio}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.coste_calculado_ultimo != null ? EURO(r.coste_calculado_ultimo) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-blue-700">
                      {r.precio_calculado_ultimo != null ? EURO(r.precio_calculado_ultimo) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(r.descuento_porcentaje) > 0 ? `${r.descuento_porcentaje}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.activo ? 'default' : 'secondary'}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" title="Recalcular coste"
                        onClick={() => recalcular(r)}
                        disabled={recalculando === r.id}
                      >
                        {recalculando === r.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEditar(r)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActivo(r)}>
                        {r.activo ? 'Desact.' : 'Activ.'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600"
                        onClick={() => borrar(r)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* DIALOG PIEZA */}
      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? `Editar pieza ${editando.referencia_cliente}` : 'Nueva pieza recurrente'}
            </DialogTitle>
            <DialogDescription>
              Esta pieza quedará asociada al cliente actual. Los procesos, medidas y
              materiales se guardan para cargarla rápido al presupuestar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Identificación */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Referencia cliente *</Label>
                <Input
                  value={form.referencia_cliente}
                  onChange={(e) => setForm({ ...form, referencia_cliente: e.target.value })}
                  placeholder="Ej: AVE-X4"
                />
              </div>
              <div>
                <Label>Nombre de la pieza *</Label>
                <Input
                  value={form.nombre_pieza}
                  onChange={(e) => setForm({ ...form, nombre_pieza: e.target.value })}
                  placeholder="Ej: Puerta frontal AVE X4"
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <Label>Categoría de pieza</Label>
              <Select
                value={form.categoria_pieza_id ?? '__ninguna__'}
                onValueChange={(v) => v === '__ninguna__'
                  ? setForm(f => ({ ...f, categoria_pieza_id: null }))
                  : onCambioCategoria(v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ninguna__">(ninguna)</SelectItem>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Al cambiar de categoría se aplican sus caras y procesos por defecto. Luego puedes retocarlos.
              </p>
            </div>

            {/* Modo precio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modo de precio</Label>
                <Select
                  value={form.modo_precio}
                  onValueChange={(v: ModoPrecio) => setForm({ ...form, modo_precio: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">Por m²</SelectItem>
                    <SelectItem value="pieza">Por pieza (precio fijo)</SelectItem>
                    <SelectItem value="ml">Por metro lineal</SelectItem>
                    <SelectItem value="manual">Manual (sin motor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Complejidad</Label>
                <Select
                  value={form.factor_complejidad}
                  onValueChange={(v: Complejidad) => setForm({ ...form, factor_complejidad: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (0.8×)</SelectItem>
                    <SelectItem value="media">Media (1.0×)</SelectItem>
                    <SelectItem value="compleja">Compleja (1.3×)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Medidas */}
            {form.modo_precio !== 'manual' && (
              <div>
                <Label className="text-sm font-semibold">Medidas (mm)</Label>
                {form.modo_precio === 'ml' ? (
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    <div>
                      <Label className="text-xs">Longitud (m)</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={form.longitud_ml ?? ''}
                        onChange={(e) => setForm({ ...form,
                          longitud_ml: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <Label className="text-xs">Ancho (mm)</Label>
                      <Input type="number" step="1" min="0" value={form.ancho ?? ''}
                        onChange={(e) => setForm({ ...form, ancho: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Alto (mm)</Label>
                      <Input type="number" step="1" min="0" value={form.alto ?? ''}
                        onChange={(e) => setForm({ ...form, alto: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Grosor (mm)</Label>
                      <Input type="number" step="1" min="0" value={form.grosor ?? ''}
                        onChange={(e) => setForm({ ...form, grosor: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Caras */}
            {form.modo_precio === 'm2' && (
              <div>
                <Label className="text-sm font-semibold">Caras a pintar</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {([
                    ['cara_frontal', 'Frontal'],
                    ['cara_trasera', 'Trasera'],
                    ['canto_superior', 'Canto superior'],
                    ['canto_inferior', 'Canto inferior'],
                    ['canto_izquierdo', 'Canto izquierdo'],
                    ['canto_derecho', 'Canto derecho'],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox"
                        checked={(form as any)[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                        className="h-4 w-4"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm mt-2">
                  <input type="checkbox"
                    checked={form.contabilizar_grosor}
                    onChange={(e) => setForm({ ...form, contabilizar_grosor: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Contabilizar grosor en los cantos
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Desactivar si el grosor se pinta de paso al pintar la cara frontal.
                </p>
              </div>
            )}

            {/* Materiales */}
            {form.modo_precio !== 'manual' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Material de lacado</Label>
                  <Select
                    value={form.material_lacado_id ?? '__ninguno__'}
                    onValueChange={(v) => setForm({ ...form,
                      material_lacado_id: v === '__ninguno__' ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Sin lacado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguno__">(ninguno)</SelectItem>
                      {lacados.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fondo</Label>
                  <Select
                    value={form.material_fondo_id ?? '__ninguno__'}
                    onValueChange={(v) => setForm({ ...form,
                      material_fondo_id: v === '__ninguno__' ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Sin fondo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguno__">(ninguno)</SelectItem>
                      {fondos.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Procesos */}
            {form.modo_precio !== 'manual' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Procesos ({form.procesos.length})</Label>
                  {procesosNoUsados.length > 0 && (
                    <Select value="" onValueChange={(v) => añadirProceso(v)}>
                      <SelectTrigger className="w-56 h-8 text-xs">
                        <SelectValue placeholder="+ Añadir proceso…" />
                      </SelectTrigger>
                      <SelectContent>
                        {procesosNoUsados.map(c => {
                          const def = getProcesoDefault(c)
                          return (
                            <SelectItem key={c} value={c}>{def?.nombre ?? c}</SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {form.procesos.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Sin procesos. Añade al menos uno o selecciona una categoría para heredar los defaults.
                  </p>
                ) : (
                  <div className="space-y-1 border rounded p-2 bg-slate-50">
                    {form.procesos.map((p, idx) => {
                      const def = getProcesoDefault(p.proceso_codigo)
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border">
                          <span className="text-xs w-6 font-mono text-muted-foreground">{idx + 1}.</span>
                          <Badge variant="outline" className="text-xs">
                            {def?.abreviatura ?? '?'}
                          </Badge>
                          <span className="text-sm flex-1">{def?.nombre ?? p.proceso_codigo}</span>
                          {def?.consume_material && (
                            <Badge variant="outline" className="text-xs bg-amber-50">
                              {def.tipo_material}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-xs">
                            <Input
                              type="number" step="0.5" min="0"
                              value={p.tiempo_base_min}
                              onChange={(e) => actProceso(idx, 'tiempo_base_min', parseFloat(e.target.value) || 0)}
                              className="w-16 h-7 text-xs"
                              title="Tiempo base (min)"
                            />
                            <span className="text-muted-foreground">base</span>
                            <Input
                              type="number" step="0.5" min="0"
                              value={p.tiempo_por_m2_min}
                              onChange={(e) => actProceso(idx, 'tiempo_por_m2_min', parseFloat(e.target.value) || 0)}
                              className="w-16 h-7 text-xs"
                              title="Minutos por m²"
                            />
                            <span className="text-muted-foreground">/m²</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2"
                            disabled={idx === 0} onClick={() => moverProceso(idx, -1)}>
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2"
                            disabled={idx === form.procesos.length - 1}
                            onClick={() => moverProceso(idx, 1)}>
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600"
                            onClick={() => quitarProceso(idx)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Descuento y precio pactado */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Descuento %</Label>
                <Input type="number" step="1" min="0" max="100"
                  value={form.descuento_porcentaje}
                  onChange={(e) => setForm({ ...form, descuento_porcentaje: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Precio pactado (opcional)</Label>
                <Input type="number" step="0.01" min="0"
                  value={form.precio_pactado ?? ''}
                  onChange={(e) => setForm({ ...form,
                    precio_pactado: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  placeholder="Si hay acuerdo cerrado"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input type="checkbox"
                    checked={form.precio_aproximado}
                    onChange={(e) => setForm({ ...form, precio_aproximado: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Precio aproximado
                </label>
              </div>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo" className="cursor-pointer mb-0">Activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</>
                : <><Save className="w-4 h-4 mr-2" />Guardar y calcular</>}
            </Button>
          </DialogFooter>
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
    </Card>
  )
}
