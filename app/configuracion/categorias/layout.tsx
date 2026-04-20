'use client'

import { AppLayout } from '@/components/layout/app-sidebar'

export default function CategoriasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout title="Categorías de productos">{children}</AppLayout>
}
