"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  calcularLinea,
  calcularPresupuesto,
  crearPresupuesto,
  obtenerSiguienteNumero,
} from "@/lib/services/presupuestos"

// ============================================================================
// TIPOS LOCALES (la forma exacta que necesita la pantalla)
// ============================================================================

type Cliente = {
  id: string
  nombre: string
  cif: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
}

type Producto = { id: string; nombre: string; descripcion: string | null }
type Color = {
  id: string
  codigo: string | null
  nombre: string
  familia: string | null
  ral: string | null
}
type Tratamiento = { id: string; nombre: string; descripcion: string | null }
type Tarifa = {
  id: string
  nombre: string
  producto_id: string | null
  color_id: string | null
  tratamiento_id: string | null
  precio_base: number | null
  precio_m2: number | null
  precio_minimo: number | null
  suplemento: number | null
}

type PiezaGuardada = {
  id: string
  referencia_cliente: string | null
  nombre_pieza: string
  descripcion: string | null
  producto_id: string | null
  dimensiones_habituales: {
    ancho?: number
    alto?: number
    grosor?: number
  } | null
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  acabado_texto: string | null
  nivel_complejidad: string | null
  precio_pactado: number | null
  superficie_m2_habitual: number | null
  observaciones: string | null
}

type PresupuestoAnterior = {
  id: string
  numero: string
  fecha: string
  total: number
}

type Linea = {
  _uid: string // id temporal frontend
  referencia_cliente_id: string | null
  descripcion: string
  producto_id: string | null
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  ancho: number
  alto: number
  grosor: number
  caras: number // 1=solo frontal, 2=ambas caras, etc
  cantidad: number
  nivel_complejidad: "bajo" | "medio" | "alto"
  precio_pactado: number | null // si viene de pieza guardada con precio C fijo
  descuento_pct: number
  // calculados
  superficie_m2: number
  precio_unitario: number
  subtotal: number
}

// ============================================================================
// UTILIDADES
// ============================================================================

const uid = () => Math.random().toString(36).slice(2, 11)

const FACTOR_COMPLEJIDAD: Record<Linea["nivel_complejidad"], number> = {
  bajo: 1,
  medio: 1.2,
  alto: 1.5,
}

function lineaVacia(): Linea {
  return {
    _uid: uid(),
    referencia_cliente_id: null,
    descripcion: "",
    producto_id: null,
    color_id: null,
    tratamiento_id: null,
    tarifa_id: null,
    ancho: 0,
    alto: 0,
    grosor: 0,
    caras: 2,
    cantidad: 1,
    nivel_complejidad: "medio",
    precio_pactado: null,
    descuento_pct: 0,
    superficie_m2: 0,
    precio_unitario: 0,
    subtotal: 0,
  }
}

// Calcula superficie en m² (ancho y alto en mm → m²) multiplicado por caras y cantidad
function calcularSuperficieLinea(l: Linea): number {
  const m2Unitario = ((l.ancho || 0) / 1000) * ((l.alto || 0) / 1000) * (l.caras || 1)
  return Number((m2Unitario * (l.cantidad || 1)).toFixed(4))
}

// Busca tarifa automática según producto + color + tratamiento
function buscarTarifaAutomatica(
  tarifas: Tarifa[],
  producto_id: string | null,
  color_id: string | null,
  tratamiento_id: string | null
): Tarifa | null {
  if (!producto_id) return null
  return (
    tarifas.find(
      (t) =>
        t.producto_id === producto_id &&
        (t.color_id === color_id || t.color_id === null) &&
        (t.tratamiento_id === tratamiento_id || t.tratamiento_id === null)
    ) ?? null
  )
}

