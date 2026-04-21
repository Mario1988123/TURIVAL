/**
 * lib/services/referencias-cliente.ts
 * ================================================================
 * CRUD de piezas recurrentes de cliente. Creado en R4.
 *
 * Una referencia_cliente es una pieza que un cliente concreto pide
 * de forma recurrente (p.ej. Leroy Merlín pide siempre las mismas
 * puertas de cocina modelo X4). Guarda medidas, caras, procesos,
 * materiales y descuento. El coste y precio se calculan con el motor
 * y se persisten en coste_calculado_ultimo / precio_calculado_ultimo.
 * ================================================================
 */

import { createClient } from './client'
import { obtenerConfiguracionEmpresa, extraerConfigErp } from './configuracion'
import { obtenerMaterial, resolverPrecioKg, resolverRendimientoKgM2 } from './materiales'
import { calcularSuperficie, type CarasSeleccionadas } from '@/lib/motor/superficie'
import { calcularCoste, type ProcesoInput, type FactorComplejidad } from '@/lib/motor/coste'
import { getProcesoDefault } from '@/lib/motor/procesos-defaults'

export interface ReferenciaCliente {
  id: string
  cliente_id: string
  referencia_cliente: string        // código único por cliente
  referencia_interna: string | null
  nombre_pieza: string | null
  descripcion: string | null

  // Dimensión
  categoria_pieza_id: string | null
  modo_precio: 'm2' | 'pieza' | 'ml' | 'manual'
  ancho: number | null
  alto: number | null
  grosor: number | null
  longitud_ml: number | null

  // Caras y grosor
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  contabilizar_grosor: boolean

  // Materiales (solo para lacado/fondo)
  material_lacado_id: string | null
  material_fondo_id: string | null

  // Procesos (jsonb con tiempos y orden)
  procesos: Array<{
    proceso_codigo: string
    orden: number
    tiempo_base_min?: number
    tiempo_por_m2_min?: number
  }>

  // Precio y complejidad
  factor_complejidad: FactorComplejidad
  descuento_porcentaje: number
  precio_aproximado: boolean
  precio_pactado: number | null

  // Snapshots del último cálculo
  coste_calculado_ultimo: number | null
  precio_calculado_ultimo: number | null
  fecha_ultimo_calculo: string | null

  observaciones: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

// =================================================================
// CRUD
// =================================================================

export async function listarReferenciasPorCliente(
  cliente_id: string,
  activas_solo: boolean = true
): Promise<ReferenciaCliente[]> {
  const supabase = createClient()
  let q = supabase
    .from('referencias_cliente')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('referencia_cliente')

  if (activas_solo) q = q.eq('activo', true)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ReferenciaCliente[]
}

export async function obtenerReferencia(id: string): Promise<ReferenciaCliente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('referencias_cliente')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as ReferenciaCliente
}

export async function crearReferencia(
  datos: Omit<ReferenciaCliente,
    'id' | 'created_at' | 'updated_at' |
    'coste_calculado_ultimo' | 'precio_calculado_ultimo' | 'fecha_ultimo_calculo'>
): Promise<ReferenciaCliente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('referencias_cliente')
    .insert(datos)
    .select()
    .single()
  if (error) throw error
  return data as ReferenciaCliente
}

export async function actualizarReferencia(
  id: string,
  datos: Partial<Omit<ReferenciaCliente,
    'id' | 'cliente_id' | 'created_at' | 'updated_at'>>
): Promise<ReferenciaCliente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('referencias_cliente')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ReferenciaCliente
}

export async function toggleActivoReferencia(id: string, activo: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('referencias_cliente')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function borrarReferencia(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('referencias_cliente')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// =================================================================
// MOTOR: recalcular coste y precio de una referencia
// =================================================================

/**
 * Lee una referencia, su config, sus materiales y ejecuta el motor.
 * Persiste el resultado en coste_calculado_ultimo / precio_calculado_ultimo.
 *
 * Devuelve el desglose completo para que la UI pueda mostrarlo.
 */
export async function recalcularCosteReferencia(id: string) {
  const ref = await obtenerReferencia(id)

  const conf = await obtenerConfiguracionEmpresa()
  if (!conf) throw new Error('configuracion_empresa no encontrada')
  const cfg = extraerConfigErp(conf)

  // Cargar materiales
  let precio_lacado = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_fondo  = null as { precio_kg: number; rendimiento_kg_m2: number } | null
  let precio_cata_kg = 0
  let precio_dis_kg  = 0

  if (ref.material_lacado_id) {
    const m = await obtenerMaterial(ref.material_lacado_id)
    precio_lacado = {
      precio_kg: resolverPrecioKg(m),
      rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg),
    }
  }
  if (ref.material_fondo_id) {
    const m = await obtenerMaterial(ref.material_fondo_id)
    precio_fondo = {
      precio_kg: resolverPrecioKg(m),
      rendimiento_kg_m2: resolverRendimientoKgM2(m, cfg),
    }
  }
  if (cfg.material_catalizador_default_id) {
    const m = await obtenerMaterial(cfg.material_catalizador_default_id)
    precio_cata_kg = resolverPrecioKg(m)
  }
  if (cfg.material_disolvente_default_id) {
    const m = await obtenerMaterial(cfg.material_disolvente_default_id)
    precio_dis_kg = resolverPrecioKg(m)
  }

  // Superficie
  const caras: CarasSeleccionadas = {
    cara_frontal: ref.cara_frontal,
    cara_trasera: ref.cara_trasera,
    canto_superior: ref.canto_superior,
    canto_inferior: ref.canto_inferior,
    canto_izquierdo: ref.canto_izquierdo,
    canto_derecho: ref.canto_derecho,
  }
  const superficie = calcularSuperficie({
    modo_precio: ref.modo_precio,
    ancho: ref.ancho,
    alto: ref.alto,
    grosor: ref.grosor,
    longitud_ml: ref.longitud_ml,
    caras,
    contabilizar_grosor: ref.contabilizar_grosor,
    cantidad: 1,  // 1 unidad para el snapshot
    ancho_minimo_pistola_cm: cfg.ancho_minimo_pistola_cm,
  })

  // Procesos: merge entre lo guardado y los defaults
  const procesos: ProcesoInput[] = ref.procesos
    .sort((a, b) => a.orden - b.orden)
    .map(p => {
      const def = getProcesoDefault(p.proceso_codigo)
      return {
        codigo: p.proceso_codigo,
        tiempo_base_min:   p.tiempo_base_min   ?? def?.tiempo_base_min   ?? 0,
        tiempo_por_m2_min: p.tiempo_por_m2_min ?? def?.tiempo_por_m2_min ?? 0,
        consume_material:  def?.consume_material ?? false,
        tipo_material:     def?.tipo_material,
      }
    })

  // Ejecutar motor
  const desglose = calcularCoste({
    superficie_m2: superficie.superficie_unitaria_m2,
    factor_complejidad: ref.factor_complejidad,
    precio_lacado,
    precio_fondo,
    precio_cata_kg,
    precio_dis_kg,
    procesos,
    descuento_porcentaje: ref.descuento_porcentaje,
    cantidad: 1,
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

  // Persistir snapshot
  await actualizarReferencia(id, {
    coste_calculado_ultimo:  desglose.coste_total_unitario,
    precio_calculado_ultimo: desglose.precio_final_unitario,
    fecha_ultimo_calculo:    new Date().toISOString(),
  } as any)

  return { superficie, desglose }
}
