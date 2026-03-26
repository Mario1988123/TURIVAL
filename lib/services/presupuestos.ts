import { createClient } from './client'
import type { Presupuesto, LineaPresupuesto, Cliente } from '../types/erp'

/**
 * Calcula el motor de tarifación para una línea de presupuesto
 * Soporta presupuestos por m² o por pieza, con precio mínimo y suplementos manuales
 */
export interface CalculoLineaInput {
  modo_precio: 'm2' | 'pieza'
  cantidad: number
  ancho?: number
  alto?: number
  cara_frontal?: boolean
  cara_trasera?: boolean
  canto_superior?: boolean
  canto_inferior?: boolean
  canto_izquierdo?: boolean
  canto_derecho?: boolean
  precio_m2?: number
  precio_pieza?: number
  precio_minimo?: number
  suplemento_manual?: number
}

export interface CalculoResultado {
  superficie_m2: number
  precio_unitario: number
  total_linea: number
}

/**
 * Calcula la superficie en m² basado en dimensiones y caras seleccionadas
 */
export function calcularSuperficie(input: CalculoLineaInput): number {
  if (!input.ancho || !input.alto) return 0

  // Convertir de mm a metros
  const ancho_m = input.ancho / 1000
  const alto_m = input.alto / 1000

  let superficie = 0
  const area_base = ancho_m * alto_m

  // Contar caras seleccionadas
  if (input.cara_frontal) superficie += area_base
  if (input.cara_trasera) superficie += area_base

  // Cantos: ancho x grosor (asumimos grosor estándar de 1.6mm convertido a m)
  const grosor_m = 0.0016

  if (input.canto_superior) superficie += ancho_m * grosor_m
  if (input.canto_inferior) superficie += ancho_m * grosor_m
  if (input.canto_izquierdo) superficie += alto_m * grosor_m
  if (input.canto_derecho) superficie += alto_m * grosor_m

  return superficie * input.cantidad
}

/**
 * Motor principal de cálculo de presupuestos
 */
export function calcularLinea(input: CalculoLineaInput): CalculoResultado {
  const superficie_m2 = calcularSuperficie(input)

  let precio_unitario = 0

  if (input.modo_precio === 'm2' && input.precio_m2) {
    precio_unitario = superficie_m2 * input.precio_m2
  } else if (input.modo_precio === 'pieza' && input.precio_pieza) {
    precio_unitario = input.precio_pieza * input.cantidad
  }

  // Aplicar precio mínimo si es necesario
  if (input.precio_minimo && precio_unitario < input.precio_minimo) {
    precio_unitario = input.precio_minimo
  }

  // Añadir suplemento manual
  const total_linea = precio_unitario + (input.suplemento_manual || 0)

  return {
    superficie_m2: parseFloat(superficie_m2.toFixed(4)),
    precio_unitario: parseFloat(precio_unitario.toFixed(2)),
    total_linea: parseFloat(total_linea.toFixed(2)),
  }
}

/**
 * Calcula totales del presupuesto desde sus líneas
 */
export interface CalculoPresupuestoInput {
  lineas: LineaPresupuesto[]
  descuento_porcentaje?: number
  iva_porcentaje?: number
}

export interface CalculoPresupuestoResultado {
  subtotal: number
  descuento_importe: number
  base_imponible: number
  iva_importe: number
  total: number
  tiempo_estimado_total: number
}

export function calcularPresupuesto(input: CalculoPresupuestoInput): CalculoPresupuestoResultado {
  const subtotal = input.lineas.reduce((sum, linea) => sum + (linea.total_linea || 0), 0)

  const descuento_importe =
    (subtotal * (input.descuento_porcentaje || 0)) / 100

  const base_imponible = subtotal - descuento_importe

  const iva_importe =
    (base_imponible * (input.iva_porcentaje || 21)) / 100

  const total = base_imponible + iva_importe

  const tiempo_estimado_total = input.lineas.reduce(
    (sum, linea) => sum + (linea.tiempo_estimado || 0),
    0
  )

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    descuento_importe: parseFloat(descuento_importe.toFixed(2)),
    base_imponible: parseFloat(base_imponible.toFixed(2)),
    iva_importe: parseFloat(iva_importe.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    tiempo_estimado_total,
  }
}

