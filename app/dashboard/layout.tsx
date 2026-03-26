'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  PackageCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Package,
  QrCode,
  FileBarChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/types/erp'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { label: 'Pedidos', href: '/pedidos', icon: ShoppingCart },
  { label: 'Producción', href: '/produccion', icon: Package },
  { label: 'Albaranes', href: '/albaranes', icon: FileBarChart },
  { label: 'Trazabilidad', href: '/trazabilidad', icon: QrCode },
  { label: 'Clientes', href: '/dashboard/clientes', icon: Settings },
  { label: 'Catálogos', href: '/dashboard/catalogo', icon: BarChart3 },
  { label: 'Informes', href: '/informes', icon: BarChart3 },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!session || sessionError) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUser(profile as Profile)
      }
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
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50 flex-shrink-0">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">FinePath</h1>
          <p className="text-xs text-slate-400 mt-1">ERP Lacados</p>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 hover:bg-slate-800 text-slate-300 hover:text-white group"
            >
              <item.icon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-slate-700/50 p-4 flex-shrink-0">
          {user && (
            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400">Usuario</p>
              <p className="text-sm font-medium text-white truncate">{user.nombre}</p>
              <p className="text-xs text-slate-400 capitalize">{user.rol}</p>
            </div>
          )}
          {user?.rol === 'admin' && (
            <Link
              href="/dashboard/admin"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors text-sm font-medium mb-2 w-full"
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-300 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Info */}
          <div className="border-t border-slate-700 p-4">
            <div className="mb-4">
              <p className="text-sm text-slate-400">Conectado como</p>
              <p className="font-semibold truncate">{user?.nombre || 'Usuario'}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.rol}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="p-6">{children}</div>
        </main>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <button
          className="fixed inset-0 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
