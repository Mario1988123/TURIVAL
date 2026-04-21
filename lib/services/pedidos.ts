// lib/services/pedidos.ts
/**
 * Service de PEDIDOS — Capa 4 TURIVAL
 *
 * Responsabilidades:
 *  1. listarPedidos              — listado de cabeceras para la página /pedidos
 *  2. obtenerPedido              — detalle completo para /pedidos/[id]
 *  3. calcularCantidadPendiente  — cuánto queda por pedir de una línea de presupuesto
 *  4. convertirPresupuestoAPedido— crea pedido en estado 'borrador' con líneas parciales
 *  5. confirmarPedido            — genera piezas, asigna ubicación y crea tareas 'pendiente'
 *                                  + auto-asigna candidatos según rol del proceso (Capa 5)
 *  6. moverPieza                 — cambia ubicación y registra movimiento en histórico
 *  7. arrancarProduccion         — pedido 'confirmado' → 'en_produccion', tareas → 'en_cola'
 *  8. cancelarPedido             — revierte cantidades, marca piezas/tareas como canceladas/anuladas
 *
 * IMPORTANTE: toda la lógica compleja vive aquí (TS), nunca en PL/pgSQL
 * (bug conocido del SQL Editor de Supabase con DECLARE + JOINs).
 *
 * Supabase REST no tiene transacciones cross-tabla. Si una operación
 * multi-paso (p.ej. confirmarPedido) falla a mitad, los datos intermedios
 * quedan en BD. Es un riesgo aceptado para MVP dado que los pasos son
 * cortos y el usuario puede reintentar desde donde quedó.
 */

import { createClient } from '@/lib/supabase/server'

// =============================================================
// TIPOS
// =============================================================

export type EstadoPedido =
  | 'borrador'
  | 'confirmado'
  | 'en_produccion'
  | 'completado'
  | 'entregado'
  | 'facturado'
  | 'cancelado'

export type PrioridadPedido = 'baja' | 'normal' | 'alta' | 'urgente'

export type EstadoPieza =
  | 'sin_producir'
  | 'en_produccion'
  | 'completada'
  | 'en_almacen'
  | 'entregada'
  | 'incidencia'
  | 'cancelada'

export type EstadoTarea =
  | 'pendiente'
  | 'en_cola'
  | 'en_progreso'
  | 'en_secado'
  | 'completada'
  | 'incidencia'
  | 'anulada'

export interface LineaSeleccion {
  /** ID de la línea de presupuesto origen */
  lineaPresupuestoId: string
  /** Cantidad a pedir (puede ser < cantidad original del presupuesto) */
  cantidad: number
}

export interface ConvertirPresupuestoInput {
  presupuestoId: string
  /** Líneas seleccionadas del presupuesto con sus cantidades parciales */
  lineas: LineaSeleccion[]
  fechaEntregaEstimada?: string | null
  prioridad?: PrioridadPedido
  observacionesComerciales?: string | null
  observacionesInternas?: string | null
  direccionEntrega?: string | null
  contactoEntrega?: string | null
  telefonoEntrega?: string | null
}

export interface ConfirmarPedidoInput {
  pedidoId: string
  /** Ubicación física donde se dejan TODAS las piezas al confirmar */
  ubicacionId: string
}

export interface CantidadDisponible {
  cantidadOriginal: number
  cantidadPedida: number
  cantidadPendiente: number
}

// =============================================================
// HELPERS INTERNOS
// =============================================================

async function getSupabase() {
  return createClient()
}

async function getUserIdOrThrow(): Promise<string> {
  const supabase = await getSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user.id
}

async function siguienteNumero(tipo: 'PED' | 'PIE'): Promise<string> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('generar_numero_secuencial', {
    p_tipo: tipo,
  })
  if (error) throw new Error(`Error generando número ${tipo}: ${error.message}`)
  if (!data) throw new Error(`No se pudo generar número ${tipo}`)
  return data as string
}

