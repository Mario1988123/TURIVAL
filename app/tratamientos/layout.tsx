'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function TratamientosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppLayout title="Tratamientos">
      {children}
    </AppLayout>
  )
}
