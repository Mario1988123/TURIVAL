'use client'

import Link from 'next/link'
import { Package, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900">TURIVAL</div>
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
