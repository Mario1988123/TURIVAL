"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users,
  Package,
  Palette,
  Droplets,
  Euro,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  section?: string
}

const items: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, section: "Principal" },

  // Capa 1 — Clientes
  {
    href: "/dashboard/clientes",
    label: "Clientes",
    icon: Users,
    section: "Clientes",
  },

  // Capa 2 — Catálogo
  {
    href: "/productos",
    label: "Productos",
    icon: Package,
    section: "Catálogo",
  },
  { href: "/colores", label: "Colores", icon: Palette, section: "Catálogo" },
  {
    href: "/tratamientos",
    label: "Tratamientos",
    icon: Droplets,
    section: "Catálogo",
  },
  { href: "/tarifas", label: "Tarifas", icon: Euro, section: "Catálogo" },

  // Capa 3 — Presupuestos
  {
    href: "/dashboard/presupuestos",
    label: "Presupuestos",
    icon: FileText,
    section: "Ventas",
  },
]

export default function AppSidebar() {
  const pathname = usePathname()

  // Agrupar por sección
  const grupos = items.reduce<Record<string, NavItem[]>>((acc, it) => {
    const s = it.section ?? "Otros"
    if (!acc[s]) acc[s] = []
    acc[s].push(it)
    return acc
  }, {})

  return (
    <aside className="w-60 bg-white border-r h-screen sticky top-0 flex flex-col">
      <div className="h-16 flex items-center px-5 border-b">
        <div>
          <div className="font-bold text-lg leading-tight">TURIAVAL</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            CRM Lacados
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {Object.entries(grupos).map(([seccion, its]) => (
          <div key={seccion}>
            <div className="px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {seccion}
            </div>
            <ul className="space-y-0.5">
              {its.map((it) => {
                const activo =
                  pathname === it.href ||
                  (it.href !== "/dashboard" && pathname.startsWith(it.href))
                const Icon = it.icon
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        activo
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{it.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t">
        <Link
          href="/dashboard/ajustes"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
        >
          <Settings className="w-4 h-4" />
          <span>Ajustes</span>
        </Link>
      </div>
    </aside>
  )
}
