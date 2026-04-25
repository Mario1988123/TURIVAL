'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listarClientes } from '@/lib/services'
import type { Cliente } from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  FileText,
  Plus,
  Search,
  Save,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Palette,
  PackageOpen,
  Download,
  UserPlus,
  Loader2,
  Lock,
  Info,
  Square,
  Minus,
  Shapes,
  RectangleHorizontal,
  Eye,
} from 'lucide-react'
import SelectorColorDialog, { type ColorItem } from './selector-color-dialog'
import NuevoClienteDialog from './nuevo-cliente-dialog'
import VisualizacionPiezaSVG from './visualizacion-pieza-svg'

// ============================================================================
// TIPOS
// ============================================================================

type Producto = {
  id: string
  nombre: string
  descripcion: string | null
}
type Tratamiento = { id: string; nombre: string }

type Tarifa = {
  id: string
  nombre: string
  producto_id: string | null
  modo_precio: 'm2' | 'pieza' | 'metro_lineal' | 'ambos' | 'todos'
  precio_m2: number | null
  precio_pieza: number | null
  precio_metro_lineal: number | null
  precio_minimo: number
  coste_adicional_color: number
  coste_adicional_tratamiento: number
  coste_adicional_embalaje: number
  activo: boolean
}

type NivelComplejidad = {
  id: number
  codigo: string
  nombre: string
  multiplicador: number
  orden: number
}

type PiezaGuardada = {
  id: string
  referencia_cliente: string | null
  nombre_pieza?: string | null
  descripcion: string | null
  producto_id: string | null
  dimensiones_habituales: any
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  acabado_texto?: string | null
  nivel_complejidad?: number | null
  precio_pactado?: number | null
}

type PresupuestoAnterior = {
  id: string
  numero: string
  fecha: string
  total: number
}

type TipoPieza = 'tablero' | 'frente' | 'moldura' | 'irregular'
type ModoPrecio = 'm2' | 'pieza' | 'metro_lineal'

type Linea = {
  _uid: string
  referencia_cliente_id: string | null
  descripcion: string
  producto_id: string | null
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  tipo_pieza: TipoPieza
  modo_precio: ModoPrecio
  cantidad: number
  ancho: number
  alto: number
  grosor: number
  longitud_ml: number
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  nivel_complejidad: number | null
  precio_pactado: number | null
  suplemento_manual: number
  superficie_m2: number
  precio_unitario: number
  total_linea: number
}

const uid = () => Math.random().toString(36).slice(2, 11)

// ============================================================================
// MOTOR DE CÁLCULO v4 (sin cambios respecto a v4.0)
// ============================================================================

function lineaVacia(): Linea {
  return {
    _uid: uid(),
    referencia_cliente_id: null,
    descripcion: '',
    producto_id: null,
    color_id: null,
    tratamiento_id: null,
    tarifa_id: null,
    tipo_pieza: 'tablero',
    modo_precio: 'm2',
    cantidad: 1,
    ancho: 0,
    alto: 0,
    grosor: 0,
    longitud_ml: 0,
    cara_frontal: true,
    cara_trasera: true,
    canto_superior: false,
    canto_inferior: false,
    canto_izquierdo: false,
    canto_derecho: false,
    nivel_complejidad: null,
    precio_pactado: null,
    suplemento_manual: 0,
    superficie_m2: 0,
    precio_unitario: 0,
    total_linea: 0,
  }
}

function calcularSuperficie(l: Linea): number {
  if (l.tipo_pieza === 'irregular' || l.tipo_pieza === 'moldura') return 0
  const a = (l.ancho || 0) / 1000
  const h = (l.alto || 0) / 1000
  const g = (l.grosor || 0) / 1000
  let sup = 0
  if (l.cara_frontal) sup += a * h
  if (l.cara_trasera) sup += a * h
  const contabilizarCantos = l.grosor > 19
  if (contabilizarCantos) {
    if (l.canto_superior) sup += a * g
    if (l.canto_inferior) sup += a * g
    if (l.canto_izquierdo) sup += h * g
    if (l.canto_derecho) sup += h * g
  }
  return Number((sup * (l.cantidad || 1)).toFixed(4))
}

function buscarTarifaCompatible(
  tarifas: Tarifa[],
  producto_id: string | null,
  tratamiento_id: string | null,
  tratamientos: Tratamiento[],
  modoLinea: ModoPrecio
): Tarifa | null {
  if (!producto_id) return null
  const candidatas = tarifas.filter(
    (t) => t.producto_id === producto_id && t.activo !== false
  )
  if (candidatas.length === 0) return null
  if (tratamiento_id) {
    const nombreTrat = tratamientos.find((t) => t.id === tratamiento_id)?.nombre
    if (nombreTrat) {
      const matchTrat = candidatas.find((t) =>
        (t.nombre || '').toLowerCase().includes(nombreTrat.toLowerCase())
      )
      if (matchTrat) return matchTrat
    }
  }
  const compatibles = candidatas.filter(
    (t) =>
      t.modo_precio === modoLinea ||
      t.modo_precio === 'ambos' ||
      t.modo_precio === 'todos'
  )
  if (compatibles.length > 0) return compatibles[0]
  return candidatas[0]
}

