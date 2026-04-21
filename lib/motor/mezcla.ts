/**
 * lib/motor/mezcla.ts
 * ================================================================
 * Motor de cálculo de mezclas. Creado en R2b.
 *
 * Dado una superficie y un rendimiento kg/m², calcula:
 *   1. kg de pintura (lacado) o fondo necesarios.
 *   2. kg de catalizador que hay que añadir según ratio X:1.
 *   3. kg de disolvente que hay que añadir según ratio Y:1.
 *
 * INTERPRETACIÓN DE RATIOS:
 *   ratio 8:1 cata   →  por cada 8 kg de pintura, 1 kg de catalizador.
 *                        Es decir, cata = pintura / 8.
 *   ratio 4:1 dis    →  dis = pintura / 4.
 *   ratio 12:1 cata  →  cata = fondo / 12.
 *   ratio 6:1 dis    →  dis = fondo / 6.
 *
 * DEFAULTS ACTUALES (configurables en /configuracion en R3):
 *   lacado: cata 8:1, dis 4:1
 *   fondo:  cata 12:1, dis 6:1
 * ================================================================
 */

export interface RatiosMezcla {
  ratio_cata_lacado: number  // X en "X:1" — pintura/X = kg cata
  ratio_dis_lacado:  number
  ratio_cata_fondo:  number
  ratio_dis_fondo:   number
}

export interface ResultadoMezcla {
  /** kg del material base (pintura o fondo). */
  pintura_kg: number
  /** kg de catalizador a añadir. */
  catalizador_kg: number
  /** kg de disolvente a añadir. */
  disolvente_kg: number
  /** Peso total de la mezcla lista para pistola (pintura + cata + dis). */
  total_mezcla_kg: number
}

/**
 * Calcula la cantidad de mezcla necesaria para una superficie dada.
 *
 * @param params.superficie_m2  Superficie a pintar (del motor superficie).
 * @param params.proceso        'lacado' | 'fondo' — determina los ratios.
 * @param params.rendimiento_kg_m2  kg de pintura/fondo por m² (del material o config).
 * @param params.ratios         Ratios globales desde configuracion_empresa.
 */
export function calcularMezcla(params: {
  superficie_m2: number
  proceso: 'lacado' | 'fondo'
  rendimiento_kg_m2: number
  ratios: RatiosMezcla
}): ResultadoMezcla {
  const sup = Math.max(0, Number(params.superficie_m2) || 0)
  const rend = Math.max(0, Number(params.rendimiento_kg_m2) || 0)

  const pintura_kg = sup * rend

  const ratioCata = params.proceso === 'lacado'
    ? params.ratios.ratio_cata_lacado
    : params.ratios.ratio_cata_fondo
  const ratioDis = params.proceso === 'lacado'
    ? params.ratios.ratio_dis_lacado
    : params.ratios.ratio_dis_fondo

  const catalizador_kg = ratioCata > 0 ? pintura_kg / ratioCata : 0
  const disolvente_kg  = ratioDis  > 0 ? pintura_kg / ratioDis  : 0

  return {
    pintura_kg,
    catalizador_kg,
    disolvente_kg,
    total_mezcla_kg: pintura_kg + catalizador_kg + disolvente_kg,
  }
}

/**
 * Redondea una mezcla a gramos (útil para la pantalla de producción).
 */
export function redondearMezcla(m: ResultadoMezcla, decimales = 3): ResultadoMezcla {
  const f = (n: number) => Number(n.toFixed(decimales))
  return {
    pintura_kg:      f(m.pintura_kg),
    catalizador_kg:  f(m.catalizador_kg),
    disolvente_kg:   f(m.disolvente_kg),
    total_mezcla_kg: f(m.total_mezcla_kg),
  }
}
