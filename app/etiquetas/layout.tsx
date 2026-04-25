'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function EtiquetasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout title="Etiquetas">{children}</AppLayout>
}
