import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProveedoresCliente from './proveedores-cliente'

export const dynamic = 'force-dynamic'

export default async function ProveedoresPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <ProveedoresCliente />
}
