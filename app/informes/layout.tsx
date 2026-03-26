import { AppLayout } from '@/components/layout/app-sidebar'

export default function InformesLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Informes">{children}</AppLayout>
}
