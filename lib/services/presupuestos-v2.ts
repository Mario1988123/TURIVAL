/**
 * lib/services/presupuestos-v2.ts
 * ================================================================
 * Creación de presupuestos usando el motor ERP nuevo. Creado en R5.
 *
 * Coexiste con lib/services/presupuestos.ts (motor viejo) hasta R7.
 *
 * Flujo:
 *   1. crear cabecera (presupuestos) con numero generado por BD.
 *   2. para cada línea:
 *      - si viene de referencia cliente → usa sus datos y llama al motor
 *      - si es 'manual' (irregular) → solo descripción + precio manual
 *      - si es 'personalizada' → usa el motor con datos del formulario
 *   3. insert lineas_presupuesto con desglose JSON.
 *   4. update totales del presupuesto.
 * ================================================================
 */

import { createClient } from './client'
import { obtenerConfiguracionEmpresa, extraerConfigErp } from './configuracion'
import { obtenerMaterial, resolverPrecioKg, resolverRendimientoKgM2 } from './materiales'
import { calcularSuperficie, type CarasSeleccionadas } from '@/lib/motor/superficie'
import { calcularCoste, type FactorComplejidad, type ProcesoInput } from '@/lib/motor/coste'
import { getProcesoDefault } from '@/lib/motor/procesos-defaults'
import type { ReferenciaCliente } from './referencias-cliente'

export interface LineaPresupuestoInput {
  /** Tipo de línea. */
  tipo: 'referencia' | 'personalizada' | 'manual'
  /** Descripción visible (si no, se toma de la referencia o se genera). */
  descripcion: string
  cantidad: number
  orden: number

  // Si tipo='referencia': solo necesitamos la referencia y cantidad.
  referencia?: ReferenciaCliente

  // Si tipo='manual' (irregular): descripción + precio_unitario directo.
  precio_unitario_manual?: number

  // Si tipo='personalizada': todos los campos como en referencia.
  datos_personalizada?: {
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
    procesos: Array<{
      proceso_codigo: string
      orden: number
      tiempo_base_min: number
      tiempo_por_m2_min: number
    }>
  }
}

export interface CrearPresupuestoV2Input {
  cliente_id: string
  fecha?: string                  // ISO date, default hoy
  validez_dias?: number           // default 30
  iva_porcentaje?: number         // default 21
  descuento_porcentaje?: number   // descuento global, default 0
  observaciones_comerciales?: string
  observaciones_internas?: string
  lineas: LineaPresupuestoInput[]
}

export interface ResultadoCrearPresupuestoV2 {
  presupuesto_id: string
  numero: string
  lineas_creadas: number
  total: number
}

/**
 * Crea un presupuesto v2 con sus líneas calculadas por el motor.
 */
