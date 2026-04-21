import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MaterialesCliente from './materiales-cliente'

export const dynamic = 'force-dynamic'

export default async function MaterialesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <MaterialesCliente />
}
