'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/types/erp'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  ShoppingCart,
  Package,
  Palette,
  Layers,
  Euro,
  QrCode,
  Users,
  Factory,
  Truck,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  Settings,
  MapPin,
} from 'lucide-react'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Clientes', href: '/dashboard/clientes', icon: Users },
  { label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { label: 'Pedidos', href: '/pedidos', icon: ShoppingCart },
  { label: 'Producción', href: '/produccion', icon: Factory },
  { label: 'Albaranes', href: '/albaranes', icon: Truck },
  { label: 'Productos', href: '/productos', icon: Package },
  { label: 'Materiales', href: '/materiales', icon: Palette },
  { label: 'Proveedores', href: '/configuracion/proveedores', icon: Truck },
  { label: 'Tratamientos', href: '/tratamientos', icon: Layers },
  { label: 'Tarifas', href: '/tarifas', icon: Euro },
  { label: 'Trazabilidad', href: '/trazabilidad', icon: QrCode },
  { label: 'Informes', href: '/informes', icon: BarChart3 },
  { label: 'Operarios', href: '/configuracion/operarios', icon: Users },
  { label: 'Ubicaciones', href: '/configuracion/ubicaciones', icon: MapPin },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]

interface AppLayoutProps {
  children: React.ReactNode
  title: string
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
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

  return (
    <div className="flex h-screen bg-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl transition-transform duration-300 ease-out md:relative md:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Turiaval</h1>
              <p className="text-xs text-slate-400">ERP lacados</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-thin">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3">
          {user && (
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium text-sm">Panel Admin</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <button
        className="md:hidden fixed top-4 left-4 z-[60] p-3 bg-slate-900 text-white rounded-xl shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="md:hidden w-10" />
            <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 hidden sm:block">
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
