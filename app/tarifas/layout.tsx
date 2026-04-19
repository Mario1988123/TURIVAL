'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function TarifasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppLayout title="Tarifas">
      {children}
    </AppLayout>
  )
}
