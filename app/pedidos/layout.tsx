import { AppLayout } from '@/components/layout/app-sidebar'

export default function PedidosLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Pedidos">{children}</AppLayout>
}