function factorComplejidadPorNivel(
  nivel: number | null | undefined,
  pp: {
    factor_simple?: number | null
    factor_media?: number | null
    factor_compleja?: number | null
  }
): number {
  if (nivel === 1) return pp.factor_simple ?? 0.8
  if (nivel === 3) return pp.factor_compleja ?? 1.3
  return pp.factor_media ?? 1.0
}

function calcularTiempoTarea(
  pp: {
    tiempo_base_minutos?: number | null
    tiempo_por_m2_minutos?: number | null
    factor_simple?: number | null
    factor_media?: number | null
    factor_compleja?: number | null
  },
  pc: { escala_por_m2?: boolean | null },
  superficieM2: number | null,
  nivelComplejidad: number | null
): number {
  const base = pp.tiempo_base_minutos ?? 0
  const porM2 = pc.escala_por_m2
    ? (superficieM2 ?? 0) * (pp.tiempo_por_m2_minutos ?? 0)
    : 0
  const factor = factorComplejidadPorNivel(nivelComplejidad ?? 2, pp)
  return Number(((base + porM2) * factor).toFixed(2))
}

/** Devuelve los IDs de todas las piezas de un pedido (evita joins complejos) */
async function getPiezaIdsDePedido(pedidoId: string): Promise<string[]> {
  const supabase = await getSupabase()
  const { data: lineas, error: e1 } = await supabase
    .from('lineas_pedido')
    .select('id')
    .eq('pedido_id', pedidoId)
  if (e1) throw e1
  const lineaIds = (lineas ?? []).map((l: any) => l.id)
  if (lineaIds.length === 0) return []
  const { data: piezas, error: e2 } = await supabase
    .from('piezas')
    .select('id')
    .in('linea_pedido_id', lineaIds)
  if (e2) throw e2
  return (piezas ?? []).map((p: any) => p.id)
}

// =============================================================
// 1. LISTAR PEDIDOS
// =============================================================

export async function listarPedidos() {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      `
      id, numero, fecha_creacion, fecha_entrega_estimada,
      estado, prioridad, subtotal, total,
      cliente:clientes(id, nombre_comercial),
      presupuesto_origen:presupuestos(id, numero)
    `
    )
    .order('fecha_creacion', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// =============================================================
// 2. OBTENER PEDIDO COMPLETO
// =============================================================

export async function obtenerPedido(pedidoId: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      `
      *,
      cliente:clientes(*),
      presupuesto_origen:presupuestos(id, numero, fecha),
      lineas:lineas_pedido(
        *,
        producto:productos(id, nombre),
        tarifa:tarifas(id, nombre),
        color:colores(id, nombre),
        tratamiento:tratamientos(id, nombre),
        piezas:piezas(
          id, numero, estado, ubicacion_id, fecha_prevista_fabricacion,
          ubicacion:ubicaciones(id, codigo, nombre, tipo)
        )
      )
    `
    )
    .eq('id', pedidoId)
    .single()
  if (error) throw error
  return data
}

// =============================================================
// 3. CALCULAR CANTIDAD PENDIENTE DE UNA LÍNEA DE PRESUPUESTO
// =============================================================

/**
 * cantidad_pendiente = cantidad_original_linea
 *                       - Σ cantidad_lineas_pedido_que_apuntan_a_ella
 *                         (excluyendo pedidos en estado 'cancelado')
 */