export async function crearPresupuestoV2(
  input: CrearPresupuestoV2Input
): Promise<ResultadoCrearPresupuestoV2> {
  const supabase = createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) throw new Error('No autenticado')

  const conf = await obtenerConfiguracionEmpresa()
  if (!conf) throw new Error('configuracion_empresa no encontrada')
  const cfg = extraerConfigErp(conf)

  // 1. Generar número
  const { data: numData, error: numErr } = await supabase
    .rpc('generar_numero_secuencial', { p_tipo: 'presupuesto' })
  if (numErr) throw numErr
  const numero = numData as unknown as string

  // 2. Insert cabecera (totales a 0 por ahora, se actualizan luego)
  const { data: preData, error: preErr } = await supabase
    .from('presupuestos')
    .insert({
      numero,
      fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
      cliente_id: input.cliente_id,
      estado: 'borrador',
      validez_dias: input.validez_dias ?? 30,
      observaciones_comerciales: input.observaciones_comerciales ?? null,
      observaciones_internas: input.observaciones_internas ?? null,
      subtotal: 0,
      descuento_porcentaje: input.descuento_porcentaje ?? 0,
      descuento_importe: 0,
      base_imponible: 0,
      iva_porcentaje: input.iva_porcentaje ?? 21,
      iva_importe: 0,
      total: 0,
      user_id: authData.user.id,
    })
    .select()
    .single()
  if (preErr || !preData) throw preErr ?? new Error('No se pudo crear el presupuesto')
  const presupuesto_id = preData.id as string

  // 3. Calcular y guardar cada línea
  let subtotal = 0
  let tiempoTotalMin = 0

  for (const l of input.lineas) {
    const linea = await procesarLinea(supabase, l, presupuesto_id, cfg)
    subtotal += Number(linea.total_linea ?? 0)
    tiempoTotalMin += Number(linea.tiempo_estimado ?? 0)
  }

  // 4. Actualizar totales del presupuesto
  const descPct = Number(input.descuento_porcentaje ?? 0)
  const ivaPct  = Number(input.iva_porcentaje ?? 21)
  const desc_importe    = (subtotal * descPct) / 100
  const base_imponible  = subtotal - desc_importe
  const iva_importe     = (base_imponible * ivaPct) / 100
  const total           = base_imponible + iva_importe

  await supabase
    .from('presupuestos')
    .update({
      subtotal,
      descuento_importe:    desc_importe,
      base_imponible,
      iva_importe,
      total,
      tiempo_estimado_total: Math.round(tiempoTotalMin),
      updated_at:            new Date().toISOString(),
    })
    .eq('id', presupuesto_id)

  return {
    presupuesto_id,
    numero,
    lineas_creadas: input.lineas.length,
    total,
  }
}

// =================================================================
// INTERNO: procesar una línea según su tipo
// =================================================================

async function procesarLinea(
  supabase: ReturnType<typeof createClient>,
  l: LineaPresupuestoInput,
  presupuesto_id: string,
  cfg: ReturnType<typeof extraerConfigErp>
): Promise<{ total_linea: number; tiempo_estimado: number }> {

  // === TIPO MANUAL (irregular) ===
  if (l.tipo === 'manual') {
    const precio = Number(l.precio_unitario_manual ?? 0)
    const total = precio * Math.max(1, l.cantidad)

    const { error } = await supabase.from('lineas_presupuesto').insert({
      presupuesto_id,
      descripcion: l.descripcion || '(sin descripción)',
      cantidad: l.cantidad,
      modo_precio: 'manual',
      precio_unitario: precio,
      total_linea: total,
      precio_aproximado: true,
      orden: l.orden,
    })
    if (error) throw error
    return { total_linea: total, tiempo_estimado: 0 }
  }

  // === TIPO REFERENCIA ===
  if (l.tipo === 'referencia' && l.referencia) {
    const ref = l.referencia
    return insertarLineaConMotor(supabase, {
      presupuesto_id,
      cantidad: l.cantidad,
      orden: l.orden,
      descripcion: l.descripcion || ref.nombre_pieza || ref.referencia_cliente,
      modo_precio: ref.modo_precio,
      ancho: ref.ancho,
      alto: ref.alto,
      grosor: ref.grosor,
      longitud_ml: ref.longitud_ml,
      cara_frontal: ref.cara_frontal,
      cara_trasera: ref.cara_trasera,
      canto_superior: ref.canto_superior,
      canto_inferior: ref.canto_inferior,
      canto_izquierdo: ref.canto_izquierdo,
      canto_derecho: ref.canto_derecho,
      contabilizar_grosor: ref.contabilizar_grosor,
      categoria_pieza_id: ref.categoria_pieza_id,
      material_lacado_id: ref.material_lacado_id,
      material_fondo_id: ref.material_fondo_id,
      factor_complejidad: ref.factor_complejidad,
      descuento_porcentaje: ref.descuento_porcentaje,
      precio_aproximado: ref.precio_aproximado,
      procesos: ref.procesos,
    }, cfg)
  }

  // === TIPO PERSONALIZADA ===
  if (l.tipo === 'personalizada' && l.datos_personalizada) {
    const d = l.datos_personalizada
    return insertarLineaConMotor(supabase, {
      presupuesto_id,
      cantidad: l.cantidad,
      orden: l.orden,
      descripcion: l.descripcion,
      modo_precio: d.modo_precio,
      ancho: d.ancho,
      alto: d.alto,
      grosor: d.grosor,
      longitud_ml: d.longitud_ml,
      cara_frontal: d.cara_frontal,
      cara_trasera: d.cara_trasera,
      canto_superior: d.canto_superior,
      canto_inferior: d.canto_inferior,
      canto_izquierdo: d.canto_izquierdo,
      canto_derecho: d.canto_derecho,
      contabilizar_grosor: d.contabilizar_grosor,
      categoria_pieza_id: d.categoria_pieza_id,
      material_lacado_id: d.material_lacado_id,
      material_fondo_id: d.material_fondo_id,
      factor_complejidad: d.factor_complejidad,
      descuento_porcentaje: d.descuento_porcentaje,
      precio_aproximado: d.precio_aproximado,
      procesos: d.procesos,
    }, cfg)
  }

  throw new Error(`Tipo de línea no reconocido o datos incompletos: ${l.tipo}`)
}

