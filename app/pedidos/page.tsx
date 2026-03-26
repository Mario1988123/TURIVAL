'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function PedidosPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-gray-600 mt-1">Gestiona pedidos de producción</p>
        </div>
        <Button onClick={() => router.push('/pedidos/nuevo')}>Nuevo Pedido</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">La módulo de pedidos está en desarrollo.</p>
        </CardContent>
      </Card>
    </div>
  )
}
