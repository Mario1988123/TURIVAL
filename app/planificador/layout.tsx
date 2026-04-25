import { AppLayout } from '@/components/layout/app-sidebar'

export default function PlanificadorLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Planificador">{children}</AppLayout>
}