export async function calcularCantidadPendiente(
  lineaPresupuestoId: string
): Promise<CantidadDisponible> {
  const supabase = await getSupabase()

  const { data: linea, error: errLinea } = await supabase
    .from('lineas_presupuesto')
    .select('cantidad')
    .eq('id', lineaPresupuestoId)
    .single()
  if (errLinea) throw errLinea
  const cantidadOriginal = Number((linea as any)?.cantidad ?? 0)

  // Dos queries para no depender del parser de joins embebidos
  const { data: lineasPed, error: errLP } = await supabase
    .from('lineas_pedido')
    .select('cantidad, pedido_id')
    .eq('linea_presupuesto_origen_id', lineaPresupuestoId)
  if (errLP) throw errLP

  const lineasList = (lineasPed ?? []) as Array<{
    cantidad: number | null
    pedido_id: string
  }>

  if (lineasList.length === 0) {
    return {
      cantidadOriginal,
      cantidadPedida: 0,
      cantidadPendiente: cantidadOriginal,
    }
  }

  const pedidoIds = [...new Set(lineasList.map((l) => l.pedido_id))]
  const { data: pedidos, error: errPed } = await supabase
    .from('pedidos')
    .select('id, estado')
    .in('id', pedidoIds)
  if (errPed) throw errPed

  const noCanceladosIds = new Set(
    ((pedidos ?? []) as Array<{ id: string; estado: string }>)
      .filter((p) => p.estado !== 'cancelado')
      .map((p) => p.id)
  )

  const cantidadPedida = lineasList
    .filter((l) => noCanceladosIds.has(l.pedido_id))
    .reduce((sum, l) => sum + Number(l.cantidad ?? 0), 0)

  return {
    cantidadOriginal,
    cantidadPedida,
    cantidadPendiente: cantidadOriginal - cantidadPedida,
  }
}

// =============================================================
// 4. CONVERTIR PRESUPUESTO → PEDIDO (en 'borrador')
// =============================================================

