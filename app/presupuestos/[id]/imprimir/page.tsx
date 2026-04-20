import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PresupuestoImprimible from '@/components/presupuestos/presupuesto-imprimible'

export const dynamic = 'force-dynamic'

export default async function ImprimirPresupuestoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Cargar presupuesto con cliente
  const { data: presupuesto, error: errPres } = await supabase
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
    .eq('id', id)
    .single()

  if (errPres || !presupuesto) notFound()

  // Líneas
  const { data: lineas } = await supabase
    .from('lineas_presupuesto')
    .select('*')
    .eq('presupuesto_id', id)
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
    />
  )
}
