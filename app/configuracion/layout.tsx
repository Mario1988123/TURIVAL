'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout title="Configuración">{children}</AppLayout>
}
