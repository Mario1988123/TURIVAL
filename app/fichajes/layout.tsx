import { AppLayout } from '@/components/layout/app-sidebar'

export default function FichajesLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Fichajes">{children}</AppLayout>
}
