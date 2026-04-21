import { AppLayout } from '@/components/layout/app-sidebar'

export default function ProduccionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout title="Producción">{children}</AppLayout>
}