interface DatosLineaMotor {
  presupuesto_id: string
  cantidad: number
  orden: number
  descripcion: string
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
  categoria_pieza_id: string | null
  material_lacado_id: string | null
  material_fondo_id: string | null
  factor_complejidad: FactorComplejidad
  descuento_porcentaje: number
  precio_aproximado: boolean
  procesos: Array<{
    proceso_codigo: string
    orden: number
    tiempo_base_min?: number
    tiempo_por_m2_min?: number
  }>
}

async function insertarLineaConMotor(
  supabase: ReturnType<typeof createClient>,
  d: DatosLineaMotor,
  cfg: ReturnType<typeof extraerConfigErp>
): Promise<{ total_linea: number; tiempo_estimado: number }> {

  // Precios efectivos de materiales
  let precio_lacado = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_fondo  = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_cata_kg = 0
  let precio_dis_kg  = 0

  if (d.material_lacado_id) {
    const m = await obtenerMaterial(d.material_lacado_id)
    precio_lacado = { precio_kg: resolverPrecioKg(m), rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg) }
  }
  if (d.material_fondo_id) {
    const m = await obtenerMaterial(d.material_fondo_id)
    precio_fondo  = { precio_kg: resolverPrecioKg(m), rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg) }
  }
  if (cfg.material_catalizador_default_id) {
    precio_cata_kg = resolverPrecioKg(await obtenerMaterial(cfg.material_catalizador_default_id))
  }
  if (cfg.material_disolvente_default_id) {
    precio_dis_kg = resolverPrecioKg(await obtenerMaterial(cfg.material_disolvente_default_id))
  }

  // Superficie
  const caras: CarasSeleccionadas = {
    cara_frontal: d.cara_frontal,
    cara_trasera: d.cara_trasera,
    canto_superior: d.canto_superior,
    canto_inferior: d.canto_inferior,
    canto_izquierdo: d.canto_izquierdo,
    canto_derecho: d.canto_derecho,
  }
  const superficie = calcularSuperficie({
    modo_precio: d.modo_precio,
    ancho: d.ancho,
    alto: d.alto,
    grosor: d.grosor,
    longitud_ml: d.longitud_ml,
    caras,
    contabilizar_grosor: d.contabilizar_grosor,
    cantidad: d.cantidad,
    ancho_minimo_pistola_cm: cfg.ancho_minimo_pistola_cm,
  })

  // Procesos con tiempos
  const procesos: ProcesoInput[] = d.procesos.map(p => {
    const def = getProcesoDefault(p.proceso_codigo)
    return {
      codigo: p.proceso_codigo,
      tiempo_base_min:   p.tiempo_base_min   ?? def?.tiempo_base_min   ?? 0,
      tiempo_por_m2_min: p.tiempo_por_m2_min ?? def?.tiempo_por_m2_min ?? 0,
      consume_material:  def?.consume_material ?? false,
      tipo_material:     def?.tipo_material,
    }
  })

  // Coste
  const desglose = calcularCoste({
    superficie_m2: superficie.superficie_unitaria_m2,
    factor_complejidad: d.factor_complejidad,
    precio_lacado,
    precio_fondo,
    precio_cata_kg,
    precio_dis_kg,
    procesos,
    descuento_porcentaje: d.descuento_porcentaje,
    cantidad: d.cantidad,
    config: {
      rendimiento_lacado_kg_m2:   cfg.rendimiento_lacado_kg_m2,
      rendimiento_fondo_kg_m2:    cfg.rendimiento_fondo_kg_m2,
      coste_minuto_operario:      cfg.coste_minuto_operario,
      margen_objetivo_porcentaje: cfg.margen_objetivo_porcentaje,
      ratios: {
        ratio_cata_lacado: cfg.ratio_cata_lacado,
        ratio_dis_lacado:  cfg.ratio_dis_lacado,
        ratio_cata_fondo:  cfg.ratio_cata_fondo,
        ratio_dis_fondo:   cfg.ratio_dis_fondo,
      },
      multiplicador_simple:   0.8,
      multiplicador_media:    1.0,
      multiplicador_compleja: 1.3,
    },
  })

  const tiempoMinTotal = desglose.tiempo_total_min * d.cantidad

  // Procesos de la línea (flujo v2), ordenados como vienen. Se persisten
  // como text[] en lineas_presupuesto.procesos_codigos para que luego
  // puedan propagarse a lineas_pedido y que confirmarPedido() genere
  // las tareas correspondientes (iteraciones 4 y 5 del nudo P+2B).
  const procesosCodigos =
    d.procesos && d.procesos.length > 0
      ? d.procesos
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((p) => p.proceso_codigo)
      : null

  // Insert
  const { error } = await supabase.from('lineas_presupuesto').insert({
    presupuesto_id: d.presupuesto_id,
    descripcion: d.descripcion,
    cantidad: d.cantidad,
    modo_precio: d.modo_precio,
    ancho: d.ancho,
    alto: d.alto,
    grosor: d.grosor,
    longitud_ml: d.longitud_ml,
    cara_frontal: d.cara_frontal,
    cara_trasera: d.cara_trasera,
    canto_superior: d.canto_superior,
    canto_inferior: d.canto_inferior,
    canto_izquierdo: d.canto_izquierdo,
    canto_derecho: d.canto_derecho,
    contabilizar_grosor: d.contabilizar_grosor,
    categoria_pieza_id: d.categoria_pieza_id,
    material_lacado_id: d.material_lacado_id,
    material_fondo_id: d.material_fondo_id,
    precio_aproximado: d.precio_aproximado,
    superficie_m2: superficie.superficie_unitaria_m2,
    precio_unitario: desglose.precio_final_unitario,
    total_linea: desglose.precio_total_final,
    tiempo_estimado: Math.round(tiempoMinTotal),
    desglose_coste_json: desglose as any,
    procesos_codigos: procesosCodigos,
    orden: d.orden,
  })
  if (error) throw error

  return {
    total_linea: desglose.precio_total_final,
    tiempo_estimado: Math.round(tiempoMinTotal),
  }
}