function recalcularLinea(
  l: Linea,
  tarifas: Tarifa[],
  niveles: NivelComplejidad[],
  colores: ColorItem[],
  tratamientos: Tratamiento[]
): Linea {
  const superficie_m2 = calcularSuperficie(l)

  if (l.tipo_pieza === 'irregular') {
    const precio = l.precio_pactado ?? 0
    const total = precio * (l.cantidad || 1) + (l.suplemento_manual || 0)
    return {
      ...l,
      superficie_m2: 0,
      precio_unitario: precio,
      total_linea: Number(total.toFixed(2)),
    }
  }

  if (l.precio_pactado !== null && l.precio_pactado > 0) {
    const total = l.precio_pactado * (l.cantidad || 1) + (l.suplemento_manual || 0)
    return {
      ...l,
      superficie_m2,
      precio_unitario: l.precio_pactado,
      total_linea: Number(total.toFixed(2)),
    }
  }

  const tarifaFijada = tarifas.find((t) => t.id === l.tarifa_id)
  const tarifa =
    tarifaFijada ??
    buscarTarifaCompatible(
      tarifas,
      l.producto_id,
      l.tratamiento_id,
      tratamientos,
      l.modo_precio
    )

  if (!tarifa) {
    return {
      ...l,
      superficie_m2,
      precio_unitario: 0,
      total_linea: l.suplemento_manual || 0,
    }
  }

  const nivel = niveles.find((n) => n.id === l.nivel_complejidad)
  const factor = nivel ? Number(nivel.multiplicador) : 1

  const sobrecosteColorTarifa = l.color_id
    ? Number(tarifa.coste_adicional_color || 0)
    : 0
  const sobrecosteTratamientoTarifa = l.tratamiento_id
    ? Number(tarifa.coste_adicional_tratamiento || 0)
    : 0
  const sobrecosteEmbalaje = Number(tarifa.coste_adicional_embalaje || 0)

  const color = colores.find((c) => c.id === l.color_id)
  const sobrecosteColorCatalogo = color ? Number(color.sobrecoste || 0) : 0

  let precioBase: number
  if (l.modo_precio === 'pieza') {
    precioBase = Number(tarifa.precio_pieza ?? 0)
  } else if (l.modo_precio === 'metro_lineal') {
    const precioML = Number(tarifa.precio_metro_lineal ?? 0)
    precioBase = precioML * (l.longitud_ml || 0)
  } else {
    const m2PorUnidad = superficie_m2 / Math.max(l.cantidad || 1, 1)
    const precioM2 = Number(tarifa.precio_m2 ?? 0)
    precioBase = precioM2 * m2PorUnidad
  }

  let precioUnidad =
    (precioBase +
      sobrecosteColorCatalogo +
      sobrecosteColorTarifa +
      sobrecosteTratamientoTarifa) *
      factor +
    sobrecosteEmbalaje

  const minimo = Number(tarifa.precio_minimo || 0)
  if (minimo > 0 && precioUnidad < minimo && precioUnidad > 0) precioUnidad = minimo

  const total = precioUnidad * (l.cantidad || 1) + (l.suplemento_manual || 0)

  return {
    ...l,
    tarifa_id: tarifa.id,
    superficie_m2,
    precio_unitario: Number(precioUnidad.toFixed(2)),
    total_linea: Number(total.toFixed(2)),
  }
}

const euro = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

const TIPOS_PIEZA_INFO: Record<
  TipoPieza,
  { icon: any; label: string; descripcion: string; modoSugerido: ModoPrecio }
