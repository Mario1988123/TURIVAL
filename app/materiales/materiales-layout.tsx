import { AppLayout } from '@/components/layout/app-sidebar'

export default function MaterialesLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Materiales">{children}</AppLayout>
}
