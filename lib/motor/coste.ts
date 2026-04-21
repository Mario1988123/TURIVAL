/**
 * lib/motor/coste.ts
 * ================================================================
 * Motor de cálculo de coste y precio. Creado en R2b.
 *
 * ESTRUCTURA DEL CÁLCULO:
 *
 *   1. COSTE MATERIAL
 *      Para cada proceso con consumo de material (solo lacado y fondo):
 *        consumo_kg = superficie_m2 × rendimiento_kg_m2
 *        coste_pintura  = consumo_kg × precio_kg_pintura
 *        coste_cata     = (consumo_kg / ratio_cata) × precio_kg_cata
 *        coste_dis      = (consumo_kg / ratio_dis)  × precio_kg_dis
 *
 *   2. COSTE MANO DE OBRA
 *      tiempo_total_min = Σ por proceso (tiempo_base + tiempo_m2 × superficie)
 *      coste_obra       = tiempo_total_min × €/min
 *      coste_obra_ajust = coste_obra × factor_complejidad
 *
 *   3. COSTE TOTAL
 *      coste_total = coste_material + coste_obra_ajust
 *
 *   4. PRECIO DE VENTA
 *      precio_base       = coste_total × (1 + margen/100)
 *      precio_con_desc   = precio_base × (1 - descuento/100)
 *
 *   5. MARGEN REAL (para piezas con descuento o precio pactado)
 *      margen_real_eur = precio_final - coste_total
 *      margen_real_pct = (margen_real_eur / coste_total) × 100
 *
 * ================================================================
 */

import { calcularMezcla, type RatiosMezcla } from './mezcla'

// =================================================================
// TIPOS DE ENTRADA
// =================================================================

export type FactorComplejidad = 'simple' | 'media' | 'compleja'

export interface CosteConfig {
  /** Valores globales desde configuracion_empresa. */
  rendimiento_lacado_kg_m2: number
  rendimiento_fondo_kg_m2:  number
  coste_minuto_operario:    number
  margen_objetivo_porcentaje: number
  ratios: RatiosMezcla

  /** Multiplicadores (de niveles_complejidad, por si Mario los cambia). */
  multiplicador_simple:   number // default 0.8
  multiplicador_media:    number // default 1.0
  multiplicador_compleja: number // default 1.3
}

export interface PrecioMaterial {
  /** €/kg efectivo del material (ya resuelto desde proveedor o sobrescrito). */
  precio_kg: number
  /** Rendimiento kg/m² (ya resuelto desde material o config). */
  rendimiento_kg_m2: number
}

export interface ProcesoInput {
  /** Código del proceso (LIJADO, FONDO, LACADO, etc.). */
  codigo: string
  /** Tiempo base fijo en minutos (carga, preparación, descarga). */
  tiempo_base_min: number
  /** Minutos por m² que escala linealmente. */
  tiempo_por_m2_min: number
  /** ¿Consume material? Solo true para FONDO, FONDEADO_2, LACADO. */
  consume_material: boolean
  /** Si consume material, qué tipo: 'lacado' para LACADO, 'fondo' para FONDO/FONDEADO_2. */
  tipo_material?: 'lacado' | 'fondo'
}

export interface InputCoste {
  superficie_m2: number
  factor_complejidad: FactorComplejidad

  /** Precios y rendimientos efectivos del lacado y fondo elegidos. */
  precio_lacado?: PrecioMaterial | null
  precio_fondo?:  PrecioMaterial | null

  /** €/kg del catalizador y disolvente defaults. */
  precio_cata_kg: number
  precio_dis_kg:  number

  /** Lista de procesos que lleva esta pieza, en orden. */
  procesos: ProcesoInput[]

  /** Descuento % sobre precio final (0-100). */
  descuento_porcentaje: number

  /** Configuración global. */
  config: CosteConfig

  /** Unidades (multiplica todo). */
  cantidad: number
}

// =================================================================
// SALIDA
// =================================================================

export interface DetalleProcesoCoste {
  codigo:               string
  tiempo_min:           number
  coste_obra_eur:       number
  consumo_pintura_kg:   number
  consumo_cata_kg:      number
  consumo_dis_kg:       number
  coste_pintura_eur:    number
  coste_cata_eur:       number
  coste_dis_eur:        number
  coste_material_eur:   number
  coste_total_eur:      number
}

