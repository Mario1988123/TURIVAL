'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FileText, ShoppingCart, Package, FileBarChart, QrCode, Settings, BarChart3, LogOut, Menu, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { label: 'Pedidos', href: '/pedidos', icon: ShoppingCart },
  { label: 'Produccion', href: '/produccion', icon: Package },
  { label: 'Albaranes', href: '/albaranes', icon: FileBarChart },
  { label: 'Trazabilidad', href: '/trazabilidad', icon: QrCode },
  { label: 'Clientes', href: '/dashboard/clientes', icon: Users },
  { label: 'Catalogos', href: '/dashboard/catalogo', icon: Settings },
  { label: 'Informes', href: '/informes', icon: BarChart3 },
]

export default function TrazabilidadLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profile) setUser(profile)
      setLoading(false)
    }
    checkUser()
  }, [router, supabase])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/auth/login') }

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>

  return (
    <div className="flex h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-lg transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700"><h1 className="text-2xl font-bold">FinePath</h1><p className="text-sm text-slate-400">ERP Lacados</p></div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {MENU_ITEMS.map((item) => { const Icon = item.icon; return (<Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors" onClick={() => setIsOpen(false)}><Icon className="w-5 h-5" /><span>{item.label}</span></Link>) })}
          </nav>
          <div className="border-t border-slate-700 p-4">
            <div className="mb-4"><p className="text-sm text-slate-400">Conectado como</p><p className="font-semibold truncate">{user?.nombre || 'Usuario'}</p><p className="text-xs text-slate-500 capitalize">{user?.rol}</p></div>
            <Button variant="destructive" size="sm" className="w-full" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Cerrar sesion</Button>
          </div>
        </div>
      </aside>
      <button className="md:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-lg" onClick={() => setIsOpen(!isOpen)}>{isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-slate-900">Trazabilidad</h2><span className="text-sm text-slate-600">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div></header>
        <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
      </div>
      {isOpen && <button className="fixed inset-0 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />}
    </div>
  )
}