// =================================================================
// SIMULACIÓN SIN GUARDAR — Calcular precio antes de guardar
// =================================================================
/**
 * Calcula el precio, tiempo y coste de una pieza personalizada SIN
 * insertarla en BD. Usado por el formulario "Nueva pieza" del
 * presupuestador v2 para que el usuario vea el precio antes de
 * confirmar Guardar.
 *
 * Misma lógica que insertarLineaConMotor pero sin insert final.
 * La llamada es un server action desde el cliente.
 */
export interface SimularPrecioInput {
  cantidad: number
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
  categoria_pieza_id: string | null
  material_lacado_id: string | null
  material_fondo_id: string | null
  factor_complejidad: FactorComplejidad
  descuento_porcentaje: number
  procesos: Array<{
    proceso_codigo: string
    orden: number
  }>
}

export interface SimularPrecioResultado {
  superficie_unitaria_m2: number
  tiempo_minutos_unitario: number
  tiempo_minutos_total: number
  coste_materiales_unitario: number
  coste_mano_obra_unitario: number
  coste_unitario: number
  precio_unitario: number
  precio_total: number
  detalle: {
    kg_lacado: number
    kg_fondo: number
    kg_cata: number
    kg_dis: number
    coste_lacado: number
    coste_fondo: number
    coste_cata: number
    coste_dis: number
    avisos: string[]
  }
}