// Calcula precio unitario y subtotal de una línea
function recalcularLinea(l: Linea, tarifas: Tarifa[]): Linea {
  const superficie_m2 = calcularSuperficieLinea(l)

  // Si hay precio pactado (viene de pieza guardada), se respeta
  if (l.precio_pactado !== null && l.precio_pactado > 0) {
    const subtotalSinDto = l.precio_pactado * (l.cantidad || 1)
    const subtotal = subtotalSinDto * (1 - (l.descuento_pct || 0) / 100)
    return {
      ...l,
      superficie_m2,
      precio_unitario: l.precio_pactado,
      subtotal: Number(subtotal.toFixed(2)),
    }
  }

  // Cálculo automático por tarifa
  const tarifa =
    tarifas.find((t) => t.id === l.tarifa_id) ??
    buscarTarifaAutomatica(tarifas, l.producto_id, l.color_id, l.tratamiento_id)

  if (!tarifa) {
    return { ...l, superficie_m2, precio_unitario: 0, subtotal: 0 }
  }

  const base = Number(tarifa.precio_base ?? 0)
  const precioM2 = Number(tarifa.precio_m2 ?? 0)
  const minimo = Number(tarifa.precio_minimo ?? 0)
  const suplemento = Number(tarifa.suplemento ?? 0)
  const factor = FACTOR_COMPLEJIDAD[l.nivel_complejidad]

  const m2PorUnidad = superficie_m2 / Math.max(l.cantidad || 1, 1)
  let precioUnidad = (base + precioM2 * m2PorUnidad) * factor + suplemento
  if (minimo > 0 && precioUnidad < minimo) precioUnidad = minimo

  const subtotalSinDto = precioUnidad * (l.cantidad || 1)
  const subtotal = subtotalSinDto * (1 - (l.descuento_pct || 0) / 100)

  return {
    ...l,
    tarifa_id: tarifa.id,
    superficie_m2,
    precio_unitario: Number(precioUnidad.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function NuevoPresupuestoCliente({
  clientes,
  productos,
  colores,
  tratamientos,
  tarifas,
}: {
  clientes: Cliente[]
  productos: Producto[]
  colores: Color[]
  tratamientos: Tratamiento[]
  tarifas: Tarifa[]
}) {
  const router = useRouter()
  const supabase = createClient()

  // --- estado general del presupuesto ---
  const [clienteId, setClienteId] = useState<string>("")
  const [buscadorCliente, setBuscadorCliente] = useState("")
  const [fecha, setFecha] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [validezDias, setValidezDias] = useState<number>(30)
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState<string>("")
  const [observaciones, setObservaciones] = useState("")
  const [ivaPct] = useState<number>(21)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lineaExpandida, setLineaExpandida] = useState<string | null>(null)

  // --- líneas ---
  const [lineas, setLineas] = useState<Linea[]>([])

  // --- datos del cliente seleccionado ---
  const clienteActual = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clienteId, clientes]
  )

  // --- piezas guardadas del cliente (panel derecho) ---
  const [piezasGuardadas, setPiezasGuardadas] = useState<PiezaGuardada[]>([])
  const [cargandoPiezas, setCargandoPiezas] = useState(false)

  // --- presupuestos anteriores del cliente (para importar) ---
  const [presupuestosAnteriores, setPresupuestosAnteriores] = useState<
    PresupuestoAnterior[]
  >([])
  const [mostrarImportar, setMostrarImportar] = useState(false)

  // Cargar piezas y presupuestos cuando cambia el cliente
  useEffect(() => {
    if (!clienteId) {
      setPiezasGuardadas([])
      setPresupuestosAnteriores([])
      return
    }
    setCargandoPiezas(true)
    ;(async () => {
      const [piezasRes, presRes] = await Promise.all([
        supabase
          .from("referencias_cliente")
          .select("*")
          .eq("cliente_id", clienteId)
          .eq("activo", true)
          .order("nombre_pieza"),
        supabase
          .from("presupuestos")
          .select("id, numero, fecha, total")
          .eq("cliente_id", clienteId)
          .order("fecha", { ascending: false })
          .limit(20),
      ])
      setPiezasGuardadas((piezasRes.data as PiezaGuardada[]) ?? [])
      setPresupuestosAnteriores(
        (presRes.data as PresupuestoAnterior[]) ?? []
      )
      setCargandoPiezas(false)
    })()
  }, [clienteId, supabase])

  // Clientes filtrados por buscador
  const clientesFiltrados = useMemo(() => {
    const q = buscadorCliente.trim().toLowerCase()
    if (!q) return clientes.slice(0, 50)
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.cif ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [buscadorCliente, clientes])

  // =====================================================
  // ACCIONES SOBRE LÍNEAS
  // =====================================================

  function actualizarLinea(uidLinea: string, cambios: Partial<Linea>) {
    setLineas((prev) =>
      prev.map((l) => {
        if (l._uid !== uidLinea) return l
        const mezclada = { ...l, ...cambios }
        return recalcularLinea(mezclada, tarifas)
      })
    )
  }

  function eliminarLinea(uidLinea: string) {
    setLineas((prev) => prev.filter((l) => l._uid !== uidLinea))
  }

  function duplicarLinea(uidLinea: string) {
    setLineas((prev) => {
      const original = prev.find((l) => l._uid === uidLinea)
      if (!original) return prev
      const copia = recalcularLinea({ ...original, _uid: uid() }, tarifas)
      return [...prev, copia]
    })
  }

  function anadirLineaManual() {
    const nueva = lineaVacia()
    setLineas((prev) => [...prev, nueva])
    setLineaExpandida(nueva._uid)
  }

  function anadirLineaDesdePieza(p: PiezaGuardada) {
    const producto = productos.find((x) => x.id === p.producto_id)
    const nivel =
      (p.nivel_complejidad as Linea["nivel_complejidad"]) ?? "medio"
    const base: Linea = {
      ...lineaVacia(),
      referencia_cliente_id: p.id,
      descripcion:
        [p.nombre_pieza, p.referencia_cliente ? `(${p.referencia_cliente})` : ""]
          .filter(Boolean)
          .join(" ") +
        (p.acabado_texto ? ` — ${p.acabado_texto}` : ""),
      producto_id: p.producto_id,
      color_id: p.color_id,
      tratamiento_id: p.tratamiento_id,
      tarifa_id: p.tarifa_id,
      ancho: p.dimensiones_habituales?.ancho ?? 0,
      alto: p.dimensiones_habituales?.alto ?? 0,
      grosor: p.dimensiones_habituales?.grosor ?? 0,
      nivel_complejidad: nivel,
      precio_pactado: p.precio_pactado,
      cantidad: 1,
    }
    setLineas((prev) => [...prev, recalcularLinea(base, tarifas)])
  }

  async function importarDePresupuestoAnterior(presId: string) {
    const { data: lineasAnt } = await supabase
      .from("lineas_presupuesto")
      .select("*")
      .eq("presupuesto_id", presId)

    if (!lineasAnt || lineasAnt.length === 0) return

    const nuevas: Linea[] = lineasAnt.map((la: any) =>
      recalcularLinea(
        {
          ...lineaVacia(),
          referencia_cliente_id: la.referencia_cliente_id ?? null,
          descripcion: la.descripcion ?? "",
          producto_id: la.producto_id ?? null,
          color_id: la.color_id ?? null,
          tratamiento_id: la.tratamiento_id ?? null,
          tarifa_id: la.tarifa_id ?? null,
          ancho: la.ancho ?? 0,
          alto: la.alto ?? 0,
          grosor: la.grosor ?? 0,
          caras: la.caras ?? 2,
          cantidad: la.cantidad ?? 1,
          nivel_complejidad: (la.nivel_complejidad as any) ?? "medio",
          precio_pactado: la.precio_pactado ?? null,
          descuento_pct: Number(la.descuento_pct ?? 0),
        },
        tarifas
      )
    )
    setLineas((prev) => [...prev, ...nuevas])
    setMostrarImportar(false)
  }

  // =====================================================
  // TOTALES
  // =====================================================

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((s, l) => s + (l.subtotal || 0), 0)
    const iva = subtotal * (ivaPct / 100)
    const total = subtotal + iva
    return {
      subtotal: Number(subtotal.toFixed(2)),
      iva: Number(iva.toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [lineas, ivaPct])

  // =====================================================
  // GUARDAR
  // =====================================================

  async function guardar() {
    setError(null)
    if (!clienteId) {
      setError("Selecciona un cliente.")
      return
    }
    if (lineas.length === 0) {
      setError("Añade al menos una línea al presupuesto.")
      return
    }
    if (lineas.some((l) => !l.descripcion.trim())) {
      setError("Todas las líneas deben tener descripción.")
      return
    }

    setGuardando(true)
    try {
      // 1. Generar número con la función BD
      const { data: numeroData, error: errNum } = await supabase.rpc(
        "get_next_sequence",
        { tipo: "presupuesto" }
      )
      if (errNum) throw errNum
      const numero = numeroData as string

      // 2. Insertar cabecera
      const fechaValidez = new Date(fecha)
      fechaValidez.setDate(fechaValidez.getDate() + Number(validezDias))

      const { data: pres, error: errPres } = await supabase
        .from("presupuestos")
        .insert({
          numero,
          cliente_id: clienteId,
          fecha,
          fecha_validez: fechaValidez.toISOString().slice(0, 10),
          fecha_entrega_estimada: fechaEntregaEstimada || null,
          estado: "borrador",
          subtotal: totales.subtotal,
          iva: totales.iva,
          iva_pct: ivaPct,
          total: totales.total,
          observaciones: observaciones || null,
        })
        .select("id, numero")
        .single()

      if (errPres) throw errPres

      // 3. Insertar líneas
      const filas = lineas.map((l, idx) => ({
        presupuesto_id: pres.id,
        orden: idx + 1,
        referencia_cliente_id: l.referencia_cliente_id,
        descripcion: l.descripcion,
        producto_id: l.producto_id,
        color_id: l.color_id,
        tratamiento_id: l.tratamiento_id,
        tarifa_id: l.tarifa_id,
        ancho: l.ancho,
        alto: l.alto,
        grosor: l.grosor,
        caras: l.caras,
        cantidad: l.cantidad,
        nivel_complejidad: l.nivel_complejidad,
        precio_pactado: l.precio_pactado,
        superficie_m2: l.superficie_m2,
        precio_unitario: l.precio_unitario,
        descuento_pct: l.descuento_pct,
        subtotal: l.subtotal,
      }))

      const { error: errLin } = await supabase
        .from("lineas_presupuesto")
        .insert(filas)
      if (errLin) throw errLin

      // 4. Redirigir al detalle (cuando exista) o al listado
      router.push(`/dashboard/presupuestos`)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      setError(e.message ?? "Error al guardar el presupuesto")
    } finally {
      setGuardando(false)
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* ========== COLUMNA IZQUIERDA: formulario ========== */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cabecera */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Nuevo presupuesto</h1>
              <p className="text-sm text-gray-500 mt-1">
                Crea un presupuesto desde cero, desde piezas guardadas o
                importando uno anterior.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/dashboard/presupuestos")}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || lineas.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
              >
                {guardando ? "Guardando..." : "Guardar presupuesto"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ========== BLOQUE CLIENTE ========== */}
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Cliente</h2>
            {!clienteActual ? (
              <>
                <input
                  type="text"
                  value={buscadorCliente}
                  onChange={(e) => setBuscadorCliente(e.target.value)}
                  placeholder="Buscar por nombre, CIF o email..."
                  className="w-full px-3 py-2 border rounded-lg mb-3"
                />
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setClienteId(c.id)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                    >
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-xs text-gray-500">
                        {c.cif ?? "—"} · {c.email ?? "sin email"}
                      </div>
                    </button>
                  ))}
                  {clientesFiltrados.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-gray-500">
                      Sin resultados.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-base">
                    {clienteActual.nombre}
                  </div>
                  <div className="text-gray-600">
                    CIF: {clienteActual.cif ?? "—"}
                  </div>
                  <div className="text-gray-600">
                    {clienteActual.email ?? "sin email"} ·{" "}
                    {clienteActual.telefono ?? "sin teléfono"}
                  </div>
                  {clienteActual.direccion && (
                    <div className="text-gray-600">
                      {clienteActual.direccion}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setClienteId("")
                    setBuscadorCliente("")
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* ========== BLOQUE DATOS GENERALES ========== */}
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-4">
              Datos generales
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Validez (días)
                </label>
                <select
                  value={validezDias}
                  onChange={(e) => setValidezDias(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={15}>15 días</option>
                  <option value={30}>30 días</option>
                  <option value={60}>60 días</option>
                  <option value={90}>90 días</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha entrega estimada
                </label>
                <input
                  type="date"
                  value={fechaEntregaEstimada}
                  onChange={(e) => setFechaEntregaEstimada(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Provisional. Se recalcula con Gantt (módulo 6).
                </p>
              </div>
            </div>
          </div>

          {/* ========== BLOQUE LÍNEAS ========== */}
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Líneas ({lineas.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={anadirLineaManual}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  + Línea manual
                </button>
                <button
                  onClick={() => setMostrarImportar((v) => !v)}
                  disabled={!clienteId || presupuestosAnteriores.length === 0}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  ⤵ Importar de anterior
                </button>
              </div>
            </div>

            {/* Selector de presupuesto anterior */}
            {mostrarImportar && (
              <div className="bg-gray-50 border rounded-lg p-3 mb-4">
                <div className="text-xs font-medium text-gray-600 mb-2">
                  Selecciona un presupuesto para importar sus líneas:
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {presupuestosAnteriores.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => importarDePresupuestoAnterior(p.id)}
                      className="text-left px-3 py-2 bg-white border rounded text-sm hover:bg-blue-50"
                    >
                      <div className="font-mono text-xs">{p.numero}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.fecha).toLocaleDateString("es-ES")} ·{" "}
                        {Number(p.total).toLocaleString("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla líneas */}
            {lineas.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 border-2 border-dashed rounded-lg">
                Sin líneas aún. Añade piezas desde el panel derecho o pulsa
                "Línea manual".
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">
                        Descripción
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-16">
                        Uds
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">
                        m²
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">
                        € unit.
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">
                        Dto %
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">
                        Subtotal
                      </th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => {
                      const expandida = lineaExpandida === l._uid
                      return (
                        <>
                          <tr
                            key={l._uid}
                            className="border-b hover:bg-gray-50 align-top"
                          >
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={l.descripcion}
                                onChange={(e) =>
                                  actualizarLinea(l._uid, {
                                    descripcion: e.target.value,
                                  })
                                }
                                placeholder="Descripción..."
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                <span>
                                  {productos.find(
                                    (p) => p.id === l.producto_id
                                  )?.nombre ?? "sin producto"}
                                </span>
                                <span>·</span>
                                <span>
                                  {colores.find((c) => c.id === l.color_id)
                                    ?.nombre ?? "sin color"}
                                </span>
                                <span>·</span>
                                <span>
                                  {tratamientos.find(
                                    (t) => t.id === l.tratamiento_id
                                  )?.nombre ?? "sin tratamiento"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={1}
                                value={l.cantidad}
                                onChange={(e) =>
                                  actualizarLinea(l._uid, {
                                    cantidad: Number(e.target.value),
                                  })
                                }
                                className="w-14 px-2 py-1 border rounded text-right text-sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-600">
                              {l.superficie_m2.toFixed(3)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-700">
                              {l.precio_unitario.toLocaleString("es-ES", {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={l.descuento_pct}
                                onChange={(e) =>
                                  actualizarLinea(l._uid, {
                                    descuento_pct: Number(e.target.value),
                                  })
                                }
                                className="w-14 px-2 py-1 border rounded text-right text-sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {l.subtotal.toLocaleString("es-ES", {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() =>
                                    setLineaExpandida(
                                      expandida ? null : l._uid
                                    )
                                  }
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  title="Editar detalle"
                                >
                                  {expandida ? "▲" : "▼"}
                                </button>
                                <button
                                  onClick={() => duplicarLinea(l._uid)}
                                  className="text-xs text-gray-500 hover:text-gray-800"
                                  title="Duplicar"
                                >
                                  ⧉
                                </button>
                                <button
                                  onClick={() => eliminarLinea(l._uid)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                  title="Eliminar"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Fila expandida con detalle */}
                          {expandida && (
                            <tr className="bg-gray-50 border-b">
                              <td colSpan={7} className="px-3 py-4">
                                <div className="grid grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Producto
                                    </label>
                                    <select
                                      value={l.producto_id ?? ""}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          producto_id:
                                            e.target.value || null,
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="">—</option>
                                      {productos.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Color
                                    </label>
                                    <select
                                      value={l.color_id ?? ""}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          color_id: e.target.value || null,
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="">—</option>
                                      {colores.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.nombre}
                                          {c.ral ? ` (${c.ral})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Tratamiento
                                    </label>
                                    <select
                                      value={l.tratamiento_id ?? ""}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          tratamiento_id:
                                            e.target.value || null,
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="">—</option>
                                      {tratamientos.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Tarifa (manual)
                                    </label>
                                    <select
                                      value={l.tarifa_id ?? ""}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          tarifa_id: e.target.value || null,
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="">Automática</option>
                                      {tarifas.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Ancho (mm)
                                    </label>
                                    <input
                                      type="number"
                                      value={l.ancho}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          ancho: Number(e.target.value),
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Alto (mm)
                                    </label>
                                    <input
                                      type="number"
                                      value={l.alto}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          alto: Number(e.target.value),
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Grosor (mm)
                                    </label>
                                    <input
                                      type="number"
                                      value={l.grosor}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          grosor: Number(e.target.value),
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Caras a lacar
                                    </label>
                                    <select
                                      value={l.caras}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          caras: Number(e.target.value),
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value={1}>1 cara</option>
                                      <option value={2}>2 caras</option>
                                      <option value={4}>
                                        2 caras + cantos
                                      </option>
                                      <option value={6}>Todas (6)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Complejidad
                                    </label>
                                    <select
                                      value={l.nivel_complejidad}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          nivel_complejidad: e.target
                                            .value as Linea["nivel_complejidad"],
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="bajo">Baja (×1.0)</option>
                                      <option value="medio">
                                        Media (×1.2)
                                      </option>
                                      <option value="alto">Alta (×1.5)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                                      Precio pactado (€/ud)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={l.precio_pactado ?? ""}
                                      onChange={(e) =>
                                        actualizarLinea(l._uid, {
                                          precio_pactado:
                                            e.target.value === ""
                                              ? null
                                              : Number(e.target.value),
                                        })
                                      }
                                      placeholder="Auto por tarifa"
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========== BLOQUE TOTALES ========== */}
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Totales</h2>
            <div className="space-y-2 max-w-sm ml-auto text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  {totales.subtotal.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">IVA ({ivaPct}%)</span>
                <span className="font-medium">
                  {totales.iva.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2 mt-2">
                <span className="font-semibold">TOTAL</span>
                <span className="font-bold text-blue-700">
                  {totales.total.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* ========== BLOQUE OBSERVACIONES ========== */}
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Observaciones</h2>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Notas internas o comentarios para el cliente..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Botón guardar inferior */}
          <div className="flex justify-end pb-8">
            <button
              onClick={guardar}
              disabled={guardando || lineas.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
            >
              {guardando ? "Guardando..." : "Guardar presupuesto"}
            </button>
          </div>
        </div>
      </div>

      {/* ========== COLUMNA DERECHA: panel piezas guardadas ========== */}
      <aside className="w-96 border-l bg-gray-50 overflow-y-auto">
        <div className="p-4 sticky top-0 bg-gray-50 border-b z-10">
          <h3 className="font-semibold text-gray-800">Piezas guardadas</h3>
          <p className="text-xs text-gray-500 mt-1">
            {clienteActual
              ? `Referencias de ${clienteActual.nombre}`
              : "Selecciona un cliente para ver sus piezas"}
          </p>
        </div>

        <div className="p-4 space-y-2">
          {!clienteId && (
            <div className="text-center text-xs text-gray-400 py-8">
              Sin cliente seleccionado.
            </div>
          )}
          {cargandoPiezas && (
            <div className="text-center text-xs text-gray-400 py-4">
              Cargando...
            </div>
          )}
          {!cargandoPiezas &&
            clienteId &&
            piezasGuardadas.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8 border-2 border-dashed rounded-lg">
                Este cliente aún no tiene piezas guardadas.
              </div>
            )}
          {piezasGuardadas.map((p) => (
            <div
              key={p.id}
              className="bg-white border rounded-lg p-3 hover:border-blue-400 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {p.nombre_pieza}
                  </div>
                  {p.referencia_cliente && (
                    <div className="text-xs text-gray-500 font-mono">
                      {p.referencia_cliente}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {p.dimensiones_habituales && (
                      <div>
                        {p.dimensiones_habituales.ancho ?? "?"} ×{" "}
                        {p.dimensiones_habituales.alto ?? "?"} mm
                      </div>
                    )}
                    {p.acabado_texto && (
                      <div className="truncate">{p.acabado_texto}</div>
                    )}
                    {p.precio_pactado !== null && (
                      <div className="font-medium text-blue-700">
                        {Number(p.precio_pactado).toLocaleString("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        })}{" "}
                        /ud
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => anadirLineaDesdePieza(p)}
                  className="ml-2 shrink-0 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                >
                  + Añadir
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
