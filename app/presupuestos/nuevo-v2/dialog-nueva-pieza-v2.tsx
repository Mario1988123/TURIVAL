'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  Layers,
  AlertCircle,
  BookmarkPlus,
  Calculator,
  Loader2,
} from 'lucide-react'

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
import { getProcesoDefault, PROCESOS_ORDEN } from '@/lib/motor/procesos-defaults'
import {
  simularPrecioLineaPersonalizada,
  type SimularPrecioResultado,
} from '@/lib/services/presupuestos-v2'
import type { FactorComplejidad } from '@/lib/motor/coste'
import type { CategoriaPieza, MaterialConProveedor } from '@/lib/types/erp'
import SelectorCategoriaPieza from '@/components/presupuestos/selector-categoria-pieza'
import SelectorMaterialColor from '@/components/presupuestos/selector-material-color'

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

  // Procesos aplicables (códigos seleccionados, orden auto)
  procesos_codigos: string[]

  // Guardar como referencia (opcional)
  guardar_como_referencia: boolean
  nombre_referencia: string

  // Preview calculado desde el dialog (Opción B). Si el usuario pulsó
  // "Calcular precio" antes de añadir, viaja aquí y el padre lo pinta
  // en la tabla + totales. Si es null, el cliente muestra "Al guardar".
  preview: SimularPrecioResultado | null
}

const FACTORES: Array<{ value: FactorComplejidad; label: string }> = [
  { value: 'simple',   label: 'Simple' },
  { value: 'media',    label: 'Media' },
  { value: 'compleja', label: 'Compleja' },
]

