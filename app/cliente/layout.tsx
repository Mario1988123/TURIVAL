'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TuriavalLogo } from '@/components/branding/turiaval-logo'
import MenuUsuario from '@/components/layout/menu-usuario'
import type { Profile } from '@/lib/types/erp'

/**
 * Layout del portal externo de cliente. Antes solo tenía un botón "Salir";
 * ahora añadimos también el avatar/dropdown con cerrar sesión, igual que
 * el resto del CRM, para que la experiencia sea consistente.
 *
 * NO incluye CampanitaNotificaciones porque la campanita actual lista
 * notificaciones internas del taller (presupuestos, piezas, retrasos);
 * un cliente externo no debe verlas.
 */
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<Profile | null>(null)

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) setUser(data as Profile)
    }
    cargar()
  }, [supabase])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <TuriavalLogo size={36} className="rounded-lg" />
            <div>
              <div className="font-bold text-slate-900 tracking-tight">Turiaval</div>
              <div className="text-[10px] text-slate-500">Portal cliente</div>
            </div>
          </Link>
          <MenuUsuario user={user} onLogout={logout} esAdmin={false} />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