export async function convertirPresupuestoAPedido(
  input: ConvertirPresupuestoInput
) {
  const supabase = await getSupabase()
  const userId = await getUserIdOrThrow()

  if (!input.lineas || input.lineas.length === 0) {
    throw new Error('Debes seleccionar al menos una línea del presupuesto')
  }

  // 1. Cargar presupuesto + sus líneas
  const { data: presupuesto, error: errP } = await supabase
    .from('presupuestos')
    .select(
      `
      *,
      lineas:lineas_presupuesto(*)
    `
    )
    .eq('id', input.presupuestoId)
    .single()
  if (errP) throw errP
  if (!presupuesto) throw new Error('Presupuesto no encontrado')

  const lineasPresMap = new Map<string, any>(
    ((presupuesto as any).lineas ?? []).map((l: any) => [l.id, l])
  )

  // 2. Validar cada selección: la línea pertenece al presupuesto
  //    y la cantidad no supera lo pendiente
  for (const sel of input.lineas) {
    if (sel.cantidad <= 0) {
      throw new Error('La cantidad de cada línea debe ser mayor que 0')
    }
    if (!lineasPresMap.has(sel.lineaPresupuestoId)) {
      throw new Error(
        `Línea ${sel.lineaPresupuestoId} no pertenece al presupuesto ${input.presupuestoId}`
      )
    }
    const disp = await calcularCantidadPendiente(sel.lineaPresupuestoId)
    if (sel.cantidad > disp.cantidadPendiente) {
      throw new Error(
        `Línea ${sel.lineaPresupuestoId}: pides ${sel.cantidad} pero solo quedan ${disp.cantidadPendiente} pendientes`
      )
    }
  }

  // 3. Construir líneas del pedido (copia de lineas_presupuesto con cantidad ajustada)
  type LineaNueva = {
    cantidad: number
    precio_unitario: number
    total_linea: number
    src: any
  }

  const lineasNuevas: LineaNueva[] = input.lineas.map((sel) => {
    const src: any = lineasPresMap.get(sel.lineaPresupuestoId)!
    const precioUnitario = Number(src.precio_unitario ?? 0)
    return {
      cantidad: sel.cantidad,
      precio_unitario: precioUnitario,
      total_linea: Number((precioUnitario * sel.cantidad).toFixed(2)),
      src,
    }
  })

  // 4. Totales del pedido (hereda % descuento e % iva del presupuesto)
  const subtotal = Number(
    lineasNuevas.reduce((s, l) => s + l.total_linea, 0).toFixed(2)
  )
  const descuentoPct = Number((presupuesto as any).descuento_porcentaje ?? 0)
  const descuentoImp = Number(((subtotal * descuentoPct) / 100).toFixed(2))
  const baseImponible = Number((subtotal - descuentoImp).toFixed(2))
  const ivaPct = Number((presupuesto as any).iva_porcentaje ?? 21)
  const ivaImporte = Number(((baseImponible * ivaPct) / 100).toFixed(2))
  const total = Number((baseImponible + ivaImporte).toFixed(2))

  // 5. Numero de pedido
  const numero = await siguienteNumero('PED')

  // 6. Insert cabecera
  const { data: pedidoNuevo, error: errPed } = await supabase
    .from('pedidos')
    .insert({
      numero,
      cliente_id: (presupuesto as any).cliente_id,
      presupuesto_origen_id: (presupuesto as any).id,
      fecha_entrega_estimada: input.fechaEntregaEstimada ?? null,
      estado: 'borrador',
      prioridad: input.prioridad ?? 'normal',
      subtotal,
      descuento_porcentaje: descuentoPct,
      descuento_importe: descuentoImp,
      base_imponible: baseImponible,
      iva_porcentaje: ivaPct,
      iva_importe: ivaImporte,
      total,
      observaciones_comerciales:
        input.observacionesComerciales ??
        (presupuesto as any).observaciones_comerciales ??
        null,
      observaciones_internas:
        input.observacionesInternas ??
        (presupuesto as any).observaciones_internas ??
        null,
      direccion_entrega: input.direccionEntrega ?? null,
      contacto_entrega: input.contactoEntrega ?? null,
      telefono_entrega: input.telefonoEntrega ?? null,
      user_id: userId,
    })
    .select()
    .single()
  if (errPed) throw errPed

  // 7. Insert líneas del pedido
  const payloadLineas = lineasNuevas.map((l) => ({
    pedido_id: (pedidoNuevo as any).id,
    linea_presupuesto_origen_id: l.src.id,
    producto_id: l.src.producto_id,
    tarifa_id: l.src.tarifa_id,
    referencia_cliente_id: l.src.referencia_cliente_id,
    acabado_id: l.src.acabado_id,
    acabado_texto: l.src.acabado_texto,
    descripcion: l.src.descripcion,
    orden: l.src.orden,
    notas: l.src.notas,
    nivel_complejidad: l.src.nivel_complejidad ?? 2,
    color_id: l.src.color_id,
    tratamiento_id: l.src.tratamiento_id,
    tipo_pieza: l.src.tipo_pieza,
    modo_precio: l.src.modo_precio,
    unidad: l.src.unidad,
    cantidad: l.cantidad,
    ancho: l.src.ancho,
    alto: l.src.alto,
    grosor: l.src.grosor,
    longitud_ml: l.src.longitud_ml,
    superficie_m2: l.src.superficie_m2,
    cara_frontal: l.src.cara_frontal,
    cara_trasera: l.src.cara_trasera,
    canto_superior: l.src.canto_superior,
    canto_inferior: l.src.canto_inferior,
    canto_izquierdo: l.src.canto_izquierdo,
    canto_derecho: l.src.canto_derecho,
    precio_unitario: l.precio_unitario,
    precio_m2: l.src.precio_m2,
    precio_pieza: l.src.precio_pieza,
    precio_minimo: l.src.precio_minimo,
    suplemento_manual: l.src.suplemento_manual,
    suplemento_descripcion: l.src.suplemento_descripcion,
    total_linea: l.total_linea,
    tiempo_estimado: l.src.tiempo_estimado,
    extras: l.src.extras,
    material_disponible: false,
  }))

  const { error: errLP2 } = await supabase
    .from('lineas_pedido')
    .insert(payloadLineas)
  if (errLP2) {
    // Rollback manual: borrar la cabecera recién creada para dejar BD consistente
    await supabase.from('pedidos').delete().eq('id', (pedidoNuevo as any).id)
    throw errLP2
  }

  return pedidoNuevo
}