export interface DesgloseCoste {
  // Unitario (una pieza)
  superficie_unitaria_m2: number
  procesos:               DetalleProcesoCoste[]
  tiempo_total_min:       number
  coste_material_total:   number
  coste_obra_base:        number
  coste_obra_ajustado:    number  // × factor complejidad
  coste_total_unitario:   number

  // Venta unitaria
  precio_sin_descuento:   number
  precio_final_unitario:  number
  margen_real_eur:        number
  margen_real_pct:        number

  // Total (cantidad × unitario)
  cantidad:               number
  coste_total_bruto:      number
  precio_total_final:     number
  margen_total_eur:       number
}

// =================================================================
// CÁLCULO
// =================================================================

export function calcularCoste(input: InputCoste): DesgloseCoste {
  const sup    = Math.max(0, Number(input.superficie_m2) || 0)
  const config = input.config
  const qty    = Math.max(1, Number(input.cantidad) || 1)

  const factor = input.factor_complejidad === 'simple'
    ? config.multiplicador_simple
    : input.factor_complejidad === 'compleja'
      ? config.multiplicador_compleja
      : config.multiplicador_media

  // Detalle por proceso
  const procesos: DetalleProcesoCoste[] = []

  for (const p of input.procesos) {
    const tiempo_min = p.tiempo_base_min + p.tiempo_por_m2_min * sup
    const coste_obra = tiempo_min * config.coste_minuto_operario

    let consumo_pintura_kg = 0
    let consumo_cata_kg    = 0
    let consumo_dis_kg     = 0
    let coste_pintura_eur  = 0
    let coste_cata_eur     = 0
    let coste_dis_eur      = 0

    if (p.consume_material && p.tipo_material) {
      const matInfo = p.tipo_material === 'lacado'
        ? input.precio_lacado
        : input.precio_fondo

      if (matInfo && matInfo.rendimiento_kg_m2 > 0) {
        const mezcla = calcularMezcla({
          superficie_m2: sup,
          proceso: p.tipo_material,
          rendimiento_kg_m2: matInfo.rendimiento_kg_m2,
          ratios: config.ratios,
        })
        consumo_pintura_kg = mezcla.pintura_kg
        consumo_cata_kg    = mezcla.catalizador_kg
        consumo_dis_kg     = mezcla.disolvente_kg
        coste_pintura_eur  = consumo_pintura_kg * matInfo.precio_kg
        coste_cata_eur     = consumo_cata_kg    * input.precio_cata_kg
        coste_dis_eur      = consumo_dis_kg     * input.precio_dis_kg
      }
    }

    const coste_material_eur = coste_pintura_eur + coste_cata_eur + coste_dis_eur
    procesos.push({
      codigo: p.codigo,
      tiempo_min,
      coste_obra_eur: coste_obra,
      consumo_pintura_kg,
      consumo_cata_kg,
      consumo_dis_kg,
      coste_pintura_eur,
      coste_cata_eur,
      coste_dis_eur,
      coste_material_eur,
      coste_total_eur: coste_obra + coste_material_eur,
    })
  }

  const tiempo_total_min     = procesos.reduce((s, p) => s + p.tiempo_min,          0)
  const coste_material_total = procesos.reduce((s, p) => s + p.coste_material_eur,  0)
  const coste_obra_base      = procesos.reduce((s, p) => s + p.coste_obra_eur,      0)
  const coste_obra_ajustado  = coste_obra_base * factor
  const coste_total_unitario = coste_material_total + coste_obra_ajustado

  // Precio con margen objetivo
  const margen_pct = Number(config.margen_objetivo_porcentaje) || 0
  const precio_sin_descuento = coste_total_unitario * (1 + margen_pct / 100)

  const descuento_pct = Math.min(100, Math.max(0, Number(input.descuento_porcentaje) || 0))
  const precio_final_unitario = precio_sin_descuento * (1 - descuento_pct / 100)

  const margen_real_eur = precio_final_unitario - coste_total_unitario
  const margen_real_pct = coste_total_unitario > 0
    ? (margen_real_eur / coste_total_unitario) * 100
    : 0

  return {
    superficie_unitaria_m2: sup,
    procesos,
    tiempo_total_min,
    coste_material_total,
    coste_obra_base,
    coste_obra_ajustado,
    coste_total_unitario,
    precio_sin_descuento,
    precio_final_unitario,
    margen_real_eur,
    margen_real_pct,

    cantidad:           qty,
    coste_total_bruto:  coste_total_unitario * qty,
    precio_total_final: precio_final_unitario * qty,
    margen_total_eur:   margen_real_eur * qty,
  }
}
