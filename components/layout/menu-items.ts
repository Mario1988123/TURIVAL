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
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  label: string
  href: string
  icon: LucideIcon
}

export const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Planificador', href: '/planificador', icon: CalendarRange },
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
  { label: 'Coste por pieza', href: '/informes/coste-pieza', icon: Euro },
  { label: 'Margen real', href: '/informes/margen-real', icon: TrendingUp },
  { label: 'Operarios', href: '/configuracion/operarios', icon: Users },
  { label: 'Ubicaciones', href: '/configuracion/ubicaciones', icon: MapPin },
  { label: 'Tiempos de proceso', href: '/configuracion/tiempos', icon: Clock },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]
