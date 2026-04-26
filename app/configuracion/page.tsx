import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracionEmpresaForm from '@/components/configuracion/configuracion-empresa-form'
import { smtpDisponible, verificarSmtp } from '@/lib/email/transport'
import BannerSmtp from './banner-smtp'
import BotonBackup from './boton-backup'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Diagnóstico SMTP server-side: si está configurado, lo verificamos
  const disponible = smtpDisponible()
  let verificacion: { ok: boolean; error?: string } | null = null
  if (disponible) {
    verificacion = await verificarSmtp().catch(() => ({ ok: false, error: 'Error verificando' }))
  }

  return (
    <div className="space-y-6">
      <BannerSmtp configurado={disponible} verificacion={verificacion} />
      <BotonBackup />
      <ConfiguracionEmpresaForm />
    </div>
  )
}
