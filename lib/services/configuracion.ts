import { createClient } from '../supabase/client'

export interface ConfiguracionEmpresa {
  id: number
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
  created_at: string
  updated_at: string
}

/**
 * Obtener configuración empresa (fila singleton id=1)
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
 * Actualizar configuración empresa
 */
export async function actualizarConfiguracionEmpresa(
  cambios: Partial<Omit<ConfiguracionEmpresa, 'id' | 'created_at' | 'updated_at'>>
): Promise<ConfiguracionEmpresa> {
  const supabase = createClient()

  // UPSERT: si no existe fila singleton, la crea; si existe, la actualiza
  const { data, error } = await supabase
    .from('configuracion_empresa')
    .upsert({ id: 1, ...cambios }, { onConflict: 'id' })
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
 * Sobrescribe el logo existente si lo hay.
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

  // Nombre único con extensión original
  const ext = file.name.split('.').pop() || 'png'
  const nombreArchivo = `logo-${Date.now()}.${ext}`

  // Subir
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('empresa-assets')
    .upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('[configuracion] Error subiendo logo:', uploadError)
    throw uploadError
  }

  // URL pública
  const { data: urlData } = supabase.storage
    .from('empresa-assets')
    .getPublicUrl(uploadData.path)

  return urlData.publicUrl
}

/**
 * Eliminar logo del Storage (opcional, no crítico)
 */
export async function eliminarLogoEmpresa(url: string): Promise<void> {
  const supabase = createClient()
  // Extraer nombre del archivo desde la URL
  const partes = url.split('/empresa-assets/')
  if (partes.length !== 2) return
  const nombreArchivo = partes[1]
  await supabase.storage.from('empresa-assets').remove([nombreArchivo])
}