export async function simularPrecioLineaPersonalizada(
  input: SimularPrecioInput
): Promise<SimularPrecioResultado> {
  const supabase = createClient()
  const configRow = await obtenerConfiguracionEmpresa(supabase)
  const cfg = extraerConfigErp(configRow)

  // Precios efectivos de materiales
  let precio_lacado = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_fondo  = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_cata_kg = 0
  let precio_dis_kg  = 0

  if (input.material_lacado_id) {
    const m = await obtenerMaterial(input.material_lacado_id)
    precio_lacado = {
      precio_kg: resolverPrecioKg(m),
      rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg),
    }
  }
  if (input.material_fondo_id) {
    const m = await obtenerMaterial(input.material_fondo_id)
    precio_fondo = {
      precio_kg: resolverPrecioKg(m),
      rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg),
    }
  }
  if (cfg.material_catalizador_default_id) {
    precio_cata_kg = resolverPrecioKg(
      await obtenerMaterial(cfg.material_catalizador_default_id)
    )
  }
  if (cfg.material_disolvente_default_id) {
    precio_dis_kg = resolverPrecioKg(
      await obtenerMaterial(cfg.material_disolvente_default_id)
    )
  }

  // Superficie (usando la misma función que el motor real)
  const caras: CarasSeleccionadas = {
    cara_frontal: input.cara_frontal,
    cara_trasera: input.cara_trasera,
    canto_superior: input.canto_superior,
    canto_inferior: input.canto_inferior,
    canto_izquierdo: input.canto_izquierdo,
    canto_derecho: input.canto_derecho,
  }
  const superficie = calcularSuperficie({
    modo_precio: input.modo_precio,
    ancho: input.ancho,
    alto: input.alto,
    grosor: input.grosor,
    longitud_ml: input.longitud_ml,
    caras,
    contabilizar_grosor: input.contabilizar_grosor,
    cantidad: input.cantidad,
    ancho_minimo_pistola_cm: cfg.ancho_minimo_pistola_cm,
  })

  // Procesos con tiempos desde defaults
  const procesos: ProcesoInput[] = input.procesos.map((p) => {
    const def = getProcesoDefault(p.proceso_codigo)
    return {
      codigo: p.proceso_codigo,
      tiempo_base_min:   def?.tiempo_base_min   ?? 0,
      tiempo_por_m2_min: def?.tiempo_por_m2_min ?? 0,
      consume_material:  def?.consume_material  ?? false,
      tipo_material:     def?.tipo_material,
    }
  })

  // Coste vía motor (misma función que guardado real)
  const desglose = calcularCoste({
    superficie_m2: superficie.superficie_unitaria_m2,
    factor_complejidad: input.factor_complejidad,
    precio_lacado,
    precio_fondo,
    precio_cata_kg,
    precio_dis_kg,
    procesos,
    descuento_porcentaje: input.descuento_porcentaje,
    cantidad: input.cantidad,
    config: {
      rendimiento_lacado_kg_m2:   cfg.rendimiento_lacado_kg_m2,
      rendimiento_fondo_kg_m2:    cfg.rendimiento_fondo_kg_m2,
      coste_minuto_operario:      cfg.coste_minuto_operario,
      margen_objetivo_porcentaje: cfg.margen_objetivo_porcentaje,
      ratios: {
        ratio_cata_lacado: cfg.ratio_cata_lacado,
        ratio_dis_lacado:  cfg.ratio_dis_lacado,
        ratio_cata_fondo:  cfg.ratio_cata_fondo,
        ratio_dis_fondo:   cfg.ratio_dis_fondo,
      },
      multiplicador_simple:   0.8,
      multiplicador_media:    1.0,
      multiplicador_compleja: 1.3,
    },
  })

  // Agregar datos por proceso (el motor devuelve desglose por proceso).
  const procesosArr: Array<{
    codigo: string
    tiempo_min: number
    coste_obra_eur: number
    consumo_pintura_kg: number
    consumo_cata_kg: number
    consumo_dis_kg: number
    coste_pintura_eur: number
    coste_cata_eur: number
    coste_dis_eur: number
  }> = Array.isArray(desglose.procesos) ? desglose.procesos : []

  // Separar kg de pintura según tipo_material del proceso:
  // LACADO → lacado; FONDO/FONDEADO_2 → fondo.
  let kgLacado = 0
  let kgFondo = 0
  let costeLacado = 0
  let costeFondo = 0
  let kgCata = 0
  let kgDis = 0
  let costeCata = 0
  let costeDis = 0

  for (const p of procesosArr) {
    const def = getProcesoDefault(p.codigo)
    if (def?.tipo_material === 'lacado') {
      kgLacado    += p.consumo_pintura_kg ?? 0
      costeLacado += p.coste_pintura_eur  ?? 0
    } else if (def?.tipo_material === 'fondo') {
      kgFondo     += p.consumo_pintura_kg ?? 0
      costeFondo  += p.coste_pintura_eur  ?? 0
    }
    kgCata    += p.consumo_cata_kg ?? 0
    kgDis     += p.consumo_dis_kg  ?? 0
    costeCata += p.coste_cata_eur  ?? 0
    costeDis  += p.coste_dis_eur   ?? 0
  }

  const tiempoUnitario = desglose.tiempo_total_min ?? 0

  return {
    superficie_unitaria_m2: Number(superficie.superficie_unitaria_m2.toFixed(4)),
    tiempo_minutos_unitario: Number(tiempoUnitario.toFixed(1)),
    tiempo_minutos_total: Number((tiempoUnitario * input.cantidad).toFixed(1)),
    coste_materiales_unitario: Number((desglose.coste_material_total ?? 0).toFixed(2)),
    coste_mano_obra_unitario: Number((desglose.coste_obra_ajustado ?? 0).toFixed(2)),
    coste_unitario: Number((desglose.coste_total_unitario ?? 0).toFixed(2)),
    precio_unitario: Number((desglose.precio_final_unitario ?? 0).toFixed(2)),
    precio_total: Number((desglose.precio_total_final ?? 0).toFixed(2)),
    detalle: {
      kg_lacado: Number(kgLacado.toFixed(4)),
      kg_fondo:  Number(kgFondo.toFixed(4)),
      kg_cata:   Number(kgCata.toFixed(4)),
      kg_dis:    Number(kgDis.toFixed(4)),
      coste_lacado: Number(costeLacado.toFixed(2)),
      coste_fondo:  Number(costeFondo.toFixed(2)),
      coste_cata:   Number(costeCata.toFixed(2)),
      coste_dis:    Number(costeDis.toFixed(2)),
      avisos: [] as string[],
    },
  }
}