// =============================================================
// 5. CONFIRMAR PEDIDO → piezas + ubicación + tareas + candidatos
// =============================================================

export async function confirmarPedido(input: ConfirmarPedidoInput) {
  const supabase = await getSupabase()
  const userId = await getUserIdOrThrow()

  // 1. Cargar pedido + líneas necesarias
  const { data: pedido, error: errP } = await supabase
    .from('pedidos')
    .select(
      `
      id, estado,
      lineas:lineas_pedido(
        id, producto_id, cantidad, nivel_complejidad,
        color_id, tratamiento_id, tipo_pieza,
        ancho, alto, grosor, longitud_ml, superficie_m2,
        material_disponible, fecha_llegada_material
      )
    `
    )
    .eq('id', input.pedidoId)
    .single()
  if (errP) throw errP
  if (!pedido) throw new Error('Pedido no encontrado')
  if ((pedido as any).estado !== 'borrador') {
    throw new Error(
      `No se puede confirmar un pedido en estado "${(pedido as any).estado}"`
    )
  }

  // 2. Validar ubicación
  const { data: ubic, error: errU } = await supabase
    .from('ubicaciones')
    .select('id, activo')
    .eq('id', input.ubicacionId)
    .single()
  if (errU) throw errU
  if (!ubic || !(ubic as any).activo) {
    throw new Error('La ubicación seleccionada no está activa')
  }

  const lineas: any[] = (pedido as any).lineas ?? []
  if (lineas.length === 0) {
    throw new Error('El pedido no tiene líneas para confirmar')
  }

  const ahora = new Date().toISOString()

  // 3. Construir payload de piezas (una fila por cada unidad de cada línea)
  const payloadPiezas: any[] = []
  for (const linea of lineas) {
    const n = Math.max(1, Number(linea.cantidad ?? 1))
    for (let i = 0; i < n; i++) {
      const numeroPieza = await siguienteNumero('PIE')
      payloadPiezas.push({
        numero: numeroPieza,
        linea_pedido_id: linea.id,
        ubicacion_id: input.ubicacionId,
        estado: 'sin_producir',
        color_id: linea.color_id,
        tratamiento_id: linea.tratamiento_id,
        tipo_pieza: linea.tipo_pieza,
        ancho: linea.ancho,
        alto: linea.alto,
        grosor: linea.grosor,
        longitud_ml: linea.longitud_ml,
        superficie_m2: linea.superficie_m2,
        fecha_confirmacion: ahora,
        material_disponible: linea.material_disponible ?? false,
        fecha_llegada_material: linea.fecha_llegada_material ?? null,
      })
    }
  }

  const { data: piezasCreadas, error: errPi } = await supabase
    .from('piezas')
    .insert(payloadPiezas)
    .select('id, linea_pedido_id, numero')
  if (errPi) throw errPi
  if (!piezasCreadas) throw new Error('No se pudieron crear las piezas')

  // 3 bis. Rellenar qr_codigo de cada pieza con su propio número
  //        (para trazabilidad: QR y Code128 leen el mismo valor PIE-YYYY-NNNN)
  const piezasArr = piezasCreadas as Array<{
    id: string
    linea_pedido_id: string
    numero: string
  }>
  for (const p of piezasArr) {
    await supabase
      .from('piezas')
      .update({ qr_codigo: p.numero })
      .eq('id', p.id)
  }

  // 4. Registrar primer movimiento de cada pieza (origen null → destino ubicacion)
  const movsPayload = piezasArr.map((p) => ({
    pieza_id: p.id,
    fecha: ahora,
    ubicacion_origen_id: null,
    ubicacion_destino_id: input.ubicacionId,
    user_id: userId,
    motivo: 'Creación inicial al confirmar pedido',
  }))
  const { error: errMov } = await supabase
    .from('movimientos_pieza')
    .insert(movsPayload)
  if (errMov) throw errMov

  // 5. Generar tareas de producción para cada pieza
  //    Carga una sola vez procesos_producto de todos los productos implicados
  const lineasPorId = new Map<string, any>(lineas.map((l) => [l.id, l]))
  const productosIds = [
    ...new Set(lineas.map((l) => l.producto_id).filter(Boolean)),
  ]

  let procesos: any[] = []
  if (productosIds.length > 0) {
    const { data: procs, error: errProcs } = await supabase
      .from('procesos_producto')
      .select(
        `
        id, producto_id, proceso_id, secuencia,
        tiempo_base_minutos, tiempo_por_m2_minutos,
        factor_simple, factor_media, factor_compleja,
        es_opcional, depende_de_secuencia, activo,
        proceso:procesos_catalogo(id, codigo, escala_por_m2, activo, rol_operario_requerido)
      `
      )
      .in('producto_id', productosIds)
      .eq('activo', true)
      .order('secuencia', { ascending: true })
    if (errProcs) throw errProcs
    procesos = procs ?? []
  }

  const procesosPorProducto = new Map<string, any[]>()
  for (const p of procesos) {
    if (!procesosPorProducto.has(p.producto_id)) {
      procesosPorProducto.set(p.producto_id, [])
    }
    procesosPorProducto.get(p.producto_id)!.push(p)
  }

  // Mapa proceso_id → rol_operario_requerido (para auto-asignación posterior)
  const rolPorProcesoId = new Map<string, string | null>()
  for (const p of procesos) {
    const pc = Array.isArray(p.proceso) ? p.proceso[0] : p.proceso
    rolPorProcesoId.set(p.proceso_id, pc?.rol_operario_requerido ?? null)
  }

  const tareasPayload: any[] = []
  for (const pieza of piezasArr) {
    const linea = lineasPorId.get(pieza.linea_pedido_id)
    if (!linea || !linea.producto_id) continue
    const procs = procesosPorProducto.get(linea.producto_id) ?? []
    for (const pp of procs) {
      const pc = Array.isArray(pp.proceso) ? pp.proceso[0] : (pp.proceso ?? {})
      if (pc?.activo === false) continue
      const tiempoEst = calcularTiempoTarea(
        pp,
        pc,
        linea.superficie_m2 ?? 0,
        linea.nivel_complejidad ?? 2
      )
      tareasPayload.push({
        pieza_id: pieza.id,
        proceso_id: pp.proceso_id,
        secuencia: pp.secuencia,
        es_opcional: pp.es_opcional ?? false,
        depende_de_secuencia: pp.depende_de_secuencia ?? null,
        estado: 'pendiente',
        tiempo_estimado_minutos: tiempoEst,
      })
    }
  }

  // Insertar tareas y recoger las IDs creadas (necesarias para candidatos)
  let tareasCreadasArr: Array<{ id: string; proceso_id: string }> = []
  if (tareasPayload.length > 0) {
    const { data: tareasIns, error: errT } = await supabase
      .from('tareas_produccion')
      .insert(tareasPayload)
      .select('id, proceso_id')
    if (errT) throw errT
    tareasCreadasArr = (tareasIns ?? []) as typeof tareasCreadasArr
  }

  // 5.5. AUTO-ASIGNAR CANDIDATOS según rol_operario_requerido del proceso
  //      Regla: si hay operarios activos con ese rol, se insertan TODOS como
  //      candidatos (cualquiera puede cogerla). Si no hay ninguno con el rol
  //      requerido, la tarea queda sin candidatos → queda "abierta" para
  //      que cualquiera la coja desde el panel.
  //      Si falla, se loguea pero NO rompe la confirmación.
  let candidatosCreados = 0
  try {
    if (tareasCreadasArr.length > 0) {
      // Recolectar roles únicos que necesitan candidatos
      const rolesNecesarios = new Set<string>()
      for (const t of tareasCreadasArr) {
        const rol = rolPorProcesoId.get(t.proceso_id)
        if (rol) rolesNecesarios.add(rol)
      }

      if (rolesNecesarios.size > 0) {
        // Una sola query para traer todos los operarios activos de esos roles
        const { data: operarios } = await supabase
          .from('operarios')
          .select('id, rol')
          .eq('activo', true)
          .in('rol', Array.from(rolesNecesarios))

        const operariosPorRol = new Map<string, string[]>()
        for (const o of (operarios ?? []) as Array<{ id: string; rol: string }>) {
          if (!operariosPorRol.has(o.rol)) operariosPorRol.set(o.rol, [])
          operariosPorRol.get(o.rol)!.push(o.id)
        }

        // Construir payload de candidatos
        const candidatosPayload: Array<{
          tarea_id: string
          operario_id: string
        }> = []
        for (const t of tareasCreadasArr) {
          const rol = rolPorProcesoId.get(t.proceso_id)
          if (!rol) continue
          const ops = operariosPorRol.get(rol) ?? []
          for (const opId of ops) {
            candidatosPayload.push({
              tarea_id: t.id,
              operario_id: opId,
            })
          }
        }

        if (candidatosPayload.length > 0) {
          const { error: errCand } = await supabase
            .from('operarios_tareas_candidatos')
            .insert(candidatosPayload)
          if (errCand) {
            console.error(
              '[confirmarPedido] Auto-asignación de candidatos falló:',
              errCand.message
            )
          } else {
            candidatosCreados = candidatosPayload.length
          }
        }
      }
    }
  } catch (e: any) {
    console.error(
      '[confirmarPedido] Error no crítico al asignar candidatos:',
      e?.message ?? e
    )
  }

  // 6. Pedido → 'confirmado'
  const { data: pedidoConfirmado, error: errUpd } = await supabase
    .from('pedidos')
    .update({ estado: 'confirmado' })
    .eq('id', input.pedidoId)
    .select()
    .single()
  if (errUpd) throw errUpd

  return {
    pedido: pedidoConfirmado,
    piezasCreadas: piezasArr.length,
    tareasCreadas: tareasPayload.length,
    candidatosCreados,
  }
}

