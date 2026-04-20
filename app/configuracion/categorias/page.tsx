import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoriasProductoCliente from '@/components/configuracion/categorias-producto-cliente'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <CategoriasProductoCliente />
}
