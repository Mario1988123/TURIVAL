'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function ColoresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppLayout title="Colores">
      {children}
    </AppLayout>
  )
}
