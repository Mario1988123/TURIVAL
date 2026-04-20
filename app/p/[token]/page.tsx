import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PresupuestoImprimible from '@/components/presupuestos/presupuesto-imprimible'

export const dynamic = 'force-dynamic'

/**
 * Ruta pública: /p/[token]
 * No requiere auth. El token actúa como "llave" para ver el presupuesto.
 * Se usa para enviar al cliente por WhatsApp/Email.
 */
export default async function PresupuestoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Validar formato UUID básico
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) notFound()

  // Buscar presupuesto por share_token (NO por id)
  const { data: presupuesto, error } = await supabase
    .from('presupuestos')
    .select(
      `
      *,
      cliente:clientes(
        id, nombre_comercial, razon_social, cif_nif, email, telefono,
        direccion, codigo_postal, ciudad, provincia, persona_contacto
      )
    `
    )
    .eq('share_token', token)
    .maybeSingle()

  if (error || !presupuesto) notFound()

  // Cargar líneas
  const { data: lineas } = await supabase
    .from('lineas_presupuesto')
    .select('*')
    .eq('presupuesto_id', presupuesto.id)
    .order('orden')

  // Configuración empresa
  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  return (
    <PresupuestoImprimible
      presupuesto={presupuesto as any}
      lineas={(lineas ?? []) as any}
      empresa={empresa as any}
      publico={true}
    />
  )
}
