/**
 * lib/motor/superficie.ts
 * ================================================================
 * Motor de cálculo de superficie real pintada. Creado en R2b.
 *
 * FÓRMULAS:
 *  - Para cada cara marcada se calcula su superficie en m².
 *  - El ancho mínimo de pistola (15 cm por defecto) redondea hacia
 *    arriba las dimensiones menores que ese mínimo: si pintas una
 *    tira de 5 cm de ancho la pistola cubre 15 cm igual.
 *  - Las 6 caras de una caja rectangular tienen estas superficies:
 *      frontal  = ancho × alto        (efectivas ≥ 15cm)
 *      trasera  = ancho × alto
 *      sup/inf  = ancho × grosor
 *      izq/der  = grosor × alto
 *  - modo_precio='ml' usa ancho_minimo_pistola_cm como ancho efectivo
 *    (1 ml = 1 m × 0.15 m = 0.15 m²).
 *
 * ================================================================
 */

export interface CarasSeleccionadas {
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
}

export interface InputSuperficie {
  modo_precio: 'm2' | 'pieza' | 'ml' | 'manual'

  /** Dimensiones en mm. */
  ancho?: number | null
  alto?: number | null
  grosor?: number | null
  /** Solo para modo_precio='ml'. */
  longitud_ml?: number | null

  caras: CarasSeleccionadas
  contabilizar_grosor: boolean

  /** Unidades solicitadas (si modo=pieza esto multiplica). */
  cantidad: number

  /** Ancho mínimo efectivo de la pistola, en cm. Viene de configuracion_empresa. */
  ancho_minimo_pistola_cm: number
}

export interface DesgloseSuperficie {
  superficie_por_cara_m2: {
    frontal:    number
    trasera:    number
    sup:        number
    inf:        number
    izq:        number
    der:        number
  }
  superficie_unitaria_m2: number   // superficie de 1 pieza
  superficie_total_m2:    number   // unitaria × cantidad
  aviso_ancho_minimo:     boolean  // true si alguna dimensión < ancho_minimo
  aviso_irregular:        boolean  // modo=manual o faltan datos
}

const MM_A_M = 1 / 1000

/**
 * Aplica el ancho mínimo de pistola: si una dimensión es menor que
 * el ancho_minimo_cm, se redondea al mínimo. Si es ≥, se deja tal cual.
 */
function efectiva(dim_mm: number | null | undefined, min_cm: number): number {
  const d = Number(dim_mm ?? 0) * MM_A_M
  const min_m = Number(min_cm) / 100
  if (d <= 0) return 0
  return d < min_m ? min_m : d
}

/**
 * Calcula la superficie real pintada de una pieza según caras,
 * grosor, ancho mínimo de pistola y modo de precio.
 */
export function calcularSuperficie(input: InputSuperficie): DesgloseSuperficie {
  const min_cm = input.ancho_minimo_pistola_cm || 15

  // Caso manual (irregular): no hay motor.
  if (input.modo_precio === 'manual') {
    return {
      superficie_por_cara_m2: {
        frontal: 0, trasera: 0, sup: 0, inf: 0, izq: 0, der: 0,
      },
      superficie_unitaria_m2: 0,
      superficie_total_m2:    0,
      aviso_ancho_minimo:     false,
      aviso_irregular:        true,
    }
  }

  // Caso metro lineal: 1 ml = longitud_ml × ancho_minimo_pistola.
  if (input.modo_precio === 'ml') {
    const long_m = Number(input.longitud_ml ?? 0)
    const ancho_m = Number(min_cm) / 100
    const sup_unitaria = long_m * ancho_m
    const cantidad = Math.max(1, Number(input.cantidad) || 1)
    return {
      superficie_por_cara_m2: {
        frontal: sup_unitaria, trasera: 0, sup: 0, inf: 0, izq: 0, der: 0,
      },
      superficie_unitaria_m2: sup_unitaria,
      superficie_total_m2:    sup_unitaria * cantidad,
      aviso_ancho_minimo:     false,
      aviso_irregular:        false,
    }
  }

  // Casos m² y pieza: usan caras + dimensiones.
  const ancho_raw  = Number(input.ancho ?? 0)
  const alto_raw   = Number(input.alto ?? 0)
  const grosor_raw = Number(input.grosor ?? 0)

  const ancho_ef  = efectiva(ancho_raw,  min_cm)
  const alto_ef   = efectiva(alto_raw,   min_cm)
  const grosor_ef = efectiva(grosor_raw, min_cm)

  // ¿Ha habido que subir alguna dimensión al mínimo?
  const aviso_ancho_minimo =
    (ancho_raw  > 0 && ancho_raw  * MM_A_M < min_cm / 100) ||
    (alto_raw   > 0 && alto_raw   * MM_A_M < min_cm / 100) ||
    (grosor_raw > 0 && grosor_raw * MM_A_M < min_cm / 100)

  // Superficies por cara (en m²)
  const frontal = input.caras.cara_frontal    ? ancho_ef  * alto_ef   : 0
  const trasera = input.caras.cara_trasera    ? ancho_ef  * alto_ef   : 0

  // Los cantos usan el grosor. Si contabilizar_grosor=false, el usuario
  // ha dicho que el grosor no se pinta (típico zócalos/mueble cocina
  // donde el borde se pinta de paso al hacer la frontal).
  const cantoActivo = input.contabilizar_grosor ? grosor_ef : 0
  const sup = input.caras.canto_superior   ? ancho_ef  * cantoActivo : 0
  const inf = input.caras.canto_inferior   ? ancho_ef  * cantoActivo : 0
  const izq = input.caras.canto_izquierdo  ? cantoActivo * alto_ef   : 0
  const der = input.caras.canto_derecho    ? cantoActivo * alto_ef   : 0

  const sup_unitaria = frontal + trasera + sup + inf + izq + der
  const cantidad = Math.max(1, Number(input.cantidad) || 1)

  return {
    superficie_por_cara_m2: {
      frontal, trasera, sup, inf, izq, der,
    },
    superficie_unitaria_m2: sup_unitaria,
    superficie_total_m2:    sup_unitaria * cantidad,
    aviso_ancho_minimo,
    aviso_irregular:        false,
  }
}
