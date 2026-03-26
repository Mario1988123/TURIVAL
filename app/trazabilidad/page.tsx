'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TrazabilidadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trazabilidad</h1>
        <p className="text-gray-600 mt-1">Consulta el estado de piezas y lotes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">El módulo de trazabilidad está en desarrollo.</p>
        </CardContent>
      </Card>
    </div>
  )
}
