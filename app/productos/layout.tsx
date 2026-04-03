'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function ProductosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppLayout title="Productos">
      {children}
    </AppLayout>
  )
}
