'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

// Layout raíz del módulo /dashboard (Panel de Control, Clientes, Admin...).
// Reusa el AppLayout del CRM, igual que el resto de módulos. El título de
// la barra superior se deduce automáticamente desde la ruta — así
// /dashboard/clientes ve "Clientes", /dashboard/admin ve "Panel Admin",
// y /dashboard ve "Panel de Control". Antes este layout duplicaba el
// sidebar a mano (170 líneas) y no incluía la campanita ni el avatar
// de usuario; ahora hereda todo automáticamente.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
