'use client'

import { useEffect, useState } from 'react'
import { Plus, Layers, AlertCircle, BookmarkPlus } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { listarCategoriasPieza } from '@/lib/services/categorias-pieza'
import { listarLacados, listarFondos } from '@/lib/services/materiales'
import type { FactorComplejidad } from '@/lib/motor/coste'
import type { CategoriaPieza, MaterialConProveedor } from '@/lib/types/erp'

// --- Datos que devuelve este dialog al padre ---
export interface NuevaPiezaData {
  // Campos comunes
  descripcion: string
  cantidad: number

  // Datos personalizados (van a datos_personalizada)
  categoria_pieza_id: string | null
  modo_precio: 'm2' | 'pieza' | 'ml'
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
  factor_complejidad: FactorComplejidad
  descuento_porcentaje: number
  precio_aproximado: boolean

  // Guardar como referencia (opcional)
  guardar_como_referencia: boolean
  nombre_referencia: string
}

const FACTORES: Array<{ value: FactorComplejidad; label: string }> = [
  { value: 'simple',   label: 'Simple' },
  { value: 'media',    label: 'Media' },
  { value: 'compleja', label: 'Compleja' },
]

export default function DialogNuevaPiezaV2({
  open,
  onOpenChange,
  clienteId,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  clienteId: string
  onConfirmar: (datos: NuevaPiezaData) => void
}) {
  // === Listas cargadas al abrir ===
  const [categorias, setCategorias] = useState<CategoriaPieza[]>([])
  const [lacados, setLacados] = useState<MaterialConProveedor[]>([])
  const [fondos, setFondos] = useState<MaterialConProveedor[]>([])
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // === Estado del formulario ===
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState(1)

  const [categoriaId, setCategoriaId] = useState<string>('')
  const [modoPrecio, setModoPrecio] = useState<'m2' | 'pieza' | 'ml'>('m2')
  const [ancho, setAncho] = useState<string>('')
  const [alto, setAlto] = useState<string>('')
  const [grosor, setGrosor] = useState<string>('')
  const [longitudMl, setLongitudMl] = useState<string>('')

  const [caraFrontal, setCaraFrontal] = useState(true)
  const [caraTrasera, setCaraTrasera] = useState(false)
  const [cantoSuperior, setCantoSuperior] = useState(false)
  const [cantoInferior, setCantoInferior] = useState(false)
  const [cantoIzquierdo, setCantoIzquierdo] = useState(false)
  const [cantoDerecho, setCantoDerecho] = useState(false)
  const [contabilizarGrosor, setContabilizarGrosor] = useState(false)

  const [lacadoId, setLacadoId] = useState<string>('')
  const [fondoId, setFondoId] = useState<string>('')

  const [factor, setFactor] = useState<FactorComplejidad>('media')
  const [descuento, setDescuento] = useState<string>('0')
  const [precioAproximado, setPrecioAproximado] = useState(false)

  const [guardarComoRef, setGuardarComoRef] = useState(false)
  const [nombreRef, setNombreRef] = useState('')

  const [errorForm, setErrorForm] = useState<string | null>(null)

  // Resetear + cargar cuando se abre
  useEffect(() => {
    if (!open) return
    setDescripcion('')
    setCantidad(1)
    setCategoriaId('')
    setModoPrecio('m2')
    setAncho('')
    setAlto('')
    setGrosor('')
    setLongitudMl('')
    setCaraFrontal(true)
    setCaraTrasera(false)
    setCantoSuperior(false)
    setCantoInferior(false)
    setCantoIzquierdo(false)
    setCantoDerecho(false)
    setContabilizarGrosor(false)
    setLacadoId('')
    setFondoId('')
    setFactor('media')
    setDescuento('0')
    setPrecioAproximado(false)
    setGuardarComoRef(false)
    setNombreRef('')
    setErrorForm(null)

    setCargando(true)
    setErrorCarga(null)
    Promise.all([
      listarCategoriasPieza(true),
      listarLacados(),
      listarFondos(),
    ])
      .then(([cats, lacs, fds]) => {
        setCategorias(cats)
        setLacados(lacs)
        setFondos(fds)
      })
      .catch((e) => setErrorCarga(e?.message ?? 'Error cargando listas'))
      .finally(() => setCargando(false))
  }, [open])

  // Auto-rellenar nombre de referencia con la descripción (editable)
  useEffect(() => {
    if (guardarComoRef && !nombreRef.trim()) {
      setNombreRef(descripcion.trim())
    }
  }, [guardarComoRef, descripcion, nombreRef])

  function submit() {
    setErrorForm(null)

    // Validaciones mínimas
    if (!descripcion.trim()) {
      setErrorForm('La descripción es obligatoria.')
      return
    }
    if (cantidad < 1) {
      setErrorForm('La cantidad debe ser al menos 1.')
      return
    }
    if (!categoriaId) {
      setErrorForm('Selecciona una categoría de pieza.')
      return
    }

    // Dimensiones según modo
    let anchoN: number | null = null
    let altoN: number | null = null
    let grosorN: number | null = null
    let longitudN: number | null = null

    if (modoPrecio === 'ml') {
      longitudN = parseFloat(longitudMl)
      if (!Number.isFinite(longitudN) || longitudN <= 0) {
        setErrorForm('La longitud (ml) debe ser mayor que 0.')
        return
      }
    } else {
      anchoN = parseFloat(ancho)
      altoN = parseFloat(alto)
      if (!Number.isFinite(anchoN) || anchoN <= 0) {
        setErrorForm('El ancho debe ser mayor que 0.')
        return
      }
      if (!Number.isFinite(altoN) || altoN <= 0) {
        setErrorForm('El alto debe ser mayor que 0.')
        return
      }
    }
    if (grosor.trim() !== '') {
      grosorN = parseFloat(grosor)
      if (!Number.isFinite(grosorN) || grosorN < 0) {
        setErrorForm('El grosor debe ser 0 o mayor.')
        return
      }
    }

    // Al menos una cara/canto marcada (si no es modo ml)
    if (modoPrecio !== 'ml') {
      const algunaCara =
        caraFrontal || caraTrasera ||
        cantoSuperior || cantoInferior ||
        cantoIzquierdo || cantoDerecho
      if (!algunaCara) {
        setErrorForm('Marca al menos una cara o canto a tratar.')
        return
      }
    }

    const descN = parseFloat(descuento || '0')
    if (!Number.isFinite(descN) || descN < 0 || descN > 100) {
      setErrorForm('El descuento debe estar entre 0 y 100.')
      return
    }

    if (guardarComoRef && !nombreRef.trim()) {
      setErrorForm('Dale un nombre a la referencia para poder guardarla.')
      return
    }

    // OK → devolver al padre
    onConfirmar({
      descripcion: descripcion.trim(),
      cantidad,
      categoria_pieza_id: categoriaId,
      modo_precio: modoPrecio,
      ancho: anchoN,
      alto: altoN,
      grosor: grosorN,
      longitud_ml: longitudN,
      cara_frontal: caraFrontal,
      cara_trasera: caraTrasera,
      canto_superior: cantoSuperior,
      canto_inferior: cantoInferior,
      canto_izquierdo: cantoIzquierdo,
      canto_derecho: cantoDerecho,
      contabilizar_grosor: contabilizarGrosor,
      material_lacado_id: lacadoId || null,
      material_fondo_id: fondoId || null,
      factor_complejidad: factor,
      descuento_porcentaje: descN,
      precio_aproximado: precioAproximado,
      guardar_como_referencia: guardarComoRef,
      nombre_referencia: nombreRef.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Nueva pieza personalizada
          </DialogTitle>
          <DialogDescription>
            Pieza a medida con lacado y fondo específicos. Puedes guardarla
            también como referencia del cliente para reutilizarla en futuros
            presupuestos.
          </DialogDescription>
        </DialogHeader>

        {errorCarga && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        )}

        {cargando ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Cargando categorías y materiales…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Descripción + cantidad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="desc">Descripción *</Label>
                <Input
                  id="desc"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Puerta Leroy Merlin 80x210"
                />
              </div>
              <div>
                <Label htmlFor="cant">Cantidad *</Label>
                <Input
                  id="cant"
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <Label>Categoría de pieza *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modo precio */}
            <div>
              <Label>Modo de tarificación</Label>
              <Select value={modoPrecio} onValueChange={(v: any) => setModoPrecio(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">Por m² (ancho × alto)</SelectItem>
                  <SelectItem value="pieza">Por pieza (precio fijo)</SelectItem>
                  <SelectItem value="ml">Por metro lineal (longitud)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dimensiones según modo */}
            {modoPrecio === 'ml' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="long">Longitud (ml) *</Label>
                  <Input
                    id="long"
                    type="number"
                    step="0.01"
                    min="0"
                    value={longitudMl}
                    onChange={(e) => setLongitudMl(e.target.value)}
                    placeholder="Ej. 2.40"
                  />
                </div>
                <div>
                  <Label htmlFor="gros">Grosor (mm)</Label>
                  <Input
                    id="gros"
                    type="number"
                    step="0.1"
                    min="0"
                    value={grosor}
                    onChange={(e) => setGrosor(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="anc">Ancho (mm) *</Label>
                  <Input
                    id="anc"
                    type="number"
                    step="1"
                    min="0"
                    value={ancho}
                    onChange={(e) => setAncho(e.target.value)}
                    placeholder="Ej. 800"
                  />
                </div>
                <div>
                  <Label htmlFor="alt">Alto (mm) *</Label>
                  <Input
                    id="alt"
                    type="number"
                    step="1"
                    min="0"
                    value={alto}
                    onChange={(e) => setAlto(e.target.value)}
                    placeholder="Ej. 2100"
                  />
                </div>
                <div>
                  <Label htmlFor="gros2">Grosor (mm)</Label>
                  <Input
                    id="gros2"
                    type="number"
                    step="0.1"
                    min="0"
                    value={grosor}
                    onChange={(e) => setGrosor(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            {/* Caras y cantos — solo si no es ml */}
            {modoPrecio !== 'ml' && (
              <div className="space-y-2">
                <Label>Caras y cantos a tratar *</Label>
                <div className="grid grid-cols-3 gap-2 border rounded p-3 bg-slate-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={caraFrontal} onCheckedChange={(v) => setCaraFrontal(!!v)} />
                    Cara frontal
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={caraTrasera} onCheckedChange={(v) => setCaraTrasera(!!v)} />
                    Cara trasera
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={contabilizarGrosor} onCheckedChange={(v) => setContabilizarGrosor(!!v)} />
                    Contab. grosor
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={cantoSuperior} onCheckedChange={(v) => setCantoSuperior(!!v)} />
                    Canto superior
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={cantoInferior} onCheckedChange={(v) => setCantoInferior(!!v)} />
                    Canto inferior
                  </label>
                  <div />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={cantoIzquierdo} onCheckedChange={(v) => setCantoIzquierdo(!!v)} />
                    Canto izquierdo
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={cantoDerecho} onCheckedChange={(v) => setCantoDerecho(!!v)} />
                    Canto derecho
                  </label>
                </div>
              </div>
            )}

            {/* Materiales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Lacado (color)</Label>
                <Select value={lacadoId || '__ninguna__'} onValueChange={(v) => setLacadoId(v === '__ninguna__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__ninguna__">— Sin lacado —</SelectItem>
                    {lacados.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fondo</Label>
                <Select value={fondoId || '__ninguna__'} onValueChange={(v) => setFondoId(v === '__ninguna__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguna__">— Sin fondo —</SelectItem>
                    {fondos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Factor + descuento + precio aproximado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Complejidad</Label>
                <Select value={factor} onValueChange={(v: any) => setFactor(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACTORES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="desc-linea">Descuento línea (%)</Label>
                <Input
                  id="desc-linea"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={precioAproximado}
                    onCheckedChange={(v) => setPrecioAproximado(!!v)}
                  />
                  Precio aproximado
                </label>
              </div>
            </div>

            {/* Guardar como referencia */}
            <div className="border rounded p-3 bg-blue-50 border-blue-200 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={guardarComoRef}
                  onCheckedChange={(v) => setGuardarComoRef(!!v)}
                />
                <BookmarkPlus className="w-4 h-4 text-blue-700" />
                Guardar también como referencia del cliente
              </label>
              <p className="text-xs text-slate-600">
                Si la marcas, esta pieza quedará guardada en la ficha del cliente
                para reutilizarla rápido en futuros presupuestos.
              </p>
              {guardarComoRef && (
                <div>
                  <Label htmlFor="nref" className="text-xs">
                    Nombre de la referencia
                  </Label>
                  <Input
                    id="nref"
                    value={nombreRef}
                    onChange={(e) => setNombreRef(e.target.value)}
                    placeholder="Por defecto, la descripción de la pieza"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {errorForm && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{errorForm}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={cargando || !!errorCarga}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir al presupuesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
