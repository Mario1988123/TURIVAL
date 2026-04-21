import { AppLayout } from '@/components/layout/app-sidebar'

export default function NuevoV2Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Nuevo presupuesto (motor ERP)">{children}</AppLayout>
}

