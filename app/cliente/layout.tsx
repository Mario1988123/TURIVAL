'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TuriavalLogo } from '@/components/branding/turiaval-logo'

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

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
          <button
            type="button"
            onClick={logout}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
