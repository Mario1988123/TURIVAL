'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Color } from '@/lib/types/erp'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Search,
  Save,
  Grid3x3,
  List,
  Pencil,
  Palette,
} from 'lucide-react'

type TipoColor = 'RAL' | 'NCS' | 'referencia_interna' | 'muestra_cliente'
type Vista = 'cuadricula' | 'tabla'

const TIPOS_LABEL: Record<TipoColor, string> = {
  RAL: 'RAL',
  NCS: 'NCS',
  referencia_interna: 'Referencia interna',
  muestra_cliente: 'Muestra cliente',
}

export default function ColoresPage() {
  const supabase = createClient()

  const [colores, setColores] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Filtros y vista
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [vista, setVista] = useState<Vista>('cuadricula')

  // Diálogo de edición
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Color | null>(null)
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: 'RAL' as TipoColor,
    hex_aproximado: '#FFFFFF',
    observaciones: '',
    sobrecoste: 0,
    activo: true,
  })

  // Limpiar mensaje a los 4 segundos
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    // IMPORTANTE: pedimos explícitamente hasta 5000 filas con .range(0, 4999)
    // para evitar el límite implícito de Supabase que recorta la respuesta.
    const { data, error } = await supabase
      .from('colores')
      .select('*')
      .order('codigo', { ascending: true })
      .range(0, 4999)

    if (error) {
      setMensaje({ tipo: 'error', texto: `Error cargando colores: ${error.message}` })
    } else {
      setColores((data || []) as Color[])
    }
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  // Filtrado en memoria (son pocos cientos, va sobrado)
  const coloresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return colores.filter((c) => {
      if (!mostrarInactivos && !c.activo) return false
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (q) {
        const hay =
          c.codigo.toLowerCase().includes(q) ||
          c.nombre.toLowerCase().includes(q) ||
          (c.hex_aproximado || '').toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [colores, busqueda, filtroTipo, mostrarInactivos])

  // Agrupar por serie RAL para la vista de cuadrícula
  const coloresPorGrupo = useMemo(() => {
    const grupos: Record<string, Color[]> = {}
    for (const c of coloresFiltrados) {
      let clave: string
      if (c.tipo === 'RAL') {
        const match = c.codigo.match(/RAL\s*(\d)/)
        if (match) {
          clave = `RAL ${match[1]}000 — ${etiquetaGrupoRAL(match[1])}`
        } else {
          clave = 'RAL (otros)'
        }
      } else {
        clave = TIPOS_LABEL[c.tipo]
      }
      if (!grupos[clave]) grupos[clave] = []
      grupos[clave].push(c)
    }
    return grupos
  }, [coloresFiltrados])

  function abrirNuevo() {
    setEditando(null)
    setForm({
      codigo: '',
      nombre: '',
      tipo: 'referencia_interna',
      hex_aproximado: '#FFFFFF',
      observaciones: '',
      sobrecoste: 0,
      activo: true,
    })
    setDialogoAbierto(true)
  }

  function abrirEditar(c: Color) {
    setEditando(c)
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      hex_aproximado: c.hex_aproximado || '#FFFFFF',
      observaciones: c.observaciones || '',
      sobrecoste: Number(c.sobrecoste) || 0,
      activo: c.activo,
    })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.codigo.trim()) {
      setMensaje({ tipo: 'error', texto: 'El código es obligatorio.' })
      return
    }
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('colores')
          .update({
            codigo: form.codigo.trim(),
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            hex_aproximado: form.hex_aproximado || null,
            observaciones: form.observaciones.trim() || null,
            sobrecoste: form.sobrecoste,
            activo: form.activo,
          })
          .eq('id', editando.id)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Color actualizado.' })
      } else {
        const { error } = await supabase.from('colores').insert({
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          hex_aproximado: form.hex_aproximado || null,
          observaciones: form.observaciones.trim() || null,
          sobrecoste: form.sobrecoste,
          activo: form.activo,
        })
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Color creado.' })
      }
      setDialogoAbierto(false)
      await cargar()
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setMensaje({ tipo: 'error', texto: `Ese código ya existe: "${form.codigo}".` })
      } else {
        setMensaje({ tipo: 'error', texto: `Error guardando: ${msg}` })
      }
    }
  }

  async function toggleActivo(c: Color) {
    try {
      const { error } = await supabase
        .from('colores')
        .update({ activo: !c.activo })
        .eq('id', c.id)
      if (error) throw error
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${err.message || err}` })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="w-8 h-8" />
          Colores
        </h1>
        <p className="text-muted-foreground">
          Catálogo de colores disponibles para lacar. Incluye RAL Classic, NCS,
          referencias internas y muestras de cliente.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-60">
              <Label className="text-xs mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Código, nombre o hex…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-56">
              <Label className="text-xs mb-1 block">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="RAL">RAL</SelectItem>
                  <SelectItem value="NCS">NCS</SelectItem>
                  <SelectItem value="referencia_interna">Referencia interna</SelectItem>
                  <SelectItem value="muestra_cliente">Muestra cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={mostrarInactivos ? 'default' : 'outline'}
              onClick={() => setMostrarInactivos((v) => !v)}
            >
              {mostrarInactivos ? 'Ocultar inactivos' : 'Mostrar inactivos'}
            </Button>

            <div className="flex border rounded-md">
              <Button
                variant={vista === 'cuadricula' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVista('cuadricula')}
                className="rounded-r-none"
              >
                <Grid3x3 className="w-4 h-4 mr-1" /> Cuadrícula
              </Button>
              <Button
                variant={vista === 'tabla' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVista('tabla')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4 mr-1" /> Tabla
              </Button>
            </div>

            <Button onClick={abrirNuevo}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo color
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Mostrando <strong>{coloresFiltrados.length}</strong> de {colores.length} colores.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : coloresFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay colores que coincidan con los filtros.
          </CardContent>
        </Card>
      ) : vista === 'cuadricula' ? (
        <VistaCuadricula grupos={coloresPorGrupo} onEditar={abrirEditar} />
      ) : (
        <VistaTabla
          colores={coloresFiltrados}
          onEditar={abrirEditar}
          onToggleActivo={toggleActivo}
        />
      )}

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar color' : 'Nuevo color'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'Modifica los datos del color.'
                : 'Normalmente los RAL y NCS estándar ya están cargados. Usa esto para añadir referencias internas o muestras de cliente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código *</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ej: INT-001 o RAL 9999"
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v: TipoColor) => setForm({ ...form, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAL">RAL</SelectItem>
                    <SelectItem value="NCS">NCS</SelectItem>
                    <SelectItem value="referencia_interna">Referencia interna</SelectItem>
                    <SelectItem value="muestra_cliente">Muestra cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Blanco roto especial"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Color (hex)</Label>
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
                    placeholder="#FFFFFF"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Sobrecoste (€ / m²)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sobrecoste}
                  onChange={(e) =>
                    setForm({ ...form, sobrecoste: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas técnicas, referencias alternativas, etc."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo" className="cursor-pointer mb-0">
                Activo (disponible para presupuestos)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VistaCuadricula({
  grupos,
  onEditar,
}: {
  grupos: Record<string, Color[]>
  onEditar: (c: Color) => void
}) {
  const clavesOrdenadas = Object.keys(grupos).sort()

  return (
    <div className="space-y-6">
      {clavesOrdenadas.map((clave) => (
        <Card key={clave}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{clave}</CardTitle>
            <CardDescription>{grupos[clave].length} colores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {grupos[clave].map((c) => (
                <TarjetaColor key={c.id} color={c} onEditar={onEditar} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TarjetaColor({
  color,
  onEditar,
}: {
  color: Color
  onEditar: (c: Color) => void
}) {
  const hex = color.hex_aproximado || '#DDDDDD'
  const textoClaro = esColorOscuro(hex)

  return (
    <button
      onClick={() => onEditar(color)}
      className={`relative rounded-lg overflow-hidden border hover:shadow-md transition text-left ${
        !color.activo ? 'opacity-50' : ''
      }`}
    >
      <div
        className="h-16 flex items-center justify-center"
        style={{ backgroundColor: hex }}
      >
        {!color.activo && (
          <Badge variant="secondary" className="text-xs">
            Inactivo
          </Badge>
        )}
        {color.sobrecoste > 0 && (
          <Badge
            variant="outline"
            className={`absolute top-1 right-1 text-xs ${
              textoClaro
                ? 'bg-white/90 text-slate-900'
                : 'bg-slate-900/80 text-white border-slate-700'
            }`}
          >
            +{Number(color.sobrecoste).toFixed(2)}€
          </Badge>
        )}
      </div>
      <div className="p-2 bg-white">
        <p className="text-xs font-semibold truncate">{color.codigo}</p>
        <p className="text-xs text-slate-600 truncate">{color.nombre}</p>
      </div>
    </button>
  )
}

function VistaTabla({
  colores,
  onEditar,
  onToggleActivo,
}: {
  colores: Color[]
  onEditar: (c: Color) => void
  onToggleActivo: (c: Color) => void
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-20">Color</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Hex</TableHead>
                <TableHead className="text-right">Sobrecoste</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colores.map((c) => (
                <TableRow key={c.id} className={!c.activo ? 'opacity-60' : ''}>
                  <TableCell>
                    <div
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: c.hex_aproximado || '#DDD' }}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{c.codigo}</TableCell>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPOS_LABEL[c.tipo as TipoColor]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.hex_aproximado || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(c.sobrecoste) > 0
                      ? `+${Number(c.sobrecoste).toFixed(2)}€`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.activo ? 'default' : 'secondary'}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" onClick={() => onEditar(c)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onToggleActivo(c)}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Button>
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

function etiquetaGrupoRAL(digito: string): string {
  const m: Record<string, string> = {
    '1': 'Amarillos y beiges',
    '2': 'Naranjas',
    '3': 'Rojos',
    '4': 'Violetas',
    '5': 'Azules',
    '6': 'Verdes',
    '7': 'Grises',
    '8': 'Marrones',
    '9': 'Blancos y negros',
  }
  return m[digito] || 'Otros'
}

function esColorOscuro(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia < 0.5
}
