import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracionEmpresaForm from '@/components/configuracion/configuracion-empresa-form'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <ConfiguracionEmpresaForm />
}
