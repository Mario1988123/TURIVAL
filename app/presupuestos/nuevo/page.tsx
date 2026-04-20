import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevoPresupuestoCliente from '@/components/presupuestos/nuevo-presupuesto-cliente'

export const dynamic = 'force-dynamic'

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient()

  // Solo check de auth. Todos los datos se cargan client-side.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <NuevoPresupuestoCliente />
}