// =============================================================
// 6. MOVER PIEZA → actualiza ubicación + registra movimiento
// =============================================================

export async function moverPieza(input: {
  piezaId: string
  nuevaUbicacionId: string
  motivo?: string | null
}) {
  const supabase = await getSupabase()
  const userId = await getUserIdOrThrow()

  // 1. Obtener ubicación actual
  const { data: pieza, error: errP } = await supabase
    .from('piezas')
    .select('id, ubicacion_id')
    .eq('id', input.piezaId)
    .single()
  if (errP) throw errP
  if (!pieza) throw new Error('Pieza no encontrada')
  if ((pieza as any).ubicacion_id === input.nuevaUbicacionId) {
    throw new Error('La pieza ya está en esa ubicación')
  }

  // 2. Validar destino
  const { data: ubic, error: errU } = await supabase
    .from('ubicaciones')
    .select('id, activo')
    .eq('id', input.nuevaUbicacionId)
    .single()
  if (errU) throw errU
  if (!ubic || !(ubic as any).activo) {
    throw new Error('La ubicación destino no está activa')
  }

  // 3. Insert movimiento
  const { error: errMov } = await supabase.from('movimientos_pieza').insert({
    pieza_id: input.piezaId,
    ubicacion_origen_id: (pieza as any).ubicacion_id,
    ubicacion_destino_id: input.nuevaUbicacionId,
    user_id: userId,
    motivo: input.motivo ?? null,
  })
  if (errMov) throw errMov

  // 4. Update pieza
  const { data: piezaUpd, error: errUpd } = await supabase
    .from('piezas')
    .update({ ubicacion_id: input.nuevaUbicacionId })
    .eq('id', input.piezaId)
    .select()
    .single()
  if (errUpd) throw errUpd

  return piezaUpd
}

