/**
 * Fuente única de las entradas del sidebar.
 * Compartido entre:
 *   - components/layout/app-sidebar.tsx
 *   - app/dashboard/layout.tsx
 *
 * Antes había dos listas idénticas duplicadas (bug recurrente H). Cualquier
 * entrada añadida/quitada aquí se refleja automáticamente en ambos sidebars.
 */

import {
  LayoutDashboard,
  Calendar,
  CalendarRange,
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
  MapPin,
  Clock,
  Settings,
  ShieldCheck,
  TrendingUp,
  CircleDot,
  Bell,
  type LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  label: string
  href: string
  icon: LucideIcon
  /** Slug del modulo para el sistema de permisos. Si falta se considera publico. */
  moduloSlug?: string
}

export const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard',         href: '/dashboard',                  icon: LayoutDashboard, moduloSlug: 'dashboard' },
  { label: 'Planificador',      href: '/planificador',               icon: CalendarRange,   moduloSlug: 'planificador' },
  { label: 'Agenda',            href: '/agenda',                     icon: Calendar,        moduloSlug: 'agenda' },
  { label: 'Clientes',          href: '/dashboard/clientes',         icon: Users,           moduloSlug: 'dashboard' },
  { label: 'Presupuestos',      href: '/presupuestos',               icon: FileText,        moduloSlug: 'presupuestos' },
  { label: 'Pedidos',           href: '/pedidos',                    icon: ShoppingCart,    moduloSlug: 'pedidos' },
  { label: 'Producción',        href: '/produccion',                 icon: Factory,         moduloSlug: 'produccion' },
  { label: 'Fichajes',          href: '/fichajes',                   icon: CircleDot,       moduloSlug: 'fichajes' },
  { label: 'Albaranes',         href: '/albaranes',                  icon: Truck,           moduloSlug: 'albaranes' },
  { label: 'Productos',         href: '/productos',                  icon: Package,         moduloSlug: 'productos' },
  { label: 'Materiales',        href: '/materiales',                 icon: Palette,         moduloSlug: 'materiales' },
  { label: 'Proveedores',       href: '/configuracion/proveedores',  icon: Truck,           moduloSlug: 'configuracion' },
  { label: 'Tratamientos',      href: '/tratamientos',               icon: Layers,          moduloSlug: 'tratamientos' },
  { label: 'Tarifas',           href: '/tarifas',                    icon: Euro,            moduloSlug: 'tarifas' },
  { label: 'Trazabilidad',      href: '/trazabilidad',               icon: QrCode,          moduloSlug: 'trazabilidad' },
  { label: 'Notificaciones',    href: '/notificaciones',             icon: Bell,            moduloSlug: 'dashboard' },
  { label: 'Informes',          href: '/informes',                   icon: BarChart3,       moduloSlug: 'informes' },
  { label: 'Coste por pieza',   href: '/informes/coste-pieza',       icon: Euro,            moduloSlug: 'informes' },
  { label: 'Margen real',       href: '/informes/margen-real',       icon: TrendingUp,      moduloSlug: 'informes' },
  { label: 'Operarios',         href: '/configuracion/operarios',    icon: Users,           moduloSlug: 'configuracion' },
  { label: 'Usuarios y roles',  href: '/configuracion/usuarios',     icon: ShieldCheck,     moduloSlug: 'configuracion' },
  { label: 'Ubicaciones',       href: '/configuracion/ubicaciones',  icon: MapPin,          moduloSlug: 'configuracion' },
  { label: 'Tiempos de proceso',href: '/configuracion/tiempos',      icon: Clock,           moduloSlug: 'configuracion' },
  { label: 'Configuración',     href: '/configuracion',              icon: Settings,        moduloSlug: 'configuracion' },
]