// Defaults marcados: los típicos de una pieza con lacado+fondo.
// El usuario puede añadir o quitar.
const PROCESOS_DEFAULT_MARCADOS = ['LIJADO', 'FONDO', 'LACADO', 'TERMINACION']

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

  // Procesos marcados por el usuario (Set de códigos)
  const [procesosMarcados, setProcesosMarcados] = useState<Set<string>>(
    new Set(PROCESOS_DEFAULT_MARCADOS)
  )

  const [guardarComoRef, setGuardarComoRef] = useState(false)
  const [nombreRef, setNombreRef] = useState('')

  const [errorForm, setErrorForm] = useState<string | null>(null)

  // Preview de precio (botón "Calcular precio" — R6b Opción B)
  const [calculando, setCalculando] = useState(false)
  const [preview, setPreview] = useState<SimularPrecioResultado | null>(null)
  const [errorPreview, setErrorPreview] = useState<string | null>(null)

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
    setProcesosMarcados(new Set(PROCESOS_DEFAULT_MARCADOS))
    setGuardarComoRef(false)
    setNombreRef('')
    setPreview(null)
    setErrorPreview(null)
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

  /**
   * Valida los campos del formulario y devuelve un objeto con todos
   * los datos parseados + procesos ordenados. Null si hay error (y
   * setea errorForm). Reutilizado por submit() y calcularPrecio().
   */
  function validarYConstruir(): null | {
    anchoN: number | null
    altoN: number | null
    grosorN: number | null
    longitudN: number | null
    descN: number
    procesosOrdenados: string[]
  } {
    setErrorForm(null)

    if (!descripcion.trim()) {
      setErrorForm('La descripción es obligatoria.')
      return null
    }
    if (cantidad < 1) {
      setErrorForm('La cantidad debe ser al menos 1.')
      return null
    }
    if (!categoriaId) {
      setErrorForm('Selecciona una categoría de pieza.')
      return null
    }

    let anchoN: number | null = null
    let altoN: number | null = null
    let grosorN: number | null = null
    let longitudN: number | null = null

    if (modoPrecio === 'ml') {
      longitudN = parseFloat(longitudMl)
      if (!Number.isFinite(longitudN) || longitudN <= 0) {
        setErrorForm('La longitud (ml) debe ser mayor que 0.')
        return null
      }
    } else {
      anchoN = parseFloat(ancho)
      altoN = parseFloat(alto)
      if (!Number.isFinite(anchoN) || anchoN <= 0) {
        setErrorForm('El ancho debe ser mayor que 0.')
        return null
      }
      if (!Number.isFinite(altoN) || altoN <= 0) {
        setErrorForm('El alto debe ser mayor que 0.')
        return null
      }
    }
    if (grosor.trim() !== '') {
      grosorN = parseFloat(grosor)
      if (!Number.isFinite(grosorN) || grosorN < 0) {
        setErrorForm('El grosor debe ser 0 o mayor.')
        return null
      }
    }

    if (modoPrecio !== 'ml') {
      const algunaCara =
        caraFrontal || caraTrasera ||
        cantoSuperior || cantoInferior ||
        cantoIzquierdo || cantoDerecho
      if (!algunaCara) {
        setErrorForm('Marca al menos una cara o canto a tratar.')
        return null
      }
    }

    const descN = parseFloat(descuento || '0')
    if (!Number.isFinite(descN) || descN < 0 || descN > 100) {
      setErrorForm('El descuento debe estar entre 0 y 100.')
      return null
    }

    if (procesosMarcados.size === 0) {
      setErrorForm('Marca al menos un proceso a aplicar.')
      return null
    }

    const procesosOrdenados = PROCESOS_ORDEN.filter((c) => procesosMarcados.has(c))

    return { anchoN, altoN, grosorN, longitudN, descN, procesosOrdenados }
  }

  /**
   * Llama al servidor para simular el precio SIN guardar. Popula
   * el panel de resultado arriba del formulario.
   */
  async function calcularPrecio() {
    const v = validarYConstruir()
    if (!v) return

    setCalculando(true)
    setErrorPreview(null)
    try {
      const resultado = await simularPrecioLineaPersonalizada({
        cantidad,
        modo_precio: modoPrecio,
        ancho: v.anchoN,
        alto: v.altoN,
        grosor: v.grosorN,
        longitud_ml: v.longitudN,
        cara_frontal: caraFrontal,
        cara_trasera: caraTrasera,
        canto_superior: cantoSuperior,
        canto_inferior: cantoInferior,
        canto_izquierdo: cantoIzquierdo,
        canto_derecho: cantoDerecho,
        contabilizar_grosor: contabilizarGrosor,
        categoria_pieza_id: categoriaId,
        material_lacado_id: lacadoId || null,
        material_fondo_id: fondoId || null,
        factor_complejidad: factor,
        descuento_porcentaje: v.descN,
        procesos: v.procesosOrdenados.map((codigo, i) => ({
          proceso_codigo: codigo,
          orden: i + 1,
        })),
      })
      setPreview(resultado)
    } catch (e: any) {
      setErrorPreview(e?.message ?? 'Error calculando precio')
      setPreview(null)
    } finally {
      setCalculando(false)
    }
  }

  function submit() {
    const v = validarYConstruir()
    if (!v) return

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
      ancho: v.anchoN,
      alto: v.altoN,
      grosor: v.grosorN,
      longitud_ml: v.longitudN,
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
      descuento_porcentaje: v.descN,
      precio_aproximado: precioAproximado,
      procesos_codigos: v.procesosOrdenados,
      guardar_como_referencia: guardarComoRef,
      nombre_referencia: nombreRef.trim(),
      preview,
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

            {/* Categoría — selector visual con iconos y presets */}
            <div>
              <Label>Categoría de pieza *</Label>
              <p className="mb-1.5 text-[11px] text-slate-500">
                Al elegir una categoría, se pre-rellenan caras, modo de precio y procesos por defecto.
              </p>
              <SelectorCategoriaPieza
                categorias={categorias}
                categoriaSeleccionadaId={categoriaId || null}
                onSeleccionar={(cat) => {
                  setCategoriaId(cat.id)
                  // Aplicar preset de la categoría
                  if (cat.modo_precio_default === 'ml' || cat.modo_precio_default === 'pieza' || cat.modo_precio_default === 'm2') {
                    setModoPrecio(cat.modo_precio_default as 'm2' | 'pieza' | 'ml')
                  }
                  setContabilizarGrosor(cat.contabilizar_grosor_default ?? false)
                  // Caras según caras_default: 1 = solo frontal, 2 = frontal+trasera, 4 = + cantos laterales, 6 = todas
                  const n = cat.caras_default ?? 6
                  setCaraFrontal(n >= 1)
                  setCaraTrasera(n >= 2)
                  setCantoIzquierdo(n >= 4)
                  setCantoDerecho(n >= 4)
                  setCantoSuperior(n >= 6)
                  setCantoInferior(n >= 6)
                  // Procesos por defecto de la categoría
                  const procDefault = Array.isArray((cat as any).procesos_default) ? (cat as any).procesos_default : []
                  if (procDefault.length > 0) {
                    const codigos: string[] = procDefault
                      .map((p: any) => p?.proceso_codigo)
                      .filter(Boolean)
                    if (codigos.length > 0) setProcesosMarcados(new Set(codigos))
                  }
                }}
              />
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

            {/* Materiales — selector visual con muestras de color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Lacado (color)</Label>
                <SelectorMaterialColor
                  materiales={lacados}
                  valorId={lacadoId}
                  onSeleccionar={setLacadoId}
                  placeholder="Selecciona un color…"
                  etiqueta="lacado"
                />
              </div>
              <div>
                <Label>Fondo</Label>
                <SelectorMaterialColor
                  materiales={fondos}
                  valorId={fondoId}
                  onSeleccionar={setFondoId}
                  placeholder="Selecciona fondo…"
                  etiqueta="fondo"
                />
              </div>
            </div>

            {/* Procesos a aplicar */}
            <div className="space-y-2">
              <Label>Procesos a aplicar *</Label>
              <div className="border rounded p-3 bg-slate-50 space-y-1.5">
                {PROCESOS_ORDEN.map((codigo) => {
                  const def = getProcesoDefault(codigo)
                  if (!def) return null
                  const marcado = procesosMarcados.has(codigo)
                  const consumeLacado = def.tipo_material === 'lacado'
                  const consumeFondo  = def.tipo_material === 'fondo'
                  return (
                    <label
                      key={codigo}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1"
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(v) => {
                          setProcesosMarcados((prev) => {
                            const next = new Set(prev)
                            if (v) next.add(codigo)
                            else next.delete(codigo)
                            return next
                          })
                        }}
                      />
                      <span className="font-medium">{def.nombre}</span>
                      <span className="text-xs text-slate-500 font-mono ml-auto">
                        {def.tiempo_base_min} + {def.tiempo_por_m2_min}/m² min
                      </span>
                      {consumeLacado && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                          usa lacado
                        </span>
                      )}
                      {consumeFondo && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                          usa fondo
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              {/* Preview orden aplicado */}
              {procesosMarcados.size > 0 && (() => {
                const ordenados = PROCESOS_ORDEN.filter((c) => procesosMarcados.has(c))
                const totalBase = ordenados.reduce((a, c) => {
                  const d = getProcesoDefault(c)
                  return a + (d?.tiempo_base_min ?? 0)
                }, 0)
                const totalPorM2 = ordenados.reduce((a, c) => {
                  const d = getProcesoDefault(c)
                  return a + (d?.tiempo_por_m2_min ?? 0)
                }, 0)
                return (
                  <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2">
                    <div>
                      <span className="font-semibold">Orden aplicado:</span>{' '}
                      {ordenados
                        .map((c) => getProcesoDefault(c)?.nombre ?? c)
                        .join(' → ')}
                    </div>
                    <div className="mt-1 font-mono">
                      Tiempo estimado: {totalBase} min fijos + {totalPorM2} min/m²
                    </div>
                  </div>
                )
              })()}
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

        {/* Panel de preview — R6b Opción B botón Calcular precio */}
        {(preview || errorPreview) && (
          <div className="rounded-md border border-blue-300 bg-blue-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Calculator className="w-4 h-4" />
              Precio calculado (sin guardar)
            </div>
            {errorPreview ? (
              <p className="text-xs text-red-700">{errorPreview}</p>
            ) : preview ? (
              <div className="space-y-2 text-sm">
                {/* Totales grandes */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-white p-2 border">
                    <div className="text-xs text-slate-500">Precio unitario</div>
                    <div className="text-lg font-bold text-blue-700 font-mono">
                      {preview.precio_unitario.toFixed(2)} €
                    </div>
                  </div>
                  <div className="rounded bg-white p-2 border">
                    <div className="text-xs text-slate-500">
                      Precio total ({cantidad} {cantidad === 1 ? 'ud' : 'uds'})
                    </div>
                    <div className="text-lg font-bold text-blue-700 font-mono">
                      {preview.precio_total.toFixed(2)} €
                    </div>
                  </div>
                  <div className="rounded bg-white p-2 border">
                    <div className="text-xs text-slate-500">Tiempo total</div>
                    <div className="text-lg font-bold text-slate-800 font-mono">
                      {preview.tiempo_minutos_total.toFixed(0)} min
                    </div>
                  </div>
                </div>

                {/* Desglose por concepto */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1 border-t border-blue-200 mt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Superficie unitaria</span>
                    <span className="font-mono">{preview.superficie_unitaria_m2.toFixed(4)} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tiempo unitario</span>
                    <span className="font-mono">{preview.tiempo_minutos_unitario.toFixed(1)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Coste mano obra</span>
                    <span className="font-mono">{preview.coste_mano_obra_unitario.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Coste materiales</span>
                    <span className="font-mono">{preview.coste_materiales_unitario.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Coste unitario</span>
                    <span className="font-mono">{preview.coste_unitario.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Desglose materiales */}
                {(preview.detalle.kg_lacado > 0 ||
                  preview.detalle.kg_fondo > 0 ||
                  preview.detalle.kg_cata > 0 ||
                  preview.detalle.kg_dis > 0) && (
                  <details className="text-xs pt-1 border-t border-blue-200">
                    <summary className="cursor-pointer text-blue-700 hover:underline">
                      Ver consumo de materiales
                    </summary>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      {preview.detalle.kg_lacado > 0 && (
                        <div>
                          <div className="text-slate-500">Lacado</div>
                          <div className="font-mono">{preview.detalle.kg_lacado.toFixed(4)} kg</div>
                          <div className="font-mono text-slate-700">{preview.detalle.coste_lacado.toFixed(2)} €</div>
                        </div>
                      )}
                      {preview.detalle.kg_fondo > 0 && (
                        <div>
                          <div className="text-slate-500">Fondo</div>
                          <div className="font-mono">{preview.detalle.kg_fondo.toFixed(4)} kg</div>
                          <div className="font-mono text-slate-700">{preview.detalle.coste_fondo.toFixed(2)} €</div>
                        </div>
                      )}
                      {preview.detalle.kg_cata > 0 && (
                        <div>
                          <div className="text-slate-500">Catalizador</div>
                          <div className="font-mono">{preview.detalle.kg_cata.toFixed(4)} kg</div>
                          <div className="font-mono text-slate-700">{preview.detalle.coste_cata.toFixed(2)} €</div>
                        </div>
                      )}
                      {preview.detalle.kg_dis > 0 && (
                        <div>
                          <div className="text-slate-500">Disolvente</div>
                          <div className="font-mono">{preview.detalle.kg_dis.toFixed(4)} kg</div>
                          <div className="font-mono text-slate-700">{preview.detalle.coste_dis.toFixed(2)} €</div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ) : null}
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
            variant="outline"
            onClick={calcularPrecio}
            disabled={cargando || !!errorCarga || calculando}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {calculando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Calculando…
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Calcular precio
              </>
            )}
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
