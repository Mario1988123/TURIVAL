'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Package,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { Profile } from '@/lib/types/erp'
import { MENU_ITEMS } from '@/components/layout/menu-items'

const LS_KEY = 'turival:sidebar_collapsed'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(LS_KEY)
    if (saved === '1') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(v => {
      const nuevo = !v
      try { localStorage.setItem(LS_KEY, nuevo ? '1' : '0') } catch {}
      return nuevo
    })
  }

  useEffect(() => {
    async function checkUser() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (!session || sessionError) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profile) setUser(profile as Profile)
      setLoading(false)
    }
    checkUser()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  const anchoSidebar = collapsed ? 'md:w-20' : 'md:w-72'

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl transition-all duration-300 ease-out md:relative md:translate-x-0 flex flex-col ${anchoSidebar} ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`border-b border-white/10 ${collapsed ? 'px-3 py-6' : 'px-6 py-8'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Package className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-xl font-bold text-white">Turiaval</h1>
                <p className="text-xs text-slate-400">ERP lacados</p>
              </div>
            )}
          </div>
        </div>
        <nav className={`flex-1 overflow-y-auto py-6 space-y-1 scrollbar-thin ${collapsed ? 'px-2' : 'px-4'}`}>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200 group ${collapsed ? 'justify-center p-2' : 'gap-3 px-4 py-3'}`}
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                {!collapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className={`border-t border-white/10 space-y-3 ${collapsed ? 'p-2' : 'p-4'}`}>
          {user && !collapsed && (
            <div className="px-4 py-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {user.nombre?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.nombre}</p>
                  <p className="text-xs text-slate-400 capitalize">{user.rol}</p>
                </div>
              </div>
            </div>
          )}
          {user?.rol === 'admin' && (
            <Link
              href="/dashboard/admin"
              title={collapsed ? 'Panel Admin' : undefined}
              className={`flex items-center rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">Panel Admin</span>}
            </Link>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`w-full flex items-center rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Cerrar sesion</span>}
          </button>
        </div>

        <button
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-3 top-6 h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow-md hover:bg-slate-50 border border-slate-200 z-[55]"
          title={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>
      <button className="md:hidden fixed top-4 left-4 z-[60] p-3 bg-slate-900 text-white rounded-xl shadow-lg" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsOpen(false)} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="md:hidden w-10" />
            <h2 className="text-xl font-semibold text-slate-800">Panel de Control</h2>
            <span className="text-sm text-slate-500 hidden sm:block">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
