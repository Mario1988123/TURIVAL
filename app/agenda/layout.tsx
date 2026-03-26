'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function AgendaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout title="Agenda">{children}</AppLayout>
}
