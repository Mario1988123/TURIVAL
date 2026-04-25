'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function NotifLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Notificaciones">{children}</AppLayout>
}
