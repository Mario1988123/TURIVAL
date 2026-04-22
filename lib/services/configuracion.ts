import { createClient } from '../supabase/client'

/**
 * Interfaz Configuración de Empresa — ampliada en R3 con parámetros ERP.
 *
 * Campos originales (datos fiscales, logo, textos) + campos nuevos del
 * rediseño ERP añadidos por el script 022:
 *   - Rendimientos kg/m² (lacado y fondo)
 *   - Ratios de mezcla (catalizador y disolvente, separados lacado/fondo)
 *   - Coste €/min operario + jornada horas
 *   - % margen objetivo
 *   - Ancho mínimo pistola cm (también ancho del ml)
 *   - IDs de catalizador y disolvente por defecto
 */
export interface ConfiguracionEmpresa {
  id: number

  // Datos fiscales
  razon_social: string | null
  nombre_comercial: string | null
  cif_nif: string | null
  direccion: string | null
  codigo_postal: string | null
  ciudad: string | null
  provincia: string | null
  pais: string | null
  telefono: string | null
  email: string | null
  web: string | null
  iban: string | null
  logo_url: string | null
  texto_pie_presupuesto: string | null
  condiciones_pago_default: string | null
  iva_default: number | null

  // R3: Parámetros ERP (rediseño)
  rendimiento_lacado_kg_m2: number
  rendimiento_fondo_kg_m2:  number
  ratio_cata_lacado:        number
  ratio_dis_lacado:         number
  ratio_cata_fondo:         number
  ratio_dis_fondo:          number
  coste_minuto_operario:    number
  jornada_horas:            number
  margen_objetivo_porcentaje: number
  ancho_minimo_pistola_cm:  number
  material_catalizador_default_id: string | null
  material_disolvente_default_id:  string | null

  // R6b: Umbral % de merma por encima del cual salta alerta
  umbral_alerta_merma_pct: number

  created_at: string
  updated_at: string
}

/**
 * Obtener configuración empresa (fila singleton id=1).
 */
export async function obtenerConfiguracionEmpresa(): Promise<ConfiguracionEmpresa | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('[configuracion] Error al obtener:', error)
    throw error
  }
  return data as ConfiguracionEmpresa | null
}

/**
 * Actualizar configuración empresa.
 */
export async function actualizarConfiguracionEmpresa(
  cambios: Partial<Omit<ConfiguracionEmpresa, 'id' | 'created_at' | 'updated_at'>>
): Promise<ConfiguracionEmpresa> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('configuracion_empresa')
    .upsert(
      { id: 1, ...cambios, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (error) {
    console.error('[configuracion] Error al actualizar:', error)
    throw error
  }
  return data as ConfiguracionEmpresa
}

/**
 * Subir logo al bucket Storage "empresa-assets" y devolver URL pública.
 */
export async function subirLogoEmpresa(file: File): Promise<string> {
  const supabase = createClient()

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('El logo no puede superar 5MB')
  }
  const tiposPermitidos = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
  if (!tiposPermitidos.includes(file.type)) {
    throw new Error('Formato no permitido. Usa PNG, JPG, SVG o WEBP.')
  }

  const ext = file.name.split('.').pop() || 'png'
  const nombreArchivo = `logo-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('empresa-assets')
    .upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('[configuracion] Error subiendo logo:', uploadError)
    throw uploadError
  }

  const { data } = supabase.storage
    .from('empresa-assets')
    .getPublicUrl(nombreArchivo)

  return data.publicUrl
}

/**
 * Helper: extraer solo los parámetros ERP de la configuración.
 * Útil para pasarlos a los motores de cálculo sin arrastrar datos fiscales.
 */
export function extraerConfigErp(c: ConfiguracionEmpresa) {
  return {
    rendimiento_lacado_kg_m2:   Number(c.rendimiento_lacado_kg_m2 ?? 0.12),
    rendimiento_fondo_kg_m2:    Number(c.rendimiento_fondo_kg_m2  ?? 0.15),
    ratio_cata_lacado:          Number(c.ratio_cata_lacado        ?? 8),
    ratio_dis_lacado:           Number(c.ratio_dis_lacado         ?? 4),
    ratio_cata_fondo:           Number(c.ratio_cata_fondo         ?? 12),
    ratio_dis_fondo:            Number(c.ratio_dis_fondo          ?? 6),
    coste_minuto_operario:      Number(c.coste_minuto_operario    ?? 0.40),
    jornada_horas:              Number(c.jornada_horas            ?? 8),
    margen_objetivo_porcentaje: Number(c.margen_objetivo_porcentaje ?? 30),
    ancho_minimo_pistola_cm:    Number(c.ancho_minimo_pistola_cm  ?? 15),
    material_catalizador_default_id: c.material_catalizador_default_id ?? null,
    material_disolvente_default_id:  c.material_disolvente_default_id  ?? null,
    umbral_alerta_merma_pct:    Number(c.umbral_alerta_merma_pct ?? 15),
  }
}
