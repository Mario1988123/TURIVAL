/**
 * lib/motor/procesos-defaults.ts
 * ================================================================
 * Tiempos base y configuración por defecto de cada proceso.
 *
 * Estos valores se usan como punto de partida cuando se añade un
 * proceso a una pieza recurrente o a una línea de presupuesto.
 * El usuario puede editarlos por pieza. El sistema ajustará los
 * estimados con el histórico (historial_tiempos_proceso) en R6.
 *
 * Solo 3 procesos consumen material: FONDO, FONDEADO_2, LACADO.
 * ================================================================
 */

export interface ProcesoDefault {
  codigo: string
  nombre: string
  abreviatura: string
  tiempo_base_min: number
  tiempo_por_m2_min: number
  consume_material: boolean
  tipo_material?: 'lacado' | 'fondo'
}

/**
 * Defaults iniciales por código de proceso (seeds del script 015 + defaults
 * de tiempo orientativos que Mario ajustará en el uso).
 */
export const PROCESOS_DEFAULTS: Record<string, ProcesoDefault> = {
  COMPROB_MATERIAL: {
    codigo: 'COMPROB_MATERIAL', nombre: 'Comprobación material', abreviatura: 'C',
    tiempo_base_min: 1,  tiempo_por_m2_min: 0,  consume_material: false,
  },
  LIJADO: {
    codigo: 'LIJADO', nombre: 'Lijado', abreviatura: 'L',
    tiempo_base_min: 2,  tiempo_por_m2_min: 15, consume_material: false,
  },
  FONDO: {
    codigo: 'FONDO', nombre: 'Fondeado', abreviatura: 'F',
    tiempo_base_min: 3,  tiempo_por_m2_min: 12, consume_material: true, tipo_material: 'fondo',
  },
  LIJADO_2: {
    codigo: 'LIJADO_2', nombre: 'Segundo lijado', abreviatura: 'L2',
    tiempo_base_min: 2,  tiempo_por_m2_min: 10, consume_material: false,
  },
  FONDEADO_2: {
    codigo: 'FONDEADO_2', nombre: 'Segundo fondeado', abreviatura: 'F2',
    tiempo_base_min: 3,  tiempo_por_m2_min: 10, consume_material: true, tipo_material: 'fondo',
  },
  LACADO: {
    codigo: 'LACADO', nombre: 'Lacado', abreviatura: 'La',
    tiempo_base_min: 3,  tiempo_por_m2_min: 15, consume_material: true, tipo_material: 'lacado',
  },
  TERMINACION: {
    codigo: 'TERMINACION', nombre: 'Terminación', abreviatura: 'T',
    tiempo_base_min: 2,  tiempo_por_m2_min: 3,  consume_material: false,
  },
  RECEPCION: {
    codigo: 'RECEPCION', nombre: 'Recepción', abreviatura: 'R',
    tiempo_base_min: 1,  tiempo_por_m2_min: 0,  consume_material: false,
  },
  PICKING: {
    codigo: 'PICKING', nombre: 'Picking', abreviatura: 'P',
    tiempo_base_min: 2,  tiempo_por_m2_min: 0,  consume_material: false,
  },
}

/**
 * Obtener los defaults de un proceso por código.
 */
export function getProcesoDefault(codigo: string): ProcesoDefault | null {
  return PROCESOS_DEFAULTS[codigo] ?? null
}

/**
 * Orden típico de los procesos (usado al ordenar la lista por defecto
 * cuando se carga desde categorías).
 */
export const PROCESOS_ORDEN: string[] = [
  'COMPROB_MATERIAL',
  'LIJADO',
  'FONDO',
  'LIJADO_2',
  'FONDEADO_2',
  'LACADO',
  'TERMINACION',
  'RECEPCION',
  'PICKING',
]