/**
 * Obtener siguiente número de secuencia
 */
export async function obtenerSiguienteNumero(
  tipo: 'presupuesto' | 'pedido' | 'albaran' | 'pieza' | 'lote'
): Promise<string> {
  const supabase = createClient()
  const anio = new Date().getFullYear()

  const { data, error } = await supabase
    .from('secuencias')
    .select('ultimo_numero')
    .eq('id', tipo)
    .eq('anio', anio)
    .single()

  if (error) throw error

  const numero = (data?.ultimo_numero || 0) + 1

  // Actualizar secuencia
  await supabase
    .from('secuencias')
    .update({ ultimo_numero: numero })
    .eq('id', tipo)
    .eq('anio', anio)

  const prefijos: Record<string, string> = {
    presupuesto: 'PRES',
    pedido: 'PED',
    albaran: 'ALB',
    pieza: 'PIE',
    lote: 'LOT',
  }

  return `${prefijos[tipo]}-${anio}-${String(numero).padStart(4, '0')}`
}

/**
 * Crear presupuesto con líneas
 */
export async function crearPresupuesto(
  cliente_id: string,
  lineas: Omit<LineaPresupuesto, 'id' | 'presupuesto_id' | 'created_at'>[],
  observaciones?: string
): Promise<{ presupuesto: Presupuesto; lineas: LineaPresupuesto[] }> {
  const supabase = createClient()
  const numero = await obtenerSiguienteNumero('presupuesto')

  // Calcular totales
  const lineas_con_calculos = lineas.map((linea) => {
    const calculo = calcularLinea({
      modo_precio: linea.modo_precio,
      cantidad: linea.cantidad,
      ancho: linea.ancho || undefined,
      alto: linea.alto || undefined,
      cara_frontal: linea.cara_frontal,
      cara_trasera: linea.cara_trasera,
      canto_superior: linea.canto_superior,
      canto_inferior: linea.canto_inferior,
      canto_izquierdo: linea.canto_izquierdo,
      canto_derecho: linea.canto_derecho,
      precio_m2: linea.precio_m2 || undefined,
      precio_pieza: linea.precio_pieza || undefined,
      precio_minimo: linea.precio_minimo,
      suplemento_manual: linea.suplemento_manual,
    })

    return {
      ...linea,
      superficie_m2: calculo.superficie_m2,
      precio_unitario: calculo.precio_unitario,
      total_linea: calculo.total_linea,
    }
  })

  const totales = calcularPresupuesto({ lineas: lineas_con_calculos as any })

  // Crear presupuesto
  const { data: presupuesto, error: presError } = await supabase
    .from('presupuestos')
    .insert({
      numero,
      cliente_id,
      observaciones_comerciales: observaciones,
      subtotal: totales.subtotal,
      descuento_importe: totales.descuento_importe,
      base_imponible: totales.base_imponible,
      iva_importe: totales.iva_importe,
      total: totales.total,
      tiempo_estimado_total: totales.tiempo_estimado_total,
    })
    .select()
    .single()

  if (presError) throw presError

  // Crear líneas
  const { data: lineas_insertadas, error: linError } = await supabase
    .from('lineas_presupuesto')
    .insert(
      lineas_con_calculos.map((linea, idx) => ({
        ...linea,
        presupuesto_id: presupuesto.id,
        orden: idx,
      }))
    )
    .select()

  if (linError) throw linError

  return {
    presupuesto: presupuesto as Presupuesto,
    lineas: lineas_insertadas as LineaPresupuesto[],
  }
}
