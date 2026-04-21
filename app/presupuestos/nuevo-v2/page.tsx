import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PresupuestoV2Cliente from './presupuesto-v2-cliente'

export const dynamic = 'force-dynamic'

export default async function NuevoPresupuestoV2Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <PresupuestoV2Cliente />
}