// =============================================================
// 7. ARRANCAR PRODUCCIÓN
//    pedido 'confirmado' → 'en_produccion'
//    piezas 'sin_producir' → 'en_produccion'
//    tareas 'pendiente' → 'en_cola'
// =============================================================

export async function arrancarProduccion(pedidoId: string) {
  const supabase = await getSupabase()

  // 1. Validar estado actual
  const { data: pedido, error: errP } = await supabase
    .from('pedidos')
    .select('id, estado')
    .eq('id', pedidoId)
    .single()
  if (errP) throw errP
  if (!pedido) throw new Error('Pedido no encontrado')
  if ((pedido as any).estado !== 'confirmado') {
    throw new Error(
      `Solo se puede arrancar producción desde estado "confirmado" (actual: "${(pedido as any).estado}")`
    )
  }

  // 2. IDs de piezas del pedido
  const piezaIds = await getPiezaIdsDePedido(pedidoId)

  if (piezaIds.length > 0) {
    // 3. Tareas 'pendiente' → 'en_cola'
    const { error: errT } = await supabase
      .from('tareas_produccion')
      .update({ estado: 'en_cola' })
      .in('pieza_id', piezaIds)
      .eq('estado', 'pendiente')
    if (errT) throw errT

    // 4. Piezas 'sin_producir' → 'en_produccion'
    const { error: errPz } = await supabase
      .from('piezas')
      .update({ estado: 'en_produccion' })
      .in('id', piezaIds)
      .eq('estado', 'sin_producir')
    if (errPz) throw errPz
  }

  // 5. Pedido → 'en_produccion'
  const { data: pedidoUpd, error: errUpd } = await supabase
    .from('pedidos')
    .update({ estado: 'en_produccion' })
    .eq('id', pedidoId)
    .select()
    .single()
  if (errUpd) throw errUpd

  return pedidoUpd
}

