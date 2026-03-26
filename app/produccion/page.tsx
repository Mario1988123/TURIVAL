'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProduccionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Producción</h1>
          <p className="text-gray-600 mt-1">Monitorea el estado de producción</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">El módulo de producción está en desarrollo.</p>
        </CardContent>
      </Card>
    </div>
  )
}