> = {
  tablero: {
    icon: Square,
    label: 'Tablero',
    descripcion: '6 caras independientes',
    modoSugerido: 'm2',
  },
  frente: {
    icon: RectangleHorizontal,
    label: 'Frente/Puerta',
    descripcion: 'Plana con frontal + trasera',
    modoSugerido: 'm2',
  },
  moldura: {
    icon: Minus,
    label: 'Moldura',
    descripcion: 'Lineal (rodapié, tapeta)',
    modoSugerido: 'metro_lineal',
  },
  irregular: {
    icon: Shapes,
    label: 'Irregular',
    descripcion: 'Precio manual',
    modoSugerido: 'pieza',
  },
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function NuevoPresupuestoCliente() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [cargaError, setCargaError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<ColorItem[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [niveles, setNiveles] = useState<NivelComplejidad[]>([])

  async function cargarTodo() {
    setLoading(true)
    setCargaError(null)
    try {
      const resCli = await listarClientes({ limite: 5000, pagina: 0 })
      setClientes(resCli.clientes ?? [])
      const [prodRes, colRes, trRes, tarRes, nvRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
        // R2a: colores ahora viven en tabla `materiales` con tipo='lacado'.
        // Mapeamos el resultado a la forma ColorItem que espera este componente.
        supabase
          .from('materiales')
          .select('id, codigo, nombre, familia, hex_aproximado, activo')
          .eq('tipo', 'lacado')
          .eq('activo', true)
          .order('codigo', { ascending: true, nullsFirst: false })
          .range(0, 4999),
        supabase.from('tratamientos').select('id, nombre').order('nombre'),
        supabase.from('tarifas').select('*').eq('activo', true).range(0, 999),
        supabase
          .from('niveles_complejidad')
          .select('*')
          .eq('activo', true)
          .order('orden'),
      ])
      setProductos((prodRes.data ?? []) as Producto[])
      setColores(
        ((colRes.data ?? []) as any[]).map((m) => ({
          id:             m.id,
          codigo:         m.codigo ?? '',
          nombre:         m.nombre,
          tipo:           m.familia ?? 'referencia_interna',
          hex_aproximado: m.hex_aproximado,
          sobrecoste:     0, // deprecated R2a
          activo:         Boolean(m.activo),
        })) as ColorItem[]
      )
      setTratamientos((trRes.data ?? []) as Tratamiento[])
      setTarifas((tarRes.data ?? []) as Tarifa[])
      setNiveles((nvRes.data ?? []) as NivelComplejidad[])
    } catch (e: any) {
      console.error('[presupuesto] Error cargando datos:', e)
      setCargaError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [clienteId, setClienteId] = useState('')
  const [buscadorCliente, setBuscadorCliente] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [validezDias, setValidezDias] = useState(30)
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [obsComerciales, setObsComerciales] = useState('')
  const [obsInternas, setObsInternas] = useState('')
  const [descuentoPct, setDescuentoPct] = useState(0)
  const [ivaPct, setIvaPct] = useState(21)

  const [lineas, setLineas] = useState<Linea[]>([])
  const [lineaExpandida, setLineaExpandida] = useState<string | null>(null)
  const [selectorColorAbierto, setSelectorColorAbierto] = useState<string | null>(null)
  const [nuevoClienteAbierto, setNuevoClienteAbierto] = useState(false)
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null
  )

  const clienteActual = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clienteId, clientes]
  )

  const [piezas, setPiezas] = useState<PiezaGuardada[]>([])
  const [presupuestosAnteriores, setPresupuestosAnteriores] = useState<
    PresupuestoAnterior[]
  >([])
  const [cargandoPiezas, setCargandoPiezas] = useState(false)

  useEffect(() => {
    if (!clienteId) {
      setPiezas([])
      setPresupuestosAnteriores([])
      return
    }
    setCargandoPiezas(true)
    ;(async () => {
      const [piezasRes, presRes] = await Promise.all([
        supabase
          .from('referencias_cliente')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('referencia_cliente'),
        supabase
          .from('presupuestos')
          .select('id, numero, fecha, total')
          .eq('cliente_id', clienteId)
          .order('fecha', { ascending: false })
          .limit(20),
      ])
      setPiezas((piezasRes.data as PiezaGuardada[]) ?? [])
      setPresupuestosAnteriores(
        (presRes.data as PresupuestoAnterior[]) ?? []
      )
      setCargandoPiezas(false)
    })()
  }, [clienteId, supabase])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 5000)
    return () => clearTimeout(t)
  }, [mensaje])

  const clientesFiltrados = useMemo(() => {
    const q = buscadorCliente.trim().toLowerCase()
    if (!q) return clientes.slice(0, 50)
    return clientes
      .filter(
        (c) =>
          c.nombre_comercial.toLowerCase().includes(q) ||
          (c.razon_social || '').toLowerCase().includes(q) ||
          (c.cif_nif || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [buscadorCliente, clientes])

  function actualizarLinea(uidLinea: string, cambios: Partial<Linea>) {
    setLineas((prev) =>
      prev.map((l) =>
        l._uid === uidLinea
          ? recalcularLinea(
              { ...l, ...cambios },
              tarifas,
              niveles,
              colores,
              tratamientos
            )
          : l
      )
    )
  }

  function cambiarTipoPieza(uidLinea: string, nuevoTipo: TipoPieza) {
    setLineas((prev) =>
      prev.map((l) => {
        if (l._uid !== uidLinea) return l
        const info = TIPOS_PIEZA_INFO[nuevoTipo]
        const base: Linea = {
          ...l,
          tipo_pieza: nuevoTipo,
          modo_precio: info.modoSugerido,
          tarifa_id: null,
        }
        if (nuevoTipo === 'moldura') {
          base.cara_frontal = false
          base.cara_trasera = false
          base.canto_superior = false
          base.canto_inferior = false
          base.canto_izquierdo = false
          base.canto_derecho = false
        }
        if (nuevoTipo === 'tablero' || nuevoTipo === 'frente') {
          base.cara_frontal = true
          base.cara_trasera = true
        }
        return recalcularLinea(base, tarifas, niveles, colores, tratamientos)
      })
    )
  }

  function eliminarLinea(uidLinea: string) {
    setLineas((prev) => prev.filter((l) => l._uid !== uidLinea))
  }

  function duplicarLinea(uidLinea: string) {
    setLineas((prev) => {
      const orig = prev.find((l) => l._uid === uidLinea)
      if (!orig) return prev
      return [
        ...prev,
        recalcularLinea(
          { ...orig, _uid: uid() },
          tarifas,
          niveles,
          colores,
          tratamientos
        ),
      ]
    })
  }

  function anadirLineaManual() {
    const nivelMedio =
      niveles.find((n) => n.codigo === 'MEDIA') ??
      niveles[Math.floor(niveles.length / 2)] ??
      niveles[0]
    const nueva: Linea = {
      ...lineaVacia(),
      nivel_complejidad: nivelMedio?.id ?? null,
    }
    setLineas((prev) => [...prev, nueva])
    setLineaExpandida(nueva._uid)
  }

  function anadirLineaDesdePieza(p: PiezaGuardada) {
    const dims = p.dimensiones_habituales || {}
    const base: Linea = {
      ...lineaVacia(),
      referencia_cliente_id: p.id,
      descripcion:
        [
          p.nombre_pieza || p.referencia_cliente,
          p.referencia_cliente && p.nombre_pieza ? `(${p.referencia_cliente})` : '',
        ]
          .filter(Boolean)
          .join(' ') + (p.acabado_texto ? ` — ${p.acabado_texto}` : ''),
      producto_id: p.producto_id,
      color_id: p.color_id,
      tratamiento_id: p.tratamiento_id,
      tarifa_id: p.tarifa_id,
      ancho: Number(dims.ancho ?? 0),
      alto: Number(dims.alto ?? 0),
      grosor: Number(dims.grosor ?? 0),
      nivel_complejidad: p.nivel_complejidad ?? null,
      precio_pactado: p.precio_pactado ?? null,
      cantidad: 1,
    }
    setLineas((prev) => [
      ...prev,
      recalcularLinea(base, tarifas, niveles, colores, tratamientos),
    ])
  }

  async function importarDePresupuestoAnterior(presId: string) {
    const { data } = await supabase
      .from('lineas_presupuesto')
      .select('*')
      .eq('presupuesto_id', presId)
      .order('orden')
    if (!data) return
    const nuevas: Linea[] = data.map((la: any) =>
      recalcularLinea(
        {
          ...lineaVacia(),
          referencia_cliente_id: la.referencia_cliente_id,
          descripcion: la.descripcion ?? '',
          producto_id: la.producto_id,
          color_id: la.color_id,
          tratamiento_id: la.tratamiento_id,
          tarifa_id: la.tarifa_id,
          tipo_pieza: (la.tipo_pieza as TipoPieza) ?? 'tablero',
          modo_precio: (la.modo_precio as ModoPrecio) ?? 'm2',
          cantidad: la.cantidad ?? 1,
          ancho: Number(la.ancho ?? 0),
          alto: Number(la.alto ?? 0),
          grosor: Number(la.grosor ?? 0),
          longitud_ml: Number(la.longitud_ml ?? 0),
          cara_frontal: !!la.cara_frontal,
          cara_trasera: !!la.cara_trasera,
          canto_superior: !!la.canto_superior,
          canto_inferior: !!la.canto_inferior,
          canto_izquierdo: !!la.canto_izquierdo,
          canto_derecho: !!la.canto_derecho,
          nivel_complejidad: la.nivel_complejidad,
          precio_pactado: la.precio_unitario ?? null,
          suplemento_manual: Number(la.suplemento_manual ?? 0),
        },
        tarifas,
        niveles,
        colores,
        tratamientos
      )
    )
    setLineas((prev) => [...prev, ...nuevas])
  }

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((s, l) => s + (l.total_linea || 0), 0)
    const descuento_importe = subtotal * (descuentoPct / 100)
    const base_imponible = subtotal - descuento_importe
    const iva_importe = base_imponible * (ivaPct / 100)
    const total = base_imponible + iva_importe
    return {
      subtotal: Number(subtotal.toFixed(2)),
      descuento_importe: Number(descuento_importe.toFixed(2)),
      base_imponible: Number(base_imponible.toFixed(2)),
      iva_importe: Number(iva_importe.toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [lineas, descuentoPct, ivaPct])

  async function guardar() {
    setMensaje(null)
    if (!clienteId) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un cliente.' })
      return
    }
    if (lineas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Añade al menos una línea.' })
      return
    }
    if (lineas.some((l) => !l.descripcion.trim())) {
      setMensaje({ tipo: 'error', texto: 'Todas las líneas deben tener descripción.' })
      return
    }
    setGuardando(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa.')
      const { data: numeroData, error: errNum } = await supabase.rpc(
        'get_next_sequence',
        { tipo: 'presupuesto' }
      )
      if (errNum) throw errNum
      const numero = numeroData as string
      const { data: pres, error: errPres } = await supabase
        .from('presupuestos')
        .insert({
          numero,
          cliente_id: clienteId,
          fecha,
          estado: 'borrador',
          validez_dias: validezDias,
          fecha_entrega_estimada: fechaEntrega || null,
          observaciones_comerciales: obsComerciales || null,
          observaciones_internas: obsInternas || null,
          subtotal: totales.subtotal,
          descuento_porcentaje: descuentoPct,
          descuento_importe: totales.descuento_importe,
          base_imponible: totales.base_imponible,
          iva_porcentaje: ivaPct,
          iva_importe: totales.iva_importe,
          total: totales.total,
          user_id: session.user.id,
        })
        .select('id, numero')
        .single()
      if (errPres) throw errPres
      const filas = lineas.map((l, idx) => ({
        presupuesto_id: pres.id,
        orden: idx + 1,
        producto_id: l.producto_id,
        tarifa_id: l.tarifa_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        modo_precio: l.modo_precio,
        tipo_pieza: l.tipo_pieza,
        ancho: l.ancho,
        alto: l.alto,
        grosor: l.grosor,
        longitud_ml: l.tipo_pieza === 'moldura' ? l.longitud_ml : null,
        unidad: 'mm',
        cara_frontal: l.cara_frontal,
        cara_trasera: l.cara_trasera,
        canto_superior: l.canto_superior,
        canto_inferior: l.canto_inferior,
        canto_izquierdo: l.canto_izquierdo,
        canto_derecho: l.canto_derecho,
        superficie_m2: l.superficie_m2,
        precio_unitario: l.precio_unitario,
        color_id: l.color_id,
        tratamiento_id: l.tratamiento_id,
        suplemento_manual: l.suplemento_manual,
        total_linea: l.total_linea,
        referencia_cliente_id: l.referencia_cliente_id,
        nivel_complejidad: l.nivel_complejidad,
      }))
      const { error: errLin } = await supabase
        .from('lineas_presupuesto')
        .insert(filas)
      if (errLin) throw errLin
      router.push(`/presupuestos/${pres.id}`)
      router.refresh()
    } catch (e: any) {
      console.error('[presupuesto] Error guardando:', e)
      setMensaje({ tipo: 'error', texto: e.message ?? 'Error al guardar.' })
      setGuardando(false)
    }
  }

  function onClienteCreado(nuevo: Cliente) {
    setClientes((prev) => [nuevo, ...prev])
    setClienteId(nuevo.id)
    setBuscadorCliente('')
    setMensaje({
      tipo: 'ok',
      texto: `Cliente "${nuevo.nombre_comercial}" creado y seleccionado.`,
    })
  }

  function infoTarifaLinea(l: Linea): {
    tarifa: Tarifa | null
    precioRef: number
    modoRef: string
  } {
    const tarifa =
      tarifas.find((t) => t.id === l.tarifa_id) ??
      buscarTarifaCompatible(
        tarifas,
        l.producto_id,
        l.tratamiento_id,
        tratamientos,
        l.modo_precio
      )
    if (!tarifa) return { tarifa: null, precioRef: 0, modoRef: '' }
    let precioRef = 0
    let modoRef = ''
    if (l.modo_precio === 'pieza') {
      precioRef = Number(tarifa.precio_pieza || 0)
      modoRef = '€/pieza'
    } else if (l.modo_precio === 'metro_lineal') {
      precioRef = Number(tarifa.precio_metro_lineal || 0)
      modoRef = '€/m.l.'
    } else {
      precioRef = Number(tarifa.precio_m2 || 0)
      modoRef = '€/m²'
    }
    return { tarifa, precioRef, modoRef }
  }

  // Pieza de la línea para vista previa (modal)
  const lineaVistaPreviaActiva = useMemo(() => {
    if (!vistaPreviaAbierta) return null
    return lineas.find((l) => l._uid === vistaPreviaAbierta) ?? null
  }, [vistaPreviaAbierta, lineas])

  const colorVistaPreviaHex = useMemo(() => {
    if (!lineaVistaPreviaActiva) return null
    return colores.find((c) => c.id === lineaVistaPreviaActiva.color_id)
      ?.hex_aproximado ?? null
  }, [lineaVistaPreviaActiva, colores])

  // RENDER
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (cargaError) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            {cargaError}
            <Button variant="outline" size="sm" onClick={cargarTodo} className="ml-4">
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-8 h-8" />
              Nuevo presupuesto
            </h1>
            <p className="text-muted-foreground mt-1">
              Crea desde cero, desde piezas guardadas o importando uno anterior.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/presupuestos')}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || lineas.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        {mensaje && (
          <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{mensaje.texto}</AlertDescription>
          </Alert>
        )}

        {/* CLIENTE */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cliente</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNuevoClienteAbierto(true)}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Nuevo cliente
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!clienteActual ? (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    value={buscadorCliente}
                    onChange={(e) => setBuscadorCliente(e.target.value)}
                    placeholder={`Buscar entre ${clientes.length} clientes por nombre, CIF o email...`}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                  {clientesFiltrados.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {clientes.length === 0
                        ? 'No hay clientes todavía. Crea el primero.'
                        : 'No hay clientes que coincidan.'}
                    </div>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setClienteId(c.id)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                      >
                        <div className="font-medium">{c.nombre_comercial}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.cif_nif ?? '—'} · {c.email ?? 'sin email'} ·{' '}
                          {c.ciudad ?? '—'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between bg-slate-50 rounded-md p-4">
                <div className="space-y-0.5 text-sm">
                  <div className="font-semibold text-base">
                    {clienteActual.nombre_comercial}
                  </div>
                  <div className="text-muted-foreground">
                    CIF/NIF: {clienteActual.cif_nif ?? '—'}
                  </div>
                  <div className="text-muted-foreground">
                    {clienteActual.email ?? 'sin email'} ·{' '}
                    {clienteActual.telefono ?? 'sin teléfono'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClienteId('')
                    setBuscadorCliente('')
                  }}
                >
                  Cambiar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DATOS GENERALES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Validez (días)</Label>
              <Select
                value={String(validezDias)}
                onValueChange={(v) => setValidezDias(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="60">60 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha entrega estimada</Label>
              <Input
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Se recalcula con el simulador del Planificador al pulsar "Recomendar fecha".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* LÍNEAS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Líneas{' '}
                <span className="text-muted-foreground font-normal">
                  ({lineas.length})
                </span>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={anadirLineaManual}>
                  <Plus className="w-4 h-4 mr-1" />
                  Línea manual
                </Button>
                {presupuestosAnteriores.length > 0 && (
                  <Select
                    onValueChange={(id) => importarDePresupuestoAnterior(id)}
                    value=""
                  >
                    <SelectTrigger className="h-9 w-48">
                      <Download className="w-4 h-4 mr-1" />
                      <SelectValue placeholder="Importar de anterior" />
                    </SelectTrigger>
                    <SelectContent>
                      {presupuestosAnteriores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.numero} · {euro(Number(p.total))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lineas.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                Sin líneas aún. Pulsa "Línea manual" o añade piezas desde el panel
                derecho.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-20 text-right">Uds</TableHead>
                      <TableHead className="w-20 text-right">m²/m.l.</TableHead>
                      <TableHead className="w-24 text-right">€ unit.</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-28 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l) => {
                      const expandida = lineaExpandida === l._uid
                      const color = colores.find((c) => c.id === l.color_id)
                      const info = infoTarifaLinea(l)
                      const precioManual =
                        l.precio_pactado !== null && l.precio_pactado > 0
                      const tipoInfo = TIPOS_PIEZA_INFO[l.tipo_pieza]
                      const IconTipo = tipoInfo.icon
                      return (
                        <Fragment key={l._uid}>
                          {/* FILA RESUMEN */}
                          <TableRow className="align-top">
                            <TableCell>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 flex items-center gap-1 shrink-0"
                                >
                                  <IconTipo className="w-3 h-3" />
                                  {tipoInfo.label}
                                </Badge>
                                <Input
                                  value={l.descripcion}
                                  onChange={(e) =>
                                    actualizarLinea(l._uid, {
                                      descripcion: e.target.value,
                                    })
                                  }
                                  placeholder="Descripción..."
                                  className="h-8 flex-1 min-w-[140px]"
                                />
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>
                                  {productos.find((p) => p.id === l.producto_id)
                                    ?.nombre ?? 'sin producto'}
                                </span>
                                <span>·</span>
                                {color ? (
                                  <span className="flex items-center gap-1">
                                    <span
                                      className="w-3 h-3 rounded-sm border"
                                      style={{
                                        backgroundColor:
                                          color.hex_aproximado || '#DDD',
                                      }}
                                    />
                                    {color.codigo}
                                  </span>
                                ) : (
                                  <span>sin color</span>
                                )}
                                <span>·</span>
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {l.modo_precio === 'm2'
                                    ? 'por m²'
                                    : l.modo_precio === 'pieza'
                                    ? 'por pieza'
                                    : 'por m.l.'}
                                </Badge>
                                {precioManual && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] h-5 bg-amber-100 text-amber-900 border-amber-300"
                                  >
                                    <Lock className="w-2.5 h-2.5 mr-0.5" />
                                    Precio fijo
                                  </Badge>
                                )}
                                {info.tarifa && !precioManual && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 bg-green-50 text-green-800 border-green-300"
                                  >
                                    📋 {euro(info.precioRef)} {info.modoRef}
                                  </Badge>
                                )}
                                {!info.tarifa &&
                                  !precioManual &&
                                  l.producto_id &&
                                  l.tipo_pieza !== 'irregular' && (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] h-5"
                                    >
                                      ⚠ Sin tarifa
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={1}
                                value={l.cantidad}
                                onChange={(e) =>
                                  actualizarLinea(l._uid, {
                                    cantidad: Number(e.target.value),
                                  })
                                }
                                className="h-8 text-right w-16 ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {l.tipo_pieza === 'moldura'
                                ? `${l.longitud_ml.toFixed(2)} m`
                                : l.tipo_pieza === 'irregular'
                                ? '—'
                                : l.superficie_m2.toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {euro(l.precio_unitario)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {euro(l.total_linea)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setLineaExpandida(expandida ? null : l._uid)
                                  }
                                  title={expandida ? 'Contraer' : 'Expandir'}
                                >
                                  {expandida ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => duplicarLinea(l._uid)}
                                  title="Duplicar"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700"
                                  onClick={() => eliminarLinea(l._uid)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* FILA EXPANDIDA */}
                          {expandida && (
                            <TableRow className="bg-slate-50">
                              <TableCell colSpan={6} className="p-0">
                                <div className="p-5 space-y-6">

                                  {/* SECCIÓN 1: TIPO DE PIEZA */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <Label className="text-sm font-semibold">
                                        1. Tipo de pieza
                                      </Label>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setVistaPreviaAbierta(l._uid)}
                                        disabled={l.tipo_pieza === 'irregular'}
                                      >
                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                        Ver vista previa
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {(Object.keys(TIPOS_PIEZA_INFO) as TipoPieza[]).map(
                                        (t) => {
                                          const info = TIPOS_PIEZA_INFO[t]
                                          const Icon = info.icon
                                          const activo = l.tipo_pieza === t
                                          return (
                                            <button
                                              key={t}
                                              onClick={() =>
                                                cambiarTipoPieza(l._uid, t)
                                              }
                                              className={`p-3 border rounded-md text-xs flex flex-col items-center gap-1.5 transition ${
                                                activo
                                                  ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                                                  : 'bg-white hover:bg-slate-100'
                                              }`}
                                            >
                                              <Icon className="w-5 h-5" />
                                              <span className="font-semibold">
                                                {info.label}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                                                {info.descripcion}
                                              </span>
                                            </button>
                                          )
                                        }
                                      )}
                                    </div>
                                  </div>

                                  {/* SECCIÓN 2: PRODUCTO/COLOR/TRATAMIENTO/MODO */}
                                  <div>
                                    <Label className="text-sm font-semibold mb-2 block">
                                      2. Producto, color y modo
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Producto</Label>
                                        <Select
                                          value={l.producto_id ?? ''}
                                          onValueChange={(v) =>
                                            actualizarLinea(l._uid, {
                                              producto_id: v || null,
                                              tarifa_id: null,
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Seleccionar producto..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {productos.map((p) => (
                                              <SelectItem key={p.id} value={p.id}>
                                                {p.nombre}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Color</Label>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full h-9 justify-start font-normal"
                                          onClick={() =>
                                            setSelectorColorAbierto(l._uid)
                                          }
                                        >
                                          {color ? (
                                            <>
                                              <span
                                                className="w-4 h-4 rounded-sm border mr-2 shrink-0"
                                                style={{
                                                  backgroundColor:
                                                    color.hex_aproximado || '#DDD',
                                                }}
                                              />
                                              <span className="truncate">
                                                {color.codigo} · {color.nombre}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <Palette className="w-4 h-4 mr-2" />
                                              Elegir color...
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Tratamiento</Label>
                                        <Select
                                          value={l.tratamiento_id ?? ''}
                                          onValueChange={(v) =>
                                            actualizarLinea(l._uid, {
                                              tratamiento_id: v || null,
                                              tarifa_id: null,
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Seleccionar tratamiento..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {tratamientos.map((t) => (
                                              <SelectItem key={t.id} value={t.id}>
                                                {t.nombre}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Modo precio</Label>
                                        <Select
                                          value={l.modo_precio}
                                          onValueChange={(v: ModoPrecio) =>
                                            actualizarLinea(l._uid, {
                                              modo_precio: v,
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="m2">Por m²</SelectItem>
                                            <SelectItem value="pieza">
                                              Por pieza
                                            </SelectItem>
                                            <SelectItem value="metro_lineal">
                                              Por metro lineal
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* INFO TARIFA */}
                                  {info.tarifa && (
                                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs">
                                      <div className="flex items-start gap-2">
                                        <Info className="w-4 h-4 text-green-700 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                          <div className="font-semibold text-green-900">
                                            Tarifa aplicada: {info.tarifa.nombre}
                                          </div>
                                          <div className="mt-1 flex gap-3 flex-wrap text-green-900">
                                            <span>
                                              €/m²:{' '}
                                              <strong>
                                                {euro(Number(info.tarifa.precio_m2 || 0))}
                                              </strong>
                                            </span>
                                            <span>
                                              €/pieza:{' '}
                                              <strong>
                                                {euro(
                                                  Number(info.tarifa.precio_pieza || 0)
                                                )}
                                              </strong>
                                            </span>
                                            <span>
                                              €/m.l.:{' '}
                                              <strong>
                                                {euro(
                                                  Number(
                                                    info.tarifa.precio_metro_lineal || 0
                                                  )
                                                )}
                                              </strong>
                                            </span>
                                            <span>
                                              Mínimo:{' '}
                                              <strong>
                                                {euro(
                                                  Number(info.tarifa.precio_minimo || 0)
                                                )}
                                              </strong>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* SECCIÓN 3: DIMENSIONES */}
                                  {l.tipo_pieza === 'irregular' ? (
                                    <Alert>
                                      <AlertDescription className="text-xs">
                                        Esta pieza es irregular. Introduce directamente
                                        el precio en "Precio pactado" más abajo.
                                      </AlertDescription>
                                    </Alert>
                                  ) : l.tipo_pieza === 'moldura' ? (
                                    <div>
                                      <Label className="text-sm font-semibold mb-2 block">
                                        3. Dimensiones de la moldura
                                      </Label>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Longitud total (metros)
                                          </Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            className="h-9"
                                            value={l.longitud_ml}
                                            onChange={(e) =>
                                              actualizarLinea(l._uid, {
                                                longitud_ml: Number(e.target.value),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Ancho perfil (mm)
                                          </Label>
                                          <Input
                                            type="number"
                                            className="h-9"
                                            value={l.ancho}
                                            onChange={(e) =>
                                              actualizarLinea(l._uid, {
                                                ancho: Number(e.target.value),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Grosor perfil (mm)
                                          </Label>
                                          <Input
                                            type="number"
                                            className="h-9"
                                            value={l.grosor}
                                            onChange={(e) =>
                                              actualizarLinea(l._uid, {
                                                grosor: Number(e.target.value),
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <Label className="text-sm font-semibold mb-2 block">
                                          3. Dimensiones y complejidad
                                        </Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                          <div className="space-y-1">
                                            <Label className="text-xs">Ancho (mm)</Label>
                                            <Input
                                              type="number"
                                              className="h-9"
                                              value={l.ancho}
                                              onChange={(e) =>
                                                actualizarLinea(l._uid, {
                                                  ancho: Number(e.target.value),
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Alto (mm)</Label>
                                            <Input
                                              type="number"
                                              className="h-9"
                                              value={l.alto}
                                              onChange={(e) =>
                                                actualizarLinea(l._uid, {
                                                  alto: Number(e.target.value),
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">
                                              Grosor (mm)
                                            </Label>
                                            <Input
                                              type="number"
                                              className="h-9"
                                              value={l.grosor}
                                              onChange={(e) =>
                                                actualizarLinea(l._uid, {
                                                  grosor: Number(e.target.value),
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">
                                              Complejidad
                                            </Label>
                                            <Select
                                              value={
                                                l.nivel_complejidad !== null
                                                  ? String(l.nivel_complejidad)
                                                  : ''
                                              }
                                              onValueChange={(v) =>
                                                actualizarLinea(l._uid, {
                                                  nivel_complejidad: v
                                                    ? Number(v)
                                                    : null,
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue placeholder="—" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {niveles.map((n) => (
                                                  <SelectItem
                                                    key={n.id}
                                                    value={String(n.id)}
                                                  >
                                                    {n.nombre} (×
                                                    {Number(n.multiplicador)})
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      </div>

                                      {/* SECCIÓN 4: CARAS */}
                                      <div>
                                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                          <Label className="text-sm font-semibold">
                                            4. Caras a lacar
                                          </Label>
                                          {l.grosor > 0 && l.grosor <= 19 && (
                                            <span className="text-[11px] text-amber-700">
                                              ⚠ grosor ≤ 19mm: los cantos no suman m²
                                            </span>
                                          )}
                                          {l.grosor > 19 && (
                                            <span className="text-[11px] text-green-700">
                                              ✓ grosor &gt; 19mm: los cantos sí suman m²
                                            </span>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                                          {[
                                            { k: 'cara_frontal', lbl: 'Frontal' },
                                            { k: 'cara_trasera', lbl: 'Trasera' },
                                            { k: 'canto_superior', lbl: 'Canto sup.' },
                                            { k: 'canto_inferior', lbl: 'Canto inf.' },
                                            { k: 'canto_izquierdo', lbl: 'Canto izq.' },
                                            { k: 'canto_derecho', lbl: 'Canto der.' },
                                          ].map((cara) => {
                                            const activa = l[
                                              cara.k as keyof Linea
                                            ] as boolean
                                            return (
                                              <label
                                                key={cara.k}
                                                className={`flex items-center gap-2 text-xs cursor-pointer border rounded-md px-3 py-2 transition ${
                                                  activa
                                                    ? 'bg-green-50 border-green-300 text-green-900'
                                                    : 'bg-white hover:bg-slate-100'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={activa}
                                                  onChange={(e) =>
                                                    actualizarLinea(l._uid, {
                                                      [cara.k]: e.target.checked,
                                                    } as any)
                                                  }
                                                />
                                                <span className="font-medium">
                                                  {cara.lbl}
                                                </span>
                                              </label>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* SECCIÓN 5: PRECIO */}
                                  <div>
                                    <Label className="text-sm font-semibold mb-2 block">
                                      5. Precio manual y suplementos
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-1">
                                        <Label className="text-xs font-semibold flex items-center gap-1">
                                          <Lock className="w-3 h-3" />
                                          Precio pactado (€/ud)
                                        </Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          className="h-9 bg-white"
                                          value={l.precio_pactado ?? ''}
                                          onChange={(e) =>
                                            actualizarLinea(l._uid, {
                                              precio_pactado:
                                                e.target.value === ''
                                                  ? null
                                                  : Number(e.target.value),
                                            })
                                          }
                                          placeholder={
                                            l.tipo_pieza === 'irregular'
                                              ? 'Introduce el precio'
                                              : 'Deja vacío para calcular por tarifa'
                                          }
                                        />
                                        <p className="text-[11px] text-amber-900">
                                          {l.tipo_pieza === 'irregular'
                                            ? 'Obligatorio para piezas irregulares.'
                                            : 'Si lo rellenas, ignora la tarifa.'}
                                        </p>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          Suplemento manual (€ al total de la línea)
                                        </Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          className="h-9"
                                          value={l.suplemento_manual}
                                          onChange={(e) =>
                                            actualizarLinea(l._uid, {
                                              suplemento_manual: Number(e.target.value),
                                            })
                                          }
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                          Se suma al final. Útil para extras puntuales.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TOTALES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Descuento global (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IVA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={ivaPct}
                    onChange={(e) => setIvaPct(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1 text-sm bg-slate-50 rounded-md p-4">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{euro(totales.subtotal)}</span>
                </div>
                {descuentoPct > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">
                      Descuento ({descuentoPct}%)
                    </span>
                    <span className="font-medium text-red-600">
                      −{euro(totales.descuento_importe)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Base imponible</span>
                  <span className="font-medium">{euro(totales.base_imponible)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">IVA ({ivaPct}%)</span>
                  <span className="font-medium">{euro(totales.iva_importe)}</span>
                </div>
                <div className="flex justify-between py-2 border-t mt-2 text-lg">
                  <span className="font-bold">TOTAL</span>
                  <span className="font-bold text-blue-700">
                    {euro(totales.total)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OBSERVACIONES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Para el cliente (se imprime en el PDF)</Label>
              <Textarea
                rows={2}
                value={obsComerciales}
                onChange={(e) => setObsComerciales(e.target.value)}
                placeholder="Notas que verá el cliente..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Internas (solo uso interno)</Label>
              <Textarea
                rows={2}
                value={obsInternas}
                onChange={(e) => setObsInternas(e.target.value)}
                placeholder="Notas internas..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-6">
          <Button
            size="lg"
            onClick={guardar}
            disabled={guardando || lineas.length === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            {guardando ? 'Guardando...' : 'Guardar presupuesto'}
          </Button>
        </div>
      </div>

      {/* PANEL LATERAL: piezas guardadas */}
      <aside className="w-80 shrink-0 hidden lg:block">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageOpen className="w-4 h-4" />
              Piezas guardadas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {clienteActual
                ? `Referencias de ${clienteActual.nombre_comercial}`
                : 'Selecciona un cliente para ver sus piezas'}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {!clienteId && (
              <div className="text-center text-xs text-muted-foreground py-8">
                Sin cliente seleccionado.
              </div>
            )}
            {cargandoPiezas && (
              <div className="text-center text-xs text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                Cargando...
              </div>
            )}
            {!cargandoPiezas && clienteId && piezas.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-md">
                Este cliente aún no tiene piezas guardadas.
              </div>
            )}
            {piezas.map((p) => {
              const dims = p.dimensiones_habituales || {}
              return (
                <div
                  key={p.id}
                  className="border rounded-md p-3 hover:border-blue-400 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {p.nombre_pieza || p.referencia_cliente || 'Sin nombre'}
                      </div>
                      {p.referencia_cliente && p.nombre_pieza && (
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {p.referencia_cliente}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {(dims.ancho || dims.alto) && (
                          <div>
                            {dims.ancho ?? '?'} × {dims.alto ?? '?'} mm
                          </div>
                        )}
                        {p.acabado_texto && (
                          <div className="truncate">{p.acabado_texto}</div>
                        )}
                        {p.precio_pactado != null && (
                          <div className="font-medium text-blue-700">
                            {euro(Number(p.precio_pactado))}/ud
                          </div>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => anadirLineaDesdePieza(p)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </aside>

      {/* Modal selector color */}
      <SelectorColorDialog
        abierto={selectorColorAbierto !== null}
        onCerrar={() => setSelectorColorAbierto(null)}
        colores={colores}
        colorSeleccionadoId={
          selectorColorAbierto
            ? lineas.find((l) => l._uid === selectorColorAbierto)?.color_id ?? null
            : null
        }
        onSeleccionar={(c) => {
          if (!selectorColorAbierto) return
          actualizarLinea(selectorColorAbierto, { color_id: c?.id ?? null })
        }}
      />

      {/* Modal nuevo cliente */}
      <NuevoClienteDialog
        abierto={nuevoClienteAbierto}
        onCerrar={() => setNuevoClienteAbierto(false)}
        onCreado={onClienteCreado}
      />

      {/* Modal vista previa SVG (ocupa bastante espacio para verlo bien) */}
      <Dialog
        open={vistaPreviaAbierta !== null}
        onOpenChange={(open) => !open && setVistaPreviaAbierta(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista previa de la pieza</DialogTitle>
            <DialogDescription>
              Caras <span className="text-green-700 font-medium">verdes</span> =
              se lacan. Caras <span className="text-slate-500 font-medium">grises</span>{' '}
              = sin lacar.
            </DialogDescription>
          </DialogHeader>
          {lineaVistaPreviaActiva && (
            <div className="py-2">
              <VisualizacionPiezaSVG
                datos={{
                  tipo_pieza: lineaVistaPreviaActiva.tipo_pieza,
                  ancho: lineaVistaPreviaActiva.ancho,
                  alto: lineaVistaPreviaActiva.alto,
                  grosor: lineaVistaPreviaActiva.grosor,
                  longitud_ml: lineaVistaPreviaActiva.longitud_ml,
                  cara_frontal: lineaVistaPreviaActiva.cara_frontal,
                  cara_trasera: lineaVistaPreviaActiva.cara_trasera,
                  canto_superior: lineaVistaPreviaActiva.canto_superior,
                  canto_inferior: lineaVistaPreviaActiva.canto_inferior,
                  canto_izquierdo: lineaVistaPreviaActiva.canto_izquierdo,
                  canto_derecho: lineaVistaPreviaActiva.canto_derecho,
                  color_hex: colorVistaPreviaHex,
                }}
              />
              <div className="mt-4 text-xs text-muted-foreground bg-slate-50 rounded-md p-3 space-y-1">
                <div>
                  <strong>Tipo:</strong>{' '}
                  {TIPOS_PIEZA_INFO[lineaVistaPreviaActiva.tipo_pieza].label}
                </div>
                {lineaVistaPreviaActiva.tipo_pieza === 'moldura' ? (
                  <div>
                    <strong>Longitud:</strong>{' '}
                    {lineaVistaPreviaActiva.longitud_ml.toFixed(2)} m ·
                    <strong> Perfil:</strong> {lineaVistaPreviaActiva.ancho} ×{' '}
                    {lineaVistaPreviaActiva.grosor} mm
                  </div>
                ) : (
                  <div>
                    <strong>Dimensiones:</strong> {lineaVistaPreviaActiva.ancho} ×{' '}
                    {lineaVistaPreviaActiva.alto} × {lineaVistaPreviaActiva.grosor} mm
                  </div>
                )}
                <div>
                  <strong>Superficie a lacar:</strong>{' '}
                  {lineaVistaPreviaActiva.superficie_m2.toFixed(3)} m²
                  {lineaVistaPreviaActiva.cantidad > 1 &&
                    ` (× ${lineaVistaPreviaActiva.cantidad} uds)`}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