// =============================================================
// 8. CANCELAR PEDIDO
//    - piezas no entregadas → 'cancelada'
//    - tareas no completadas → 'anulada'
//    - pedido → 'cancelado'
//    - las cantidades "vuelven" al pool del presupuesto
//      (calcularCantidadPendiente excluye pedidos cancelados)
// =============================================================

export async function cancelarPedido(
  pedidoId: string,
  motivo?: string | null
) {
  const supabase = await getSupabase()

  const { data: pedido, error: errP } = await supabase
    .from('pedidos')
    .select('id, estado, observaciones_internas')
    .eq('id', pedidoId)
    .single()
  if (errP) throw errP
  if (!pedido) throw new Error('Pedido no encontrado')
  const estadoActual = (pedido as any).estado
  if (estadoActual === 'cancelado') return pedido
  if (estadoActual === 'entregado' || estadoActual === 'facturado') {
    throw new Error(
      `No se puede cancelar un pedido en estado "${estadoActual}"`
    )
  }

  const piezaIds = await getPiezaIdsDePedido(pedidoId)

  if (piezaIds.length > 0) {
    // Tareas no completadas → anuladas
    const { error: errT } = await supabase
      .from('tareas_produccion')
      .update({ estado: 'anulada' })
      .in('pieza_id', piezaIds)
      .neq('estado', 'completada')
    if (errT) throw errT

    // Piezas no entregadas → canceladas
    const { error: errPz } = await supabase
      .from('piezas')
      .update({ estado: 'cancelada' })
      .in('id', piezaIds)
      .neq('estado', 'entregada')
    if (errPz) throw errPz
  }

  // Pedido → cancelado (y anotar motivo en observaciones_internas)
  const updPayload: any = { estado: 'cancelado' }
  if (motivo) {
    const prev = (pedido as any).observaciones_internas ?? ''
    updPayload.observaciones_internas = `${prev}\n[CANCELADO] ${motivo}`.trim()
  }
  const { data: pedidoUpd, error: errUpd } = await supabase
    .from('pedidos')
    .update(updPayload)
    .eq('id', pedidoId)
    .select()
    .single()
  if (errUpd) throw errUpd

  return pedidoUpd
}
